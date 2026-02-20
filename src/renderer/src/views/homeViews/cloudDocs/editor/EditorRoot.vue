<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Extension, Node, mergeAttributes } from '@isle-editor/core'
import { addIcon } from '@iconify/vue'
import {
	NAvatar,
	NButton,
	NIcon,
	NInput,
	NModal,
	NSelect,
	NSlider,
	NTag,
	useMessage,
} from 'naive-ui'
import {
	Image24Regular,
	PanelLeft24Regular,
	PanelLeftContract24Regular,
	Share24Regular,
} from '@vicons/fluent'
import {
	IsleEditor,
	IsleEditorBubble,
	IsleEditorToc,
	IsleEditorToolbar,
	NotionKit,
	createSlashSuggestion,
} from '@isle-editor/vue3'
import '@isle-editor/vue3/dist/style.css'
import { useChatStore } from '@renderer/stores/chat'
import { useFriendStore } from '@renderer/stores/friend'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { cloudDocApi } from '@renderer/services/cloudDocApi'
import { cloudDocWs } from '@renderer/services/cloudDocWs'
import type {
	CloudDoc,
	CloudDocSaveState,
	CollabCursor,
} from '@renderer/types/cloudDoc'
import { resolveAvatarUrl } from '@renderer/utils/avatar'
import request from '@renderer/utils/request'

const props = defineProps<{
	doc: CloudDoc
	saveState: CloudDocSaveState
	saveErrorMessage: string
	collabCursors: CollabCursor[]
}>()

const emit = defineEmits<{
	(e: 'update:title', value: string): void
	(
		e: 'update:content',
		payload: { contentHtml: string; contentJson: string },
	): void
}>()

interface CloudEditorSelectionNode {
	type?: { name?: string }
	attrs?: Record<string, unknown>
}

interface CloudEditorSelection {
	node?: CloudEditorSelectionNode
	from?: number
	to?: number
	anchor?: number
	head?: number
	empty?: boolean
}

interface CloudEditorView {
	coordsAtPos: (pos: number) => {
		left: number
		right: number
		top: number
		bottom: number
	}
	state?: {
		doc?: {
			content?: {
				size?: number
			}
		}
	}
}

interface CloudEditor {
	getHTML: () => string
	getJSON: () => unknown
	destroy?: () => void
	state?: {
		selection?: CloudEditorSelection
	}
	view?: CloudEditorView
	chain: () => {
		focus: () => {
			deleteRange?: (range: { from: number; to: number }) => {
				run: () => boolean
			}
			setImage?: (attrs: {
				src: string
				alt?: string
				title?: string
				width?: string
			}) => {
				run: () => boolean
			}
		}
	}
	commands?: {
		updateAttributes?: (
			type: string,
			attributes: Record<string, unknown>,
		) => boolean
	}
}

interface RenderedCollabCursor {
	key: string
	name: string
	color: string
	top: number
	left: number
	height: number
}

const CURSOR_SEND_DEBOUNCE_MS = 80

const editorRef = ref<{
	editor?: CloudEditor
} | null>(null)

const localTitle = ref(props.doc.title)
const localContent = ref(props.doc.contentHtml || '')
const chatStore = useChatStore()
const friendStore = useFriendStore()
const userInfoStore = useUserInfoStore()
const showToc = ref(true)
const scrollViewRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const imageSelected = ref(false)
const imageWidthPercent = ref(100)
const sharing = ref(false)
const shareFriendsLoading = ref(false)
const shareDialogVisible = ref(false)
const shareFriendAccount = ref('')
const shareExpireHoursInput = ref('168')
const renderedCollabCursors = ref<RenderedCollabCursor[]>([])
const message = useMessage()
let cursorSendTimer: ReturnType<typeof setTimeout> | null = null
let cursorOverlayRefreshTimer: ReturnType<typeof setTimeout> | null = null
let lastCursorSignature = ''
const onWindowResize = (): void => {
	scheduleRefreshCollabCursors()
}
const bubbleTippyOptions = computed(() => ({
	appendTo: () => scrollViewRef.value || document.body,
	maxWidth: 'none',
	placement: 'top',
	popperOptions: {
		modifiers: [
			{
				name: 'flip',
				options: {
					fallbackPlacements: ['bottom', 'top-start', 'bottom-start'],
					padding: 10,
				},
			},
			{
				name: 'preventOverflow',
				options: {
					boundary: scrollViewRef.value || 'clippingParents',
					altAxis: true,
					tether: true,
					padding: 10,
				},
			},
		],
	},
}))

const friendShareOptions = computed(() =>
	friendStore.friends.map((friend) => {
		const displayName = (friend.remark || friend.name || friend.id).trim()
		return {
			label: `${displayName} (${friend.id})`,
			value: friend.id,
		}
	}),
)

const CloudImage = Node.create({
	name: 'image',
	group: 'block',
	draggable: true,
	selectable: true,
	atom: true,
	addAttributes() {
		return {
			src: {
				default: null,
			},
			alt: {
				default: null,
			},
			title: {
				default: null,
			},
			width: {
				default: '100%',
				parseHTML: (element) => {
					if (!(element instanceof HTMLElement)) return '100%'
					return (
						element.getAttribute('data-width') ||
						element.style.width ||
						'100%'
					)
				},
			},
		}
	},
	parseHTML() {
		return [{ tag: 'img[src]' }]
	},
	renderHTML({ HTMLAttributes }) {
		const width = String(HTMLAttributes.width || '100%').trim() || '100%'
		return [
			'img',
			mergeAttributes(
				{
					class: 'cloud-doc-image',
					'data-width': width,
					style: `width: ${width}; height: auto;`,
				},
				HTMLAttributes,
			),
		]
	},
	addCommands() {
		return {
			setImage:
				(options: { src: string; alt?: string; title?: string }) =>
				({ commands }) => {
					return commands.insertContent({
						type: this.name,
						attrs: options,
					})
				},
		}
	},
})

const SlashImageExtension = Extension.create({
	name: 'slashImageUpload',
	addOptions() {
		return {
			slash: true,
			name: 'image',
			desc: '上传并插入图片',
			command: ({
				editor,
				range,
			}: {
				editor: CloudEditor
				range?: { from: number; to: number }
			}) => {
				if (range) {
					const deleteCommand = editor
						.chain()
						.focus()
						.deleteRange?.(range)
					deleteCommand?.run()
				}
				onInsertImage()
			},
		}
	},
})

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

addIcon('isle-editor:image', {
	body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2m0 0l5-6l3 3l2-2l4 5M9 10h.01"/>',
	width: 24,
	height: 24,
})

const parseUploadUrl = (payload: Record<string, unknown> | null): string => {
	if (!payload) return ''
	const url =
		(typeof payload.url === 'string' && payload.url) ||
		(typeof payload.fileUrl === 'string' && payload.fileUrl) ||
		(typeof payload.fullUrl === 'string' && payload.fullUrl) ||
		(typeof payload.uri === 'string' && payload.uri) ||
		(typeof payload.path === 'string' && payload.path) ||
		(typeof payload.data === 'object' &&
			payload.data &&
			typeof (payload.data as Record<string, unknown>).url === 'string' &&
			((payload.data as Record<string, unknown>).url as string)) ||
		(typeof payload.data === 'object' &&
			payload.data &&
			typeof (payload.data as Record<string, unknown>).fileUrl ===
				'string' &&
			((payload.data as Record<string, unknown>).fileUrl as string)) ||
		''
	return url.trim()
}

const uploadImageFile = async (file: File): Promise<string> => {
	const formData = new FormData()
	formData.append('file', file)
	const response = await request.post<ApiResponse<Record<string, unknown>>>(
		'/files/upload',
		formData,
		{
			headers: { 'Content-Type': 'multipart/form-data' },
		},
	)
	return parseUploadUrl(response.data.data || null)
}

const getShareBaseUrl = (): string => {
	const raw = String(request.defaults.baseURL || '').trim()
	if (!raw) return ''
	try {
		const parsed = new URL(raw)
		return `${parsed.protocol}//${parsed.host}`
	} catch {
		return ''
	}
}

const buildShareUrl = (sharePath: string): string => {
	const path = String(sharePath || '').trim()
	if (!path) return ''
	if (/^https?:\/\//i.test(path)) return path
	const baseUrl = getShareBaseUrl()
	if (!baseUrl) return path
	try {
		return new URL(path, baseUrl).toString()
	} catch {
		return path
	}
}

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

const buildCloudDocShareCardHtml = (payload: {
	shareNo: string
	docTitle: string
	shareUrl: string
}): string => {
	const safeShareNo = escapeHtml(payload.shareNo)
	const safeTitle = escapeHtml(payload.docTitle || '未标题云文档')
	const safeUrl = escapeHtml(payload.shareUrl)
	return `
<div class="chat-cloud-doc-share-card" data-share-no="${safeShareNo}" data-doc-title="${safeTitle}" data-share-url="${safeUrl}">
	<div><strong>云文档分享</strong></div>
	<div>文档：${safeTitle}</div>
	<div>点击打开云文档</div>
</div>`.trim()
}

const extensions = [
	NotionKit.configure({
		commandSlash: createSlashSuggestion(),
		uniqueID: {
			types: [
				'heading',
				'paragraph',
				'bulletList',
				'orderedList',
				'taskList',
			],
		},
		placeholder: {
			placeholder: "输入 '/' 调出命令菜单",
		},
	}),
	CloudImage,
	SlashImageExtension,
]

const saveLabel = computed(() => {
	if (props.saveState === 'saving') return '保存中...'
	if (props.saveState === 'saved') return '已自动保存'
	if (props.saveState === 'error') return props.saveErrorMessage || '保存失败'
	return '编辑中'
})

const saveTagType = computed(() => {
	if (props.saveState === 'saving') return 'warning' as const
	if (props.saveState === 'saved') return 'success' as const
	if (props.saveState === 'error') return 'error' as const
	return 'default' as const
})
const isReadonly = computed(() => props.doc.editable === false)

const ownerAvatarText = computed(() => {
	const source = String(
		userInfoStore.userName ||
			userInfoStore.account ||
			props.doc.title ||
			'U',
	).trim()
	return source.slice(0, 1).toUpperCase()
})

const resolveUserAvatarUrl = (avatarUrl?: string | null): string => {
	const raw = String(avatarUrl || '').trim()
	if (!raw) return resolveAvatarUrl('')
	if (/^(data:|blob:|file:)/i.test(raw)) return raw
	if (/^https?:\/\//i.test(raw)) return raw
	if (/^\/\//.test(raw)) return `https:${raw}`

	const baseUrl = String(request.defaults.baseURL || '').trim()
	if (!baseUrl) return resolveAvatarUrl(raw)

	try {
		return new URL(raw, baseUrl).toString()
	} catch {
		return resolveAvatarUrl(raw)
	}
}

const ownerAvatarSrc = computed(() =>
	resolveUserAvatarUrl(userInfoStore.avatarUrl),
)

const onTitleUpdate = (value: string): void => {
	if (isReadonly.value) return
	localTitle.value = value
	emit('update:title', value)
}

const onEditorUpdate = ({
	editor,
}: {
	editor: { getHTML: () => string; getJSON: () => unknown }
}): void => {
	if (isReadonly.value) return
	const contentHtml = editor.getHTML()
	const contentJson = JSON.stringify(editor.getJSON())
	if (contentHtml !== localContent.value) {
		localContent.value = contentHtml
	}
	emit('update:content', { contentHtml, contentJson })
	scheduleRefreshCollabCursors()
}

const onInsertImage = (): void => {
	if (isReadonly.value) return
	imageInputRef.value?.click()
}

const onImageFileChange = async (event: Event): Promise<void> => {
	if (isReadonly.value) return
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (!file) return
	try {
		if (!file.type.startsWith('image/')) {
			message.warning('只能上传图片格式')
			return
		}
		if (file.size > 10 * 1024 * 1024) {
			message.warning('图片不能超过 10MB')
			return
		}
		const src = await uploadImageFile(file)
		if (!src) {
			message.error('图片上传失败')
			return
		}
		const command = editorRef.value?.editor
			?.chain()
			.focus()
			.setImage?.({
				src,
				title: file.name || src,
				width: `${imageWidthPercent.value}%`,
			})
		const ok = command ? command.run() : false
		if (!ok) {
			message.warning('图片插入失败，请重试')
			return
		}
		message.success('图片已插入')
	} catch (error) {
		console.error('云文档图片上传失败', error)
		message.error('图片上传失败，请稍后重试')
	} finally {
		input.value = ''
	}
}

const parseWidthPercent = (value: unknown): number => {
	const raw = String(value || '100').trim()
	const n = Number(raw.replace('%', ''))
	if (!Number.isFinite(n)) return 100
	return Math.max(20, Math.min(100, Math.round(n)))
}

const updateImageSelectionState = (editor?: CloudEditor): void => {
	const target = editor || editorRef.value?.editor
	const node = target?.state?.selection?.node
	const active = node?.type?.name === 'image'
	imageSelected.value = !!active
	if (active) {
		imageWidthPercent.value = parseWidthPercent(node?.attrs?.width)
	}
}

const clearCursorSendTimer = (): void => {
	if (!cursorSendTimer) return
	clearTimeout(cursorSendTimer)
	cursorSendTimer = null
}

const clearCursorOverlayRefreshTimer = (): void => {
	if (!cursorOverlayRefreshTimer) return
	clearTimeout(cursorOverlayRefreshTimer)
	cursorOverlayRefreshTimer = null
}

const clampEditorPosition = (value: number, max: number): number => {
	if (!Number.isFinite(value)) return 0
	if (!Number.isFinite(max) || max < 0) return Math.max(0, Math.round(value))
	return Math.max(0, Math.min(Math.round(value), Math.round(max)))
}

const getEditorContentMaxPosition = (editor?: CloudEditor): number => {
	const size = Number(editor?.view?.state?.doc?.content?.size)
	return Number.isFinite(size) && size >= 0 ? size : Number.MAX_SAFE_INTEGER
}

const sendLocalCursor = (editor?: CloudEditor): void => {
	if (isReadonly.value) return
	const selection = editor?.state?.selection
	const anchorRaw = Number(selection?.anchor ?? selection?.from)
	const headRaw = Number(selection?.head ?? selection?.to)
	if (!Number.isFinite(anchorRaw) || !Number.isFinite(headRaw)) return
	const maxPos = getEditorContentMaxPosition(editor)
	const anchor = clampEditorPosition(anchorRaw, maxPos)
	const head = clampEditorPosition(headRaw, maxPos)
	const signature = `${props.doc.id}:${anchor}:${head}`
	if (signature === lastCursorSignature) return
	lastCursorSignature = signature
	clearCursorSendTimer()
	cursorSendTimer = setTimeout(() => {
		cloudDocWs.sendCursor({
			docId: props.doc.id,
			anchor,
			head,
		})
	}, CURSOR_SEND_DEBOUNCE_MS)
}

const parseCursorDisplayName = (cursor: CollabCursor): string => {
	const source = String(cursor.name || cursor.userId || '').trim()
	if (!source) return '协作中'
	return source.slice(0, 16)
}

const refreshCollabCursors = (): void => {
	const editor = editorRef.value?.editor
	const view = editor?.view
	const scrollView = scrollViewRef.value
	if (!editor || !view || !scrollView) {
		renderedCollabCursors.value = []
		return
	}
	const containerRect = scrollView.getBoundingClientRect()
	const maxPos = getEditorContentMaxPosition(editor)
	const selfId = String(userInfoStore.account || '').trim()
	const next: RenderedCollabCursor[] = []
	for (const cursor of props.collabCursors || []) {
		const userId = String(cursor.userId || '').trim()
		if (!userId) continue
		if (selfId && userId === selfId) continue
		const rawHead = Number(cursor.head ?? cursor.position ?? cursor.anchor)
		const head = clampEditorPosition(rawHead, maxPos)
		try {
			const coords = view.coordsAtPos(head)
			next.push({
				key: userId,
				name: parseCursorDisplayName(cursor),
				color: String(cursor.color || '#3b82f6').trim() || '#3b82f6',
				top: coords.top - containerRect.top + scrollView.scrollTop,
				left: coords.left - containerRect.left + scrollView.scrollLeft,
				height: Math.max(16, coords.bottom - coords.top),
			})
		} catch {
			continue
		}
	}
	renderedCollabCursors.value = next
}

const scheduleRefreshCollabCursors = (): void => {
	clearCursorOverlayRefreshTimer()
	cursorOverlayRefreshTimer = setTimeout(() => {
		refreshCollabCursors()
	}, 20)
}

const onEditorSelectionUpdate = ({ editor }: { editor: CloudEditor }): void => {
	updateImageSelectionState(editor)
	sendLocalCursor(editor)
	scheduleRefreshCollabCursors()
}

const onImageWidthChange = (value: number): void => {
	if (isReadonly.value) return
	imageWidthPercent.value = Math.max(20, Math.min(100, Math.round(value)))
	const ok = editorRef.value?.editor?.commands?.updateAttributes?.('image', {
		width: `${imageWidthPercent.value}%`,
	})
	if (ok === false) {
		message.warning('请先选中图片再调整缩放')
	}
}

const openShareDialog = async (): Promise<void> => {
	if (isReadonly.value) return
	shareFriendAccount.value = ''
	shareExpireHoursInput.value = '168'
	shareFriendsLoading.value = true
	try {
		await friendStore.fetchFriends()
	} finally {
		shareFriendsLoading.value = false
	}
	shareDialogVisible.value = true
}

const onShareDoc = async (): Promise<void> => {
	if (sharing.value) return
	if (!friendShareOptions.value.length) {
		message.warning('暂无好友可分享，请先添加好友')
		return
	}
	const friendAccount = shareFriendAccount.value.trim()
	if (!friendAccount) {
		message.warning('请先选择好友')
		return
	}
	const expireHours = Math.max(
		1,
		Number.parseInt(shareExpireHoursInput.value.trim(), 10) || 168,
	)
	sharing.value = true
	try {
		const response = await cloudDocApi.shareDoc(props.doc.id, {
			friendAccount,
			expireHours,
		})
		const result = response.data.data || {}
		const shareNo = String(result.shareNo || '').trim()
		const sharePath = String(result.sharePath || '').trim()
		const shareUrl = buildShareUrl(sharePath)
		const docTitle = String(props.doc.title || '未标题云文档').trim()
		if (shareNo) {
			const cardHtml = buildCloudDocShareCardHtml({
				shareNo,
				docTitle,
				shareUrl: shareUrl || sharePath,
			})
			await chatStore.sendMessageToAccount(
				friendAccount,
				cardHtml,
				'text',
			)
		}
		const copiedText = shareUrl || sharePath || shareNo
		if (!copiedText) {
			message.warning('分享结果为空，请检查后端返回')
			return
		}
		try {
			await navigator.clipboard.writeText(copiedText)
			message.success(
				shareNo
					? `已分享给 ${friendAccount}，分享标识 ${shareNo} 已复制`
					: `已分享给 ${friendAccount}，分享内容已复制`,
			)
		} catch {
			message.success(
				shareNo
					? `已分享给 ${friendAccount}，分享标识：${shareNo}`
					: `已分享给 ${friendAccount}`,
			)
		}
		shareDialogVisible.value = false
	} catch (error) {
		console.error('生成云文档分享链接失败', error)
		message.error('生成分享链接失败，请稍后重试')
	} finally {
		sharing.value = false
	}
}

watch(
	() => props.doc.id,
	() => {
		localTitle.value = props.doc.title
		localContent.value = props.doc.contentHtml || ''
		lastCursorSignature = ''
		renderedCollabCursors.value = []
		scheduleRefreshCollabCursors()
	},
)

watch(
	() => props.doc.title,
	(value) => {
		if (value !== localTitle.value) {
			localTitle.value = value
		}
	},
)

watch(
	() => props.doc.contentHtml,
	(value) => {
		const next = String(value || '')
		if (next === localContent.value) return
		localContent.value = next
		scheduleRefreshCollabCursors()
	},
)

watch(
	() => props.collabCursors,
	() => {
		scheduleRefreshCollabCursors()
	},
	{ deep: true },
)

onMounted(() => {
	window.addEventListener('resize', onWindowResize)
	scrollViewRef.value?.addEventListener(
		'scroll',
		scheduleRefreshCollabCursors,
		{
			passive: true,
		},
	)
	scheduleRefreshCollabCursors()
})

onBeforeUnmount(() => {
	clearCursorSendTimer()
	clearCursorOverlayRefreshTimer()
	window.removeEventListener('resize', onWindowResize)
	scrollViewRef.value?.removeEventListener(
		'scroll',
		scheduleRefreshCollabCursors,
	)
	editorRef.value?.editor?.destroy?.()
})
</script>

<template>
	<div class="editor-root">
		<div class="editor-toolbar-wrap">
			<div class="editor-title-row">
				<n-button
					quaternary
					size="small"
					class="sidebar-toggle-btn"
					:title="showToc ? '隐藏侧边栏' : '显示侧边栏'"
					@click="showToc = !showToc"
				>
					<n-icon size="16">
						<PanelLeftContract24Regular v-if="showToc" />
						<PanelLeft24Regular v-else />
					</n-icon>
				</n-button>
				<n-input
					:value="localTitle"
					placeholder="未标题云文档"
					class="editor-title-input"
					:disabled="isReadonly"
					@update:value="onTitleUpdate"
				/>
				<div
					class="editor-title-drag-region"
					title="拖动窗口区域"
					aria-hidden="true"
				/>
				<n-tag :type="saveTagType" size="small" round>
					{{ saveLabel }}
				</n-tag>
				<n-button
					v-if="!isReadonly"
					quaternary
					size="small"
					class="doc-share-btn"
					:loading="sharing"
					@click="openShareDialog"
				>
					<template #icon>
						<n-icon size="16">
							<Share24Regular />
						</n-icon>
					</template>
					分享
				</n-button>
				<n-avatar
					:src="ownerAvatarSrc"
					round
					size="small"
					class="doc-owner-avatar"
				>
					{{ ownerAvatarText }}
				</n-avatar>
			</div>
			<IsleEditorToolbar
				v-if="editorRef?.editor && !isReadonly"
				:editor="editorRef.editor"
			>
				<template #suffix>
					<n-button
						quaternary
						size="small"
						class="toolbar-image-btn"
						title="插入图片"
						@click="onInsertImage"
					>
						<n-icon size="16">
							<Image24Regular />
						</n-icon>
					</n-button>
				</template>
			</IsleEditorToolbar>
			<div v-if="imageSelected && !isReadonly" class="image-resize-panel">
				<span class="image-resize-label">图片宽度</span>
				<n-slider
					:min="20"
					:max="100"
					:step="1"
					:value="imageWidthPercent"
					@update:value="onImageWidthChange"
				/>
				<span class="image-resize-value">{{ imageWidthPercent }}%</span>
			</div>
		</div>

		<div class="editor-body">
			<aside
				class="editor-outline"
				:class="{ 'editor-outline-hidden': !showToc }"
			>
				<IsleEditorToc
					v-if="showToc && editorRef?.editor"
					:editor="editorRef.editor"
					:scroll-view="scrollViewRef"
				/>
			</aside>

			<div ref="scrollViewRef" class="editor-canvas">
				<div class="collab-cursor-layer" aria-hidden="true">
					<div
						v-for="cursor in renderedCollabCursors"
						:key="cursor.key"
						class="collab-cursor"
						:style="{
							top: `${cursor.top}px`,
							left: `${cursor.left}px`,
							height: `${cursor.height}px`,
							color: cursor.color,
						}"
					>
						<span
							class="collab-cursor-caret"
							:style="{ backgroundColor: cursor.color }"
						/>
						<span
							class="collab-cursor-label"
							:style="{ backgroundColor: cursor.color }"
						>
							{{ cursor.name }}
						</span>
					</div>
				</div>
				<div class="editor-inner">
					<IsleEditorBubble
						v-if="editorRef?.editor"
						:editor="editorRef.editor"
						:tippy-options="bubbleTippyOptions"
					/>
					<IsleEditor
						:key="props.doc.id"
						ref="editorRef"
						v-model="localContent"
						:extensions="extensions"
						:editable="!isReadonly"
						locale="zh"
						theme="light"
						output="html"
						@update="onEditorUpdate"
						@selection-update="onEditorSelectionUpdate"
					/>
				</div>
			</div>
		</div>

		<input
			ref="imageInputRef"
			class="hidden"
			type="file"
			accept="image/*"
			@change="onImageFileChange"
		/>

		<n-modal
			v-model:show="shareDialogVisible"
			preset="card"
			title="分享云文档"
			style="width: 420px"
		>
			<div class="share-dialog-body">
				<n-select
					v-model:value="shareFriendAccount"
					:options="friendShareOptions"
					:loading="shareFriendsLoading"
					filterable
					clearable
					placeholder="请选择好友"
				/>
				<n-input
					v-model:value="shareExpireHoursInput"
					placeholder="有效期小时数（默认 168）"
				/>
			</div>
			<template #footer>
				<div class="share-dialog-footer">
					<n-button @click="shareDialogVisible = false"
						>取消</n-button
					>
					<n-button
						type="primary"
						:loading="sharing"
						@click="onShareDoc"
					>
						确认分享
					</n-button>
				</div>
			</template>
		</n-modal>
	</div>
</template>

<style scoped>
.editor-root {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: #ffffff;
}

.editor-toolbar-wrap {
	z-index: 10;
	background: #ffffff;
	border-bottom: 1px solid #f2f2f2;
	-webkit-app-region: no-drag;
}

.editor-title-row {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 14px;
}

.editor-title-input {
	flex: 0 1 520px;
	min-width: 90px;
	max-width: 100%;
}

.editor-title-drag-region {
	flex: 1 1 auto;
	min-width: 48px;
	height: 26px;
	-webkit-app-region: drag;
}

.sidebar-toggle-btn {
	padding: 0 8px;
}

.doc-owner-avatar {
	flex-shrink: 0;
	background: linear-gradient(135deg, #3695ff 0%, #2f7fe7 100%);
	color: #ffffff;
	font-weight: 600;
}

.doc-share-btn {
	padding: 0 10px;
}

.share-dialog-body {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.share-dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

.editor-body {
	flex: 1;
	min-height: 0;
	display: flex;
}

.editor-outline {
	width: 260px;
	flex-shrink: 0;
	border-right: 1px solid #f2f2f2;
	padding: 12px 10px;
	overflow: auto;
	transition:
		width 0.2s ease,
		padding 0.2s ease,
		border-color 0.2s ease;
}

.editor-outline-hidden {
	width: 0;
	padding-left: 0;
	padding-right: 0;
	border-right-color: transparent;
	overflow: hidden;
}

.editor-canvas {
	flex: 1;
	min-height: 0;
	overflow: auto;
	position: relative;
	padding: 14px;
	-webkit-app-region: no-drag;
}

.collab-cursor-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 20;
}

.collab-cursor {
	position: absolute;
	transform: translateX(-1px);
}

.collab-cursor-caret {
	display: block;
	width: 2px;
	height: 100%;
	border-radius: 1px;
	opacity: 0.96;
}

.collab-cursor-label {
	position: absolute;
	top: -20px;
	left: 0;
	display: inline-flex;
	align-items: center;
	height: 16px;
	padding: 0 6px;
	border-radius: 8px;
	color: #ffffff;
	font-size: 10px;
	font-weight: 600;
	line-height: 16px;
	white-space: nowrap;
}

.editor-inner {
	width: min(100%, 1200px);
	min-height: 100%;
	margin: 0 auto;
}

.editor-inner :deep(.isle-editor-toolbar-menu) {
	border-radius: 8px;
	margin-bottom: 10px;
}

.editor-inner :deep(.cloud-doc-image) {
	display: block;
	max-width: min(100%, 860px);
	height: auto;
	margin: 10px 0;
	border-radius: 8px;
	transition:
		box-shadow 0.16s ease,
		outline-color 0.16s ease;
	outline: 2px solid transparent;
	outline-offset: 2px;
}

.editor-inner :deep(.cloud-doc-image.ProseMirror-selectednode) {
	outline-color: #3695ff;
	box-shadow: 0 0 0 4px rgba(54, 149, 255, 0.2);
}

.image-resize-panel {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 14px 10px;
	border-top: 1px solid #f5f5f5;
}

.image-resize-label {
	flex-shrink: 0;
	color: #5a5a5a;
	font-size: 12px;
}

.image-resize-value {
	width: 42px;
	text-align: right;
	color: #404040;
	font-size: 12px;
}

.toolbar-image-btn {
	padding: 0 8px;
}

@media (max-width: 768px) {
	.editor-title-row {
		padding: 8px 10px;
	}

	.editor-title-drag-region {
		display: none;
	}

	.editor-outline {
		display: none;
	}

	.editor-canvas {
		padding: 8px;
	}
}
</style>

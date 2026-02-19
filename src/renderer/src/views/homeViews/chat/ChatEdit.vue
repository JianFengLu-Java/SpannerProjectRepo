<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import {
	ImageOutline,
	At,
	HappyOutline,
	WalletOutline,
} from '@vicons/ionicons5'
import { useMessage, NPopover, NIcon, NModal } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
import { useWalletStore } from '@renderer/stores/wallet'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { storeToRefs } from 'pinia'
import request from '@renderer/utils/request'
import StarterKit from '@tiptap/starter-kit'
import {
	FontDecrease24Regular,
	TextBold24Filled,
	TextItalic24Filled,
	TextUnderline24Filled,
	TextStrikethrough24Filled,
	Code24Filled,
	Link24Filled,
	TextClearFormatting24Filled,
	Dismiss24Regular,
	ShieldCheckmark24Regular,
	ArrowCircleUp24Regular,
} from '@vicons/fluent'
import type { Editor } from '@tiptap/core'
import EmojiPicker from '@renderer/components/EmojiPicker.vue'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

// 接收 currentId 确保闭环
const props = defineProps<{
	currentId: number | string
}>()

const chatStore = useChatStore()
const walletStore = useWalletStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()
const { activeChat } = storeToRefs(chatStore)
const {
	walletNo,
	walletStatus,
	securityPasswordSet,
	balanceCents,
	formattedBalance,
	currency,
} = storeToRefs(walletStore)

// 响应式状态
const isMultiline = ref(false)
const isFocus = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const linkUrl = ref('')
const showLinkInput = ref(false)
let resizeObserver: ResizeObserver | null = null
const canSend = ref(false)
const showEmoji = ref(false)
const showTransferModal = ref(false)
const transferAmount = ref<number | null>(null)
const transferRemark = ref('')
const transferSecurityPassword = ref('')
const transferLoading = ref(false)
const pinInputs = ref<string[]>(['', '', '', '', '', ''])
const pinRefs = ref<Array<HTMLInputElement | null>>([])
const isLoadingMentionMembers = ref(false)
const mentionMembersGroupNo = ref('')
const showMentionPicker = ref(false)
const mentionQuery = ref('')
const mentionActiveIndex = ref(0)
const mentionRange = ref<{ from: number; to: number } | null>(null)
const mentionMembers = ref<Array<{ account: string; name: string }>>([])

const handlePinInput = (index: number, e: Event): void => {
	const val = (e.target as HTMLInputElement).value
	if (!/^\d?$/.test(val)) {
		pinInputs.value[index] = ''
		return
	}
	pinInputs.value[index] = val
	transferSecurityPassword.value = pinInputs.value.join('')

	if (val && index < 5) {
		pinRefs.value[index + 1]?.focus()
	}
}

const handlePinKeyDown = (index: number, e: KeyboardEvent): void => {
	if (e.key === 'Backspace' && !pinInputs.value[index] && index > 0) {
		pinRefs.value[index - 1]?.focus()
	}
}

const handlePinPaste = (e: ClipboardEvent): void => {
	e.preventDefault()
	const data = e.clipboardData?.getData('text') || ''
	const digits = data.replace(/\D/g, '').split('').slice(0, 6)
	digits.forEach((digit, i) => {
		pinInputs.value[i] = digit
	})
	transferSecurityPassword.value = pinInputs.value.join('')
	const nextIdx = Math.min(digits.length, 5)
	pinRefs.value[nextIdx]?.focus()
}

// 添加边界元素引用
const boundaryElement = ref<HTMLElement | null>(null)

// 计算属性：规范化 ID
const normalizedId = computed(() => {
	if (typeof props.currentId === 'string') {
		return parseInt(props.currentId) || Number(props.currentId)
	}
	return props.currentId
})
const isGroupChat = computed(() => activeChat.value?.chatType === 'GROUP')
const activeGroupNo = computed(() => activeChat.value?.groupNo?.trim() || '')
const normalizedSelfAccount = computed(() =>
	(userInfoStore.account || '').trim().toLowerCase(),
)
const filteredMentionMembers = computed(() => {
	const list = mentionMembers.value
	const keyword = mentionQuery.value.trim().toLowerCase()
	if (!keyword) return list.slice(0, 20)
	return list
		.filter((item) => {
			const account = item.account.toLowerCase()
			const name = (item.name || '').toLowerCase()
			return account.includes(keyword) || name.includes(keyword)
		})
		.slice(0, 20)
})

const closeMentionPicker = (): void => {
	showMentionPicker.value = false
	mentionQuery.value = ''
	mentionActiveIndex.value = 0
	mentionRange.value = null
}

const loadMentionMembers = async (force = false): Promise<void> => {
	const groupNo = activeGroupNo.value
	if (!isGroupChat.value || !groupNo) {
		mentionMembers.value = []
		mentionMembersGroupNo.value = ''
		closeMentionPicker()
		return
	}
	if (
		!force &&
		mentionMembersGroupNo.value === groupNo &&
		mentionMembers.value.length
	) {
		return
	}
	if (isLoadingMentionMembers.value) return
	isLoadingMentionMembers.value = true
	try {
		const members = await chatStore.getGroupMembers(groupNo)
		const selfAccount = normalizedSelfAccount.value
		mentionMembers.value = members
			.filter((item) => {
				const account = (item.account || '').trim().toLowerCase()
				if (!account) return false
				return !selfAccount || account !== selfAccount
			})
			.map((item) => ({
				account: item.account,
				name: item.name?.trim() || item.account,
			}))
		mentionMembersGroupNo.value = groupNo
	} catch (error) {
		console.warn('加载群成员失败:', error)
		mentionMembers.value = []
	} finally {
		isLoadingMentionMembers.value = false
	}
}

const detectMentionTrigger = (instance: Editor): void => {
	if (!isGroupChat.value) {
		closeMentionPicker()
		return
	}
	const { from, empty } = instance.state.selection
	if (!empty) {
		closeMentionPicker()
		return
	}
	const textBefore = instance.state.doc.textBetween(
		Math.max(0, from - 80),
		from,
		'\n',
		'\n',
	)
	const matched = textBefore.match(/(?:^|\s)@([^\s@]*)$/)
	if (!matched) {
		closeMentionPicker()
		return
	}
	const atIndex = textBefore.lastIndexOf('@')
	if (atIndex < 0) {
		closeMentionPicker()
		return
	}
	const query = matched[1] || ''
	mentionQuery.value = query
	mentionRange.value = {
		from: from - (textBefore.length - atIndex),
		to: from,
	}
	mentionActiveIndex.value = 0
	showMentionPicker.value = true
}

const applyMentionMember = (member: {
	account: string
	name: string
}): void => {
	if (!editor.value || !mentionRange.value) return
	const displayName = (member.name || member.account).trim() || member.account
	editor.value
		.chain()
		.focus()
		.deleteRange(mentionRange.value)
		.insertContent(`@${displayName} `)
		.run()
	closeMentionPicker()
}

const selectMentionByIndex = (index: number): void => {
	const item = filteredMentionMembers.value[index]
	if (!item) return
	applyMentionMember(item)
}

const handleMentionButtonClick = async (): Promise<void> => {
	if (!isGroupChat.value) {
		message.warning('仅群聊支持 @ 提及')
		return
	}
	if (!mentionMembers.value.length) {
		await loadMentionMembers(true)
	}
	if (!editor.value) return
	editor.value.chain().focus().insertContent('@').run()
	detectMentionTrigger(editor.value)
}

const bubbleMenuTippyOptions = computed(() => {
	const getBoundary = (): HTMLElement | null => {
		if (boundaryElement.value) return boundaryElement.value
		if (typeof document !== 'undefined') {
			const element = document.querySelector(
				'.chat-context-root',
			) as HTMLElement
			if (element) {
				boundaryElement.value = element
				return element
			}
		}
		return null
	}

	const boundary = getBoundary()

	return {
		appendTo: () => boundary || document.body,
		placement: 'top',
		interactive: true,
		animation: 'shift-away',
		duration: [200, 150],
		popperOptions: {
			strategy: 'fixed',
			modifiers: [
				{
					name: 'offset',
					options: {
						offset: [0, 10],
					},
				},
				{
					name: 'preventOverflow',
					options: {
						boundary: boundary || 'viewport',
						padding: 12,
					},
				},
				{
					name: 'flip',
					options: {
						boundary: boundary || 'viewport',
						padding: 12,
						fallbackPlacements: ['bottom', 'top'],
					},
				},
			],
		},
	}
})
// 同步草稿函数
const syncDraft = (): void => {
	if (normalizedId.value && editor.value) {
		const content = editor.value.getJSON()
		if (!editor.value.isEmpty) {
			chatStore.saveDraft(normalizedId.value as number, content)
		} else {
			chatStore.saveDraft(normalizedId.value as number, null)
		}
	}
}

// 链接功能
const setLink = (): void => {
	if (!editor.value) return

	const previousUrl = editor.value.getAttributes('link').href
	linkUrl.value = previousUrl || ''
	showLinkInput.value = true

	nextTick(() => {
		const input = document.querySelector<HTMLInputElement>('.link-input')
		if (input) {
			input.focus()
			input.select()
		}
	})
}

const confirmLink = (): void => {
	if (!editor.value) return

	if (linkUrl.value) {
		editor.value
			.chain()
			.focus()
			.extendMarkRange('link')
			.setLink({ href: linkUrl.value })
			.run()
	} else {
		editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
	}

	showLinkInput.value = false
	linkUrl.value = ''
}

const cancelLink = (): void => {
	showLinkInput.value = false
	linkUrl.value = ''
	editor.value?.chain().focus().run()
}

// 初始化编辑器
const editor = useEditor({
	content: normalizedId.value
		? chatStore.getDraft(normalizedId.value as number)
		: '',
	extensions: [
		StarterKit.configure({
			// history: true,
		}).extend({
			addKeyboardShortcuts() {
				return {
					Enter: () => {
						if (showMentionPicker.value) {
							selectMentionByIndex(mentionActiveIndex.value)
							return true
						}
						if (showLinkInput.value) {
							confirmLink()
							return true
						}
						handleSendMessage()
						return true
					},
					Escape: () => {
						if (showMentionPicker.value) {
							closeMentionPicker()
							return true
						}
						if (showLinkInput.value) {
							cancelLink()
							return true
						}
						return false
					},
					ArrowDown: () => {
						if (!showMentionPicker.value) return false
						const size = filteredMentionMembers.value.length
						if (!size) return true
						mentionActiveIndex.value = (mentionActiveIndex.value + 1) % size
						return true
					},
					ArrowUp: () => {
						if (!showMentionPicker.value) return false
						const size = filteredMentionMembers.value.length
						if (!size) return true
						mentionActiveIndex.value =
							(mentionActiveIndex.value - 1 + size) % size
						return true
					},
					'Shift-Enter': () => this.editor.commands.splitBlock(),
					// 添加常用快捷键
					'Mod-b': () =>
						this.editor.chain().focus().toggleBold().run(),
					'Mod-i': () =>
						this.editor.chain().focus().toggleItalic().run(),
					'Mod-u': () =>
						this.editor.chain().focus().toggleUnderline().run(),
					'Mod-k': () => {
						setLink()
						return true
					},
				}
			},
		}),
		BubbleMenuExtension.configure({
			pluginKey: 'bubbleMenu',
		}),
		Link.configure({
			openOnClick: false,
			HTMLAttributes: {
				class: 'text-blue-500 underline cursor-pointer hover:text-blue-700',
			},
		}),
		Image.configure({
			inline: true,
			HTMLAttributes: {
				class: 'max-w-[180px] rounded-lg border border-border-main my-1',
			},
		}),
	],
	editorProps: {
		attributes: {
			class: 'focus:outline-none py-1 leading-6 text-text-main break-all w-full min-h-[36px]',
		},
		handlePaste: (_view, event) => {
			const items = event.clipboardData?.items
			if (!items) return false
			let hasImage = false
			for (const item of items) {
				if (item.type.startsWith('image')) {
					const file = item.getAsFile()
					if (file) {
						insertImageFile(file)
						hasImage = true
					}
				}
			}
			return hasImage
		},
		handleDrop: (_view, event, _slice, moved) => {
			if (!moved && event.dataTransfer?.files?.length) {
				const file = event.dataTransfer.files[0]
				if (file.type.startsWith('image')) {
					insertImageFile(file)
					return true
				}
			}
			return false
		},
	},
	onFocus: () => {
		isFocus.value = true
	},
	onBlur: () => {
		isFocus.value = false
		closeMentionPicker()
		syncDraft()
	},
	onUpdate: ({ editor }) => {
		const isTextEmpty = editor.getText().trim().length === 0
		const hasImage = editor.getHTML().includes('<img')

		canSend.value = !isTextEmpty || hasImage
		detectMentionTrigger(editor)
		checkLayoutWithImages()
		editor.commands.scrollIntoView()
	},
})

const handleInsertMentionEvent = (event: Event): void => {
	const custom = event as CustomEvent<{
		chatId?: number
		account?: string
		name?: string
	}>
	const detail = custom.detail || {}
	if (!editor.value || !normalizedId.value) return
	if (Number(detail.chatId) !== Number(normalizedId.value)) return
	const name = (detail.name || detail.account || '').trim()
	if (!name) return
	editor.value.chain().focus().insertContent(`@${name} `).run()
}

// BubbleMenu 显示条件
const shouldShowBubbleMenu = ({ editor }: { editor: Editor }): boolean => {
	if (!editor) return false
	const { selection } = editor.state

	// 不显示的情况
	if (
		selection.empty || // 没有选择文本
		editor.isActive('image') || // 选择了图片
		editor.isActive('codeBlock') // 选择了代码块
	) {
		return false
	}

	// 额外的边界检查：确保选区在边界元素内
	const boundary =
		boundaryElement.value || document.querySelector('.chat-context-root')
	if (boundary) {
		const boundaryRect = boundary.getBoundingClientRect()
		const { from, to } = selection
		const startCoords = editor.view.coordsAtPos(from)
		const endCoords = editor.view.coordsAtPos(to)

		// 计算选区的中间点
		const middleTop = (startCoords.top + endCoords.top) / 2
		const middleBottom = (startCoords.bottom + endCoords.bottom) / 2

		// 检查选区中间点是否在边界元素内
		const isInBoundary =
			middleTop >= boundaryRect.top && middleBottom <= boundaryRect.bottom

		if (!isInBoundary) {
			return false
		}
	}

	return true
}

const onSelectEmoji = (emoji: { i: string }): void => {
	if (editor.value) {
		editor.value.chain().focus().insertContent(emoji.i).run()
	}
	showEmoji.value = false
}

// 处理自定义表情/贴纸选择
const onSelectCustomEmoji = (item: {
	url: string
	name: string
	type: string
}): void => {
	if (!editor.value) return

	if (item.type === 'sticker') {
		// 贴纸直接作为大图插入并发送 (或者你可以选择只插入到编辑器)
		insertImageSrc(item.url)
	} else {
		// 普通自定义表情图插入到编辑器
		editor.value.chain().focus().setImage({ src: item.url }).run()
	}
	showEmoji.value = false
}

const focusEditor = (): void => {
	editor.value?.chain().focus().run()
}

const insertImageSrc = (src: string): void => {
	if (!editor.value) return
	editor.value.chain().focus().setImage({ src }).insertContent(' ').run()
	scrollToBottom()
}

// 业务逻辑函数
const handleSendMessage = (): void => {
	if (!editor.value || editor.value.isEmpty) return

	const plainText = editor.value.getText().trim()
	const hasImage = editor.value.getHTML().includes('<img')

	if (plainText.length === 0 && !hasImage) {
		message.warning('不能发送空白内容')
		return
	}

	const htmlContent = editor.value.getHTML()
	chatStore.sendMessage(htmlContent)
	closeMentionPicker()

	// 发送成功后清空编辑器
	editor.value.commands.clearContent()

	// 清除草稿
	if (normalizedId.value) {
		chatStore.saveDraft(normalizedId.value, null)
	}
}

watch(
	() => [isGroupChat.value, activeGroupNo.value],
	([groupMode]) => {
		if (!groupMode) {
			mentionMembers.value = []
			mentionMembersGroupNo.value = ''
			closeMentionPicker()
			return
		}
		void loadMentionMembers()
	},
	{ immediate: true },
)

const parseInputAmountToCents = (value: number | null): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null
	if (value <= 0) return null
	const normalized = value.toFixed(2)
	const [integerPart, fractionPart = '00'] = normalized.split('.')
	const cents = Number(integerPart) * 100 + Number(fractionPart)
	return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

const canTransfer = computed(
	() => Boolean(walletNo.value) && walletStatus.value !== 'FROZEN',
)

const openTransferModal = async (): Promise<void> => {
	if (!normalizedId.value) {
		message.warning('请先选择聊天对象')
		return
	}
	try {
		await walletStore.fetchWallet(true)
		transferSecurityPassword.value = ''
		pinInputs.value = ['', '', '', '', '', '']
		showTransferModal.value = true
		nextTick(() => {
			pinRefs.value[0]?.focus()
		})
	} catch {
		message.error('钱包信息加载失败，请稍后重试')
	}
}

const submitTransfer = async (): Promise<void> => {
	if (transferLoading.value) return
	if (!canTransfer.value) {
		message.warning('钱包不可交易，请先检查账户状态')
		return
	}
	const amountCents = parseInputAmountToCents(transferAmount.value)
	if (!amountCents) {
		message.warning('请输入大于 0 的转账金额，最多两位小数')
		return
	}
	if (amountCents > Math.max(balanceCents.value, 0)) {
		message.warning('余额不足，无法转账')
		return
	}
	const pin = transferSecurityPassword.value.trim()
	if (!securityPasswordSet.value) {
		message.warning('尚未设置钱包安全PIN，请先到钱包页面设置')
		return
	}
	if (!/^\d{6}$/.test(pin)) {
		message.warning('请输入6位数字安全PIN')
		return
	}

	const remark = transferRemark.value.trim()
	const target = String(normalizedId.value)
	transferLoading.value = true
	try {
		const transferResult = await walletStore.transfer({
			toAccount: target,
			amountCents,
			remark: remark || `chat transfer to ${target}`,
			securityPassword: pin,
		})
		const amountText = walletStore.formatAmount(amountCents, currency.value)
		const businessNo =
			typeof transferResult.businessNo === 'string'
				? transferResult.businessNo.trim()
				: ''
		if (businessNo) {
			const messageHtml = `
<div class="chat-transfer-card" data-business-no="${escapeHtml(businessNo)}">
	<div><strong>转账</strong></div>
	<div>金额：${escapeHtml(amountText)}</div>
	${remark ? `<div>备注：${escapeHtml(remark)}</div>` : ''}
</div>`.trim()
			chatStore.sendMessage(messageHtml, 'transfer')
		} else {
			message.warning(
				'转账已创建，但未返回业务号，暂无法在聊天中展示收款卡片',
			)
		}
		transferAmount.value = null
		transferRemark.value = ''
		transferSecurityPassword.value = ''
		showTransferModal.value = false
		message.success('转账申请已创建')
	} catch (error) {
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(maybeResponse?.data?.message || '转账失败，请稍后重试')
	} finally {
		transferLoading.value = false
	}
}

const parseUploadUrl = (payload: Record<string, unknown> | null): string => {
	if (!payload) return ''
	const url =
		(typeof payload.url === 'string' && payload.url) ||
		(typeof payload.fileUrl === 'string' && payload.fileUrl) ||
		(typeof payload.path === 'string' && payload.path) ||
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
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		},
	)
	return parseUploadUrl(response.data.data || null)
}

const insertImageFile = async (file: File): Promise<void> => {
	if (!file) return
	if (!file.type.startsWith('image/')) {
		message.warning('只能上传图片格式')
		return
	}
	if (file.size > 10 * 1024 * 1024) {
		message.warning('图片不能超过 10MB')
		return
	}

	try {
		const imageUrl = await uploadImageFile(file)
		if (!imageUrl) {
			throw new Error('upload-url-empty')
		}
		if (!editor.value) return
		editor.value
			.chain()
			.focus()
			.setImage({ src: imageUrl })
			.insertContent(' ')
			.run()
		scrollToBottom()
	} catch (error) {
		console.error('聊天图片上传失败', error)
		message.error('图片上传失败，请稍后重试')
	}
}

const scrollToBottom = (): void => {
	nextTick(() => {
		const element = containerRef.value?.querySelector('.tiptap-editor')
		if (element) element.scrollTop = element.scrollHeight
	})
}

const checkLayoutWithImages = (): void => {
	nextTick(() => {
		checkLayout()
		const imgs = containerRef.value?.querySelectorAll('img')
		imgs?.forEach((img) => {
			if (!img.complete) img.onload = checkLayout
		})
	})
}

const checkLayout = (): void => {
	if (!containerRef.value || !actionsRef.value) return

	actionsRef.value.style.width = 'auto'
	actionsRef.value.style.flex = 'none'

	const containerRect = containerRef.value.getBoundingClientRect()
	const actionsRect = actionsRef.value.getBoundingClientRect()

	isMultiline.value = actionsRect.top - containerRect.top > 10

	actionsRef.value.style.removeProperty('width')
	actionsRef.value.style.removeProperty('flex')
}

onMounted(() => {
	resizeObserver = new ResizeObserver(() =>
		requestAnimationFrame(checkLayout),
	)

	if (containerRef.value) {
		resizeObserver.observe(containerRef.value)
	}

	// 延迟聚焦
	setTimeout(() => {
		editor.value?.commands.focus()
	}, 100)

	// 获取边界元素
	nextTick(() => {
		const element = document.querySelector('.chat-context-root')
		if (element) {
			boundaryElement.value = element as HTMLElement
		}
	})

	checkLayout()
	window.addEventListener('chat-insert-mention', handleInsertMentionEvent)
})

onUnmounted(() => {
	syncDraft()
	resizeObserver?.disconnect()
	editor.value?.destroy()
	window.removeEventListener('chat-insert-mention', handleInsertMentionEvent)
})
</script>

<template>
	<div class="relative">
		<div class="w-full rounded-2xl border h-fit bg-sidebar-select-bg transition-all duration-200 p-1.5 composer-shell"
			:class="[
				isFocus
					? 'border-border-default ring-2 ring-border-main'
					: 'border-border-main',
			]">
			<div ref="containerRef" class="flex flex-wrap items-end relative">
				<!-- 链接输入框 -->
				<div v-if="showLinkInput"
					class="absolute bottom-full left-0 right-0 mb-2 p-2 bg-page-bg border border-border-main rounded-lg z-50">
					<div class="flex items-center gap-2">
						<input v-model="linkUrl" type="url" placeholder="输入链接地址"
							class="link-input flex-1 px-3 py-1.5 text-sm border border-border-main rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							@keyup.enter="confirmLink" @keyup.escape="cancelLink" />
						<n-button size="small" type="primary" @click="confirmLink">
							确认
						</n-button>
						<n-button size="small" @click="cancelLink">
							取消
						</n-button>
					</div>
				</div>
				<div
					v-if="showMentionPicker"
					class="absolute bottom-full left-0 right-0 mb-2 px-1 z-50"
				>
					<div class="rounded-xl border border-border-main bg-page-bg shadow-lg max-h-56 overflow-y-auto">
						<div
							v-if="isLoadingMentionMembers"
							class="px-3 py-2 text-xs text-gray-400"
						>
							正在加载群成员...
						</div>
						<div
							v-else-if="!filteredMentionMembers.length"
							class="px-3 py-2 text-xs text-gray-400"
						>
							未找到匹配成员
						</div>
						<button
							v-for="(member, index) in filteredMentionMembers"
							:key="member.account"
							type="button"
							class="w-full text-left px-3 py-2 text-sm transition-colors"
							:class="
								index === mentionActiveIndex
									? 'bg-blue-50 text-blue-700 dark:bg-sky-500/15 dark:text-sky-300'
									: 'text-text-main hover:bg-black/5 dark:hover:bg-white/5'
							"
							@mousedown.prevent="applyMentionMember(member)"
							@mouseenter="mentionActiveIndex = index"
						>
							<span class="font-medium">{{ member.name }}</span>
							<span class="ml-2 text-xs text-gray-400">{{ member.account }}</span>
						</button>
					</div>
				</div>

				<div class="flex-1 min-w-[120px] px-1 min-h-9 cursor-text flex items-start" @click="focusEditor">
					<!-- BubbleMenu -->
					<BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShowBubbleMenu"
						:tippy-options="bubbleMenuTippyOptions">
						<div
							class="flex items-center bg-white/80 dark:bg-zinc-800/85 backdrop-blur-md border border-gray-200/80 dark:border-zinc-700 rounded-xl p-1.5 gap-1 animate-bubble-in">
							<button type="button" title="加粗 (Ctrl+B)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('bold'),
								}" @click="
									editor.chain().focus().toggleBold().run()
									">
								<n-icon size="18">
									<TextBold24Filled />
								</n-icon>
							</button>

							<button type="button" title="斜体 (Ctrl+I)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('italic'),
								}" @click="
									editor.chain().focus().toggleItalic().run()
									">
								<n-icon size="18">
									<TextItalic24Filled />
								</n-icon>
							</button>

							<button type="button" title="下划线 (Ctrl+U)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('underline'),
								}" @click="
									editor
										.chain()
										.focus()
										.toggleUnderline()
										.run()
									">
								<n-icon size="18">
									<TextUnderline24Filled />
								</n-icon>
							</button>

							<button type="button" title="删除线"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('strike'),
								}" @click="
									editor.chain().focus().toggleStrike().run()
									">
								<n-icon size="18">
									<TextStrikethrough24Filled />
								</n-icon>
							</button>

							<div class="w-[1.5px] h-4 bg-gray-200/60 dark:bg-zinc-700 mx-1"></div>

							<button type="button" title="代码"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('code'),
								}" @click="
									editor.chain().focus().toggleCode().run()
									">
								<n-icon size="18">
									<Code24Filled />
								</n-icon>
							</button>

							<button type="button" title="链接 (Ctrl+K)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95"
								:class="{
									'text-blue-600 bg-blue-100/50':
										editor.isActive('link'),
								}" @click="setLink">
								<n-icon size="18">
									<Link24Filled />
								</n-icon>
							</button>

							<button type="button" title="清除格式"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-red-50 hover:text-red-500 active:scale-95"
								@click="
									editor.chain().focus().unsetAllMarks().run()
									">
								<n-icon size="18">
									<TextClearFormatting24Filled />
								</n-icon>
							</button>
						</div>
					</BubbleMenu>

					<editor-content :editor="editor"
						class="tiptap-editor w-full max-h-64 overflow-y-auto overflow-x-hidden" @click="focusEditor" />
				</div>

				<div ref="actionsRef" class="flex items-center gap-1 shrink-0 h-fit transition-all duration-200"
					:class="[isMultiline ? 'w-full justify-end mt-2' : 'mt-0']">
					<div class="composer-toolbar">
						<button type="button" title="插入图片" class="composer-action-btn" @click="fileInput?.click()">
							<n-icon size="18">
								<ImageOutline />
							</n-icon>
							<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="
								(e: any) =>
									insertImageFile(e.target.files[0])
							" />
						</button>

						<button
							type="button"
							class="composer-action-btn"
							title="@提及"
							@click="handleMentionButtonClick"
						>
							<n-icon size="18">
								<At />
							</n-icon>
						</button>
						<div class="composer-action-btn">
							<n-popover v-model:show="showEmoji" trigger="click" placement="top" :show-arrow="false"
								style="padding: 0">
								<template #trigger>
									<n-icon title="表情" size="18">
										<HappyOutline />
									</n-icon>
								</template>
								<EmojiPicker @select="onSelectEmoji" @select-custom="onSelectCustomEmoji" />
							</n-popover>
						</div>
						<button type="button" class="composer-action-btn" title="字体大小">
							<n-icon size="18">
								<FontDecrease24Regular />
							</n-icon>
						</button>
						<button type="button" class="composer-action-btn" title="聊天转账" @click="openTransferModal">
							<n-icon size="18">
								<WalletOutline />
							</n-icon>
						</button>

						<button type="button" :disabled="!canSend" class="composer-send-btn" @click="handleSendMessage">
							<n-icon size="16">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
									stroke="currentColor" class="w-4 h-4">
									<path stroke-linecap="round" stroke-linejoin="round"
										d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
								</svg>
							</n-icon>
							<span>发送</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="w-full flex justify-end h-2.5">
			<div v-if="!editor?.isEmpty" class="px-2 text-[10px] text-gray-400 select-none">
				Shift + Enter 换行
			</div>
		</div>

		<n-modal v-model:show="showTransferModal" :mask-closable="false" transform-origin="center">
			<div class="next-transfer-modal w-[400px] max-h-[90vh] flex flex-col">
				<!-- Header -->
				<div class="modal-header-section">
					<div class="flex items-center justify-between w-full mb-4">

					
								<div
						class="flex items-center justify-between px-2 py-1">
						<span class="text-xs text-white">可用余额 </span>
						<span class="text-sm font-semibold text-blue-100">
							{{ formattedBalance }}
						</span>
					</div>
						<button class="close-orb hover:bg-white/10 transition-colors"
							@click="showTransferModal = false">
							<n-icon size="20" class="text-white/80">
								<Dismiss24Regular />
							</n-icon>
						</button>
					</div>
			
				</div>

				<!-- Body -->
				<div class="p-6 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto custom-scrollbar">
					<div class="space-y-3">


						<!-- Amount Input -->
						<div class="space-y-2">
							<label class="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
								转账金额
							</label>
							<div class="relative group">
								<span
									class="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400 group-focus-within:text-blue-500">
									￥
								</span>
								<input v-model.number="transferAmount" type="number" step="0.01" placeholder="0.00"
									class="w-full pl-10 pr-4 py-4 text-2xl font-bold bg-transparent border-2 border-gray-100 dark:border-zinc-800 rounded-2xl focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-200 dark:placeholder:text-zinc-700" />
							</div>
						</div>

						<!-- Remark -->
						<div class="space-y-2">
							<label class="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
								备注信息
							</label>
							<input v-model="transferRemark" placeholder="添加备注..." maxlength="60"
								class="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-white/5 border border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/30 focus:outline-none transition-all" />
						</div>

						<!-- PIN Experience -->
						<div class="space-y-3 pt-2">
							<div class="flex items-center justify-between ml-1">
								<label class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
									安全 PIN 码
								</label>
								<span v-if="!securityPasswordSet" class="text-[10px] text-red-500 font-medium">
									尚未设置
								</span>
							</div>
							<div class="flex gap-2 justify-between">
								<input v-for="(_digit, idx) in pinInputs" :key="idx" :ref="(el) =>
									(pinRefs[idx] =
										el as HTMLInputElement)
									" v-model="pinInputs[idx]" type="password" maxlength="1" inputmode="numeric" class="pin-box"
									:class="{ 'has-value': pinInputs[idx] }" @input="handlePinInput(idx, $event)"
									@keydown="handlePinKeyDown(idx, $event)" @paste="handlePinPaste" />
							</div>
						</div>
					</div>

					<div class="mt-8 space-y-4">
						<div class="flex items-center gap-2 justify-center text-[10px] text-gray-400">
							<n-icon size="14" class="text-green-500">
								<ShieldCheckmark24Regular />
							</n-icon>
							<span>支付过程受端到端加密保护</span>
						</div>

						<button
							class="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
							:disabled="transferLoading ||
								!transferAmount ||
								transferSecurityPassword.length < 6
								" @click="submitTransfer">
							<n-icon v-if="!transferLoading" size="18">
								<ArrowCircleUp24Regular />
							</n-icon>
							<n-spin v-else size="small" stroke="#fff" />
							<span>
								{{
									transferLoading
										? '正在核对...'
										: '确认发送转账'
								}}
							</span>
						</button>
					</div>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<style scoped>
/* 确保编辑器容器正确 */
:deep(.tiptap) {
	word-break: break-all;
	white-space: pre-wrap;
	outline: none;
	padding: 4px;
	min-height: 36px;
	display: block;
}

:deep(.tiptap p) {
	margin: 0;
}

:deep(.tiptap p + p) {
	margin-top: 0.25em;
}

:deep(.tiptap img) {
	display: inline-block;
	vertical-align: bottom;
	cursor: pointer;
	transition: all 0.2s;
	border-radius: 6px;
	margin: 2px 0;
}

:deep(.tiptap img:hover) {
	opacity: 0.9;
	transform: translateY(-1px);
}

.tiptap-editor {
	min-height: 36px;
	max-height: 192px;
}

:deep(.ProseMirror) {
	cursor: text;
	caret-color: #3695ff;
}

:deep(.ProseMirror-focused) {
	outline: none;
	caret-color: #3695ff;
}

:deep(.ProseMirror-selectednode) {
	outline: 2px solid #3b82f6;
	outline-offset: 1px;
}

/* 链接样式 */
:deep(.tiptap a) {
	color: #3b82f6;
	text-decoration: underline;
	cursor: pointer;
}

:deep(.tiptap a:hover) {
	color: #1d4ed8;
}

/* 滚动条样式 */
:deep(.tiptap-editor) {
	scrollbar-width: thin;
	scrollbar-color: #cbd5e1 #f1f5f9;
}

:deep(.tiptap-editor::-webkit-scrollbar) {
	width: 6px;
}

:deep(.tiptap-editor::-webkit-scrollbar-track) {
	background: #f1f5f9;
	border-radius: 3px;
}

:deep(.tiptap-editor::-webkit-scrollbar-thumb) {
	background: #cbd5e1;
	border-radius: 3px;
}

:deep(.tiptap-editor::-webkit-scrollbar-thumb:hover) {
	background: #94a3b8;
}

/* 修复BubbleMenu的样式 - 关键修改 */
:deep(.tiptap .bubble-menu) {
	position: absolute !important;
	z-index: 9999 !important;
	transform-origin: bottom center;
	opacity: 0;
	transform: translateY(10px) scale(0.95);
	animation: bubbleMenuShow 0.2s ease forwards;
}

/* 确保链接输入框在正确层级 */
.link-input {
	z-index: 10000;
}

.composer-toolbar {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px;
	border-radius: 12px;
	background: linear-gradient(180deg,
			rgba(248, 250, 252, 0.9) 0%,
			rgba(241, 245, 249, 0.9) 100%);
	border: 1px solid rgba(148, 163, 184, 0.2);
}

:deep(.dark) .composer-toolbar {
	background: linear-gradient(180deg,
			rgba(39, 39, 42, 0.88) 0%,
			rgba(24, 24, 27, 0.88) 100%);
	border-color: rgba(82, 82, 91, 0.55);
}

.composer-action-btn {
	width: 28px;
	height: 28px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	color: rgb(100 116 139);
	transition: all 0.18s ease;
}

.composer-action-btn:hover {
	background: rgba(59, 130, 246, 0.12);
	color: rgb(37 99 235);
	cursor: pointer;
}

.composer-action-btn:active {
	transform: translateY(0);
}

:deep(.dark) .composer-action-btn {
	color: rgb(161 161 170);
}

:deep(.dark) .composer-action-btn:hover {
	background: rgba(56, 189, 248, 0.16);
	color: rgb(125 211 252);
}

.composer-send-btn {
	height: 28px;
	padding: 0 10px;
	border-radius: 8px;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	font-weight: 600;
	color: #fff;
	background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
	transition: all 0.18s ease;
}

.composer-send-btn:hover:not(:disabled) {
	filter: brightness(1.03);
}

.composer-send-btn:active:not(:disabled) {
	transform: translateY(0);
}

.composer-send-btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

/* NextUI Modal Styles */
.next-transfer-modal {
	border-radius: 32px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
}

.modal-header-section {
	padding: 10px 10px;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
}

.icon-orb {
	width: 48px;
	height: 48px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close-orb {
	width: 32px;
	height: 32px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pin-box {
	width: 48px;
	height: 56px;
	border-radius: 14px;
	background: #f4f4f5;
	border: 2px solid transparent;
	text-align: center;
	font-size: 24px;
	font-weight: bold;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	outline: none;
}

.dark .pin-box {
	background: #27272a;
	color: white;
}

.pin-box:focus {
	border-color: #3b82f6;
	background: white;
	transform: translateY(-2px);
}

.dark .pin-box:focus {
	background: #18181b;
}

.pin-box.has-value {
	border-color: #3b82f6;
	background: white;
}

.dark .pin-box.has-value {
	background: #18181b;
}

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
	appearance: none;
	-webkit-appearance: none;
	margin: 0;
}

/* Firefox */
input[type='number'] {
	appearance: textfield;
	-moz-appearance: textfield;
}
</style>

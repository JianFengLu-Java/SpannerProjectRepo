<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { ImageOutline, At, HappyOutline } from '@vicons/ionicons5'
import { useMessage, NPopover, NIcon } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
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
const message = useMessage()

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

// 添加边界元素引用
const boundaryElement = ref<HTMLElement | null>(null)

// 计算属性：规范化 ID
const normalizedId = computed(() => {
	if (typeof props.currentId === 'string') {
		return parseInt(props.currentId) || Number(props.currentId)
	}
	return props.currentId
})

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
						if (showLinkInput.value) {
							confirmLink()
							return true
						}
						handleSendMessage()
						return true
					},
					Escape: () => {
						if (showLinkInput.value) {
							cancelLink()
							return true
						}
						return false
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
			class: 'focus:outline-none py-1 leading-6 text-text-main break-all w-full min-h-[36px] flex items-center',
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
		syncDraft()
	},
	onUpdate: ({ editor }) => {
		const isTextEmpty = editor.getText().trim().length === 0
		const hasImage = editor.getHTML().includes('<img')

		canSend.value = !isTextEmpty || hasImage
		checkLayoutWithImages()
		editor.commands.scrollIntoView()
	},
})

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

	// 发送成功后清空编辑器
	editor.value.commands.clearContent()

	// 清除草稿
	if (normalizedId.value) {
		chatStore.saveDraft(normalizedId.value, null)
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
})

onUnmounted(() => {
	syncDraft()
	resizeObserver?.disconnect()
	editor.value?.destroy()
})
</script>

<template>
	<div class="relative">
		<div
			class="w-full rounded-xl border h-fit bg-sidebar-select-bg transition-all duration-200 p-1.5"
			:class="[
				isFocus
					? 'border-border-default ring-2 ring-border-main'
					: 'border-border-main',
			]"
		>
			<div ref="containerRef" class="flex flex-wrap items-end relative">
				<!-- 链接输入框 -->
				<div
					v-if="showLinkInput"
					class="absolute bottom-full left-0 right-0 mb-2 p-2 bg-page-bg border border-border-main rounded-lg shadow-lg z-50"
				>
					<div class="flex items-center gap-2">
						<input
							v-model="linkUrl"
							type="url"
							placeholder="输入链接地址"
							class="link-input flex-1 px-3 py-1.5 text-sm border border-border-main rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							@keyup.enter="confirmLink"
							@keyup.escape="cancelLink"
						/>
						<n-button
							size="small"
							type="primary"
							@click="confirmLink"
						>
							确认
						</n-button>
						<n-button size="small" @click="cancelLink">
							取消
						</n-button>
					</div>
				</div>

				<div
					class="flex-1 min-w-[120px] px-1 min-h-9 cursor-text flex items-center"
					@click="focusEditor"
				>
					<!-- BubbleMenu -->
					<BubbleMenu
						v-if="editor"
						:editor="editor"
						:should-show="shouldShowBubbleMenu"
						:tippy-options="bubbleMenuTippyOptions"
					>
						<div
							class="flex items-center bg-white/80 dark:bg-zinc-800/85 backdrop-blur-md shadow-xl border border-gray-200/80 dark:border-zinc-700 rounded-xl p-1.5 gap-1 animate-bubble-in"
						>
							<button
								type="button"
								title="加粗 (Ctrl+B)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-emerald-900/30 hover:text-green-600 dark:hover:text-emerald-300 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('bold'),
								}"
								@click="
									editor.chain().focus().toggleBold().run()
								"
							>
								<n-icon size="18"><TextBold24Filled /></n-icon>
							</button>

							<button
								type="button"
								title="斜体 (Ctrl+I)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-emerald-900/30 hover:text-green-600 dark:hover:text-emerald-300 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('italic'),
								}"
								@click="
									editor.chain().focus().toggleItalic().run()
								"
							>
								<n-icon size="18"
									><TextItalic24Filled
								/></n-icon>
							</button>

							<button
								type="button"
								title="下划线 (Ctrl+U)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-emerald-900/30 hover:text-green-600 dark:hover:text-emerald-300 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('underline'),
								}"
								@click="
									editor
										.chain()
										.focus()
										.toggleUnderline()
										.run()
								"
							>
								<n-icon size="18"
									><TextUnderline24Filled
								/></n-icon>
							</button>

							<button
								type="button"
								title="删除线"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-emerald-900/30 hover:text-green-600 dark:hover:text-emerald-300 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('strike'),
								}"
								@click="
									editor.chain().focus().toggleStrike().run()
								"
							>
								<n-icon size="18"
									><TextStrikethrough24Filled
								/></n-icon>
							</button>

							<div class="w-[1.5px] h-4 bg-gray-200/60 dark:bg-zinc-700 mx-1"></div>

							<button
								type="button"
								title="代码"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-green-50 hover:text-green-600 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('code'),
								}"
								@click="
									editor.chain().focus().toggleCode().run()
								"
							>
								<n-icon size="18"><Code24Filled /></n-icon>
							</button>

							<button
								type="button"
								title="链接 (Ctrl+K)"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-green-50 hover:text-green-600 active:scale-95"
								:class="{
									'text-green-600 bg-green-100/50 shadow-inner':
										editor.isActive('link'),
								}"
								@click="setLink"
							>
								<n-icon size="18"><Link24Filled /></n-icon>
							</button>

							<button
								type="button"
								title="清除格式"
								class="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 text-gray-600 hover:bg-red-50 hover:text-red-500 active:scale-95"
								@click="
									editor.chain().focus().unsetAllMarks().run()
								"
							>
								<n-icon size="18"
									><TextClearFormatting24Filled
								/></n-icon>
							</button>
						</div>
					</BubbleMenu>

					<editor-content
						:editor="editor"
						class="tiptap-editor w-full max-h-64 overflow-y-auto overflow-x-hidden"
						@click="focusEditor"
					/>

					<div
						v-if="editor?.isEmpty"
						class="absolute left-1 ml-1 pointer-events-none text-text-main/40 select-none transition-opacity duration-150"
						:class="isFocus ? 'opacity-0' : 'opacity-100'"
					>
						输入消息...
					</div>
					<span
						v-if="editor?.isEmpty && isFocus"
						class="editor-fake-caret pointer-events-none"
					></span>
				</div>

				<div
					ref="actionsRef"
					class="flex items-center gap-1 shrink-0 h-fit transition-all duration-200"
					:class="[isMultiline ? 'w-full justify-end mt-2' : 'mt-0']"
				>
					<div
						class="rounded-xl flex bg-gray-100/30 gap-1 p-1 items-center"
					>
						<div
							title="插入图片"
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
							@click="fileInput?.click()"
						>
							<n-icon size="20"><ImageOutline /></n-icon>
							<input
								ref="fileInput"
								type="file"
								accept="image/*"
								class="hidden"
								@change="
									(e: any) =>
										insertImageFile(e.target.files[0])
								"
							/>
						</div>

						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
							title="@提及"
						>
							<n-icon size="20"><At /></n-icon>
						</div>
						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
						>
							<n-popover
								v-model:show="showEmoji"
								trigger="click"
								placement="top"
								:show-arrow="false"
								style="padding: 0"
							>
								<template #trigger>
									<n-icon title="表情" size="20"
										><HappyOutline
									/></n-icon>
								</template>
								<EmojiPicker
									@select="onSelectEmoji"
									@select-custom="onSelectCustomEmoji"
								/>
							</n-popover>
						</div>
						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
							title="字体大小"
						>
							<n-icon size="20"><FontDecrease24Regular /></n-icon>
						</div>

						<n-button
							type="primary"
							size="small"
							:disabled="!canSend"
							color="#10b981"
							class="transition-all duration-200 hover:shadow-md"
							@click="handleSendMessage"
						>
							<template #icon>
								<n-icon size="16" color="#fff">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="w-4 h-4"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
										/>
									</svg>
								</n-icon>
							</template>
							<p class="text-white font-medium">发送</p>
						</n-button>
					</div>
				</div>
			</div>
		</div>

		<div class="w-full flex justify-end h-2.5">
			<div
				v-if="!editor?.isEmpty"
				class="px-2 text-[10px] text-gray-400 select-none"
			>
				Shift + Enter 换行
			</div>
		</div>
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
	display: flex;
	flex-wrap: wrap;
	align-items: center;
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
	caret-color: #10b981;
}

:deep(.ProseMirror-focused) {
	outline: none;
	caret-color: #10b981;
}

.editor-fake-caret {
	position: absolute;
	left: 8px;
	top: 50%;
	transform: translateY(-50%);
	width: 2px;
	height: 1.1em;
	background: #10b981;
	border-radius: 1px;
	animation: editorCaretBlink 1s steps(2, start) infinite;
}

@keyframes editorCaretBlink {
	0%,
	45% {
		opacity: 1;
	}
	46%,
	100% {
		opacity: 0;
	}
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

:deep(.tiptap .bubble-menu > div) {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 确保链接输入框在正确层级 */
.link-input {
	z-index: 10000;
}
</style>

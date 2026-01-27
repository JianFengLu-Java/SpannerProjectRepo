<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { ImageOutline, At } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import StarterKit from '@tiptap/starter-kit'
import { EmojiAdd16Regular, FontDecrease20Regular } from '@vicons/fluent'
import type { Editor } from '@tiptap/core'

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

// 计算属性：规范化 ID
const normalizedId = computed(() => {
	if (typeof props.currentId === 'string') {
		return parseInt(props.currentId) || props.currentId
	}
	return props.currentId
})

// 同步草稿函数
const syncDraft = () => {
	if (normalizedId.value && editor.value) {
		const content = editor.value.getJSON()
		if (!editor.value.isEmpty) {
			chatStore.saveDraft(normalizedId.value, content)
		} else {
			chatStore.saveDraft(normalizedId.value, null)
		}
	}
}

// 链接功能
const setLink = () => {
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

const confirmLink = () => {
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

const cancelLink = () => {
	showLinkInput.value = false
	linkUrl.value = ''
	editor.value?.chain().focus().run()
}

// 初始化编辑器
const editor = useEditor({
	content: normalizedId.value ? chatStore.getDraft(normalizedId.value) : '',
	extensions: [
		StarterKit.configure({
			history: true,
		}).extend({
			addKeyboardShortcuts() {
				return {
					Enter: ({ editor }) => {
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
		handlePaste: (view, event) => {
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
		handleDrop: (view, event, slice, moved) => {
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
const shouldShowBubbleMenu = ({ editor }: { editor: Editor }) => {
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

	return true
}

// 业务逻辑函数
const handleSendMessage = () => {
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

const insertImageFile = (file: File) => {
	const reader = new FileReader()
	reader.onload = (e) => {
		const src = e.target?.result as string
		if (!editor.value) return
		editor.value.chain().focus().setImage({ src }).insertContent(' ').run()
		scrollToBottom()
	}
	reader.readAsDataURL(file)
}

const scrollToBottom = () => {
	nextTick(() => {
		const element = containerRef.value?.querySelector('.tiptap-editor')
		if (element) element.scrollTop = element.scrollHeight
	})
}

const checkLayoutWithImages = () => {
	nextTick(() => {
		checkLayout()
		const imgs = containerRef.value?.querySelectorAll('img')
		imgs?.forEach((img) => {
			if (!img.complete) img.onload = checkLayout
		})
	})
}

const checkLayout = () => {
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
				>
					<!-- BubbleMenu 关键修改 -->
					<BubbleMenu
						v-if="editor"
						:editor="editor"
						:should-show="shouldShowBubbleMenu"
						:tippy-options="{
							duration: [150, 75],
							animation: 'shift-away',
							zIndex: 9999,

							placement: 'top',
							offset: [0, 8],
							interactive: true,
							hideOnClick: false,
							trigger: 'mouseenter',
							theme: 'light',
							arrow: false,
							maxWidth: 'none',
						}"
					>
						<div
							class="flex items-center bg-page-bg shadow-lg border border-border-main rounded-lg p-1 gap-1 backdrop-blur-sm"
						>
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg font-bold"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('bold'),
								}"
								@click="
									editor.chain().focus().toggleBold().run()
								"
								title="加粗 (Ctrl+B)"
							>
								B
							</button>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg italic font-serif"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('italic'),
								}"
								@click="
									editor.chain().focus().toggleItalic().run()
								"
								title="斜体 (Ctrl+I)"
							>
								I
							</button>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg underline"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('underline'),
								}"
								@click="
									editor
										.chain()
										.focus()
										.toggleUnderline()
										.run()
								"
								title="下划线 (Ctrl+U)"
							>
								U
							</button>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg line-through"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('strike'),
								}"
								@click="
									editor.chain().focus().toggleStrike().run()
								"
								title="删除线"
							>
								S
							</button>

							<div class="w-[1px] h-4 bg-border-main mx-1"></div>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg font-mono text-xs"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('code'),
								}"
								@click="
									editor.chain().focus().toggleCode().run()
								"
								title="代码"
							>
								&lt;/&gt;
							</button>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg"
								:class="{
									'text-blue-600 bg-sidebar-select-bg/50':
										editor.isActive('link'),
								}"
								@click="setLink"
								title="链接 (Ctrl+K)"
							>
								🔗
							</button>

							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-150 text-gray-700 hover:bg-sidebar-select-bg"
								@click="
									editor.chain().focus().unsetAllMarks().run()
								"
								title="清除格式"
							>
								✕
							</button>
						</div>
					</BubbleMenu>

					<editor-content
						:editor="editor"
						class="tiptap-editor w-full max-h-64 overflow-y-auto overflow-x-hidden"
					/>

					<div
						v-if="editor?.isEmpty"
						class="absolute left-1 ml-1 pointer-events-none text-text-main/40 select-none"
					>
						输入消息...
					</div>
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
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
							@click="fileInput?.click()"
							title="插入图片"
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
							title="表情"
						>
							<n-icon size="20"><EmojiAdd16Regular /></n-icon>
						</div>
						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-text-main/70 hover:text-green-600"
							title="字体大小"
						>
							<n-icon size="20"><FontDecrease20Regular /></n-icon>
						</div>

						<n-button
							type="primary"
							size="small"
							:disabled="!canSend"
							color="#10b981"
							@click="handleSendMessage"
							class="transition-all duration-200 hover:shadow-md"
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
}

:deep(.ProseMirror-focused) {
	outline: none;
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
</style>

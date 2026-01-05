<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import Image from '@tiptap/extension-image'
import { ImageOutline, At } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import StarterKit from '@tiptap/starter-kit'

// --- 新增：接收 currentId 确保闭环 ---
const props = defineProps<{
	currentId: number | string
}>()

const chatStore = useChatStore()
const { activeChatId } = storeToRefs(chatStore)
const message = useMessage()

// --- 响应式状态 ---
const isMultiline = ref(false)
const isFocus = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let resizeObserver: ResizeObserver | null = null
const canSend = ref(false)

/**
 * 同步当前内容到 Pinia 草稿箱
 * 修改点：使用 props.currentId 确保销毁瞬间存入的是该组件挂载时的 ID
 */
const syncDraft = () => {
	if (props.currentId && editor.value) {
		chatStore.saveDraft(props.currentId, editor.value.getJSON())
	}
}

// --- 初始化编辑器 ---
const editor = useEditor({
	// 修改点：使用 props.currentId 获取内容
	content: props.currentId ? chatStore.getDraft(props.currentId) : '',
	extensions: [
		StarterKit,
		BubbleMenuExtension.configure({
			pluginKey: 'bubbleMenu',
		}),
		Image.configure({
			inline: true,
			HTMLAttributes: {
				class: 'max-w-[180px] rounded-lg border border-gray-100 vertical-middle my-1',
			},
		}),
	],
	editorProps: {
		attributes: {
			class: 'focus:outline-none py-1 leading-6 text-gray-800 break-all w-full',
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
	onFocus: () => (isFocus.value = true),
	onBlur: () => (isFocus.value = false),
	onUpdate: ({ editor }) => {
		canSend.value = !editor.isEmpty
		checkLayoutWithImages()
		editor.commands.scrollIntoView()
	},
})

// --- 业务逻辑函数 ---

const handleSendMessage = () => {
	if (!editor.value || editor.value.isEmpty) return

	// 1. 发送逻辑...

	// 2. 发送成功后清空编辑器
	editor.value.commands.clearContent()

	// 3. 修改点：使用 props.currentId 清除草稿
	if (props.currentId) {
		chatStore.saveDraft(props.currentId, null)
	}
}

const insertImageFile = (file: File) => {
	const reader = new FileReader()
	reader.onload = (e) => {
		const src = e.target?.result as string
		if (!editor.value) return
		editor.value
			.chain()
			.focus()
			.setImage({ src })
			.insertContent('<p></p>')
			.run()
		scrollToBottom()
	}
	reader.readAsDataURL(file)
}
const syncCanSend = () => {
	if (editor.value) {
		canSend.value = !editor.value.isEmpty
	}
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

const shouldShowBubbleMenu = ({ editor }: { editor: any }) => {
	if (!editor) return false
	const { selection } = editor.state
	return !selection.empty && !editor.isActive('image')
}

const checkLayout = () => {
	if (!containerRef.value || !actionsRef.value) return
	actionsRef.value.style.width = 'auto'
	actionsRef.value.style.flex = 'none'
	const containerRect = containerRef.value.getBoundingClientRect()
	const actionsRect = actionsRef.value.getBoundingClientRect()
	isMultiline.value = actionsRect.top - containerRect.top > 1
	actionsRef.value.style.removeProperty('width')
	actionsRef.value.style.removeProperty('flex')
}

onMounted(() => {
	resizeObserver = new ResizeObserver(() =>
		requestAnimationFrame(checkLayout),
	)
	if (containerRef.value) resizeObserver.observe(containerRef.value)
	nextTick(syncCanSend)
	checkLayout()
})

onUnmounted(() => {
	syncDraft() // 关键：此时使用的是该组件创建时锚定的 props.currentId
	resizeObserver?.disconnect()
	editor.value?.destroy() // 显式销毁实例
})

function handleClickEditor(e: MouseEvent): void {
	const target = e.target as HTMLElement
	if (target.tagName === 'IMG') message.info('选择了图片')
}
</script>

<template>
	<div class="chat-edit-wrapper">
		<div
			class="w-full rounded-xl border h-fit bg-white transition-all duration-200 p-1.5"
			:class="[
				isFocus
					? 'border-gray-500 ring-[3px] ring-gray-100/70'
					: 'border-gray-200',
			]"
		>
			<div ref="containerRef" class="flex flex-wrap items-end relative">
				<div
					class="flex-1 min-w-[120px] px-1 min-h-9 relative cursor-text flex items-center"
					@click="handleClickEditor"
				>
					<BubbleMenu
						v-if="editor"
						:editor="editor"
						:should-show="shouldShowBubbleMenu"
						:tippy-options="{
							duration: [250, 150],
							animation: 'scale-subtle',
							zIndex: 999,
							appendTo: 'parent',
						}"
					>
						<div
							class="flex items-center bg-white shadow-xl border border-gray-200 rounded-lg p-1 gap-1"
						>
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-200 text-gray-600 hover:bg-gray-100 font-bold"
								:class="{
									'text-green-600 bg-green-50':
										editor.isActive('bold'),
								}"
								@click="
									editor.chain().focus().toggleBold().run()
								"
							>
								B
							</button>
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 rounded transition-all duration-200 text-gray-600 hover:bg-gray-100 italic font-serif"
								:class="{
									'text-green-600 bg-green-50':
										editor.isActive('italic'),
								}"
								@click="
									editor.chain().focus().toggleItalic().run()
								"
							>
								I
							</button>
						</div>
					</BubbleMenu>

					<editor-content
						:editor="editor"
						class="tiptap-editor w-full max-h-64 overflow-y-auto overflow-x-hidden"
					/>

					<div
						v-if="editor?.isEmpty"
						class="absolute left-1 ml-1 pointer-events-none text-gray-400 select-none"
					>
						输入消息...
					</div>
				</div>

				<div
					ref="actionsRef"
					class="flex items-center gap-1 shrink-0 h-fit"
					:class="[isMultiline ? 'w-full justify-end' : 'mt-0']"
				>
					<div
						class="rounded-xl flex bg-gray-100/80 gap-1 p-1 items-center"
					>
						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-500 hover:text-green-600"
							@click="fileInput?.click()"
						>
							<n-icon size="20"><At /></n-icon>
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
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-500 hover:text-green-600"
						>
							<n-icon size="20"><ImageOutline /></n-icon>
						</div>
						<div
							class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-500 hover:text-green-600"
						>
							<n-icon size="20"><ImageOutline /></n-icon>
						</div>

						<n-button
							type="primary"
							size="small"
							:disabled="!canSend"
							@click="handleSendMessage"
						>
							发送
						</n-button>
					</div>
				</div>
			</div>
		</div>

		<div class="w-full flex justify-end h-5">
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
/* 1. 隐藏初始组件，防止在编辑器上方占位 */
:deep(.tippy-content) {
	padding: 0;
}

:deep(.tiptap) {
	word-break: break-all;
	white-space: pre-wrap;
	outline: none;
	padding: 4px;
}
:deep(.tiptap p) {
	margin: 0;
}
:deep(.tiptap img) {
	display: inline-block;
	vertical-align: bottom;
	cursor: pointer;
	transition: opacity 0.2s;
	border-radius: 8px;
	margin: 2px 0;
}
:deep(.tiptap img:hover) {
	opacity: 0.9;
	border-color: #87aeee;
}
.tiptap-editor {
	min-height: 28px;
}
:deep(.ProseMirror) {
	cursor: text;
}

/* 确保图标在点击时不选中文本 */
.select-none {
	user-select: none;
}
/* 当图片被选中（点击）时的样式 */
:deep(.tiptap img.ProseMirror-selectednode) {
	outline: 2px solid #87aeee; /* 蓝色外边框 */
	transition: all;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { BubbleMenu } from '@tiptap/vue-3/menus'
//坑：BubbleMenu是从这个路径导入
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { ImageOutline, At } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'

const message = useMessage()

const isMultiline = ref(false)
const isFocus = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

let resizeObserver: ResizeObserver | null = null

const editor = useEditor({
	extensions: [
		StarterKit,
		BubbleMenuExtension.configure({
			pluginKey: 'bubbleMenu', // 设置一个 key 提高稳定性
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
			class: 'focus:outline-none py-1 leading-6 text-gray-800 break-all',
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
	onUpdate: () => {
		checkLayoutWithImages()
		scrollToBottom()
	},
})

// 插入图片并强制另起一行的逻辑
const insertImageFile = (file: File) => {
	const reader = new FileReader()
	reader.onload = (e) => {
		const src = e.target?.result as string
		if (!editor.value) return

		editor.value
			.chain()
			.focus()
			// 1. 在当前位置插入图片
			.setImage({ src })
			// 2. 插入一个空段落（这会强制换行）
			.insertContent('<p></p>')
			// 3. 运行命令
			.run()

		// 4. 插入后滚动到底部
		scrollToBottom()
	}
	reader.readAsDataURL(file)
}
const scrollToBottom = () => {
	nextTick(() => {
		// 找到编辑器内容区域
		const element = containerRef.value?.querySelector('.tiptap-editor')
		if (element) {
			element.scrollTop = element.scrollHeight
		}
	})
}

const checkLayoutWithImages = () => {
	nextTick(() => {
		checkLayout()
		const imgs = containerRef.value?.querySelectorAll('img')
		imgs?.forEach((img) => {
			if (!img.complete) {
				img.onload = checkLayout
			}
		})
	})
}
const shouldShowBubbleMenu = ({ editor }: { editor: any }) => {
	if (!editor) return false

	const { selection } = editor.state
	const { empty } = selection

	// 1. 如果没有选中任何内容（只是光标闪烁），不显示
	if (empty) return false

	// 2. 如果选中了图片，不显示（如果你想给图片单独做菜单，可以在这里区分）
	if (editor.isActive('image')) return false

	// 3. 只有在选中有文本标记时才显示
	return true
}
const checkLayout = () => {
	if (!containerRef.value || !actionsRef.value) return

	// 1. 临时重置样式以测量自然位置
	actionsRef.value.style.width = 'auto'
	actionsRef.value.style.flex = 'none'

	const containerRect = containerRef.value.getBoundingClientRect()
	const actionsRect = actionsRef.value.getBoundingClientRect()

	// 2. 判断是否换行（顶部偏移量大于阈值）
	const isWrapped = actionsRect.top - containerRect.top > 10
	isMultiline.value = isWrapped

	// 3. 必须彻底清除行内样式，否则 Tailwind 的 w-full (width: 100%) 会失效
	actionsRef.value.style.removeProperty('width')
	actionsRef.value.style.removeProperty('flex')
}

// const insertImageFile = (file: File) => {
// 	const reader = new FileReader()
// 	reader.onload = (e) => {
// 		const src = e.target?.result as string
// 		editor.value?.chain().focus().setImage({ src }).run()
// 	}
// 	reader.readAsDataURL(file)
// }

onMounted(() => {
	resizeObserver = new ResizeObserver(() => {
		requestAnimationFrame(checkLayout)
	})

	if (containerRef.value) {
		resizeObserver.observe(containerRef.value)
	}
	// 初次挂载检查一次
	checkLayout()
})

onUnmounted(() => resizeObserver?.disconnect())

function handleClickEditor(e: MouseEvent): void {
	const target = e.target as HTMLElement
	if (target.tagName === 'IMG') {
		message.info('选择了图片')
	}
}
</script>

<template>
	<div
		class="w-full rounded-xl border bg-white transition-all duration-200 p-1.5"
		:class="[
			isFocus
				? 'border-gray-500 ring-[3px] ring-gray-100/70'
				: 'border-gray-200',
		]"
	>
		<div ref="containerRef" class="flex flex-wrap items-end relative">
			<div
				class="flex-1 min-w-[120px] px-1 h-full items-center relative cursor-text"
				@click="handleClickEditor"
			>
				<bubble-menu
					v-if="editor"
					:editor="editor"
					:should-show="shouldShowBubbleMenu"
					:tippy-options="{
						duration: 100,
						zIndex: 999,
						appendTo: 'parent', // 2. 强制挂载到当前父级，避免被裁剪或定位错误
					}"
				>
					<div
						class="flex items-center bg-white shadow-xl border border-gray-200 rounded-lg p-1 gap-1"
					>
						<button
							type="button"
							class="p-1 px-2 hover:bg-gray-100 rounded transition-colors font-bold"
							:class="{
								'text-green-600 bg-green-50':
									editor.isActive('bold'),
							}"
							@click="editor.chain().focus().toggleBold().run()"
						>
							B
						</button>
						<button
							type="button"
							class="p-1 px-2 hover:bg-gray-100 rounded transition-colors font-bold font-serif"
							:class="{
								'text-green-600 bg-green-50':
									editor.isActive('bold'),
							}"
							@click="editor.chain().focus().toggleBold().run()"
						>
							U
						</button>
					</div>
				</bubble-menu>
				<editor-content
					:editor="editor"
					class="tiptap-editor max-h-64 overflow-y-auto"
				/>
				<div
					v-if="editor?.isEmpty"
					class="absolute left-1 top-1 ml-2 pointer-events-none text-gray-400 select-none"
				>
					输入消息...
				</div>
			</div>

			<div
				ref="actionsRef"
				class="flex items-center gap-1 shrink-0 p-0.5"
				:class="[
					isMultiline
						? 'w-full justify-end mt-1'
						: 'ml-auto justify-end',
				]"
			>
				<div class="rounded-xl flex bg-gray-100 gap-1 p-1">
					<div
						class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-600 hover:text-green-600"
						title="提及"
						@click="fileInput?.click()"
					>
						<n-icon size="20"><At /></n-icon>
						<input
							ref="fileInput"
							type="file"
							accept="image/*"
							class="hidden"
							@change="
								(e: any) => insertImageFile(e.target.files[0])
							"
						/>
					</div>

					<div
						class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-600 hover:text-green-600"
						title="上传图片"
					>
						<n-icon size="20">
							<ImageOutline />
						</n-icon>
					</div>
					<div
						class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-600 hover:text-green-600"
						title="上传图片"
					>
						<n-icon size="20">
							<ImageOutline />
						</n-icon>
					</div>
					<div
						class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-600 hover:text-green-600"
						title="上传图片"
					>
						<n-icon size="20">
							<ImageOutline />
						</n-icon>
					</div>
					<div
						class="flex items-center justify-center p-1 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors text-gray-600 hover:text-green-600"
						title="上传图片"
					>
						<n-icon size="20">
							<ImageOutline />
						</n-icon>
					</div>
					<n-button
						type="primary"
						size="small"
						:disabled="editor?.isEmpty"
						@click="() => editor?.commands.clearContent()"
					>
						发送
					</n-button>
				</div>
			</div>
		</div>
	</div>
	<div class="w-full flex justify-end h-3">
		<div v-if="!editor?.isEmpty" class="px-2 text-[10px] text-gray-500/67">
			Shift + Enter 换行
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

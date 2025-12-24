<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image' // 引入图片扩展

// 状态定义
const isMultiline = ref(false)
const isFocus = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const editor = useEditor({
	extensions: [
		StarterKit,
		Image.configure({
			inline: true, // 让图片以行内元素形式存在
			HTMLAttributes: {
				class: 'max-w-[200px] rounded-lg border border-gray-100 vertical-middle my-1',
			},
		}),
	],
	editorProps: {
		attributes: {
			class: 'focus:outline-none py-1 leading-6 text-gray-800',
		},
		// 拦截粘贴事件
		handlePaste: (view, event) => {
			const items = event.clipboardData?.items
			if (!items) return false

			for (const item of items) {
				if (item.type.startsWith('image')) {
					const file = item.getAsFile()
					if (file) {
						insertImageFile(file)
						return true // 阻止默认粘贴，由我们处理
					}
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
	},
	onUpdate: () => {
		nextTick(() => checkResponsiveLayout())
	},
})

// 将文件插入编辑器
const insertImageFile = (file: File) => {
	const reader = new FileReader()
	reader.onload = (e) => {
		const src = e.target?.result as string
		editor.value?.chain().focus().setImage({ src }).run()
	}
	reader.readAsDataURL(file)
}

// 触发本地上传
const onFileChange = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files?.[0]) {
		insertImageFile(files[0])
		if (fileInput.value) fileInput.value.value = ''
	}
}

// 响应式布局逻辑 (保持不变)
const checkResponsiveLayout = async () => {
	if (!containerRef.value || !actionsRef.value) return

	const wasMultiline = isMultiline.value
	if (wasMultiline) {
		isMultiline.value = false
		await nextTick()
	}

	const containerRect = containerRef.value.getBoundingClientRect()
	const actionsRect = actionsRef.value.getBoundingClientRect()
	// 检查按钮是否因为编辑器内容（文字+图片）变高而换行
	const isWrapped = actionsRect.top > containerRect.top + 12
	isMultiline.value = isWrapped
}

// 发送逻辑
const send = () => {
	const content = editor.value?.getHTML() // 获取包含 img 标签的 HTML
	console.log('发送内容：', content)
	editor.value?.commands.clearContent()
}

// 其他生命周期略...
</script>

<template>
	<div
		class="w-full rounded-xl border bg-white transition-all duration-200 shadow-sm p-1.5"
		:class="[
			isFocus
				? 'border-blue-500 ring-[3px] ring-blue-50/50'
				: 'border-gray-200',
		]"
	>
		<div ref="containerRef" class="flex flex-wrap items-end">
			<div class="flex-1 min-w-[150px] relative px-1">
				<editor-content
					:editor="editor"
					class="tiptap-editor max-h-64 overflow-y-auto custom-scrollbar"
				/>
				<div
					v-if="editor?.isEmpty"
					class="absolute left-1 top-1 pointer-events-none text-gray-400"
				>
					输入消息或粘贴图片...
				</div>
			</div>

			<div
				ref="actionsRef"
				class="flex items-center gap-1 transition-all duration-75"
				:class="[
					isMultiline
						? 'w-full mt-2 pt-2 border-t border-gray-100 justify-between'
						: 'ml-auto shrink-0 pb-0.5 justify-end',
				]"
			>
				<div class="flex items-center gap-0.5">
					<n-button
						quaternary
						circle
						size="small"
						class="text-gray-400"
						@click="() => fileInput?.click()"
					>
						<template #icon><i class="i-carbon-image" /></template>
					</n-button>
					<input
						ref="fileInput"
						type="file"
						accept="image/*"
						class="hidden"
						@change="onFileChange"
					/>
				</div>

				<n-button
					type="primary"
					size="small"
					strong
					:disabled="editor?.isEmpty"
					@click="send"
				>
					发送
				</n-button>
			</div>
		</div>
	</div>
</template>

<style scoped>
:deep(.tiptap p) {
	margin: 0;
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 4px;
}
/* 限制编辑器内图片的大小 */
:deep(.tiptap img) {
	display: inline-block;
	max-width: 150px;
	max-height: 150px;
	cursor: default;
}
/* 选中图片时的样式 */
:deep(.tiptap img.ProseMirror-selectednode) {
	outline: 2px solid #3b82f6;
}
.tiptap-editor {
	min-height: 28px;
}
</style>

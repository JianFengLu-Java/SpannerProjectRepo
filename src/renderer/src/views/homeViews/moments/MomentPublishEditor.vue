<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
	Image24Regular,
	TextBold24Regular,
	TextItalic24Regular,
	TextStrikethrough24Regular,
	Link24Regular,
	List24Regular,
} from '@vicons/fluent'
import { NButton, NIcon, NInput } from 'naive-ui'

interface PublishPayload {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}

const props = withDefaults(
	defineProps<{
		submitting?: boolean
	}>(),
	{
		submitting: false,
	},
)

const emit = defineEmits<{
	(e: 'cancel'): void
	(e: 'submit', payload: PublishPayload): void
}>()

const title = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const editor = useEditor({
	content: '',
	extensions: [
		StarterKit,
		Placeholder.configure({
			placeholder:
				'分享你的动态内容... 支持粘贴图片、拖拽图片或点击下方上传',
		}),
		Link.configure({
			openOnClick: false,
			HTMLAttributes: {
				class: 'text-blue-500 underline',
			},
		}),
		Image.configure({
			HTMLAttributes: {
				class: 'post-image',
			},
		}),
	],
	editorProps: {
		attributes: {
			class: 'post-editor-content',
		},
		handlePaste: (_view, event) => {
			const items = event.clipboardData?.items
			if (!items) return false
			const files: File[] = []
			for (const item of items) {
				if (item.type.startsWith('image/')) {
					const file = item.getAsFile()
					if (file) files.push(file)
				}
			}
			if (files.length > 0) {
				void uploadImages(files)
				return true
			}
			return false
		},
		handleDrop: (_view, event, _slice, moved) => {
			if (moved) return false
			const files = Array.from(event.dataTransfer?.files || []).filter(
				(file) => file.type.startsWith('image/'),
			)
			if (files.length > 0) {
				void uploadImages(files)
				return true
			}
			return false
		},
	},
})

const hasContent = computed(() => {
	if (!editor.value) return false
	const text = editor.value.getText().trim()
	const hasImage = editor.value.getHTML().includes('<img')
	return text.length > 0 || hasImage
})

const canSubmit = computed(() => {
	return title.value.trim().length > 0 && hasContent.value && !props.submitting
})

const triggerUpload = (): void => {
	fileInputRef.value?.click()
}

const readFileAsDataUrl = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = (event) => resolve((event.target?.result as string) || '')
		reader.onerror = () => reject(new Error('read-file-failed'))
		reader.readAsDataURL(file)
	})
}

const insertImageSrc = (src: string): void => {
	if (!editor.value || !src) return
	editor.value.chain().focus().setImage({ src }).insertContent('<p></p>').run()
}

const uploadImages = async (files: File[]): Promise<void> => {
	const validFiles = files.filter((file) => file.type.startsWith('image/'))
	if (!validFiles.length) return

	for (const file of validFiles) {
		const src = await readFileAsDataUrl(file)
		insertImageSrc(src)
	}
}

const onFileChange = async (event: Event): Promise<void> => {
	const input = event.target as HTMLInputElement
	const files = Array.from(input.files || [])
	await uploadImages(files)
	input.value = ''
}

const setLink = (): void => {
	if (!editor.value) return
	const previous = editor.value.getAttributes('link').href
	const value = window.prompt('输入链接地址', previous || 'https://')
	if (value === null) return
	const url = value.trim()
	if (!url) {
		editor.value.chain().focus().unsetLink().run()
		return
	}
	editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

const extractImages = (html: string): string[] => {
	if (!html.trim()) return []
	const doc = new DOMParser().parseFromString(html, 'text/html')
	return Array.from(doc.querySelectorAll('img'))
		.map((img) => img.getAttribute('src') || '')
		.filter(Boolean)
}

const handleSubmit = (): void => {
	if (!editor.value || !canSubmit.value) return
	const contentHtml = editor.value.getHTML()
	const contentText = editor.value.getText().trim()
	emit('submit', {
		title: title.value.trim(),
		contentHtml,
		contentText,
		images: extractImages(contentHtml),
	})
}

onUnmounted(() => {
	editor.value?.destroy()
})
</script>

<template>
	<div class="publish-editor-wrap">
		<div class="mb-4">
			<n-input
				v-model:value="title"
				placeholder="输入标题（必填）"
				size="large"
				maxlength="80"
				show-count
			/>
		</div>

		<div class="publish-editor-toolbar">
			<button
				type="button"
				class="toolbar-btn"
				@click="editor?.chain().focus().toggleBold().run()"
			>
				<n-icon size="18"><TextBold24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				@click="editor?.chain().focus().toggleItalic().run()"
			>
				<n-icon size="18"><TextItalic24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				@click="editor?.chain().focus().toggleStrike().run()"
			>
				<n-icon size="18"><TextStrikethrough24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				@click="editor?.chain().focus().toggleBulletList().run()"
			>
				<n-icon size="18"><List24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				@click="editor?.chain().focus().toggleOrderedList().run()"
			>
				<span class="text-xs font-bold">1.</span>
			</button>
			<button type="button" class="toolbar-btn" @click="setLink">
				<n-icon size="18"><Link24Regular /></n-icon>
			</button>
		</div>

		<div class="publish-editor-content-wrap">
			<editor-content :editor="editor" class="publish-editor-content" />
		</div>

		<div class="publish-editor-footer">
			<div class="flex items-center gap-2">
				<n-button secondary @click="triggerUpload">
					<template #icon>
						<n-icon size="18"><Image24Regular /></n-icon>
					</template>
					上传图片
				</n-button>
				<input
					ref="fileInputRef"
					type="file"
					accept="image/*"
					multiple
					class="hidden"
					@change="onFileChange"
				/>
				<span class="text-xs text-gray-400">支持粘贴和拖拽图片</span>
			</div>

			<div class="flex items-center gap-2">
				<n-button :disabled="submitting" @click="emit('cancel')">
					取消
				</n-button>
				<n-button
					type="primary"
					:loading="submitting"
					:disabled="!canSubmit"
					@click="handleSubmit"
				>
					发布
				</n-button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.publish-editor-wrap {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.publish-editor-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px;
	border: 1px solid rgba(0, 0, 0, 0.06);
	border-bottom: 0;
	border-radius: 12px 12px 0 0;
	background: #fafafa;
}

.toolbar-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	color: #4b5563;
	transition: all 0.2s ease;
}

.toolbar-btn:hover {
	background: rgba(16, 185, 129, 0.12);
	color: #059669;
}

.publish-editor-content-wrap {
	flex: 1;
	min-height: 280px;
	border: 1px solid rgba(0, 0, 0, 0.06);
	border-radius: 0 0 12px 12px;
	padding: 12px;
	overflow: hidden;
}

.publish-editor-content {
	height: 100%;
	overflow-y: auto;
}

.publish-editor-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-top: 12px;
}

:deep(.post-editor-content) {
	outline: none;
	min-height: 260px;
	line-height: 1.7;
	word-break: break-word;
}

:deep(.post-editor-content p) {
	margin: 0;
}

:deep(.post-editor-content p + p) {
	margin-top: 0.45rem;
}

:deep(.post-editor-content .is-editor-empty:first-child::before) {
	content: attr(data-placeholder);
	float: left;
	color: #9ca3af;
	pointer-events: none;
	height: 0;
}

:deep(.post-editor-content .post-image) {
	max-width: 100%;
	max-height: 460px;
	display: block;
	border-radius: 12px;
	margin: 10px 0;
}
</style>

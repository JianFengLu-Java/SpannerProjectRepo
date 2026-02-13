<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
	TextBold24Regular,
	TextItalic24Regular,
	TextStrikethrough24Regular,
	Link24Regular,
	List24Regular,
} from '@vicons/fluent'
import { NButton, NIcon, NInput } from 'naive-ui'
import MomentImageUploader from '@renderer/components/MomentImageUploader.vue'

interface PublishPayload {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}

const props = withDefaults(
	defineProps<{
		submitting?: boolean
		initialTitle?: string
		initialContentHtml?: string
		initialImages?: string[]
		submitText?: string
	}>(),
	{
		submitting: false,
		initialTitle: '',
		initialContentHtml: '',
		initialImages: () => [],
		submitText: '发布',
	},
)

const emit = defineEmits<{
	(e: 'cancel'): void
	(e: 'submit', payload: PublishPayload): void
}>()

const title = ref(props.initialTitle)
const isUploadingImages = ref(false)
const uploadedImages = ref<string[]>([...props.initialImages])
const imageUploaderRef = ref<{
	openFileDialog: () => void
	addFiles: (files: File[]) => Promise<void>
} | null>(null)

const editor = useEditor({
	content: props.initialContentHtml || '',
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
				void imageUploaderRef.value?.addFiles(files)
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
				void imageUploaderRef.value?.addFiles(files)
				return true
			}
			return false
		},
	},
})

watch(
	() => props.initialTitle,
	(value) => {
		title.value = value || ''
	},
)

watch(
	() => props.initialImages,
	(value) => {
		uploadedImages.value = [...(value || [])]
	},
	{ deep: true },
)

watch(
	() => props.initialContentHtml,
	(value) => {
		if (!editor.value) return
		const nextHtml = value || ''
		if (editor.value.getHTML() === nextHtml) return
		editor.value.commands.setContent(nextHtml)
	},
)

const hasContent = computed(() => {
	if (!editor.value) return false
	const text = editor.value.getText().trim()
	const hasImage = uploadedImages.value.length > 0
	return text.length > 0 || hasImage
})

const canSubmit = computed(() => {
	return (
		title.value.trim().length > 0 &&
		hasContent.value &&
		!props.submitting &&
		!isUploadingImages.value
	)
})

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
	editor.value
		.chain()
		.focus()
		.extendMarkRange('link')
		.setLink({ href: url })
		.run()
}

const handleSubmit = (): void => {
	if (!editor.value || !canSubmit.value) return
	const contentHtml = editor.value.getHTML()
	const contentText = editor.value.getText().trim()
	emit('submit', {
		title: title.value.trim(),
		contentHtml,
		contentText,
		images: [...uploadedImages.value],
	})
}

onUnmounted(() => {
	editor.value?.destroy()
})
</script>

<template>
	<div class="publish-editor-wrap">
		<div class="publish-editor-title">
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
				:class="{ 'toolbar-btn-active': editor?.isActive('bold') }"
				aria-label="加粗"
				@click="editor?.chain().focus().toggleBold().run()"
			>
				<n-icon size="18"><TextBold24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				:class="{ 'toolbar-btn-active': editor?.isActive('italic') }"
				aria-label="斜体"
				@click="editor?.chain().focus().toggleItalic().run()"
			>
				<n-icon size="18"><TextItalic24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				:class="{ 'toolbar-btn-active': editor?.isActive('strike') }"
				aria-label="删除线"
				@click="editor?.chain().focus().toggleStrike().run()"
			>
				<n-icon size="18"><TextStrikethrough24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				:class="{ 'toolbar-btn-active': editor?.isActive('bulletList') }"
				aria-label="无序列表"
				@click="editor?.chain().focus().toggleBulletList().run()"
			>
				<n-icon size="18"><List24Regular /></n-icon>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				:class="{ 'toolbar-btn-active': editor?.isActive('orderedList') }"
				aria-label="有序列表"
				@click="editor?.chain().focus().toggleOrderedList().run()"
			>
				<span class="text-xs font-bold">1.</span>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				:class="{ 'toolbar-btn-active': editor?.isActive('link') }"
				aria-label="设置链接"
				@click="setLink"
			>
				<n-icon size="18"><Link24Regular /></n-icon>
			</button>
		</div>

		<div class="publish-editor-content-wrap">
			<editor-content :editor="editor" class="publish-editor-content" />
		</div>

		<div class="mt-3">
			<MomentImageUploader
				ref="imageUploaderRef"
				v-model="uploadedImages"
				@uploading-change="
					(uploading) => (isUploadingImages = uploading)
				"
			/>
		</div>

		<div class="publish-editor-footer">
			<div class="publish-editor-actions-left">
				<span class="publish-editor-hint">支持粘贴、拖拽、排序</span>
			</div>

			<div class="publish-editor-actions-right">
				<n-button :disabled="submitting" @click="emit('cancel')">
					取消
				</n-button>
				<n-button
					type="primary"
					:loading="submitting"
					:disabled="!canSubmit"
					@click="handleSubmit"
				>
					{{ submitText }}
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
	max-height: 100%;
	min-height: 0;
	overflow: hidden;
}

.publish-editor-title {
	margin-bottom: 12px;
}

.publish-editor-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	padding: 8px;
	border: 1px solid rgba(0, 0, 0, 0.06);
	border-bottom: 0;
	border-radius: 12px 12px 0 0;
	background: #fafafa;
	overflow-x: auto;
	scrollbar-width: none;
}

.publish-editor-toolbar::-webkit-scrollbar {
	display: none;
}

.toolbar-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	flex: 0 0 auto;
	border-radius: 8px;
	color: #4b5563;
	transition: all 0.2s ease;
}

.toolbar-btn-active {
	background: rgba(16, 185, 129, 0.16);
	color: #047857;
}

.toolbar-btn:hover {
	background: rgba(16, 185, 129, 0.12);
	color: #059669;
}

.publish-editor-content-wrap {
	flex: 1;
	min-height: clamp(120px, 24vh, 220px);
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
	flex-wrap: wrap;
	gap: 10px;
	padding-top: 12px;
}

.publish-editor-actions-left,
.publish-editor-actions-right {
	display: flex;
	align-items: center;
	gap: 8px;
}

.publish-editor-hint {
	font-size: 12px;
	color: #9ca3af;
	white-space: nowrap;
}

:deep(.post-editor-content) {
	outline: none;
	min-height: clamp(90px, 18vh, 180px);
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

@media (max-width: 768px) {
	.publish-editor-title {
		margin-bottom: 10px;
	}

	.publish-editor-content-wrap {
		padding: 10px;
		min-height: clamp(96px, 20vh, 160px);
	}

	.publish-editor-actions-left {
		flex-wrap: wrap;
	}

	.publish-editor-hint {
		white-space: normal;
	}
}

@media (max-height: 760px) {
	.publish-editor-toolbar {
		padding: 6px;
		gap: 6px;
	}

	.publish-editor-content-wrap {
		min-height: 88px;
		padding: 8px;
	}

	:deep(.post-editor-content) {
		min-height: 72px;
	}

	.publish-editor-footer {
		padding-top: 8px;
		gap: 8px;
	}
}

@media (max-width: 560px) {
	.publish-editor-toolbar {
		gap: 6px;
		padding: 7px;
	}

	.toolbar-btn {
		width: 30px;
		height: 30px;
	}

	.publish-editor-footer {
		flex-direction: column;
		align-items: stretch;
	}

	.publish-editor-actions-left {
		justify-content: space-between;
		width: 100%;
	}

	.publish-editor-actions-right {
		width: 100%;
		justify-content: flex-end;
	}
}
</style>

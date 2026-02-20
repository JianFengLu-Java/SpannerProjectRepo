<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Dropcursor from '@tiptap/extension-dropcursor'
import {
	Table,
	TableCell,
	TableHeader,
	TableRow,
} from '@tiptap/extension-table'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import NodeRange from '@tiptap/extension-node-range'
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'
import type { JSONContent } from '@tiptap/core'
import { useMessage } from 'naive-ui'
import {
	TextParagraph24Regular,
	TextHeader124Regular,
	TextHeader224Regular,
	CheckboxUnchecked24Regular,
	Code24Regular,
	Image24Regular,
	Table24Regular,
	TextQuote24Regular,
	TextBulletListLtr24Regular,
	TextNumberListLtr24Regular,
} from '@vicons/fluent'

import type { CloudDoc, CloudDocSaveState } from '@renderer/types/cloudDoc'
import request from '@renderer/utils/request'
import Toolbar from './Toolbar.vue'
import BubbleMenu from './BubbleMenu.vue'
import ImageResizeMenu from './ImageResizeMenu.vue'
import SlashMenu, { type SlashCommandItem } from './SlashMenu.vue'
import {
	BlockKitExtension,
	FontSizeMark,
	HighlightMark,
} from './extensions/BlockKitExtension'

const NESTED_CONFIG = { edgeDetection: { threshold: -16 } }
const CloudImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
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
				renderHTML: (attributes) => {
					const width = String(attributes.width || '').trim()
					if (!width) return {}
					return {
						'data-width': width,
						style: `width: ${width}; height: auto;`,
					}
				},
			},
		}
	},
})

const props = defineProps<{
	doc: CloudDoc
	saveState: CloudDocSaveState
	saveErrorMessage: string
}>()

const emit = defineEmits<{
	(e: 'update:title', value: string): void
	(
		e: 'update:content',
		payload: { contentHtml: string; contentJson: string },
	): void
}>()

interface SlashRange {
	from: number
	to: number
}

const editorCanvasRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const localTitle = ref(props.doc.title)
const nested = ref(true)
const dragHandleReady = ref(false)
const documentFontSize = ref('16px')

const slashVisible = ref(false)
const slashQuery = ref('')
const slashRange = ref<SlashRange | null>(null)
const slashIndex = ref(0)
const slashX = ref(0)
const slashY = ref(0)

const nestedOptions = computed(() => (nested.value ? NESTED_CONFIG : false))
const message = useMessage()

const blockOptions = [
	{ label: '正文', value: 'paragraph' },
	{ label: '标题 1', value: 'heading-1' },
	{ label: '标题 2', value: 'heading-2' },
	{ label: '标题 3', value: 'heading-3' },
	{ label: '引用', value: 'blockquote' },
	{ label: '代码块', value: 'codeBlock' },
	{ label: '无序列表', value: 'bulletList' },
	{ label: '有序列表', value: 'orderedList' },
]

const fontSizeOptions = [
	{ label: '12', value: '12px' },
	{ label: '14', value: '14px' },
	{ label: '16', value: '16px' },
	{ label: '18', value: '18px' },
	{ label: '20', value: '20px' },
	{ label: '24', value: '24px' },
	{ label: '28', value: '28px' },
]

const normalizeLink = (value: string): string => {
	const url = value.trim()
	if (!url) return ''
	if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url
	if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
	return `https://${url}`
}

const normalizeImageSource = (value: string): string => {
	const src = value.trim()
	if (!src) return ''
	if (/^(data:|blob:|file:)/i.test(src)) return src
	if (/^https?:\/\//i.test(src)) return src
	if (/^\/\//.test(src)) return `https:${src}`
	if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src
	return src
}

const resolveRemoteUrl = (value: string): string => {
	const normalized = normalizeImageSource(value)
	if (!normalized) return ''
	if (/^(https?:\/\/|data:|blob:|file:)/i.test(normalized)) return normalized

	const baseUrl = String(request.defaults.baseURL || '').trim()
	if (!baseUrl) {
		// No API base configured: fallback to explicit HTTPS for hostname-like values.
		if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(normalized)) {
			return `https://${normalized}`
		}
		return normalized
	}

	// Hostname-like but protocol-less: treat as https://domain/...
	if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(normalized)) {
		return `https://${normalized}`
	}

	try {
		return new URL(normalized, baseUrl).toString()
	} catch {
		return normalized
	}
}

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

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
			typeof (payload.data as Record<string, unknown>).fileUrl === 'string' &&
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
	return resolveRemoteUrl(parseUploadUrl(response.data.data || null))
}

const readJson = (value: string): JSONContent | null => {
	if (!value) return null
	try {
		return JSON.parse(value) as JSONContent
	} catch {
		return null
	}
}

const closeSlash = (): void => {
	slashVisible.value = false
	slashQuery.value = ''
	slashRange.value = null
	slashIndex.value = 0
}

const syncSlashState = (): void => {
	if (!editor.value) return
	const { from, empty } = editor.value.state.selection
	if (!empty) {
		closeSlash()
		return
	}
	const { $from } = editor.value.state.selection
	const textBefore = $from.parent.textBetween(
		0,
		$from.parentOffset,
		undefined,
		'\uFFFC',
	)
	const matched = textBefore.match(/\/([^\s/]*)$/)
	if (!matched) {
		closeSlash()
		return
	}

	slashVisible.value = true
	slashQuery.value = matched[1] || ''
	slashRange.value = {
		from: from - matched[0].length,
		to: from,
	}

	const coords = editor.value.view.coordsAtPos(from)
	const canvasRect = editorCanvasRef.value?.getBoundingClientRect()
	const contentRect = editorCanvasRef.value
		?.querySelector<HTMLElement>('.structured-editor-content')
		?.getBoundingClientRect()

	const idealX = contentRect ? contentRect.left - 272 : coords.left - 272
	const minX = (canvasRect?.left || 0) + 10
	slashX.value = Math.max(minX, idealX)
	slashY.value = coords.bottom + 8
}

const editor = useEditor({
	editable: true,
	autofocus: 'end',
	content:
		readJson(props.doc.contentJson) || props.doc.contentHtml || '<p></p>',
	extensions: [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			dropcursor: false,
		}),
		Underline,
		HighlightMark,
		FontSizeMark,
		TaskList,
		TaskItem.configure({ nested: true }),
		CloudImage,
		Table.configure({ resizable: true }),
		TableRow,
		TableHeader,
		TableCell,
		BlockKitExtension,
		NodeRange.configure({ key: null }),
		Link.configure({
			openOnClick: false,
			autolink: true,
			defaultProtocol: 'https',
			HTMLAttributes: {
				target: '_blank',
				rel: 'noopener noreferrer nofollow',
			},
		}),
		Placeholder.configure({
			placeholder: "输入 '/' 调出命令菜单",
		}),
		Dropcursor.configure({
			width: 2,
			color: '#3b82f6',
			class: 'cloud-doc-dropcursor',
		}),
	],
	editorProps: {
		attributes: {
			class: 'tiptap ProseMirror structured-editor-content',
		},
		handleKeyDown: (_view, event) => {
			if (slashVisible.value) {
				if (event.key === 'Escape') {
					event.preventDefault()
					closeSlash()
					return true
				}
				if (event.key === 'ArrowDown') {
					event.preventDefault()
					if (slashCommands.value.length > 0) {
						slashIndex.value =
							(slashIndex.value + 1) % slashCommands.value.length
					}
					return true
				}
				if (event.key === 'ArrowUp') {
					event.preventDefault()
					if (slashCommands.value.length > 0) {
						slashIndex.value =
							(slashIndex.value -
								1 +
								slashCommands.value.length) %
							slashCommands.value.length
					}
					return true
				}
				if (event.key === 'Enter') {
					event.preventDefault()
					runSlashByIndex(slashIndex.value)
					return true
				}
			}
			return false
		},
	},
	onUpdate: ({ editor }) => {
		syncSlashState()
		emit('update:content', {
			contentHtml: editor.getHTML(),
			contentJson: JSON.stringify(editor.getJSON()),
		})
	},
	onSelectionUpdate: () => {
		syncSlashState()
	},
})

const slashCommands = computed(() => {
	const items: Array<
		SlashCommandItem & { keywords: string[]; run: () => void }
	> = [
		{
			key: 'text',
			label: '/text',
			desc: '正文段落',
			group: '基础',
			icon: TextParagraph24Regular,
			keywords: ['text', 'paragraph'],
			run: () => editor.value?.chain().focus().setParagraph().run(),
		},
		{
			key: 'h1',
			label: '/h1',
			desc: '一级标题',
			group: '标题',
			icon: TextHeader124Regular,
			keywords: ['h1', 'heading1'],
			run: () =>
				editor.value?.chain().focus().toggleHeading({ level: 1 }).run(),
		},
		{
			key: 'h2',
			label: '/h2',
			desc: '二级标题',
			group: '标题',
			icon: TextHeader224Regular,
			keywords: ['h2', 'heading2'],
			run: () =>
				editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
		},
		{
			key: 'bulletList',
			label: '/ul',
			desc: '无序列表',
			group: '列表',
			icon: TextBulletListLtr24Regular,
			keywords: ['ul', 'bullet', 'list'],
			run: () => editor.value?.chain().focus().toggleBulletList().run(),
		},
		{
			key: 'orderedList',
			label: '/ol',
			desc: '有序列表',
			group: '列表',
			icon: TextNumberListLtr24Regular,
			keywords: ['ol', 'ordered', 'list'],
			run: () => editor.value?.chain().focus().toggleOrderedList().run(),
		},
		{
			key: 'todo',
			label: '/todo',
			desc: '待办事项',
			group: '任务',
			icon: CheckboxUnchecked24Regular,
			keywords: ['todo', 'task'],
			run: () => editor.value?.chain().focus().toggleTaskList().run(),
		},
		{
			key: 'code',
			label: '/code',
			desc: '代码块',
			group: '高级',
			icon: Code24Regular,
			keywords: ['code', 'codeblock'],
			run: () => editor.value?.chain().focus().toggleCodeBlock().run(),
		},
		{
			key: 'image',
			label: '/image',
			desc: '图片 URL',
			group: '媒体',
			icon: Image24Regular,
			keywords: ['image', 'img'],
			run: () => {
				const raw = window.prompt('输入图片 URL')
				if (!raw || !editor.value) return
				const src = resolveRemoteUrl(raw)
				if (!src) return
				const ok = editor.value
					.chain()
					.focus()
					.setImage({ src, title: src })
					.createParagraphNear()
					.run()
				if (!ok) message.warning('图片插入失败，请重试')
			},
		},
		{
			key: 'table',
			label: '/table',
			desc: '插入表格',
			group: '高级',
			icon: Table24Regular,
			keywords: ['table'],
			run: () =>
				editor.value
					?.chain()
					.focus()
					.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
					.run(),
		},
		{
			key: 'quote',
			label: '/quote',
			desc: '引用块',
			group: '基础',
			icon: TextQuote24Regular,
			keywords: ['quote'],
			run: () => editor.value?.chain().focus().toggleBlockquote().run(),
		},
	]

	const query = slashQuery.value.trim().toLowerCase()
	if (!query) return items
	return items.filter((item) => {
		const source = [item.key, item.label, item.desc, ...item.keywords]
			.join('|')
			.toLowerCase()
		return source.includes(query)
	})
})

const runSlashByIndex = (index: number): void => {
	if (!editor.value) return
	const command = slashCommands.value[index]
	if (!command) return
	if (slashRange.value) {
		editor.value.chain().focus().deleteRange(slashRange.value).run()
	}
	command.run()
	closeSlash()
}

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

const activeBlockType = computed(() => {
	if (!editor.value) return 'paragraph'
	if (editor.value.isActive('heading', { level: 1 })) return 'heading-1'
	if (editor.value.isActive('heading', { level: 2 })) return 'heading-2'
	if (editor.value.isActive('heading', { level: 3 })) return 'heading-3'
	if (editor.value.isActive('blockquote')) return 'blockquote'
	if (editor.value.isActive('codeBlock')) return 'codeBlock'
	if (editor.value.isActive('bulletList')) return 'bulletList'
	if (editor.value.isActive('orderedList')) return 'orderedList'
	return 'paragraph'
})

const currentLink = computed(() => {
	if (!editor.value) return ''
	return String(editor.value.getAttributes('link').href || '')
})

const currentFontSize = computed(() => documentFontSize.value)

const applyTitle = (value: string): void => {
	localTitle.value = value
	emit('update:title', value)
}

const applyBlockType = (value: string): void => {
	if (!editor.value) return
	const chain = editor.value.chain().focus()
	if (value === 'paragraph') return void chain.setParagraph().run()
	if (value === 'heading-1')
		return void chain.toggleHeading({ level: 1 }).run()
	if (value === 'heading-2')
		return void chain.toggleHeading({ level: 2 }).run()
	if (value === 'heading-3')
		return void chain.toggleHeading({ level: 3 }).run()
	if (value === 'blockquote') return void chain.toggleBlockquote().run()
	if (value === 'codeBlock') return void chain.toggleCodeBlock().run()
	if (value === 'bulletList') return void chain.toggleBulletList().run()
	if (value === 'orderedList') return void chain.toggleOrderedList().run()
}

const applyLink = (value: string): void => {
	if (!editor.value) return
	if (value === '') {
		editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
		return
	}
	const url = normalizeLink(value)
	editor.value
		.chain()
		.focus()
		.extendMarkRange('link')
		.setLink({ href: url })
		.run()
}

const clearMarks = (): void => {
	editor.value?.chain().focus().unsetAllMarks().run()
}

const syncEditorFontSize = (): void => {
	if (!editor.value) return
	const editorDom = editor.value.view.dom as HTMLElement
	editorDom.style.fontSize = documentFontSize.value
}

const applyFontSize = (value: string): void => {
	const normalized = String(value || '').trim()
	documentFontSize.value = normalized || '16px'
	syncEditorFontSize()
}

const onInsertImage = (): void => {
	imageInputRef.value?.click()
}

const onImageFileChange = async (event: Event): Promise<void> => {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (!file || !editor.value) return
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
		const ok = editor.value
			.chain()
			.focus()
			.setImage({ src, title: src })
			.createParagraphNear()
			.run()
		if (!ok) {
			message.warning('图片插入失败，请重试')
			return
		}
		message.success(`图片已上传：${src}`)
	} catch (error) {
		console.error('云文档图片上传失败', error)
		message.error('图片上传失败，请稍后重试')
	} finally {
		input.value = ''
	}
}

const onInsertTable = (): void => {
	editor.value
		?.chain()
		.focus()
		.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
		.run()
}

const onToggleCodeBlock = (): void => {
	editor.value?.chain().focus().toggleCodeBlock().run()
}

const onUndo = (): void => {
	editor.value?.chain().focus().undo().run()
}

const onRedo = (): void => {
	editor.value?.chain().focus().redo().run()
}

watch(
	() => props.doc.id,
	() => {
		localTitle.value = props.doc.title
		if (!editor.value) return
		const parsed = readJson(props.doc.contentJson)
		if (parsed) {
			editor.value.commands.setContent(parsed, { emitUpdate: false })
			return
		}
		editor.value.commands.setContent(props.doc.contentHtml || '<p></p>', {
			emitUpdate: false,
		})
	},
)

watch(
	() => props.doc.title,
	(value) => {
		if (value === localTitle.value) return
		localTitle.value = value
	},
)

watch(
	() => editor.value,
	async (value) => {
		dragHandleReady.value = false
		if (!value) return
		await nextTick()
		syncEditorFontSize()
		dragHandleReady.value = true
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	dragHandleReady.value = false
	editor.value?.destroy()
})
</script>

<template>
	<div class="editor-root">
		<div class="editor-toolbar-wrap">
			<Toolbar
				:editor="editor"
				:title="localTitle"
				:save-label="saveLabel"
				:save-tag-type="saveTagType"
				:active-block-type="activeBlockType"
				:block-options="blockOptions"
				:font-size-options="fontSizeOptions"
				:current-font-size="currentFontSize"
				:link-value="currentLink"
				:can-undo="!!editor?.can().undo()"
				:can-redo="!!editor?.can().redo()"
				@update:title="applyTitle"
				@set-block="applyBlockType"
				@set-font-size="applyFontSize"
				@set-link="applyLink"
				@clear-link="editor?.chain().focus().unsetLink().run()"
				@insert-image="onInsertImage"
				@insert-table="onInsertTable"
				@toggle-code-block="onToggleCodeBlock"
				@clear-marks="clearMarks"
				@undo="onUndo"
				@redo="onRedo"
			/>
		</div>

		<div
			ref="editorCanvasRef"
			class="editor-canvas"
			:style="{ '--doc-font-size': documentFontSize }"
		>
			<EditorContent :editor="editor || undefined" />
			<DragHandle
				v-if="editor && dragHandleReady"
				class="cloud-drag-handle-root"
				:editor="editor"
				:nested="nestedOptions"
			>
				<div
					class="editor-drag-handle"
				>
					⠿
				</div>
			</DragHandle>
		</div>

		<SlashMenu
			:visible="slashVisible"
			:x="slashX"
			:y="slashY"
			:items="slashCommands"
			:active-index="slashIndex"
			@select="runSlashByIndex"
		/>

		<BubbleMenu :editor="editor" />
		<ImageResizeMenu :editor="editor" />

		<input
			ref="imageInputRef"
			class="hidden"
			type="file"
			accept="image/*"
			@change="onImageFileChange"
		/>
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

.editor-canvas {
	position: relative;
	flex: 1;
	min-height: 0;
	overflow-y: overlay;
	padding: 16px 12px 56px;
	background: #ffffff;
	-webkit-app-region: no-drag;
}

.editor-canvas :deep(.structured-editor-content) {
	width: min(100%, 1200px);
	max-width: none;
	margin: 0 auto;
	min-height: 100%;
	box-sizing: border-box;
	padding-left: 40px;
	padding-right: 24px;
	padding-bottom: 120px;
	outline: none;
	font-size: var(--doc-font-size, 16px);
	line-height: 1.6;
	color: #37352f;
	-webkit-app-region: no-drag;
}

.editor-canvas :deep(.structured-editor-content > *) {
	margin-top: 0.5em;
	margin-bottom: 0.5em;
	position: relative;
	border-radius: 6px;
	transition: background-color 0.12s ease, box-shadow 0.12s ease;
}

.editor-canvas :deep(.structured-editor-content ul),
.editor-canvas :deep(.structured-editor-content ol) {
	padding: 0 1rem;
	margin: 1.25em 1em 1.25em 0.4em;
}

.editor-canvas :deep(.structured-editor-content ul li) {
	list-style-type: disc;
}

.editor-canvas :deep(.structured-editor-content ol li) {
	list-style-type: decimal;
}

.editor-canvas :deep(.structured-editor-content img) {
	display: block;
	max-width: min(100%, 860px);
	height: auto;
	margin: 8px 0;
	border-radius: 8px;
}

.editor-canvas :deep(.structured-editor-content pre) {
	background: #0f172a;
	color: #e2e8f0;
	border-radius: 10px;
	padding: 14px 16px;
	overflow-x: auto;
}

.editor-canvas :deep(.structured-editor-content pre code) {
	font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
		'Courier New', monospace;
	font-size: 13px;
}

.editor-canvas :deep(.structured-editor-content table) {
	width: 100%;
	border-collapse: collapse;
	margin: 10px 0;
	table-layout: fixed;
}

.editor-canvas :deep(.structured-editor-content th),
.editor-canvas :deep(.structured-editor-content td) {
	border: 1px solid #d7dce4;
	padding: 8px 10px;
	vertical-align: top;
}

.editor-canvas :deep(.structured-editor-content th) {
	background: #f5f7fb;
	font-weight: 600;
}

.editor-canvas :deep(.structured-editor-content ::selection) {
	background: rgba(59, 130, 246, 0.25);
}

.editor-canvas :deep(.ProseMirror-noderangeselection > *) {
	background: rgba(59, 130, 246, 0.08);
}

.editor-canvas :deep(.ProseMirror-selectednoderange) {
	background: rgba(59, 130, 246, 0.14);
	box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45) inset;
}

.editor-canvas :deep(.cloud-drag-handle-root) {
	z-index: 60;
}

.editor-canvas :deep(.editor-drag-handle) {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1rem;
	height: 1.25rem;
	line-height: 1;
	font-size: 14px;
	font-weight: 700;
	cursor: grab;
	background: #0d0d0d10;
	color: #0d0d0d50;
	border-radius: 0.25rem;
	-webkit-app-region: no-drag;
	user-select: none;
	-webkit-user-select: none;
}

.editor-canvas :deep(.cloud-doc-dropcursor) {
	background: #3b82f6;
	border-radius: 999px;
}

@media (max-width: 1024px) {
	.editor-canvas {
		padding-left: 8px;
		padding-right: 8px;
	}

	.editor-canvas :deep(.structured-editor-content) {
		width: 100%;
		padding-left: 28px;
		padding-right: 16px;
	}
}

@media (max-width: 640px) {
	.editor-canvas :deep(.structured-editor-content) {
		padding-left: 20px;
		padding-right: 10px;
	}
}
</style>

<script setup lang="ts">
import { type Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { NIcon, NTooltip } from 'naive-ui'

import {
	TextBold24Regular,
	TextItalic24Regular,
	TextUnderline24Regular,
	TextStrikethrough24Regular,
	Highlight24Regular,
	Code24Regular,
	Link24Regular,
	Eraser24Regular,
} from '@vicons/fluent'
import MarkButton from '../components/editor/MarkButton.vue'

const props = defineProps<{
	editor: Editor | undefined | null
}>()

const shouldShow = (ctx: any): boolean => {
	const editor = ctx.editor
	if (!editor) return false
	if (editor.isActive('image')) return false
	return !editor.state.selection.empty
}

const onLinkClick = (): void => {
	if (!props.editor) return
	const previousUrl = props.editor.getAttributes('link').href
	const url = window.prompt('URL', previousUrl)

	// cancelled
	if (url === null) {
		return
	}

	// empty
	if (url === '') {
		props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
		return
	}

	// update
	props.editor
		.chain()
		.focus()
		.extendMarkRange('link')
		.setLink({ href: url })
		.run()
}
</script>

<template>
	<bubble-menu
		v-if="props.editor"
		:editor="props.editor"
		plugin-key="cloud-doc-text-bubble-menu"
		:should-show="shouldShow"
		:tippy-options="{ duration: 100, placement: 'top' }"
		class="bubble-menu-root"
	>
		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('bold')"
					@click="props.editor?.chain().focus().toggleBold().run()"
				>
					<n-icon size="16"><TextBold24Regular /></n-icon>
				</MarkButton>
			</template>
			加粗
		</n-tooltip>

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('italic')"
					@click="props.editor?.chain().focus().toggleItalic().run()"
				>
					<n-icon size="16"><TextItalic24Regular /></n-icon>
				</MarkButton>
			</template>
			斜体
		</n-tooltip>

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('underline')"
					@click="props.editor?.chain().focus().toggleUnderline().run()"
				>
					<n-icon size="16"><TextUnderline24Regular /></n-icon>
				</MarkButton>
			</template>
			下划线
		</n-tooltip>

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('strike')"
					@click="props.editor?.chain().focus().toggleStrike().run()"
				>
					<n-icon size="16"><TextStrikethrough24Regular /></n-icon>
				</MarkButton>
			</template>
			删除线
		</n-tooltip>

		<div class="bubble-divider" />

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('code')"
					@click="props.editor?.chain().focus().toggleCode().run()"
				>
					<n-icon size="16"><Code24Regular /></n-icon>
				</MarkButton>
			</template>
			行内代码
		</n-tooltip>

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('customHighlight')"
					@click="
						props.editor
							?.chain()
							.focus()
							.toggleCustomHighlight()
							.run()
					"
				>
					<n-icon size="16"><Highlight24Regular /></n-icon>
				</MarkButton>
			</template>
			高亮
		</n-tooltip>

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					:active="props.editor.isActive('link')"
					@click="onLinkClick"
				>
					<n-icon size="16"><Link24Regular /></n-icon>
				</MarkButton>
			</template>
			链接
		</n-tooltip>

		<div class="bubble-divider" />

		<n-tooltip trigger="hover">
			<template #trigger>
				<MarkButton
					@click="props.editor?.chain().focus().unsetAllMarks().run()"
				>
					<n-icon size="16"><Eraser24Regular /></n-icon>
				</MarkButton>
			</template>
			清除样式
		</n-tooltip>
	</bubble-menu>
</template>

<style scoped>
.bubble-menu-root {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 8px;
	border-radius: 8px;
	background: #ffffff;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.bubble-divider {
	width: 1px;
	height: 16px;
	background: #e0e0e0;
	margin: 0 4px;
}
</style>

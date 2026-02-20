<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import {
	NButton,
	NIcon,
	NInput,
	NSelect,
	NTag,
	NTooltip,
	type SelectOption,
} from 'naive-ui'
import {
	TextBold24Regular,
	TextItalic24Regular,
	TextUnderline24Regular,
	TextStrikethrough24Regular,
	Highlight24Regular,
	Code24Regular,
	TextBulletListLtr24Regular,
	TextNumberListLtr24Regular,
	CheckboxUnchecked24Regular,
	ArrowUndo24Regular,
	ArrowRedo24Regular,
	DocumentArrowUp20Regular,
	DocumentArrowDown20Regular,
	DocumentAdd24Regular,
	Eraser24Regular,
} from '@vicons/fluent'
import MarkButton from '../components/editor/MarkButton.vue'
import LinkPopover from '../components/editor/LinkPopover.vue'

const props = defineProps<{
	editor: Editor | null | undefined
	title: string
	saveLabel: string
	saveTagType: 'default' | 'warning' | 'success' | 'error'
	activeBlockType: string
	blockOptions: SelectOption[]
	linkValue: string
	canUndo: boolean
	canRedo: boolean
}>()

const emit = defineEmits<{
	(e: 'update:title', value: string): void
	(e: 'set-block', value: string): void
	(e: 'set-link', value: string): void
	(e: 'clear-link'): void
	(e: 'clear-marks'): void
	(e: 'export-json'): void
	(e: 'import-json'): void
	(e: 'new-doc'): void
	(e: 'undo'): void
	(e: 'redo'): void
}>()
</script>

<template>
	<div class="editor-toolbar-root">
		<div class="editor-toolbar-top">
			<n-input
				class="editor-title-input"
				:value="props.title"
				placeholder="未标题云文档"
				size="large"
				maxlength="80"
				show-count
				@update:value="emit('update:title', $event)"
			/>
			<n-tag size="small" :type="props.saveTagType" :bordered="false">
				{{ props.saveLabel }}
			</n-tag>
		</div>

		<div class="editor-toolbar-main">
			<n-select
				:size="'small'"
				:value="props.activeBlockType"
				:options="props.blockOptions"
				class="editor-toolbar-select"
				@update:value="emit('set-block', $event)"
			/>
			<div class="editor-toolbar-divider" />
			<div class="editor-toolbar-actions">
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('bold')"
							@click="
								props.editor?.chain().focus().toggleBold().run()
							"
						>
							<n-icon size="16"><TextBold24Regular /></n-icon>
						</MarkButton>
					</template>
					加粗
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('italic')"
							@click="
								props.editor?.chain().focus().toggleItalic().run()
							"
						>
							<n-icon size="16"><TextItalic24Regular /></n-icon>
						</MarkButton>
					</template>
					斜体
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('underline')"
							@click="
								props.editor
									?.chain()
									.focus()
									.toggleUnderline()
									.run()
							"
						>
							<n-icon size="16"><TextUnderline24Regular /></n-icon>
						</MarkButton>
					</template>
					下划线
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('strike')"
							@click="
								props.editor?.chain().focus().toggleStrike().run()
							"
						>
							<n-icon size="16">
								<TextStrikethrough24Regular />
							</n-icon>
						</MarkButton>
					</template>
					删除线
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('customHighlight')"
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
							:active="props.editor?.isActive('code')"
							@click="
								props.editor?.chain().focus().toggleCode().run()
							"
						>
							<n-icon size="16"><Code24Regular /></n-icon>
						</MarkButton>
					</template>
					行内代码
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('bulletList')"
							@click="
								props.editor
									?.chain()
									.focus()
									.toggleBulletList()
									.run()
							"
						>
							<n-icon size="16">
								<TextBulletListLtr24Regular />
							</n-icon>
						</MarkButton>
					</template>
					无序列表
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('orderedList')"
							@click="
								props.editor
									?.chain()
									.focus()
									.toggleOrderedList()
									.run()
							"
						>
							<n-icon size="16">
								<TextNumberListLtr24Regular />
							</n-icon>
						</MarkButton>
					</template>
					有序列表
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton
							:active="props.editor?.isActive('taskList')"
							@click="
								props.editor
									?.chain()
									.focus()
									.toggleTaskList()
									.run()
							"
						>
							<n-icon size="16">
								<CheckboxUnchecked24Regular />
							</n-icon>
						</MarkButton>
					</template>
					待办
				</n-tooltip>
				<LinkPopover
					:value="props.linkValue"
					@apply="emit('set-link', $event)"
					@clear="emit('clear-link')"
				/>
				<n-tooltip trigger="hover">
					<template #trigger>
						<MarkButton @click="emit('clear-marks')">
							<n-icon size="16"><Eraser24Regular /></n-icon>
						</MarkButton>
					</template>
					清除样式
				</n-tooltip>
			</div>
			<div class="editor-toolbar-history">
				<n-tooltip trigger="hover">
					<template #trigger>
						<n-button
							quaternary
							size="small"
							:disabled="!props.canUndo"
							@click="emit('undo')"
						>
							<n-icon size="16"><ArrowUndo24Regular /></n-icon>
						</n-button>
					</template>
					撤销
				</n-tooltip>
				<n-tooltip trigger="hover">
					<template #trigger>
						<n-button
							quaternary
							size="small"
							:disabled="!props.canRedo"
							@click="emit('redo')"
						>
							<n-icon size="16"><ArrowRedo24Regular /></n-icon>
						</n-button>
					</template>
					重做
				</n-tooltip>
			</div>
		</div>

		<div
			v-if="props.editor?.isActive('table')"
			class="editor-toolbar-table"
		>
			<n-button
				size="small"
				quaternary
				@click="props.editor?.chain().focus().addRowAfter().run()"
			>
				加行
			</n-button>
			<n-button
				size="small"
				quaternary
				@click="props.editor?.chain().focus().addColumnAfter().run()"
			>
				加列
			</n-button>
			<n-button
				size="small"
				quaternary
				@click="props.editor?.chain().focus().deleteRow().run()"
			>
				删行
			</n-button>
			<n-button
				size="small"
				quaternary
				@click="props.editor?.chain().focus().deleteColumn().run()"
			>
				删列
			</n-button>
		</div>

		<div class="editor-toolbar-footer">
			<n-button size="small" quaternary @click="emit('new-doc')">
				<template #icon>
					<n-icon size="16"><DocumentAdd24Regular /></n-icon>
				</template>
				新建空白
			</n-button>
			<n-button size="small" quaternary @click="emit('export-json')">
				<template #icon>
					<n-icon size="16"><DocumentArrowUp20Regular /></n-icon>
				</template>
				导出 JSON
			</n-button>
			<n-button size="small" quaternary @click="emit('import-json')">
				<template #icon>
					<n-icon size="16"><DocumentArrowDown20Regular /></n-icon>
				</template>
				导入 JSON
			</n-button>
		</div>
	</div>
</template>

<style scoped>
.editor-toolbar-root {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 12px 20px 12px;
	background: #ffffff;
}

.editor-toolbar-top {
	display: flex;
	align-items: center;
	gap: 16px;
}

.editor-toolbar-top :deep(.n-input) {
	flex: 1;
	font-size: 20px;
	font-weight: 600;
	/* Remove input border for a cleaner look */
	--n-border: none !important;
	--n-border-hover: none !important;
	--n-border-focus: none !important;
	--n-box-shadow-focus: none !important;
	background: transparent;
}

.editor-toolbar-top :deep(.n-input .n-input__input-el) {
	height: 32px;
	line-height: 32px;
}

.editor-title-input {
	-webkit-app-region: no-drag;
}

.editor-toolbar-main {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px;
	/* border: 1px solid #f0f0f0; */
	border-radius: 8px;
	background: #ffffff;
	flex-wrap: wrap;
}

.editor-toolbar-select {
	width: 140px;
}

.editor-toolbar-divider {
	width: 1px;
	height: 20px;
	background: #e0e0e0;
	margin: 0 4px;
}

.editor-toolbar-actions {
	display: flex;
	align-items: center;
	gap: 2px;
	flex-wrap: wrap;
	flex: 1;
}

.editor-toolbar-footer {
	display: flex;
	align-items: center;
	gap: 12px;
    margin-left: auto; /* Push to right if in same row, but here it is separate */
}

.editor-toolbar-history {
	display: flex;
	align-items: center;
	gap: 2px;
}

.editor-toolbar-table {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 2px;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { NButton, NTooltip } from 'naive-ui'

const props = defineProps<{
	editor: Editor | undefined | null
}>()

const sizeOptions = [25, 50, 75, 100] as const

const currentImageSrc = computed(() => {
	if (!props.editor) return ''
	return String(props.editor.getAttributes('image').src || '')
})

const currentImageWidth = computed(() => {
	if (!props.editor) return '100%'
	const width = String(props.editor.getAttributes('image').width || '').trim()
	return width || '100%'
})

const shouldShow = (ctx: any): boolean => Boolean(ctx?.editor?.isActive('image'))

const applyImageWidth = (percent: (typeof sizeOptions)[number]): void => {
	if (!props.editor) return
	props.editor
		.chain()
		.focus()
		.updateAttributes('image', { width: `${percent}%` })
		.run()
}

const copyImageUrl = async (): Promise<void> => {
	const url = currentImageSrc.value
	if (!url) return
	try {
		await navigator.clipboard.writeText(url)
	} catch (error) {
		console.warn('复制图片 URL 失败', error)
	}
}
</script>

<template>
	<bubble-menu
		v-if="props.editor"
		:editor="props.editor"
		plugin-key="cloud-doc-image-bubble-menu"
		:should-show="shouldShow"
		:tippy-options="{ duration: 120, placement: 'top' }"
		class="image-resize-menu"
	>
		<div class="image-resize-actions">
			<n-button
				v-for="percent in sizeOptions"
				:key="percent"
				size="tiny"
				quaternary
				:type="currentImageWidth === `${percent}%` ? 'primary' : 'default'"
				@click="applyImageWidth(percent)"
			>
				{{ percent }}%
			</n-button>
		</div>
		<n-tooltip v-if="currentImageSrc" trigger="hover">
			<template #trigger>
				<button class="image-url" type="button" @click="copyImageUrl">
					{{ currentImageSrc }}
				</button>
			</template>
			点击复制图片 URL
		</n-tooltip>
	</bubble-menu>
</template>

<style scoped>
.image-resize-menu {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px;
	max-width: min(90vw, 620px);
	border-radius: 10px;
	background: #ffffff;
	box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}

.image-resize-actions {
	display: flex;
	align-items: center;
	gap: 4px;
}

.image-url {
	max-width: 320px;
	padding: 0 4px;
	border: none;
	background: transparent;
	color: #64748b;
	font-size: 12px;
	cursor: pointer;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.image-url:hover {
	color: #2563eb;
}
</style>

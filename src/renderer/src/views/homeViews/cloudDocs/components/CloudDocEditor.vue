<script setup lang="ts">
import type { CloudDoc, CloudDocSaveState } from '@renderer/types/cloudDoc'
import EditorRoot from '../editor/EditorRoot.vue'

const props = defineProps<{
	doc: CloudDoc
	saveState: CloudDocSaveState
	saveErrorMessage: string
}>()

const emit = defineEmits<{
	(e: 'update:title', value: string): void
	(e: 'update:content', payload: { contentHtml: string; contentJson: string }): void
}>()
</script>

<template>
	<EditorRoot
		:doc="props.doc"
		:save-state="props.saveState"
		:save-error-message="props.saveErrorMessage"
		@update:title="emit('update:title', $event)"
		@update:content="emit('update:content', $event)"
	/>
</template>

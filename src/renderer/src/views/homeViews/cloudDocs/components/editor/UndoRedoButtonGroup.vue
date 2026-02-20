<script setup lang="ts">
import { NButton, NButtonGroup } from 'naive-ui'

const props = withDefaults(
	defineProps<{
		canUndo?: boolean
		canRedo?: boolean
	}>(),
	{
		canUndo: false,
		canRedo: false,
	},
)

const emit = defineEmits<{
	(e: 'undo'): void
	(e: 'redo'): void
}>()
</script>

<template>
	<n-button-group size="small">
		<n-button quaternary :disabled="!props.canUndo" @click="emit('undo')">
			撤销
		</n-button>
		<n-button quaternary :disabled="!props.canRedo" @click="emit('redo')">
			重做
		</n-button>
	</n-button-group>
</template>

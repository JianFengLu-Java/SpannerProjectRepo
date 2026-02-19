<template>
	<div class="px-4 py-3 border-t border-border-default/30 first:border-t-0 flex items-center justify-between gap-4">
		<div>
			<div class="text-sm text-text-main">{{ label }}</div>
			<div v-if="description" class="mt-0.5 text-xs text-gray-400">{{ description }}</div>
		</div>
		<n-switch :value="modelValue" :disabled="disabled" @update:value="$emit('update:modelValue', $event)" />
	</div>
</template>

<script setup lang="ts">
import { NSwitch } from 'naive-ui'

defineProps<{
	label: string
	description?: string
	modelValue: boolean
	disabled?: boolean
}>()

defineEmits<{
	(e: 'update:modelValue', value: boolean): void
}>()
</script>

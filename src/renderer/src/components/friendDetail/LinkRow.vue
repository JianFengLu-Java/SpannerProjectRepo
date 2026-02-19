<template>
	<button
		type="button"
		class="w-full px-4 py-3 border-t border-border-default/30 first:border-t-0 flex items-center justify-between gap-4 text-left hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
		:disabled="disabled"
		@click="$emit('click')"
	>
		<div class="min-w-0">
			<div class="text-sm text-text-main">{{ label }}</div>
			<div v-if="description" class="mt-0.5 text-xs text-gray-400">{{ description }}</div>
		</div>
		<div class="text-sm text-gray-400">{{ value || '>' }}</div>
	</button>
</template>

<script setup lang="ts">
defineProps<{
	label: string
	value?: string | number
	description?: string
	disabled?: boolean
}>()

defineEmits<{
	(e: 'click'): void
}>()
</script>

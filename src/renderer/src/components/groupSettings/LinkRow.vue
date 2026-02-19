<template>
	<button
		type="button"
		class="w-full text-left px-4 py-3 border-t border-border-default/40 first:border-t-0 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
		:aria-label="label"
		@click="$emit('click')"
	>
		<div class="min-w-0">
			<div
				class="text-sm font-medium"
				:class="danger ? 'text-red-500' : 'text-text-main'"
			>
				{{ label }}
			</div>
			<p v-if="description" class="mt-1 text-xs text-gray-400">
				{{ description }}
			</p>
		</div>
		<div class="shrink-0 flex items-center gap-2">
			<span v-if="value" class="text-xs text-gray-400 truncate max-w-[120px]">
				{{ value }}
			</span>
			<n-icon size="16" class="text-gray-400">
				<ChevronRight16Regular />
			</n-icon>
		</div>
	</button>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { ChevronRight16Regular } from '@vicons/fluent'

defineProps<{
	label: string
	description?: string
	value?: string
	danger?: boolean
}>()

defineEmits<{
	(e: 'click'): void
}>()
</script>

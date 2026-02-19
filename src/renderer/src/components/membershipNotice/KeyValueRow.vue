<script setup lang="ts">
withDefaults(
	defineProps<{
		label: string
		value: string
		valueClass?: string
		wrap?: boolean
	}>(),
	{
		valueClass: '',
		wrap: false,
	},
)
</script>

<template>
	<div class="flex items-start justify-between gap-3 text-[13px]">
		<span class="shrink-0 text-slate-500 dark:text-slate-400">{{
			label
		}}</span>
		<div class="min-w-0 flex items-center justify-end gap-2">
			<span
				class="font-medium text-slate-800 dark:text-slate-100"
				:class="[wrap ? 'break-all' : 'truncate', valueClass]"
				:title="value"
			>
				{{ value }}
			</span>
			<slot name="action"></slot>
		</div>
	</div>
</template>

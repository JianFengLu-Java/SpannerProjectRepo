<script setup lang="ts">
withDefaults(
	defineProps<{
		label: string
		ariaLabel?: string
	}>(),
	{
		ariaLabel: '',
	},
)
</script>

<template>
	<button
		type="button"
		class="inline-flex items-center text-xs font-medium text-amber-700 underline decoration-amber-500/45 underline-offset-4 transition-colors hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/80 focus-visible:ring-offset-1 dark:text-amber-300 dark:hover:text-amber-200 dark:decoration-amber-300/45 dark:focus-visible:ring-offset-slate-900"
		:aria-label="ariaLabel || label"
	>
		{{ label }}
	</button>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		label: string
		ariaLabel?: string
		disabled?: boolean
	}>(),
	{
		ariaLabel: '',
		disabled: false,
	},
)
</script>

<template>
	<button
		type="button"
		class="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
		:class="
			disabled
				? 'bg-amber-600/75'
				: 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_8px_18px_rgba(217,119,6,.28)] hover:brightness-105 active:scale-[0.98]'
		"
		:aria-label="ariaLabel || label"
		:disabled="disabled"
	>
		{{ label }}
	</button>
</template>

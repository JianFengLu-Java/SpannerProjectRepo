<script setup lang="ts">
import { computed } from 'vue'

type BadgeStatus = 'success' | 'processing' | 'failed' | 'refunded'

const props = defineProps<{
	status: BadgeStatus
}>()

const labelMap: Record<BadgeStatus, string> = {
	success: 'Success',
	processing: 'Processing',
	failed: 'Failed',
	refunded: 'Refunded',
}

const classesMap: Record<BadgeStatus, string> = {
	success:
		'bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-300/30',
	processing:
		'bg-amber-500/12 text-amber-700 border-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-300/35',
	failed: 'bg-rose-500/12 text-rose-700 border-rose-500/25 dark:bg-rose-400/15 dark:text-rose-300 dark:border-rose-300/35',
	refunded:
		'bg-slate-500/12 text-slate-700 border-slate-500/25 dark:bg-slate-300/15 dark:text-slate-200 dark:border-slate-300/30',
}

const label = computed(() => labelMap[props.status])
const classes = computed(() => classesMap[props.status])
</script>

<template>
	<span
		class="inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold tracking-wide"
		:class="classes"
		:aria-label="`状态: ${label}`"
	>
		{{ label }}
	</span>
</template>

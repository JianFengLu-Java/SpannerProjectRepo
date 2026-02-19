<template>
	<div class="px-4 py-3 flex items-center justify-between gap-4 border-t border-border-default/30 first:border-t-0">
		<div class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</div>
		<div class="text-sm text-text-main text-right break-all">{{ value || placeholder || '未填写' }}</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	label: string
	value?: string | number
	placeholder?: string
}>()
</script>

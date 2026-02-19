<template>
	<header
		class="z-20 h-13 px-3 flex items-center justify-between border-b border-border-default/60 bg-page-bg/95 backdrop-blur-sm"
	>
		<button
			type="button"
			class="h-8 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors no-drag"
			aria-label="返回"
			@click="$emit('back')"
		>
			<n-icon size="18"><ChevronLeft16Regular /></n-icon>
		</button>
		<h2 class="text-sm font-semibold text-text-main">{{ title }}</h2>
		<button
			type="button"
			class="h-8 w-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors no-drag flex items-center justify-center"
			aria-label="更多"
			@click="$emit('more')"
		>
			<n-icon size="18"><MoreHorizontal16Regular /></n-icon>
		</button>
	</header>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { ChevronLeft16Regular, MoreHorizontal16Regular } from '@vicons/fluent'

withDefaults(
	defineProps<{
		title?: string
	}>(),
	{
		title: '群聊设置',
	},
)

defineEmits<{
	(e: 'back'): void
	(e: 'more'): void
}>()
</script>

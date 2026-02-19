<template>
	<section class="rounded-xl border border-red-200/70 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/5">
		<header class="px-4 pt-3 pb-2">
			<h3 class="text-sm font-semibold text-red-600">危险操作</h3>
			<p class="mt-1 text-xs text-red-400">
				危险操作不可恢复，请谨慎处理。
			</p>
		</header>
		<div class="pb-1">
			<button
				v-if="isOwner"
				type="button"
				class="w-full text-left px-4 py-3 border-t border-red-200/60 dark:border-red-500/20 text-sm text-red-500 hover:bg-red-100/50 dark:hover:bg-red-500/10 transition-colors"
				aria-label="解散群聊"
				@click="$emit('disband')"
			>
				解散群聊
			</button>
			<button
				v-else
				type="button"
				class="w-full text-left px-4 py-3 border-t border-red-200/60 dark:border-red-500/20 text-sm text-red-500 hover:bg-red-100/50 dark:hover:bg-red-500/10 transition-colors"
				aria-label="退出群聊"
				@click="$emit('quit')"
			>
				退出群聊
			</button>
		</div>
	</section>
</template>

<script setup lang="ts">
defineProps<{
	isOwner: boolean
}>()

defineEmits<{
	(e: 'quit'): void
	(e: 'disband'): void
}>()
</script>

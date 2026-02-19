<template>
	<section class="rounded-xl border border-border-default/60 bg-page-bg">
		<header class="px-4 pt-3 pb-2">
			<h3 class="text-sm font-semibold text-text-main">{{ title }}</h3>
			<p v-if="description" class="mt-1 text-xs text-gray-400">
				{{ description }}
			</p>
		</header>
		<div class="pb-1">
			<slot />
		</div>
	</section>
</template>

<script setup lang="ts">
defineProps<{
	title: string
	description?: string
}>()
</script>

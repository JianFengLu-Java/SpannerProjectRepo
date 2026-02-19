<template>
	<section class="rounded-2xl border border-border-default/60 bg-card-bg/95 backdrop-blur-sm">
		<div class="px-4 py-3 border-b border-border-default/40 flex items-center justify-between">
			<h3 class="text-sm font-semibold text-text-main">{{ title }}</h3>
			<slot name="extra" />
		</div>
		<div>
			<slot />
		</div>
	</section>
</template>

<script setup lang="ts">
defineProps<{
	title: string
}>()
</script>

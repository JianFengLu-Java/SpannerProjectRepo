<template>
	<div class="h-full w-full rounded-xl bg-page-bg">
		<div
			class="h-16 flex items-center px-3 border-b transition-colors duration-300"
			:class="themeStore.isDark ? 'border-gray-800' : 'border-gray-100'"
		>
			<span class="text-xl tracking-tight">联系人</span>
		</div>

		<div class="h-full w-full flex">
			<div class="w-30">friends list</div>
			<div class="w-0.5 bg-border-main h-full"></div>
			<div></div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@renderer/stores/theme'
import { useTitleStore } from '@renderer/stores/title'
const themeStore = useThemeStore()

const titleStore = useTitleStore()
titleStore.setTitle('用户管理')
</script>

<style scoped></style>

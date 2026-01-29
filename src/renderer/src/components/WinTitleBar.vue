<template>
	<div class="h-[32px] w-full flex justify-end gap-1 items-center drag">
		<div
			class="w-11 h-full hover:bg-gray-300/40 cursor-pointer flex justify-center items-center no-drag"
			@click="minimize"
		>
			<n-icon size="16">
				<MinusRound />
			</n-icon>
		</div>
		<!-- 窗口最小化最大化可被父组件配置是否显示 -->
		<div
			v-if="!['Login', 'Register'].includes(route.name as string)"
			class="w-11 h-full hover:bg-gray-300/40 cursor-pointer flex justify-center items-center no-drag"
			@click="maximize"
		>
			<n-icon size="16">
				<CropSquareRound v-if="!isMaximized" />
				<FilterNoneRound v-else />
			</n-icon>
		</div>
		<div
			class="w-11 h-full hover:bg-red-600 flex cursor-pointer justify-center items-center no-drag"
			@click="close"
		>
			<n-icon size="16"><CloseRound /></n-icon>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	MinusRound,
	CropSquareRound,
	CloseRound,
	FilterNoneRound,
} from '@vicons/material'
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isMaximized = ref(false)

const minimize = (): void => {
	window.api.minimizeWindow()
}

const maximize = (): void => {
	window.api.maximizeWindow()
}

const close = (): void => {
	window.api.closeWindow()
}

onMounted(() => {
	window.api.onWindowMaximizeChange((val) => {
		isMaximized.value = val
	})
})
</script>
<style scoped>
.drag {
	-webkit-app-region: drag;
}
</style>

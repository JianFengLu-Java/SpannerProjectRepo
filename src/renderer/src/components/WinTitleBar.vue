<template>
	<div class="h-[32px] w-full flex justify-end gap-1 items-center drag">
		<div
			class="w-11 h-full hover:bg-gray-300/40 cursor-pointer flex justify-center items-center no-drag"
		>
			<n-icon size="16">
				<MinusRound />
			</n-icon>
		</div>
		<!-- 窗口最小化最大化可被父组件配置是否显示 -->
		<div
			class="w-11 h-full hover:bg-gray-300/40 cursor-pointer flex justify-center items-center no-drag"
		>
			<n-icon size="16"> <CropSquareRound /> </n-icon>
		</div>
		<div
			class="w-11 h-full hover:bg-red-600 flex cursor-pointer justify-center items-center no-drag"
		>
			<n-icon size="16"><CloseRound /></n-icon>
		</div>
	</div>
</template>
<script setup lang="ts">
import { MinusRound, CropSquareRound, CloseRound } from '@vicons/material'
</script>
<style scoped>
.drag {
	-webkit-app-region: drag;
}
</style>

<template>
	<div class="h-full w-full flex bg-[#ECEDEE] gap-0 relative overflow-hidden">
		<SideBar
			:is-expanded="isExpanded"
			:width="sideBarWidth"
			@toggle="toggleSidebar"
		/>

		<div
			v-if="isExpanded"
			class="resizer no-drag"
			@mousedown="initDrag"
		></div>

		<div class="h-full flex-1 overflow-hidden pl-0 p-1.5">
			<router-view v-slot="{ Component, route }">
				<keep-alive>
					<component :is="Component" :key="route.name" />
				</keep-alive>
			</router-view>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SideBar from './SideBar.vue'

const isExpanded = ref(false)
const sideBarWidth = ref(200) // 展开后的初始宽度

const toggleSidebar = () => {
	isExpanded.value = !isExpanded.value
}

// 拖拽逻辑
const initDrag = (e: MouseEvent) => {
	const startX = e.clientX
	const startWidth = sideBarWidth.value

	const doDrag = (moveEvent: MouseEvent) => {
		const newWidth = startWidth + (moveEvent.clientX - startX)
		// 限制拖拽范围：最小 160px，最大 400px
		if (newWidth >= 160 && newWidth <= 200) {
			sideBarWidth.value = newWidth
		}
	}

	const stopDrag = () => {
		document.removeEventListener('mousemove', doDrag)
		document.removeEventListener('mouseup', stopDrag)
		document.body.style.cursor = 'default'
	}

	document.addEventListener('mousemove', doDrag)
	document.addEventListener('mouseup', stopDrag)
	document.body.style.cursor = 'col-resize'
}
</script>

<style scoped>
.resizer {
	width: 4px;
	height: 100%;
	cursor: col-resize;
	position: absolute;
	/* 这里的 left 需要动态绑定，或者通过 margin 占位 */
	left: v-bind("isExpanded ? sideBarWidth + 'px' : '76px'");
	z-index: 10;
	transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.resizer:hover {
	background: rgba(0, 0, 0, 0.1);
}
</style>

<template>
	<div
		class="h-full w-full flex bg-gradient-to-br from-grad-start to-grad-end gap-0 relative overflow-hidden"
		:class="{ 'is-dragging': isDragging, 'is-compact': windowWidth < 700 }"
	>
		<SideBar
			:is-expanded="isExpanded && windowWidth >= 700"
			:width="sideBarWidth"
			@toggle="toggleSidebar"
		/>

		<div
			v-if="windowWidth >= 700"
			class="resizer no-drag"
			:class="{ 'will-collapse': willCollapse }"
			@mousedown="initDrag"
		></div>

		<div
			class="h-full flex-1 overflow-hidden pl-0 p-2 shrink-0 min-w-[400px]"
			:class="[isWin ? 'pt-[32px]' : '']"
		>
			<router-view v-slot="{ Component, route }">
				<keep-alive>
					<div class="h-full w-full rounded-[24px] overflow-hidden">
						<component :is="Component" :key="route.name" />
					</div>
				</keep-alive>
			</router-view>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide } from 'vue'
import SideBar from './SideBar.vue'

const isExpanded = ref(true)
const sideBarWidth = ref(200)
const isDragging = ref(false)
const willCollapse = ref(false)
const windowWidth = ref(window.innerWidth)
const isWin = window.api.platform === 'win32'

// 用于拖拽预览的临时宽度
const visualWidth = ref('200px')

// 提供布局相关状态给子组件
provide('windowWidth', windowWidth)
provide('sideBarWidth', sideBarWidth)
provide('isExpanded', isExpanded)

const toggleSidebar = (): void => {
	isExpanded.value = !isExpanded.value
	visualWidth.value = isExpanded.value ? sideBarWidth.value + 'px' : '76px'
}

const handleResize = (): void => {
	windowWidth.value = window.innerWidth
	// 窄屏下强制视觉宽度为折叠宽度
	if (windowWidth.value < 700) {
		visualWidth.value = '76px'
	} else {
		visualWidth.value = isExpanded.value
			? sideBarWidth.value + 'px'
			: '76px'
	}
}

// 优化后的拖拽逻辑
const initDrag = (e: MouseEvent): void => {
	isDragging.value = true
	const startX = e.clientX
	const initialWidth = isExpanded.value ? sideBarWidth.value : 76
	let animationFrameId: number | null = null

	const doDrag = (moveEvent: MouseEvent): void => {
		if (animationFrameId) cancelAnimationFrame(animationFrameId)

		animationFrameId = requestAnimationFrame(() => {
			const delta = moveEvent.clientX - startX
			const rawWidth = initialWidth + delta

			// 引入滞后（Hysteresis）逻辑，避免临界点抖动
			if (isExpanded.value) {
				// 展开状态下：只有当宽度小于 120px 时才收起
				if (rawWidth < 120) {
					isExpanded.value = false
				} else {
					// 限制展开宽度的合理区间
					sideBarWidth.value = Math.min(280, Math.max(160, rawWidth))
				}
			} else {
				// 收起状态下：只有当拖拽出的虚拟宽度超过 160px 时才展开
				if (rawWidth > 160) {
					isExpanded.value = true
					sideBarWidth.value = Math.min(280, Math.max(160, rawWidth))
				}
			}
		})
	}

	const stopDrag = (): void => {
		isDragging.value = false
		if (animationFrameId) cancelAnimationFrame(animationFrameId)

		document.removeEventListener('mousemove', doDrag)
		document.removeEventListener('mouseup', stopDrag)
		document.body.style.cursor = 'default'
	}

	document.addEventListener('mousemove', doDrag)
	document.addEventListener('mouseup', stopDrag)
	document.body.style.cursor = 'col-resize'
}

onMounted(() => {
	window.addEventListener('resize', handleResize)
	// 初始化视觉宽度
	visualWidth.value = isExpanded.value ? sideBarWidth.value + 'px' : '76px'
})

onUnmounted(() => {
	window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.resizer {
	width: 4px;
	height: 100%;
	cursor: col-resize;
	position: absolute;
	left: v-bind("isExpanded ? sideBarWidth + 'px' : '76px'");
	z-index: 50;
	transition: background 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* 装饰性的手柄 */
.resizer::after {
	content: '';
	width: 4px;
	height: 32px;
	background: rgba(255, 255, 255, 0.5);
	border-radius: 2px;
	opacity: 0;
	transition: opacity 0.2s;
}

.resizer:hover::after,
.is-dragging .resizer::after {
	opacity: 1;
}

.is-dragging .no-drag {
	pointer-events: none;
}

.is-dragging * {
	user-select: none !important;
}

.resizer:hover {
	background: rgba(16, 185, 129, 0.4);
}
</style>

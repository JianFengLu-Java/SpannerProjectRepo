<template>
	<div
		class="h-full w-full flex bg-gradient-to-br from-grad-start to-grad-end gap-0 relative overflow-hidden transition-all duration-300 ease-in-out"
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
			class="h-full flex-1 overflow-hidden pl-0 p-1.5"
			:class="[isWin ? 'pt-[32px]' : '']"
		>
			<router-view v-slot="{ Component, route }">
				<keep-alive>
					<div class="h-full w-full">
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
	let currentWidth = initialWidth

	const doDrag = (moveEvent: MouseEvent): void => {
		if (animationFrameId) cancelAnimationFrame(animationFrameId)

		animationFrameId = requestAnimationFrame(() => {
			const delta = moveEvent.clientX - startX
			const rawWidth = initialWidth + delta

			if (!isExpanded.value) {
				// 起始是收起状态：往右拖动超过 10px 立即展开到至少 160px
				if (delta > 10) {
					currentWidth = Math.min(400, Math.max(160, rawWidth))
				} else {
					currentWidth = 76
				}
			} else {
				// 起始是展开状态：宽度小于 150px 立即收起
				if (rawWidth < 150) {
					currentWidth = 76
				} else {
					currentWidth = Math.min(400, Math.max(160, rawWidth))
				}
			}

			visualWidth.value = currentWidth + 'px'

			if (!isExpanded.value) {
				willCollapse.value = delta <= 10
			} else {
				willCollapse.value = rawWidth < 150
			}

			if (!willCollapse.value && currentWidth >= 160) {
				sideBarWidth.value = currentWidth
			}
		})
	}

	const stopDrag = (): void => {
		isDragging.value = false
		if (animationFrameId) cancelAnimationFrame(animationFrameId)

		// 飞书/Lark 风格的吸附逻辑：根据最终状态决定
		if (willCollapse.value) {
			isExpanded.value = false
			visualWidth.value = '76px'
		} else {
			isExpanded.value = true
			sideBarWidth.value = Math.max(160, currentWidth)
			visualWidth.value = sideBarWidth.value + 'px'
		}

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
	width: 2px;
	height: 100%;
	cursor: col-resize;
	position: absolute;
	left: v-bind('visualWidth');
	z-index: 50;
	transition:
		left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
		background 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* 拖拽中的提示状态 */
.is-dragging .resizer {
	transition: none !important;
	background: #10b981; /* 展开态颜色：绿色提示 */
	box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

/* 即将收起时的提示色 */
.is-dragging .resizer.will-collapse {
	background: #94a3b8; /* 收起态颜色：灰色提示 */
	box-shadow: none;
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

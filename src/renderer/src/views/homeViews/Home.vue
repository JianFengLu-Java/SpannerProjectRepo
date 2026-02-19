<template>
	<div
		class="h-full w-full flex bg-gradient-to-br from-[#f5f9ff] via-[#edf4ff] to-[#e4efff] gap-0 relative overflow-hidden"
		:class="{ 'is-dragging': isDragging, 'is-compact': windowWidth < 700 }"
		@click.capture="handleGlobalLinkClick"
	>
		<SideBar
			:is-expanded="isExpanded && windowWidth >= 700"
			:width="sideBarWidth"
			:is-dragging="isDragging"
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
			<div
				v-if="activeSlotComponent"
				class="relative h-full w-full rounded-[14px] overflow-hidden"
			>
				<keep-alive :max="8">
					<component
						:is="activeSlotComponent"
						:key="activeSlotRenderKey"
						class="h-full w-full"
					/>
				</keep-alive>
			</div>
			<router-view v-else v-slot="{ Component, route }">
				<keep-alive>
					<div class="h-full w-full rounded-[14px] overflow-hidden">
						<component :is="Component" :key="route.name" />
					</div>
				</keep-alive>
			</router-view>
		</div>

		<div v-if="isDragging" class="drag-mask" />
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import SideBar from './SideBar.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import { useAppSettingsStore } from '@renderer/stores/appSettings'
import { useInAppBrowserStore } from '@renderer/stores/inAppBrowser'
import { sidebarSlotComponentMap } from './sidebarSlots/slotRegistry'

const isExpanded = ref(true)
const sideBarWidth = ref(200)
const isDragging = ref(false)
const willCollapse = ref(false)
const windowWidth = ref(window.innerWidth)
const isWin = window.api.platform === 'win32'
const userInfoStore = useUserInfoStore()
const route = useRoute()
const sidebarSlotStore = useSidebarSlotStore()
const appSettingsStore = useAppSettingsStore()
const inAppBrowserStore = useInAppBrowserStore()
const activeSlotComponent = computed(() => {
	const slot = sidebarSlotStore.activeSlot
	if (!slot) return null
	return sidebarSlotComponentMap[slot.componentKey] || null
})
const activeSlotRenderKey = computed(() => {
	const slot = sidebarSlotStore.activeSlot
	if (!slot) return 'slot-empty'
	return `${slot.componentKey}:${slot.slotKey}`
})
let dragAnimationFrameId: number | null = null
let dragStartX = 0
let dragInitialWidth = 200
let layoutPersistTimer: ReturnType<typeof setTimeout> | null = null

const handleGlobalLinkClick = (event: MouseEvent): void => {
	const target = event.target as HTMLElement | null
	if (!target) return
	const anchor = target.closest('a[href]') as HTMLAnchorElement | null
	if (!anchor) return
	const rawHref = anchor.getAttribute('href')?.trim()
	if (!rawHref || rawHref.startsWith('#')) return
	if (rawHref.toLowerCase().startsWith('javascript:')) {
		event.preventDefault()
		return
	}

	let resolvedUrl: URL
	try {
		resolvedUrl = new URL(rawHref, window.location.href)
	} catch {
		return
	}

	const protocol = resolvedUrl.protocol.toLowerCase()
	const canHandleProtocol =
		protocol === 'http:' ||
		protocol === 'https:' ||
		protocol === 'mailto:' ||
		protocol === 'tel:'
	if (!canHandleProtocol) return

	event.preventDefault()
	event.stopPropagation()

	if (
		(protocol === 'http:' || protocol === 'https:') &&
		appSettingsStore.routeLinksThroughSidebarWebview
	) {
		const session = inAppBrowserStore.openUrl(resolvedUrl.toString())
		if (session) return
	}

	window.electron.ipcRenderer.send('open-external-url', resolvedUrl.toString())
}

// 用于拖拽预览的临时宽度
const visualWidth = ref('200px')

const getLayoutStorageKey = (account: string): string =>
	`sidebar-layout:${account || 'anonymous'}`

const persistLayout = (account: string): void => {
	const key = getLayoutStorageKey(account)
	window.localStorage.setItem(
		key,
		JSON.stringify({
			width: sideBarWidth.value,
			expanded: isExpanded.value,
		}),
	)
}

const loadLayout = (account: string): void => {
	const key = getLayoutStorageKey(account)
	const raw = window.localStorage.getItem(key)
	if (!raw) {
		sideBarWidth.value = 200
		isExpanded.value = true
		visualWidth.value = isExpanded.value
			? `${sideBarWidth.value}px`
			: '76px'
		return
	}

	try {
		const parsed = JSON.parse(raw) as {
			width?: number
			expanded?: boolean
		}
		const width = Number(parsed.width)
		sideBarWidth.value =
			Number.isFinite(width) && width > 0
				? Math.min(280, Math.max(160, width))
				: 200
		isExpanded.value = parsed.expanded !== false
		visualWidth.value = isExpanded.value
			? `${sideBarWidth.value}px`
			: '76px'
	} catch {
		sideBarWidth.value = 200
		isExpanded.value = true
		visualWidth.value = isExpanded.value
			? `${sideBarWidth.value}px`
			: '76px'
	}
}

const persistLayoutForCurrentAccount = (): void => {
	const account = userInfoStore.account || ''
	persistLayout(account)
}

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

const doDrag = (moveEvent: MouseEvent): void => {
	if (!isDragging.value) return
	if (dragAnimationFrameId) cancelAnimationFrame(dragAnimationFrameId)

	dragAnimationFrameId = requestAnimationFrame(() => {
		const delta = moveEvent.clientX - dragStartX
		const rawWidth = dragInitialWidth + delta

		// 引入滞后（Hysteresis）逻辑，避免临界点抖动
		if (isExpanded.value) {
			// 展开状态下：只有当宽度小于 120px 时才收起
			if (rawWidth < 120) {
				isExpanded.value = false
			} else {
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
	if (!isDragging.value) return
	isDragging.value = false
	if (dragAnimationFrameId) {
		cancelAnimationFrame(dragAnimationFrameId)
		dragAnimationFrameId = null
	}
	document.removeEventListener('mousemove', doDrag)
	document.removeEventListener('mouseup', stopDrag)
	document.body.style.cursor = 'default'
	persistLayoutForCurrentAccount()
}

// 优化后的拖拽逻辑
const initDrag = (e: MouseEvent): void => {
	isDragging.value = true
	dragStartX = e.clientX
	dragInitialWidth = isExpanded.value ? sideBarWidth.value : 76
	document.addEventListener('mousemove', doDrag)
	document.addEventListener('mouseup', stopDrag)
	document.body.style.cursor = 'col-resize'
}

onMounted(() => {
	window.addEventListener('resize', handleResize)
	// 初始化视觉宽度
	visualWidth.value = isExpanded.value ? sideBarWidth.value + 'px' : '76px'
	inAppBrowserStore.startLifecycleManager()
	if (userInfoStore.account) {
		void userInfoStore.refreshCurrentUser().catch((error) => {
			console.warn('刷新当前用户信息失败:', error)
		})
	}
})

onUnmounted(() => {
	window.removeEventListener('resize', handleResize)
	stopDrag()
	if (layoutPersistTimer) {
		clearTimeout(layoutPersistTimer)
		layoutPersistTimer = null
	}
	inAppBrowserStore.stopLifecycleManager()
})

watch(
	() => userInfoStore.account || '',
	(account) => {
		loadLayout(account)
	},
	{ immediate: true },
)

watch([sideBarWidth, isExpanded], () => {
	if (isDragging.value) return
	if (layoutPersistTimer) clearTimeout(layoutPersistTimer)
	layoutPersistTimer = setTimeout(() => {
		persistLayoutForCurrentAccount()
		layoutPersistTimer = null
	}, 120)
})

watch(
	() => route.name,
	() => {
		sidebarSlotStore.clearActiveSlot()
	},
)
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

.is-dragging :deep(webview) {
	pointer-events: none;
}

.drag-mask {
	position: fixed;
	inset: 0;
	z-index: 150;
	cursor: col-resize;
	background: transparent;
}

.resizer:hover {
	background: rgba(54, 149, 255, 0.4);
}
</style>

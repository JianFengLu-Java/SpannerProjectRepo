<template>
	<div class="h-full w-full rounded-[14px] border border-border-default bg-card-bg overflow-hidden flex flex-col">
		<div class="h-11 shrink-0 border-b border-border-default px-3 flex items-center gap-2 bg-page-bg/80 browser-toolbar">
			<n-button class="no-drag" quaternary size="small" :disabled="!canGoBack" @click="goBack">
				<n-icon size="16"><ArrowBackOutline /></n-icon>
			</n-button>
			<n-button class="no-drag" quaternary size="small" :disabled="!canGoForward" @click="goForward">
				<n-icon size="16"><ArrowForwardOutline /></n-icon>
			</n-button>
			<n-button class="no-drag" quaternary size="small" @click="reloadPage">
				<n-icon size="16"><RefreshOutline /></n-icon>
			</n-button>
			<div class="flex-1 min-w-0 px-2 drag-region">
				<div class="text-[12px] text-text-main truncate" :title="displayTitle">{{ displayTitle }}</div>
				<div class="text-[11px] text-gray-500 truncate" :title="displayUrl">{{ displayUrl }}</div>
			</div>
			<n-button class="no-drag" quaternary size="small" @click="openExternal">
				<n-icon size="16"><OpenOutline /></n-icon>
			</n-button>
		</div>
		<div class="flex-1 min-h-0 relative browser-content">
			<div v-if="!activeSession" class="h-full w-full flex items-center justify-center text-sm text-gray-500">
				当前没有可展示的页面
			</div>
			<webview
				v-else
				ref="webviewRef"
				:src="activeSession.url"
				class="in-app-webview"
				allowpopups
			></webview>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import {
	ArrowBackOutline,
	ArrowForwardOutline,
	RefreshOutline,
	OpenOutline,
} from '@vicons/ionicons5'
import { useInAppBrowserStore } from '@renderer/stores/inAppBrowser'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'

interface BrowserWebviewElement extends HTMLElement {
	canGoBack: () => boolean
	canGoForward: () => boolean
	goBack: () => void
	goForward: () => void
	reload: () => void
	getURL: () => string
	addEventListener: (
		type: string,
		listener: (event: Event) => void,
		options?: boolean | AddEventListenerOptions,
	) => void
	removeEventListener: (
		type: string,
		listener: (event: Event) => void,
		options?: boolean | EventListenerOptions,
	) => void
}

const browserStore = useInAppBrowserStore()
const sidebarSlotStore = useSidebarSlotStore()

const webviewRef = ref<BrowserWebviewElement | null>(null)
const canGoBack = ref(false)
const canGoForward = ref(false)

const activeSession = computed(() => browserStore.activeSession)

const displayTitle = computed(() => activeSession.value?.title || '网页')
const displayUrl = computed(() => activeSession.value?.url || '')

const syncNavigationState = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	canGoBack.value = webview.canGoBack()
	canGoForward.value = webview.canGoForward()
}

const syncCurrentMeta = (): void => {
	const webview = webviewRef.value
	const slotKey = activeSession.value?.slotKey
	if (!webview || !slotKey) return
	browserStore.updateSessionMeta(slotKey, {
		url: webview.getURL(),
	})
	syncNavigationState()
}

const onDidNavigate = (): void => {
	syncCurrentMeta()
}

const onPageTitleUpdated = (event: Event): void => {
	const slotKey = activeSession.value?.slotKey
	if (!slotKey) return
	const typedEvent = event as Event & { title?: string }
	browserStore.updateSessionMeta(slotKey, {
		title: typedEvent.title || '网页',
	})
	syncNavigationState()
}

const bindWebviewEvents = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	webview.addEventListener('did-navigate', onDidNavigate)
	webview.addEventListener('did-navigate-in-page', onDidNavigate)
	webview.addEventListener('did-stop-loading', onDidNavigate)
	webview.addEventListener('page-title-updated', onPageTitleUpdated)
	syncNavigationState()
}

const unbindWebviewEvents = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	webview.removeEventListener('did-navigate', onDidNavigate)
	webview.removeEventListener('did-navigate-in-page', onDidNavigate)
	webview.removeEventListener('did-stop-loading', onDidNavigate)
	webview.removeEventListener('page-title-updated', onPageTitleUpdated)
}

const goBack = (): void => {
	const webview = webviewRef.value
	if (!webview || !webview.canGoBack()) return
	webview.goBack()
}

const goForward = (): void => {
	const webview = webviewRef.value
	if (!webview || !webview.canGoForward()) return
	webview.goForward()
}

const reloadPage = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	webview.reload()
}

const openExternal = (): void => {
	const url = activeSession.value?.url
	if (!url) return
	window.electron.ipcRenderer.send('open-external-url', url)
}

watch(
	() => sidebarSlotStore.activeSlotKey,
	(slotKey) => {
		if (!slotKey) return
		browserStore.handleSlotActivated(slotKey)
	},
)

watch(
	() => activeSession.value?.slotKey,
	async () => {
		unbindWebviewEvents()
		await nextTick()
		bindWebviewEvents()
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	unbindWebviewEvents()
})
</script>

<style scoped>
.browser-content {
	overflow: hidden;
}

.browser-toolbar {
	-webkit-app-region: drag;
}

.no-drag,
.no-drag * {
	-webkit-app-region: no-drag;
}

.drag-region,
.drag-region * {
	-webkit-app-region: drag;
}

.in-app-webview {
	position: absolute;
	inset: 0;
	display: flex;
	width: 100%;
	height: 100%;
	border: 0;
}
</style>

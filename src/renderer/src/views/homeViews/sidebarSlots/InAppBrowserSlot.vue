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
		<div ref="browserContentRef" class="flex-1 min-h-0 relative browser-content">
			<div v-if="!activeSession" class="h-full w-full flex items-center justify-center text-sm text-gray-500">
				当前没有可展示的页面
			</div>
			<webview
				v-else
				ref="webviewRef"
				:src="webviewSrc"
				class="in-app-webview"
				:style="webviewSizeStyle"
				allowpopups
			></webview>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from 'vue'
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
	loadURL: (url: string) => void
	getURL: () => string
	executeJavaScript: (
		code: string,
		userGesture?: boolean,
	) => Promise<unknown>
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
const webviewSrc = ref('')
const canGoBack = ref(false)
const canGoForward = ref(false)
const currentUrl = ref('')
const browserContentRef = ref<HTMLElement | null>(null)
const contentWidth = ref(0)
const contentHeight = ref(0)
let resizeObserver: ResizeObserver | null = null
let resizeNotifyTimer: ReturnType<typeof setTimeout> | null = null

const activeSession = computed(() => browserStore.activeSession)

const displayTitle = computed(() => activeSession.value?.title || '网页')
const displayUrl = computed(() => currentUrl.value || activeSession.value?.url || '')
const webviewSizeStyle = computed<Record<string, string>>(() => {
	const width = contentWidth.value > 0 ? `${contentWidth.value}px` : '100%'
	const height =
		contentHeight.value > 0 ? `${contentHeight.value}px` : '100%'
	return {
		width,
		height,
		maxWidth: '100%',
		maxHeight: '100%',
		display: 'flex',
		alignItems: 'stretch',
	}
})

const forceWebviewIframeFill = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	const iframe = webview.shadowRoot?.querySelector('iframe')
	if (!(iframe instanceof HTMLIFrameElement)) return
	iframe.style.height = '100%'
	iframe.style.minHeight = '100%'
	iframe.style.flex = '1 1 auto'
}

const enforceInPlaceNavigation = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	void webview
		.executeJavaScript(
			`(() => {
				const KEY = '__codex_in_place_nav_bound__'
				if (window[KEY]) return
				window[KEY] = true
				document.addEventListener('click', (event) => {
					const target = event.target
					if (!(target instanceof Element)) return
					const anchor = target.closest('a[href]')
					if (!(anchor instanceof HTMLAnchorElement)) return
					const href = anchor.getAttribute('href') || ''
					if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return
					event.preventDefault()
					window.location.assign(anchor.href)
				}, true)
				const rawOpen = window.open
				window.open = function (url, ...args) {
					if (typeof url === 'string' && url.trim()) {
						window.location.assign(url)
					}
					return null
				}
				window.__codex_raw_open__ = rawOpen
			})()`,
			true,
		)
		.catch(() => {
			// Ignore execution failures on restricted pages.
		})
}

const syncWebviewSize = (): void => {
	const content = browserContentRef.value
	if (!content) return
	const rect = content.getBoundingClientRect()
	const clientWidth = Math.max(0, Math.floor(content.clientWidth))
	const clientHeight = Math.max(0, Math.floor(content.clientHeight))
	const fallbackWidth = Math.max(0, Math.floor(window.innerWidth - rect.left))
	const fallbackHeight = Math.max(0, Math.floor(window.innerHeight - rect.top))
	contentWidth.value = Math.max(clientWidth, fallbackWidth)
	contentHeight.value = Math.max(clientHeight, fallbackHeight)
	scheduleWebviewResizeNotify()
}

const notifyWebviewResize = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	forceWebviewIframeFill()
	void webview
		.executeJavaScript('window.dispatchEvent(new Event("resize"))', true)
		.catch(() => {
			// Ignore transient errors during navigation/unmount.
		})
}

const scheduleWebviewResizeNotify = (): void => {
	if (resizeNotifyTimer) clearTimeout(resizeNotifyTimer)
	resizeNotifyTimer = setTimeout(() => {
		resizeNotifyTimer = null
		notifyWebviewResize()
	}, 60)
}

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
	currentUrl.value = webview.getURL() || activeSession.value?.url || ''
	browserStore.handleSlotActivated(slotKey)
	syncNavigationState()
}

const onDidNavigate = (): void => {
	syncCurrentMeta()
}

const onNewWindow = (event: Event): void => {
	const webview = webviewRef.value
	if (!webview) return
	const typedEvent = event as Event & {
		url?: string
		preventDefault?: () => void
	}
	typedEvent.preventDefault?.()
	const nextUrl = typedEvent.url?.trim()
	if (!nextUrl) return
	webviewSrc.value = nextUrl
	currentUrl.value = nextUrl
	webview.loadURL(nextUrl)
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
	webview.addEventListener('new-window', onNewWindow)
	webview.addEventListener('dom-ready', forceWebviewIframeFill)
	webview.addEventListener('dom-ready', enforceInPlaceNavigation)
	webview.addEventListener('did-finish-load', forceWebviewIframeFill)
	webview.addEventListener('did-finish-load', enforceInPlaceNavigation)
	webview.addEventListener('page-title-updated', onPageTitleUpdated)
	forceWebviewIframeFill()
	enforceInPlaceNavigation()
	syncNavigationState()
}

const unbindWebviewEvents = (): void => {
	const webview = webviewRef.value
	if (!webview) return
	webview.removeEventListener('did-navigate', onDidNavigate)
	webview.removeEventListener('did-navigate-in-page', onDidNavigate)
	webview.removeEventListener('did-stop-loading', onDidNavigate)
	webview.removeEventListener('new-window', onNewWindow)
	webview.removeEventListener('dom-ready', forceWebviewIframeFill)
	webview.removeEventListener('dom-ready', enforceInPlaceNavigation)
	webview.removeEventListener('did-finish-load', forceWebviewIframeFill)
	webview.removeEventListener('did-finish-load', enforceInPlaceNavigation)
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
		const session = activeSession.value
		webviewSrc.value = session?.url || ''
		currentUrl.value = session?.url || ''
		unbindWebviewEvents()
		await nextTick()
		syncWebviewSize()
		bindWebviewEvents()
	},
	{ immediate: true },
)

onMounted(async () => {
	await nextTick()
	syncWebviewSize()
	if (browserContentRef.value) {
		resizeObserver = new ResizeObserver(() => {
			syncWebviewSize()
		})
		resizeObserver.observe(browserContentRef.value)
	}
	window.addEventListener('resize', syncWebviewSize)
})

onBeforeUnmount(() => {
	unbindWebviewEvents()
	resizeObserver?.disconnect()
	resizeObserver = null
	if (resizeNotifyTimer) {
		clearTimeout(resizeNotifyTimer)
		resizeNotifyTimer = null
	}
	window.removeEventListener('resize', syncWebviewSize)
})
</script>

<style scoped>
.browser-content {
	overflow: hidden;
	height: 100%;
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
	display: block;
	width: 100%;
	height: 100%;
	border: 0;
}
</style>

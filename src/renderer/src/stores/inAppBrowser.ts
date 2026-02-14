import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSidebarSlotStore } from './sidebarSlot'

const MAX_BROWSER_SLOTS = 80
const MAX_BACKGROUND_OBJECTS = 5
const SESSION_EXPIRE_MS = 5 * 60 * 1000
const LIFECYCLE_CHECK_INTERVAL_MS = 30 * 1000

export interface BrowserSession {
	slotKey: string
	url: string
	title: string
	createdAt: number
	lastActiveAt: number
}

interface WebviewRuntimeObject {
	slotKey: string
	lastActiveAt: number
}

const createSlotKey = (): string =>
	`browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalizeUrl = (raw: string): string | null => {
	const input = String(raw || '').trim()
	if (!input) return null
	let url: URL
	try {
		url = new URL(input)
	} catch {
		try {
			url = new URL(`https://${input}`)
		} catch {
			return null
		}
	}
	const protocol = url.protocol.toLowerCase()
	if (protocol !== 'http:' && protocol !== 'https:') return null
	return url.toString()
}

const getTitleFromUrl = (url: string): string => {
	try {
		const parsed = new URL(url)
		return parsed.hostname || '网页'
	} catch {
		return '网页'
	}
}

export const useInAppBrowserStore = defineStore('in-app-browser', () => {
	const sessions = ref<BrowserSession[]>([])
	const webviewRuntimeObjects = ref<WebviewRuntimeObject[]>([])
	let lifecycleTimer: ReturnType<typeof setInterval> | null = null

	const sidebarSlotStore = useSidebarSlotStore()

	const activeSession = computed<BrowserSession | null>(() => {
		const activeKey = sidebarSlotStore.activeSlotKey
		if (!activeKey) return null
		return sessions.value.find((session) => session.slotKey === activeKey) || null
	})

	const removeSession = (slotKey: string): void => {
		sessions.value = sessions.value.filter((session) => session.slotKey !== slotKey)
		webviewRuntimeObjects.value = webviewRuntimeObjects.value.filter(
			(item) => item.slotKey !== slotKey,
		)
	}

	const touchSession = (slotKey: string): void => {
		const target = sessions.value.find((session) => session.slotKey === slotKey)
		if (!target) return
		target.lastActiveAt = Date.now()
	}

	const retainWebviewObject = (slotKey: string): void => {
		const now = Date.now()
		const existed = webviewRuntimeObjects.value.find(
			(item) => item.slotKey === slotKey,
		)
		if (existed) {
			existed.lastActiveAt = now
		} else {
			webviewRuntimeObjects.value.push({
				slotKey,
				lastActiveAt: now,
			})
		}
	}

	const trimRuntimeObjects = (): void => {
		const now = Date.now()
		const activeKey = sidebarSlotStore.activeSlotKey
		const filteredByTtl = webviewRuntimeObjects.value.filter(
			(item) =>
				item.slotKey === activeKey ||
				now - item.lastActiveAt <= SESSION_EXPIRE_MS,
		)

		const sortedByRecent = [...filteredByTtl].sort(
			(a, b) => b.lastActiveAt - a.lastActiveAt,
		)
		const keepSet = new Set<string>(
			sortedByRecent
				.slice(0, MAX_BACKGROUND_OBJECTS)
				.map((item) => item.slotKey),
		)
		if (activeKey) {
			keepSet.add(activeKey)
		}
		webviewRuntimeObjects.value = filteredByTtl.filter((item) =>
			keepSet.has(item.slotKey),
		)
	}

	const enforceSlotLimit = (): void => {
		if (sessions.value.length <= MAX_BROWSER_SLOTS) return
		const sortedByOldest = [...sessions.value].sort(
			(a, b) => a.createdAt - b.createdAt,
		)
		const toRemove = sortedByOldest.slice(
			0,
			sessions.value.length - MAX_BROWSER_SLOTS,
		)
		toRemove.forEach((item) => {
			removeSession(item.slotKey)
			sidebarSlotStore.removeSlot(item.slotKey)
		})
	}

	const updateSessionMeta = (
		slotKey: string,
		payload: {
			url?: string
			title?: string
		},
	): void => {
		const target = sessions.value.find((session) => session.slotKey === slotKey)
		if (!target) return
		if (payload.url) {
			const normalized = normalizeUrl(payload.url)
			if (normalized) {
				target.url = normalized
			}
		}
		if (typeof payload.title === 'string' && payload.title.trim()) {
			target.title = payload.title.trim()
		}
		touchSession(slotKey)
		retainWebviewObject(slotKey)

		sidebarSlotStore.openSlot({
			slotKey,
			title: target.title,
			componentKey: 'in-app-browser',
			icon: 'web',
		})
	}

	const openUrl = (rawUrl: string): BrowserSession | null => {
		const normalized = normalizeUrl(rawUrl)
		if (!normalized) return null

		const slotKey = createSlotKey()
		const now = Date.now()
		const title = getTitleFromUrl(normalized)
		const session: BrowserSession = {
			slotKey,
			url: normalized,
			title,
			createdAt: now,
			lastActiveAt: now,
		}

		sessions.value.push(session)
		retainWebviewObject(slotKey)
		sidebarSlotStore.openSlot({
			slotKey,
			title,
			componentKey: 'in-app-browser',
			icon: 'web',
		})
		trimRuntimeObjects()
		enforceSlotLimit()
		return session
	}

	const handleSlotActivated = (slotKey: string): void => {
		if (!sessions.value.some((item) => item.slotKey === slotKey)) return
		touchSession(slotKey)
		retainWebviewObject(slotKey)
		trimRuntimeObjects()
	}

	const handleSlotRemoved = (slotKey: string): void => {
		removeSession(slotKey)
	}

	const runtimeObjectSlotKeys = computed<string[]>(() =>
		webviewRuntimeObjects.value.map((item) => item.slotKey),
	)

	const isRuntimeObjectRetained = (slotKey: string): boolean => {
		return webviewRuntimeObjects.value.some((item) => item.slotKey === slotKey)
	}

	const startLifecycleManager = (): void => {
		if (lifecycleTimer) return
		lifecycleTimer = setInterval(() => {
			trimRuntimeObjects()
		}, LIFECYCLE_CHECK_INTERVAL_MS)
	}

	const stopLifecycleManager = (): void => {
		if (!lifecycleTimer) return
		clearInterval(lifecycleTimer)
		lifecycleTimer = null
	}

	return {
		sessions,
		activeSession,
		openUrl,
		updateSessionMeta,
		handleSlotActivated,
		handleSlotRemoved,
		runtimeObjectSlotKeys,
		isRuntimeObjectRetained,
		startLifecycleManager,
		stopLifecycleManager,
	}
})

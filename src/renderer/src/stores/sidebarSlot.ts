import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type SidebarSlotIcon =
	| 'user'
	| 'chat'
	| 'moments'
	| 'setting'
	| 'web'
	| 'cloudDocs'

export interface SidebarSlotDefinition {
	slotKey: string
	title: string
	componentKey: string
	icon: SidebarSlotIcon
}

export interface SidebarSlotItem extends SidebarSlotDefinition {
	createdAt: number
}

const SIDEBAR_SLOT_CACHE_KEY = 'sidebar-slot-cache:v1'

interface SidebarSlotCachePayload {
	slots: SidebarSlotItem[]
	activeSlotKey: string | null
}

export const useSidebarSlotStore = defineStore('sidebarSlot', () => {
	const slots = ref<SidebarSlotItem[]>([])
	const activeSlotKey = ref<string | null>(null)

	const activeSlot = computed<SidebarSlotItem | null>(() => {
		if (!activeSlotKey.value) return null
		return slots.value.find((slot) => slot.slotKey === activeSlotKey.value) || null
	})

	const hydrateFromCache = (): void => {
		try {
			const raw = window.localStorage.getItem(SIDEBAR_SLOT_CACHE_KEY)
			if (!raw) return
			const payload = JSON.parse(raw) as Partial<SidebarSlotCachePayload>
			const cachedSlots = Array.isArray(payload.slots) ? payload.slots : []
			const normalized = cachedSlots
				.filter(
					(item): item is SidebarSlotItem =>
						!!item &&
						typeof item.slotKey === 'string' &&
						typeof item.title === 'string' &&
						typeof item.componentKey === 'string' &&
						typeof item.icon === 'string',
				)
				.map((item) => ({
					slotKey: item.slotKey,
					title: item.title,
					componentKey: item.componentKey,
					icon: item.icon,
					createdAt: Number.isFinite(item.createdAt)
						? Number(item.createdAt)
						: Date.now(),
				}))
			slots.value = normalized
			const cachedActiveKey =
				typeof payload.activeSlotKey === 'string'
					? payload.activeSlotKey
					: null
			activeSlotKey.value =
				cachedActiveKey &&
				normalized.some((item) => item.slotKey === cachedActiveKey)
					? cachedActiveKey
					: null
		} catch {
			slots.value = []
			activeSlotKey.value = null
		}
	}

	const persistToCache = (): void => {
		const payload: SidebarSlotCachePayload = {
			slots: slots.value,
			activeSlotKey: activeSlotKey.value,
		}
		window.localStorage.setItem(
			SIDEBAR_SLOT_CACHE_KEY,
			JSON.stringify(payload),
		)
	}

	const upsertSlot = (definition: SidebarSlotDefinition): SidebarSlotItem => {
		const existed = slots.value.find((slot) => slot.slotKey === definition.slotKey)
		if (existed) {
			// 差异更新：只变更发生变化的字段，减少不必要的响应式更新
			if (existed.title !== definition.title) existed.title = definition.title
			if (existed.icon !== definition.icon) existed.icon = definition.icon
			if (existed.componentKey !== definition.componentKey) {
				existed.componentKey = definition.componentKey
			}
			return existed
		}

		const next: SidebarSlotItem = {
			...definition,
			createdAt: Date.now(),
		}
		slots.value.push(next)
		return next
	}

	const openSlot = (definition: SidebarSlotDefinition): SidebarSlotItem => {
		const slot = upsertSlot(definition)
		activeSlotKey.value = slot.slotKey
		return slot
	}

	const activateSlot = (slotKey: string): void => {
		if (slots.value.some((slot) => slot.slotKey === slotKey)) {
			activeSlotKey.value = slotKey
		}
	}

	const removeSlot = (slotKey: string): void => {
		slots.value = slots.value.filter((slot) => slot.slotKey !== slotKey)
		if (activeSlotKey.value === slotKey) {
			activeSlotKey.value = null
		}
	}

	const clearActiveSlot = (): void => {
		activeSlotKey.value = null
	}

	hydrateFromCache()
	watch([slots, activeSlotKey], persistToCache, { deep: true })

	return {
		slots,
		activeSlotKey,
		activeSlot,
		openSlot,
		activateSlot,
		removeSlot,
		clearActiveSlot,
	}
})

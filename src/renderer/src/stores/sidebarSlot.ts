import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type SidebarSlotIcon = 'user' | 'chat' | 'moments' | 'setting'

export interface SidebarSlotDefinition {
	slotKey: string
	title: string
	componentKey: string
	icon: SidebarSlotIcon
}

export interface SidebarSlotItem extends SidebarSlotDefinition {
	createdAt: number
}

export const useSidebarSlotStore = defineStore('sidebarSlot', () => {
	const slots = ref<SidebarSlotItem[]>([])
	const activeSlotKey = ref<string | null>(null)

	const activeSlot = computed<SidebarSlotItem | null>(() => {
		if (!activeSlotKey.value) return null
		return slots.value.find((slot) => slot.slotKey === activeSlotKey.value) || null
	})

	const upsertSlot = (definition: SidebarSlotDefinition): SidebarSlotItem => {
		const existed = slots.value.find((slot) => slot.slotKey === definition.slotKey)
		if (existed) {
			existed.title = definition.title
			existed.icon = definition.icon
			existed.componentKey = definition.componentKey
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

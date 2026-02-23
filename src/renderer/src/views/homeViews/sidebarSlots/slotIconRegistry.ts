import { markRaw, type Component } from 'vue'
import {
	Chatbubbles,
	Person,
	Aperture,
	Settings,
	Globe,
	DocumentText,
} from '@vicons/ionicons5'

export interface SidebarSlotIconMap {
	[iconKey: string]: Component
}

const sidebarSlotIconMap: SidebarSlotIconMap = {
	user: markRaw(Person),
	chat: markRaw(Chatbubbles),
	moments: markRaw(Aperture),
	setting: markRaw(Settings),
	web: markRaw(Globe),
	cloudDocs: markRaw(DocumentText),
}

export const registerSidebarSlotIcon = (
	iconKey: string,
	iconComponent: Component,
): void => {
	const key = String(iconKey || '').trim()
	if (!key) return
	sidebarSlotIconMap[key] = markRaw(iconComponent)
}

export const registerSidebarSlotIcons = (
	iconMap: SidebarSlotIconMap,
): void => {
	Object.entries(iconMap).forEach(([iconKey, component]) => {
		registerSidebarSlotIcon(iconKey, component)
	})
}

export const getSidebarSlotIcon = (
	iconKey: string,
): Component | null => {
	const key = String(iconKey || '').trim()
	if (!key) return null
	return sidebarSlotIconMap[key] || null
}

export const getSidebarSlotIconMap = (): Readonly<SidebarSlotIconMap> => {
	return sidebarSlotIconMap
}

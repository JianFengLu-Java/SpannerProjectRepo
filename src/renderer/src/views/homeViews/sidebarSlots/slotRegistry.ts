import { markRaw, type Component } from 'vue'
import MyProfileCardSlot from './MyProfileCardSlot.vue'
import InAppBrowserSlot from './InAppBrowserSlot.vue'

export const sidebarSlotComponentMap: Record<string, Component> = {
	'profile-card': markRaw(MyProfileCardSlot),
	'in-app-browser': markRaw(InAppBrowserSlot),
}

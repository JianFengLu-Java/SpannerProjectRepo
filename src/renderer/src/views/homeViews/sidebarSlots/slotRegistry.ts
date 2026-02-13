import type { Component } from 'vue'
import MyProfileCardSlot from './MyProfileCardSlot.vue'

export const sidebarSlotComponentMap: Record<string, Component> = {
	'profile-card': MyProfileCardSlot,
}

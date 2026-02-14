import { defineStore } from 'pinia'
import { ref } from 'vue'

export type MessageReminderDisplayType = 'detail' | 'sender' | 'summary'

export const useAppSettingsStore = defineStore(
	'app-settings',
	() => {
		const compactMode = ref(false)
		const notificationsEnabled = ref(true)
		const messageReminderDisplayType = ref<MessageReminderDisplayType>(
			'detail',
		)
		const routeLinksThroughSidebarWebview = ref(false)

		return {
			compactMode,
			notificationsEnabled,
			messageReminderDisplayType,
			routeLinksThroughSidebarWebview,
		}
	},
	{
		persist: {
			key: 'app-settings',
			storage: window.localStorage,
		},
	},
)


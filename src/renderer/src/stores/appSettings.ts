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

		return {
			compactMode,
			notificationsEnabled,
			messageReminderDisplayType,
		}
	},
	{
		persist: {
			key: 'app-settings',
			storage: window.localStorage,
		},
	},
)


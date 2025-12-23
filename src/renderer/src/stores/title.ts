import { defineStore } from 'pinia'

export const useTitleStore = defineStore('title', {
	state: () => ({
		title: 'Spanner Tools',
	}),
	actions: {
		setTitle(newTitle: string) {
			this.title = newTitle
			document.title = newTitle
		},
	},
})

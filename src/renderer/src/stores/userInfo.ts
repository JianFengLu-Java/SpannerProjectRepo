import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserInfoStore = defineStore(
	'userInfo',
	() => {
		const userName = ref('')
		const gender = ref('')
		const email = ref('')
		const avatarUrl = ref('')

		function setUserInfo(info: {
			userName: string
			gender: string
			email: string
			avatarUrl: string
		}): void {
			userName.value = info.userName
			gender.value = info.gender
			email.value = info.email
			avatarUrl.value = info.avatarUrl
		}

		function logout(): void {
			userName.value = ''
			gender.value = ''
			email.value = ''
			avatarUrl.value = ''
		}

		return {
			userName,
			gender,
			email,
			avatarUrl,
			setUserInfo,
			logout,
		}
	},
	{
		persist: {
			key: 'userInfo',
			storage: window.localStorage, // Electron Renderer 可用
		},
	},
)

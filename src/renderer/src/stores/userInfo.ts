import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tokenManager } from '@renderer/services/tokenManager'

export const useUserInfoStore = defineStore(
	'userInfo',
	() => {
		const resolveAccountFromToken = (token: string): string => {
			try {
				const parts = token.split('.')
				if (parts.length < 2) return ''
				const payload = parts[1]
					.replace(/-/g, '+')
					.replace(/_/g, '/')
					.padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
				const decoded = JSON.parse(atob(payload)) as { sub?: string }
				return decoded.sub || ''
			} catch {
				return ''
			}
		}

		const account = ref('')
		const userName = ref('')
		const gender = ref('')
		const email = ref('')
		const avatarUrl = ref('')
		const userToken = ref('')

		function setUserInfo(
			info: {
				account?: string
				realName: string
				gender: string
				email: string
				avatarUrl: string
			},
			token: string,
		): void {
			account.value = info.account || resolveAccountFromToken(token)
			userName.value = info.realName
			gender.value = info.gender
			email.value = info.email
			avatarUrl.value = info.avatarUrl
			userToken.value = token
			window.localStorage.setItem('token', token)
		}

		function logout(): void {
			account.value = ''
			userName.value = ''
			gender.value = ''
			email.value = ''
			avatarUrl.value = ''
			userToken.value = ''
			tokenManager.clear()
		}

		return {
			account,
			userName,
			gender,
			email,
			avatarUrl,
			userToken,
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

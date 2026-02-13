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
		const phone = ref('')
		const address = ref('')
		const age = ref<number | null>(null)
		const userToken = ref('')

		interface UserInfoPayload {
			account?: string
			realName?: string
			gender?: string
			email?: string
			avatarUrl?: string
			phone?: string
			address?: string
			age?: number | null
		}

		function setUserInfo(
			info: UserInfoPayload,
			token: string,
		): void {
			account.value = info.account || resolveAccountFromToken(token)
			userName.value = info.realName || ''
			gender.value = info.gender || ''
			email.value = info.email || ''
			avatarUrl.value = info.avatarUrl || ''
			phone.value = info.phone || ''
			address.value = info.address || ''
			age.value =
				typeof info.age === 'number' && Number.isFinite(info.age)
					? info.age
					: null
			userToken.value = token
			window.localStorage.setItem('token', token)
		}

		function patchUserInfo(patch: UserInfoPayload): void {
			if (typeof patch.account === 'string') {
				account.value = patch.account
			}
			if (typeof patch.realName === 'string') {
				userName.value = patch.realName
			}
			if (typeof patch.gender === 'string') {
				gender.value = patch.gender
			}
			if (typeof patch.email === 'string') {
				email.value = patch.email
			}
			if (typeof patch.avatarUrl === 'string') {
				avatarUrl.value = patch.avatarUrl
			}
			if (typeof patch.phone === 'string') {
				phone.value = patch.phone
			}
			if (typeof patch.address === 'string') {
				address.value = patch.address
			}
			if (
				patch.age === null ||
				(typeof patch.age === 'number' && Number.isFinite(patch.age))
			) {
				age.value = patch.age
			}
		}

		function logout(): void {
			account.value = ''
			userName.value = ''
			gender.value = ''
			email.value = ''
			avatarUrl.value = ''
			phone.value = ''
			address.value = ''
			age.value = null
			userToken.value = ''
			tokenManager.clear()
		}

		return {
			account,
			userName,
			gender,
			email,
			avatarUrl,
			phone,
			address,
			age,
			userToken,
			setUserInfo,
			patchUserInfo,
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

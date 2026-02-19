import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tokenManager } from '@renderer/services/tokenManager'
import request from '@renderer/utils/request'

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
		const userId = ref<number | null>(null)
		const userName = ref('')
		const gender = ref('')
		const email = ref('')
		const avatarUrl = ref('')
		const phone = ref('')
		const address = ref('')
		const signature = ref('')
		const age = ref<number | null>(null)
		const userToken = ref('')
		const vipActive = ref(false)
		const vipExpireAt = ref('')
		const growthValue = ref(0)
		const userLevel = ref(1)
		const nextLevelGrowth = ref(0)

		interface UserInfoPayload {
			id?: number | string
			userId?: number | string
			userID?: number | string
			uid?: number | string
			account?: string
			realName?: string
			gender?: string
			email?: string
			avatarUrl?: string
			phone?: string
			address?: string
			signature?: string
			age?: number | null
			vipActive?: boolean
			isVip?: boolean
			vipExpireAt?: string
			growthValue?: number
			userLevel?: number
			vipLevel?: number
			nextLevelGrowth?: number
			userInfo?: {
				id?: number | string
				userId?: number | string
				userID?: number | string
				uid?: number | string
				account?: string
				realName?: string
				gender?: string
				email?: string
				avatarUrl?: string
				phone?: string
				address?: string
				signature?: string
				age?: number | null
				vipActive?: boolean
				isVip?: boolean
				vipExpireAt?: string
				growthValue?: number
				userLevel?: number
				vipLevel?: number
				nextLevelGrowth?: number
			}
		}

		const parseUserId = (value: unknown): number | null => {
			if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
				return Math.floor(value)
			}
			if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
				const parsed = Number(value.trim())
				if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
			}
			return null
		}

		function setUserInfo(
			info: UserInfoPayload,
			token: string,
		): void {
			const profile = info.userInfo || info
			userId.value =
				parseUserId(profile.userId) ??
				parseUserId(profile.userID) ??
				parseUserId(profile.uid) ??
				parseUserId(profile.id) ??
				parseUserId(info.userId) ??
				parseUserId(info.userID) ??
				parseUserId(info.uid) ??
				parseUserId(info.id)
			account.value =
				profile.account || info.account || resolveAccountFromToken(token)
			userName.value = profile.realName || info.realName || ''
			gender.value = profile.gender || info.gender || ''
			email.value = profile.email || info.email || ''
			avatarUrl.value = profile.avatarUrl || info.avatarUrl || ''
			phone.value = profile.phone || info.phone || ''
			address.value = profile.address || info.address || ''
			signature.value = profile.signature || info.signature || ''
			age.value =
				typeof profile.age === 'number' && Number.isFinite(profile.age)
					? profile.age
					: typeof info.age === 'number' && Number.isFinite(info.age)
						? info.age
					: null
			vipActive.value =
				typeof profile.vipActive === 'boolean'
					? profile.vipActive
					: typeof profile.isVip === 'boolean'
						? profile.isVip
					: typeof info.vipActive === 'boolean'
						? info.vipActive
						: typeof info.isVip === 'boolean'
							? info.isVip
						: Boolean(
								(typeof profile.vipExpireAt === 'string' &&
									profile.vipExpireAt) ||
									(typeof info.vipExpireAt === 'string' &&
										info.vipExpireAt),
							)
			vipExpireAt.value =
				typeof profile.vipExpireAt === 'string'
					? profile.vipExpireAt
					: typeof info.vipExpireAt === 'string'
						? info.vipExpireAt
						: ''
			growthValue.value =
				typeof profile.growthValue === 'number' &&
				Number.isFinite(profile.growthValue)
					? Math.max(0, Math.floor(profile.growthValue))
					: typeof info.growthValue === 'number' &&
						  Number.isFinite(info.growthValue)
						? Math.max(0, Math.floor(info.growthValue))
						: 0
			userLevel.value =
				typeof profile.userLevel === 'number' &&
				Number.isFinite(profile.userLevel)
					? Math.max(1, Math.floor(profile.userLevel))
					: typeof profile.vipLevel === 'number' &&
						  Number.isFinite(profile.vipLevel)
						? Math.max(1, Math.floor(profile.vipLevel))
					: typeof info.userLevel === 'number' &&
						  Number.isFinite(info.userLevel)
						? Math.max(1, Math.floor(info.userLevel))
						: typeof info.vipLevel === 'number' &&
							  Number.isFinite(info.vipLevel)
							? Math.max(1, Math.floor(info.vipLevel))
						: 1
			nextLevelGrowth.value =
				typeof profile.nextLevelGrowth === 'number' &&
				Number.isFinite(profile.nextLevelGrowth)
					? Math.max(0, Math.floor(profile.nextLevelGrowth))
					: typeof info.nextLevelGrowth === 'number' &&
						  Number.isFinite(info.nextLevelGrowth)
						? Math.max(0, Math.floor(info.nextLevelGrowth))
						: 0
			userToken.value = token
			window.localStorage.setItem('token', token)
		}

		function patchUserInfo(patch: UserInfoPayload): void {
			const nextUserId =
				parseUserId(patch.userId) ??
				parseUserId(patch.userID) ??
				parseUserId(patch.uid) ??
				parseUserId(patch.id)
			if (typeof nextUserId === 'number') {
				userId.value = nextUserId
			}
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
			if (typeof patch.signature === 'string') {
				signature.value = patch.signature
			}
			if (
				patch.age === null ||
				(typeof patch.age === 'number' && Number.isFinite(patch.age))
			) {
				age.value = patch.age
			}
			if (typeof patch.vipActive === 'boolean') {
				vipActive.value = patch.vipActive
			}
			if (typeof patch.isVip === 'boolean') {
				vipActive.value = patch.isVip
			}
			if (typeof patch.vipExpireAt === 'string') {
				vipExpireAt.value = patch.vipExpireAt
			}
			if (
				typeof patch.growthValue === 'number' &&
				Number.isFinite(patch.growthValue)
			) {
				growthValue.value = Math.max(0, Math.floor(patch.growthValue))
			}
			if (
				typeof patch.userLevel === 'number' &&
				Number.isFinite(patch.userLevel)
			) {
				userLevel.value = Math.max(1, Math.floor(patch.userLevel))
			}
			if (
				typeof patch.vipLevel === 'number' &&
				Number.isFinite(patch.vipLevel)
			) {
				userLevel.value = Math.max(1, Math.floor(patch.vipLevel))
			}
			if (
				typeof patch.nextLevelGrowth === 'number' &&
				Number.isFinite(patch.nextLevelGrowth)
			) {
				nextLevelGrowth.value = Math.max(
					0,
					Math.floor(patch.nextLevelGrowth),
				)
			}
		}

		function logout(): void {
			account.value = ''
			userId.value = null
			userName.value = ''
			gender.value = ''
			email.value = ''
			avatarUrl.value = ''
			phone.value = ''
			address.value = ''
			signature.value = ''
			age.value = null
			userToken.value = ''
			vipActive.value = false
			vipExpireAt.value = ''
			growthValue.value = 0
			userLevel.value = 1
			nextLevelGrowth.value = 0
			tokenManager.clear()
		}

		async function refreshCurrentUser(): Promise<void> {
			const response = await request.get('/user/me')
			const payload = response?.data as
				| {
						user?: UserInfoPayload
						data?: { user?: UserInfoPayload } | UserInfoPayload
				  }
				| undefined
			const source =
				payload?.user ||
				(typeof payload?.data === 'object' &&
				payload?.data &&
				'user' in payload.data
					? (payload.data as { user?: UserInfoPayload }).user
					: undefined) ||
				(typeof payload?.data === 'object'
					? (payload.data as UserInfoPayload)
					: undefined)
			if (!source) return
			patchUserInfo(source)
		}

		return {
			account,
			userId,
			userName,
			gender,
			email,
			avatarUrl,
			phone,
			address,
			signature,
			age,
			userToken,
			vipActive,
			vipExpireAt,
			growthValue,
			userLevel,
			nextLevelGrowth,
			setUserInfo,
			patchUserInfo,
			refreshCurrentUser,
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

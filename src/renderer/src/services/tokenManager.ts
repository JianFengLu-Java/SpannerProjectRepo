import axios from 'axios'

interface TokenBundle {
	token: string
	refreshToken: string
	accessTokenExpiresIn?: number | null
}

interface StoredTokenState {
	accessToken: string
	refreshToken: string
	accessTokenExpiresAt: number | null
}

const TOKEN_STATE_KEY = 'authTokenState'
let refreshPromise: Promise<string> | null = null
let refreshTimer: number | null = null
const tokenUpdateListeners = new Set<(token: string) => void>()
const tokenClearListeners = new Set<() => void>()

const normalizeToken = (token: string): string => {
	const trimmed = token.trim()
	if (!trimmed) return ''
	const raw = trimmed.replace(/^Bearer\s+/i, '').trim()
	return raw
}

const parseJwtExp = (token: string): number | null => {
	try {
		const parts = token.split('.')
		if (parts.length < 2) return null
		const payload = parts[1]
			.replace(/-/g, '+')
			.replace(/_/g, '/')
			.padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
		const decoded = JSON.parse(atob(payload)) as { exp?: number }
		return decoded.exp ? decoded.exp * 1000 : null
	} catch {
		return null
	}
}

const saveState = (state: StoredTokenState): void => {
	window.localStorage.setItem(TOKEN_STATE_KEY, JSON.stringify(state))
	window.localStorage.setItem('token', state.accessToken)
	window.localStorage.setItem('refreshToken', state.refreshToken)
}

const readState = (): StoredTokenState | null => {
	const raw = window.localStorage.getItem(TOKEN_STATE_KEY)
	if (raw) {
		try {
			const parsed = JSON.parse(raw) as StoredTokenState
			if (parsed.accessToken && parsed.refreshToken) {
				return {
					accessToken: normalizeToken(parsed.accessToken),
					refreshToken: normalizeToken(parsed.refreshToken),
					accessTokenExpiresAt: parsed.accessTokenExpiresAt || null,
				}
			}
		} catch {
			// fall through
		}
	}

	const legacyToken = normalizeToken(window.localStorage.getItem('token') || '')
	const legacyRefresh = normalizeToken(
		window.localStorage.getItem('refreshToken') || '',
	)
	if (!legacyToken || !legacyRefresh) return null
	return {
		accessToken: legacyToken,
		refreshToken: legacyRefresh,
		accessTokenExpiresAt: parseJwtExp(legacyToken),
	}
}

const isExpired = (expiresAt: number | null, skewMs = 30_000): boolean => {
	if (!expiresAt) return false
	return Date.now() + skewMs >= expiresAt
}

const emitTokenUpdated = (token: string): void => {
	tokenUpdateListeners.forEach((listener) => {
		try {
			listener(token)
		} catch (error) {
			console.warn('token updated listener error', error)
		}
	})
}

const emitTokenCleared = (): void => {
	tokenClearListeners.forEach((listener) => {
		try {
			listener()
		} catch (error) {
			console.warn('token clear listener error', error)
		}
	})
}

const clearRefreshTimer = (): void => {
	if (refreshTimer) {
		clearTimeout(refreshTimer)
		refreshTimer = null
	}
}

const scheduleRefresh = (): void => {
	clearRefreshTimer()
	const state = readState()
	if (!state?.refreshToken || !state.accessTokenExpiresAt) return

	const refreshAheadMs = 60_000
	const delay = Math.max(
		5_000,
		state.accessTokenExpiresAt - Date.now() - refreshAheadMs,
	)

	refreshTimer = window.setTimeout(() => {
		void tokenManager.refreshAccessToken().catch(() => {
			// 刷新失败由 refreshAccessToken 内部处理（清理并通知）
		})
	}, delay)
}

export const tokenManager = {
	init(): void {
		const state = readState()
		if (!state?.accessToken || !state.refreshToken) return

		// 规范化并回写，确保兼容历史存储
		saveState(state)
		emitTokenUpdated(state.accessToken)
		scheduleRefresh()

		// 启动时如果已过期，立即尝试刷新一次
		if (isExpired(state.accessTokenExpiresAt, 0)) {
			void this.refreshAccessToken().catch(() => {
				// 已在 refresh 中处理清理
			})
		}
	},

	setTokenBundle(bundle: TokenBundle): void {
		const accessToken = normalizeToken(bundle.token || '')
		const refreshToken = normalizeToken(bundle.refreshToken || '')
		if (!accessToken || !refreshToken) return

		const expiresAt =
			typeof bundle.accessTokenExpiresIn === 'number' &&
			bundle.accessTokenExpiresIn > 0
				? Date.now() + bundle.accessTokenExpiresIn * 1000
				: parseJwtExp(accessToken)

		saveState({
			accessToken,
			refreshToken,
			accessTokenExpiresAt: expiresAt,
		})
		emitTokenUpdated(accessToken)
		scheduleRefresh()
	},

	getAccessToken(): string {
		return readState()?.accessToken || ''
	},

	getRefreshToken(): string {
		return readState()?.refreshToken || ''
	},

	clear(): void {
		clearRefreshTimer()
		window.localStorage.removeItem(TOKEN_STATE_KEY)
		window.localStorage.removeItem('token')
		window.localStorage.removeItem('refreshToken')
		emitTokenCleared()
	},

	async getValidAccessToken(): Promise<string> {
		const state = readState()
		if (!state) return ''
		if (!isExpired(state.accessTokenExpiresAt)) return state.accessToken
		return this.refreshAccessToken()
	},

	async refreshAccessToken(): Promise<string> {
		if (refreshPromise) return refreshPromise

		const state = readState()
		if (!state?.refreshToken) {
			this.clear()
			throw new Error('refresh token missing')
		}

		const refreshClient = axios.create({
			baseURL: import.meta.env.VITE_API_URL,
			timeout: 10000,
		})

		refreshPromise = refreshClient
			.post('/user/refresh', {
				refreshToken: state.refreshToken,
			})
			.then((res) => {
				const data = res.data as TokenBundle
				this.setTokenBundle(data)
				const nextToken = this.getAccessToken()
				if (!nextToken) throw new Error('refresh token invalid response')
				return nextToken
			})
			.catch((error) => {
				this.clear()
				throw error
			})
			.finally(() => {
				refreshPromise = null
			})

		return refreshPromise
	},

	onTokenUpdated(listener: (token: string) => void): () => void {
		tokenUpdateListeners.add(listener)
		return () => {
			tokenUpdateListeners.delete(listener)
		}
	},

	onTokenCleared(listener: () => void): () => void {
		tokenClearListeners.add(listener)
		return () => {
			tokenClearListeners.delete(listener)
		}
	},
}

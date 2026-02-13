import axios from 'axios'

interface TokenBundle {
	token: string
	refreshToken: string
	accessTokenExpiresIn?: number | string | null
}

interface StoredTokenState {
	accessToken: string
	refreshToken: string
	accessTokenExpiresAt: number | null
}

const TOKEN_STATE_KEY = 'authTokenState'
const REFRESH_AHEAD_MS = 60_000
const HOURLY_REFRESH_INTERVAL_MS = 60 * 60 * 1000
let refreshPromise: Promise<string> | null = null
let refreshTimer: number | null = null
const tokenUpdateListeners = new Set<(token: string) => void>()
const tokenClearListeners = new Set<() => void>()
const TOKEN_REFRESH_DEBUG_KEY = 'token-refresh-debug'

const shouldLogTokenRefreshDebug = (): boolean => {
	if (!import.meta.env.DEV) return false
	try {
		const setting = window.localStorage.getItem(TOKEN_REFRESH_DEBUG_KEY)
		return setting !== '0'
	} catch {
		return true
	}
}

const logTokenRefreshDebug = (
	message: string,
	payload?: Record<string, unknown>,
): void => {
	if (!shouldLogTokenRefreshDebug()) return
	if (payload) {
		console.info(`[token-refresh-debug] ${message}`, payload)
		return
	}
	console.info(`[token-refresh-debug] ${message}`)
}

const normalizeToken = (token: string): string => {
	const trimmed = token.trim()
	if (!trimmed) return ''
	const raw = trimmed.replace(/^Bearer\s+/i, '').trim()
	return raw
}

const parseExpiresIn = (
	expiresIn: number | string | null | undefined,
): number | null => {
	if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
		return expiresIn
	}
	if (typeof expiresIn === 'string') {
		const parsed = Number(expiresIn)
		if (Number.isFinite(parsed) && parsed > 0) return parsed
	}
	return null
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

const isExpiringSoon = (expiresAt: number | null, skewMs = 30_000): boolean => {
	if (!expiresAt) return false
	return Date.now() + skewMs >= expiresAt
}

const extractTokenBundle = (payload: unknown): TokenBundle | null => {
	if (!payload || typeof payload !== 'object') return null
	const source = payload as Record<string, unknown>
	const rawData = source.data
	const nested =
		rawData && typeof rawData === 'object'
			? (rawData as Record<string, unknown>)
			: null

	const token =
		(typeof source.token === 'string' && source.token) ||
		(typeof nested?.token === 'string' && nested.token) ||
		''
	const refreshToken =
		(typeof source.refreshToken === 'string' && source.refreshToken) ||
		(typeof nested?.refreshToken === 'string' && nested.refreshToken) ||
		''

	const accessTokenExpiresIn =
		typeof source.accessTokenExpiresIn === 'number' ||
		typeof source.accessTokenExpiresIn === 'string'
			? (source.accessTokenExpiresIn as number | string)
			: typeof nested?.accessTokenExpiresIn === 'number' ||
				  typeof nested?.accessTokenExpiresIn === 'string'
				? (nested.accessTokenExpiresIn as number | string)
				: null

	if (!token || !refreshToken) return null
	return {
		token,
		refreshToken,
		accessTokenExpiresIn,
	}
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
	if (refreshTimer !== null) {
		clearTimeout(refreshTimer)
		refreshTimer = null
	}
}

const scheduleRefresh = (): void => {
	clearRefreshTimer()
	const state = readState()
	if (!state?.refreshToken) {
		logTokenRefreshDebug('skip schedule refresh: missing refresh token')
		return
	}

	const expiresDelay =
		typeof state.accessTokenExpiresAt === 'number'
			? state.accessTokenExpiresAt - Date.now() - REFRESH_AHEAD_MS
			: Number.POSITIVE_INFINITY
	const delay = Math.max(
		5_000,
		Math.min(HOURLY_REFRESH_INTERVAL_MS, expiresDelay),
	)
	logTokenRefreshDebug('schedule refresh', {
		delayMs: delay,
		expiresAt: state.accessTokenExpiresAt,
		refreshAheadMs: REFRESH_AHEAD_MS,
		hourlyIntervalMs: HOURLY_REFRESH_INTERVAL_MS,
	})

	refreshTimer = window.setTimeout(() => {
		logTokenRefreshDebug('refresh timer fired')
		void tokenManager.refreshAccessToken().catch(() => {
			// 刷新失败由 refreshAccessToken 内部处理（清理并通知）
		})
	}, delay)
}

export const tokenManager = {
	init(): void {
		const state = readState()
		if (!state?.accessToken || !state.refreshToken) {
			logTokenRefreshDebug('init skipped: missing stored token state')
			return
		}

		// 规范化并回写，确保兼容历史存储
		saveState(state)
		logTokenRefreshDebug('init with stored state', {
			hasExpiresAt: !!state.accessTokenExpiresAt,
			expiringSoon: isExpiringSoon(
				state.accessTokenExpiresAt,
				REFRESH_AHEAD_MS,
			),
		})
		emitTokenUpdated(state.accessToken)
		scheduleRefresh()

		// 启动时如果即将过期，立即尝试刷新一次
		if (isExpiringSoon(state.accessTokenExpiresAt, REFRESH_AHEAD_MS)) {
			void this.refreshAccessToken().catch(() => {
				// 已在 refresh 中处理清理
			})
		}
	},

	setTokenBundle(bundle: TokenBundle): void {
		const accessToken = normalizeToken(bundle.token || '')
		const refreshToken = normalizeToken(bundle.refreshToken || '')
		if (!accessToken || !refreshToken) return

		const expiresInSeconds = parseExpiresIn(bundle.accessTokenExpiresIn)
		const expiresAt =
			typeof expiresInSeconds === 'number'
				? Date.now() + expiresInSeconds * 1000
				: parseJwtExp(accessToken)

		saveState({
			accessToken,
			refreshToken,
			accessTokenExpiresAt: expiresAt,
		})
		logTokenRefreshDebug('set token bundle', {
			hasExpiresAt: !!expiresAt,
			expiresAt,
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
		logTokenRefreshDebug('clear token state')
		emitTokenCleared()
	},

	async getValidAccessToken(): Promise<string> {
		const state = readState()
		if (!state) return ''
		if (!isExpiringSoon(state.accessTokenExpiresAt, REFRESH_AHEAD_MS)) {
			logTokenRefreshDebug('reuse current access token')
			return state.accessToken
		}
		logTokenRefreshDebug('access token expiring soon, refreshing')
		return this.refreshAccessToken()
	},

	async refreshAccessToken(): Promise<string> {
		if (refreshPromise) {
			logTokenRefreshDebug('reuse pending refresh promise')
			return refreshPromise
		}

		const state = readState()
		if (!state?.refreshToken) {
			logTokenRefreshDebug('refresh failed: refresh token missing')
			this.clear()
			throw new Error('refresh token missing')
		}

		const refreshClient = axios.create({
			baseURL: import.meta.env.VITE_API_URL,
			timeout: 10000,
		})

		logTokenRefreshDebug('start refresh request')
		refreshPromise = refreshClient
			.post('/user/refresh', {
				refreshToken: state.refreshToken,
			})
			.then((res) => {
				const data = extractTokenBundle(res.data)
				if (!data) throw new Error('refresh token invalid response')
				this.setTokenBundle(data)
				const nextToken = this.getAccessToken()
				if (!nextToken) throw new Error('refresh token invalid response')
				logTokenRefreshDebug('refresh success')
				return nextToken
			})
			.catch((error) => {
				logTokenRefreshDebug('refresh failed', {
					message:
						error instanceof Error
							? error.message
							: typeof error === 'string'
								? error
								: 'unknown error',
				})
				this.clear()
				throw error
			})
			.finally(() => {
				logTokenRefreshDebug('refresh settled')
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

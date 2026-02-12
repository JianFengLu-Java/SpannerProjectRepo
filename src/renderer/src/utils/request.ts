import axios from 'axios'
import { tokenManager } from '@renderer/services/tokenManager'

const server = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	timeout: 10000,
})

const isPublicAuthEndpoint = (url = ''): boolean =>
	url.includes('/user/login') ||
	url.includes('/user/register') ||
	url.includes('/user/refresh')

server.interceptors.request.use(async (config) => {
	try {
		if (isPublicAuthEndpoint(config.url || '')) return config

		const userToken = await tokenManager.getValidAccessToken()
		if (!userToken) return config

		if (
			config.headers &&
			'set' in config.headers &&
			typeof config.headers.set === 'function'
		) {
			config.headers.set('Authorization', `Bearer ${userToken}`)
		} else {
			const headers = axios.AxiosHeaders.from(config.headers)
			headers.set('Authorization', `Bearer ${userToken}`)
			config.headers = headers
		}
	} catch (error) {
		console.warn('token 注入失败，跳过 Authorization', error)
	}

	return config
})

server.interceptors.response.use(
	(response) => response,
	async (error) => {
		const status = error?.response?.status
		const original = error?.config as
			| (typeof error.config & { _retry?: boolean })
			| undefined

		if (!original || status !== 401 || original._retry) {
			return Promise.reject(error)
		}

		if (isPublicAuthEndpoint(original.url || '')) {
			return Promise.reject(error)
		}

		try {
			const nextToken = await tokenManager.refreshAccessToken()
			original._retry = true
			const headers = axios.AxiosHeaders.from(original.headers)
			headers.set('Authorization', `Bearer ${nextToken}`)
			original.headers = headers
			return server(original)
		} catch (refreshError) {
			tokenManager.clear()
			window.localStorage.removeItem('userInfo')
			if (window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.send('logout-open-loginWindow')
			}
			return Promise.reject(refreshError)
		}
	},
)

export default server

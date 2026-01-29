import axios from 'axios'

// 基础 API 配置
const api = axios.create({
	baseURL: 'http://your-backend-api.com/api',
	timeout: 10000,
})

// 请求拦截器：添加 Token 等
api.interceptors.request.use((config) => {
	const token = localStorage.getItem('token')
	if (token) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

export const chatApi = {
	// 获取会话列表
	fetchChats() {
		return api.get('/chats')
	},

	// 获取消息历史
	fetchMessages(chatId: number, lastId?: number) {
		return api.get(`/messages/${chatId}`, { params: { lastId } })
	},

	// 发送消息
	sendMessage(chatId: number, content: string, type: string) {
		return api.post('/messages/send', { chatId, content, type })
	},

	// 标记已读
	markRead(chatId: number) {
		return api.post(`/chats/${chatId}/read`)
	},
}

export default api

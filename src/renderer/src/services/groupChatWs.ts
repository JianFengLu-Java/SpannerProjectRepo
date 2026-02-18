import { Client } from '@stomp/stompjs'

export interface GroupChatMessageFrame {
	messageId?: string
	groupNo: string
	from: string
	content: string
	clientMessageId?: string
	sentAt?: string
}

export interface GroupChatAckFrame {
	clientMessageId?: string
	messageId?: string
	groupNo?: string
	status?: string
	ackAt?: string
}

export interface GroupChatErrorFrame {
	code?: string
	message?: string
	clientMessageId?: string
	at?: string
}

interface GroupChatWsHandlers {
	onMessage?: (payload: GroupChatMessageFrame) => void
	onAck?: (payload: GroupChatAckFrame) => void
	onError?: (payload: GroupChatErrorFrame) => void
	onConnected?: () => void
	onDisconnected?: () => void
}

class GroupChatWsService {
	private client: Client | null = null

	private handlers: GroupChatWsHandlers = {}

	private activeToken = ''

	private connecting = false

	connect(token: string, handlers: GroupChatWsHandlers = {}): void {
		const normalized = token.trim().replace(/^Bearer\s+/i, '')
		if (!normalized) return

		this.handlers = handlers

		if (this.client?.connected && this.activeToken === normalized) {
			return
		}
		if (this.client && this.activeToken !== normalized) {
			this.disconnect()
		}
		if (this.connecting) return

		this.connecting = true
		this.activeToken = normalized
		this.client = new Client({
			brokerURL: import.meta.env.VITE_WS_URL,
			connectHeaders: {
				Authorization: `Bearer ${normalized}`,
				token: normalized,
			},
			reconnectDelay: 5000,
			onConnect: () => {
				this.connecting = false
				this.subscribeChannels()
				this.handlers.onConnected?.()
			},
			onDisconnect: () => {
				this.handlers.onDisconnected?.()
			},
			onWebSocketClose: () => {
				this.handlers.onDisconnected?.()
			},
			onWebSocketError: () => {
				this.handlers.onDisconnected?.()
			},
			onStompError: (frame) => {
				this.handlers.onError?.({
					code: frame.headers['message'] || 'STOMP_ERROR',
					message: frame.body || 'Group websocket STOMP error',
				})
			},
		})

		this.client.activate()
	}

	private subscribeChannels(): void {
		if (!this.client?.connected) return

		this.client.subscribe('/user/queue/group.messages', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatMessageFrame
				this.handlers.onMessage?.(payload)
			} catch (error) {
				console.error('解析群聊消息失败:', error)
			}
		})

		this.client.subscribe('/user/queue/group.acks', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatAckFrame
				this.handlers.onAck?.(payload)
			} catch (error) {
				console.error('解析群聊回执失败:', error)
			}
		})

		this.client.subscribe('/user/queue/errors', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatErrorFrame
				this.handlers.onError?.(payload)
			} catch (error) {
				console.error('解析群聊错误失败:', error)
			}
		})
	}

	sendGroup(
		groupNo: string,
		content: string,
		clientMessageId: string,
	): boolean {
		if (!this.client?.connected) return false

		try {
			this.client.publish({
				destination: '/app/chat/group.send',
				body: JSON.stringify({
					groupNo,
					content,
					clientMessageId,
				}),
			})
			return true
		} catch (error) {
			console.error('发送群聊消息失败:', error)
			return false
		}
	}

	disconnect(): void {
		this.connecting = false
		this.activeToken = ''
		if (this.client) {
			void this.client.deactivate()
			this.client = null
		}
	}
}

export const groupChatWs = new GroupChatWsService()

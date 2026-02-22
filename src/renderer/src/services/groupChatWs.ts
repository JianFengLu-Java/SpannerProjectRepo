import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import type { MessageQuote } from '@renderer/stores/chat'

export interface GroupChatMessageFrame {
	messageId?: string
	groupNo: string
	from: string
	content: string
	quote?: MessageQuote
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
	onReaction?: (payload: Record<string, unknown>) => void
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

	private subscriptionMap = new Map<string, StompSubscription>()

	connect(token: string, handlers: GroupChatWsHandlers = {}): void {
		const normalized = token.trim().replace(/^Bearer\s+/i, '')
		if (!normalized) return

		this.handlers = handlers

		if (this.client?.connected && this.activeToken === normalized) {
			this.subscribeChannels()
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
				this.subscriptionMap.clear()
				this.subscribeChannels()
				this.handlers.onConnected?.()
			},
			onDisconnect: () => {
				this.subscriptionMap.clear()
				this.handlers.onDisconnected?.()
			},
			onWebSocketClose: () => {
				this.subscriptionMap.clear()
				this.handlers.onDisconnected?.()
			},
			onWebSocketError: () => {
				this.subscriptionMap.clear()
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

		this.subscribeOnce('/user/queue/group.messages', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatMessageFrame
				this.handlers.onMessage?.(payload)
			} catch (error) {
				console.error('解析群聊消息失败:', error)
			}
		})

		this.subscribeOnce('/user/queue/group.acks', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatAckFrame
				this.handlers.onAck?.(payload)
			} catch (error) {
				console.error('解析群聊回执失败:', error)
			}
		})

		this.subscribeOnce('/user/queue/errors', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as GroupChatErrorFrame
				this.handlers.onError?.(payload)
			} catch (error) {
				console.error('解析群聊错误失败:', error)
			}
		})

		const reactionDestinations = [
			'/user/queue/message.reactions.updated',
			'/user/queue/group.reactions',
			'/user/queue/message.reactions',
			'/user/queue/reactions',
		]
		for (const destination of reactionDestinations) {
			this.subscribeOnce(destination, (frame) => {
				try {
					const payload = JSON.parse(frame.body) as Record<
						string,
						unknown
					>
					this.handlers.onReaction?.(payload)
				} catch (error) {
					console.error('解析群聊表情回应事件失败:', error)
				}
			})
		}
	}

	private subscribeOnce(
		destination: string,
		callback: (frame: { body: string }) => void,
	): void {
		if (!this.client?.connected) return
		if (this.subscriptionMap.has(destination)) return
		const sub = this.client.subscribe(destination, callback)
		this.subscriptionMap.set(destination, sub)
	}

	sendGroup(
		groupNo: string,
		content: string,
		clientMessageId: string,
		quote?: MessageQuote,
	): boolean {
		if (!this.client?.connected) return false

		try {
			this.client.publish({
				destination: '/app/chat/group.send',
				body: JSON.stringify({
					groupNo,
					content,
					clientMessageId,
					quote: quote || undefined,
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
		for (const sub of this.subscriptionMap.values()) {
			try {
				sub.unsubscribe()
			} catch {
				// ignore
			}
		}
		this.subscriptionMap.clear()
		if (this.client) {
			void this.client.deactivate()
			this.client = null
		}
	}
}

export const groupChatWs = new GroupChatWsService()

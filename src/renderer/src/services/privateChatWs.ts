import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import type { MessageQuote } from '@renderer/stores/chat'

export interface PrivateChatMessageFrame {
	messageId: string
	from: string
	to: string
	content: string
	quote?: MessageQuote
	clientMessageId?: string
	sentAt?: string
}

export interface PrivateChatAckFrame {
	clientMessageId?: string
	messageId?: string
	to?: string
	status?: string
	ackAt?: string
}

export interface PrivateChatErrorFrame {
	code?: string
	message?: string
	clientMessageId?: string
	at?: string
}

export interface PrivateIncomingCallFrame {
	callId?: string
	from?: string
	fromName?: string
	fromAvatar?: string
	type?: 'video' | 'audio' | string
	chatId?: number | string
	createdAt?: string
}

interface PrivateChatWsHandlers {
	onMessage?: (payload: PrivateChatMessageFrame) => void
	onReaction?: (payload: Record<string, unknown>) => void
	onAck?: (payload: PrivateChatAckFrame) => void
	onError?: (payload: PrivateChatErrorFrame) => void
	onIncomingCall?: (payload: PrivateIncomingCallFrame) => void
	onConnected?: () => void
	onDisconnected?: () => void
}

class PrivateChatWsService {
	private client: Client | null = null

	private handlers: PrivateChatWsHandlers = {}

	private activeToken = ''

	private connecting = false

	private subscriptionMap = new Map<string, StompSubscription>()

	connect(token: string, handlers: PrivateChatWsHandlers = {}): void {
		const normalized = token.trim().replace(/^Bearer\s+/i, '')
		if (!normalized) return

		this.handlers = handlers

		// 已经连接且 token 未变，直接复用
		if (this.client?.connected && this.activeToken === normalized) {
			this.subscribeChannels()
			return
		}

		// token 变化时重连
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
					message: frame.body || 'WebSocket STOMP error',
				})
			},
		})

		this.client.activate()
	}

	private subscribeChannels(): void {
		if (!this.client?.connected) return

		this.subscribeOnce('/user/queue/messages', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as PrivateChatMessageFrame
				this.handlers.onMessage?.(payload)
			} catch (error) {
				console.error('解析私聊消息失败:', error)
			}
		})

		this.subscribeOnce('/user/queue/acks', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as PrivateChatAckFrame
				this.handlers.onAck?.(payload)
			} catch (error) {
				console.error('解析私聊回执失败:', error)
			}
		})

		this.subscribeOnce('/user/queue/errors', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as PrivateChatErrorFrame
				this.handlers.onError?.(payload)
			} catch (error) {
				console.error('解析私聊错误失败:', error)
			}
		})

		this.subscribeOnce('/user/queue/calls', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as PrivateIncomingCallFrame
				this.handlers.onIncomingCall?.(payload)
			} catch (error) {
				console.error('解析来电信令失败:', error)
			}
		})

		const reactionDestinations = [
			'/user/queue/message.reactions.updated',
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
					console.error('解析私聊表情回应事件失败:', error)
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

	sendPrivate(
		to: string,
		content: string,
		clientMessageId: string,
		quote?: MessageQuote,
	): boolean {
		if (!this.client?.connected) return false

		try {
			this.client.publish({
				destination: '/app/chat/private.send',
				body: JSON.stringify({
					to,
					content,
					clientMessageId,
					quote: quote || undefined,
				}),
			})
			return true
		} catch (error) {
			console.error('发送私聊消息失败:', error)
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

export const privateChatWs = new PrivateChatWsService()

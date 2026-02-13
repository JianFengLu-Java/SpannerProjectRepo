import { Client } from '@stomp/stompjs'

export type FriendRequestEventType =
	| 'FRIEND_REQUEST_CREATED'
	| 'FRIEND_REQUEST_ACCEPTED'
	| 'FRIEND_REQUEST_REJECTED'
	| 'FRIEND_REQUEST_CANCELED'
	| 'FRIEND_REQUEST_EXPIRED'

export interface FriendRequestWsEvent {
	eventId?: string
	eventType?: FriendRequestEventType
	occurredAt?: string
	requestId?: string
	fromAccount?: string
	fromName?: string
	fromAvatarUrl?: string
	toAccount?: string
	status?: string
	unreadPendingCount?: number
}

interface FriendRequestWsHandlers {
	onEvent?: (payload: FriendRequestWsEvent) => void
	onConnected?: () => void
	onDisconnected?: () => void
	onError?: (error: { code?: string; message?: string }) => void
}

class FriendRequestWsService {
	private client: Client | null = null

	private handlers: FriendRequestWsHandlers = {}

	private activeToken = ''

	private connecting = false

	connect(token: string, handlers: FriendRequestWsHandlers = {}): void {
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
					message: frame.body || 'Friend request websocket error',
				})
			},
		})

		this.client.activate()
	}

	private subscribeChannels(): void {
		if (!this.client?.connected) return

		this.client.subscribe('/user/queue/friend-requests', (frame) => {
			try {
				const payload = JSON.parse(frame.body) as FriendRequestWsEvent
				this.handlers.onEvent?.(payload)
			} catch (error) {
				console.error('解析好友请求事件失败:', error)
			}
		})
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

export const friendRequestWs = new FriendRequestWsService()

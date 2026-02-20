import { Client } from '@stomp/stompjs'

export interface CloudDocWsPatchData {
	baseVersion?: number
	opId?: string
	opType?: string
	payload?: string
}

export interface CloudDocWsEventFrame {
	eventType?: string
	docId?: string
	from?: string
	at?: string
	data?: CloudDocWsPatchData | Record<string, unknown>
}

export interface CloudDocWsAckFrame {
	action?: string
	docId?: string
	status?: string
	at?: string
}

export interface CloudDocWsErrorFrame {
	code?: string
	message?: string
	clientMessageId?: string
	at?: string
}

interface CloudDocWsHandlers {
	onEvent?: (payload: CloudDocWsEventFrame) => void
	onAck?: (payload: CloudDocWsAckFrame) => void
	onError?: (payload: CloudDocWsErrorFrame) => void
	onConnected?: () => void
	onDisconnected?: () => void
}

interface CloudDocJoinLeaveBody {
	docId: string
}

interface CloudDocCursorBody {
	docId: string
	anchor: number
	head: number
}

interface CloudDocPatchBody {
	docId: string
	baseVersion: number
	opId: string
	opType: string
	payload: string
}

class CloudDocWsService {
	private client: Client | null = null
	private handlers: CloudDocWsHandlers = {}
	private activeToken = ''
	private connecting = false

	connect(token: string, handlers: CloudDocWsHandlers = {}): void {
		const normalized = token.trim().replace(/^Bearer\s+/i, '')
		if (!normalized) return
		this.handlers = handlers
		if (this.client?.connected && this.activeToken === normalized) return
		if (this.client && this.activeToken !== normalized) this.disconnect()
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
					message: frame.body || 'Cloud doc websocket STOMP error',
				})
			},
		})
		this.client.activate()
	}

	private subscribeChannels(): void {
		if (!this.client?.connected) return

		this.client.subscribe('/user/queue/cloud-docs.events', (frame) => {
			try {
				this.handlers.onEvent?.(
					JSON.parse(frame.body) as CloudDocWsEventFrame,
				)
			} catch (error) {
				console.error('解析云文档协作事件失败:', error)
			}
		})

		this.client.subscribe('/user/queue/cloud-docs.acks', (frame) => {
			try {
				this.handlers.onAck?.(JSON.parse(frame.body) as CloudDocWsAckFrame)
			} catch (error) {
				console.error('解析云文档协作回执失败:', error)
			}
		})

		this.client.subscribe('/user/queue/errors', (frame) => {
			try {
				this.handlers.onError?.(
					JSON.parse(frame.body) as CloudDocWsErrorFrame,
				)
			} catch (error) {
				console.error('解析云文档协作错误失败:', error)
			}
		})
	}

	join(payload: CloudDocJoinLeaveBody): boolean {
		if (!this.client?.connected || !payload.docId) return false
		try {
			this.client.publish({
				destination: '/app/cloud-docs.join',
				body: JSON.stringify(payload),
			})
			return true
		} catch (error) {
			console.error('加入云文档协作失败:', error)
			return false
		}
	}

	leave(payload: CloudDocJoinLeaveBody): boolean {
		if (!this.client?.connected || !payload.docId) return false
		try {
			this.client.publish({
				destination: '/app/cloud-docs.leave',
				body: JSON.stringify(payload),
			})
			return true
		} catch (error) {
			console.error('离开云文档协作失败:', error)
			return false
		}
	}

	sendCursor(payload: CloudDocCursorBody): boolean {
		if (!this.client?.connected || !payload.docId) return false
		try {
			this.client.publish({
				destination: '/app/cloud-docs.cursor',
				body: JSON.stringify(payload),
			})
			return true
		} catch (error) {
			console.error('发送云文档游标失败:', error)
			return false
		}
	}

	sendPatch(payload: CloudDocPatchBody): boolean {
		if (!this.client?.connected || !payload.docId) return false
		try {
			this.client.publish({
				destination: '/app/cloud-docs.patch',
				body: JSON.stringify(payload),
			})
			return true
		} catch (error) {
			console.error('发送云文档 patch 失败:', error)
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

export const cloudDocWs = new CloudDocWsService()

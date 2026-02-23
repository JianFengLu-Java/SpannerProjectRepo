import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useUserInfoStore } from './userInfo'
import { useFriendStore } from './friend'
import {
	useAppSettingsStore,
	type MessageReminderDisplayType,
} from './appSettings'
import { tokenManager } from '@renderer/services/tokenManager'
import request from '@renderer/utils/request'
import {
	isDefaultAvatarUrl,
	isDicebearAvatarUrl,
	resolveAvatarUrl,
} from '@renderer/utils/avatar'
import systemAvatarUrl from '@renderer/assets/system.svg'
import {
	privateChatWs,
	type PrivateChatAckFrame,
	type PrivateCallAnsweredFrame,
	type PrivateCallEndedFrame,
	type PrivateCallSignalFrame,
	type PrivateChatErrorFrame,
	type PrivateIncomingCallFrame,
	type PrivateChatMessageFrame,
} from '@renderer/services/privateChatWs'
import { publishCallSignal } from '@renderer/services/callWindowBridge'
import {
	emitCallAnswered,
	emitCallEnded,
	emitCallSignal,
	emitIncomingCall,
} from '@renderer/services/callSignal'
import {
	groupChatApi,
	type GroupDetail,
	type GroupHistoryMessageDto,
	type GroupHistoryPageData,
	type GroupMember,
	type GroupQuitResult,
	type GroupRole,
} from '@renderer/services/groupChatApi'
import {
	groupChatWs,
	type GroupChatAckFrame,
	type GroupChatErrorFrame,
	type GroupChatMessageFrame,
} from '@renderer/services/groupChatWs'
import {
	messageReactionApi,
	type ReactionItemDto,
} from '@renderer/services/messageReactionApi'
import { messageRecallApi } from '@renderer/services/messageRecallApi'
import { useMomentStore } from '@renderer/stores/moment'

interface DbChatItem {
	id: number
	chatType?: 'PRIVATE' | 'GROUP'
	peerAccount?: string
	groupNo?: string
	myRole?: GroupRole
	maxMembers?: number
	memberCount?: number
	announcement?: string
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	lastMessageAt?: string
	online: number
	unreadCount: number
	isPinned: number
}

interface DbMessage {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	senderAccount?: string
	senderName?: string
	senderAvatar?: string
	text: string
	timestamp: string
	type: string
	hasResult: number
	result?: string
	clientMessageId?: string
	serverMessageId?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	sentAt?: string
	reactions?: string
	quotedMessageId?: string
	quotedFromAccount?: string
	quotedFromName?: string
	quotedContent?: string
	recalled?: number
	recalledAt?: string
	recallDeadlineAt?: string
}

interface OfflineMessagePullResponse {
	data?: {
		messages?: PrivateChatMessageFrame[]
	}
}

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

interface HistoryMessageDto {
	messageId?: string | number
	from: string
	to: string
	content: string
	formName?: string
	fromName?: string
	fromRealName?: string
	fromAvatarUrl?: string
	fromAvatar?: string
	quote?: MessageQuote
	clientMessageId?: string | number
	sentAt?: string
	timestamp?: string
	time?: string
	createTime?: string
	type?: string
	recalled?: boolean
	recalledAt?: string
	recallDeadlineAt?: string
}

interface ChatHistoryPageData {
	messages?: HistoryMessageDto[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

interface PullChatHistoryOptions {
	groupNo?: string
	page?: number
	size?: number
	appendToStore?: boolean
	startDate?: string
	endDate?: string
	type?: MessageTypeFilter
	keyword?: string
}

interface QueryChatHistoryOptions {
	groupNo?: string
	pageSize?: number
	maxPages?: number
	startDate?: string
	endDate?: string
	type?: MessageTypeFilter
	keyword?: string
}

interface QueryChatHistoryResult {
	messages: Message[]
	pagesScanned: number
	hasMore: boolean
	totalMatched: number
}

interface LocalMessageSearchResult extends DbMessage {
	chatName: string
}

interface MessageReactionEventFrame {
	eventType?: string
	chatId?: number | string
	messageId?: number | string
	serverMessageId?: string
	clientMessageId?: string
	groupNo?: string
	from?: string
	to?: string
	operatorId?: string
	operatorName?: string
	reactions?: unknown
	updatedAt?: string
	data?: Record<string, unknown>
}

interface MessageRecallEventFrame {
	eventType?: string
	messageType?: 'PRIVATE' | 'GROUP'
	chatId?: number | string
	messageId?: number | string
	serverMessageId?: string
	clientMessageId?: string
	groupNo?: string
	from?: string
	to?: string
	recalled?: boolean
	recalledAt?: string
	recallDeadlineAt?: string
	data?: Record<string, unknown>
}

export interface GlobalMessageSearchHit {
	chatId: number
	chatName: string
	message: Message
}

type MessageTypeFilter = 'all' | Message['type']

interface HydrateStorePayload {
	messages?: Record<number, Message[]>
	chatlist?: ChatItem[]
	pinnedChats?: ChatItem[]
	scope?: string
}

const CHAT_IPC_CHANNELS = [
	'store-update',
	'provide-store-data',
	'hydrate-store-data',
] as const

interface IpcRendererWithRemoveAll {
	removeAllListeners?: (channel: string) => void
}

const clearChatIpcListeners = (): void => {
	const host = window as Window & {
		electron?: {
			ipcRenderer?: IpcRendererWithRemoveAll
		}
	}
	const ipcRenderer = host.electron?.ipcRenderer
	if (!ipcRenderer?.removeAllListeners) return
	for (const channel of CHAT_IPC_CHANNELS) {
		ipcRenderer.removeAllListeners(channel)
	}
}

export const useChatStore = defineStore('chat', () => {
	const userInfoStore = useUserInfoStore()
	const friendStore = useFriendStore()
	const appSettingsStore = useAppSettingsStore()
	const SYSTEM_ACCOUNT = 'SYSTEM'
	const LEGACY_SYSTEM_ACCOUNT = 'S'
	const SYSTEM_CHAT_NAME = '系统通知'
	const SYSTEM_CHAT_ID_SEED = -999000001
	const SYSTEM_AVATAR_DATA_URI = systemAvatarUrl
	let localMessageIdCursor = Date.now()
	// --- 状态定义 ---
	const activeChatId = ref<number | null>(null)
	const drafts = ref<Record<number, Record<string, unknown> | null>>({})
	const chatlist = ref<ChatItem[]>([])
	const pinnedChats = ref<ChatItem[]>([])
	const messages = ref<Record<number, Message[]>>({})
	const messageJumpTarget = ref<MessageJumpTarget | null>(null)
	const isDbInitialized = ref(false)
	const initializedAccount = ref('')
	const isPrivateWsBound = ref(false)
	const privateWsBoundAccount = ref('')
	const privateWsBoundToken = ref('')
	const isGroupWsBound = ref(false)
	const groupWsBoundAccount = ref('')
	const groupWsBoundToken = ref('')
	const offlinePulledAccount = ref('')
	const friendsLoadedAccount = ref('')
	const pendingMessageMap = ref(
		new Map<
			string,
			{
				chatId: number
				tempMessageId: number
			}
		>(),
	)
	const historyPaginationMap = ref(
		new Map<number, { nextPage: number; hasMore: boolean }>(),
	)
	const localHistoryCursorMap = ref(
		new Map<number, { nextOffsetFromLatest: number; hasMore: boolean }>(),
	)
	const composingQuoteMap = ref<Record<number, ComposerMessageQuote | null>>(
		{},
	)
	const loadingHistoryChatIds = ref(new Set<number>())
	const hydratedHistoryChatIds = ref(new Set<number>())
	const LOCAL_HISTORY_INITIAL_CHUNK_SIZE = 40
	const REACTION_EVENT_DEDUP_TTL_MS = 15 * 1000
	const REACTION_OPEN_SYNC_LIMIT = 80
	const REACTION_OPEN_SYNC_CONCURRENCY = 5
	const REACTION_OPEN_SYNC_COOLDOWN_MS = 8 * 1000
	const MESSAGE_RECALL_WINDOW_MS = 24 * 60 * 60 * 1000
	let loadingFriendsPromise: Promise<boolean> | null = null
	let messageJumpToken = 0
	const groupSessionSyncAtMap = new Map<string, number>()
	const recentReactionEventMap = new Map<string, number>()
	const recentRecallEventMap = new Map<string, number>()
	const recentReactionOpenSyncAtMap = new Map<number, number>()
	const GROUP_SESSION_SYNC_INTERVAL_MS = 60 * 1000
	const shouldLogChatMergeDebug = (): boolean => {
		if (!import.meta.env.DEV) return false
		try {
			return window.localStorage.getItem('chat-merge-debug') === '1'
		} catch {
			return false
		}
	}

	const shouldLogReactionDebug = (): boolean => {
		if (!import.meta.env.DEV) return false
		try {
			return window.localStorage.getItem('chat-reaction-debug') === '1'
		} catch {
			return false
		}
	}

	const shouldLogSystemNoticeDebug = (): boolean => {
		if (!import.meta.env.DEV) return false
		try {
			return window.localStorage.getItem('system-notice-debug') === '1'
		} catch {
			return false
		}
	}

	const getCurrentAccount = (): string => {
		const account = userInfoStore.account?.trim()
		if (!account) {
			throw new Error('当前账号不存在，无法读取聊天数据')
		}
		return account
	}

	const getCurrentToken = (): string => {
		return (
			tokenManager.getAccessToken().trim() ||
			userInfoStore.userToken?.trim() ||
			window.localStorage.getItem('token')?.trim() ||
			''
		)
	}

	const createClientMessageId = (): string => {
		return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	}

	const createLocalMessageId = (): number => {
		localMessageIdCursor += 1
		return localMessageIdCursor
	}

	const getChatType = (chat?: ChatItem | null): 'PRIVATE' | 'GROUP' => {
		return chat?.chatType === 'GROUP' ? 'GROUP' : 'PRIVATE'
	}

	const normalizeAccount = (value: unknown): string => {
		if (value === null || value === undefined) return ''
		return String(value).trim()
	}

	const isSystemAccount = (account: string): boolean => {
		const normalized = account.toUpperCase()
		return (
			normalized === SYSTEM_ACCOUNT ||
			normalized === LEGACY_SYSTEM_ACCOUNT
		)
	}

	const resolveSystemChatAvatar = (): string => {
		return SYSTEM_AVATAR_DATA_URI
	}

	const isSystemNotificationChatItem = (chat?: ChatItem | null): boolean => {
		if (!chat || chat.chatType === 'GROUP') return false
		return isSystemAccount(normalizeAccount(chat.peerAccount))
	}

	const findSystemNotificationChat = (): ChatItem | undefined => {
		return chatlist.value.find((item) => isSystemNotificationChatItem(item))
	}

	const allocateSystemChatId = (): number => {
		const usedIds = new Set(chatlist.value.map((item) => item.id))
		let candidate = SYSTEM_CHAT_ID_SEED
		while (usedIds.has(candidate)) {
			candidate -= 1
		}
		return candidate
	}

	const hashToPositiveInt = (seed: string): number => {
		let hash = 2166136261
		for (let i = 0; i < seed.length; i += 1) {
			hash ^= seed.charCodeAt(i)
			hash = Math.imul(hash, 16777619)
		}
		return ((hash >>> 0) % 1000000000) + 1000000000
	}

	const derivePrivateChatId = (account: string): number | null => {
		const normalized = account.trim()
		if (!normalized) return null
		const numeric = Number(normalized)
		if (Number.isFinite(numeric) && numeric > 0) {
			return Math.floor(numeric)
		}
		return hashToPositiveInt(`private:${normalized}`)
	}

	const deriveGroupChatId = (groupNo: string): number | null => {
		const normalized = groupNo.trim()
		if (!normalized) return null
		const numeric = Number(normalized)
		if (Number.isFinite(numeric) && numeric > 0) {
			return -Math.floor(numeric)
		}
		return -hashToPositiveInt(`group:${normalized}`)
	}

	const findGroupChatByNo = (groupNo: string): ChatItem | undefined => {
		const normalized = groupNo.trim()
		if (!normalized) return undefined
		return chatlist.value.find(
			(item) =>
				item.chatType === 'GROUP' &&
				item.groupNo?.trim() === normalized,
		)
	}

	const resolveGroupAvatar = (
		detail?: Partial<GroupDetail> & {
			groupAvatarUrl?: string
			avatarUrl?: string
			avatar?: string
		},
		fallback = '',
	): string => {
		const remoteAvatar = (
			detail?.groupAvatarUrl ||
			detail?.avatarUrl ||
			detail?.avatar ||
			''
		).trim()
		if (remoteAvatar) return resolveAvatarUrl(remoteAvatar)
		return (fallback || '').trim()
	}

	const findPrivateChatByAccount = (
		account: string,
	): ChatItem | undefined => {
		const normalized = account.trim()
		if (!normalized) return undefined
		return chatlist.value.find(
			(item) =>
				item.chatType !== 'GROUP' &&
				!isSystemNotificationChatItem(item) &&
				item.peerAccount?.trim() === normalized,
		)
	}

	const requestMessageJump = (payload: {
		chatId: number
		messageId: number
		serverMessageId?: string
		clientMessageId?: string
		keyword?: string
	}): void => {
		messageJumpToken += 1
		messageJumpTarget.value = {
			...payload,
			token: messageJumpToken,
		}
	}

	const clearMessageJump = (): void => {
		messageJumpTarget.value = null
	}

	const pad2 = (value: number): string => String(value).padStart(2, '0')

	const formatHourMinute = (date: Date): string =>
		`${pad2(date.getHours())}:${pad2(date.getMinutes())}`

	const getStartOfDay = (date: Date): Date =>
		new Date(date.getFullYear(), date.getMonth(), date.getDate())

	const getCalendarDayDiff = (from: Date, to: Date): number => {
		const fromStart = getStartOfDay(from)
		const toStart = getStartOfDay(to)
		let diff = 0
		if (fromStart.getTime() === toStart.getTime()) return 0
		if (fromStart.getTime() < toStart.getTime()) {
			const cursor = new Date(fromStart)
			while (cursor.getTime() < toStart.getTime()) {
				cursor.setDate(cursor.getDate() + 1)
				diff += 1
			}
			return diff
		}
		const cursor = new Date(fromStart)
		while (cursor.getTime() > toStart.getTime()) {
			cursor.setDate(cursor.getDate() - 1)
			diff -= 1
		}
		return diff
	}

	const getWeekdayLabel = (day: number): string => {
		const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
		return labels[day] || '周日'
	}

	const formatMonthDay = (date: Date): string =>
		`${date.getMonth() + 1}月${date.getDate()}日`

	const parseIsoLikeDate = (value?: string): Date | null => {
		if (!value?.trim()) return null
		const text = value.trim().replace(' ', 'T')
		const matched = text.match(
			/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?$/,
		)
		if (matched) {
			const year = Number(matched[1])
			const month = Number(matched[2])
			const day = Number(matched[3])
			const hour = Number(matched[4])
			const minute = Number(matched[5])
			const second = Number(matched[6] || '0')
			const fraction = matched[7] || ''
			const timezone = matched[8] || ''
			const millisecond = Number((fraction + '000').slice(0, 3))
			if (timezone) {
				if (timezone === 'Z') {
					return new Date(
						Date.UTC(
							year,
							month - 1,
							day,
							hour,
							minute,
							second,
							millisecond,
						),
					)
				}
				const normalizedTz = timezone.includes(':')
					? timezone
					: `${timezone.slice(0, 3)}:${timezone.slice(3)}`
				const sign = normalizedTz.startsWith('-') ? -1 : 1
				const tzHour = Number(normalizedTz.slice(1, 3))
				const tzMinute = Number(normalizedTz.slice(4, 6))
				const offsetMinutes = sign * (tzHour * 60 + tzMinute)
				const utcMillis =
					Date.UTC(
						year,
						month - 1,
						day,
						hour,
						minute,
						second,
						millisecond,
					) -
					offsetMinutes * 60 * 1000
				return new Date(utcMillis)
			}
			return new Date(
				year,
				month - 1,
				day,
				hour,
				minute,
				second,
				millisecond,
			)
		}
		const fallback = new Date(text)
		return Number.isNaN(fallback.getTime()) ? null : fallback
	}

	const formatTimeFromIso = (iso?: string): string => {
		if (!iso) return formatHourMinute(new Date())
		const date = parseIsoLikeDate(iso)
		if (!date) {
			return formatHourMinute(new Date())
		}
		const now = new Date()
		const dayDiff = getCalendarDayDiff(date, now)
		const timePart = formatHourMinute(date)

		if (dayDiff === 0) return timePart
		if (dayDiff === 1) return `昨天${timePart}`
		if (dayDiff === 2) return `前天${timePart}`
		if (dayDiff > 2 && dayDiff <= 6) {
			return `${getWeekdayLabel(date.getDay())}${timePart}`
		}
		return `${formatMonthDay(date)} ${timePart}`
	}

	const getTextPreview = (content: string): string => {
		const parseJsonPreview = (raw: string): string => {
			const text = String(raw || '').trim()
			if (!text) return ''
			const tryParse = (input: string): Record<string, unknown> | null => {
				try {
					const parsed = JSON.parse(input)
					if (
						parsed &&
						typeof parsed === 'object' &&
						!Array.isArray(parsed)
					) {
						return parsed as Record<string, unknown>
					}
				} catch {
					// ignore
				}
				return null
			}
			const normalizeText = (value: unknown): string => {
				if (typeof value === 'string') return value.trim()
				if (typeof value === 'number' || typeof value === 'boolean') {
					return String(value)
				}
				return ''
			}
			const readField = (
				source: Record<string, unknown>,
				keys: string[],
			): string => {
				for (const key of keys) {
					const value = normalizeText(source[key])
					if (value) return value
				}
				return ''
			}
			const parsed =
				tryParse(text) ||
				(() => {
					const firstBrace = text.indexOf('{')
					const lastBrace = text.lastIndexOf('}')
					if (firstBrace >= 0 && lastBrace > firstBrace) {
						return tryParse(text.slice(firstBrace, lastBrace + 1))
					}
					return null
				})()
			if (!parsed) return ''
			const eventType = readField(parsed, ['eventType', 'type']).toLowerCase()
			const actor = readField(parsed, [
				'operatorName',
				'actorName',
				'senderName',
				'fromName',
				'operatorId',
			])
			const emoji = readField(parsed, [
				'reactionEmoji',
				'reaction',
				'emoji',
			])
			const messagePreview = readField(parsed, [
				'messagePreview',
				'messageSnippet',
				'summary',
				'messageText',
				'title',
				'message',
				'content',
			])
			if (
				eventType.includes('reaction') ||
				eventType.includes('reply') ||
				emoji
			) {
				const who = actor || '有人'
				return `${who} 回复了消息${emoji ? ` ${emoji}` : ''}`
			}
			return messagePreview
		}

		const jsonPreview = parseJsonPreview(content)
		if (jsonPreview) return jsonPreview

		const plainText = content
			.replace(/<[^>]*>?/gm, '')
			.trim()

		return plainText || '[图片]'
	}

	const escapeRegExp = (value: string): string =>
		value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

	const isMentioningCurrentUser = (
		content: string,
		currentAccount: string,
		currentName?: string,
	): boolean => {
		const plainText = (content || '')
			.replace(/<br\s*\/?>/gi, ' ')
			.replace(/<[^>]*>?/gm, ' ')
			.replace(/\s+/g, ' ')
			.trim()
		if (!plainText) return false

		const keywords = new Set<string>(['我', 'me'])
		const account = currentAccount.trim()
		const name = (currentName || '').trim()
		if (account) keywords.add(account)
		if (name) keywords.add(name)

		for (const keyword of keywords) {
			if (!keyword) continue
			const pattern = new RegExp(
				`(?:^|\\s)[@＠]\\s*${escapeRegExp(keyword)}(?=$|\\s|[，。,.!！?？:：;；、])`,
				'i',
			)
			if (pattern.test(plainText)) return true
		}
		return false
	}

	const getMessagePreview = (message: {
		text: string
		type: Message['type']
		senderId: Message['senderId']
		recalled?: boolean
	}): string => {
		if (message.recalled) return '该消息已撤回'
		const parseCallSummaryPreview = (content: string): string | null => {
			const text = (content || '').trim()
			if (!text) return null
			const tryParse = (raw: string): Record<string, unknown> | null => {
				try {
					const parsed = JSON.parse(raw)
					if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
						return parsed as Record<string, unknown>
					}
				} catch {
					// ignore
				}
				return null
			}
			const direct = tryParse(text)
			const firstBrace = text.indexOf('{')
			const lastBrace = text.lastIndexOf('}')
			const sliced =
				!direct && firstBrace >= 0 && lastBrace > firstBrace
					? tryParse(text.slice(firstBrace, lastBrace + 1))
					: null
			const obj = direct || sliced
			if (!obj) return null
			const bizType = String(obj.bizType || obj.biz_type || '')
				.trim()
				.toUpperCase()
			if (bizType !== 'CALL_SUMMARY') return null
			const displayText = String(obj.displayText || obj.display_text || '').trim()
			if (displayText) return displayText
			const callTypeText = String(obj.callTypeText || '').trim() || '通话'
			const minutes = Number(obj.minutes || 0)
			const seconds = Number(obj.seconds || 0)
			if (Number.isFinite(minutes) || Number.isFinite(seconds)) {
				return `[${callTypeText}]：${Math.max(0, Math.floor(minutes || 0))}分：${Math.max(
					0,
					Math.floor(seconds || 0),
				)}秒`
			}
			return `[${callTypeText}]`
		}
		const callSummaryPreview = parseCallSummaryPreview(message.text || '')
		if (callSummaryPreview) return callSummaryPreview
		if (/\bchat-cloud-doc-share-card\b/i.test(message.text || '')) {
			const titleMatched = (message.text || '').match(
				/data-doc-title\s*=\s*["']([^"']+)["']/i,
			)
			const title = titleMatched?.[1]?.trim() || ''
			return title ? `[云文档] ${title}` : '[云文档]'
		}
		if (message.type === 'transfer') {
			if (/\bchat-transfer-receipt-card\b/i.test(message.text || '')) {
				return '[已收款]'
			}
			if (/\bchat-transfer-refund-card\b/i.test(message.text || '')) {
				return '[已退还]'
			}
			const amountMatched = (message.text || '').match(
				/金额\s*[：:]\s*([^<\n]+)/i,
			)
			const amountText = amountMatched?.[1]?.trim() || ''
			if (message.senderId === 'other') {
				return amountText ? `[转账] ${amountText}` : '[转账]'
			}
			return amountText ? `转账给对方 ${amountText}` : '转账给对方'
		}
		return getTextPreview(message.text || '')
	}

	const inferMessageType = (
		content: string,
		type?: string,
	): Message['type'] => {
		const normalizedType = (type || '').trim().toLowerCase()
		if (
			normalizedType === 'image' ||
			normalizedType === 'file' ||
			normalizedType === 'text' ||
			normalizedType === 'transfer'
		) {
			return normalizedType
		}
		if (
			/\bchat-transfer-card\b/i.test(content) ||
			/\bchat-transfer-receipt-card\b/i.test(content) ||
			/\bchat-transfer-refund-card\b/i.test(content)
		) {
			return 'transfer'
		}
		if (/<img\b[^>]*>/i.test(content)) {
			return 'image'
		}
		if (
			/<a\b[^>]*href=/i.test(content) &&
			/(download|attachment|file)/i.test(content)
		) {
			return 'file'
		}
		return 'text'
	}

	const triggerSystemMessageReminder = (params: {
		chatName: string
		messageText: string
	}): void => {
		if (!appSettingsStore.notificationsEnabled) return
		const isStandalone =
			window.location.href.includes('chat-standalone') ||
			window.location.hash.includes('chat-standalone')
		if (isStandalone) return

		const displayType: MessageReminderDisplayType =
			appSettingsStore.messageReminderDisplayType
		const title = '新消息提醒'
		const body =
			displayType === 'detail'
				? `${params.chatName}: ${params.messageText}`
				: displayType === 'sender'
					? params.chatName
					: '你收到一条新消息'

		if (
			window.electron &&
			window.electron.ipcRenderer &&
			typeof window.electron.ipcRenderer.send === 'function'
		) {
			window.electron.ipcRenderer.send('show-system-notification', {
				title,
				body,
			})
			return
		}

		if (typeof Notification !== 'undefined') {
			const permission = Notification.permission
			if (permission === 'granted') {
				new Notification(title, { body })
			}
		}
	}

	const normalizeDateInput = (value?: string): string | undefined => {
		if (!value?.trim()) return undefined
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return undefined
		return date.toISOString()
	}

	const sanitizeReactionUsers = (value: unknown): string[] => {
		if (!Array.isArray(value)) return []
		const seen = new Set<string>()
		const users: string[] = []
		for (const item of value) {
			const userId = String(item || '').trim()
			if (!userId || seen.has(userId)) continue
			seen.add(userId)
			users.push(userId)
		}
		return users
	}

	const sanitizeMessageReactions = (value: unknown): MessageReaction[] => {
		if (!Array.isArray(value)) return []
		const next: MessageReaction[] = []
		const seenKey = new Set<string>()
		for (const item of value) {
			if (!item || typeof item !== 'object') continue
			const row = item as Partial<MessageReaction>
			const key = String(row.key || '').trim()
			if (!key || seenKey.has(key)) continue
			const users = sanitizeReactionUsers(row.userIds)
			const countFromField = Number(row.count || 0)
			const count =
				Number.isFinite(countFromField) && countFromField > 0
					? Math.max(users.length, Math.floor(countFromField))
					: users.length
			if (count <= 0) continue
			next.push({
				key,
				emoji: String(row.emoji || '').trim() || undefined,
				imageUrl: String(row.imageUrl || '').trim() || undefined,
				userIds: users,
				count,
				updatedAt:
					String(row.updatedAt || '').trim() ||
					new Date().toISOString(),
			})
			seenKey.add(key)
		}
		return next
	}

	const parseMessageReactions = (raw?: string): MessageReaction[] => {
		const text = String(raw || '').trim()
		if (!text) return []
		try {
			const parsed = JSON.parse(text) as unknown
			return sanitizeMessageReactions(parsed)
		} catch {
			return []
		}
	}

	const normalizeMessageQuote = (
		value: unknown,
	): MessageQuote | undefined => {
		if (!value || typeof value !== 'object') return undefined
		const source = value as Record<string, unknown>
		const messageId = String(source.messageId || '').trim()
		if (!messageId) return undefined
		const from = String(source.from || '').trim() || undefined
		const fromName =
			String(
				source.formName ||
					source.fromName ||
					source.fromRealName ||
					source.fromNickname ||
					source.fromUserName ||
					source.senderName ||
					source.nickName ||
					source.nickname ||
					source.realName ||
					source.userName ||
					source.name ||
					'',
			).trim() || undefined
		const content =
			typeof source.content === 'string' ? source.content : undefined
		return {
			messageId,
			from,
			fromName,
			content,
		}
	}

	const parseMessageQuoteFromDb = (row: DbMessage): MessageQuote | undefined => {
		return normalizeMessageQuote({
			messageId: row.quotedMessageId,
			from: row.quotedFromAccount,
			fromName: row.quotedFromName,
			content: row.quotedContent,
	})
}

	const extractMessageIdFromPayload = (value: unknown): string | undefined => {
		if (!value || typeof value !== 'object') return undefined
		const source = value as Record<string, unknown>
		const candidates: unknown[] = [
			source.messageId,
			source.serverMessageId,
			source.id,
			source.msgId,
		]
		const dataNode =
			source.data && typeof source.data === 'object' && !Array.isArray(source.data)
				? (source.data as Record<string, unknown>)
				: null
		if (dataNode) {
			candidates.push(
				dataNode.messageId,
				dataNode.serverMessageId,
				dataNode.id,
				dataNode.msgId,
			)
		}
		for (const candidate of candidates) {
			if (candidate === null || candidate === undefined) continue
			if (typeof candidate === 'object') continue
			const normalized = String(candidate).trim()
			if (normalized) return normalized
		}
		return undefined
	}

	const serializeMessageReactions = (value?: MessageReaction[]): string => {
		const safe = sanitizeMessageReactions(value || [])
		if (!safe.length) return '[]'
		return JSON.stringify(safe)
	}

	const fromServerReactionItems = (value: unknown): MessageReaction[] => {
		if (!Array.isArray(value)) return []
		const mapped = (value as ReactionItemDto[]).map((row) => {
			const raw = row as unknown as Record<string, unknown>
			const users = Array.isArray(row?.userIds)
				? row.userIds
				: Array.isArray(raw?.users)
					? (raw.users as string[])
					: Array.isArray(raw?.userAccounts)
						? (raw.userAccounts as string[])
						: []
			const count = Number(
				row?.count || raw?.total || raw?.num || raw?.size || 0,
			)
			const fallbackCount =
				count > 0 ? count : users.length > 0 ? users.length : 1
			return {
				key: String(row?.key || raw?.reactionKey || '').trim(),
				emoji:
					String(row?.emoji || raw?.reactionEmoji || raw?.emoji || '')
						.trim() || undefined,
				imageUrl:
					String(
						row?.imageUrl ||
							raw?.url ||
							raw?.imgUrl ||
							raw?.image ||
							'',
					).trim() || undefined,
				userIds: users,
				count: fallbackCount,
				updatedAt: String(row?.updatedAt || raw?.updateTime || '')
					.trim() || '',
			}
		})
		return sanitizeMessageReactions(mapped)
	}

	const matchesMessageFilters = (
		message: Message,
		options: {
			startDate?: string
			endDate?: string
			type?: MessageTypeFilter
			keyword?: string
		},
	): boolean => {
		const keyword = options.keyword?.trim().toLowerCase()
		if (keyword) {
			const plainText = (message.text || '')
				.replace(/<[^>]*>/g, '')
				.toLowerCase()
			if (!plainText.includes(keyword)) {
				return false
			}
		}

		const filterType = options.type || 'all'
		if (filterType !== 'all' && message.type !== filterType) {
			return false
		}

		const sentAt = message.sentAt ? new Date(message.sentAt) : null
		if (
			options.startDate &&
			sentAt &&
			sentAt.getTime() < new Date(options.startDate).getTime()
		) {
			return false
		}
		if (
			options.endDate &&
			sentAt &&
			sentAt.getTime() > new Date(options.endDate).getTime()
		) {
			return false
		}
		return true
	}

	const createLocalMessageFromServer = (
		payload:
			| HistoryMessageDto
			| PrivateChatMessageFrame
			| GroupChatMessageFrame
			| GroupHistoryMessageDto,
		chatId: number,
		currentAccount: string,
	): Message => {
		const source = payload as unknown as Record<string, unknown>
		const extractScalarFromJsonText = (
			raw: unknown,
			keys: string[],
		): string | undefined => {
			if (typeof raw !== 'string') return undefined
			const text = raw.trim()
			if (!text) return undefined
			const tryParse = (input: string): Record<string, unknown> | null => {
				try {
					const parsed = JSON.parse(input)
					if (
						parsed &&
						typeof parsed === 'object' &&
						!Array.isArray(parsed)
					) {
						return parsed as Record<string, unknown>
					}
				} catch {
					// ignore
				}
				return null
			}
			const parsed =
				tryParse(text) ||
				(() => {
					const firstBrace = text.indexOf('{')
					const lastBrace = text.lastIndexOf('}')
					if (firstBrace >= 0 && lastBrace > firstBrace) {
						return tryParse(text.slice(firstBrace, lastBrace + 1))
					}
					return null
				})()
			if (!parsed) return undefined
			const normalizeFieldKey = (value: string): string =>
				value.replace(/[\s_\-:]/g, '').toLowerCase()
			const wanted = new Set(keys.map((key) => normalizeFieldKey(key)))
			const queue: unknown[] = [parsed]
			while (queue.length) {
				const node = queue.shift()
				if (!node || typeof node !== 'object') continue
				for (const [rawKey, rawValue] of Object.entries(
					node as Record<string, unknown>,
				)) {
					if (!wanted.has(normalizeFieldKey(rawKey))) {
						if (rawValue && typeof rawValue === 'object') {
							queue.push(rawValue)
						}
						continue
					}
					if (
						typeof rawValue === 'string' ||
						typeof rawValue === 'number' ||
						typeof rawValue === 'boolean'
					) {
						const value = String(rawValue).trim()
						if (value) return value
					}
				}
			}
			return undefined
		}
		const normalizeFieldKey = (value: string): string =>
			value.replace(/[\s_\-:]/g, '').toLowerCase()
		const findDeepScalarByKeys = (
			root: unknown,
			keys: string[],
			maxDepth = 4,
		): string | undefined => {
			if (!root || typeof root !== 'object') return undefined
			const normalizedKeys = new Set(keys.map((key) => normalizeFieldKey(key)))
			const queue: Array<{ node: unknown; depth: number }> = [
				{ node: root, depth: 0 },
			]
			while (queue.length) {
				const current = queue.shift()
				if (!current) continue
				if (
					!current.node ||
					typeof current.node !== 'object' ||
					current.depth > maxDepth
				) {
					continue
				}
				const row = current.node as Record<string, unknown>
				for (const [rawKey, rawValue] of Object.entries(row)) {
					const normalizedKey = normalizeFieldKey(rawKey)
					if (normalizedKeys.has(normalizedKey)) {
						if (
							typeof rawValue === 'string' ||
							typeof rawValue === 'number' ||
							typeof rawValue === 'boolean'
						) {
							const value = String(rawValue).trim()
							if (value) return value
						}
					}
				}
				for (const value of Object.values(row)) {
					if (!value || typeof value !== 'object') continue
					queue.push({ node: value, depth: current.depth + 1 })
				}
			}
			return undefined
		}
		const dataNode =
			source.data && typeof source.data === 'object' && !Array.isArray(source.data)
				? (source.data as Record<string, unknown>)
				: undefined
		const normalizeId = (value: unknown): string | undefined => {
			if (value === null || value === undefined) return undefined
			if (typeof value === 'object') return undefined
			const normalized = String(value).trim()
			return normalized || undefined
		}
		const fromPayload =
			typeof payload.from === 'object' && payload.from !== null
				? (payload.from as Record<string, unknown>)
				: undefined
		const fromSource =
			typeof source.from === 'object' && source.from !== null
				? (source.from as Record<string, unknown>)
				: undefined
		const fromNode = fromPayload || fromSource
		const senderAccount =
			normalizeId(payload.from) ||
			normalizeId(source.from) ||
			normalizeId(dataNode?.from) ||
			normalizeId(fromNode?.account) ||
			normalizeId(fromNode?.userAccount) ||
			normalizeId(fromNode?.memberAccount) ||
			normalizeId(fromNode?.uid) ||
			normalizeId(fromNode?.userId) ||
			normalizeId(fromNode?.id) ||
			normalizeId(source.fromAccount) ||
			normalizeId(source.senderAccount) ||
			normalizeId(source.account) ||
			normalizeId(source.userAccount) ||
			normalizeId(source.sender) ||
			normalizeId(dataNode?.fromAccount) ||
			normalizeId(dataNode?.senderAccount) ||
			normalizeId(dataNode?.account) ||
			normalizeId(dataNode?.userAccount) ||
			normalizeId(dataNode?.sender)
		const timeIdentity =
			normalizeId(payload.sentAt) ||
			normalizeId(source.timestamp) ||
			normalizeId(source.time) ||
			normalizeId(source.createTime) ||
			normalizeId(dataNode?.sentAt) ||
			normalizeId(dataNode?.timestamp) ||
			normalizeId(dataNode?.time) ||
			normalizeId(dataNode?.createTime)
		const sentAt = timeIdentity
		const quote = normalizeMessageQuote(source.quote)
		const normalizedServerMessageId =
			extractMessageIdFromPayload(source) || normalizeId(payload.messageId)
		const normalizeBoolean = (value: unknown): boolean | undefined => {
			if (typeof value === 'boolean') return value
			if (typeof value === 'number') return value > 0
			if (typeof value === 'string') {
				const lowered = value.trim().toLowerCase()
				if (
					lowered === 'true' ||
					lowered === '1' ||
					lowered === 'yes' ||
					lowered === 'y'
				) {
					return true
				}
				if (
					lowered === 'false' ||
					lowered === '0' ||
					lowered === 'no' ||
					lowered === 'n'
				) {
					return false
				}
			}
			return undefined
		}
		const recalled =
			normalizeBoolean(source.recalled) ??
			normalizeBoolean(dataNode?.recalled) ??
			normalizeBoolean((payload as unknown as { recalled?: unknown }).recalled) ??
			false
		const recalledAt =
			normalizeId(source.recalledAt) ||
			normalizeId(dataNode?.recalledAt) ||
			normalizeId(
				(payload as unknown as { recalledAt?: unknown }).recalledAt,
			)
		const recallDeadlineAt =
			normalizeId(source.recallDeadlineAt) ||
			normalizeId(dataNode?.recallDeadlineAt) ||
			normalizeId(
				(payload as unknown as { recallDeadlineAt?: unknown }).recallDeadlineAt,
			)
		return {
			id: createLocalMessageId(),
			chatId,
			senderId: senderAccount === currentAccount ? 'me' : 'other',
			senderAccount,
			text: payload.content || '',
			timestamp: timeIdentity ? formatTimeFromIso(timeIdentity) : '',
			type: inferMessageType(
				payload.content || '',
				'type' in payload ? payload.type : undefined,
			),
			senderName:
				normalizeId(source.formName) ||
				normalizeId(source.fromName) ||
				normalizeId(source.fromRealName) ||
				normalizeId(source.fromNickname) ||
				normalizeId(source.fromUserName) ||
				normalizeId(fromNode?.formName) ||
				normalizeId(fromNode?.fromName) ||
				normalizeId(fromNode?.realName) ||
				normalizeId(fromNode?.nickName) ||
				normalizeId(fromNode?.nickname) ||
				normalizeId(fromNode?.userName) ||
				normalizeId(fromNode?.name) ||
				normalizeId(source.senderName) ||
				normalizeId(source.nickName) ||
				normalizeId(source.nickname) ||
				normalizeId(source.realName) ||
				normalizeId(source.userName) ||
				normalizeId(source.name) ||
				normalizeId(dataNode?.formName) ||
				normalizeId(dataNode?.fromName) ||
				normalizeId(dataNode?.fromRealName) ||
				normalizeId(dataNode?.fromNickname) ||
				normalizeId(dataNode?.fromUserName) ||
				normalizeId(dataNode?.senderName) ||
				normalizeId(dataNode?.nickName) ||
				normalizeId(dataNode?.nickname) ||
				normalizeId(dataNode?.realName) ||
				normalizeId(dataNode?.userName) ||
				normalizeId(dataNode?.name) ||
				extractScalarFromJsonText(payload.content, [
					'fromName',
					'senderName',
					'operatorName',
					'actorName',
					'name',
				]),
			senderAvatar:
				normalizeId(source.fromAvatarUrl) ||
				normalizeId(source.fromAvatar) ||
				normalizeId(fromNode?.fromAvatarUrl) ||
				normalizeId(fromNode?.fromAvatar) ||
				normalizeId(fromNode?.avatarUrl) ||
				normalizeId(fromNode?.avatar) ||
				normalizeId(fromNode?.userAvatarUrl) ||
				normalizeId(fromNode?.userAvatar) ||
				normalizeId(fromNode?.headImgUrl) ||
				normalizeId(fromNode?.headImg) ||
				normalizeId(source.senderAvatar) ||
				normalizeId(source.senderAvatarUrl) ||
				normalizeId(source.avatarUrl) ||
				normalizeId(source.avatar) ||
				normalizeId(source.userAvatarUrl) ||
				normalizeId(source.userAvatar) ||
				normalizeId(source.headImgUrl) ||
				normalizeId(source.headImg) ||
				normalizeId(dataNode?.fromAvatarUrl) ||
				normalizeId(dataNode?.fromAvatar) ||
				normalizeId(dataNode?.senderAvatar) ||
				normalizeId(dataNode?.senderAvatarUrl) ||
				normalizeId(dataNode?.avatarUrl) ||
				normalizeId(dataNode?.avatar) ||
				normalizeId(dataNode?.userAvatarUrl) ||
				normalizeId(dataNode?.userAvatar) ||
				normalizeId(dataNode?.headImgUrl) ||
				normalizeId(dataNode?.headImg) ||
				extractScalarFromJsonText(payload.content, [
					'fromAvatarUrl',
					'fromAvatar',
					'senderAvatarUrl',
					'senderAvatar',
					'avatarUrl',
					'avatar',
					'userAvatarUrl',
					'userAvatar',
					'headImgUrl',
					'headImg',
				]) ||
				findDeepScalarByKeys(source, [
					'fromAvatarUrl',
					'fromAvatarURL',
					'from_avatar_url',
					'senderAvatarUrl',
					'senderAvatar',
					'avatarUrl',
					'avatar',
					'userAvatarUrl',
					'userAvatar',
					'headImgUrl',
					'headImg',
				]),
			clientMessageId: normalizeId(payload.clientMessageId),
			serverMessageId: normalizedServerMessageId,
			deliveryStatus: 'sent',
			sentAt,
			reactions: fromServerReactionItems(source.reactions),
			quote,
			recalled,
			recalledAt,
			recallDeadlineAt,
		}
	}

	const buildMessageFingerprint = (item: Message): string => {
		const sentAt = item.sentAt?.trim() || ''
		const timestamp = item.timestamp?.trim() || ''
		const timeKey = sentAt || timestamp || 'no-time'
		const quoteKey = item.quote?.messageId?.trim() || ''
		return `${item.senderId}|${item.senderAccount || ''}|${item.type}|${timeKey}|${item.text || ''}|${quoteKey}`
	}

	const compactDuplicateMessages = (rows: Message[]): Message[] => {
		if (rows.length <= 1) return rows
		const seenLocalId = new Set<number>()
		const seenClientId = new Set<string>()
		const seenServerId = new Set<string>()
		const seenFingerprint = new Set<string>()
		const compacted: Message[] = []

		for (const row of rows) {
			const clientId = row.clientMessageId?.trim() || ''
			const serverId = row.serverMessageId?.trim() || ''
			const fingerprint = buildMessageFingerprint(row)
			const duplicatedByLocalId = seenLocalId.has(row.id)
			const duplicatedByClientId =
				!!clientId && seenClientId.has(clientId)
			const duplicatedByServerId =
				!!serverId && seenServerId.has(serverId)
			const duplicatedByFingerprint =
				!serverId &&
				!clientId &&
				!!fingerprint &&
				seenFingerprint.has(fingerprint)
			if (
				duplicatedByLocalId ||
				duplicatedByClientId ||
				duplicatedByServerId ||
				duplicatedByFingerprint
			) {
				continue
			}

			compacted.push(row)
			seenLocalId.add(row.id)
			if (clientId) seenClientId.add(clientId)
			if (serverId) seenServerId.add(serverId)
			if (fingerprint) seenFingerprint.add(fingerprint)
		}
		return compacted
	}

	const mergeMessagesToStore = (
		chatId: number,
		incomingMessages: Message[],
		position: 'append' | 'prepend' = 'append',
	): number => {
		if (!incomingMessages.length) return 0
		const debugEnabled = shouldLogChatMergeDebug()
		const existing = messages.value[chatId] || []
		const byLocalId = new Map<number, Message>()
		const byClientId = new Map<string, Message>()
		const byServerId = new Map<string, Message>()
		const fingerprintMap = new Map<string, Message>()
		for (const existingMessage of existing) {
			byLocalId.set(existingMessage.id, existingMessage)
			if (existingMessage.clientMessageId) {
				byClientId.set(existingMessage.clientMessageId, existingMessage)
			}
			if (existingMessage.serverMessageId) {
				byServerId.set(existingMessage.serverMessageId, existingMessage)
			}
			const key = buildMessageFingerprint(existingMessage)
			if (key) {
				fingerprintMap.set(key, existingMessage)
			}
		}
		const toInsert: Message[] = []
		let duplicatedByIdCount = 0
		let duplicatedByFingerprintCount = 0

		for (const item of incomingMessages) {
			item.clientMessageId =
				typeof item.clientMessageId === 'string'
					? item.clientMessageId.trim() || undefined
					: item.clientMessageId !== undefined &&
						  item.clientMessageId !== null
						? String(item.clientMessageId).trim() || undefined
						: undefined
			item.serverMessageId =
				typeof item.serverMessageId === 'string'
					? item.serverMessageId.trim() || undefined
					: item.serverMessageId !== undefined &&
						  item.serverMessageId !== null
						? String(item.serverMessageId).trim() || undefined
						: undefined
			const duplicatedByIds =
				byLocalId.get(item.id) ||
				(item.clientMessageId
					? byClientId.get(item.clientMessageId)
					: undefined) ||
				(item.serverMessageId
					? byServerId.get(item.serverMessageId)
					: undefined)
			const duplicatedByFingerprint =
				!duplicatedByIds &&
				!item.serverMessageId &&
				!item.clientMessageId
					? fingerprintMap.get(buildMessageFingerprint(item))
					: undefined
			const duplicated = duplicatedByIds || duplicatedByFingerprint
			if (duplicated) {
				if (duplicatedByIds) duplicatedByIdCount += 1
				else duplicatedByFingerprintCount += 1
				duplicated.serverMessageId =
					duplicated.serverMessageId || item.serverMessageId
				duplicated.clientMessageId =
					duplicated.clientMessageId || item.clientMessageId
				duplicated.sentAt = duplicated.sentAt || item.sentAt
				duplicated.deliveryStatus = item.deliveryStatus || 'sent'
				duplicated.hasResult = !!item.hasResult
				duplicated.result = item.result
				duplicated.senderAccount =
					duplicated.senderAccount || item.senderAccount
				duplicated.senderName = duplicated.senderName || item.senderName
				duplicated.senderAvatar =
					duplicated.senderAvatar || item.senderAvatar
				duplicated.quote = duplicated.quote || item.quote
				duplicated.recalled = Boolean(
					duplicated.recalled || item.recalled,
				)
				duplicated.recalledAt =
					duplicated.recalledAt || item.recalledAt
				duplicated.recallDeadlineAt =
					duplicated.recallDeadlineAt || item.recallDeadlineAt
				if (duplicated.recalled) {
					duplicated.reactions = []
					duplicated.quote = undefined
				}
				if (Array.isArray(item.reactions) && item.reactions.length) {
					duplicated.reactions = sanitizeMessageReactions(
						item.reactions,
					)
				}
				db.saveMessage(duplicated)
				continue
			}
			toInsert.push(item)
			byLocalId.set(item.id, item)
			if (item.clientMessageId) {
				byClientId.set(item.clientMessageId, item)
			}
			if (item.serverMessageId) {
				byServerId.set(item.serverMessageId, item)
			}
			const key = buildMessageFingerprint(item)
			if (key) {
				fingerprintMap.set(key, item)
			}
			db.saveMessage(item)
		}

		const inserted = toInsert.length
		const merged =
			position === 'prepend'
				? [...toInsert, ...existing]
				: [...existing, ...toInsert]
		merged.sort((a, b) => {
			const aTime = a.sentAt ? new Date(a.sentAt).getTime() : 0
			const bTime = b.sentAt ? new Date(b.sentAt).getTime() : 0
			if (aTime && bTime && aTime !== bTime) {
				return aTime - bTime
			}
			return a.id - b.id
		})
		const compacted = compactDuplicateMessages(merged)

		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId] = compacted
		if (debugEnabled) {
			console.info('[chat-merge-debug]', {
				chatId,
				position,
				incoming: incomingMessages.length,
				inserted,
				duplicatedById: duplicatedByIdCount,
				duplicatedByFingerprint: duplicatedByFingerprintCount,
				existingBefore: existing.length,
				totalAfter: compacted.length,
			})
		}
		return inserted
	}

	const isChatViewActive = (): boolean => {
		const hash = window.location.hash || ''
		return hash.includes('/home/chat') || hash.includes('/chat-standalone')
	}

	// --- 计算属性 ---
	const activeChat = computed(() => {
		return (
			chatlist.value.find((chat) => chat.id === activeChatId.value) ||
			null
		)
	})

	const activeChatMessages = computed(() => {
		if (!activeChatId.value) return []
		return messages.value[activeChatId.value] || []
	})

	// --- 数据库操作 (封装 IPC 调用) ---
	const db = {
		async getAllChats(): Promise<ChatItem[]> {
			const account = getCurrentAccount()
			const rawChats = await window.electron.ipcRenderer.invoke(
				'db-get-all-chats',
				account,
			)
			return (rawChats as DbChatItem[]).map((c) => ({
				...c,
				chatType: c.chatType === 'GROUP' ? 'GROUP' : 'PRIVATE',
				peerAccount: c.peerAccount || undefined,
				groupNo: c.groupNo || undefined,
				myRole: c.myRole || undefined,
				maxMembers:
					typeof c.maxMembers === 'number' ? c.maxMembers : undefined,
				memberCount:
					typeof c.memberCount === 'number'
						? c.memberCount
						: undefined,
				announcement: c.announcement || undefined,
				timestamp: c.lastMessageAt
					? formatTimeFromIso(c.lastMessageAt)
					: c.timestamp,
				avatar: isSystemAccount((c.peerAccount || '').trim())
					? resolveSystemChatAvatar()
					: c.avatar,
				online: !!c.online,
				isPinned: !!c.isPinned,
			}))
		},
		async getMessages(chatId: number): Promise<Message[]> {
			const account = getCurrentAccount()
			const rawMsgs = await window.electron.ipcRenderer.invoke(
				'db-get-messages',
				account,
				chatId,
			)
			return (rawMsgs as DbMessage[]).map(
				(m) =>
					({
						...m,
						timestamp: m.sentAt
							? formatTimeFromIso(m.sentAt)
							: m.timestamp,
						hasResult: !!m.hasResult,
						reactions: parseMessageReactions(m.reactions),
						quote: parseMessageQuoteFromDb(m),
						recalled: !!m.recalled,
						recalledAt: m.recalledAt || undefined,
						recallDeadlineAt: m.recallDeadlineAt || undefined,
					}) as Message,
			)
		},
		async getMessagesSegment(
			chatId: number,
			limit: number,
			offsetFromLatest: number,
		): Promise<Message[]> {
			const account = getCurrentAccount()
			const rawMsgs = await window.electron.ipcRenderer.invoke(
				'db-get-messages-segment',
				account,
				chatId,
				limit,
				offsetFromLatest,
			)
			return (rawMsgs as DbMessage[]).map(
				(m) =>
					({
						...m,
						timestamp: m.sentAt
							? formatTimeFromIso(m.sentAt)
							: m.timestamp,
						hasResult: !!m.hasResult,
						reactions: parseMessageReactions(m.reactions),
						quote: parseMessageQuoteFromDb(m),
						recalled: !!m.recalled,
						recalledAt: m.recalledAt || undefined,
						recallDeadlineAt: m.recallDeadlineAt || undefined,
					}) as Message,
			)
		},
		async searchMessages(
			keyword: string,
			limit = 60,
		): Promise<LocalMessageSearchResult[]> {
			const account = getCurrentAccount()
			return (await window.electron.ipcRenderer.invoke(
				'db-search-messages',
				account,
				keyword,
				limit,
			)) as LocalMessageSearchResult[]
		},
		saveChat(chat: ChatItem): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke('db-save-chat', account, {
				...chat,
				online: chat.online ? 1 : 0,
				isPinned: chat.isPinned ? 1 : 0,
			})
		},
		saveMessage(message: Message): void {
			const account = getCurrentAccount()
			const quote = normalizeMessageQuote(message.quote)
			const payload = {
				id: message.id,
				chatId: message.chatId,
				senderId: message.senderId,
				senderAccount: message.senderAccount,
				senderName: message.senderName,
				senderAvatar: message.senderAvatar,
				text: message.text,
				timestamp: message.timestamp,
				type: message.type,
				hasResult: message.hasResult ? 1 : 0,
				result: message.result,
				clientMessageId: message.clientMessageId,
				serverMessageId: message.serverMessageId,
				deliveryStatus: message.deliveryStatus,
				sentAt: message.sentAt,
				reactions: serializeMessageReactions(message.reactions),
				quotedMessageId: quote?.messageId || null,
				quotedFromAccount: quote?.from || null,
				quotedFromName: quote?.fromName || null,
				quotedContent: quote?.content || null,
				recalled: message.recalled ? 1 : 0,
				recalledAt: message.recalledAt || null,
				recallDeadlineAt: message.recallDeadlineAt || null,
			}
			window.electron.ipcRenderer.invoke('db-save-message', account, {
				...payload,
			})
		},
		updateLastMessage(
			id: number,
			text: string,
			time: string,
			lastMessageAt: string,
		): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke(
				'db-update-last-message',
				account,
				id,
				text,
				time,
				lastMessageAt,
			)
		},
		setPinned(id: number, isPinned: boolean): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke(
				'db-set-pinned',
				account,
				id,
				isPinned,
			)
		},
		clearChat(id: number): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke('db-clear-chat', account, id)
		},
		deleteChat(id: number): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke('db-delete-chat', account, id)
		},
	}

	const getTimeMs = (value?: string): number => {
		if (!value) return 0
		const ms = new Date(value).getTime()
		return Number.isFinite(ms) ? ms : 0
	}

	const hydrateSingleChatPreviewFromLatestMessage = async (
		chat: ChatItem,
	): Promise<boolean> => {
		try {
			const latestSegment = await db.getMessagesSegment(chat.id, 1, 0)
			if (!latestSegment.length) return false
			const latest = latestSegment[latestSegment.length - 1]
			const preview = getMessagePreview({
				text: latest.text || '',
				type: latest.type,
				senderId: latest.senderId,
			})
			const latestSentAt = latest.sentAt?.trim() || ''
			const latestTimeLabel =
				latest.timestamp ||
				(latestSentAt ? formatTimeFromIso(latestSentAt) : '')
			const currentLastMs = getTimeMs(chat.lastMessageAt)
			const latestMs = getTimeMs(latestSentAt)
			const hasNewerMessage = latestMs > currentLastMs
			const missingPreview = !chat.lastMessage?.trim()
			const missingTimeLabel = !chat.timestamp?.trim()

			if (!hasNewerMessage && !missingPreview && !missingTimeLabel) {
				return true
			}

			chat.lastMessage = preview || chat.lastMessage || ''
			chat.timestamp =
				latestTimeLabel || chat.timestamp || formatTimeFromIso()
			if (latestSentAt) {
				chat.lastMessageAt = latestSentAt
			}
			db.saveChat(chat)
			return true
		} catch (error) {
			console.warn('回填会话最新消息预览失败:', chat.id, error)
			return false
		}
	}

	const resolveLatestPreviewBeforeCreate = async (
		chatId: number,
	): Promise<{
		preview: string
		timeLabel: string
		sentAt?: string
	} | null> => {
		try {
			const latestSegment = await db.getMessagesSegment(chatId, 1, 0)
			if (latestSegment.length) {
				const latest = latestSegment[latestSegment.length - 1]
				const sentAt = latest.sentAt?.trim() || undefined
				return {
					preview: getMessagePreview({
						text: latest.text || '',
						type: latest.type,
						senderId: latest.senderId,
					}),
					timeLabel:
						latest.timestamp ||
						(sentAt ? formatTimeFromIso(sentAt) : ''),
					sentAt,
				}
			}
		} catch (error) {
			console.warn('创建会话前读取本地最新消息失败:', chatId, error)
		}

		try {
			const data = await pullChatHistory(chatId, {
				page: 1,
				size: 20,
				appendToStore: false,
			})
			const rows = Array.isArray(data.messages) ? data.messages : []
			if (!rows.length) return null
			let currentAccount = ''
			try {
				currentAccount = getCurrentAccount()
			} catch {
				currentAccount = ''
			}
			const mapped = rows.map((item) =>
				createLocalMessageFromServer(item, chatId, currentAccount),
			)
			if (!mapped.length) return null
			mapped.sort((a, b) => {
				const aMs = getTimeMs(a.sentAt)
				const bMs = getTimeMs(b.sentAt)
				if (aMs !== bMs) return aMs - bMs
				return a.id - b.id
			})
			const latest = mapped[mapped.length - 1]
			const sentAt = latest.sentAt?.trim() || undefined
			return {
				preview: getMessagePreview({
					text: latest.text || '',
					type: latest.type,
					senderId: latest.senderId,
				}),
				timeLabel:
					latest.timestamp ||
					(sentAt ? formatTimeFromIso(sentAt) : ''),
				sentAt,
			}
		} catch (error) {
			console.warn('创建会话前拉取远端最新消息失败:', chatId, error)
			return null
		}
	}

	const hydrateChatPreviewFromLatestMessage = async (
		chats: ChatItem[],
	): Promise<void> => {
		await Promise.all(
			chats.map(async (chat) => {
				await hydrateSingleChatPreviewFromLatestMessage(chat)
			}),
		)
	}

	// --- 初始化逻辑 ---
	const init = async (): Promise<void> => {
		const account = getCurrentAccount()
		if (isDbInitialized.value && initializedAccount.value === account)
			return

		// 账号切换时清空内存，防止跨账号串数据
		activeChatId.value = null
		drafts.value = {}
		chatlist.value = []
		pinnedChats.value = []
		messages.value = {}
		pendingMessageMap.value.clear()
		historyPaginationMap.value.clear()
		localHistoryCursorMap.value.clear()
		loadingHistoryChatIds.value.clear()
		hydratedHistoryChatIds.value.clear()

		const chats = await db.getAllChats()
		for (const chat of chats) {
			if (!isSystemNotificationChatItem(chat)) continue
			const nextAvatar = resolveSystemChatAvatar()
			if (chat.avatar === nextAvatar) continue
			chat.avatar = nextAvatar
			db.saveChat(chat)
		}
		await hydrateChatPreviewFromLatestMessage(chats)
		chatlist.value = chats
		pinnedChats.value = chats.filter((c) => c.isPinned)
		await ensureFriendDataReady()
		syncChatProfilesWithFriends()
		initializedAccount.value = account
		isDbInitialized.value = true
		bindPrivateChatWs()
		bindGroupChatWs()
		await pullOfflineMessages()
	}

	// --- 跨窗口同步逻辑 ---
	const syncAction = (
		action: string,
		data: Record<string, unknown>,
	): void => {
		if (window.electron && window.electron.ipcRenderer) {
			let scope = ''
			try {
				scope = getCurrentAccount()
			} catch {
				return
			}
			window.electron.ipcRenderer.send('sync-store', {
				action,
				data,
				scope,
			})
		}
	}

	const requestFullState = (): void => {
		if (window.electron && window.electron.ipcRenderer) {
			window.electron.ipcRenderer.send('request-store-data')
		}
	}

	const ensureFriendDataReady = async (): Promise<void> => {
		let account = ''
		try {
			account = getCurrentAccount()
		} catch {
			return
		}

		if (
			friendStore.friends.length > 0 &&
			friendsLoadedAccount.value === account
		) {
			return
		}
		if (loadingFriendsPromise) {
			await loadingFriendsPromise
			return
		}

		loadingFriendsPromise = friendStore.fetchFriends()
		try {
			const ok = await loadingFriendsPromise
			if (ok) {
				friendsLoadedAccount.value = account
			}
		} finally {
			loadingFriendsPromise = null
		}
	}

	const syncChatProfilesWithFriends = (): void => {
		if (!chatlist.value.length || !friendStore.friends.length) return
		const friendMap = new Map(
			friendStore.friends.map((friend) => [friend.id, friend]),
		)

		for (const chat of chatlist.value) {
			if (chat.chatType === 'GROUP') continue
			const friend = friendMap.get(chat.peerAccount || String(chat.id))
			if (!friend) continue

			const friendAvatar = resolveAvatarUrl(friend.avatar)
			const friendName = friend.name?.trim() || ''
			const friendOnline = friend.status === 'online'
			const shouldUpdateAvatar =
				chat.avatar !== friendAvatar &&
				(!chat.avatar.trim() ||
					isDicebearAvatarUrl(chat.avatar) ||
					isDefaultAvatarUrl(chat.avatar))
			const shouldUpdateName = !!friendName && chat.name !== friendName
			const shouldUpdateOnline = chat.online !== friendOnline
			if (!shouldUpdateAvatar && !shouldUpdateName && !shouldUpdateOnline)
				continue

			if (shouldUpdateAvatar) {
				chat.avatar = friendAvatar
			}
			if (shouldUpdateName) {
				chat.name = friendName
			}
			if (shouldUpdateOnline) {
				chat.online = friendOnline
			}
			db.saveChat(chat)
		}
	}

	const ensureChatSession = async (
		account: string,
	): Promise<number | null> => {
		const normalizedAccount = normalizeAccount(account)
		if (!normalizedAccount) return null

		if (isSystemAccount(normalizedAccount)) {
			const existingSystemChat = findSystemNotificationChat()
			if (existingSystemChat) {
				const nextAvatar = resolveSystemChatAvatar()
				if (existingSystemChat.avatar !== nextAvatar) {
					existingSystemChat.avatar = nextAvatar
					db.saveChat(existingSystemChat)
				}
				await hydrateSingleChatPreviewFromLatestMessage(
					existingSystemChat,
				)
				return existingSystemChat.id
			}
			const systemChat: ChatItem = {
				id: allocateSystemChatId(),
				chatType: 'PRIVATE',
				peerAccount: SYSTEM_ACCOUNT,
				name: SYSTEM_CHAT_NAME,
				avatar: resolveSystemChatAvatar(),
				lastMessage: '',
				timestamp: formatTimeFromIso(),
				lastMessageAt: new Date().toISOString(),
				online: true,
				unreadCount: 0,
				isPinned: false,
			}
			chatlist.value.unshift(systemChat)
			db.saveChat(systemChat)
			return systemChat.id
		}

		const chatId = derivePrivateChatId(normalizedAccount)
		if (!chatId) return null

		let existing =
			findPrivateChatByAccount(normalizedAccount) ||
			chatlist.value.find(
				(item) => item.chatType !== 'GROUP' && item.id === chatId,
			)
		if (existing) {
			await hydrateSingleChatPreviewFromLatestMessage(existing)
			return existing.id
		}

		const friend = friendStore.friends.find(
			(item) => item.id === normalizedAccount,
		)
		const newChat: ChatItem = {
			id: chatId,
			chatType: 'PRIVATE',
			peerAccount: normalizedAccount,
			name: friend?.name || normalizedAccount,
			avatar: resolveAvatarUrl(friend?.avatar),
			lastMessage: '',
			timestamp: formatTimeFromIso(),
			lastMessageAt: new Date().toISOString(),
			online: friend?.status === 'online',
			unreadCount: 0,
			isPinned: false,
		}
		chatlist.value.unshift(newChat)
		db.saveChat(newChat)
		existing = newChat
		void hydrateSingleChatPreviewFromLatestMessage(existing)
		return existing.id
	}

	const handleIncomingWsMessage = async (
		payload: PrivateChatMessageFrame,
	): Promise<void> => {
		const debugSystemNotice = shouldLogSystemNoticeDebug()
		if (import.meta.env.DEV) {
			try {
				console.info('[debug][ws-private-in]', payload)
			} catch {
				// ignore
			}
		}
		const normalizeId = (value: unknown): string => {
			if (value === null || value === undefined) return ''
			return String(value).trim()
		}
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			return
		}
		const senderAccount = normalizeAccount(payload.from)
		if (isSystemAccount(senderAccount)) {
			const momentStore = useMomentStore()
			momentStore.handleSystemNotificationMessage({
				from: senderAccount,
				content: payload.content,
				messageId: payload.messageId,
				sentAt: payload.sentAt,
			})
			if (debugSystemNotice) {
				console.info('[system-notice-debug][ws-private][incoming]', {
					messageId: payload.messageId,
					from: payload.from,
					fromAvatarUrl: (payload as unknown as Record<string, unknown>)
						.fromAvatarUrl,
					senderAvatarUrl: (payload as unknown as Record<string, unknown>)
						.senderAvatarUrl,
					content: payload.content,
				})
			}
		}

		const peerAccount =
			payload.from === currentAccount ? payload.to : payload.from
		const chatId = await ensureChatSession(peerAccount)
		if (!chatId) return

		const incomingClientMessageId = normalizeId(payload.clientMessageId)
		const incomingServerMessageId =
			extractMessageIdFromPayload(payload) || normalizeId(payload.messageId)
		const existingList = messages.value[chatId] || []
		const duplicatedByIdentity = existingList.find(
			(item) =>
				(!!incomingClientMessageId &&
					item.clientMessageId === incomingClientMessageId) ||
				(!!incomingServerMessageId &&
					item.serverMessageId === incomingServerMessageId),
		)
		if (duplicatedByIdentity) {
			// 发送方回显或重复消息，合并服务器返回字段并标记 sent，避免消息被“覆盖感知”
			if (duplicatedByIdentity) {
				const hydratedFromPayload = createLocalMessageFromServer(
					payload,
					chatId,
					currentAccount,
				)
				duplicatedByIdentity.serverMessageId =
					duplicatedByIdentity.serverMessageId ||
					incomingServerMessageId ||
					undefined
				duplicatedByIdentity.sentAt =
					duplicatedByIdentity.sentAt || payload.sentAt || undefined
				duplicatedByIdentity.senderAccount =
					duplicatedByIdentity.senderAccount ||
					hydratedFromPayload.senderAccount
				duplicatedByIdentity.senderName =
					duplicatedByIdentity.senderName ||
					hydratedFromPayload.senderName
				duplicatedByIdentity.senderAvatar =
					duplicatedByIdentity.senderAvatar ||
					hydratedFromPayload.senderAvatar
				duplicatedByIdentity.quote =
					duplicatedByIdentity.quote || hydratedFromPayload.quote
				duplicatedByIdentity.recalled = Boolean(
					duplicatedByIdentity.recalled ||
						hydratedFromPayload.recalled,
				)
				duplicatedByIdentity.recalledAt =
					duplicatedByIdentity.recalledAt ||
					hydratedFromPayload.recalledAt
				duplicatedByIdentity.recallDeadlineAt =
					duplicatedByIdentity.recallDeadlineAt ||
					hydratedFromPayload.recallDeadlineAt
				if (duplicatedByIdentity.recalled) {
					duplicatedByIdentity.reactions = []
					duplicatedByIdentity.quote = undefined
				}
				duplicatedByIdentity.deliveryStatus = 'sent'
				duplicatedByIdentity.hasResult = false
				duplicatedByIdentity.result = undefined
				if (debugSystemNotice && isSystemAccount(senderAccount)) {
					console.info('[system-notice-debug][ws-private][dedup-merge]', {
						messageId: payload.messageId,
						serverMessageId: incomingServerMessageId,
						mergedSenderAvatar:
							duplicatedByIdentity.senderAvatar || '',
						hydratedSenderAvatar:
							hydratedFromPayload.senderAvatar || '',
					})
				}
				db.saveMessage(duplicatedByIdentity)
			}
			if (incomingClientMessageId)
				pendingMessageMap.value.delete(incomingClientMessageId)
			return
		}

		const newMessage = createLocalMessageFromServer(
			payload,
			chatId,
			currentAccount,
		)
		if (debugSystemNotice && isSystemAccount(senderAccount)) {
			console.info('[system-notice-debug][ws-private][new-message]', {
				messageId: payload.messageId,
				serverMessageId: newMessage.serverMessageId,
				senderAvatar: newMessage.senderAvatar || '',
				senderName: newMessage.senderName || '',
			})
		}

		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId].push(newMessage)
		db.saveMessage(newMessage)

		const preview = getMessagePreview(newMessage)
		updateLastMessageLocal(
			chatId,
			preview,
			newMessage.timestamp,
			true,
			newMessage.sentAt,
		)

		const chat = chatlist.value.find((item) => item.id === chatId)
		const isReadingCurrentChat =
			isChatViewActive() && activeChatId.value === chatId
		if (chat && newMessage.senderId === 'other' && !isReadingCurrentChat) {
			chat.unreadCount = (chat.unreadCount || 0) + 1
			db.saveChat(chat)
			triggerSystemMessageReminder({
				chatName: chat.name || '联系人',
				messageText: preview,
			})
		}
	}

	const upsertGroupSession = async (
		detail: GroupDetail,
	): Promise<number | null> => {
		const groupNo = detail.groupNo?.trim() || ''
		if (!groupNo) return null
		const existing = findGroupChatByNo(groupNo)
		const derivedId = deriveGroupChatId(groupNo)
		const chatId = existing?.id ?? derivedId
		if (!chatId) return null

		const nextChat: ChatItem = {
			id: chatId,
			chatType: 'GROUP',
			groupNo,
			myRole: detail.myRole,
			maxMembers: detail.maxMembers,
			memberCount: detail.memberCount,
			announcement: detail.announcement,
			name: detail.groupName || existing?.name || `群聊 ${groupNo}`,
			avatar: resolveGroupAvatar(detail, existing?.avatar || ''),
			lastMessage: existing?.lastMessage || '',
			timestamp: existing?.timestamp || formatTimeFromIso(),
			lastMessageAt:
				existing?.lastMessageAt || detail.updatedAt || detail.createdAt,
			online: true,
			unreadCount: existing?.unreadCount || 0,
			isPinned: existing?.isPinned || false,
		}

		if (existing) {
			Object.assign(existing, nextChat)
			db.saveChat(existing)
			return existing.id
		}

		chatlist.value.unshift(nextChat)
		db.saveChat(nextChat)
		return nextChat.id
	}

	const scheduleGroupSessionSyncByNo = (groupNo: string): void => {
		const normalized = groupNo.trim()
		if (!normalized) return
		const now = Date.now()
		const lastSyncAt = groupSessionSyncAtMap.get(normalized) || 0
		if (now - lastSyncAt < GROUP_SESSION_SYNC_INTERVAL_MS) return
		groupSessionSyncAtMap.set(normalized, now)
		void syncGroupSessionByNo(normalized)
	}

	const fetchGroupDetailForSession = async (
		groupNo: string,
	): Promise<GroupDetail | null> => {
		const normalized = groupNo.trim()
		if (!normalized) return null
		const response = await groupChatApi.getGroup(normalized)
		const detail = response.data?.data
		if (!detail) return null
		try {
			const profileRes = await groupChatApi.getGroupProfile(normalized)
			const profile = profileRes.data?.data
			const avatarFromProfile = profile?.groupAvatarUrl?.trim() || ''
			if (avatarFromProfile) detail.groupAvatarUrl = avatarFromProfile
			const groupNameFromProfile = profile?.groupName?.trim() || ''
			if (groupNameFromProfile) detail.groupName = groupNameFromProfile
		} catch (profileError) {
			console.warn(
				'读取群 profile 失败，回退 settings/detail:',
				normalized,
				profileError,
			)
			try {
				const settingsRes =
					await groupChatApi.getGroupSettingsDetail(normalized)
				const profile = settingsRes.data?.data?.groupProfile
				const avatarFromProfile = profile?.groupAvatarUrl?.trim() || ''
				if (avatarFromProfile) detail.groupAvatarUrl = avatarFromProfile
				const groupNameFromProfile = profile?.groupName?.trim() || ''
				if (groupNameFromProfile)
					detail.groupName = groupNameFromProfile
			} catch (error) {
				console.warn(
					'补充群资料失败(使用基础群信息继续):',
					normalized,
					error,
				)
			}
		}
		return detail
	}

	const ensureGroupSession = async (
		groupNo: string,
	): Promise<number | null> => {
		const normalized = groupNo.trim()
		if (!normalized) return null
		const existing = findGroupChatByNo(normalized)
		if (existing) {
			scheduleGroupSessionSyncByNo(normalized)
			await hydrateSingleChatPreviewFromLatestMessage(existing)
			return existing.id
		}
		try {
			const detail = await fetchGroupDetailForSession(normalized)
			if (detail) {
				return await upsertGroupSession(detail)
			}
		} catch (error) {
			console.warn('拉取群信息失败，使用兜底会话创建:', normalized, error)
		}
		const fallbackId = deriveGroupChatId(normalized)
		if (!fallbackId) return null
		const fallbackChat: ChatItem = {
			id: fallbackId,
			chatType: 'GROUP',
			groupNo: normalized,
			name: `群聊 ${normalized}`,
			avatar: '',
			lastMessage: '',
			timestamp: formatTimeFromIso(),
			lastMessageAt: new Date().toISOString(),
			online: true,
			unreadCount: 0,
			isPinned: false,
		}
		chatlist.value.unshift(fallbackChat)
		db.saveChat(fallbackChat)
		return fallbackChat.id
	}

	const syncGroupSessionByNo = async (groupNo: string): Promise<void> => {
		const normalized = groupNo.trim()
		if (!normalized) return
		try {
			const detail = await fetchGroupDetailForSession(normalized)
			if (detail) {
				await upsertGroupSession(detail)
			}
		} catch (error) {
			console.warn('同步群信息失败:', normalized, error)
		}
	}

	const fetchAllJoinedGroupNos = async (
		keyword?: string,
	): Promise<string[]> => {
		const normalizedKeyword = keyword?.trim() || undefined
		const pageSize = 100
		const maxPages = 50
		const groupNoSet = new Set<string>()
		let page = 1
		let hasMore = true
		while (hasMore && page <= maxPages) {
			const response = await groupChatApi.getJoinedGroups({
				page,
				size: pageSize,
				keyword: normalizedKeyword,
			})
			const payload = response.data?.data
			const records = Array.isArray(payload?.records)
				? payload.records
				: Array.isArray(payload?.list)
					? payload.list
					: []
			for (const item of records) {
				const groupNo = item?.groupNo?.trim()
				if (groupNo) groupNoSet.add(groupNo)
			}
			const hasMoreFromApi =
				typeof payload?.hasMore === 'boolean'
					? payload.hasMore
					: undefined
			const totalPages = Number(payload?.totalPages || 0)
			const reachedTail = records.length < pageSize
			if (typeof hasMoreFromApi === 'boolean') {
				hasMore = hasMoreFromApi
			} else if (totalPages > 0) {
				hasMore = page < totalPages
			} else {
				hasMore = !reachedTail
			}
			page += 1
		}
		return Array.from(groupNoSet)
	}

	const handleIncomingGroupWsMessage = async (
		payload: GroupChatMessageFrame,
	): Promise<void> => {
		if (import.meta.env.DEV) {
			try {
				console.info('[debug][ws-group-in]', payload)
			} catch {
				// ignore
			}
		}
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			return
		}
		const chatId = await ensureGroupSession(payload.groupNo)
		if (!chatId) return
		scheduleGroupSessionSyncByNo(payload.groupNo)
		const incomingClientMessageId = payload.clientMessageId?.trim() || ''
		const incomingServerMessageId =
			extractMessageIdFromPayload(payload) || payload.messageId?.trim() || ''
		const existingList = messages.value[chatId] || []
		const duplicatedByIdentity = existingList.find(
			(item) =>
				(!!incomingClientMessageId &&
					item.clientMessageId === incomingClientMessageId) ||
				(!!incomingServerMessageId &&
					item.serverMessageId === incomingServerMessageId),
		)
		if (duplicatedByIdentity) {
			const hydratedFromPayload = createLocalMessageFromServer(
				payload,
				chatId,
				currentAccount,
			)
			duplicatedByIdentity.serverMessageId =
				duplicatedByIdentity.serverMessageId ||
				incomingServerMessageId ||
				undefined
			duplicatedByIdentity.sentAt =
				duplicatedByIdentity.sentAt || payload.sentAt || undefined
			duplicatedByIdentity.senderAccount =
				duplicatedByIdentity.senderAccount ||
				hydratedFromPayload.senderAccount
			duplicatedByIdentity.senderName =
				duplicatedByIdentity.senderName || hydratedFromPayload.senderName
			duplicatedByIdentity.senderAvatar =
				duplicatedByIdentity.senderAvatar ||
				hydratedFromPayload.senderAvatar
			duplicatedByIdentity.quote =
				duplicatedByIdentity.quote || hydratedFromPayload.quote
			duplicatedByIdentity.recalled = Boolean(
				duplicatedByIdentity.recalled || hydratedFromPayload.recalled,
			)
			duplicatedByIdentity.recalledAt =
				duplicatedByIdentity.recalledAt || hydratedFromPayload.recalledAt
			duplicatedByIdentity.recallDeadlineAt =
				duplicatedByIdentity.recallDeadlineAt ||
				hydratedFromPayload.recallDeadlineAt
			if (duplicatedByIdentity.recalled) {
				duplicatedByIdentity.reactions = []
				duplicatedByIdentity.quote = undefined
			}
			duplicatedByIdentity.deliveryStatus = 'sent'
			duplicatedByIdentity.hasResult = false
			duplicatedByIdentity.result = undefined
			if (Array.isArray(hydratedFromPayload.reactions)) {
				duplicatedByIdentity.reactions = sanitizeMessageReactions(
					hydratedFromPayload.reactions,
				)
			}
			db.saveMessage(duplicatedByIdentity)
			if (incomingClientMessageId) {
				pendingMessageMap.value.delete(incomingClientMessageId)
			}
			return
		}

		const newMessage = createLocalMessageFromServer(
			payload,
			chatId,
			currentAccount,
		)
		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId].push(newMessage)
		db.saveMessage(newMessage)

		const preview = getMessagePreview(newMessage)
		updateLastMessageLocal(
			chatId,
			preview,
			newMessage.timestamp,
			true,
			newMessage.sentAt,
		)

		const chat = chatlist.value.find((item) => item.id === chatId)
		const isReadingCurrentChat =
			isChatViewActive() && activeChatId.value === chatId
		const mentionMe =
			newMessage.senderId === 'other' &&
			isMentioningCurrentUser(
				newMessage.text || '',
				currentAccount,
				userInfoStore.userName || '',
			)
		if (chat && newMessage.senderId === 'other' && !isReadingCurrentChat) {
			chat.unreadCount = (chat.unreadCount || 0) + 1
			if (mentionMe) {
				chat.mentionUnreadCount = (chat.mentionUnreadCount || 0) + 1
			}
			db.saveChat(chat)
			triggerSystemMessageReminder({
				chatName: chat.name || '群聊',
				messageText: mentionMe ? `[有人@你] ${preview}` : preview,
			})
		}
	}

	const pullOfflineMessages = async (): Promise<void> => {
		let account = ''
		try {
			account = getCurrentAccount()
		} catch {
			return
		}
		if (offlinePulledAccount.value === account) return

		const token = getCurrentToken()
		if (!token) return

		try {
			const response =
				await request.get<OfflineMessagePullResponse>(
					'/messages/offline',
				)
			const offlineMessages = response.data?.data?.messages || []
			for (const offlineMessage of offlineMessages) {
				await handleIncomingWsMessage(offlineMessage)
			}
			offlinePulledAccount.value = account
		} catch (error) {
			console.warn('拉取离线消息失败:', error)
		}
	}

	const pullChatHistory = async (
		chatId: number,
		options: PullChatHistoryOptions = {},
	): Promise<ChatHistoryPageData> => {
		const page = Math.max(1, options.page || 1)
		const size = Math.max(1, Math.min(100, options.size || 20))
		const startDate = normalizeDateInput(options.startDate)
		const endDate = normalizeDateInput(options.endDate)
		const keyword = options.keyword?.trim() || undefined
		const messageType =
			options.type && options.type !== 'all' ? options.type : undefined
		const currentChat = chatlist.value.find((item) => item.id === chatId)
		const groupNo = options.groupNo || currentChat?.groupNo || ''
		const isGroupChat =
			currentChat?.chatType === 'GROUP' && !!groupNo.trim()
		if (isSystemNotificationChatItem(currentChat)) {
			historyPaginationMap.value.set(chatId, {
				nextPage: 1,
				hasMore: false,
			})
			return {
				messages: [],
				page: 1,
				size,
				total: messages.value[chatId]?.length || 0,
				totalPages: 1,
				hasMore: false,
			}
		}
		let data: ChatHistoryPageData | GroupHistoryPageData = {}
		let rawMessages: (HistoryMessageDto | GroupHistoryMessageDto)[] = []
		if (isGroupChat) {
			const response = await groupChatApi.getGroupMessageHistory(
				groupNo,
				page,
				size,
			)
			data = response.data?.data || {}
			rawMessages = Array.isArray(data.messages) ? data.messages : []
		} else {
			const response = await request.get<
				ApiResponse<ChatHistoryPageData>
			>(`/messages/history/${chatId}`, {
				params: {
					page,
					size,
					startDate,
					endDate,
					type: messageType,
					keyword,
				},
			})
			data = response.data?.data || {}
			rawMessages = Array.isArray(data.messages) ? data.messages : []
		}
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			currentAccount = ''
		}
		const mappedMessages = rawMessages.map((item) =>
			createLocalMessageFromServer(item, chatId, currentAccount),
		)
		const filtered = mappedMessages.filter((item) =>
			matchesMessageFilters(item, {
				startDate,
				endDate,
				type: options.type,
				keyword,
			}),
		)

		if (options.appendToStore !== false && filtered.length) {
			const currentPage = page
			mergeMessagesToStore(
				chatId,
				filtered,
				currentPage > 1 ? 'prepend' : 'append',
			)
		}

		const serverPage =
			typeof data.page === 'number' && data.page > 0 ? data.page : page
		const resolvedPage = Math.max(page, serverPage)
		const hasMore =
			typeof data.hasMore === 'boolean'
				? data.hasMore
				: typeof data.totalPages === 'number'
					? resolvedPage < data.totalPages
					: rawMessages.length >= size
		historyPaginationMap.value.set(chatId, {
			nextPage: resolvedPage + 1,
			hasMore,
		})

		return {
			...data,
			messages: rawMessages as HistoryMessageDto[],
		}
	}

	const loadMoreChatHistory = async (
		chatId: number,
		size = 20,
	): Promise<boolean> => {
		const localPagination = localHistoryCursorMap.value.get(chatId)
		const remotePagination = historyPaginationMap.value.get(chatId)
		if (loadingHistoryChatIds.value.has(chatId)) {
			return !!localPagination?.hasMore || !!remotePagination?.hasMore
		}

		// 优先分页读取本地历史，滚动加载更平滑。
		if (localPagination?.hasMore) {
			loadingHistoryChatIds.value.add(chatId)
			try {
				try {
					const segment = await db.getMessagesSegment(
						chatId,
						size,
						localPagination.nextOffsetFromLatest,
					)
					if (segment.length) {
						mergeMessagesToStore(chatId, segment, 'prepend')
					}
					localHistoryCursorMap.value.set(chatId, {
						nextOffsetFromLatest:
							localPagination.nextOffsetFromLatest +
							segment.length,
						hasMore: segment.length >= size,
					})
					return segment.length >= size || !!remotePagination?.hasMore
				} catch (error) {
					// 分段 IPC 不可用时兜底回退，避免历史消息空白。
					console.warn(
						'分段读取本地聊天记录失败，回退全量读取:',
						error,
					)
					const allLocal = await db.getMessages(chatId)
					if (allLocal.length) {
						mergeMessagesToStore(chatId, allLocal, 'append')
					}
					localHistoryCursorMap.value.set(chatId, {
						nextOffsetFromLatest: allLocal.length,
						hasMore: false,
					})
					return !!remotePagination?.hasMore
				}
			} finally {
				loadingHistoryChatIds.value.delete(chatId)
			}
		}

		if (remotePagination && !remotePagination.hasMore) return false
		const targetPage = remotePagination?.nextPage || 2
		loadingHistoryChatIds.value.add(chatId)
		try {
			const data = await pullChatHistory(chatId, {
				page: targetPage,
				size,
				appendToStore: true,
			})
			return !!data.hasMore
		} finally {
			loadingHistoryChatIds.value.delete(chatId)
		}
	}

	const queryChatHistory = async (
		chatId: number,
		options: QueryChatHistoryOptions = {},
	): Promise<QueryChatHistoryResult> => {
		const pageSize = Math.max(1, Math.min(100, options.pageSize || 50))
		const maxPages = Math.max(1, options.maxPages || 5)
		const startDate = normalizeDateInput(options.startDate)
		const endDate = normalizeDateInput(options.endDate)
		const keyword = options.keyword?.trim() || undefined
		const filterType = options.type || 'all'

		const matched: Message[] = []
		const seen = new Set<string>()
		let page = 1
		let hasMore = true
		let pagesScanned = 0

		const getSearchDedupKey = (item: Message): string => {
			const serverId = item.serverMessageId?.trim() || ''
			if (serverId) return `s:${serverId}`
			const clientId = item.clientMessageId?.trim() || ''
			if (clientId) return `c:${clientId}`
			return `f:${item.chatId}|${item.senderId}|${item.sentAt || item.timestamp}|${item.text || ''}`
		}

		const pushFilteredRows = (rows: Message[]): void => {
			for (const message of rows) {
				const key = getSearchDedupKey(message)
				if (seen.has(key)) continue
				seen.add(key)
				matched.push(message)
			}
		}

		// 优先尝试远端查询，兼容分页历史。
		try {
			while (hasMore && pagesScanned < maxPages) {
				const data = await pullChatHistory(chatId, {
					groupNo: options.groupNo,
					page,
					size: pageSize,
					// 查询只返回结果，避免本地写入失败影响查询弹窗展示
					appendToStore: false,
					startDate,
					endDate,
					type: filterType,
					keyword,
				})
				const rows = Array.isArray(data.messages) ? data.messages : []
				let currentAccount = ''
				try {
					currentAccount = getCurrentAccount()
				} catch {
					currentAccount = ''
				}
				const mapped = rows.map((item) =>
					createLocalMessageFromServer(item, chatId, currentAccount),
				)
				const filtered = mapped.filter((message) =>
					matchesMessageFilters(message, {
						startDate,
						endDate,
						type: filterType,
						keyword,
					}),
				)
				pushFilteredRows(filtered)

				page += 1
				pagesScanned += 1
				hasMore = !!data.hasMore
			}
		} catch (error) {
			console.warn('远端查询聊天记录失败，回退本地检索:', error)
			hasMore = false
		}

		// 追加本地落库检索，确保未同步远端或离线消息也可命中。
		try {
			const localRows = await db.getMessages(chatId)
			const filteredLocalRows = localRows.filter((message) =>
				matchesMessageFilters(message, {
					startDate,
					endDate,
					type: filterType,
					keyword,
				}),
			)
			pushFilteredRows(filteredLocalRows)
		} catch (error) {
			console.warn('本地检索聊天记录失败:', error)
		}

		matched.sort((a, b) => {
			const ta = new Date(a.sentAt || a.timestamp || '').getTime()
			const tb = new Date(b.sentAt || b.timestamp || '').getTime()
			return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
		})

		return {
			messages: matched,
			pagesScanned,
			hasMore,
			totalMatched: matched.length,
		}
	}

	const searchLocalMessagesGlobal = async (
		keyword: string,
		limit = 60,
	): Promise<GlobalMessageSearchHit[]> => {
		const normalized = keyword.trim()
		if (!normalized) return []
		const rows = await db.searchMessages(normalized, limit)
		return rows.map((row) => ({
			chatId: row.chatId,
			chatName: row.chatName || '未知会话',
			message: {
				id: row.id,
				chatId: row.chatId,
				senderId: row.senderId,
				text: row.text,
				timestamp: row.sentAt
					? formatTimeFromIso(row.sentAt)
					: row.timestamp,
				type: inferMessageType(row.text, row.type),
				hasResult: !!row.hasResult,
				result: row.result,
				clientMessageId: row.clientMessageId,
				serverMessageId: row.serverMessageId,
				deliveryStatus: row.deliveryStatus,
				sentAt: row.sentAt,
				quote: parseMessageQuoteFromDb(row),
				recalled: !!row.recalled,
				recalledAt: row.recalledAt || undefined,
				recallDeadlineAt: row.recallDeadlineAt || undefined,
			} as Message,
		}))
	}

	const getComposerQuote = (chatId: number): ComposerMessageQuote | null => {
		if (!chatId) return null
		return composingQuoteMap.value[chatId] || null
	}

	const clearComposerQuote = (chatId: number): void => {
		if (!chatId) return
		composingQuoteMap.value[chatId] = null
	}

	const setComposerQuoteFromMessage = (
		chatId: number,
		source: Message,
	): boolean => {
		const messageId =
			source.serverMessageId?.trim() ||
			source.clientMessageId?.trim() ||
			String(source.id || '').trim()
		if (!chatId || !messageId) return false
		const isImageContent =
			source.type === 'image' || /<img\b[^>]*>/i.test(source.text || '')
		const contentSnapshot = isImageContent
			? '[图片]'
			: source.text || ''
		const fromName =
			source.senderName?.trim() ||
			source.senderAccount?.trim() ||
			(source.senderId === 'me'
				? userInfoStore.userName?.trim() || userInfoStore.account || ''
				: '')
		composingQuoteMap.value[chatId] = {
			messageId,
			from: source.senderAccount?.trim() || undefined,
			fromName: fromName || undefined,
			content: contentSnapshot,
		}
		return true
	}

	const handleWsAck = (payload: PrivateChatAckFrame): void => {
		const clientMessageId = payload.clientMessageId || ''
		if (!clientMessageId) return
		const pending = pendingMessageMap.value.get(clientMessageId)
		if (!pending) return
		updateMessageStatusLocal(
			pending.chatId,
			clientMessageId,
			'sent',
			undefined,
			payload.messageId,
			payload.ackAt,
		)
		pendingMessageMap.value.delete(clientMessageId)
		syncAction('updateMessageStatus', {
			chatId: pending.chatId,
			clientMessageId,
			status: 'sent',
			serverMessageId: payload.messageId,
			ackAt: payload.ackAt,
		})
	}

	const handleGroupWsAck = (payload: GroupChatAckFrame): void => {
		const clientMessageId = payload.clientMessageId || ''
		if (!clientMessageId) return
		const pending = pendingMessageMap.value.get(clientMessageId)
		if (!pending) return
		updateMessageStatusLocal(
			pending.chatId,
			clientMessageId,
			'sent',
			undefined,
			payload.messageId,
			payload.ackAt,
		)
		pendingMessageMap.value.delete(clientMessageId)
		syncAction('updateMessageStatus', {
			chatId: pending.chatId,
			clientMessageId,
			status: 'sent',
			serverMessageId: payload.messageId,
			ackAt: payload.ackAt,
		})
	}

	const handleWsError = (payload: PrivateChatErrorFrame): void => {
		const clientMessageId = payload.clientMessageId || ''
		if (!clientMessageId) return
		const pending = pendingMessageMap.value.get(clientMessageId)
		if (!pending) return
		updateMessageStatusLocal(
			pending.chatId,
			clientMessageId,
			'failed',
			payload.message || payload.code || '发送失败',
		)
		pendingMessageMap.value.delete(clientMessageId)
		syncAction('updateMessageStatus', {
			chatId: pending.chatId,
			clientMessageId,
			status: 'failed',
			result: payload.message || payload.code || '发送失败',
		})
	}

const handleIncomingCallSignal = (
	payload: PrivateIncomingCallFrame,
): void => {
	emitIncomingCall(payload)
}

const handleCallAnsweredSignal = (
	payload: PrivateCallAnsweredFrame,
): void => {
	emitCallAnswered(payload)
}

const handleCallEndedSignal = (
	payload: PrivateCallEndedFrame,
): void => {
	emitCallEnded(payload)
}

const handleCallSignal = (
	payload: PrivateCallSignalFrame,
): void => {
	const normalizedType = String(
		payload.signalType || payload.type || '',
	)
		.toUpperCase()
		.trim() as 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'RENEGOTIATE'
	emitCallSignal({
		...payload,
		signalType: normalizedType,
		type: normalizedType,
	})
	publishCallSignal({
		...payload,
		signalType: normalizedType,
		type: normalizedType,
	})
}

	const handleGroupWsError = (payload: GroupChatErrorFrame): void => {
		const clientMessageId = payload.clientMessageId || ''
		if (!clientMessageId) return
		const pending = pendingMessageMap.value.get(clientMessageId)
		if (!pending) return
		updateMessageStatusLocal(
			pending.chatId,
			clientMessageId,
			'failed',
			payload.message || payload.code || '发送失败',
		)
		pendingMessageMap.value.delete(clientMessageId)
		syncAction('updateMessageStatus', {
			chatId: pending.chatId,
			clientMessageId,
			status: 'failed',
			result: payload.message || payload.code || '发送失败',
		})
	}

	const resolveReactionChatId = async (
		payload: MessageReactionEventFrame,
		currentAccount: string,
	): Promise<number | null> => {
		const groupNo = String(payload.groupNo || '').trim()
		if (groupNo) {
			const existing = findGroupChatByNo(groupNo)
			if (existing) return existing.id
			const derived = deriveGroupChatId(groupNo)
			if (!derived) return null
			if (messages.value[derived]) return derived
			return chatlist.value.some((item) => item.id === derived)
				? derived
				: null
		}
		const from = String(payload.from || '').trim()
		const to = String(payload.to || '').trim()
		if (from || to) {
			const peer = from === currentAccount ? to : from
			if (peer && peer !== currentAccount) {
				const existing = findPrivateChatByAccount(peer)
				if (existing) return existing.id
				const derived = derivePrivateChatId(peer)
				if (!derived) return null
				if (messages.value[derived]) return derived
				return chatlist.value.some((item) => item.id === derived)
					? derived
					: null
			}
		}
		// 私聊 reaction 事件里 chatId 可能是“当前接收端的对端账号”，优先按账号解析。
		const rawChatId = String(payload.chatId || '').trim()
		if (rawChatId && rawChatId !== currentAccount) {
			const existing = findPrivateChatByAccount(rawChatId)
			if (existing) return existing.id
			const derived = derivePrivateChatId(rawChatId)
			if (derived) {
				if (messages.value[derived]) return derived
				if (chatlist.value.some((item) => item.id === derived)) {
					return derived
				}
			}
		}
		const directChatId = Number(rawChatId || 0)
		if (Number.isFinite(directChatId) && directChatId !== 0) {
			return chatlist.value.some((item) => item.id === directChatId) ||
				messages.value[directChatId]
				? directChatId
				: null
		}
		return null
	}

	const unwrapReactionEventPayload = (
		raw: Record<string, unknown>,
	): MessageReactionEventFrame => {
		const payload = raw as MessageReactionEventFrame
		const firstData =
			payload.data &&
			typeof payload.data === 'object' &&
			!Array.isArray(payload.data)
				? (payload.data as Record<string, unknown>)
				: null
		const secondData =
			firstData?.data &&
			typeof firstData.data === 'object' &&
			!Array.isArray(firstData.data)
				? (firstData.data as Record<string, unknown>)
				: null
		if (firstData || secondData) {
			return {
				...payload,
				...(firstData || {}),
				...(secondData || {}),
			} as MessageReactionEventFrame
		}
		return payload
	}

	const resolveReactionMessageIdentity = (
		payload: MessageReactionEventFrame,
	): {
		id?: number
		serverMessageId?: string
		clientMessageId?: string
	} => {
		const serverMessageId =
			extractMessageIdFromPayload(payload) ||
			String(payload.serverMessageId || '').trim() ||
			undefined
		const clientMessageId =
			String(payload.clientMessageId || '').trim() || undefined
		const rawMessageId =
			extractMessageIdFromPayload(payload) ||
			String(payload.messageId || '').trim()
		if (!rawMessageId) {
			return {
				id: undefined,
				serverMessageId,
				clientMessageId,
			}
		}
		// Reactions are cross-device events; local message `id` is not stable across clients.
		// Always treat payload.messageId as server identity fallback.
		return {
			id: undefined,
			serverMessageId: serverMessageId || rawMessageId,
			clientMessageId,
		}
	}

	const getReactionActorLabel = (
		payload: MessageReactionEventFrame,
		currentAccount: string,
	): string => {
		const operatorName = String(payload.operatorName || '').trim()
		if (operatorName) return operatorName
		const operatorId =
			resolveReactionOperatorIdStrict(payload) ||
			resolveReactionOperatorIdFallback(payload)
		if (!operatorId) return '有人'
		if (operatorId === currentAccount) return '你'
		const friend = friendStore.friends.find(
			(item) => item.id === operatorId || item.uid === operatorId,
		)
		return friend?.remark?.trim() || friend?.name?.trim() || operatorId
	}

	const resolveReactionOperatorIdStrict = (
		payload: MessageReactionEventFrame,
	): string => {
		const frame = payload as Record<string, unknown>
		const operatorNode =
			typeof frame.operator === 'object' && frame.operator !== null
				? (frame.operator as Record<string, unknown>)
				: null
		const candidates: unknown[] = [
			payload.operatorId,
			frame.operatorAccount,
			frame.operatorUserId,
			frame.operatorUid,
			frame.reactorId,
			frame.actorId,
			operatorNode?.account,
			operatorNode?.userAccount,
			operatorNode?.uid,
			operatorNode?.userId,
			operatorNode?.id,
		]
		for (const item of candidates) {
			if (item === null || item === undefined) continue
			if (typeof item === 'object') continue
			const normalized = String(item).trim()
			if (normalized) return normalized
		}
		return ''
	}

	const resolveReactionOperatorIdFallback = (
		payload: MessageReactionEventFrame,
	): string => {
		const frame = payload as Record<string, unknown>
		const fromNode =
			typeof frame.from === 'object' && frame.from !== null
				? (frame.from as Record<string, unknown>)
				: null
		const candidates: unknown[] = [
			frame.from,
			frame.fromAccount,
			frame.senderAccount,
			frame.senderId,
			frame.account,
			fromNode?.account,
			fromNode?.userAccount,
			fromNode?.uid,
			fromNode?.userId,
			fromNode?.id,
		]
		for (const item of candidates) {
			if (item === null || item === undefined) continue
			if (typeof item === 'object') continue
			const normalized = String(item).trim()
			if (normalized) return normalized
		}
		return ''
	}

	const resolveReactionAccountId = (value: unknown): string => {
		if (value === null || value === undefined) return ''
		if (typeof value === 'string' || typeof value === 'number') {
			return String(value).trim()
		}
		if (typeof value === 'object') {
			const source = value as Record<string, unknown>
			const candidates: unknown[] = [
				source.account,
				source.userAccount,
				source.uid,
				source.userId,
				source.id,
			]
			for (const candidate of candidates) {
				if (candidate === null || candidate === undefined) continue
				if (typeof candidate === 'object') continue
				const normalized = String(candidate).trim()
				if (normalized) return normalized
			}
		}
		return ''
	}

	const getReactionEmojiLabel = (
		payload: MessageReactionEventFrame,
	): string => {
		const direct = String(
			(payload as Record<string, unknown>).emoji ||
				(payload as Record<string, unknown>).reactionEmoji ||
				'',
		).trim()
		if (direct) return direct
		const list = fromServerReactionItems(payload.reactions)
		return String(list[0]?.emoji || '').trim()
	}

	const shouldHandleReactionEvent = (
		payload: MessageReactionEventFrame,
	): boolean => {
		const frame = payload as Record<string, unknown>
		const eventType = String(payload.eventType || '')
			.trim()
			.toLowerCase()
		if (
			eventType.includes('reaction') ||
			eventType.includes('react') ||
			eventType.includes('reply')
		) {
			return true
		}
		if (Array.isArray(payload.reactions) && payload.reactions.length > 0) {
			return true
		}
		const singleReactionFields = [
			frame.reaction,
			frame.reactionEmoji,
			frame.reactionKey,
			frame.emoji,
		]
		return singleReactionFields.some(
			(value) => String(value || '').trim().length > 0,
		)
	}

	const fetchReactionSnapshotFromServer = async (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
	): Promise<MessageReaction[] | null> => {
		const pathIdCandidates: Array<string | number> = []
		if (identity.serverMessageId?.trim()) {
			pathIdCandidates.push(identity.serverMessageId.trim())
		}
		if (typeof identity.id === 'number') {
			pathIdCandidates.push(identity.id)
		}
		if (identity.clientMessageId?.trim()) {
			pathIdCandidates.push(identity.clientMessageId.trim())
		}
		for (const pathId of pathIdCandidates) {
			try {
				const response = await messageReactionApi.getByMessageId(pathId, {
					chatId,
					serverMessageId: identity.serverMessageId,
					clientMessageId: identity.clientMessageId,
				})
				const rows = response.data?.data?.reactions
				if (Array.isArray(rows)) {
					return fromServerReactionItems(rows)
				}
			} catch {
				// ignore and try next candidate
			}
		}
		return null
	}

	const handleIncomingReactionEvent = async (
		raw: Record<string, unknown>,
	): Promise<void> => {
		const debugReaction = shouldLogReactionDebug()
		if (debugReaction) {
			console.info('[chat-reaction-debug] incoming-raw', raw)
		}
		const payload = unwrapReactionEventPayload(raw)
		if (!shouldHandleReactionEvent(payload)) {
			if (debugReaction) {
				console.info('[chat-reaction-debug] filtered-by-type', {
					eventType: payload.eventType,
					keys: Object.keys(payload as Record<string, unknown>),
				})
			}
			return
		}
		const dedupKey = [
			String(payload.chatId || ''),
			String(payload.groupNo || ''),
			String(payload.serverMessageId || payload.messageId || ''),
			String(payload.clientMessageId || ''),
			String(payload.updatedAt || ''),
		].join('|')
		const now = Date.now()
		for (const [key, ts] of recentReactionEventMap.entries()) {
			if (now - ts > REACTION_EVENT_DEDUP_TTL_MS) {
				recentReactionEventMap.delete(key)
			}
		}
		const lastTs = recentReactionEventMap.get(dedupKey) || 0
		if (dedupKey !== '||||' && now - lastTs < REACTION_EVENT_DEDUP_TTL_MS) {
			if (debugReaction) {
				console.info('[chat-reaction-debug] filtered-by-dedup', {
					dedupKey,
					deltaMs: now - lastTs,
				})
			}
			return
		}
		recentReactionEventMap.set(dedupKey, now)
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			return
		}
		const chatId = await resolveReactionChatId(payload, currentAccount)
		const identity = resolveReactionMessageIdentity(payload)
		let reactions = fromServerReactionItems(payload.reactions)
		if (debugReaction) {
			console.info('[chat-reaction-debug] resolved-basic', {
				currentAccount,
				chatId,
				identity,
				reactionCount: reactions.length,
				payloadChatId: payload.chatId,
				payloadFrom: payload.from,
				payloadTo: payload.to,
			})
		}
		if ((!reactions || reactions.length === 0) && chatId) {
			const snapshot = await fetchReactionSnapshotFromServer(
				chatId,
				identity,
			)
			if (snapshot) {
				reactions = snapshot
				if (debugReaction) {
					console.info('[chat-reaction-debug] snapshot-fetched', {
						chatId,
						identity,
						reactionCount: reactions.length,
					})
				}
			} else if (debugReaction) {
				console.info('[chat-reaction-debug] snapshot-empty', {
					chatId,
					identity,
				})
			}
		}
		let applied = false
		let appliedChatId = chatId || 0
		if (chatId) {
			applied = setMessageReactionsLocal(
				chatId,
				identity,
				reactions,
				true,
			)
		}
		if (!applied) {
			for (const [chatIdKey] of Object.entries(messages.value)) {
				const candidateChatId = Number(chatIdKey)
				if (!Number.isFinite(candidateChatId)) continue
				const hit = setMessageReactionsLocal(
					candidateChatId,
					identity,
					reactions,
					true,
				)
				if (hit) {
					applied = true
					appliedChatId = candidateChatId
					break
				}
			}
		}
		// 当前会话消息可能尚未载入内存，先补载本地最近消息再重试命中。
		if (!applied && chatId) {
			try {
				const recentSegment = await db.getMessagesSegment(chatId, 120, 0)
				if (recentSegment.length) {
					mergeMessagesToStore(chatId, recentSegment, 'append')
					applied = setMessageReactionsLocal(
						chatId,
						identity,
						reactions,
						true,
					)
					if (applied) {
						appliedChatId = chatId
					}
				}
			} catch {
				// ignore and keep fallback below
			}
		}

		// 再尝试拉取最近一页远端历史补偿（跨端登录后仅内存为空的场景）。
		if (!applied && chatId) {
			try {
				const targetChat = chatlist.value.find(
					(item) => item.id === chatId,
				)
				await pullChatHistory(chatId, {
					groupNo: targetChat?.groupNo,
					page: 1,
					size: 50,
					appendToStore: true,
				})
				applied = setMessageReactionsLocal(
					chatId,
					identity,
					reactions,
					true,
				)
				if (applied) {
					appliedChatId = chatId
				}
			} catch {
				// ignore and continue notify fallback
			}
		}

		// 最后兜底：目标会话可能尚未活跃导致未入内存，遍历本地会话最近消息做一次匹配。
		if (!applied) {
			const chatIds = chatlist.value.map((item) => item.id)
			for (const candidateChatId of chatIds) {
				if (candidateChatId === chatId) continue
				try {
					const recentSegment = await db.getMessagesSegment(
						candidateChatId,
						80,
						0,
					)
					if (recentSegment.length) {
						mergeMessagesToStore(
							candidateChatId,
							recentSegment,
							'append',
						)
					}
				} catch {
					// ignore and continue
				}
				const hit = setMessageReactionsLocal(
					candidateChatId,
					identity,
					reactions,
					true,
				)
				if (hit) {
					applied = true
					appliedChatId = candidateChatId
					break
				}
			}
		}

		if (applied) {
			syncAction('setMessageReactions', {
				chatId: appliedChatId,
				messageIdentity: identity,
				reactions,
			})
		}
		if (debugReaction) {
			console.info('[chat-reaction-debug] apply-result', {
				applied,
				appliedChatId,
				fallbackChatId: chatId,
				identity,
				reactionCount: reactions.length,
			})
		}

		const operatorId = resolveReactionOperatorIdStrict(payload)
		const actorLabel = getReactionActorLabel(payload, currentAccount)
		const frame = payload as Record<string, unknown>
		const fromAccount =
			resolveReactionAccountId(payload.from) ||
			resolveReactionAccountId(frame.fromAccount) ||
			resolveReactionAccountId(frame.senderAccount)
		const toAccount =
			resolveReactionAccountId(payload.to) ||
			resolveReactionAccountId(frame.toAccount)
		const isSelfReaction =
			(!!operatorId && operatorId === currentAccount) ||
			(!operatorId && !!fromAccount && fromAccount === currentAccount)
		const resolvedChatId = applied ? appliedChatId : chatId || 0
		const targetMessage =
			resolvedChatId > 0
				? findMessageByIdentity(resolvedChatId, identity)
				: undefined
		const targetSenderAccount = String(
			targetMessage?.senderAccount || '',
		).trim()
		const reactedToCurrentUser = !!targetMessage
			? targetMessage.senderId === 'me' ||
				(targetSenderAccount &&
					targetSenderAccount === currentAccount)
			: false
		const chat = chatlist.value.find((item) => item.id === resolvedChatId)
		const systemDelivery =
			isSystemNotificationChatItem(chat) ||
			isSystemAccount(fromAccount.toUpperCase()) ||
			isSystemAccount(toAccount.toUpperCase())
		const addressedCurrentUser = !!toAccount && toAccount === currentAccount
		if (
			!isSelfReaction &&
			(reactedToCurrentUser || addressedCurrentUser || systemDelivery)
		) {
			const emojiLabel = getReactionEmojiLabel(payload)
			if (debugReaction) {
				console.info('[chat-reaction-debug] notify-trigger', {
					operatorId,
					fromAccount,
					toAccount,
					actorLabel,
					isSelfReaction,
					reactedToCurrentUser,
					addressedCurrentUser,
					systemDelivery,
					chatName: chat?.name || '聊天',
					emojiLabel,
				})
			}
			triggerSystemMessageReminder({
				chatName: chat?.name || '聊天',
				messageText: `${actorLabel || '有人'} 回复了信息${
					emojiLabel ? ` ${emojiLabel}` : ''
				}`,
			})
		} else if (debugReaction) {
			console.info('[chat-reaction-debug] notify-skipped', {
				operatorId,
				currentAccount,
				fromAccount,
				toAccount,
				isSelfReaction,
				reactedToCurrentUser,
				addressedCurrentUser,
				systemDelivery,
				resolvedChatId,
				targetMessageId:
					targetMessage?.serverMessageId ||
					targetMessage?.clientMessageId ||
					targetMessage?.id,
			})
		}
	}

	const unwrapRecallEventPayload = (
		raw: Record<string, unknown>,
	): MessageRecallEventFrame => {
		const payload = raw as MessageRecallEventFrame
		const firstData =
			payload.data &&
			typeof payload.data === 'object' &&
			!Array.isArray(payload.data)
				? (payload.data as Record<string, unknown>)
				: null
		const secondData =
			firstData?.data &&
			typeof firstData.data === 'object' &&
			!Array.isArray(firstData.data)
				? (firstData.data as Record<string, unknown>)
				: null
		if (firstData || secondData) {
			return {
				...payload,
				...(firstData || {}),
				...(secondData || {}),
			} as MessageRecallEventFrame
		}
		return payload
	}

	const shouldHandleRecallEvent = (payload: MessageRecallEventFrame): boolean => {
		const eventType = String(payload.eventType || '')
			.trim()
			.toLowerCase()
		if (eventType.includes('recall') || eventType.includes('recalled')) {
			return true
		}
		if (payload.recalled === true) return true
		return String(payload.recalledAt || '').trim().length > 0
	}

	const resolveRecallMessageIdentity = (
		payload: MessageRecallEventFrame,
	): {
		id?: number
		serverMessageId?: string
		clientMessageId?: string
	} => {
		const rawMessageId =
			extractMessageIdFromPayload(payload as unknown as Record<string, unknown>) ||
			String(payload.messageId || '').trim()
		return {
			id: undefined,
			serverMessageId: rawMessageId || undefined,
			clientMessageId: String(payload.clientMessageId || '').trim() || undefined,
		}
	}

	const handleIncomingRecallEvent = async (
		raw: Record<string, unknown>,
	): Promise<void> => {
		const payload = unwrapRecallEventPayload(raw)
		if (!shouldHandleRecallEvent(payload)) return

		const dedupKey = [
			String(payload.chatId || ''),
			String(payload.groupNo || ''),
			String(payload.serverMessageId || payload.messageId || ''),
			String(payload.clientMessageId || ''),
			String(payload.recalledAt || ''),
		].join('|')
		const now = Date.now()
		for (const [key, ts] of recentRecallEventMap.entries()) {
			if (now - ts > REACTION_EVENT_DEDUP_TTL_MS) {
				recentRecallEventMap.delete(key)
			}
		}
		const lastTs = recentRecallEventMap.get(dedupKey) || 0
		if (dedupKey !== '||||' && now - lastTs < REACTION_EVENT_DEDUP_TTL_MS) {
			return
		}
		recentRecallEventMap.set(dedupKey, now)

		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			return
		}

		const chatId = await resolveReactionChatId(
			payload as unknown as MessageReactionEventFrame,
			currentAccount,
		)
		const identity = resolveRecallMessageIdentity(payload)
		const recalledAt = String(payload.recalledAt || '').trim() || new Date().toISOString()
		const recallDeadlineAt =
			String(payload.recallDeadlineAt || '').trim() || undefined
		let applied = false
		let appliedChatId = chatId || 0

		if (chatId) {
			applied = setMessageRecallLocal(
				chatId,
				identity,
				{
					recalled: true,
					recalledAt,
					recallDeadlineAt,
				},
				true,
			)
			if (applied) {
				refreshChatLastMessagePreview(chatId)
			}
		}

		if (!applied) {
			for (const [chatIdKey] of Object.entries(messages.value)) {
				const candidateChatId = Number(chatIdKey)
				if (!Number.isFinite(candidateChatId)) continue
				const hit = setMessageRecallLocal(
					candidateChatId,
					identity,
					{
						recalled: true,
						recalledAt,
						recallDeadlineAt,
					},
					true,
				)
				if (hit) {
					applied = true
					appliedChatId = candidateChatId
					refreshChatLastMessagePreview(candidateChatId)
					break
				}
			}
		}

		if (applied) {
			syncAction('setMessageRecall', {
				chatId: appliedChatId,
				messageIdentity: identity,
				recalled: true,
				recalledAt,
				recallDeadlineAt,
			})
		}
	}

	const bindPrivateChatWs = (): void => {
		let account = ''
		try {
			account = getCurrentAccount()
		} catch {
			return
		}
		const token = getCurrentToken()
		if (!token) return
		const normalizedToken = token.trim().replace(/^Bearer\s+/i, '')
		if (
			isPrivateWsBound.value &&
			privateWsBoundAccount.value === account &&
			privateWsBoundToken.value === normalizedToken
		) {
			return
		}

		privateChatWs.connect(token, {
			onMessage: (payload) => {
				void handleIncomingWsMessage(payload)
			},
			onReaction: (payload) => {
				void handleIncomingReactionEvent(payload)
			},
			onRecall: (payload) => {
				void handleIncomingRecallEvent(payload)
			},
			onAck: handleWsAck,
			onError: handleWsError,
			onIncomingCall: handleIncomingCallSignal,
			onCallAnswered: handleCallAnsweredSignal,
			onCallEnded: handleCallEndedSignal,
			onCallSignal: handleCallSignal,
		})
		isPrivateWsBound.value = true
		privateWsBoundAccount.value = account
		privateWsBoundToken.value = normalizedToken
	}

	const bindGroupChatWs = (): void => {
		let account = ''
		try {
			account = getCurrentAccount()
		} catch {
			return
		}
		const token = getCurrentToken()
		if (!token) return
		const normalizedToken = token.trim().replace(/^Bearer\s+/i, '')
		if (
			isGroupWsBound.value &&
			groupWsBoundAccount.value === account &&
			groupWsBoundToken.value === normalizedToken
		) {
			return
		}

		groupChatWs.connect(token, {
			onMessage: (payload) => {
				void handleIncomingGroupWsMessage(payload)
			},
			onReaction: (payload) => {
				void handleIncomingReactionEvent(payload)
			},
			onRecall: (payload) => {
				void handleIncomingRecallEvent(payload)
			},
			onAck: handleGroupWsAck,
			onError: handleGroupWsError,
		})
		isGroupWsBound.value = true
		groupWsBoundAccount.value = account
		groupWsBoundToken.value = normalizedToken
	}

	tokenManager.onTokenUpdated(() => {
		isPrivateWsBound.value = false
		privateWsBoundToken.value = ''
		isGroupWsBound.value = false
		groupWsBoundToken.value = ''
		offlinePulledAccount.value = ''
		friendsLoadedAccount.value = ''
		bindPrivateChatWs()
		bindGroupChatWs()
		void pullOfflineMessages()
	})

	tokenManager.onTokenCleared(() => {
		privateChatWs.disconnect()
		groupChatWs.disconnect()
		isPrivateWsBound.value = false
		privateWsBoundAccount.value = ''
		privateWsBoundToken.value = ''
		isGroupWsBound.value = false
		groupWsBoundAccount.value = ''
		groupWsBoundToken.value = ''
		offlinePulledAccount.value = ''
		friendsLoadedAccount.value = ''
		pendingMessageMap.value.clear()
		historyPaginationMap.value.clear()
		localHistoryCursorMap.value.clear()
	})

	watch(
		() =>
			friendStore.friends.map(
				(friend) =>
					`${friend.id}:${friend.avatar}:${friend.name}:${friend.status}`,
			),
		() => {
			syncChatProfilesWithFriends()
		},
		{ immediate: true },
	)

	if (window.electron && window.electron.ipcRenderer) {
		clearChatIpcListeners()
		window.electron.ipcRenderer.on(
			'store-update',
			(
				_event: unknown,
				payload: {
					action: string
					data: Record<string, unknown>
					scope?: string
				},
			) => {
				let currentAccount = ''
				try {
					currentAccount = getCurrentAccount()
				} catch {
					return
				}
				if (payload.scope && payload.scope !== currentAccount) {
					return
				}

				const { action } = payload
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const data = payload.data as any
				switch (action) {
					case 'sendMessage': {
						if (!messages.value[data.chatId])
							messages.value[data.chatId] = []
						const incomingMessage = data.message as Message
						if (
							!messages.value[data.chatId].some(
								(m) =>
									m.id === incomingMessage.id ||
									(!!incomingMessage.clientMessageId &&
										m.clientMessageId ===
											incomingMessage.clientMessageId) ||
									(!!incomingMessage.serverMessageId &&
										m.serverMessageId ===
											incomingMessage.serverMessageId),
							)
						) {
							messages.value[data.chatId].push(incomingMessage)
							updateLastMessageLocal(
								data.chatId,
								data.textPreview,
								data.timestamp,
								typeof data.moveToTop === 'boolean'
									? data.moveToTop
									: true,
							)
						}
						break
					}
					case 'updateMessageStatus':
						updateMessageStatusLocal(
							data.chatId,
							data.clientMessageId,
							data.status,
							data.result,
							data.serverMessageId,
							data.ackAt,
						)
						break
					case 'setMessageReactions':
						setMessageReactionsLocal(
							data.chatId,
							data.messageIdentity,
							sanitizeMessageReactions(data.reactions),
							true,
						)
						break
					case 'setMessageRecall':
						setMessageRecallLocal(
							data.chatId,
							data.messageIdentity,
							{
								recalled: Boolean(data.recalled),
								recalledAt: data.recalledAt,
								recallDeadlineAt: data.recallDeadlineAt,
							},
							true,
						)
						refreshChatLastMessagePreview(data.chatId)
						break
					case 'pinChat':
						pinChatLocal(data.chatId)
						break
					case 'unpinChat':
						unpinChatLocal(data.chatId)
						break
					case 'clearChat':
						clearChatLocal(data.chatId)
						break
					case 'deleteChat':
						removeChatLocal(data.chatId)
						break
					case 'markAsRead':
						markAsReadLocal(data.chatId)
						break
				}
			},
		)

		window.electron.ipcRenderer.on(
			'provide-store-data',
			(_event: unknown, targetId: number) => {
				let scope = ''
				try {
					scope = getCurrentAccount()
				} catch {
					return
				}
				window.electron.ipcRenderer.send(
					'report-store-data',
					targetId,
					{
						messages: messages.value,
						chatlist: chatlist.value,
						pinnedChats: pinnedChats.value,
						scope,
					},
				)
			},
		)

		window.electron.ipcRenderer.on(
			'hydrate-store-data',
			(_event: unknown, payload: HydrateStorePayload) => {
				let currentAccount = ''
				try {
					currentAccount = getCurrentAccount()
				} catch {
					return
				}
				if (payload.scope && payload.scope !== currentAccount) return

				if (payload.messages) {
					for (const [chatIdKey, chatMessages] of Object.entries(
						payload.messages,
					)) {
						const chatId = Number(chatIdKey)
						if (!Number.isFinite(chatId)) continue
						if (
							!Array.isArray(chatMessages) ||
							!chatMessages.length
						)
							continue
						mergeMessagesToStore(chatId, chatMessages, 'append')
					}
				}
				if (payload.chatlist) chatlist.value = payload.chatlist
				if (payload.pinnedChats) pinnedChats.value = payload.pinnedChats
			},
		)

		// 4. 自动初始化
		setTimeout(() => {
			const isStandalone =
				window.location.href.includes('chat-standalone') ||
				window.location.hash.includes('chat-standalone')
			if (isStandalone) {
				requestFullState()
				// 独立窗口也尝试从 DB 读取基础列表，防止同步延迟
				init()
			} else {
				init()
			}
		}, 100)
	}

	// --- 核心操作逻辑 (本地 + 数据库) ---
	const updateLastMessageLocal = (
		id: number,
		message: string,
		timeOverride?: string,
		moveToTop = true,
		lastMessageAtOverride?: string,
	): void => {
		const index = chatlist.value.findIndex((c) => c.id === id)
		if (index !== -1) {
			const chat = chatlist.value[index]
			const time =
				timeOverride ||
				new Date().toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
				})
			chat.lastMessage = message
			chat.timestamp = time
			chat.lastMessageAt =
				lastMessageAtOverride || new Date().toISOString()

			if (moveToTop) {
				// 新消息到达时移动到顶部 (所有聊天列表)
				chatlist.value.splice(index, 1)
				chatlist.value.unshift(chat)
			}

			// 如果是置顶会话，也要更新 pinnedChats 的顺序 (横向置顶区域)
			if (moveToTop && chat.isPinned) {
				const pIndex = pinnedChats.value.findIndex((c) => c.id === id)
				if (pIndex !== -1) {
					const pChat = pinnedChats.value[pIndex]
					pinnedChats.value.splice(pIndex, 1)
					pinnedChats.value.unshift(pChat)
				}
			}

			db.updateLastMessage(id, message, time, chat.lastMessageAt)
		}
	}

	const updateMessageStatusLocal = (
		chatId: number,
		clientMessageId: string,
		status: 'sent' | 'failed',
		result?: string,
		serverMessageId?: string,
		ackAt?: string,
	): void => {
		const list = messages.value[chatId]
		if (!list?.length) return
		const target = list.find(
			(item) => item.clientMessageId === clientMessageId,
		)
		if (!target) return
		target.deliveryStatus = status
		target.hasResult = status === 'failed'
		target.result = result
		const normalizedServerId = String(serverMessageId || '').trim()
		if (normalizedServerId) {
			target.serverMessageId = normalizedServerId
		}
		const normalizedAckAt = String(ackAt || '').trim()
		if (normalizedAckAt && !target.sentAt) {
			target.sentAt = normalizedAckAt
			target.timestamp = formatTimeFromIso(normalizedAckAt)
		}
		db.saveMessage(target)
	}

	const findMessageByIdentity = (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
	): Message | undefined => {
		const list = messages.value[chatId] || []
		if (!list.length) return undefined
		const serverId = identity.serverMessageId?.trim() || ''
		const clientId = identity.clientMessageId?.trim() || ''
		const localId =
			typeof identity.id === 'number' ? identity.id : undefined
		return list.find((item) => {
			if (localId !== undefined && item.id === localId) return true
			if (serverId && item.serverMessageId?.trim() === serverId)
				return true
			if (clientId && item.clientMessageId?.trim() === clientId)
				return true
			return false
		})
	}

	const setMessageReactionsLocal = (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
		reactions: MessageReaction[],
		persist = true,
	): boolean => {
		const target = findMessageByIdentity(chatId, identity)
		if (!target) return false
		target.reactions = sanitizeMessageReactions(reactions)
		if (persist) db.saveMessage(target)
		return true
	}

	const getMessageRecallDeadlineMs = (message: Message): number => {
		const explicitDeadline = parseIsoLikeDate(message.recallDeadlineAt || '')
		if (explicitDeadline) return explicitDeadline.getTime()
		const sentAt = parseIsoLikeDate(message.sentAt || '')
		if (!sentAt) return 0
		return sentAt.getTime() + MESSAGE_RECALL_WINDOW_MS
	}

	const canRecallMessage = (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
	): boolean => {
		const target = findMessageByIdentity(chatId, identity)
		if (!target) return false
		if (target.senderId !== 'me' || target.recalled) return false
		const deadlineMs = getMessageRecallDeadlineMs(target)
		if (!deadlineMs) return true
		return Date.now() <= deadlineMs
	}

	const setMessageRecallLocal = (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
		payload: {
			recalled: boolean
			recalledAt?: string
			recallDeadlineAt?: string
		},
		persist = true,
	): boolean => {
		const target = findMessageByIdentity(chatId, identity)
		if (!target) return false
		target.recalled = !!payload.recalled
		target.recalledAt = payload.recalledAt?.trim() || target.recalledAt
		target.recallDeadlineAt =
			payload.recallDeadlineAt?.trim() || target.recallDeadlineAt
		if (target.recalled) {
			target.reactions = []
			target.quote = undefined
		}
		if (persist) db.saveMessage(target)
		return true
	}

	const refreshChatLastMessagePreview = (chatId: number): void => {
		const chat = chatlist.value.find((item) => item.id === chatId)
		if (!chat) return
		const list = messages.value[chatId] || []
		if (!list.length) return
		let latest = list[0]
		let latestMs = getTimeMs(latest.sentAt || latest.recalledAt || '')
		for (let i = 1; i < list.length; i += 1) {
			const row = list[i]
			const rowMs = getTimeMs(row.sentAt || row.recalledAt || '')
			if (rowMs >= latestMs) {
				latest = row
				latestMs = rowMs
			}
		}
		const preview = getMessagePreview(latest)
		chat.lastMessage = preview
		chat.timestamp =
			latest.timestamp ||
			(latest.sentAt ? formatTimeFromIso(latest.sentAt) : formatTimeFromIso())
		if (latest.sentAt?.trim()) {
			chat.lastMessageAt = latest.sentAt.trim()
		}
		db.saveChat(chat)
	}

	const buildReactionDigest = (reactions: MessageReaction[]): string => {
		const safe = sanitizeMessageReactions(reactions)
		return safe
			.map((item) => {
				const users = Array.isArray(item.userIds)
					? [...item.userIds].sort().join(',')
					: ''
				return `${item.key}|${item.emoji || ''}|${item.imageUrl || ''}|${item.count}|${users}`
			})
			.join('||')
	}

	const syncChatReactionsOnOpen = async (chatId: number): Promise<void> => {
		const now = Date.now()
		const lastAt = recentReactionOpenSyncAtMap.get(chatId) || 0
		if (now - lastAt < REACTION_OPEN_SYNC_COOLDOWN_MS) return
		recentReactionOpenSyncAtMap.set(chatId, now)

		const list = Array.isArray(messages.value[chatId])
			? [...messages.value[chatId]]
			: []
		if (!list.length) return

		const candidates = list
			.filter((item) => {
				return Boolean(
					item.serverMessageId?.trim() ||
						item.clientMessageId?.trim() ||
						Number.isFinite(item.id),
				)
			})
			.sort((a, b) => {
				const aMs = a.sentAt ? new Date(a.sentAt).getTime() : 0
				const bMs = b.sentAt ? new Date(b.sentAt).getTime() : 0
				if (aMs !== bMs) return bMs - aMs
				return b.id - a.id
			})
			.slice(0, REACTION_OPEN_SYNC_LIMIT)

		if (!candidates.length) return

		let changed = 0
		let cursor = 0
		const worker = async (): Promise<void> => {
			for (;;) {
				const index = cursor
				cursor += 1
				if (index >= candidates.length) return
				const row = candidates[index]
				const identity = {
					id: row.id,
					serverMessageId: row.serverMessageId,
					clientMessageId: row.clientMessageId,
				}
				const snapshot = await fetchReactionSnapshotFromServer(
					chatId,
					identity,
				)
				if (!snapshot) continue
				const prev = sanitizeMessageReactions(row.reactions || [])
				if (buildReactionDigest(prev) === buildReactionDigest(snapshot)) {
					continue
				}
				const applied = setMessageReactionsLocal(
					chatId,
					identity,
					snapshot,
					true,
				)
				if (!applied) continue
				changed += 1
				syncAction('setMessageReactions', {
					chatId,
					messageIdentity: identity,
					reactions: snapshot,
				})
			}
		}

		const workers = Array.from({
			length: Math.min(
				REACTION_OPEN_SYNC_CONCURRENCY,
				candidates.length,
			),
		}).map(() => worker())
		await Promise.all(workers)

		if (changed > 0 && shouldLogReactionDebug()) {
			console.info('[chat-reaction-debug] open-chat-reactions-synced', {
				chatId,
				changed,
				candidates: candidates.length,
			})
		}
	}

	const buildToggledReactions = (
		existing: MessageReaction[],
		reaction: {
			key: string
			emoji?: string
			imageUrl?: string
		},
		actorId: string,
	): MessageReaction[] => {
		const next = sanitizeMessageReactions(existing || [])
		const reactionKey = reaction.key?.trim()
		if (!reactionKey) return next
		const now = new Date().toISOString()
		const index = next.findIndex((item) => item.key === reactionKey)
		if (index < 0) {
			next.push({
				key: reactionKey,
				emoji: reaction.emoji?.trim() || undefined,
				imageUrl: reaction.imageUrl?.trim() || undefined,
				userIds: [actorId],
				count: 1,
				updatedAt: now,
			})
		} else {
			const current = next[index]
			const userSet = new Set(current.userIds || [])
			if (userSet.has(actorId)) {
				userSet.delete(actorId)
			} else {
				userSet.add(actorId)
			}
			const users = Array.from(userSet)
			if (!users.length) {
				next.splice(index, 1)
			} else {
				next[index] = {
					...current,
					emoji: reaction.emoji?.trim() || current.emoji,
					imageUrl: reaction.imageUrl?.trim() || current.imageUrl,
					userIds: users,
					count: users.length,
					updatedAt: now,
				}
			}
		}
		next.sort((a, b) => {
			const at = new Date(a.updatedAt).getTime() || 0
			const bt = new Date(b.updatedAt).getTime() || 0
			return bt - at
		})
		return next
	}

	const toggleMessageReaction = async (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
		reaction: {
			key: string
			emoji?: string
			imageUrl?: string
		},
	): Promise<boolean> => {
		const target = findMessageByIdentity(chatId, identity)
		if (!target) return false
		if (target.recalled) return false
		const reactionKey = reaction.key?.trim()
		if (!reactionKey) return false
		const actorId = String(userInfoStore.account || '').trim()
		if (!actorId) return false

		const prev = sanitizeMessageReactions(target.reactions || [])
		const next = buildToggledReactions(prev, reaction, actorId)
		setMessageReactionsLocal(chatId, identity, next, true)
		syncAction('setMessageReactions', {
			chatId,
			messageIdentity: {
				id: target.id,
				clientMessageId: target.clientMessageId,
				serverMessageId: target.serverMessageId,
			},
			reactions: next,
		})

		const requestId = `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		const messagePathIdCandidates: Array<string | number> = []
		if (target.serverMessageId?.trim()) {
			messagePathIdCandidates.push(target.serverMessageId.trim())
		}
		messagePathIdCandidates.push(target.id)
		if (target.clientMessageId?.trim()) {
			messagePathIdCandidates.push(target.clientMessageId.trim())
		}
		try {
			let response: Awaited<
				ReturnType<typeof messageReactionApi.toggle>
			> | null = null
			let lastError: unknown = null
			for (const messagePathId of messagePathIdCandidates) {
				try {
					response = await messageReactionApi.toggle(messagePathId, {
						chatId,
						serverMessageId: target.serverMessageId,
						clientMessageId: target.clientMessageId,
						reaction: {
							key: reactionKey,
							emoji: reaction.emoji?.trim() || undefined,
							imageUrl: reaction.imageUrl?.trim() || undefined,
						},
						operatorId: actorId,
						requestId,
					})
					break
				} catch (error) {
					lastError = error
				}
			}
			if (!response) throw lastError || new Error('toggle 请求失败')
			const responseReactions = response.data?.data?.reactions
			if (Array.isArray(responseReactions)) {
				const snapshot = fromServerReactionItems(responseReactions)
				setMessageReactionsLocal(chatId, identity, snapshot, true)
				syncAction('setMessageReactions', {
					chatId,
					messageIdentity: {
						id: target.id,
						clientMessageId: target.clientMessageId,
						serverMessageId: target.serverMessageId,
					},
					reactions: snapshot,
				})
			}
		} catch (error) {
			console.warn('同步消息表情失败，已回滚本地状态:', error)
			setMessageReactionsLocal(chatId, identity, prev, true)
			syncAction('setMessageReactions', {
				chatId,
				messageIdentity: {
					id: target.id,
					clientMessageId: target.clientMessageId,
					serverMessageId: target.serverMessageId,
				},
				reactions: prev,
			})
			return false
		}
		return true
	}

	const recallMessage = async (
		chatId: number,
		identity: {
			id?: number
			clientMessageId?: string
			serverMessageId?: string
		},
	): Promise<{ success: boolean; reason?: string }> => {
		const target = findMessageByIdentity(chatId, identity)
		if (!target) {
			return { success: false, reason: '未找到消息' }
		}
		if (target.senderId !== 'me') {
			return { success: false, reason: '只能撤回自己发送的消息' }
		}
		if (target.recalled) {
			return { success: false, reason: '消息已撤回' }
		}
		if (!canRecallMessage(chatId, identity)) {
			return { success: false, reason: '撤回时间已超过 24 小时' }
		}

		const pathIdCandidates = [
			target.serverMessageId?.trim() || '',
			target.clientMessageId?.trim() || '',
		].filter(Boolean)
		if (!pathIdCandidates.length) {
			return { success: false, reason: '消息尚未同步到服务端，暂不可撤回' }
		}

		const previousState = {
			recalled: !!target.recalled,
			recalledAt: target.recalledAt,
			recallDeadlineAt: target.recallDeadlineAt,
			reactions: sanitizeMessageReactions(target.reactions || []),
			quote: target.quote,
		}
		const optimisticRecalledAt = new Date().toISOString()
		setMessageRecallLocal(
			chatId,
			identity,
			{
				recalled: true,
				recalledAt: optimisticRecalledAt,
			},
			true,
		)
		refreshChatLastMessagePreview(chatId)
		syncAction('setMessageRecall', {
			chatId,
			messageIdentity: {
				id: target.id,
				clientMessageId: target.clientMessageId,
				serverMessageId: target.serverMessageId,
			},
			recalled: true,
			recalledAt: optimisticRecalledAt,
			recallDeadlineAt: target.recallDeadlineAt,
		})

		try {
			const chat = chatlist.value.find((item) => item.id === chatId)
			const messageType = chat?.chatType === 'GROUP' ? 'GROUP' : 'PRIVATE'
			let response: Awaited<
				ReturnType<typeof messageRecallApi.recall>
			> | null = null
			let lastError: unknown = null
			for (const messagePathId of pathIdCandidates) {
				try {
					response = await messageRecallApi.recall(messagePathId, {
						messageType,
						groupNo:
							messageType === 'GROUP'
								? chat?.groupNo?.trim() || undefined
								: undefined,
					})
					break
				} catch (error) {
					lastError = error
				}
			}
			if (!response) throw lastError || new Error('撤回请求失败')
			const recalledAt =
				String(response.data?.data?.recalledAt || '').trim() ||
				optimisticRecalledAt
			const recallDeadlineAt =
				String(response.data?.data?.recallDeadlineAt || '').trim() ||
				target.recallDeadlineAt
			setMessageRecallLocal(
				chatId,
				identity,
				{
					recalled: true,
					recalledAt,
					recallDeadlineAt,
				},
				true,
			)
			refreshChatLastMessagePreview(chatId)
			syncAction('setMessageRecall', {
				chatId,
				messageIdentity: {
					id: target.id,
					clientMessageId: target.clientMessageId,
					serverMessageId: target.serverMessageId,
				},
				recalled: true,
				recalledAt,
				recallDeadlineAt,
			})
			return { success: true }
		} catch (error) {
			setMessageRecallLocal(
				chatId,
				identity,
				{
					recalled: previousState.recalled,
					recalledAt: previousState.recalledAt,
					recallDeadlineAt: previousState.recallDeadlineAt,
				},
				false,
			)
			const rollbackTarget = findMessageByIdentity(chatId, identity)
			if (rollbackTarget) {
				rollbackTarget.reactions = previousState.reactions
				rollbackTarget.quote = previousState.quote
				db.saveMessage(rollbackTarget)
			}
			refreshChatLastMessagePreview(chatId)
			syncAction('setMessageRecall', {
				chatId,
				messageIdentity: {
					id: target.id,
					clientMessageId: target.clientMessageId,
					serverMessageId: target.serverMessageId,
				},
				recalled: previousState.recalled,
				recalledAt: previousState.recalledAt,
				recallDeadlineAt: previousState.recallDeadlineAt,
			})
			const responseMessage =
				(error as { response?: { data?: { message?: string } } })
					?.response?.data?.message || '消息撤回失败，请稍后重试'
			return { success: false, reason: responseMessage }
		}
	}

	const markAsReadLocal = (id: number): void => {
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			chat.unreadCount = 0
			chat.mentionUnreadCount = 0
			db.saveChat(chat) // 存入 DB
		}
	}

	const pinChatLocal = (chatId: number): void => {
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat && !pinnedChats.value.some((c) => c.id === chatId)) {
			chat.isPinned = true
			pinnedChats.value.unshift(chat)
			db.setPinned(chatId, true)
		}
	}

	const unpinChatLocal = (chatId: number): void => {
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat) {
			chat.isPinned = false
			db.setPinned(chatId, false)
		}
	}

	const clearChatLocal = (chatId: number): void => {
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat) {
			chat.lastMessage = ''
			chat.timestamp = ''
			chat.lastMessageAt = undefined
			chat.unreadCount = 0
			chat.mentionUnreadCount = 0
			db.saveChat(chat)
		}
		messages.value[chatId] = []
		localHistoryCursorMap.value.set(chatId, {
			nextOffsetFromLatest: 0,
			hasMore: false,
		})
		historyPaginationMap.value.delete(chatId)
		db.clearChat(chatId)
	}

	const removeChatLocal = (chatId: number): void => {
		chatlist.value = chatlist.value.filter((c) => c.id !== chatId)
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		localHistoryCursorMap.value.delete(chatId)
		historyPaginationMap.value.delete(chatId)
		hydratedHistoryChatIds.value.delete(chatId)
		db.deleteChat(chatId)
		if (activeChatId.value === chatId) activeChatId.value = null
	}

	// --- 暴露给 UI 的方法 ---
		const setActiveChat = async (id: number): Promise<void> => {
			if (!isDbInitialized.value) {
				await init()
			}
			activeChatId.value = id

		if (!localHistoryCursorMap.value.has(id) || !messages.value[id]) {
			if (!messages.value[id]) {
				messages.value[id] = []
			}
			try {
				const segment = await db.getMessagesSegment(
					id,
					LOCAL_HISTORY_INITIAL_CHUNK_SIZE,
					0,
				)
				if (segment.length) {
					mergeMessagesToStore(id, segment, 'append')
				}
				localHistoryCursorMap.value.set(id, {
					nextOffsetFromLatest: segment.length,
					hasMore: segment.length >= LOCAL_HISTORY_INITIAL_CHUNK_SIZE,
				})
			} catch (error) {
				// 分段读取失败时回退老逻辑，保证聊天记录可见。
				console.warn('初始化分段读取失败，回退全量读取:', error)
				const allLocal = await db.getMessages(id)
				if (allLocal.length) {
					mergeMessagesToStore(id, allLocal, 'append')
				}
				localHistoryCursorMap.value.set(id, {
					nextOffsetFromLatest: allLocal.length,
					hasMore: false,
				})
			}
		}
		if (hydratedHistoryChatIds.value.has(id)) return
			try {
				const targetChat = chatlist.value.find((item) => item.id === id)
				await pullChatHistory(id, {
					groupNo: targetChat?.groupNo,
				page: 1,
				size: 20,
				appendToStore: true,
			})
			hydratedHistoryChatIds.value.add(id)
			} catch (error) {
				console.warn('拉取聊天记录失败:', error)
			}
			void syncChatReactionsOnOpen(id)
		}

	const saveDraft = (
		id: number,
		content: Record<string, unknown> | null,
	): void => {
		drafts.value[id] = content
	}

	const getDraft = (id: number): Record<string, unknown> | null => {
		return (
			drafts.value[id] || {
				type: 'doc',
				content: [{ type: 'paragraph' }],
			}
		)
	}

	const sendMessageByChatId = (
		chatId: number,
		content: string,
		type: 'text' | 'image' | 'rich-text' | 'transfer' = 'text',
		quote?: ComposerMessageQuote | MessageQuote,
	): boolean => {
		if (!chatId || !content) return false
		const currentChat = chatlist.value.find((item) => item.id === chatId)
		if (!currentChat || isSystemNotificationChatItem(currentChat))
			return false
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			currentAccount = userInfoStore.account?.trim() || ''
		}
		const chatType = getChatType(currentChat)
		if (chatType === 'GROUP') {
			bindGroupChatWs()
		} else {
			bindPrivateChatWs()
		}
		const clientMessageId = createClientMessageId()
		const sentAt = new Date().toISOString()
		const sourceQuote = quote || getComposerQuote(chatId) || undefined
		const normalizedQuote = normalizeMessageQuote(sourceQuote)
		const localQuote: ComposerMessageQuote | undefined = normalizedQuote
			? {
					...normalizedQuote,
					fromName:
						(sourceQuote as ComposerMessageQuote)?.fromName?.trim() ||
						undefined,
				}
			: undefined
		const newMessage: Message = {
			id: createLocalMessageId(),
			chatId,
			senderId: 'me',
			senderAccount: currentAccount || undefined,
			senderName: userInfoStore.userName?.trim() || undefined,
			senderAvatar: userInfoStore.avatarUrl?.trim() || undefined,
			text: content,
			timestamp: formatTimeFromIso(sentAt),
			type: inferMessageType(content, type),
			clientMessageId,
			deliveryStatus: 'sending',
			sentAt,
			quote: localQuote,
		}

		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId].push(newMessage)
		db.saveMessage(newMessage) // 保存到 DB

		const textPreview = getMessagePreview(newMessage)
		updateLastMessageLocal(
			chatId,
			textPreview,
			newMessage.timestamp,
			true,
			newMessage.sentAt,
		)

		syncAction('sendMessage', {
			chatId,
			message: newMessage,
			textPreview,
			timestamp: newMessage.timestamp,
			moveToTop: true,
		})
		if (sourceQuote) {
			clearComposerQuote(chatId)
		}

		let sent = false
		if (chatType === 'GROUP') {
			const groupNo = currentChat?.groupNo?.trim() || ''
			if (!groupNo) {
				updateMessageStatusLocal(
					chatId,
					clientMessageId,
					'failed',
					'群号缺失，消息未发送',
				)
				return false
			}
			sent = groupChatWs.sendGroup(
				groupNo,
				content,
				clientMessageId,
				normalizedQuote,
			)
		} else {
			const to = currentChat?.peerAccount?.trim() || String(chatId)
			sent = privateChatWs.sendPrivate(
				to,
				content,
				clientMessageId,
				normalizedQuote,
			)
		}
		if (sent) {
			pendingMessageMap.value.set(clientMessageId, {
				chatId,
				tempMessageId: newMessage.id,
			})
			return true
		}

		updateMessageStatusLocal(
			chatId,
			clientMessageId,
			'failed',
			'连接不可用，消息未发送',
		)
		syncAction('updateMessageStatus', {
			chatId,
			clientMessageId,
			status: 'failed',
			result: '连接不可用，消息未发送',
		})
		return false
	}

	const sendMessage = (
		content: string,
		type: 'text' | 'image' | 'rich-text' | 'transfer' = 'text',
		quote?: ComposerMessageQuote | MessageQuote,
	): void => {
		if (!activeChatId.value || !content) return
		void sendMessageByChatId(activeChatId.value, content, type, quote)
	}

	const sendMessageToAccount = async (
		account: string,
		content: string,
		type: 'text' | 'image' | 'rich-text' | 'transfer' = 'text',
		quote?: ComposerMessageQuote | MessageQuote,
	): Promise<boolean> => {
		const normalized = account.trim()
		if (!normalized || !content) return false
		if (!isDbInitialized.value) {
			await init()
		}
		const chatId = await ensureChatSession(normalized)
		if (!chatId) return false
		return sendMessageByChatId(chatId, content, type, quote)
	}

	const pinChat = (chatId: number): void => {
		pinChatLocal(chatId)
		syncAction('pinChat', { chatId })
	}

	const unpinChat = (chatId: number): void => {
		unpinChatLocal(chatId)
		syncAction('unpinChat', { chatId })
	}

	const deleteChat = (chatId: number): void => {
		removeChatLocal(chatId)
		syncAction('deleteChat', { chatId })
	}

	const removeChat = (chatId: number): void => {
		removeChatLocal(chatId)
		syncAction('deleteChat', { chatId })
	}

	const markAsRead = (id: number): void => {
		markAsReadLocal(id)
		syncAction('markAsRead', { chatId: id })
	}

	const getSystemNotificationChatId = async (): Promise<number> => {
		if (!isDbInitialized.value) {
			await init()
		}
		const systemChatId = await ensureChatSession(SYSTEM_ACCOUNT)
		if (!systemChatId) {
			throw new Error('系统通知会话初始化失败')
		}
		return systemChatId
	}

	const openSystemNotificationChat = async (): Promise<number> => {
		const systemChatId = await getSystemNotificationChatId()
		await setActiveChat(systemChatId)
		markAsRead(systemChatId)
		return systemChatId
	}

	const getOrCreateChat = async (friend: {
		id: string
		name: string
		avatar: string
		status?: 'online' | 'offline'
	}): Promise<number> => {
		if (!isDbInitialized.value) {
			await init()
		}
		const id = derivePrivateChatId(friend.id)
		if (!id) {
			throw new Error('无法创建会话：好友账号无效')
		}
		const existing =
			findPrivateChatByAccount(friend.id) ||
			chatlist.value.find((c) => c.chatType !== 'GROUP' && c.id === id)
		if (existing) {
			await hydrateSingleChatPreviewFromLatestMessage(existing)
			return existing.id
		}
		const latestPreview = await resolveLatestPreviewBeforeCreate(id)
		// 创建新会话
		const newChat: ChatItem = {
			id,
			chatType: 'PRIVATE',
			peerAccount: friend.id,
			name: friend.name,
			avatar: resolveAvatarUrl(friend.avatar),
			lastMessage: latestPreview?.preview || '',
			timestamp: latestPreview?.timeLabel || '',
			lastMessageAt: latestPreview?.sentAt,
			online: friend.status === 'online',
			unreadCount: 0,
			isPinned: false,
		}
		chatlist.value.unshift(newChat)
		db.saveChat(newChat)
		if (!latestPreview) {
			void hydrateSingleChatPreviewFromLatestMessage(newChat)
		}
		return id
	}

	const createGroupChat = async (payload: {
		groupName: string
		announcement?: string
	}): Promise<ChatItem> => {
		const groupName = payload.groupName?.trim()
		if (!groupName) {
			throw new Error('群名称不能为空')
		}
		const response = await groupChatApi.createGroup({
			groupName,
			announcement: payload.announcement,
		})
		const detail = response.data?.data
		if (!detail?.groupNo) {
			throw new Error('创建群聊成功但群号缺失')
		}
		const chatId = await upsertGroupSession(detail)
		if (!chatId) {
			throw new Error('创建群聊后写入本地会话失败')
		}
		const chat = chatlist.value.find((item) => item.id === chatId)
		if (!chat) {
			throw new Error('创建群聊后会话不存在')
		}
		return chat
	}

	const getGroupInfo = async (groupNo: string): Promise<GroupDetail> => {
		const normalized = groupNo.trim()
		if (!normalized) {
			throw new Error('群号不能为空')
		}
		const detail = await fetchGroupDetailForSession(normalized)
		if (!detail) {
			throw new Error('查询群信息失败')
		}
		await upsertGroupSession(detail)
		return detail
	}

	const getGroupMembers = async (groupNo: string): Promise<GroupMember[]> => {
		const normalized = groupNo.trim()
		if (!normalized) return []
		const response = await groupChatApi.getGroupMembers(normalized, {
			page: 1,
			size: 500,
		})
		const payload = response.data?.data
		const pagedRecords =
			payload && 'records' in payload && Array.isArray(payload.records)
				? payload.records
				: []
		const legacyMembers =
			payload && 'members' in payload && Array.isArray(payload.members)
				? payload.members
				: []
		const listMembers =
			payload && 'list' in payload && Array.isArray(payload.list)
				? payload.list
				: []
		const itemsMembers =
			payload && 'items' in payload && Array.isArray(payload.items)
				? payload.items
				: []
		const rowsMembers =
			payload && 'rows' in payload && Array.isArray(payload.rows)
				? payload.rows
				: []
		const contentMembers =
			payload && 'content' in payload && Array.isArray(payload.content)
				? payload.content
				: []
		const sourceMembers = pagedRecords.length
			? pagedRecords
			: legacyMembers.length
				? legacyMembers
				: listMembers.length
					? listMembers
					: itemsMembers.length
						? itemsMembers
						: rowsMembers.length
							? rowsMembers
							: contentMembers
		const normalizeText = (value: unknown): string => {
			if (value === null || value === undefined) return ''
			return String(value).trim()
		}
		const pickRecord = (value: unknown): Record<string, unknown> | null => {
			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				return null
			}
			return value as Record<string, unknown>
		}
		const normalizeBoolean = (value: unknown): boolean | undefined => {
			if (typeof value === 'boolean') return value
			if (typeof value === 'number') return value > 0
			if (typeof value === 'string') {
				const normalizedValue = value.trim().toLowerCase()
				if (
					normalizedValue === 'true' ||
					normalizedValue === '1' ||
					normalizedValue === 'yes' ||
					normalizedValue === 'y' ||
					normalizedValue === 'vip'
				) {
					return true
				}
				if (
					normalizedValue === 'false' ||
					normalizedValue === '0' ||
					normalizedValue === 'no' ||
					normalizedValue === 'n'
				) {
					return false
				}
			}
			return undefined
		}
		const normalizePositiveNumber = (value: unknown): number | undefined => {
			if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
				return Math.floor(value)
			}
			if (typeof value === 'string') {
				const parsed = Number(value.trim())
				if (Number.isFinite(parsed) && parsed > 0) {
					return Math.floor(parsed)
				}
			}
			return undefined
		}
		const findDeepScalarByKeys = (
			root: unknown,
			keys: string[],
			maxDepth = 4,
		): string | undefined => {
			if (!root || typeof root !== 'object') return undefined
			const normalizeKey = (value: string): string =>
				value.replace(/[\s_\-:]/g, '').toLowerCase()
			const wanted = new Set(keys.map((key) => normalizeKey(key)))
			const queue: Array<{ node: unknown; depth: number }> = [
				{ node: root, depth: 0 },
			]
			while (queue.length) {
				const current = queue.shift()
				if (!current) continue
				if (
					!current.node ||
					typeof current.node !== 'object' ||
					Array.isArray(current.node) ||
					current.depth > maxDepth
				) {
					continue
				}
				const row = current.node as Record<string, unknown>
				for (const [rawKey, rawValue] of Object.entries(row)) {
					if (wanted.has(normalizeKey(rawKey))) {
						if (
							typeof rawValue === 'string' ||
							typeof rawValue === 'number' ||
							typeof rawValue === 'boolean'
						) {
							const value = String(rawValue).trim()
							if (value) return value
						}
					}
					if (rawValue && typeof rawValue === 'object') {
						queue.push({ node: rawValue, depth: current.depth + 1 })
					}
				}
			}
			return undefined
		}
		const normalizeRole = (value: unknown): GroupRole => {
			const role = normalizeText(value).toUpperCase()
			if (role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER') {
				return role as GroupRole
			}
			return 'MEMBER'
		}
		const members = sourceMembers
			.map((raw) => {
				const row = raw as unknown as Record<string, unknown>
				const userInfo = pickRecord(row.userInfo)
				const memberInfo = pickRecord(row.memberInfo)
				const profile = pickRecord(row.profile)
				const account =
					normalizeText(row.account) ||
					normalizeText(row.userAccount) ||
					normalizeText(row.memberAccount) ||
					normalizeText(row.fromAccount) ||
					normalizeText(row.uid) ||
					normalizeText(row.userId) ||
					normalizeText(memberInfo?.account) ||
					normalizeText(memberInfo?.userAccount) ||
					normalizeText(memberInfo?.uid) ||
					normalizeText(memberInfo?.userId) ||
					normalizeText(userInfo?.account) ||
					normalizeText(userInfo?.userAccount) ||
					normalizeText(userInfo?.uid) ||
					normalizeText(userInfo?.userId) ||
					normalizeText(
						findDeepScalarByKeys(row, [
							'account',
							'userAccount',
							'memberAccount',
							'fromAccount',
							'uid',
							'userId',
							'id',
						]),
					)
				if (!account) return null
				const isVip =
					normalizeBoolean(row.isVip) ??
					normalizeBoolean(memberInfo?.isVip) ??
					normalizeBoolean(userInfo?.isVip) ??
					normalizeBoolean(profile?.isVip) ??
					normalizeBoolean(
						findDeepScalarByKeys(row, [
							'isVip',
							'memberIsVip',
							'userIsVip',
							'vipFlag',
						]),
					)
				const vipLevel =
					normalizePositiveNumber(row.vipLevel) ||
					normalizePositiveNumber(memberInfo?.vipLevel) ||
					normalizePositiveNumber(userInfo?.vipLevel) ||
					normalizePositiveNumber(profile?.vipLevel) ||
					normalizePositiveNumber(
						findDeepScalarByKeys(row, [
							'vipLevel',
							'memberLevel',
							'vipGrade',
							'level',
						]),
					)
				return {
					account,
					name:
						normalizeText(row.name) ||
						normalizeText(row.displayName) ||
						normalizeText(row.nickName) ||
						normalizeText(row.nickname) ||
						normalizeText(row.memberName) ||
						normalizeText(row.memberNickName) ||
						normalizeText(row.groupNickName) ||
						normalizeText(row.realName) ||
						normalizeText(row.userName) ||
						normalizeText(memberInfo?.name) ||
						normalizeText(memberInfo?.displayName) ||
						normalizeText(memberInfo?.nickName) ||
						normalizeText(memberInfo?.nickname) ||
						normalizeText(memberInfo?.realName) ||
						normalizeText(memberInfo?.userName) ||
						normalizeText(userInfo?.name) ||
						normalizeText(userInfo?.displayName) ||
						normalizeText(userInfo?.nickName) ||
						normalizeText(userInfo?.nickname) ||
						normalizeText(userInfo?.realName) ||
						normalizeText(userInfo?.userName) ||
						normalizeText(profile?.name) ||
						normalizeText(profile?.displayName) ||
						normalizeText(profile?.nickName) ||
						normalizeText(profile?.nickname) ||
						normalizeText(profile?.realName) ||
						normalizeText(profile?.userName) ||
						normalizeText(profile?.remarkName) ||
						normalizeText(
							findDeepScalarByKeys(row, [
								'displayName',
								'name',
								'nickName',
								'nickname',
								'realName',
								'userName',
								'groupNickName',
								'groupNick',
								'remarkName',
								'alias',
							]),
						) ||
						undefined,
					avatarUrl:
						normalizeText(row.avatarUrl) ||
						normalizeText(row.avatar) ||
						normalizeText(row.avatarPath) ||
						normalizeText(row.portrait) ||
						normalizeText(row.userAvatarUrl) ||
						normalizeText(row.userAvatar) ||
						normalizeText(row.headImgUrl) ||
						normalizeText(row.headImg) ||
						normalizeText(memberInfo?.avatarUrl) ||
						normalizeText(memberInfo?.avatar) ||
						normalizeText(memberInfo?.avatarPath) ||
						normalizeText(memberInfo?.portrait) ||
						normalizeText(memberInfo?.userAvatarUrl) ||
						normalizeText(memberInfo?.userAvatar) ||
						normalizeText(memberInfo?.headImgUrl) ||
						normalizeText(memberInfo?.headImg) ||
						normalizeText(userInfo?.avatarUrl) ||
						normalizeText(userInfo?.avatar) ||
						normalizeText(userInfo?.avatarPath) ||
						normalizeText(userInfo?.portrait) ||
						normalizeText(userInfo?.userAvatarUrl) ||
						normalizeText(userInfo?.userAvatar) ||
						normalizeText(userInfo?.headImgUrl) ||
						normalizeText(userInfo?.headImg) ||
						normalizeText(profile?.avatarUrl) ||
						normalizeText(profile?.avatar) ||
						normalizeText(profile?.avatarPath) ||
						normalizeText(profile?.portrait) ||
						normalizeText(
							findDeepScalarByKeys(row, [
								'avatarUrl',
								'avatar',
								'avatarPath',
								'portrait',
								'userAvatarUrl',
								'userAvatar',
								'headImgUrl',
								'headImg',
								'headUrl',
								'icon',
							]),
						) ||
						undefined,
					role: normalizeRole(
						row.role ||
							row.memberRole ||
							memberInfo?.role ||
							memberInfo?.memberRole,
					),
					isVip,
					vipActive: isVip,
					vipLevel,
					userInfo: userInfo || undefined,
					joinedAt: normalizeText(row.joinedAt) || undefined,
					status: normalizeText(row.status) || undefined,
					muted:
						typeof row.muted === 'boolean'
							? row.muted
							: undefined,
					blacklisted:
						typeof row.blacklisted === 'boolean'
							? row.blacklisted
							: undefined,
				} as GroupMember
			})
			.filter((item): item is GroupMember => !!item)
		const countFromApi =
			payload && 'count' in payload
				? payload.count
				: payload && 'total' in payload
					? payload.total
					: undefined
		const memberCount =
			typeof countFromApi === 'number' && Number.isFinite(countFromApi)
				? Math.max(0, Math.floor(countFromApi))
				: members.length
		const groupChat = findGroupChatByNo(normalized)
		if (groupChat) {
			groupChat.memberCount = memberCount
			db.saveChat(groupChat)
		}
		return members
	}

	const joinGroupChat = async (groupNo: string): Promise<ChatItem | null> => {
		const normalized = groupNo.trim()
		if (!normalized) {
			throw new Error('群号不能为空')
		}
		const response = await groupChatApi.joinGroup(normalized)
		const detail = response.data?.data
		if (!detail?.groupNo) {
			throw new Error('入群成功但群信息缺失')
		}
		const chatId = await upsertGroupSession(detail)
		if (!chatId) return null
		return chatlist.value.find((item) => item.id === chatId) || null
	}

	const quitGroupChat = async (groupNo: string): Promise<void> => {
		const normalized = groupNo.trim()
		if (!normalized) {
			throw new Error('群号不能为空')
		}
		const response = await groupChatApi.quitGroup(normalized)
		const result = response.data?.data as GroupQuitResult | null
		const chat = findGroupChatByNo(normalized)
		if (chat && result?.shouldRemoveLocalSession !== false) {
			removeChat(chat.id)
		}
	}

	const disbandGroupChat = async (groupNo: string): Promise<void> => {
		const normalized = groupNo.trim()
		if (!normalized) {
			throw new Error('群号不能为空')
		}
		await groupChatApi.disbandGroup(normalized)
		const chat = findGroupChatByNo(normalized)
		if (chat) {
			removeChat(chat.id)
		}
	}

	const inviteGroupFriend = async (
		groupNo: string,
		friendAccount: string,
	): Promise<void> => {
		const normalizedGroupNo = groupNo.trim()
		const normalizedFriendAccount = friendAccount.trim()
		if (!normalizedGroupNo || !normalizedFriendAccount) {
			throw new Error('群号和好友账号不能为空')
		}
		await groupChatApi.inviteFriend(
			normalizedGroupNo,
			normalizedFriendAccount,
		)
		await syncGroupSessionByNo(normalizedGroupNo)
	}

	const updateGroupAnnouncement = async (
		groupNo: string,
		announcement: string,
	): Promise<GroupDetail> => {
		const normalized = groupNo.trim()
		if (!normalized) {
			throw new Error('群号不能为空')
		}
		const response = await groupChatApi.updateAnnouncement(
			normalized,
			announcement,
		)
		const detail = response.data?.data
		if (!detail) {
			throw new Error('更新群公告失败')
		}
		await upsertGroupSession(detail)
		return detail
	}

	const setGroupAdmin = async (
		groupNo: string,
		account: string,
	): Promise<void> => {
		const normalizedGroupNo = groupNo.trim()
		const normalizedAccount = account.trim()
		if (!normalizedGroupNo || !normalizedAccount) {
			throw new Error('群号和账号不能为空')
		}
		await groupChatApi.setAdmin(normalizedGroupNo, normalizedAccount)
		await syncGroupSessionByNo(normalizedGroupNo)
	}

	const removeGroupAdmin = async (
		groupNo: string,
		account: string,
	): Promise<void> => {
		const normalizedGroupNo = groupNo.trim()
		const normalizedAccount = account.trim()
		if (!normalizedGroupNo || !normalizedAccount) {
			throw new Error('群号和账号不能为空')
		}
		await groupChatApi.removeAdmin(normalizedGroupNo, normalizedAccount)
		await syncGroupSessionByNo(normalizedGroupNo)
	}

	const kickGroupMember = async (
		groupNo: string,
		account: string,
	): Promise<void> => {
		const normalizedGroupNo = groupNo.trim()
		const normalizedAccount = account.trim()
		if (!normalizedGroupNo || !normalizedAccount) {
			throw new Error('群号和账号不能为空')
		}
		await groupChatApi.kickMember(normalizedGroupNo, normalizedAccount)
		await syncGroupSessionByNo(normalizedGroupNo)
	}

	const refreshAllGroupSessions = async (): Promise<void> => {
		const groupNosFromLocal = chatlist.value
			.filter((chat) => chat.chatType === 'GROUP')
			.map((chat) => chat.groupNo?.trim() || '')
			.filter(Boolean)
		let groupNosFromRemote: string[] = []
		try {
			groupNosFromRemote = await fetchAllJoinedGroupNos()
		} catch (error) {
			console.warn('拉取我加入的群列表失败，回退本地群列表:', error)
		}
		const groupNos = Array.from(
			new Set([...groupNosFromLocal, ...groupNosFromRemote]),
		)
		for (const groupNo of groupNos) {
			await syncGroupSessionByNo(groupNo)
		}
	}

	return {
		activeChatId,
		activeChat,
		chatlist,
		pinnedChats,
		messages,
		messageJumpTarget,
		activeChatMessages,
		setActiveChat,
		requestMessageJump,
		clearMessageJump,
		saveDraft,
		getDraft,
		sendMessage,
		sendMessageToAccount,
		toggleMessageReaction,
		recallMessage,
		canRecallMessage,
		pinChat,
		unpinChat,
		deleteChat,
		markAsRead,
		getSystemNotificationChatId,
		openSystemNotificationChat,
		isSystemNotificationChatItem,
		requestFullState,
		init,
		getOrCreateChat,
		createGroupChat,
		getGroupInfo,
		getGroupMembers,
		joinGroupChat,
		quitGroupChat,
		disbandGroupChat,
		inviteGroupFriend,
		updateGroupAnnouncement,
		setGroupAdmin,
		removeGroupAdmin,
		kickGroupMember,
		refreshAllGroupSessions,
		pullChatHistory,
		loadMoreChatHistory,
		queryChatHistory,
		searchLocalMessagesGlobal,
		getComposerQuote,
		clearComposerQuote,
		setComposerQuoteFromMessage,
	}
})

// --- 类型定义 ---
export interface ChatItem {
	id: number
	chatType?: 'PRIVATE' | 'GROUP'
	peerAccount?: string
	groupNo?: string
	myRole?: GroupRole
	maxMembers?: number
	memberCount?: number
	announcement?: string
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	lastMessageAt?: string
	online: boolean
	unreadCount?: number
	mentionUnreadCount?: number
	isPinned?: boolean
}

export interface Message {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	senderAccount?: string
	senderName?: string
	senderAvatar?: string
	text: string
	timestamp: string
	type: 'text' | 'image' | 'file' | 'transfer'
	hasResult?: boolean
	result?: string
	clientMessageId?: string
	serverMessageId?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	sentAt?: string
	reactions?: MessageReaction[]
	quote?: ComposerMessageQuote
	recalled?: boolean
	recalledAt?: string
	recallDeadlineAt?: string
}

export interface MessageQuote {
	messageId: string
	from?: string
	fromName?: string
	content?: string
}

export interface ComposerMessageQuote extends MessageQuote {
}

export interface MessageReaction {
	key: string
	emoji?: string
	imageUrl?: string
	userIds: string[]
	count: number
	updatedAt: string
}

export interface MessageJumpTarget {
	chatId: number
	messageId: number
	serverMessageId?: string
	clientMessageId?: string
	keyword?: string
	token: number
}

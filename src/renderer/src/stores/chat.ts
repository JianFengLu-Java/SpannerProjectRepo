import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useUserInfoStore } from './userInfo'
import { useFriendStore } from './friend'
import { tokenManager } from '@renderer/services/tokenManager'
import request from '@renderer/utils/request'
import { isDicebearAvatarUrl, resolveAvatarUrl } from '@renderer/utils/avatar'
import {
	privateChatWs,
	type PrivateChatAckFrame,
	type PrivateChatErrorFrame,
	type PrivateChatMessageFrame,
} from '@renderer/services/privateChatWs'

interface DbChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	online: number
	unreadCount: number
	isPinned: number
}

interface DbMessage {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	text: string
	timestamp: string
	type: string
	hasResult: number
	result?: string
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
	messageId?: string
	from: string
	to: string
	content: string
	clientMessageId?: string
	sentAt?: string
	type?: string
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
	page?: number
	size?: number
	appendToStore?: boolean
	startDate?: string
	endDate?: string
	type?: MessageTypeFilter
	keyword?: string
}

interface QueryChatHistoryOptions {
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

type MessageTypeFilter = 'all' | Message['type']

interface HydrateStorePayload {
	messages?: Record<number, Message[]>
	chatlist?: ChatItem[]
	pinnedChats?: ChatItem[]
	scope?: string
}

export const useChatStore = defineStore('chat', () => {
	const userInfoStore = useUserInfoStore()
	const friendStore = useFriendStore()
	// --- 状态定义 ---
	const activeChatId = ref<number | null>(null)
	const drafts = ref<Record<number, Record<string, unknown> | null>>({})
	const chatlist = ref<ChatItem[]>([])
	const pinnedChats = ref<ChatItem[]>([])
	const messages = ref<Record<number, Message[]>>({})
	const isDbInitialized = ref(false)
	const initializedAccount = ref('')
	const isWsBound = ref(false)
	const wsBoundAccount = ref('')
	const wsBoundToken = ref('')
	const offlinePulledAccount = ref('')
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
	const loadingHistoryChatIds = ref(new Set<number>())
	const hydratedHistoryChatIds = ref(new Set<number>())

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

	const formatTimeFromIso = (iso?: string): string => {
		if (!iso) {
			return new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			})
		}
		const date = new Date(iso)
		if (Number.isNaN(date.getTime())) {
			return new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			})
		}
		return date.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	const getTextPreview = (content: string): string => {
		const plainText = content
			.replace(/<[^>]*>?/gm, '')
			.trim()
			.slice(0, 30)
		return plainText || '[图片]'
	}

	const inferMessageType = (
		content: string,
		type?: string,
	): Message['type'] => {
		const normalizedType = (type || '').trim().toLowerCase()
		if (
			normalizedType === 'image' ||
			normalizedType === 'file' ||
			normalizedType === 'text'
		) {
			return normalizedType
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

	const normalizeDateInput = (value?: string): string | undefined => {
		if (!value?.trim()) return undefined
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return undefined
		return date.toISOString()
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
		payload: HistoryMessageDto | PrivateChatMessageFrame,
		chatId: number,
		currentAccount: string,
	): Message => {
		const sentAt = payload.sentAt || undefined
		const stableIdBase = payload.messageId || payload.clientMessageId
		let stableId = 0
		if (stableIdBase) {
			for (let i = 0; i < stableIdBase.length; i += 1) {
				stableId =
					(stableId * 31 + stableIdBase.charCodeAt(i)) % 2147483647
			}
		}
		return {
			id: stableId || Date.now() + Math.floor(Math.random() * 100000),
			chatId,
			senderId: payload.from === currentAccount ? 'me' : 'other',
			text: payload.content || '',
			timestamp: formatTimeFromIso(payload.sentAt),
			type: inferMessageType(
				payload.content || '',
				'type' in payload ? payload.type : undefined,
			),
			clientMessageId: payload.clientMessageId || undefined,
			serverMessageId: payload.messageId || undefined,
			deliveryStatus: 'sent',
			sentAt,
		}
	}

	const mergeMessagesToStore = (
		chatId: number,
		incomingMessages: Message[],
		position: 'append' | 'prepend' = 'append',
	): number => {
		if (!incomingMessages.length) return 0
		const existing = messages.value[chatId] || []
		const clientIdSet = new Set(
			existing
				.map((item) => item.clientMessageId)
				.filter((item): item is string => !!item),
		)
		const serverIdSet = new Set(
			existing
				.map((item) => item.serverMessageId)
				.filter((item): item is string => !!item),
		)
		const toInsert: Message[] = []

		for (const item of incomingMessages) {
			const duplicatedByClientId =
				!!item.clientMessageId && clientIdSet.has(item.clientMessageId)
			const duplicatedByServerId =
				!!item.serverMessageId && serverIdSet.has(item.serverMessageId)
			if (duplicatedByClientId || duplicatedByServerId) continue
			toInsert.push(item)
			if (item.clientMessageId) clientIdSet.add(item.clientMessageId)
			if (item.serverMessageId) serverIdSet.add(item.serverMessageId)
			db.saveMessage(item)
		}

		const inserted = toInsert.length
		const merged =
			position === 'prepend'
				? [...toInsert, ...existing]
				: [...existing, ...toInsert]

		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId] = merged
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
						hasResult: !!m.hasResult,
					}) as Message,
			)
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
			window.electron.ipcRenderer.invoke('db-save-message', account, {
				...message,
				hasResult: message.hasResult ? 1 : 0,
			})
		},
		updateLastMessage(id: number, text: string, time: string): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke(
				'db-update-last-message',
				account,
				id,
				text,
				time,
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
		deleteChat(id: number): void {
			const account = getCurrentAccount()
			window.electron.ipcRenderer.invoke('db-delete-chat', account, id)
		},
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
		loadingHistoryChatIds.value.clear()
		hydratedHistoryChatIds.value.clear()

		const chats = await db.getAllChats()
		chatlist.value = chats
		pinnedChats.value = chats.filter((c) => c.isPinned)
		initializedAccount.value = account
		isDbInitialized.value = true
		bindPrivateChatWs()
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

	const syncChatAvatarsWithFriends = (): void => {
		if (!chatlist.value.length || !friendStore.friends.length) return
		const friendAvatarMap = new Map(
			friendStore.friends.map((friend) => [
				friend.id,
				resolveAvatarUrl(friend.avatar),
			]),
		)

		for (const chat of chatlist.value) {
			const friendAvatar = friendAvatarMap.get(String(chat.id))
			if (!friendAvatar) continue
			if (chat.avatar === friendAvatar) continue
			if (!chat.avatar.trim() || isDicebearAvatarUrl(chat.avatar)) {
				chat.avatar = friendAvatar
				db.saveChat(chat)
			}
		}
	}

	const ensureChatSession = async (
		account: string,
	): Promise<number | null> => {
		const chatId = Number(account)
		if (!Number.isFinite(chatId)) return null

		let existing = chatlist.value.find((item) => item.id === chatId)
		if (existing) return chatId

		const friend = friendStore.friends.find((item) => item.id === account)
		const newChat: ChatItem = {
			id: chatId,
			name: friend?.name || account,
			avatar: resolveAvatarUrl(friend?.avatar),
			lastMessage: '',
			timestamp: formatTimeFromIso(),
			online: true,
			unreadCount: 0,
			isPinned: false,
		}
		chatlist.value.unshift(newChat)
		db.saveChat(newChat)
		existing = newChat
		return existing.id
	}

	const handleIncomingWsMessage = async (
		payload: PrivateChatMessageFrame,
	): Promise<void> => {
		let currentAccount = ''
		try {
			currentAccount = getCurrentAccount()
		} catch {
			return
		}

		const peerAccount =
			payload.from === currentAccount ? payload.to : payload.from
		const chatId = await ensureChatSession(peerAccount)
		if (!chatId) return

		const incomingClientMessageId = payload.clientMessageId || ''
		const incomingServerMessageId = payload.messageId || ''
		const existingList = messages.value[chatId] || []
		if (
			existingList.some(
				(item) =>
					(!!incomingClientMessageId &&
						item.clientMessageId === incomingClientMessageId) ||
					(!!incomingServerMessageId &&
						item.serverMessageId === incomingServerMessageId),
			)
		) {
			// 发送方回显或重复消息，直接标记为 sent
			if (incomingClientMessageId) {
				updateMessageStatusLocal(
					chatId,
					incomingClientMessageId,
					'sent',
				)
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

		const preview = getTextPreview(newMessage.text)
		updateLastMessageLocal(chatId, preview, newMessage.timestamp)

		const chat = chatlist.value.find((item) => item.id === chatId)
		const isReadingCurrentChat =
			isChatViewActive() && activeChatId.value === chatId
		if (chat && newMessage.senderId === 'other' && !isReadingCurrentChat) {
			chat.unreadCount = (chat.unreadCount || 0) + 1
			db.saveChat(chat)
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

		const response = await request.get<ApiResponse<ChatHistoryPageData>>(
			`/messages/history/${chatId}`,
			{
				params: {
					page,
					size,
					startDate,
					endDate,
					type: messageType,
					keyword,
				},
			},
		)

		const data = response.data?.data || {}
		const rawMessages = Array.isArray(data.messages) ? data.messages : []
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
			const currentPage = data.page || page
			mergeMessagesToStore(
				chatId,
				filtered,
				currentPage > 1 ? 'prepend' : 'append',
			)

			const latest = filtered[filtered.length - 1]
			if (latest) {
				updateLastMessageLocal(
					chatId,
					getTextPreview(latest.text),
					latest.timestamp,
					false,
				)
			}
		}

		historyPaginationMap.value.set(chatId, {
			nextPage: (data.page || page) + 1,
			hasMore: !!data.hasMore,
		})

		return {
			...data,
			messages: rawMessages,
		}
	}

	const loadMoreChatHistory = async (
		chatId: number,
		size = 20,
	): Promise<boolean> => {
		if (loadingHistoryChatIds.value.has(chatId)) {
			return !!historyPaginationMap.value.get(chatId)?.hasMore
		}
		const pagination = historyPaginationMap.value.get(chatId)
		if (pagination && !pagination.hasMore) return false
		const targetPage = pagination?.nextPage || 2
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
		let page = 1
		let hasMore = true
		let pagesScanned = 0

		while (hasMore && pagesScanned < maxPages) {
			const data = await pullChatHistory(chatId, {
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
			matched.push(...filtered)

			page += 1
			pagesScanned += 1
			hasMore = !!data.hasMore
		}

		return {
			messages: matched,
			pagesScanned,
			hasMore,
			totalMatched: matched.length,
		}
	}

	const handleWsAck = (payload: PrivateChatAckFrame): void => {
		const clientMessageId = payload.clientMessageId || ''
		if (!clientMessageId) return
		const pending = pendingMessageMap.value.get(clientMessageId)
		if (!pending) return
		updateMessageStatusLocal(pending.chatId, clientMessageId, 'sent')
		pendingMessageMap.value.delete(clientMessageId)
		syncAction('updateMessageStatus', {
			chatId: pending.chatId,
			clientMessageId,
			status: 'sent',
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
			isWsBound.value &&
			wsBoundAccount.value === account &&
			wsBoundToken.value === normalizedToken
		) {
			return
		}

		privateChatWs.connect(token, {
			onMessage: (payload) => {
				void handleIncomingWsMessage(payload)
			},
			onAck: handleWsAck,
			onError: handleWsError,
		})
		isWsBound.value = true
		wsBoundAccount.value = account
		wsBoundToken.value = normalizedToken
	}

	tokenManager.onTokenUpdated(() => {
		isWsBound.value = false
		wsBoundToken.value = ''
		offlinePulledAccount.value = ''
		bindPrivateChatWs()
		void pullOfflineMessages()
	})

	tokenManager.onTokenCleared(() => {
		privateChatWs.disconnect()
		isWsBound.value = false
		wsBoundAccount.value = ''
		wsBoundToken.value = ''
		offlinePulledAccount.value = ''
		pendingMessageMap.value.clear()
		historyPaginationMap.value.clear()
	})

	watch(
		() =>
			friendStore.friends.map(
				(friend) => `${friend.id}:${friend.avatar}`,
			),
		() => {
			syncChatAvatarsWithFriends()
		},
		{ immediate: true },
	)

	if (window.electron && window.electron.ipcRenderer) {
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
					case 'sendMessage':
						if (!messages.value[data.chatId])
							messages.value[data.chatId] = []
						if (
							!messages.value[data.chatId].some(
								(m) => m.id === data.message.id,
							)
						) {
							messages.value[data.chatId].push(data.message)
							updateLastMessageLocal(
								data.chatId,
								data.textPreview,
							)
						}
						break
					case 'updateMessageStatus':
						updateMessageStatusLocal(
							data.chatId,
							data.clientMessageId,
							data.status,
							data.result,
						)
						break
					case 'pinChat':
						pinChatLocal(data.chatId)
						break
					case 'unpinChat':
						unpinChatLocal(data.chatId)
						break
					case 'deleteChat':
						deleteChatLocal(data.chatId)
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

				if (payload.messages) messages.value = payload.messages
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

			db.updateLastMessage(id, message, time)
		}
	}

	const updateMessageStatusLocal = (
		chatId: number,
		clientMessageId: string,
		status: 'sent' | 'failed',
		result?: string,
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
	}

	const markAsReadLocal = (id: number): void => {
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			chat.unreadCount = 0
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

	const deleteChatLocal = (chatId: number): void => {
		chatlist.value = chatlist.value.filter((c) => c.id !== chatId)
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		db.deleteChat(chatId)
		if (activeChatId.value === chatId) activeChatId.value = null
	}

	// --- 暴露给 UI 的方法 ---
	const setActiveChat = async (id: number): Promise<void> => {
		if (!isDbInitialized.value) {
			await init()
		}
		activeChatId.value = id
		if (!messages.value[id]) {
			const msgs = await db.getMessages(id)
			messages.value[id] = msgs
		}
		if (hydratedHistoryChatIds.value.has(id)) return
		try {
			await pullChatHistory(id, {
				page: 1,
				size: 20,
				appendToStore: true,
			})
			hydratedHistoryChatIds.value.add(id)
		} catch (error) {
			console.warn('拉取聊天记录失败:', error)
		}
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

	const sendMessage = (
		content: string,
		type: 'text' | 'image' | 'rich-text' = 'text',
	): void => {
		if (!activeChatId.value || !content) return

		bindPrivateChatWs()
		const chatId = activeChatId.value
		const clientMessageId = createClientMessageId()
		const sentAt = new Date().toISOString()
		const newMessage: Message = {
			id: Date.now(),
			chatId,
			senderId: 'me',
			text: content,
			timestamp: formatTimeFromIso(sentAt),
			type: inferMessageType(content, type),
			clientMessageId,
			deliveryStatus: 'sending',
			sentAt,
		}

		if (!messages.value[chatId]) {
			messages.value[chatId] = []
		}
		messages.value[chatId].push(newMessage)
		db.saveMessage(newMessage) // 保存到 DB

		const textPreview = getTextPreview(content)
		updateLastMessageLocal(chatId, textPreview)

		syncAction('sendMessage', {
			chatId,
			message: newMessage,
			textPreview,
		})

		const sent = privateChatWs.sendPrivate(
			String(chatId),
			content,
			clientMessageId,
		)
		if (sent) {
			pendingMessageMap.value.set(clientMessageId, {
				chatId,
				tempMessageId: newMessage.id,
			})
			return
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
		deleteChatLocal(chatId)
		syncAction('deleteChat', { chatId })
	}

	const markAsRead = (id: number): void => {
		markAsReadLocal(id)
		syncAction('markAsRead', { chatId: id })
	}

	const getOrCreateChat = async (friend: {
		id: string
		name: string
		avatar: string
	}): Promise<number> => {
		const id = parseInt(friend.id)
		const existing = chatlist.value.find((c) => c.id === id)
		if (existing) {
			return id
		}
		// 创建新会话
		const newChat: ChatItem = {
			id,
			name: friend.name,
			avatar: resolveAvatarUrl(friend.avatar),
			lastMessage: '',
			timestamp: new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			}),
			online: true,
			unreadCount: 0,
			isPinned: false,
		}
		chatlist.value.unshift(newChat)
		db.saveChat(newChat)
		return id
	}

	return {
		activeChatId,
		activeChat,
		chatlist,
		pinnedChats,
		messages,
		activeChatMessages,
		setActiveChat,
		saveDraft,
		getDraft,
		sendMessage,
		pinChat,
		unpinChat,
		deleteChat,
		markAsRead,
		requestFullState,
		init,
		getOrCreateChat,
		pullChatHistory,
		loadMoreChatHistory,
		queryChatHistory,
	}
})

// --- 类型定义 ---
export interface ChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	online: boolean
	unreadCount?: number
	isPinned?: boolean
}

export interface Message {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	text: string
	timestamp: string
	type: 'text' | 'image' | 'file'
	hasResult?: boolean
	result?: string
	clientMessageId?: string
	serverMessageId?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	sentAt?: string
}

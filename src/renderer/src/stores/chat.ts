import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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

export const useChatStore = defineStore('chat', () => {
	// --- 状态定义 ---
	const activeChatId = ref<number | null>(null)
	const drafts = ref<Record<number, Record<string, unknown> | null>>({})
	const chatlist = ref<ChatItem[]>([])
	const pinnedChats = ref<ChatItem[]>([])
	const messages = ref<Record<number, Message[]>>({})
	const isDbInitialized = ref(false)

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
			const rawChats =
				await window.electron.ipcRenderer.invoke('db-get-all-chats')
			return (rawChats as DbChatItem[]).map((c) => ({
				...c,
				online: !!c.online,
				isPinned: !!c.isPinned,
			}))
		},
		async getMessages(chatId: number): Promise<Message[]> {
			const rawMsgs = await window.electron.ipcRenderer.invoke(
				'db-get-messages',
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
			window.electron.ipcRenderer.invoke('db-save-chat', {
				...chat,
				online: chat.online ? 1 : 0,
				isPinned: chat.isPinned ? 1 : 0,
			})
		},
		saveMessage(message: Message): void {
			window.electron.ipcRenderer.invoke('db-save-message', {
				...message,
				hasResult: message.hasResult ? 1 : 0,
			})
		},
		updateLastMessage(id: number, text: string, time: string): void {
			window.electron.ipcRenderer.invoke(
				'db-update-last-message',
				id,
				text,
				time,
			)
		},
		setPinned(id: number, isPinned: boolean): void {
			window.electron.ipcRenderer.invoke('db-set-pinned', id, isPinned)
		},
		deleteChat(id: number): void {
			window.electron.ipcRenderer.invoke('db-delete-chat', id)
		},
	}

	// --- 初始化逻辑 ---
	const init = async (): Promise<void> => {
		if (isDbInitialized.value) return

		const chats = await db.getAllChats()
		if (chats.length > 0) {
			chatlist.value = chats
			pinnedChats.value = chats.filter((c) => c.isPinned)
		} else {
			// 如果数据库为空，可以插入一些初始演示数据
			const initialChats: ChatItem[] = [
				{
					id: 1,
					name: '张三',
					avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
					lastMessage: '设计稿已上传',
					timestamp: '10:30',
					online: true,
					unreadCount: 2,
					isPinned: true,
				},
				{
					id: 2,
					name: '李四',
					avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
					lastMessage: '服务时间？',
					timestamp: '9:15',
					online: true,
					unreadCount: 0,
					isPinned: true,
				},
				{
					id: 3,
					name: '王五',
					avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
					lastMessage: '谢谢！',
					timestamp: '昨天',
					online: false,
					unreadCount: 5,
					isPinned: false,
				},
			]
			initialChats.forEach((c) => db.saveChat(c))
			chatlist.value = initialChats
			pinnedChats.value = initialChats.filter((c) => c.isPinned)
		}
		isDbInitialized.value = true
	}

	// --- 跨窗口同步逻辑 ---
	const syncAction = (
		action: string,
		data: Record<string, unknown>,
	): void => {
		if (window.electron && window.electron.ipcRenderer) {
			window.electron.ipcRenderer.send('sync-store', { action, data })
		}
	}

	const requestFullState = (): void => {
		if (window.electron && window.electron.ipcRenderer) {
			window.electron.ipcRenderer.send('request-store-data')
		}
	}

	if (window.electron && window.electron.ipcRenderer) {
		window.electron.ipcRenderer.on(
			'store-update',
			(
				_event: unknown,
				payload: { action: string; data: Record<string, unknown> },
			) => {
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
				window.electron.ipcRenderer.send(
					'report-store-data',
					targetId,
					{
						messages: messages.value,
						chatlist: chatlist.value,
						pinnedChats: pinnedChats.value,
					},
				)
			},
		)

		window.electron.ipcRenderer.on(
			'hydrate-store-data',
			(_event: unknown, payload: Record<string, any>) => {
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
	const updateLastMessageLocal = (id: number, message: string): void => {
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			const time = new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			})
			chat.lastMessage = message
			chat.timestamp = time
			db.updateLastMessage(id, message, time)
		}
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

		const newMessage: Message = {
			id: Date.now(),
			chatId: activeChatId.value,
			senderId: 'me',
			text: content,
			timestamp: new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			}),
			type: type as 'text' | 'image' | 'file',
		}

		if (!messages.value[activeChatId.value]) {
			messages.value[activeChatId.value] = []
		}
		messages.value[activeChatId.value].push(newMessage)
		db.saveMessage(newMessage) // 保存到 DB

		const plainText = content.replace(/<[^>]*>?/gm, '').slice(0, 30)
		const textPreview = plainText || '[图片]'
		updateLastMessageLocal(activeChatId.value, textPreview)

		syncAction('sendMessage', {
			chatId: activeChatId.value,
			message: newMessage,
			textPreview,
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
}

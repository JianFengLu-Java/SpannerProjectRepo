import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
	//当前选中的聊天ID
	const activeChatId = ref<number | null>(null)

	//草稿内容
	const drafts = ref<Record<number, any>>({})

	// 保存草稿
	function saveDraft(id: number, content: any): void {
		drafts.value[id] = content
	}

	// 获取草稿
	function getDraft(id: number): Record<string, any> {
		return (
			drafts.value[id] || {
				type: 'doc',
				content: [{ type: 'paragraph' }],
			}
		)
	}

	//聊天列表
	const chatlist = ref<ChatItem[]>([
		{
			id: 1,
			name: '张三',
			avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
			lastMessage: '设计稿已上传，请查收',
			timestamp: '10:30',
			online: true,
			unreadCount: 2,
			isPinned: true,
		},
		{
			id: 2,
			name: '李四',
			avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
			lastMessage: '请问你们的服务时间是？',
			timestamp: '9:15',
			online: true,
			unreadCount: 0,
			isPinned: true,
		},
		{
			id: 3,
			name: '王五',
			avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
			lastMessage: '谢谢你的帮助！',
			timestamp: '昨天',
			online: false,
			unreadCount: 5,
			isPinned: false,
		},
		{
			id: 4,
			name: '赵六',
			avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
			lastMessage: '我有一个问题想咨询一下',
			timestamp: '周一',
			online: true,
			unreadCount: 0,
			isPinned: false,
		},
		{
			id: 5,
			name: '钱七',
			avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
			lastMessage: '我想了解一下你们的最新产品',
			timestamp: '周日',
			online: false,
			unreadCount: 0,
			isPinned: false,
		},
		{
			id: 6,
			name: '孙八',
			avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
			lastMessage: '请问你们的服务时间是？',
			timestamp: '周六',
			online: true,
			unreadCount: 3,
			isPinned: false,
		},
		{
			id: 7,
			name: '周九',
			avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
			lastMessage: '谢谢你的帮助！',
			timestamp: '周五',
			online: false,
			unreadCount: 0,
			isPinned: false,
		},
		{
			id: 8,
			name: '吴十',
			avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
			lastMessage: '我有一个问题想咨询一下',
			timestamp: '周四',
			online: true,
			unreadCount: 0,
			isPinned: false,
		},
	])

	const pinnedChats = ref<ChatItem[]>([
		{
			id: 1,
			name: '张三',
			avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
			lastMessage: '项目文档已更新',
			timestamp: '10:30',
			online: true,
			isPinned: true,
		},
		{
			id: 2,
			name: '李四',
			avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
			lastMessage: '会议纪要已同步',
			timestamp: '昨天',
			online: false,
			isPinned: true,
		},
	])

	const activeChat = computed(() => {
		return (
			chatlist.value.find((chat) => chat.id === activeChatId.value) ||
			null
		)
	})

	//
	const setActiveChat = (id: number): void => {
		activeChatId.value = id
	}

	// 方法：添加新聊天
	const addChat = (chat: Omit<ChatItem, 'id'>): number => {
		// 计算新聊天的id：取当前最大id加1
		const newId = Math.max(...chatlist.value.map((c) => c.id), 0) + 1
		// 将新聊天对象推入chatList数组
		chatlist.value.push({
			id: newId, // 添加自动生成的id
			...chat, // 展开传入的聊天对象
		})
		// 返回新聊天的id
		return newId
	}

	// 方法：更新聊天最后消息
	const updateLastMessage = (id: number, message: string): void => {
		// 在chatList中查找指定id的聊天
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			// 如果找到
			chat.lastMessage = message // 更新最后消息内容
			chat.timestamp = new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			}) // 更新时间戳为当前时间
		}
	}

	// 方法：标记消息为已读
	const markAsRead = (id: number): void => {
		// 在chatList中查找指定id的聊天
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			// 如果找到
			chat.unreadCount = 0 // 将未读数重置为0
		}
	}
	// 新增方法
	const pinChat = (chatId: number): void => {
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat && !pinnedChats.value.some((c) => c.id === chatId)) {
			chat.isPinned = true
			pinnedChats.value.unshift(chat)
		}
	}

	const unpinChat = (chatId: number): void => {
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat) {
			chat.isPinned = false
		}
	}

	const deleteChat = (chatId: number): void => {
		chatlist.value = chatlist.value.filter((c) => c.id !== chatId)
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		if (activeChatId.value === chatId) {
			activeChatId.value = null
		}
	}

	//
	const messages = ref<Record<number, Message[]>>({
		1: [
			{
				id: 101,
				chatId: 1,
				senderId: 'other',
				text: '你好，张三在这里asdasdasdasdasdasdadasdasdasdasdasdasdasdasdasdasasdasdasdsasdasdasds。',
				timestamp: '10:00',
				type: 'text',
			},
			{
				id: 102,
				chatId: 1,
				senderId: 'me',
				text: '你好，关于那个项目进度？',
				timestamp: '10:05',
				type: 'text',
			},
			{
				id: 103,
				chatId: 1,
				senderId: 'other',
				text: '设计稿已上传，请查收',
				timestamp: '10:30',
				type: 'text',
			},
		],
		2: [
			{
				id: 201,
				chatId: 2,
				senderId: 'other',
				text: '请问你们的服务时间是？',
				timestamp: '09:00',
				type: 'text',
			},
			{
				id: 202,
				chatId: 2,
				senderId: 'me',
				text: '我们周一到周五 9:00 - 18:00 在线。<img src="https://http.cat/200">',
				timestamp: '09:15',
				type: 'text',
			},
		],
		3: [
			{
				id: 301,
				chatId: 3,
				senderId: 'me',
				text: '你的问题解决了吗？',
				timestamp: '昨天',
				type: 'text',
			},
			{
				id: 302,
				chatId: 3,
				senderId: 'other',
				text: '谢谢你的帮助！已经搞定了。',
				timestamp: '昨天',
				type: 'text',
			},
		],
	})

	// 3. 计算属性：获取当前选中的所有消息
	const activeChatMessages = computed(() => {
		if (!activeChatId.value) return []
		return messages.value[activeChatId.value] || []
	})

	// 4. 方法：发送新消息
	const sendMessage = (
		content: string,
		type: 'text' | 'image' | 'rich-text' = 'text',
	) => {
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
			type: type as any,
		}

		// 如果该会话还没有消息数组，先初始化
		if (!messages.value[activeChatId.value]) {
			messages.value[activeChatId.value] = []
		}

		messages.value[activeChatId.value].push(newMessage)

		const plainText = content.replace(/<[^>]*>?/gm, '').slice(0, 30)
		updateLastMessage(activeChatId.value, plainText || '[图片]') // 同步更新侧边栏预览
	}

	// 返回store的所有状态和方法
	return {
		getDraft,
		saveDraft,
		activeChatId, // 当前聊天ID
		activeChat, // 当前聊天对象计算属性
		chatlist, // 所有聊天列表
		pinnedChats, // 置顶聊天列表
		setActiveChat, // 设置当前聊天方法
		addChat, // 添加新聊天方法
		updateLastMessage, // 更新最后消息方法
		markAsRead, // 标记已读方法
		pinChat,
		unpinChat,
		deleteChat,
		messages,
		activeChatMessages,
		sendMessage,
	}
})

interface ChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	online: boolean
	unreadCount?: number
	isPinned?: boolean
}
// 1. 定义消息接口
interface Message {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	text: string
	timestamp: string
	type: 'text' | 'image' | 'file'
}

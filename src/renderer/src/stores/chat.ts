import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
	//当前选中的聊天ID
	const activeChatId = ref<number | null>(null)

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
			isPinned:true

		},
		{
			id: 2,
			name: '李四',
			avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
			lastMessage: '请问你们的服务时间是？',
			timestamp: '9:15',
			online: true,
			unreadCount: 0,
			isPinned:true
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
	const setActiveChat = (id: number) => {
		activeChatId.value = id
	}

	// 方法：添加新聊天
	const addChat = (chat: Omit<ChatItem, 'id'>) => {
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
	const updateLastMessage = (id: number, message: string) => {
		// 在chatList中查找指定id的聊天
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			// 如果找到
			chat.lastMessage = message // 更新最后消息内容
			chat.timestamp = new Date().toLocaleTimeString() // 更新时间戳为当前时间
		}
	}

	// 方法：标记消息为已读
	const markAsRead = (id: number) => {
		// 在chatList中查找指定id的聊天
		const chat = chatlist.value.find((c) => c.id === id)
		if (chat) {
			// 如果找到
			chat.unreadCount = 0 // 将未读数重置为0
		}
	}
	// 新增方法
	const pinChat = (chatId: number) => {
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat && !pinnedChats.value.some((c) => c.id === chatId)) {
			chat.isPinned = true
			pinnedChats.value.unshift(chat)
		}
	}

	const unpinChat = (chatId: number) => {
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		const chat = chatlist.value.find((c) => c.id === chatId)
		if (chat) {
			chat.isPinned = false
		}
	}

	const deleteChat = (chatId: number) => {
		chatlist.value = chatlist.value.filter((c) => c.id !== chatId)
		pinnedChats.value = pinnedChats.value.filter((c) => c.id !== chatId)
		if (activeChatId.value === chatId) {
			activeChatId.value = null
		}
	}

	// 返回store的所有状态和方法
	return {
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

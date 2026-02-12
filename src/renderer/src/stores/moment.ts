import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserInfoStore } from './userInfo'

export interface Comment {
	id: string
	author: {
		name: string
		avatar: string
	}
	text: string
	timestamp: string
	likes: number
}

export interface Moment {
	id: string
	title: string
	cover: string
	author: {
		name: string
		avatar: string
	}
	likes: number
	isLiked: boolean
	timestamp: string
	content?: string
	contentHtml?: string
	images?: string[]
	comments: Comment[]
}

interface AddMomentPayload {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}

export const useMomentStore = defineStore('moment', () => {
	const moments = ref<Moment[]>([
		{
			id: '1',
			title: '今日份打卡：深圳湾的日落真的太美了！🌊🌅',
			cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
			author: {
				name: '欲盖弥彰',
				avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
			},
			likes: 1240,
			isLiked: false,
			timestamp: '2小时前',
			content:
				'今天特意跑去深圳湾看日落，虽然人很多，但是看到太阳落下的那一刻，感觉所有的疲惫都消散了。这里的海风真的很舒服。',
			images: [
				'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
				'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
			],
			comments: [
				{
					id: 'c1',
					author: {
						name: '小王',
						avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
					},
					text: '真的好美呀！下次我也要去。',
					timestamp: '1小时前',
					likes: 12,
				},
				{
					id: 'c2',
					author: {
						name: '老李',
						avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
					},
					text: '摄影技术不错！',
					timestamp: '30分钟前',
					likes: 5,
				},
			],
		},
		{
			id: '2',
			title: '终于拿到了程序员的终极快乐：新机械键盘开箱！⌨️✨',
			cover: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=800&q=80',
			author: {
				name: '二当家',
				avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
			},
			likes: 856,
			isLiked: true,
			timestamp: '4小时前',
			content: '打字效率直接翻倍，这就是金钱的魅力吗？😂',
			comments: [],
		},
		{
			id: '3',
			title: '周末在家尝试做了简单的意面，卖相还不错吧？🍝😋',
			cover: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800&q=80',
			author: {
				name: '三当家',
				avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wang',
			},
			likes: 432,
			isLiked: false,
			timestamp: '昨天',
			content: '其实做起来挺容易的，主要是摆盘要好看！',
			comments: [],
		},
		{
			id: '4',
			title: '深夜撸码，唯独这盏灯陪着我... 💻🌙',
			cover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
			author: {
				name: '张三',
				avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
			},
			likes: 2100,
			isLiked: false,
			timestamp: '5小时前',
			content: '项目上线倒计时，冲冲冲！',
			comments: [],
		},
		{
			id: '5',
			title: '猫咪真的能治愈一切不开心 🐱❤️',
			cover: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80',
			author: {
				name: '李四',
				avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cat',
			},
			likes: 3500,
			isLiked: true,
			timestamp: '3天前',
			content: '看这小眼神，谁能受得了？',
			comments: [],
		},
		{
			id: '6',
			title: '这就是大自然的鬼斧神工吗？震撼！🏞️',
			cover: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
			author: {
				name: '王五',
				avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
			},
			likes: 189,
			isLiked: false,
			timestamp: '刚刚',
			content: '此生一定要去一次这里。',
			comments: [],
		},
		{
			id: '7',
			title: '极简风桌面改造，效率翻倍！🖥️',
			cover: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800&q=80',
			author: {
				name: '欲盖弥彰',
				avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
			},
			likes: 678,
			isLiked: false,
			timestamp: '1小时前',
			content: '断舍离真的能让人心情愉悦。',
			comments: [],
		},
	])

	const selectedMomentId = ref<string | null>(null)
	const activeTab = ref('recommend')
	const searchQuery = ref('')

	const selectedMoment = computed(() => {
		return (
			moments.value.find((m) => m.id === selectedMomentId.value) || null
		)
	})

	const toggleLike = (id: string): void => {
		const moment = moments.value.find((m) => m.id === id)
		if (moment) {
			moment.isLiked = !moment.isLiked
			moment.likes += moment.isLiked ? 1 : -1
		}
	}

	const addComment = (momentId: string, text: string): void => {
		const moment = moments.value.find((m) => m.id === momentId)
		if (moment && text.trim()) {
			// 使用 userInfoStore 获取当前用户信息
			const userInfoStore = useUserInfoStore()

			const newComment: Comment = {
				id: `c${Date.now()}`,
				author: {
					name: userInfoStore.userName || '当前用户',
					avatar:
						userInfoStore.avatarUrl ||
						'https://api.dicebear.com/7.x/avataaars/svg?seed=current',
				},
				text: text.trim(),
				timestamp: '刚刚',
				likes: 0,
			}
			moment.comments.unshift(newComment)
		}
	}

	const createDefaultCover = (title: string): string => {
		const safeTitle = title.slice(0, 28)
		const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#34d399'/><stop offset='100%' stop-color='#60a5fa'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='rgba(255,255,255,.92)' font-size='58' font-family='Arial,sans-serif'>${safeTitle}</text></svg>`
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
	}

	const addMoment = (payload: AddMomentPayload): Moment => {
		const userInfoStore = useUserInfoStore()
		const title = payload.title.trim()
		const contentText = payload.contentText.trim()
		const images = payload.images || []
		const finalTitle = title || contentText.slice(0, 26) || '新动态'

		const newMoment: Moment = {
			id: `m-${Date.now()}`,
			title: finalTitle,
			cover: images[0] || createDefaultCover(finalTitle),
			author: {
				name: userInfoStore.userName || '当前用户',
				avatar:
					userInfoStore.avatarUrl ||
					'https://api.dicebear.com/7.x/avataaars/svg?seed=current',
			},
			likes: 0,
			isLiked: false,
			timestamp: '刚刚',
			content: contentText,
			contentHtml: payload.contentHtml,
			images,
			comments: [],
		}

		moments.value.unshift(newMoment)
		return newMoment
	}

	return {
		moments,
		selectedMomentId,
		selectedMoment,
		activeTab,
		searchQuery,
		toggleLike,
		addComment,
		addMoment,
	}
})

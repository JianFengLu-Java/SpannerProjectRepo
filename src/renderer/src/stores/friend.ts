import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Friend {
	id: string
	uid: string
	name: string
	remark: string
	avatar: string
	status: 'online' | 'offline'
	signature: string
	groupId: string
	// 新增字段
	gender?: 'male' | 'female' | 'unknown'
	age?: number
	region?: string
	email?: string
	tags?: string[]
	cover?: string
}

export interface Group {
	id: string
	name: string
	expanded: boolean
}

export const useFriendStore = defineStore('friend', () => {
	const friends = ref<Friend[]>([
		{
			id: '1',
			uid: '10001',
			name: '张三',
			remark: '老张',
			avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
			status: 'online',
			signature: '忙碌中，有事留言',
			groupId: 'default',
			gender: 'male',
			age: 28,
			region: '广东 深圳',
			email: 'zhangsan@spanner.com',
			tags: ['球友', '同事', '老乡'],
			cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
		},
		{
			id: '2',
			uid: '10002',
			name: '李四',
			remark: '',
			avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
			status: 'offline',
			signature: '代码如诗',
			groupId: 'work',
			gender: 'female',
			age: 24,
			region: '浙江 杭州',
			tags: ['前端', '爱猫者'],
			cover: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
		},
		{
			id: '3',
			uid: '10003',
			name: '王五',
			remark: '技术部-王五',
			avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy',
			status: 'online',
			signature: '不忘初心，方得始终',
			groupId: 'work',
			gender: 'male',
			age: 32,
			region: '北京 朝阳',
			email: 'wangwu@tech.com',
			tags: ['架构师', '钓鱼'],
			cover: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
		},
		{
			id: '4',
			uid: '10004',
			name: '赵六',
			remark: '',
			avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb',
			status: 'offline',
			signature: '正在闭关修炼',
			groupId: 'default',
			gender: 'male',
			age: 19,
			region: '上海 徐汇',
			tags: ['学生', '游戏大神'],
			cover: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
		},
	])

	const groups = ref<Group[]>([
		{ id: 'default', name: '我的好友', expanded: true },
		{ id: 'work', name: '工作伙伴', expanded: true },
		{ id: 'blacklist', name: '黑名单', expanded: false },
	])

	const selectedFriendId = ref<string | null>(null)

	const selectedFriend = computed(() => {
		return (
			friends.value.find((f) => f.id === selectedFriendId.value) || null
		)
	})

	const groupedFriends = computed(() => {
		const result: Record<string, Friend[]> = {}
		groups.value.forEach((group) => {
			result[group.id] = friends.value.filter(
				(f) => f.groupId === group.id,
			)
		})
		return result
	})

	const addGroup = (name: string): void => {
		const newGroup: Group = {
			id: Date.now().toString(),
			name,
			expanded: true,
		}
		groups.value.push(newGroup)
	}

	const deleteGroup = (groupId: string): void => {
		if (groupId === 'default') return // 不允许删除默认分组
		groups.value = groups.value.filter((g) => g.id !== groupId)
		// 将其下的好友移动到默认分组
		friends.value.forEach((f) => {
			if (f.groupId === groupId) {
				f.groupId = 'default'
			}
		})
	}

	const renameGroup = (groupId: string, newName: string): void => {
		const group = groups.value.find((g) => g.id === groupId)
		if (group) {
			group.name = newName
		}
	}

	const moveFriendToGroup = (friendId: string, groupId: string): void => {
		const friend = friends.value.find((f) => f.id === friendId)
		if (friend) {
			friend.groupId = groupId
		}
	}

	const toggleGroupExpand = (groupId: string): void => {
		const group = groups.value.find((g) => g.id === groupId)
		if (group) {
			group.expanded = !group.expanded
		}
	}

	return {
		friends,
		groups,
		selectedFriendId,
		selectedFriend,
		groupedFriends,
		addGroup,
		deleteGroup,
		renameGroup,
		moveFriendToGroup,
		toggleGroupExpand,
	}
})

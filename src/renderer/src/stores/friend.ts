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

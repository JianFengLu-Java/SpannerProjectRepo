import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '@renderer/utils/request'
import { resolveAvatarUrl } from '@renderer/utils/avatar'

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
	phone?: string
	verificationMessage?: string
	createTime?: string
	relationType?: 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null
	tags?: string[]
	cover?: string
}

export interface Group {
	id: string
	name: string
	expanded: boolean
}

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

interface FriendRelationDto {
	account: string
	realName: string
	avatarUrl: string
	region?: string | null
	email?: string | null
	phone?: string | null
	gender?: 'male' | 'female' | 'unknown' | null
	age?: number | null
	relationType: 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null
	verificationMessage?: string | null
	createTime: string
}

export interface PendingFriendRequest {
	account: string
	realName: string
	avatarUrl: string
	verificationMessage?: string | null
	createTime: string
}

export type FriendRequestStatus =
	| 'PENDING'
	| 'ACCEPTED'
	| 'REJECTED'
	| 'CANCELED'
	| 'EXPIRED'
export type FriendRequestDirection = 'INBOUND' | 'OUTBOUND'

export interface FriendRequestHistoryItem {
	requestId: string
	direction: FriendRequestDirection
	status: FriendRequestStatus
	applicantAccount: string
	applicantName: string
	applicantAvatarUrl: string
	targetAccount: string
	targetName: string
	targetAvatarUrl: string
	verificationMessage?: string | null
	operatorAccount?: string | null
	createdAt: string
	updatedAt: string
	expiredAt?: string | null
}

export interface FriendRequestHistoryPagination {
	page: number
	size: number
	total: number
	totalPages: number
	hasMore: boolean
}

export interface FriendRequestHistoryQuery {
	page?: number
	size?: number
	direction?: FriendRequestDirection
	statuses?: FriendRequestStatus[]
	keyword?: string
	startTime?: string
	endTime?: string
}

export interface FriendSearchUser {
	account: string
	realName: string
	avatarUrl: string
	isSelf?: boolean
	relationType?: 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null
	verificationMessage?: string | null
}

const normalizeGender = (
	gender?: string | null,
): 'male' | 'female' | 'unknown' => {
	if (gender === 'male' || gender === 'female') return gender
	return 'unknown'
}

const mapFriendRelationToFriend = (relation: FriendRelationDto): Friend => {
	return {
		id: relation.account,
		uid: relation.account,
		name: relation.realName || relation.account,
		remark: '',
		avatar: resolveAvatarUrl(relation.avatarUrl),
		status: 'offline',
		signature: '',
		groupId: 'default',
		gender: normalizeGender(relation.gender),
		age:
			typeof relation.age === 'number' && relation.age > 0
				? relation.age
				: undefined,
		region: relation.region || undefined,
		email: relation.email || undefined,
		phone: relation.phone || undefined,
		verificationMessage: relation.verificationMessage || undefined,
		createTime: relation.createTime || undefined,
		relationType: relation.relationType ?? null,
	}
}

const mapFriendRelationToPendingRequest = (
	relation: FriendRelationDto,
): PendingFriendRequest => ({
	account: relation.account,
	realName: relation.realName || relation.account,
	avatarUrl: resolveAvatarUrl(relation.avatarUrl),
	verificationMessage: relation.verificationMessage,
	createTime: relation.createTime,
})

const VALID_REQUEST_STATUS = new Set<FriendRequestStatus>([
	'PENDING',
	'ACCEPTED',
	'REJECTED',
	'CANCELED',
	'EXPIRED',
])

const normalizeRequestStatus = (status: unknown): FriendRequestStatus => {
	const value = typeof status === 'string' ? status.toUpperCase() : ''
	return VALID_REQUEST_STATUS.has(value as FriendRequestStatus)
		? (value as FriendRequestStatus)
		: 'PENDING'
}

const normalizeRequestDirection = (
	direction: unknown,
): FriendRequestDirection => {
	return typeof direction === 'string' &&
		direction.toUpperCase() === 'OUTBOUND'
		? 'OUTBOUND'
		: 'INBOUND'
}

const asString = (value: unknown): string => {
	return typeof value === 'string' ? value : ''
}

const mapHistoryItem = (
	item: Record<string, unknown>,
): FriendRequestHistoryItem => {
	const applicantAccount =
		asString(item.applicantAccount) || asString(item.account)
	const targetAccount =
		asString(item.targetAccount) || asString(item.friendAccount)
	const createdAt =
		asString(item.createdAt) ||
		asString(item.createTime) ||
		new Date().toISOString()
	const updatedAt =
		asString(item.updatedAt) || asString(item.updateTime) || createdAt
	const requestId =
		asString(item.requestId) ||
		`${applicantAccount}-${targetAccount}-${createdAt}`

	return {
		requestId,
		direction: normalizeRequestDirection(item.direction),
		status: normalizeRequestStatus(item.status),
		applicantAccount,
		applicantName:
			asString(item.applicantName) ||
			(item.direction === 'OUTBOUND'
				? asString(item.realName)
				: asString(item.applicantAccount)),
		applicantAvatarUrl: resolveAvatarUrl(
			asString(item.applicantAvatarUrl) || asString(item.avatarUrl),
		),
		targetAccount,
		targetName:
			asString(item.targetName) ||
			(item.direction === 'INBOUND'
				? asString(item.realName)
				: asString(item.targetAccount)),
		targetAvatarUrl: resolveAvatarUrl(asString(item.targetAvatarUrl)),
		verificationMessage: asString(item.verificationMessage) || null,
		operatorAccount: asString(item.operatorAccount) || null,
		createdAt,
		updatedAt,
		expiredAt: asString(item.expiredAt) || null,
	}
}

export const useFriendStore = defineStore('friend', () => {
	const friends = ref<Friend[]>([])
	const isLoading = ref(false)
	const pendingRequests = ref<PendingFriendRequest[]>([])
	const isPendingLoading = ref(false)
	const requestHistory = ref<FriendRequestHistoryItem[]>([])
	const isRequestHistoryLoading = ref(false)
	const requestHistoryPagination = ref<FriendRequestHistoryPagination>({
		page: 1,
		size: 20,
		total: 0,
		totalPages: 0,
		hasMore: false,
	})

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

	const fetchFriends = async (): Promise<boolean> => {
		isLoading.value = true
		try {
			const response =
				await request.get<ApiResponse<FriendRelationDto[]>>('/friends')
			const relations = Array.isArray(response.data?.data)
				? response.data.data
				: []
			friends.value = relations
				.filter((relation) => relation.relationType === 'ACCEPTED')
				.map(mapFriendRelationToFriend)

			if (
				selectedFriendId.value &&
				!friends.value.some((f) => f.id === selectedFriendId.value)
			) {
				selectedFriendId.value = null
			}
			return true
		} catch (error) {
			console.error('加载好友列表失败:', error)
			return false
		} finally {
			isLoading.value = false
		}
	}

	const applyFriendRequest = async (friendAccount: string): Promise<void> => {
		const account = friendAccount.trim()
		await request.post<ApiResponse<Record<string, never>>>(
			'/friends/apply',
			{
				friendAccount: account,
				verificationMessage: null,
			},
		)
	}

	const applyFriendRequestWithMessage = async (
		friendAccount: string,
		verificationMessage: string | null,
	): Promise<void> => {
		const account = friendAccount.trim()
		await request.post<ApiResponse<Record<string, never>>>(
			'/friends/apply',
			{
				friendAccount: account,
				verificationMessage:
					verificationMessage && verificationMessage.trim()
						? verificationMessage.trim()
						: null,
			},
		)
	}

	const deleteFriend = async (friendAccount: string): Promise<void> => {
		await request.delete<ApiResponse<Record<string, never>>>(
			`/friends/${encodeURIComponent(friendAccount)}`,
		)
		friends.value = friends.value.filter(
			(friend) => friend.id !== friendAccount,
		)
		if (selectedFriendId.value === friendAccount) {
			selectedFriendId.value = null
		}
	}

	const fetchPendingRequests = async (): Promise<boolean> => {
		isPendingLoading.value = true
		try {
			const response = await request.get<
				ApiResponse<FriendRelationDto[]>
			>('/friends/requests/pending')
			const relations = Array.isArray(response.data?.data)
				? response.data.data
				: []
			pendingRequests.value = relations.map(
				mapFriendRelationToPendingRequest,
			)
			return true
		} catch (error) {
			console.error('加载好友申请失败:', error)
			return false
		} finally {
			isPendingLoading.value = false
		}
	}

	const acceptFriendRequest = async (
		friendAccount: string,
	): Promise<void> => {
		await request.post<ApiResponse<Record<string, never>>>(
			'/friends/accept',
			{
				friendAccount: friendAccount.trim(),
			},
		)
		pendingRequests.value = pendingRequests.value.filter(
			(item) => item.account !== friendAccount,
		)
	}

	const rejectFriendRequest = async (
		friendAccount: string,
	): Promise<void> => {
		await request.post<ApiResponse<Record<string, never>>>(
			'/friends/reject',
			{
				friendAccount: friendAccount.trim(),
			},
		)
		pendingRequests.value = pendingRequests.value.filter(
			(item) => item.account !== friendAccount,
		)
	}

	const fetchRequestHistory = async (
		query: FriendRequestHistoryQuery = {},
	): Promise<boolean> => {
		isRequestHistoryLoading.value = true
		try {
			const page = Math.max(1, Number(query.page) || 1)
			const size = Math.min(100, Math.max(1, Number(query.size) || 20))
			const params: Record<string, string | number> = { page, size }
			if (query.direction) params.direction = query.direction
			if (query.statuses?.length) params.status = query.statuses.join(',')
			if (query.keyword?.trim()) params.keyword = query.keyword.trim()
			if (query.startTime) params.startTime = query.startTime
			if (query.endTime) params.endTime = query.endTime

			const response = await request.get<ApiResponse<unknown>>(
				'/friends/requests/history',
				{ params },
			)
			const data = response.data?.data

			if (Array.isArray(data)) {
				requestHistory.value = data.map((item) =>
					mapHistoryItem(item as Record<string, unknown>),
				)
				requestHistoryPagination.value = {
					page,
					size,
					total: requestHistory.value.length,
					totalPages: 1,
					hasMore: false,
				}
				return true
			}

			const records = Array.isArray(
				(data as { records?: unknown[] })?.records,
			)
				? (data as { records: unknown[] }).records
				: []
			requestHistory.value = records.map((item) =>
				mapHistoryItem(item as Record<string, unknown>),
			)
			const total = Number((data as { total?: number })?.total)
			const totalPages = Number(
				(data as { totalPages?: number })?.totalPages,
			)
			const hasMore = (data as { hasMore?: boolean })?.hasMore
			requestHistoryPagination.value = {
				page: Number((data as { page?: number })?.page) || page,
				size: Number((data as { size?: number })?.size) || size,
				total: Number.isFinite(total)
					? total
					: requestHistory.value.length,
				totalPages: Number.isFinite(totalPages) ? totalPages : 1,
				hasMore:
					typeof hasMore === 'boolean'
						? hasMore
						: page <
							(Number.isFinite(totalPages) && totalPages > 0
								? totalPages
								: 1),
			}
			return true
		} catch (error) {
			console.error('加载好友申请历史失败:', error)
			requestHistory.value = []
			requestHistoryPagination.value = {
				page: 1,
				size: 20,
				total: 0,
				totalPages: 0,
				hasMore: false,
			}
			return false
		} finally {
			isRequestHistoryLoading.value = false
		}
	}

	const searchUserByAccount = async (
		friendAccount: string,
	): Promise<FriendSearchUser | null> => {
		const account = friendAccount.trim()
		if (!account) return null

		const response = await request.get<ApiResponse<FriendSearchUser>>(
			`/friends/users/${encodeURIComponent(account)}`,
		)
		const data = response.data?.data
		if (!data || !data.account) {
			return null
		}
		return {
			account: data.account,
			realName: data.realName || data.account,
			avatarUrl: resolveAvatarUrl(data.avatarUrl),
			isSelf: Boolean(data.isSelf),
			relationType: data.relationType ?? null,
			verificationMessage: data.verificationMessage ?? null,
		}
	}

	return {
		friends,
		isLoading,
		pendingRequests,
		isPendingLoading,
		requestHistory,
		isRequestHistoryLoading,
		requestHistoryPagination,
		groups,
		selectedFriendId,
		selectedFriend,
		groupedFriends,
		addGroup,
		deleteGroup,
		renameGroup,
		moveFriendToGroup,
		toggleGroupExpand,
		fetchFriends,
		applyFriendRequest,
		applyFriendRequestWithMessage,
		deleteFriend,
		fetchPendingRequests,
		acceptFriendRequest,
		rejectFriendRequest,
		fetchRequestHistory,
		searchUserByAccount,
	}
})

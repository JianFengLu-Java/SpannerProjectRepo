import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '@renderer/utils/request'
import { resolveAvatarUrl } from '@renderer/utils/avatar'
import { tokenManager } from '@renderer/services/tokenManager'
import {
	friendRequestWs,
	type FriendRequestWsEvent,
} from '@renderer/services/friendRequestWs'

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

interface FriendLocalProfile {
	remark?: string
	groupId?: string
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
	signature?: string | null
	userInfo?: {
		signature?: string | null
		realName?: string | null
		avatarUrl?: string | null
	} | null
	online?: boolean | number | string | null
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
	signature?: string
	isSelf?: boolean
	relationType?: 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null
	verificationMessage?: string | null
	userInfo?: {
		realName?: string | null
		avatarUrl?: string | null
		signature?: string | null
	} | null
}

const normalizeGender = (
	gender?: string | null,
): 'male' | 'female' | 'unknown' => {
	if (gender === 'male' || gender === 'female') return gender
	return 'unknown'
}

const normalizeOnlineStatus = (
	online: FriendRelationDto['online'],
): 'online' | 'offline' => {
	if (typeof online === 'boolean') return online ? 'online' : 'offline'
	if (typeof online === 'number') return online > 0 ? 'online' : 'offline'
	if (typeof online === 'string') {
		const value = online.trim().toLowerCase()
		if (value === '1' || value === 'true' || value === 'online') {
			return 'online'
		}
	}
	return 'offline'
}

const mapFriendRelationToFriend = (relation: FriendRelationDto): Friend => {
	const profile = relation.userInfo || null
	const resolvedName =
		profile?.realName?.trim() || relation.realName || relation.account
	const resolvedAvatarUrl = profile?.avatarUrl || relation.avatarUrl
	const resolvedSignature = (
		profile?.signature ??
		relation.signature ??
		''
	).trim()

	return {
		id: relation.account,
		uid: relation.account,
		name: resolvedName,
		remark: '',
		avatar: resolveAvatarUrl(resolvedAvatarUrl),
		status: normalizeOnlineStatus(relation.online),
		signature: resolvedSignature,
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

export const useFriendStore = defineStore(
	'friend',
	() => {
		const friends = ref<Friend[]>([])
		const friendLocalProfiles = ref<Record<string, FriendLocalProfile>>({})
		const isLoading = ref(false)
		const pendingRequests = ref<PendingFriendRequest[]>([])
		const isPendingLoading = ref(false)
		let pendingRequestsAutoRefreshing = false
		let pendingRequestsWsActive = false
		let wsBoundToken = ''
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

		const hasGroup = (groupId: string): boolean =>
			groups.value.some((group) => group.id === groupId)

		const normalizeGroupId = (groupId?: string): string =>
			groupId && hasGroup(groupId) ? groupId : 'default'

		const setFriendLocalProfile = (
			friendId: string,
			patch: FriendLocalProfile,
		): void => {
			const current = friendLocalProfiles.value[friendId] || {}
			friendLocalProfiles.value = {
				...friendLocalProfiles.value,
				[friendId]: {
					...current,
					...patch,
				},
			}
		}

		const selectedFriend = computed(() => {
			return (
				friends.value.find((f) => f.id === selectedFriendId.value) ||
				null
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

		const addGroup = (name: string): boolean => {
			const normalizedName = name.trim()
			if (!normalizedName) return false
			if (
				groups.value.some(
					(group) =>
						group.name.trim().toLowerCase() ===
						normalizedName.toLowerCase(),
				)
			) {
				return false
			}
			const newGroup: Group = {
				id: Date.now().toString(),
				name: normalizedName,
				expanded: true,
			}
			groups.value.push(newGroup)
			return true
		}

		const deleteGroup = (groupId: string): void => {
			if (groupId === 'default') return // 不允许删除默认分组
			groups.value = groups.value.filter((g) => g.id !== groupId)
			// 将其下的好友移动到默认分组
			friends.value.forEach((f) => {
				if (f.groupId === groupId) {
					f.groupId = 'default'
					setFriendLocalProfile(f.id, { groupId: 'default' })
				}
			})
		}

		const renameGroup = (groupId: string, newName: string): boolean => {
			const group = groups.value.find((g) => g.id === groupId)
			if (!group) return false
			const normalizedName = newName.trim()
			if (!normalizedName) return false
			if (
				groups.value.some(
					(g) =>
						g.id !== groupId &&
						g.name.trim().toLowerCase() ===
							normalizedName.toLowerCase(),
				)
			) {
				return false
			}
			group.name = normalizedName
			return true
		}

		const moveFriendToGroup = (
			friendId: string,
			groupId: string,
		): boolean => {
			const friend = friends.value.find((f) => f.id === friendId)
			if (!friend || !hasGroup(groupId)) return false
			friend.groupId = groupId
			setFriendLocalProfile(friend.id, { groupId })
			return true
		}

		const updateFriendRemark = (
			friendId: string,
			remark: string,
		): boolean => {
			const friend = friends.value.find((f) => f.id === friendId)
			if (!friend) return false
			const normalizedRemark = remark.trim()
			friend.remark = normalizedRemark
			setFriendLocalProfile(friend.id, { remark: normalizedRemark })
			return true
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
					await request.get<ApiResponse<FriendRelationDto[]>>(
						'/friends',
					)
				const relations = Array.isArray(response.data?.data)
					? response.data.data
					: []
				const previousFriendMap = new Map(
					friends.value.map((friend) => [friend.id, friend]),
				)
				friends.value = relations
					.filter((relation) => relation.relationType === 'ACCEPTED')
					.map((relation) => {
						const mapped = mapFriendRelationToFriend(relation)
						const previous = previousFriendMap.get(mapped.id)
						const local = friendLocalProfiles.value[mapped.id]
						mapped.remark =
							local?.remark ?? previous?.remark ?? mapped.remark
						mapped.groupId = normalizeGroupId(
							local?.groupId ??
								previous?.groupId ??
								mapped.groupId,
						)
						return mapped
					})

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

		const applyFriendRequest = async (
			friendAccount: string,
		): Promise<void> => {
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

		const refreshPendingRequestsSafely = async (): Promise<void> => {
			if (pendingRequestsAutoRefreshing) return
			pendingRequestsAutoRefreshing = true
			try {
				await fetchPendingRequests()
			} finally {
				pendingRequestsAutoRefreshing = false
			}
		}

		const getCurrentToken = (): string => {
			return (
				tokenManager.getAccessToken().trim() ||
				window.localStorage.getItem('token')?.trim() ||
				''
			)
		}

		const handleFriendRequestEvent = (payload: FriendRequestWsEvent): void => {
			void refreshPendingRequestsSafely()
			if (payload.eventType === 'FRIEND_REQUEST_ACCEPTED') {
				void fetchFriends()
			}
		}

		const bindPendingRequestsWs = (): void => {
			const token = getCurrentToken()
			const normalizedToken = token.trim().replace(/^Bearer\s+/i, '')
			if (!normalizedToken) return
			if (pendingRequestsWsActive && wsBoundToken === normalizedToken) return

			friendRequestWs.connect(token, {
				onConnected: () => {
					pendingRequestsWsActive = true
					wsBoundToken = normalizedToken
					// 服务端文档要求：重连后做一次 pending 兜底同步
					void refreshPendingRequestsSafely()
				},
				onEvent: handleFriendRequestEvent,
				onDisconnected: () => {
					pendingRequestsWsActive = false
				},
				onError: (error) => {
					console.warn('好友请求 websocket 异常:', error)
				},
			})
		}

		const startPendingRequestsAutoRefresh = (): void => {
			bindPendingRequestsWs()
			void refreshPendingRequestsSafely()
		}

		const stopPendingRequestsAutoRefresh = (): void => {
			friendRequestWs.disconnect()
			pendingRequestsWsActive = false
			wsBoundToken = ''
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
				const size = Math.min(
					100,
					Math.max(1, Number(query.size) || 20),
				)
				const params: Record<string, string | number> = { page, size }
				if (query.direction) params.direction = query.direction
				if (query.statuses?.length)
					params.status = query.statuses.join(',')
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
			const profile = data.userInfo || null
			return {
				account: data.account,
				realName:
					profile?.realName?.trim() || data.realName || data.account,
				avatarUrl: resolveAvatarUrl(
					profile?.avatarUrl || data.avatarUrl,
				),
				signature: (
					profile?.signature ??
					data.signature ??
					''
				).trim(),
				isSelf: Boolean(data.isSelf),
				relationType: data.relationType ?? null,
				verificationMessage: data.verificationMessage ?? null,
			}
		}

		tokenManager.onTokenUpdated(() => {
			pendingRequestsWsActive = false
			wsBoundToken = ''
			bindPendingRequestsWs()
			void refreshPendingRequestsSafely()
		})

		tokenManager.onTokenCleared(() => {
			stopPendingRequestsAutoRefresh()
			pendingRequests.value = []
		})

		return {
			friends,
			friendLocalProfiles,
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
			updateFriendRemark,
			toggleGroupExpand,
			fetchFriends,
			applyFriendRequest,
			applyFriendRequestWithMessage,
			deleteFriend,
			fetchPendingRequests,
			startPendingRequestsAutoRefresh,
			stopPendingRequestsAutoRefresh,
			acceptFriendRequest,
			rejectFriendRequest,
			fetchRequestHistory,
			searchUserByAccount,
		}
	},
	{
		persist: {
			pick: ['groups', 'friendLocalProfiles'],
		},
	},
)

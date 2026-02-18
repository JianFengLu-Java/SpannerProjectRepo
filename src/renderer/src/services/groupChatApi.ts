import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface GroupDetail {
	groupNo: string
	groupName: string
	ownerAccount: string
	announcement?: string
	maxMembers: number
	memberCount: number
	myRole: GroupRole
	createdAt?: string
	updatedAt?: string
}

export interface GroupMember {
	account: string
	name?: string
	avatarUrl?: string
	role: GroupRole
	joinedAt?: string
}

interface GroupMembersData {
	members?: GroupMember[]
	count?: number
}

export interface GroupHistoryMessageDto {
	messageId?: string | number
	groupNo: string
	from: string
	content: string
	clientMessageId?: string | number
	sentAt?: string
}

export interface GroupHistoryPageData {
	messages?: GroupHistoryMessageDto[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

export const groupChatApi = {
	createGroup(payload: { groupName: string; announcement?: string }) {
		return request.post<ApiResponse<GroupDetail>>('/groups', {
			groupName: payload.groupName.trim(),
			announcement: payload.announcement?.trim() || '',
		})
	},

	getGroup(groupNo: string) {
		return request.get<ApiResponse<GroupDetail>>(`/groups/${groupNo}`)
	},

	getGroupMembers(groupNo: string) {
		return request.get<ApiResponse<GroupMembersData>>(
			`/groups/${groupNo}/members`,
		)
	},

	joinGroup(groupNo: string) {
		return request.post<ApiResponse<GroupDetail>>(`/groups/${groupNo}/join`)
	},

	inviteFriend(groupNo: string, friendAccount: string) {
		return request.post<ApiResponse<null>>(`/groups/${groupNo}/invite`, {
			friendAccount: friendAccount.trim(),
		})
	},

	quitGroup(groupNo: string) {
		return request.post<ApiResponse<null>>(`/groups/${groupNo}/quit`)
	},

	updateAnnouncement(groupNo: string, announcement: string) {
		return request.put<ApiResponse<GroupDetail>>(
			`/groups/${groupNo}/announcement`,
			{
				announcement: announcement.trim(),
			},
		)
	},

	setAdmin(groupNo: string, account: string) {
		return request.put<ApiResponse<null>>(`/groups/${groupNo}/admins`, {
			account: account.trim(),
		})
	},

	removeAdmin(groupNo: string, account: string) {
		return request.delete<ApiResponse<null>>(
			`/groups/${groupNo}/admins/${account.trim()}`,
		)
	},

	kickMember(groupNo: string, account: string) {
		return request.delete<ApiResponse<null>>(
			`/groups/${groupNo}/members/${account.trim()}`,
		)
	},

	getGroupMessageHistory(groupNo: string, page = 1, size = 20) {
		const safePage = Math.max(1, Number(page) || 1)
		const safeSize = Math.max(1, Math.min(100, Number(size) || 20))
		return request.get<ApiResponse<GroupHistoryPageData>>(
			`/groups/${groupNo}/messages/history`,
			{
				params: {
					page: safePage,
					size: safeSize,
				},
			},
		)
	},
}

import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type InviteMode = 'ALL' | 'ADMIN_ONLY'
export type AnnouncementPermission = 'OWNER_ONLY' | 'OWNER_ADMIN'

export interface GroupDetail {
	groupNo: string
	groupName: string
	groupAvatarUrl?: string
	avatarUrl?: string
	avatar?: string
	ownerAccount: string
	announcement?: string
	maxMembers: number
	memberCount: number
	myRole: GroupRole
	createdAt?: string
	updatedAt?: string
}

export interface GroupProfile {
	groupNo: string
	groupName: string
	groupAvatarUrl?: string
	summary?: string
	ownerAccount: string
	myRole: GroupRole
	memberCount: number
	maxMembers: number
	inviteMode: InviteMode
	memberCanEditGroupName: boolean
	joinVerificationEnabled: boolean
	announcementPermission: AnnouncementPermission
	createdAt?: string
	updatedAt?: string
}

export interface GroupProfilePatchPayload {
	groupName?: string
	groupAvatarUrl?: string
	summary?: string
}

export interface GroupAnnouncement {
	announcementId: string
	groupNo: string
	content: string
	publisherAccount?: string
	publisherName?: string
	createdAt?: string
	updatedAt?: string
}

export interface GroupUserSettings {
	groupNo: string
	messageMute: boolean
	chatPinned: boolean
	saveToContacts: boolean
	updatedAt?: string
}

export interface GroupMediaOverview {
	groupNo: string
	fileCount: number
	imageVideoCount: number
	linkCount: number
}

export interface GroupSettingsDetailData {
	groupProfile?: GroupProfile
	mySettings?: GroupUserSettings
	latestAnnouncement?: GroupAnnouncement | null
	mediaOverview?: GroupMediaOverview | null
}

export interface GroupMember {
	account: string
	name?: string
	avatarUrl?: string
	role: GroupRole
	joinedAt?: string
	status?: string
	muted?: boolean
	blacklisted?: boolean
}

export interface GroupMembersLegacyData {
	members?: GroupMember[]
	count?: number
}

export interface GroupMembersPageData {
	records?: GroupMember[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

export interface GroupHistoryMessageDto {
	messageId?: string | number
	groupNo: string
	from: string
	content: string
	quote?: {
		messageId: string
		from?: string
		content?: string
	}
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

export interface JoinedGroupItem {
	groupNo?: string
	groupName?: string
	groupAvatarUrl?: string
	avatarUrl?: string
	avatar?: string
	memberCount?: number
	maxMembers?: number
	myRole?: GroupRole
	ownerAccount?: string
	summary?: string
	announcement?: string
	inviteMode?: InviteMode
	memberCanEditGroupName?: boolean
	joinVerificationEnabled?: boolean
	announcementPermission?: AnnouncementPermission
	createdAt?: string
	updatedAt?: string
}

export interface JoinedGroupPageData {
	records?: JoinedGroupItem[]
	list?: JoinedGroupItem[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

export interface GroupQuitResult {
	groupNo: string
	quit: boolean
	shouldRemoveLocalSession?: boolean
}

export interface GroupReportResult {
	reportNo: string
}

export interface GroupInviteBatchResult {
	successAccounts?: string[]
	failed?: Array<{
		account: string
		reasonCode?: string
		reason?: string
	}>
}

export interface GroupAnnouncementsPageData {
	records?: GroupAnnouncement[]
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

	getJoinedGroups(params?: {
		page?: number
		size?: number
		keyword?: string
	}) {
		const safePage = Math.max(1, Number(params?.page) || 1)
		const safeSize = Math.max(1, Math.min(100, Number(params?.size) || 20))
		const keyword = params?.keyword?.trim() || undefined
		return request.get<ApiResponse<JoinedGroupPageData>>('/groups/my', {
			params: {
				page: safePage,
				size: safeSize,
				keyword,
			},
		})
	},

	getGroupProfile(groupNo: string) {
		return request.get<ApiResponse<GroupProfile>>(
			`/groups/${groupNo}/profile`,
		)
	},

	updateGroupProfile(groupNo: string, payload: GroupProfilePatchPayload) {
		const patchPayload: GroupProfilePatchPayload = {}
		if (typeof payload.groupName === 'string') {
			patchPayload.groupName = payload.groupName.trim()
		}
		if (typeof payload.groupAvatarUrl === 'string') {
			patchPayload.groupAvatarUrl = payload.groupAvatarUrl.trim()
		}
		if (typeof payload.summary === 'string') {
			patchPayload.summary = payload.summary.trim()
		}
		return request.put<ApiResponse<GroupProfile>>(
			`/groups/${groupNo}/profile`,
			patchPayload,
		)
	},

	getGroupSettingsDetail(groupNo: string) {
		return request.get<ApiResponse<GroupSettingsDetailData>>(
			`/groups/${groupNo}/settings/detail`,
		)
	},

	getGroupMembers(
		groupNo: string,
		params?: {
			page?: number
			size?: number
			keyword?: string
			role?: GroupRole
		},
	) {
		return request.get<ApiResponse<GroupMembersLegacyData | GroupMembersPageData>>(
			`/groups/${groupNo}/members`,
			{ params },
		)
	},

	getGroupMembersPreview(groupNo: string, size = 9) {
		const safeSize = Math.max(1, Math.min(18, Number(size) || 9))
		return request.get<ApiResponse<GroupMember[]>>(
			`/groups/${groupNo}/members/preview`,
			{
				params: { size: safeSize },
			},
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

	batchInviteMembers(groupNo: string, accounts: string[]) {
		const validAccounts = accounts.map((item) => item.trim()).filter(Boolean)
		return request.post<ApiResponse<GroupInviteBatchResult>>(
			`/groups/${groupNo}/members/batch-invite`,
			{
				accounts: validAccounts,
				source: 'GROUP_SETTINGS',
			},
		)
	},

	removeMember(groupNo: string, account: string) {
		return request.post<ApiResponse<null>>(
			`/groups/${groupNo}/members/${account.trim()}/remove`,
		)
	},

	updateMemberRole(groupNo: string, account: string, role: GroupRole) {
		return request.put<ApiResponse<null>>(
			`/groups/${groupNo}/members/${account.trim()}/role`,
			{ role },
		)
	},

	quitGroup(groupNo: string) {
		return request.post<ApiResponse<GroupQuitResult>>(`/groups/${groupNo}/quit`)
	},

	disbandGroup(groupNo: string) {
		return request.delete<ApiResponse<null>>(`/groups/${groupNo}`)
	},

	updateMySettings(
		groupNo: string,
		payload: Partial<Pick<GroupUserSettings, 'messageMute' | 'chatPinned' | 'saveToContacts'>>,
	) {
		return request.put<ApiResponse<GroupUserSettings>>(
			`/groups/${groupNo}/settings/my`,
			payload,
		)
	},

	updatePermissions(
		groupNo: string,
		payload: Partial<
			Pick<
				GroupProfile,
				| 'inviteMode'
				| 'memberCanEditGroupName'
				| 'joinVerificationEnabled'
				| 'announcementPermission'
			>
		>,
	) {
		return request.put<ApiResponse<GroupProfile>>(
			`/groups/${groupNo}/settings/permissions`,
			payload,
		)
	},

	getLatestAnnouncement(groupNo: string) {
		return request.get<ApiResponse<GroupAnnouncement | null>>(
			`/groups/${groupNo}/announcements/latest`,
		)
	},

	createAnnouncement(groupNo: string, content: string) {
		return request.post<ApiResponse<GroupAnnouncement>>(
			`/groups/${groupNo}/announcements`,
			{ content: content.trim() },
		)
	},

	updateAnnouncementById(
		groupNo: string,
		announcementId: string,
		content: string,
	) {
		return request.put<ApiResponse<GroupAnnouncement>>(
			`/groups/${groupNo}/announcements/${announcementId.trim()}`,
			{ content: content.trim() },
		)
	},

	getAnnouncements(groupNo: string, page = 1, size = 20) {
		const safePage = Math.max(1, Number(page) || 1)
		const safeSize = Math.max(1, Math.min(100, Number(size) || 20))
		return request.get<ApiResponse<GroupAnnouncementsPageData>>(
			`/groups/${groupNo}/announcements`,
			{
				params: {
					page: safePage,
					size: safeSize,
				},
			},
		)
	},

	getMediaOverview(groupNo: string) {
		return request.get<ApiResponse<GroupMediaOverview>>(
			`/groups/${groupNo}/media/overview`,
		)
	},

	clearMessages(groupNo: string, scope: 'SELF' = 'SELF') {
		return request.post<ApiResponse<null>>(`/groups/${groupNo}/messages/clear`, {
			scope,
		})
	},

	reportGroup(
		groupNo: string,
		payload: {
			reasonType: string
			description?: string
			evidenceUrls?: string[]
		},
	) {
		return request.post<ApiResponse<GroupReportResult>>(
			`/groups/${groupNo}/reports`,
			{
				reasonType: payload.reasonType,
				description: payload.description?.trim() || '',
				evidenceUrls: Array.isArray(payload.evidenceUrls)
					? payload.evidenceUrls
					: [],
			},
		)
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

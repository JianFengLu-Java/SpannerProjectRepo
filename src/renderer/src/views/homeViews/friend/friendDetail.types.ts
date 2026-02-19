export type RelationshipStatus =
	| 'friend'
	| 'not_friend'
	| 'blocked_by_me'
	| 'blocked_me'

export type PrivacyLevel = 'public' | 'friends_only' | 'private'

export interface FriendPostPreview {
	id: string
	title: string
	excerpt: string
}

export interface FriendMedia {
	photos: string[]
	postsPreview: FriendPostPreview[]
}

export interface FriendBadge {
	isVip?: boolean
	vipLevel?: number
	verified?: boolean
	userLevel?: number
}

export interface FriendStats {
	posts?: number
	likes?: number
	growth?: number
	followers?: number
}

export interface FriendModel {
	id: string
	nickname: string
	avatar: string
	bio?: string
	region?: string
	gender?: string
	birthday?: string
	occupation?: string
	onlineStatus?: 'online' | 'offline'
	lastActiveAt?: string
	badges: FriendBadge
	stats: FriendStats
	relationshipStatus: RelationshipStatus
	privacyLevel: PrivacyLevel
	remarkName?: string
	tags: string[]
	mutual: {
		friendsCount: number
		groupsCount: number
	}
	source?: string
	media: FriendMedia
}

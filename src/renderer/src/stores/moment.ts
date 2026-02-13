import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import request from '@renderer/utils/request'
import { resolveAvatarUrl } from '@renderer/utils/avatar'

type MomentTab = 'recommend' | 'friends' | 'nearby' | 'trending'
type FriendStatusWithAuthor =
	| 'NONE'
	| 'PENDING_OUTBOUND'
	| 'PENDING_INBOUND'
	| 'FRIEND'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

interface CursorPage<T> {
	records: T[]
	nextCursor?: string | null
	hasMore?: boolean
}

interface MomentAuthor {
	account?: string
	name: string
	avatar: string
}

export interface Comment {
	id: string
	momentId?: string
	parentCommentId?: string | null
	replyToAccount?: string | null
	author: MomentAuthor
	text: string
	timestamp: string
	likes: number
	isLiked?: boolean
	replyCount?: number
}

export interface MomentLikeUser {
	account: string
	name: string
	avatar: string
	likedAt?: string
}

export interface Moment {
	id: string
	title: string
	cover: string
	author: MomentAuthor
	likes: number
	isLiked: boolean
	likePreviewUsers?: MomentLikeUser[]
	commentsCount?: number
	isFavorited?: boolean
	friendStatusWithAuthor?: FriendStatusWithAuthor
	timestamp: string
	createdAt?: string
	updatedAt?: string
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

interface UpdateMomentPayload {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}

interface LikeActionResponse {
	liked: boolean
	likes: number
}

interface FetchCommentsOptions {
	size?: number
	cursor?: string
	parentCommentId?: string
	sort?: 'latest' | 'hot'
}

const asString = (value: unknown): string => {
	return typeof value === 'string' ? value : ''
}

const asNumber = (value: unknown, fallback = 0): number => {
	return typeof value === 'number' && Number.isFinite(value)
		? value
		: fallback
}

const normalizeAuthor = (author: unknown): MomentAuthor => {
	const source = (author || {}) as Record<string, unknown>
	return {
		account: asString(source.account) || undefined,
		name: asString(source.name) || asString(source.account) || '用户',
		avatar: resolveAvatarUrl(
			asString(source.avatar) || asString(source.avatarUrl),
		),
	}
}

const normalizeComment = (item: unknown): Comment => {
	const source = (item || {}) as Record<string, unknown>
	return {
		id: asString(source.id),
		momentId: asString(source.momentId) || undefined,
		parentCommentId: asString(source.parentCommentId) || null,
		replyToAccount: asString(source.replyToAccount) || null,
		author: normalizeAuthor(source.author),
		text: asString(source.text),
		timestamp:
			asString(source.timestamp) ||
			asString(source.createdAt) ||
			new Date().toISOString(),
		likes: asNumber(source.likes),
		isLiked:
			typeof source.isLiked === 'boolean' ? source.isLiked : undefined,
		replyCount:
			typeof source.replyCount === 'number'
				? source.replyCount
				: undefined,
	}
}

const normalizeLikeUser = (item: unknown): MomentLikeUser => {
	const source = (item || {}) as Record<string, unknown>
	return {
		account: asString(source.account),
		name: asString(source.name) || asString(source.account),
		avatar: resolveAvatarUrl(
			asString(source.avatar) || asString(source.avatarUrl),
		),
		likedAt: asString(source.likedAt) || undefined,
	}
}

const normalizeMoment = (item: unknown): Moment => {
	const source = (item || {}) as Record<string, unknown>
	const images = Array.isArray(source.images)
		? source.images
				.map((img) => asString(img))
				.filter((img) => img.length > 0)
		: []
	const cover = asString(source.cover) || images[0] || ''
	const comments = Array.isArray(source.comments)
		? source.comments.map((comment) => normalizeComment(comment))
		: []
	return {
		id: asString(source.id),
		title: asString(source.title),
		cover,
		author: normalizeAuthor(source.author),
		likes: asNumber(source.likes),
		isLiked: Boolean(source.isLiked),
		likePreviewUsers: Array.isArray(source.likePreviewUsers)
			? source.likePreviewUsers.map((user) => normalizeLikeUser(user))
			: undefined,
		commentsCount:
			typeof source.commentsCount === 'number'
				? source.commentsCount
				: comments.length,
		isFavorited:
			typeof source.isFavorited === 'boolean'
				? source.isFavorited
				: undefined,
		friendStatusWithAuthor: (asString(source.friendStatusWithAuthor) ||
			undefined) as FriendStatusWithAuthor | undefined,
		timestamp:
			asString(source.timestamp) ||
			asString(source.createdAt) ||
			new Date().toISOString(),
		createdAt: asString(source.createdAt) || undefined,
		updatedAt: asString(source.updatedAt) || undefined,
		content: asString(source.content) || undefined,
		contentHtml: asString(source.contentHtml) || undefined,
		images,
		comments,
	}
}

export const useMomentStore = defineStore('moment', () => {
	const moments = ref<Moment[]>([])
	const selectedMomentId = ref<string | null>(null)
	const activeTab = ref<MomentTab>('recommend')
	const searchQuery = ref('')
	const isLoading = ref(false)
	const isDetailLoading = ref(false)
	const listCursor = ref<string | null>(null)
	const hasMore = ref(true)
	let listFetchSeq = 0

	const selectedMoment = computed(() => {
		return (
			moments.value.find(
				(moment) => moment.id === selectedMomentId.value,
			) || null
		)
	})

	const upsertMoment = (nextMoment: Moment): Moment => {
		const index = moments.value.findIndex(
			(moment) => moment.id === nextMoment.id,
		)
		if (index === -1) {
			moments.value.push(nextMoment)
			return nextMoment
		}
		const current = moments.value[index]
		const merged: Moment = {
			...current,
			...nextMoment,
			comments:
				nextMoment.comments.length > 0
					? nextMoment.comments
					: current.comments,
			commentsCount: nextMoment.commentsCount ?? current.commentsCount,
		}
		moments.value[index] = merged
		return merged
	}

	const fetchMoments = async ({
		reset = true,
		size = 20,
	}: {
		reset?: boolean
		size?: number
	} = {}): Promise<void> => {
		if (isLoading.value && !reset) return
		if (!reset && !hasMore.value) return
		const requestSeq = ++listFetchSeq
		isLoading.value = true
		try {
			if (reset) {
				listCursor.value = null
				hasMore.value = true
			}
			const keyword = searchQuery.value.trim()
			const response = await request.get<
				ApiResponse<CursorPage<Record<string, unknown>>>
			>('/moments', {
				params: {
					tab: activeTab.value,
					keyword: keyword || undefined,
					cursor: reset ? undefined : listCursor.value || undefined,
					size,
				},
			})
			if (requestSeq !== listFetchSeq) return
			const page = response.data.data || { records: [], hasMore: false }
			const mapped = (page.records || []).map((item) =>
				normalizeMoment(item),
			)
			if (reset) {
				moments.value = mapped
			} else {
				for (const item of mapped) upsertMoment(item)
			}
			listCursor.value = page.nextCursor || null
			hasMore.value = Boolean(page.hasMore)
		} finally {
			if (requestSeq === listFetchSeq) {
				isLoading.value = false
			}
		}
	}

	const fetchMomentDetail = async (momentId: string): Promise<Moment> => {
		isDetailLoading.value = true
		try {
			const response = await request.get<
				ApiResponse<Record<string, unknown>>
			>(`/moments/${momentId}`)
			const mapped = normalizeMoment(response.data.data)
			return upsertMoment(mapped)
		} finally {
			isDetailLoading.value = false
		}
	}

	const fetchComments = async (
		momentId: string,
		options: FetchCommentsOptions = {},
	): Promise<Comment[]> => {
		const response = await request.get<
			ApiResponse<CursorPage<Record<string, unknown>>>
		>(`/moments/${momentId}/comments`, {
			params: {
				cursor: options.cursor,
				size: options.size ?? 20,
				parentCommentId: options.parentCommentId,
				sort: options.sort || 'latest',
			},
		})
		const comments = (response.data.data.records || []).map((item) =>
			normalizeComment(item),
		)
		const moment = moments.value.find((item) => item.id === momentId)
		if (moment) {
			moment.comments = comments
			moment.commentsCount =
				typeof moment.commentsCount === 'number'
					? Math.max(moment.commentsCount, comments.length)
					: comments.length
		}
		return comments
	}

	const openMoment = async (momentId: string): Promise<void> => {
		selectedMomentId.value = momentId
		await Promise.all([
			fetchMomentDetail(momentId),
			fetchComments(momentId),
		])
	}

	const toggleLike = async (momentId: string): Promise<void> => {
		const moment = moments.value.find((item) => item.id === momentId)
		if (!moment) return

		const previousLiked = moment.isLiked
		const previousLikes = moment.likes

		moment.isLiked = !previousLiked
		moment.likes = Math.max(0, previousLikes + (moment.isLiked ? 1 : -1))

		try {
			const endpoint = `/moments/${momentId}/likes`
			const response = moment.isLiked
				? await request.post<ApiResponse<LikeActionResponse>>(endpoint)
				: await request.delete<ApiResponse<LikeActionResponse>>(
						endpoint,
					)
			const data = response.data.data
			moment.isLiked = data.liked
			moment.likes = data.likes
		} catch (error) {
			moment.isLiked = previousLiked
			moment.likes = previousLikes
			throw error
		}
	}

	const addComment = async (
		momentId: string,
		text: string,
		parentCommentId: string | null = null,
		replyToAccount: string | null = null,
	): Promise<Comment> => {
		const content = text.trim()
		if (!content) {
			throw new Error('comment-empty')
		}
		const response = await request.post<
			ApiResponse<Record<string, unknown>>
		>(`/moments/${momentId}/comments`, {
			text: content,
			parentCommentId,
			replyToAccount,
		})
		const comment = normalizeComment(response.data.data)
		const moment = moments.value.find((item) => item.id === momentId)
		if (moment) {
			moment.comments.unshift(comment)
			moment.commentsCount = (moment.commentsCount || 0) + 1
		}
		return comment
	}

	const addMoment = async (payload: AddMomentPayload): Promise<Moment> => {
		const response = await request.post<
			ApiResponse<Record<string, unknown>>
		>('/moments', payload)
		const created = normalizeMoment(response.data.data)
		moments.value.unshift(created)
		return created
	}

	const updateMoment = async (
		momentId: string,
		payload: UpdateMomentPayload,
	): Promise<Moment> => {
		const response = await request.put<
			ApiResponse<Record<string, unknown>>
		>(`/moments/${momentId}`, payload)
		const updated = normalizeMoment(response.data.data)
		return upsertMoment(updated)
	}

	const deleteMoment = async (momentId: string): Promise<void> => {
		await request.delete<ApiResponse<Record<string, unknown>>>(
			`/moments/${momentId}`,
		)
		const index = moments.value.findIndex((item) => item.id === momentId)
		if (index >= 0) {
			moments.value.splice(index, 1)
		}
		if (selectedMomentId.value === momentId) {
			selectedMomentId.value = null
		}
	}

	const fetchMomentLikes = async ({
		momentId,
		cursor,
		size = 20,
	}: {
		momentId: string
		cursor?: string
		size?: number
	}): Promise<CursorPage<MomentLikeUser>> => {
		const response = await request.get<
			ApiResponse<CursorPage<Record<string, unknown>>>
		>(`/moments/${momentId}/likes`, {
			params: { cursor, size },
		})
		return {
			records: (response.data.data.records || []).map((item) =>
				normalizeLikeUser(item),
			),
			nextCursor: response.data.data.nextCursor || null,
			hasMore: Boolean(response.data.data.hasMore),
		}
	}

	return {
		moments,
		selectedMomentId,
		selectedMoment,
		activeTab,
		searchQuery,
		isLoading,
		isDetailLoading,
		hasMore,
		fetchMoments,
		fetchMomentDetail,
		fetchComments,
		openMoment,
		toggleLike,
		addComment,
		addMoment,
		updateMoment,
		deleteMoment,
		fetchMomentLikes,
	}
})

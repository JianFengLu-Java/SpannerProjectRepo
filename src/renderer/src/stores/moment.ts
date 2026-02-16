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

interface MomentListCacheEntry {
	items: Moment[]
	cursor: string | null
	hasMore: boolean
	updatedAt: number
}

interface MomentCachePayload {
	activeTab: MomentTab
	searchQuery: string
	lists: Record<string, MomentListCacheEntry>
}

interface MomentCommentCacheEntry {
	comments: Comment[]
	updatedAt: number
}

const MOMENT_LIST_CACHE_KEY = 'moment-list-cache:v1'
const MOMENT_COMMENT_CACHE_KEY = 'moment-comment-cache:v1'
const MAX_CACHE_LIST_COUNT = 12
const MAX_CACHE_ITEMS_PER_LIST = 80
const MAX_COMMENT_CACHE_MOMENTS = 120
const MAX_COMMENTS_PER_MOMENT = 40

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
	const listCacheMap = ref<Record<string, MomentListCacheEntry>>({})
	const commentCacheMap = ref<Record<string, MomentCommentCacheEntry>>({})
	let listFetchSeq = 0

	const selectedMoment = computed(() => {
		return (
			moments.value.find(
				(moment) => moment.id === selectedMomentId.value,
			) || null
		)
	})

	const getListCacheKey = (
		tab: MomentTab = activeTab.value,
		query = searchQuery.value,
	): string => `${tab}::${query.trim().toLowerCase()}`

	const patchMoment = (current: Moment, next: Moment): void => {
		if (current.title !== next.title) current.title = next.title
		if (current.cover !== next.cover) current.cover = next.cover
		if (current.likes !== next.likes) current.likes = next.likes
		if (current.isLiked !== next.isLiked) current.isLiked = next.isLiked
		if (current.timestamp !== next.timestamp) current.timestamp = next.timestamp
		if (current.createdAt !== next.createdAt) current.createdAt = next.createdAt
		if (current.updatedAt !== next.updatedAt) current.updatedAt = next.updatedAt
		if (current.content !== next.content) current.content = next.content
		if (current.contentHtml !== next.contentHtml) {
			current.contentHtml = next.contentHtml
		}
		if (current.commentsCount !== next.commentsCount) {
			current.commentsCount = next.commentsCount
		}
		if (current.isFavorited !== next.isFavorited) {
			current.isFavorited = next.isFavorited
		}
		if (current.friendStatusWithAuthor !== next.friendStatusWithAuthor) {
			current.friendStatusWithAuthor = next.friendStatusWithAuthor
		}
		if (
			current.author.name !== next.author.name ||
			current.author.avatar !== next.author.avatar ||
			current.author.account !== next.author.account
		) {
			current.author = next.author
		}
		current.likePreviewUsers = next.likePreviewUsers
		current.images = next.images
		if (next.comments.length > 0) current.comments = next.comments
	}

	const patchComment = (current: Comment, next: Comment): void => {
		if (current.text !== next.text) current.text = next.text
		if (current.timestamp !== next.timestamp) current.timestamp = next.timestamp
		if (current.likes !== next.likes) current.likes = next.likes
		if (current.isLiked !== next.isLiked) current.isLiked = next.isLiked
		if (current.replyCount !== next.replyCount) current.replyCount = next.replyCount
		if (current.parentCommentId !== next.parentCommentId) {
			current.parentCommentId = next.parentCommentId
		}
		if (current.replyToAccount !== next.replyToAccount) {
			current.replyToAccount = next.replyToAccount
		}
		if (
			current.author.name !== next.author.name ||
			current.author.avatar !== next.author.avatar ||
			current.author.account !== next.author.account
		) {
			current.author = next.author
		}
	}

	const mergeCommentsWithDiff = (
		existing: Comment[],
		incoming: Comment[],
	): Comment[] => {
		if (!incoming.length) return existing
		const existingMap = new Map(existing.map((item) => [item.id, item]))
		return incoming.map((item) => {
			const hit = existingMap.get(item.id)
			if (!hit) return item
			patchComment(hit, item)
			return hit
		})
	}

	const upsertMoment = (nextMoment: Moment): Moment => {
		const index = moments.value.findIndex(
			(moment) => moment.id === nextMoment.id,
		)
		if (index === -1) {
			moments.value.push(nextMoment)
			return nextMoment
		}
		const current = moments.value[index]
		patchMoment(current, nextMoment)
		return current
	}

	const replaceMomentsWithDiff = (nextList: Moment[]): void => {
		const existingMap = new Map(moments.value.map((item) => [item.id, item]))
		const merged: Moment[] = []
		for (const next of nextList) {
			const existed = existingMap.get(next.id)
			if (!existed) {
				merged.push(next)
				continue
			}
			patchMoment(existed, next)
			merged.push(existed)
		}
		moments.value = merged
	}

	const trimAndPersistCache = (): void => {
		const entries = Object.entries(listCacheMap.value).sort(
			(a, b) => b[1].updatedAt - a[1].updatedAt,
		)
		listCacheMap.value = Object.fromEntries(
			entries.slice(0, MAX_CACHE_LIST_COUNT),
		)
		const payload: MomentCachePayload = {
			activeTab: activeTab.value,
			searchQuery: searchQuery.value,
			lists: listCacheMap.value,
		}
		window.localStorage.setItem(MOMENT_LIST_CACHE_KEY, JSON.stringify(payload))
	}

	const trimAndPersistCommentCache = (): void => {
		const entries = Object.entries(commentCacheMap.value).sort(
			(a, b) => b[1].updatedAt - a[1].updatedAt,
		)
		commentCacheMap.value = Object.fromEntries(
			entries.slice(0, MAX_COMMENT_CACHE_MOMENTS),
		)
		window.localStorage.setItem(
			MOMENT_COMMENT_CACHE_KEY,
			JSON.stringify(commentCacheMap.value),
		)
	}

	const persistCommentsToCache = (momentId: string, comments: Comment[]): void => {
		commentCacheMap.value[momentId] = {
			comments: comments.slice(0, MAX_COMMENTS_PER_MOMENT),
			updatedAt: Date.now(),
		}
		trimAndPersistCommentCache()
	}

	const persistCurrentListToCache = (): void => {
		const key = getListCacheKey()
		listCacheMap.value[key] = {
			items: moments.value.slice(0, MAX_CACHE_ITEMS_PER_LIST),
			cursor: listCursor.value,
			hasMore: hasMore.value,
			updatedAt: Date.now(),
		}
		trimAndPersistCache()
	}

	const hydrateFromCache = (): void => {
		try {
			const raw = window.localStorage.getItem(MOMENT_LIST_CACHE_KEY)
			if (!raw) return
			const parsed = JSON.parse(raw) as Partial<MomentCachePayload>
			if (
				parsed.activeTab &&
				['recommend', 'friends', 'nearby', 'trending'].includes(
					parsed.activeTab,
				)
			) {
				activeTab.value = parsed.activeTab as MomentTab
			}
			if (typeof parsed.searchQuery === 'string') {
				searchQuery.value = parsed.searchQuery
			}
			const lists = parsed.lists || {}
			const normalized: Record<string, MomentListCacheEntry> = {}
			for (const [key, value] of Object.entries(lists)) {
				if (!value || !Array.isArray(value.items)) continue
				normalized[key] = {
					items: value.items.map((item) => normalizeMoment(item)),
					cursor:
						typeof value.cursor === 'string' ? value.cursor : null,
					hasMore: Boolean(value.hasMore),
					updatedAt:
						typeof value.updatedAt === 'number'
							? value.updatedAt
							: Date.now(),
				}
			}
			listCacheMap.value = normalized
			const current = listCacheMap.value[getListCacheKey()]
			if (!current) return
			moments.value = current.items
			listCursor.value = current.cursor
			hasMore.value = current.hasMore
		} catch {
			listCacheMap.value = {}
		}
	}

	const hydrateCommentCache = (): void => {
		try {
			const raw = window.localStorage.getItem(MOMENT_COMMENT_CACHE_KEY)
			if (!raw) return
			const parsed = JSON.parse(raw) as Record<string, MomentCommentCacheEntry>
			const normalized: Record<string, MomentCommentCacheEntry> = {}
			for (const [momentId, entry] of Object.entries(parsed || {})) {
				if (!entry || !Array.isArray(entry.comments)) continue
				normalized[momentId] = {
					comments: entry.comments.map((item) => normalizeComment(item)),
					updatedAt:
						typeof entry.updatedAt === 'number'
							? entry.updatedAt
							: Date.now(),
				}
			}
			commentCacheMap.value = normalized
		} catch {
			commentCacheMap.value = {}
		}
	}

	const hydrateMomentCommentsFromCache = (): void => {
		for (const moment of moments.value) {
			if (moment.comments.length > 0) continue
			const cache = commentCacheMap.value[moment.id]
			if (!cache || !cache.comments.length) continue
			moment.comments = cache.comments
		}
	}

	const applyCurrentListCache = (): boolean => {
		const cache = listCacheMap.value[getListCacheKey()]
		if (!cache || !cache.items.length) return false
		replaceMomentsWithDiff(cache.items)
		hydrateMomentCommentsFromCache()
		listCursor.value = cache.cursor
		hasMore.value = cache.hasMore
		return true
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
		const hasWarmCache = reset ? applyCurrentListCache() : false
		if (reset && !hasWarmCache) {
			moments.value = []
		}
		isLoading.value = !hasWarmCache
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
			const page =
				response.data.data ||
				({ records: [], hasMore: false, nextCursor: null } as CursorPage<
					Record<string, unknown>
				>)
			const mapped = (page.records || []).map((item) => normalizeMoment(item))
			if (reset) {
				replaceMomentsWithDiff(mapped)
			} else {
				for (const item of mapped) upsertMoment(item)
			}
			for (const item of mapped) {
				if (item.comments.length > 0) {
					persistCommentsToCache(item.id, item.comments)
				}
			}
			listCursor.value = page.nextCursor || null
			hasMore.value = Boolean(page.hasMore)
			persistCurrentListToCache()
		} finally {
			if (requestSeq === listFetchSeq) {
				isLoading.value = false
			}
		}
	}

	const fetchMomentDetail = async (momentId: string): Promise<Moment> => {
		isDetailLoading.value = true
		try {
			const response = await request.get<ApiResponse<Record<string, unknown>>>(
				`/moments/${momentId}`,
			)
			const mapped = normalizeMoment(response.data.data)
			const result = upsertMoment(mapped)
			if (result.comments.length > 0) {
				persistCommentsToCache(momentId, result.comments)
			}
			persistCurrentListToCache()
			return result
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
			moment.comments = mergeCommentsWithDiff(moment.comments, comments)
			moment.commentsCount =
				typeof moment.commentsCount === 'number'
					? Math.max(moment.commentsCount, moment.comments.length)
					: moment.comments.length
			persistCommentsToCache(momentId, moment.comments)
			persistCurrentListToCache()
		}
		return moment?.comments || comments
	}

	const openMoment = async (momentId: string): Promise<void> => {
		selectedMomentId.value = momentId
		await Promise.all([fetchMomentDetail(momentId), fetchComments(momentId)])
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
				: await request.delete<ApiResponse<LikeActionResponse>>(endpoint)
			const data = response.data.data
			moment.isLiked = data.liked
			moment.likes = data.likes
			persistCurrentListToCache()
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
		const response = await request.post<ApiResponse<Record<string, unknown>>>(
			`/moments/${momentId}/comments`,
			{
				text: content,
				parentCommentId,
				replyToAccount,
			},
		)
		const comment = normalizeComment(response.data.data)
		const moment = moments.value.find((item) => item.id === momentId)
		if (moment) {
			moment.comments.unshift(comment)
			moment.commentsCount = (moment.commentsCount || 0) + 1
			persistCommentsToCache(momentId, moment.comments)
			persistCurrentListToCache()
		}
		return comment
	}

	const addMoment = async (payload: AddMomentPayload): Promise<Moment> => {
		const response = await request.post<ApiResponse<Record<string, unknown>>>(
			'/moments',
			payload,
		)
		const created = normalizeMoment(response.data.data)
		moments.value.unshift(created)
		persistCurrentListToCache()
		return created
	}

	const updateMoment = async (
		momentId: string,
		payload: UpdateMomentPayload,
	): Promise<Moment> => {
		const response = await request.put<ApiResponse<Record<string, unknown>>>(
			`/moments/${momentId}`,
			payload,
		)
		const updated = normalizeMoment(response.data.data)
		const result = upsertMoment(updated)
		persistCurrentListToCache()
		return result
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
		persistCurrentListToCache()
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

	hydrateFromCache()
	hydrateCommentCache()
	hydrateMomentCommentsFromCache()

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

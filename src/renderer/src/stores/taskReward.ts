import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import request from '@renderer/utils/request'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useVipStore } from '@renderer/stores/vip'
import { useWalletStore } from '@renderer/stores/wallet'

interface ApiResponse<T> {
	code: number
	status: string
	message?: string
	data: T
}

type TaskEventType = 'POST_CREATE' | 'REPLY_CREATE' | string

interface TaskConfigDto {
	taskType?: TaskEventType
	enabled?: boolean
	rewardWalletCent?: number
	rewardGrowth?: number
	dailyLimit?: number | null
}

interface TaskTodayProgressDto {
	userId?: number | string
	date?: string
	timezone?: string
	postGrantedCount?: number
	postDailyLimit?: number
	postRemainingCount?: number
}

interface WalletLedgerItemDto {
	ledgerId?: string
	bizType?: string
	taskType?: TaskEventType
	bizId?: string
	changeCent?: number
	balanceAfterCent?: number
	createdAt?: string
}

interface GrowthLedgerItemDto {
	ledgerId?: string
	bizType?: string
	taskType?: TaskEventType
	bizId?: string
	changeGrowth?: number
	growthAfter?: number
	createdAt?: string
}

interface RewardLedgerPageDto<T> {
	account?: Record<string, unknown>
	items?: T[]
	page?: number
	size?: number
	total?: number
}

interface TaskEventMeta {
	isDraft?: boolean
	isDeleted?: boolean
	isBlocked?: boolean
	isSystemBackfill?: boolean
	contentLength?: number
	ip?: string
	deviceId?: string
	[key: string]: unknown
}

interface TaskEventTriggerPayload {
	eventType: TaskEventType
	bizId: string
	targetId?: string | null
	meta?: TaskEventMeta
	createdAt?: string
}

interface TaskEventResultDto {
	eventId?: string
	taskType?: TaskEventType
	grantStatus?: string
	rewardWalletCent?: number
	rewardGrowth?: number
	todayGrantedCount?: number
	todayRemainingCount?: number
	reason?: string
	duplicate?: boolean
}

export interface TaskConfigItem {
	taskType: TaskEventType
	enabled: boolean
	rewardWalletCent: number
	rewardGrowth: number
	dailyLimit: number | null
}

export interface TaskTodayProgress {
	userId: string
	date: string
	timezone: string
	postGrantedCount: number
	postDailyLimit: number
	postRemainingCount: number
}

export interface WalletRewardLedgerItem {
	ledgerId: string
	taskType: TaskEventType
	bizId: string
	changeCent: number
	createdAt: string
}

export interface GrowthRewardLedgerItem {
	ledgerId: string
	taskType: TaskEventType
	bizId: string
	changeGrowth: number
	createdAt: string
}

export interface TaskEventResult {
	eventId: string
	taskType: TaskEventType
	grantStatus: string
	rewardWalletCent: number
	rewardGrowth: number
	todayGrantedCount: number
	todayRemainingCount: number
	reason: string
	duplicate: boolean
}

const toInt = (value: unknown, fallback = 0): number => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
	return Math.max(0, Math.floor(value))
}

const isRewardBizType = (bizType: unknown): boolean => {
	if (typeof bizType !== 'string') return false
	const normalized = bizType.trim().toUpperCase()
	return normalized === 'REWARD' || normalized === 'TASK_REWARD'
}

const normalizeTaskConfig = (item: TaskConfigDto): TaskConfigItem => ({
	taskType: typeof item.taskType === 'string' ? item.taskType : '',
	enabled: Boolean(item.enabled),
	rewardWalletCent: toInt(item.rewardWalletCent),
	rewardGrowth: toInt(item.rewardGrowth),
	dailyLimit:
		typeof item.dailyLimit === 'number' && Number.isFinite(item.dailyLimit)
			? Math.max(0, Math.floor(item.dailyLimit))
			: null,
})

const randomEventId = (): string => {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID()
	}
	return `task_evt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

export const useTaskRewardStore = defineStore('taskReward', () => {
	const userStore = useUserInfoStore()
	const vipStore = useVipStore()
	const walletStore = useWalletStore()

	const taskConfig = ref<TaskConfigItem[]>([])
	const todayProgress = ref<TaskTodayProgress | null>(null)
	const walletRewardItems = ref<WalletRewardLedgerItem[]>([])
	const growthRewardItems = ref<GrowthRewardLedgerItem[]>([])
	const isConfigLoading = ref(false)
	const isProgressLoading = ref(false)
	const isLedgerLoading = ref(false)
	const isEventSubmitting = ref(false)
	const lastEventResult = ref<TaskEventResult | null>(null)

	const hasTaskConfig = computed(() => taskConfig.value.length > 0)

	const resolveUserId = (): number | null => {
		if (
			typeof userStore.userId === 'number' &&
			Number.isFinite(userStore.userId) &&
			userStore.userId > 0
		) {
			return Math.floor(userStore.userId)
		}
		return null
	}

	const fetchTaskConfig = async (): Promise<void> => {
		isConfigLoading.value = true
		try {
			const res =
				await request.get<ApiResponse<TaskConfigDto[]>>('/tasks/config')
			taskConfig.value = Array.isArray(res.data?.data)
				? res.data.data.map((item) => normalizeTaskConfig(item))
				: []
		} finally {
			isConfigLoading.value = false
		}
	}

	const fetchTodayProgress = async (userId?: number): Promise<void> => {
		const targetUserId =
			typeof userId === 'number' && Number.isFinite(userId) && userId > 0
				? Math.floor(userId)
				: resolveUserId()
		if (!targetUserId) {
			todayProgress.value = null
			return
		}
		isProgressLoading.value = true
		try {
			const res = await request.get<ApiResponse<TaskTodayProgressDto>>(
				`/users/${encodeURIComponent(targetUserId)}/rewards/today`,
			)
			const payload = res.data?.data || {}
				todayProgress.value = {
					userId:
						typeof payload.userId === 'string' ||
						typeof payload.userId === 'number'
							? String(payload.userId)
							: String(targetUserId),
				date: typeof payload.date === 'string' ? payload.date : '',
				timezone: typeof payload.timezone === 'string' ? payload.timezone : '',
				postGrantedCount: toInt(payload.postGrantedCount),
				postDailyLimit: toInt(payload.postDailyLimit),
				postRemainingCount: toInt(payload.postRemainingCount),
			}
		} finally {
			isProgressLoading.value = false
		}
	}

	const fetchRewardLedgers = async ({
		userId,
		page = 0,
		size = 20,
	}: {
		userId?: number
		page?: number
		size?: number
	} = {}): Promise<void> => {
		const targetUserId =
			typeof userId === 'number' && Number.isFinite(userId) && userId > 0
				? Math.floor(userId)
				: resolveUserId()
		if (!targetUserId) {
			walletRewardItems.value = []
			growthRewardItems.value = []
			return
		}
		isLedgerLoading.value = true
		try {
			const safePage = Math.max(0, Math.floor(page))
			const safeSize = Math.min(50, Math.max(1, Math.floor(size)))
			const [walletRes, growthRes] = await Promise.all([
				request.get<ApiResponse<RewardLedgerPageDto<WalletLedgerItemDto>>>(
					`/users/${encodeURIComponent(targetUserId)}/wallet/ledger`,
					{ params: { page: safePage, size: safeSize } },
				),
				request.get<ApiResponse<RewardLedgerPageDto<GrowthLedgerItemDto>>>(
					`/users/${encodeURIComponent(targetUserId)}/growth/ledger`,
					{ params: { page: safePage, size: safeSize } },
				),
			])
			walletRewardItems.value = Array.isArray(walletRes.data?.data?.items)
				? walletRes.data.data.items
						.filter((item) => isRewardBizType(item.bizType))
						.map((item) => ({
							ledgerId: typeof item.ledgerId === 'string' ? item.ledgerId : '',
							taskType: typeof item.taskType === 'string' ? item.taskType : '',
							bizId: typeof item.bizId === 'string' ? item.bizId : '',
							changeCent: toInt(item.changeCent),
							createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
						}))
				: []
			growthRewardItems.value = Array.isArray(growthRes.data?.data?.items)
				? growthRes.data.data.items
						.filter((item) => isRewardBizType(item.bizType))
						.map((item) => ({
							ledgerId: typeof item.ledgerId === 'string' ? item.ledgerId : '',
							taskType: typeof item.taskType === 'string' ? item.taskType : '',
							bizId: typeof item.bizId === 'string' ? item.bizId : '',
							changeGrowth: toInt(item.changeGrowth),
							createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
						}))
				: []
		} finally {
			isLedgerLoading.value = false
		}
	}

	const refreshAll = async (userId?: number): Promise<void> => {
		await Promise.all([
			fetchTaskConfig(),
			fetchTodayProgress(userId),
			fetchRewardLedgers({ userId }),
		])
	}

	const triggerTaskEvent = async (
		payload: TaskEventTriggerPayload,
	): Promise<TaskEventResult> => {
		const eventType = payload.eventType?.trim()
		const bizId = payload.bizId?.trim()
		if (!eventType || !bizId) {
			throw new Error('task event payload invalid')
		}
		const currentUserId = resolveUserId()
		if (!currentUserId) {
			throw new Error('task actorUserId missing')
		}
		const eventPayload = {
			eventId: randomEventId(),
			eventType,
			bizId,
			actorUserId: currentUserId,
			targetId: payload.targetId || null,
			createdAt: payload.createdAt || new Date().toISOString(),
			meta: {
				isDraft: false,
				isDeleted: false,
				isBlocked: false,
				isSystemBackfill: false,
				...(payload.meta || {}),
			},
		}

		isEventSubmitting.value = true
		try {
			const res = await request.post<ApiResponse<TaskEventResultDto>>(
				'/task-events',
				eventPayload,
			)
			const resultPayload = res.data?.data || {}
			const result: TaskEventResult = {
				eventId:
					typeof resultPayload.eventId === 'string'
						? resultPayload.eventId
						: eventPayload.eventId,
				taskType:
					typeof resultPayload.taskType === 'string'
						? resultPayload.taskType
						: eventType,
				grantStatus:
					typeof resultPayload.grantStatus === 'string'
						? resultPayload.grantStatus
						: '',
				rewardWalletCent: toInt(resultPayload.rewardWalletCent),
				rewardGrowth: toInt(resultPayload.rewardGrowth),
				todayGrantedCount: toInt(resultPayload.todayGrantedCount),
				todayRemainingCount: toInt(resultPayload.todayRemainingCount),
				reason: typeof resultPayload.reason === 'string' ? resultPayload.reason : '',
				duplicate: Boolean(resultPayload.duplicate),
			}
			lastEventResult.value = result

			const syncJobs: Array<Promise<unknown>> = [
				fetchTodayProgress(currentUserId),
				fetchRewardLedgers({ userId: currentUserId, page: 0, size: 20 }),
			]
			if (result.rewardGrowth > 0) {
				syncJobs.push(vipStore.fetchProfile())
			}
			if (result.rewardWalletCent > 0) {
				syncJobs.push(walletStore.fetchWallet(true))
			}
			await Promise.all(syncJobs)
			return result
		} finally {
			isEventSubmitting.value = false
		}
	}

	const reset = (): void => {
		taskConfig.value = []
		todayProgress.value = null
		walletRewardItems.value = []
		growthRewardItems.value = []
		isConfigLoading.value = false
		isProgressLoading.value = false
		isLedgerLoading.value = false
		isEventSubmitting.value = false
		lastEventResult.value = null
	}

	return {
		taskConfig,
		todayProgress,
		walletRewardItems,
		growthRewardItems,
		isConfigLoading,
		isProgressLoading,
		isLedgerLoading,
		isEventSubmitting,
		lastEventResult,
		hasTaskConfig,
		fetchTaskConfig,
		fetchTodayProgress,
		fetchRewardLedgers,
		refreshAll,
		triggerTaskEvent,
		reset,
	}
})

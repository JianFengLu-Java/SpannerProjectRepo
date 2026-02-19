import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import request from '@renderer/utils/request'
import { useUserInfoStore } from '@renderer/stores/userInfo'

interface ApiResponse<T> {
	code: number
	status: string
	message?: string
	data: T
}

interface VipPlanDto {
	planCode?: string
	planName?: string
	price?: number | string
	months?: number
	growthBonus?: number
}

interface VipProfileDto {
	vipActive?: boolean
	vipExpireAt?: string
	growthValue?: number
	userLevel?: number
	nextLevelGrowth?: number
}

interface VipPurchaseDto {
	purchaseNo?: string
	planCode?: string
	planName?: string
	amount?: number | string
	startAt?: string
	endAt?: string
	vipActive?: boolean
	vipExpireAt?: string
	growthValue?: number
	userLevel?: number
}

interface VipOrderDto {
	purchaseNo?: string
	planCode?: string
	planName?: string
	amount?: number | string
	months?: number
	growthBonus?: number
	startAt?: string
	endAt?: string
	status?: string
	createdAt?: string
}

interface VipOrderPageDto {
	records?: VipOrderDto[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

export interface VipPlan {
	planCode: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string
	planName: string
	price: number
	months: number
	growthBonus: number
}

export interface VipOrder {
	purchaseNo: string
	planCode: string
	planName: string
	amount: number
	months: number
	growthBonus: number
	startAt: string
	endAt: string
	status: string
	createdAt: string
}

interface VipPurchasePayload {
	planCode?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string
	securityPassword: string
	purchaseNo?: string
}

interface AddGrowthPayload {
	growthValue: number
	reason?: string
}

const SECURITY_PASSWORD_PATTERN = /^\d{6}$/

const normalizePositiveInt = (value: unknown, fallback = 0): number => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
	return Math.max(0, Math.floor(value))
}

const normalizeAmount = (value: unknown): number => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Number(value.toFixed(2))
	}
	if (typeof value === 'string') {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) return Number(parsed.toFixed(2))
	}
	return 0
}

export const useVipStore = defineStore('vip', () => {
	const userStore = useUserInfoStore()
	const plans = ref<VipPlan[]>([])
	const vipActive = ref(false)
	const vipExpireAt = ref('')
	const growthValue = ref(0)
	const userLevel = ref(1)
	const nextLevelGrowth = ref(0)
	const profileLoading = ref(false)
	const plansLoading = ref(false)
	const purchaseLoading = ref(false)
	const ordersLoading = ref(false)
	const orders = ref<VipOrder[]>([])
	const orderPage = ref(1)
	const orderSize = ref(20)
	const orderTotal = ref(0)
	const orderTotalPages = ref(0)
	const orderHasMore = ref(false)

	const progressPercent = computed(() => {
		if (nextLevelGrowth.value <= 0) return 100
		return Math.max(
			0,
			Math.min(100, (growthValue.value / nextLevelGrowth.value) * 100),
		)
	})

	const growthGap = computed(() =>
		Math.max(nextLevelGrowth.value - growthValue.value, 0),
	)

	const mapPlan = (item: VipPlanDto): VipPlan => ({
		planCode:
			item.planCode === 'MONTHLY' ||
			item.planCode === 'QUARTERLY' ||
			item.planCode === 'YEARLY'
				? item.planCode
				: String(item.planCode || ''),
		planName: typeof item.planName === 'string' ? item.planName : '',
		price: normalizeAmount(item.price),
		months: normalizePositiveInt(item.months),
		growthBonus: normalizePositiveInt(item.growthBonus),
	})

	const mapOrder = (item: VipOrderDto): VipOrder => ({
		purchaseNo: typeof item.purchaseNo === 'string' ? item.purchaseNo : '',
		planCode: typeof item.planCode === 'string' ? item.planCode : '',
		planName: typeof item.planName === 'string' ? item.planName : '',
		amount: normalizeAmount(item.amount),
		months: normalizePositiveInt(item.months),
		growthBonus: normalizePositiveInt(item.growthBonus),
		startAt: typeof item.startAt === 'string' ? item.startAt : '',
		endAt: typeof item.endAt === 'string' ? item.endAt : '',
		status: typeof item.status === 'string' ? item.status : '',
		createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
	})

	const applyProfile = (payload?: VipProfileDto | VipPurchaseDto): void => {
		if (!payload) return
		if (typeof payload.vipActive === 'boolean') {
			vipActive.value = payload.vipActive
		}
		if (typeof payload.vipExpireAt === 'string') {
			vipExpireAt.value = payload.vipExpireAt
		}
		if (
			typeof payload.growthValue === 'number' &&
			Number.isFinite(payload.growthValue)
		) {
			growthValue.value = Math.max(0, Math.floor(payload.growthValue))
		}
		if (
			typeof payload.userLevel === 'number' &&
			Number.isFinite(payload.userLevel)
		) {
			userLevel.value = Math.max(1, Math.floor(payload.userLevel))
		}
		if (
			'nextLevelGrowth' in payload &&
			typeof payload.nextLevelGrowth === 'number' &&
			Number.isFinite(payload.nextLevelGrowth)
		) {
			nextLevelGrowth.value = Math.max(
				0,
				Math.floor(payload.nextLevelGrowth),
			)
		}
		userStore.patchUserInfo({
			vipActive: vipActive.value,
			vipExpireAt: vipExpireAt.value,
			growthValue: growthValue.value,
			userLevel: userLevel.value,
			nextLevelGrowth: nextLevelGrowth.value,
		})
	}

	const fetchPlans = async (): Promise<VipPlan[]> => {
		plansLoading.value = true
		try {
			const res =
				await request.get<ApiResponse<VipPlanDto[]>>('/user/vip/plans')
			const nextPlans = Array.isArray(res.data?.data)
				? res.data.data.map(mapPlan)
				: []
			plans.value = nextPlans
			return nextPlans
		} finally {
			plansLoading.value = false
		}
	}

	const fetchProfile = async (): Promise<void> => {
		profileLoading.value = true
		try {
			const res =
				await request.get<ApiResponse<VipProfileDto>>('/user/vip/profile')
			applyProfile(res.data?.data)
		} finally {
			profileLoading.value = false
		}
	}

	const purchase = async (
		payload: VipPurchasePayload,
	): Promise<VipPurchaseDto | undefined> => {
		if (purchaseLoading.value) return undefined
		const securityPassword = payload.securityPassword.trim()
		if (!SECURITY_PASSWORD_PATTERN.test(securityPassword)) {
			throw new Error('securityPassword 必须为 6 位数字')
		}
		purchaseLoading.value = true
		try {
			const res = await request.post<ApiResponse<VipPurchaseDto>>(
				'/user/vip/purchase',
				{
					planCode: payload.planCode || 'MONTHLY',
					securityPassword,
					purchaseNo: payload.purchaseNo?.trim() || undefined,
				},
			)
			const data = res.data?.data
			applyProfile(data)
			await Promise.all([fetchProfile(), fetchOrders(1, orderSize.value)])
			return data
		} finally {
			purchaseLoading.value = false
		}
	}

	const addGrowth = async (payload: AddGrowthPayload): Promise<void> => {
		const normalizedGrowthValue = Math.floor(payload.growthValue)
		if (!Number.isInteger(normalizedGrowthValue) || normalizedGrowthValue <= 0) {
			throw new Error('growthValue 必须大于 0')
		}
		const res = await request.post<ApiResponse<VipProfileDto>>(
			'/user/growth/add',
			{
				growthValue: normalizedGrowthValue,
				reason: payload.reason?.trim() || undefined,
			},
		)
		applyProfile(res.data?.data)
	}

	const fetchOrders = async (page = 1, size = 20): Promise<void> => {
		ordersLoading.value = true
		try {
			const res = await request.get<ApiResponse<VipOrderPageDto>>(
				'/user/vip/orders',
				{
					params: {
						page: Math.max(1, Math.floor(page)),
						size: Math.min(50, Math.max(1, Math.floor(size))),
					},
				},
			)
			const data = res.data?.data
			orders.value = Array.isArray(data?.records)
				? data.records.map(mapOrder)
				: []
			orderPage.value =
				typeof data?.page === 'number' && data.page > 0
					? Math.floor(data.page)
					: 1
			orderSize.value =
				typeof data?.size === 'number' && data.size > 0
					? Math.floor(data.size)
					: 20
			orderTotal.value =
				typeof data?.total === 'number' && data.total >= 0
					? Math.floor(data.total)
					: 0
			orderTotalPages.value =
				typeof data?.totalPages === 'number' && data.totalPages >= 0
					? Math.floor(data.totalPages)
					: 0
			orderHasMore.value =
				typeof data?.hasMore === 'boolean'
					? data.hasMore
					: orderPage.value < orderTotalPages.value
		} finally {
			ordersLoading.value = false
		}
	}

	const refreshAll = async (): Promise<void> => {
		await Promise.all([fetchPlans(), fetchProfile(), fetchOrders(1, orderSize.value)])
	}

	const reset = (): void => {
		plans.value = []
		vipActive.value = false
		vipExpireAt.value = ''
		growthValue.value = 0
		userLevel.value = 1
		nextLevelGrowth.value = 0
		orders.value = []
		orderPage.value = 1
		orderSize.value = 20
		orderTotal.value = 0
		orderTotalPages.value = 0
		orderHasMore.value = false
		profileLoading.value = false
		plansLoading.value = false
		purchaseLoading.value = false
		ordersLoading.value = false
	}

	return {
		plans,
		vipActive,
		vipExpireAt,
		growthValue,
		userLevel,
		nextLevelGrowth,
		progressPercent,
		growthGap,
		profileLoading,
		plansLoading,
		purchaseLoading,
		ordersLoading,
		orders,
		orderPage,
		orderSize,
		orderTotal,
		orderTotalPages,
		orderHasMore,
		fetchPlans,
		fetchProfile,
		purchase,
		addGrowth,
		fetchOrders,
		refreshAll,
		reset,
	}
})

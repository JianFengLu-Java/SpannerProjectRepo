import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message?: string
	data: T
}

interface WalletDto {
	walletNo?: string
	balance?: number | string
	currency?: string
	status?: string
	updatedAt?: string
}

interface WalletChangeDto {
	wallet?: WalletDto
}

interface WalletFlowDto {
	walletNo?: string
	businessNo?: string
	changeType?: 'RECHARGE' | 'CONSUME' | string
	amount?: number | string
	beforeBalance?: number | string
	afterBalance?: number | string
	remark?: string
	createdAt?: string
}

interface WalletFlowPageDto {
	records?: WalletFlowDto[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

interface WalletFlowQuery {
	page?: number
	size?: number
	changeType?: 'RECHARGE' | 'CONSUME'
}

export interface WalletFlowRecord {
	walletNo: string
	businessNo: string
	changeType: 'RECHARGE' | 'CONSUME'
	amountCents: number
	beforeBalanceCents: number
	afterBalanceCents: number
	remark: string
	createdAt: string
}

interface WalletActionPayload {
	amountCents: number
	businessNo?: string
	remark?: string
}

const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/

const parseAmountToCents = (value: unknown): number | null => {
	if (value === null || value === undefined) return null
	const raw =
		typeof value === 'number'
			? value.toString()
			: typeof value === 'string'
				? value.trim()
				: ''
	if (!raw) return null

	const normalized = raw.replace(/,/g, '')
	const matched = normalized.match(AMOUNT_PATTERN)
	if (!matched) return null

	const isNegative = matched[1] === '-'
	const integerPart = matched[2]
	const fractionPart = matched[3] || ''
	const roundedFraction = fractionPart.padEnd(3, '0')

	let cents = BigInt(integerPart) * 100n + BigInt(roundedFraction.slice(0, 2))
	if (Number(roundedFraction[2]) >= 5) {
		cents += 1n
	}
	if (isNegative) cents *= -1n

	if (
		cents > BigInt(Number.MAX_SAFE_INTEGER) ||
		cents < BigInt(Number.MIN_SAFE_INTEGER)
	) {
		return null
	}

	return Number(cents)
}

const centsToApiAmount = (cents: number): number =>
	Number((cents / 100).toFixed(2))

const formatAmount = (cents: number, currency: string): string => {
	const safeCurrency = currency || 'CNY'
	const amount = cents / 100
	try {
		return new Intl.NumberFormat('zh-CN', {
			style: 'currency',
			currency: safeCurrency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount)
	} catch {
		return `${safeCurrency} ${amount.toFixed(2)}`
	}
}

export const useWalletStore = defineStore('wallet', () => {
	const walletNo = ref('')
	const balanceCents = ref(0)
	const currency = ref('CNY')
	const walletStatus = ref('')
	const updatedAt = ref('')
	const isLoading = ref(false)
	const initialized = ref(false)
	const flowRecords = ref<WalletFlowRecord[]>([])
	const flowLoading = ref(false)
	const flowPage = ref(1)
	const flowSize = ref(20)
	const flowTotal = ref(0)
	const flowTotalPages = ref(0)
	const flowHasMore = ref(false)
	const flowChangeType = ref<'RECHARGE' | 'CONSUME' | ''>('')
	let timer: number | null = null

	const formattedBalance = computed(() =>
		formatAmount(balanceCents.value, currency.value),
	)

	const flowQuery = computed<WalletFlowQuery>(() => ({
		page: flowPage.value,
		size: flowSize.value,
		changeType: flowChangeType.value || undefined,
	}))

	const applyWallet = (payload: WalletDto | null | undefined): void => {
		if (!payload) return
		walletNo.value =
			typeof payload.walletNo === 'string' ? payload.walletNo : ''
		currency.value =
			typeof payload.currency === 'string' && payload.currency
				? payload.currency
				: 'CNY'
		walletStatus.value =
			typeof payload.status === 'string' ? payload.status : ''
		updatedAt.value =
			typeof payload.updatedAt === 'string' ? payload.updatedAt : ''

		const nextBalanceCents = parseAmountToCents(payload.balance)
		if (typeof nextBalanceCents === 'number') {
			balanceCents.value = nextBalanceCents
		}
		initialized.value = true
	}

	const fetchWallet = async (silent = false): Promise<void> => {
		if (!silent) isLoading.value = true
		try {
			const res = await request.get<ApiResponse<WalletDto>>('/user/wallet')
			applyWallet(res.data?.data)
		} finally {
			if (!silent) isLoading.value = false
		}
	}

	const runWalletAction = async (
		url: '/user/wallet/recharge' | '/user/wallet/consume',
		payload: WalletActionPayload,
	): Promise<void> => {
		const normalizedCents = Math.floor(payload.amountCents)
		if (!Number.isInteger(normalizedCents) || normalizedCents <= 0) {
			throw new Error('amount 必须大于 0')
		}
		const amount = centsToApiAmount(normalizedCents)
		const res = await request.post<ApiResponse<WalletChangeDto>>(url, {
			amount,
			businessNo: payload.businessNo?.trim() || undefined,
			remark: payload.remark?.trim() || undefined,
		})
		const changedWallet = res.data?.data?.wallet
		if (changedWallet) {
			applyWallet(changedWallet)
		} else {
			await fetchWallet(true)
		}
		if (flowRecords.value.length > 0) {
			await fetchFlows({ page: 1 })
		}
	}

	const recharge = (payload: WalletActionPayload): Promise<void> =>
		runWalletAction('/user/wallet/recharge', payload)

	const consume = (payload: WalletActionPayload): Promise<void> =>
		runWalletAction('/user/wallet/consume', payload)

	const mapFlow = (item: WalletFlowDto): WalletFlowRecord => {
		const amountCents = parseAmountToCents(item.amount) || 0
		const beforeBalanceCents = parseAmountToCents(item.beforeBalance) || 0
		const afterBalanceCents = parseAmountToCents(item.afterBalance) || 0
		const changeType =
			item.changeType === 'RECHARGE' ? 'RECHARGE' : 'CONSUME'
		return {
			walletNo: typeof item.walletNo === 'string' ? item.walletNo : '',
			businessNo:
				typeof item.businessNo === 'string' ? item.businessNo : '',
			changeType,
			amountCents,
			beforeBalanceCents,
			afterBalanceCents,
			remark: typeof item.remark === 'string' ? item.remark : '',
			createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
		}
	}

	const fetchFlows = async (patch: WalletFlowQuery = {}): Promise<void> => {
		flowLoading.value = true
		try {
			const nextPage =
				typeof patch.page === 'number' && patch.page > 0
					? Math.floor(patch.page)
					: flowPage.value
			const nextSize =
				typeof patch.size === 'number' && patch.size > 0
					? Math.floor(patch.size)
					: flowSize.value
			const nextChangeType =
				patch.changeType ?? flowChangeType.value ?? ''

			const params: WalletFlowQuery = {
				page: nextPage,
				size: Math.min(100, Math.max(1, nextSize)),
				changeType:
					nextChangeType === 'RECHARGE' || nextChangeType === 'CONSUME'
						? nextChangeType
						: undefined,
			}

			const res = await request.get<ApiResponse<WalletFlowPageDto>>(
				'/user/wallet/flows',
				{ params },
			)
			const data = res.data?.data
			const records = Array.isArray(data?.records) ? data.records : []
			flowRecords.value = records.map(mapFlow)
			flowPage.value =
				typeof data?.page === 'number' && data.page > 0
					? Math.floor(data.page)
					: params.page || 1
			flowSize.value =
				typeof data?.size === 'number' && data.size > 0
					? Math.floor(data.size)
					: params.size || 20
			flowTotal.value =
				typeof data?.total === 'number' && data.total >= 0
					? Math.floor(data.total)
					: 0
			flowTotalPages.value =
				typeof data?.totalPages === 'number' && data.totalPages >= 0
					? Math.floor(data.totalPages)
					: 0
			flowHasMore.value = Boolean(data?.hasMore)
			flowChangeType.value =
				params.changeType === 'RECHARGE' || params.changeType === 'CONSUME'
					? params.changeType
					: ''
		} finally {
			flowLoading.value = false
		}
	}

	const startAutoRefresh = (intervalMs = 5000): void => {
		if (timer !== null) return
		timer = window.setInterval(() => {
			void fetchWallet(true)
		}, intervalMs)
	}

	const stopAutoRefresh = (): void => {
		if (timer !== null) {
			window.clearInterval(timer)
			timer = null
		}
	}

	const reset = (): void => {
		stopAutoRefresh()
		walletNo.value = ''
		balanceCents.value = 0
		currency.value = 'CNY'
		walletStatus.value = ''
		updatedAt.value = ''
		isLoading.value = false
		initialized.value = false
		flowRecords.value = []
		flowLoading.value = false
		flowPage.value = 1
		flowSize.value = 20
		flowTotal.value = 0
		flowTotalPages.value = 0
		flowHasMore.value = false
		flowChangeType.value = ''
	}

	return {
		walletNo,
		balanceCents,
		currency,
		walletStatus,
		updatedAt,
		isLoading,
		initialized,
		flowRecords,
		flowLoading,
		flowPage,
		flowSize,
		flowTotal,
		flowTotalPages,
		flowHasMore,
		flowChangeType,
		flowQuery,
		formattedBalance,
		fetchWallet,
		recharge,
		consume,
		fetchFlows,
		formatAmount,
		startAutoRefresh,
		stopAutoRefresh,
		reset,
	}
})

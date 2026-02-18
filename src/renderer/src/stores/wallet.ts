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
	securityPasswordSet?: boolean
	updatedAt?: string
}

interface WalletChangeDto {
	wallet?: WalletDto
}

interface WalletFlowDto {
	walletNo?: string
	businessNo?: string
	changeType?: 'RECHARGE' | 'CONSUME' | 'TRANSFER_OUT' | 'TRANSFER_IN' | string
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
	changeType?: 'RECHARGE' | 'CONSUME' | 'TRANSFER_OUT' | 'TRANSFER_IN'
}

export interface WalletFlowRecord {
	walletNo: string
	businessNo: string
	changeType: 'RECHARGE' | 'CONSUME' | 'TRANSFER_OUT' | 'TRANSFER_IN'
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
	securityPassword?: string
}

interface WalletTransferPayload {
	toAccount: string
	amountCents: number
	securityPassword: string
	businessNo?: string
	remark?: string
}

interface WalletTransferAcceptPayload {
	businessNo: string
}

interface WalletTransferAcceptDto {
	toWallet?: WalletDto
}

interface WalletTransferApplyDto {
	businessNo?: string
	toAccount?: string
	amount?: number | string
	remark?: string
	status?: string
	createdAt?: string
}

const extractBusinessNo = (value: unknown, depth = 0): string => {
	if (depth > 3 || value === null || value === undefined) return ''
	if (typeof value === 'string') return value.trim()
	if (typeof value !== 'object') return ''
	const row = value as Record<string, unknown>
	const direct = row.businessNo
	if (typeof direct === 'string' && direct.trim()) return direct.trim()
	for (const nested of Object.values(row)) {
		const found = extractBusinessNo(nested, depth + 1)
		if (found) return found
	}
	return ''
}

interface WalletSecurityPasswordPayload {
	oldSecurityPassword?: string
	newSecurityPassword: string
}

const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/
const SECURITY_PASSWORD_PATTERN = /^\d{6}$/

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
	const securityPasswordSet = ref(false)
	const updatedAt = ref('')
	const isLoading = ref(false)
	const initialized = ref(false)
	const overviewFlowRecords = ref<WalletFlowRecord[]>([])
	const flowRecords = ref<WalletFlowRecord[]>([])
	const flowLoading = ref(false)
	const flowPage = ref(1)
	const flowSize = ref(20)
	const flowTotal = ref(0)
	const flowTotalPages = ref(0)
	const flowHasMore = ref(false)
	const flowChangeType = ref<
		'RECHARGE' | 'CONSUME' | 'TRANSFER_OUT' | 'TRANSFER_IN' | ''
	>('')
	let walletFetchToken = 0
	let overviewFlowFetchToken = 0
	let flowFetchToken = 0
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
		securityPasswordSet.value = Boolean(payload.securityPasswordSet)
		updatedAt.value =
			typeof payload.updatedAt === 'string' ? payload.updatedAt : ''

		const nextBalanceCents = parseAmountToCents(payload.balance)
		if (typeof nextBalanceCents === 'number') {
			balanceCents.value = nextBalanceCents
		}
		initialized.value = true
	}

	const fetchWallet = async (silent = false): Promise<void> => {
		const currentToken = ++walletFetchToken
		if (!silent) isLoading.value = true
		try {
			const res =
				await request.get<ApiResponse<WalletDto>>('/user/wallet')
			if (currentToken !== walletFetchToken) return
			applyWallet(res.data?.data)
		} finally {
			if (!silent && currentToken === walletFetchToken) {
				isLoading.value = false
			}
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
		const trimmedSecurityPassword = payload.securityPassword?.trim() || ''
		if (
			url === '/user/wallet/consume' &&
			!SECURITY_PASSWORD_PATTERN.test(trimmedSecurityPassword)
		) {
			throw new Error('securityPassword 必须为 6 位数字')
		}
		const amount = centsToApiAmount(normalizedCents)
		const res = await request.post<ApiResponse<WalletChangeDto>>(url, {
			amount,
			businessNo: payload.businessNo?.trim() || undefined,
			remark: payload.remark?.trim() || undefined,
			securityPassword:
				url === '/user/wallet/consume'
					? trimmedSecurityPassword
					: undefined,
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
		if (overviewFlowRecords.value.length > 0) {
			await fetchOverviewFlows(flowSize.value)
		}
	}

	const recharge = (payload: WalletActionPayload): Promise<void> =>
		runWalletAction('/user/wallet/recharge', payload)

	const consume = (payload: WalletActionPayload): Promise<void> =>
		runWalletAction('/user/wallet/consume', payload)

	const transfer = async (
		payload: WalletTransferPayload,
	): Promise<WalletTransferApplyDto> => {
		const toAccount = payload.toAccount?.trim() || ''
		if (!toAccount) {
			throw new Error('toAccount 不能为空')
		}
		const normalizedCents = Math.floor(payload.amountCents)
		if (!Number.isInteger(normalizedCents) || normalizedCents <= 0) {
			throw new Error('amount 必须大于 0')
		}
		const trimmedSecurityPassword = payload.securityPassword?.trim() || ''
		if (!SECURITY_PASSWORD_PATTERN.test(trimmedSecurityPassword)) {
			throw new Error('securityPassword 必须为 6 位数字')
		}

		const res = await request.post<ApiResponse<WalletTransferApplyDto>>(
			'/user/wallet/transfer',
			{
				toAccount,
				amount: centsToApiAmount(normalizedCents),
				securityPassword: trimmedSecurityPassword,
				remark: payload.remark?.trim() || undefined,
			},
		)
		const data = (res.data?.data || {}) as WalletTransferApplyDto
		const normalizedBusinessNo =
			(typeof data.businessNo === 'string' && data.businessNo.trim()) ||
			extractBusinessNo(res.data?.data) ||
			extractBusinessNo(res.data) ||
			''
		return {
			...data,
			businessNo: normalizedBusinessNo || undefined,
		}
	}

	const acceptTransfer = async (
		payload: WalletTransferAcceptPayload,
	): Promise<void> => {
		const businessNo = payload.businessNo?.trim() || ''
		if (!businessNo) {
			throw new Error('businessNo 不能为空')
		}
		const res = await request.post<ApiResponse<WalletTransferAcceptDto>>(
			'/user/wallet/transfer/accept',
			{
				businessNo,
			},
		)
		const nextWallet = res.data?.data?.toWallet
		if (nextWallet) {
			applyWallet(nextWallet)
		} else {
			await fetchWallet(true)
		}
		if (flowRecords.value.length > 0) {
			await fetchFlows({ page: 1 })
		}
		if (overviewFlowRecords.value.length > 0) {
			await fetchOverviewFlows(flowSize.value)
		}
	}

	const setSecurityPassword = async (
		payload: WalletSecurityPasswordPayload,
	): Promise<void> => {
		const oldSecurityPassword = payload.oldSecurityPassword?.trim() || ''
		const newSecurityPassword = payload.newSecurityPassword?.trim() || ''
		if (!SECURITY_PASSWORD_PATTERN.test(newSecurityPassword)) {
			throw new Error('newSecurityPassword 必须为 6 位数字')
		}
		if (
			oldSecurityPassword &&
			!SECURITY_PASSWORD_PATTERN.test(oldSecurityPassword)
		) {
			throw new Error('oldSecurityPassword 必须为 6 位数字')
		}
		const res = await request.put<ApiResponse<WalletDto>>(
			'/user/wallet/security-password',
			{
				oldSecurityPassword: oldSecurityPassword || undefined,
				newSecurityPassword,
			},
		)
		applyWallet(res.data?.data)
	}

	const mapFlow = (item: WalletFlowDto): WalletFlowRecord => {
		const amountCents = parseAmountToCents(item.amount) || 0
		const beforeBalanceCents = parseAmountToCents(item.beforeBalance) || 0
		const afterBalanceCents = parseAmountToCents(item.afterBalance) || 0
		const changeType =
			item.changeType === 'RECHARGE' ||
			item.changeType === 'CONSUME' ||
			item.changeType === 'TRANSFER_OUT' ||
			item.changeType === 'TRANSFER_IN'
				? item.changeType
				: 'CONSUME'
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
		const currentToken = ++flowFetchToken
		flowLoading.value = true
		try {
			const hasChangeTypePatch = Object.prototype.hasOwnProperty.call(
				patch,
				'changeType',
			)
			const nextPage =
				typeof patch.page === 'number' && patch.page > 0
					? Math.floor(patch.page)
					: flowPage.value
			const nextSize =
				typeof patch.size === 'number' && patch.size > 0
					? Math.floor(patch.size)
					: flowSize.value
			const nextChangeType = hasChangeTypePatch
				? patch.changeType || ''
				: flowChangeType.value || ''

			const params: WalletFlowQuery = {
				page: nextPage,
				size: Math.min(100, Math.max(1, nextSize)),
				changeType:
					nextChangeType === 'RECHARGE' ||
					nextChangeType === 'CONSUME' ||
					nextChangeType === 'TRANSFER_OUT' ||
					nextChangeType === 'TRANSFER_IN'
						? nextChangeType
						: undefined,
			}

			const res = await request.get<ApiResponse<WalletFlowPageDto>>(
				'/user/wallet/flows',
				{ params },
			)
			if (currentToken !== flowFetchToken) return
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
			if (typeof data?.hasMore === 'boolean') {
				flowHasMore.value = data.hasMore
			} else {
				flowHasMore.value =
					flowTotalPages.value > 0
						? flowPage.value < flowTotalPages.value
						: flowRecords.value.length >= flowSize.value
			}
			flowChangeType.value =
				params.changeType === 'RECHARGE' ||
				params.changeType === 'CONSUME' ||
				params.changeType === 'TRANSFER_OUT' ||
				params.changeType === 'TRANSFER_IN'
					? params.changeType
					: ''
		} finally {
			if (currentToken === flowFetchToken) {
				flowLoading.value = false
			}
		}
	}

	const fetchOverviewFlows = async (
		size = flowSize.value || 20,
	): Promise<void> => {
		const currentToken = ++overviewFlowFetchToken
		const safeSize = Math.min(100, Math.max(1, Math.floor(size || 20)))
		const res = await request.get<ApiResponse<WalletFlowPageDto>>(
			'/user/wallet/flows',
			{
				params: {
					page: 1,
					size: safeSize,
				},
			},
		)
		if (currentToken !== overviewFlowFetchToken) return
		const records = Array.isArray(res.data?.data?.records)
			? res.data.data.records
			: []
		overviewFlowRecords.value = records.map(mapFlow)
	}

	const refreshOverview = async (): Promise<void> => {
		await Promise.all([
			fetchWallet(true),
			fetchOverviewFlows(flowSize.value),
		])
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
		walletFetchToken += 1
		overviewFlowFetchToken += 1
		flowFetchToken += 1
		walletNo.value = ''
		balanceCents.value = 0
		currency.value = 'CNY'
		walletStatus.value = ''
		securityPasswordSet.value = false
		updatedAt.value = ''
		isLoading.value = false
		initialized.value = false
		overviewFlowRecords.value = []
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
		securityPasswordSet,
		updatedAt,
		isLoading,
		initialized,
		overviewFlowRecords,
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
		transfer,
		acceptTransfer,
		setSecurityPassword,
		fetchOverviewFlows,
		fetchFlows,
		refreshOverview,
		formatAmount,
		startAutoRefresh,
		stopAutoRefresh,
		reset,
	}
})

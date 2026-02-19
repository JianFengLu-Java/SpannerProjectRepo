<script setup lang="ts">
import { computed, ref } from 'vue'
import KeyValueRow from './KeyValueRow.vue'
import PrimaryButton from './PrimaryButton.vue'
import SecondaryLink from './SecondaryLink.vue'

export type MembershipNoticeStatus =
	| 'success'
	| 'processing'
	| 'failed'
	| 'refunded'

export interface MembershipTopUpNoticeCardProps {
	status: MembershipNoticeStatus
	amount: number
	currency?: string
	hideAmount?: boolean
	successText?: string
	durationDays?: number
	levelBefore?: string
	levelAfter?: string
	paidAt: string | Date
	orderId: string
	payMethod: string
	onViewBenefits?: () => void
	onViewOrder?: () => void
	onRetryPay?: () => void
	onContactSupport?: () => void
}

const props = withDefaults(defineProps<MembershipTopUpNoticeCardProps>(), {
	currency: '¥',
	hideAmount: false,
	successText: '开通成功',
	durationDays: 0,
	levelBefore: '',
	levelAfter: '',
	onViewBenefits: () => undefined,
	onViewOrder: () => undefined,
	onRetryPay: () => undefined,
	onContactSupport: () => undefined,
})

const copied = ref(false)
const copyHint = ref('')
let copyHintTimer: ReturnType<typeof setTimeout> | null = null

const headerTitleMap: Record<MembershipNoticeStatus, string> = {
	success: '会员充值到账',
	processing: '会员充值处理中',
	failed: '会员充值失败',
	refunded: '会员退款完成',
}

const isFailed = computed(() => props.status === 'failed')
const title = computed(() => headerTitleMap[props.status])

const amountText = computed(() => {
	const formatted = Number(props.amount || 0).toLocaleString('zh-CN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
	return `${props.currency}${formatted}`
})

const amountLabelText = computed(() =>
	props.hideAmount ? '充值结果' : '充值金额',
)

const amountOrResultText = computed(() =>
	props.hideAmount ? props.successText : amountText.value,
)

const membershipChange = computed(() => {
	const parts: string[] = []
	if (props.durationDays > 0) {
		parts.push(`+${props.durationDays}天`)
	}
	if (
		props.levelAfter &&
		props.levelBefore &&
		props.levelAfter !== props.levelBefore
	) {
		parts.push(`升级至 ${props.levelAfter}`)
	} else if (props.levelAfter) {
		parts.push(`当前 ${props.levelAfter}`)
	}
	if (!parts.length) return '权益变更待同步'
	return parts.join(' · ')
})

const compactMembershipChange = computed(() =>
	membershipChange.value === '权益变更待同步' ? '' : membershipChange.value,
)

const paidAtText = computed(() => {
	const source =
		typeof props.paidAt === 'string' ? new Date(props.paidAt) : props.paidAt
	if (Number.isNaN(source.getTime())) return String(props.paidAt || '--')
	const y = source.getFullYear()
	const m = String(source.getMonth() + 1).padStart(2, '0')
	const d = String(source.getDate()).padStart(2, '0')
	const hh = String(source.getHours()).padStart(2, '0')
	const mm = String(source.getMinutes()).padStart(2, '0')
	return `${y}-${m}-${d} ${hh}:${mm}`
})

const primaryButtonLabel = computed(() =>
	isFailed.value ? '重新支付' : '查看会员权益',
)

const orderIdText = computed(() => (props.orderId || '').trim() || '--')
const payMethodText = computed(() => (props.payMethod || '').trim() || '--')

const copyOrderId = async (): Promise<void> => {
	const text = (props.orderId || '').trim()
	if (!text || text === '--') {
		copyHint.value = '订单号为空，无法复制'
		return
	}

	const setHint = (message: string): void => {
		copyHint.value = message
		copied.value = message.includes('已复制')
		if (copyHintTimer) clearTimeout(copyHintTimer)
		copyHintTimer = setTimeout(() => {
			copyHint.value = ''
			copied.value = false
			copyHintTimer = null
		}, 1800)
	}

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text)
			setHint('订单号已复制')
			return
		}
		throw new Error('clipboard unavailable')
	} catch {
		try {
			const input = document.createElement('textarea')
			input.value = text
			input.setAttribute('readonly', 'true')
			input.style.position = 'fixed'
			input.style.left = '-9999px'
			document.body.appendChild(input)
			input.select()
			const result = document.execCommand('copy')
			document.body.removeChild(input)
			setHint(result ? '订单号已复制' : '复制失败，请手动复制')
		} catch {
			setHint('复制失败，请手动复制')
		}
	}
}

const handlePrimaryAction = (): void => {
	if (isFailed.value) {
		props.onRetryPay()
		return
	}
	props.onViewBenefits()
}
</script>

<template>
	<article
		class="relative w-full min-w-[320px] max-w-[430px] overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#fcfcfa] via-[#f8f7f3] to-[#f4f2ea] p-4 dark:border-slate-700/70 dark:from-[#1f2125] dark:via-[#1d1f23] dark:to-[#1a1c20]"
		aria-label="会员充值到账通知卡片"
	>
		<div
			class="pointer-events-none absolute -right-8 -top-12 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl dark:bg-amber-100/5"
		></div>

		<header class="relative flex items-start justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2.5">
				<h3
					class="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100"
				>
					{{ title }}
				</h3>
			</div>
		</header>

		<section
			class="relative mt-4 rounded-xl border border-slate-200/60 bg-white/78 px-3 py-3.5 dark:border-slate-700/70 dark:bg-slate-900/35"
		>
			<div
				class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400"
			>
				{{ amountLabelText }}
			</div>
			<div
				class="mt-1.5 break-all text-[32px] font-extrabold leading-none tracking-tight text-slate-800 dark:text-slate-100"
			>
				{{ amountOrResultText }}
			</div>
			<div
				v-if="compactMembershipChange"
				class="mt-2 inline-flex rounded-full border border-slate-200/80 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600/80 dark:bg-slate-800/70 dark:text-slate-300"
			>
				{{ compactMembershipChange }}
			</div>
		</section>

		<section
			class="relative mt-3 space-y-2 rounded-xl border border-slate-200/70 bg-white/58 p-3 dark:border-slate-700/70 dark:bg-slate-900/28"
		>
			<KeyValueRow label="到账时间" :value="paidAtText" />
			<KeyValueRow label="订单号" :value="orderIdText" wrap>
				<template #action>
					<button
						type="button"
						class="shrink-0 rounded-md border border-slate-300/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
						:aria-label="`复制订单号 ${orderId}`"
						@click="copyOrderId"
					>
						{{ copied ? '已复制' : '复制' }}
					</button>
				</template>
			</KeyValueRow>
			<KeyValueRow label="支付方式" :value="payMethodText" />
		</section>

		<section class="relative mt-4">
			<div class="flex items-center gap-2">
				<PrimaryButton
					class="flex-1"
					:label="primaryButtonLabel"
					:aria-label="primaryButtonLabel"
					@click="handlePrimaryAction"
				/>
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
				<SecondaryLink
					label="查看订单详情"
					aria-label="查看订单详情"
					@click="onViewOrder"
				/>
				<SecondaryLink
					v-if="isFailed"
					label="联系客服"
					aria-label="联系客服"
					@click="onContactSupport"
				/>
			</div>
		</section>

		<div
			v-if="copyHint"
			role="status"
			aria-live="polite"
			class="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-900/88 px-3 py-1 text-[11px] text-white shadow-sm dark:bg-slate-100/90 dark:text-slate-900"
		>
			{{ copyHint }}
		</div>
	</article>
</template>

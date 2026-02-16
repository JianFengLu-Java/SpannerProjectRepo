<template>
	<div class="wallet-terminal h-full w-full overflow-hidden rounded-2xl bg-page-bg text-text-main">
		<div class="terminal-scroll h-full overflow-auto p-3 md:p-4">
			<header class="terminal-head border border-border-default rounded-xl px-4 py-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div class="text-[11px] uppercase tracking-[0.16em] terminal-muted">Wallet Console</div>
						<div class="mt-1 text-lg font-semibold">钱包交易台</div>
					</div>
					<div class="flex flex-wrap items-center gap-2 text-xs terminal-muted">
						<span class="chip">{{ currency }}</span>
						<span class="chip">{{ walletStatusLabel }}</span>
						<span class="chip">{{ walletNo || '-' }}</span>
						<span>更新 {{ walletUpdatedText }}</span>
					</div>
				</div>
			</header>

			<section class="mt-3 grid grid-cols-1 xl:grid-cols-12 gap-3">
				<div class="xl:col-span-8 space-y-3">
					<div class="panel border border-border-default rounded-xl p-4">
						<div class="text-xs terminal-muted">总资产</div>
						<div class="mt-2 text-3xl md:text-4xl font-semibold number-font">{{ formattedBalance }}</div>
						<div class="mt-3 grid grid-cols-3 gap-2">
							<div class="kpi-card">
								<div class="kpi-label">本页流入</div>
								<div class="kpi-value kpi-up">+{{ formatMoney(pageInflowCents) }}</div>
							</div>
							<div class="kpi-card">
								<div class="kpi-label">本页流出</div>
								<div class="kpi-value kpi-down">-{{ formatMoney(pageOutflowCents) }}</div>
							</div>
							<div class="kpi-card">
								<div class="kpi-label">交易笔数</div>
								<div class="kpi-value number-font">{{ flowRecords.length }}</div>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
						<div class="panel border border-border-default rounded-xl p-3">
							<div class="text-sm font-semibold">7日资金趋势</div>
							<div class="text-xs terminal-muted mt-1">净流入/流出变化</div>
							<v-chart class="chart-box mt-2" :option="trendOption" autoresize />
						</div>
						<div class="panel border border-border-default rounded-xl p-3">
							<div class="text-sm font-semibold">收支结构</div>
							<div class="text-xs terminal-muted mt-1">本页流水占比</div>
							<v-chart class="chart-box mt-2" :option="compositionOption" autoresize />
						</div>
					</div>

					<div class="panel border border-border-default rounded-xl p-4">
						<div class="flex items-center justify-between gap-2 flex-wrap">
							<div>
								<div class="text-sm font-semibold">交易执行</div>
								<div class="text-xs terminal-muted mt-1">输入金额后直接执行充值或消费</div>
							</div>
							<div class="seg-btns">
								<button
									type="button"
									:class="['seg-btn', { active: actionType === 'recharge' }]"
									@click="actionType = 'recharge'"
								>
									充值
								</button>
								<button
									type="button"
									:class="['seg-btn', { active: actionType === 'consume' }]"
									@click="actionType = 'consume'"
								>
									消费
								</button>
							</div>
						</div>

						<n-form label-placement="left" label-width="76" class="mt-4">
							<n-form-item label="金额">
								<n-input-number
									v-model:value="amount"
									:min="0.01"
									:precision="2"
									class="w-full"
									placeholder="请输入金额"
								/>
							</n-form-item>
							<n-form-item label="业务单号">
								<n-input v-model:value="businessNo" clearable placeholder="可选" />
							</n-form-item>
							<n-form-item label="备注">
								<n-input
									v-model:value="remark"
									type="textarea"
									autosize
									:maxlength="60"
									show-count
									placeholder="可选"
								/>
							</n-form-item>
						</n-form>
						<div class="mt-3 flex justify-end gap-2">
							<n-button secondary :loading="walletLoading" @click="refreshWallet">刷新余额</n-button>
							<n-button type="primary" :loading="actionLoading" @click="submitAction">
								{{ actionType === 'recharge' ? '执行充值' : '执行消费' }}
							</n-button>
						</div>
					</div>
				</div>

				<div class="xl:col-span-4 space-y-3">
					<div class="panel border border-border-default rounded-xl p-4">
						<div class="text-sm font-semibold">快捷交易</div>
						<div class="text-xs terminal-muted mt-1">常用金额一键下单</div>
						<div class="grid grid-cols-2 gap-2 mt-3">
							<button type="button" class="quick-btn" @click="quickTrade('recharge', 1000)">充值 10.00</button>
							<button type="button" class="quick-btn" @click="quickTrade('recharge', 5000)">充值 50.00</button>
							<button type="button" class="quick-btn" @click="quickTrade('consume', 1000)">消费 10.00</button>
							<button type="button" class="quick-btn" @click="quickTrade('consume', 5000)">消费 50.00</button>
						</div>
					</div>

					<div class="panel border border-border-default rounded-xl p-4">
						<div class="text-sm font-semibold">数据面板</div>
						<div class="text-xs terminal-muted mt-1">账单独立展示，支持筛选和详情</div>
						<div class="mt-4 space-y-2">
							<n-button block type="primary" @click="showBillsModal = true">打开账单面板</n-button>
							<n-button block secondary :loading="flowLoading" @click="refreshFlows">同步流水</n-button>
						</div>
					</div>
				</div>
			</section>
		</div>

		<n-modal
			v-model:show="showBillsModal"
			preset="card"
			title="账单面板"
			style="width: min(1080px, 97vw)"
			:mask-closable="true"
		>
			<WalletBillPanel />
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import {
	NButton,
	NForm,
	NFormItem,
	NInput,
	NInputNumber,
	NModal,
	useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import {
	GridComponent,
	MarkLineComponent,
	TitleComponent,
	TooltipComponent,
} from 'echarts/components'
import type { EChartsOption } from 'echarts'
import { storeToRefs } from 'pinia'
import { useWalletStore } from '@renderer/stores/wallet'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import WalletBillPanel from './components/WalletBillPanel.vue'

use([
	CanvasRenderer,
	LineChart,
	PieChart,
	GridComponent,
	TooltipComponent,
	TitleComponent,
	MarkLineComponent,
])

const walletStore = useWalletStore()
const userStore = useUserInfoStore()
const message = useMessage()

const {
	walletNo,
	currency,
	walletStatus,
	updatedAt,
	formattedBalance,
	isLoading: walletLoading,
	flowRecords,
	flowLoading,
	flowSize,
} = storeToRefs(walletStore)

const actionType = ref<'recharge' | 'consume'>('recharge')
const amount = ref<number | null>(null)
const businessNo = ref('')
const remark = ref('')
const actionLoading = ref(false)
const showBillsModal = ref(false)

const walletStatusLabel = computed(() => {
	if (walletStatus.value === 'ACTIVE') return '可用'
	if (walletStatus.value === 'FROZEN') return '冻结'
	if (walletStatus.value) return walletStatus.value
	return '未知'
})

const walletUpdatedText = computed(() => {
	if (!updatedAt.value) return '未同步'
	const date = new Date(updatedAt.value)
	if (Number.isNaN(date.getTime())) return updatedAt.value
	return date.toLocaleString('zh-CN', { hour12: false })
})

const pageInflowCents = computed(() =>
	flowRecords.value
		.filter((item) => item.changeType === 'RECHARGE')
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const pageOutflowCents = computed(() =>
	flowRecords.value
		.filter((item) => item.changeType === 'CONSUME')
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const formatMoney = (cents: number): string =>
	walletStore.formatAmount(cents, currency.value)

const formatCompactAmount = (cents: number): string => {
	const value = cents / 100
	if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}w`
	return value.toFixed(2)
}

const last7Trend = computed(() => {
	const dayMap = new Map<string, { label: string; netCents: number }>()
	for (let i = 6; i >= 0; i -= 1) {
		const date = new Date()
		date.setHours(0, 0, 0, 0)
		date.setDate(date.getDate() - i)
		const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
		const label = `${date.getMonth() + 1}/${date.getDate()}`
		dayMap.set(key, { label, netCents: 0 })
	}
	for (const record of flowRecords.value) {
		const date = new Date(record.createdAt)
		if (Number.isNaN(date.getTime())) continue
		date.setHours(0, 0, 0, 0)
		const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
		const item = dayMap.get(key)
		if (!item) continue
		item.netCents +=
			record.changeType === 'RECHARGE'
				? record.amountCents
				: -record.amountCents
	}
	return Array.from(dayMap.values())
})

const trendOption = computed<EChartsOption>(() => ({
	animation: true,
	grid: { left: 10, right: 10, top: 20, bottom: 18, containLabel: true },
	tooltip: {
		trigger: 'axis',
		borderWidth: 0,
		backgroundColor: 'rgba(18, 28, 45, 0.92)',
		textStyle: { color: '#dbeafe', fontSize: 11 },
		formatter: (params: unknown) => {
			const first = Array.isArray(params) ? params[0] : null
			const point = first as { axisValue?: string; data?: number } | null
			const cents = typeof point?.data === 'number' ? point.data : 0
			return `${point?.axisValue || ''}<br/>净变化: ${formatMoney(cents)}`
		},
	},
	xAxis: {
		type: 'category',
		boundaryGap: false,
		data: last7Trend.value.map((item) => item.label),
		axisTick: { show: false },
		axisLine: { lineStyle: { color: 'rgba(120,139,167,0.35)' } },
		axisLabel: { color: 'rgba(99,116,148,0.78)', fontSize: 11 },
	},
	yAxis: {
		type: 'value',
		axisLabel: {
			color: 'rgba(99,116,148,0.78)',
			fontSize: 11,
			formatter: (value: number) => formatCompactAmount(value),
		},
		splitLine: { lineStyle: { color: 'rgba(120,139,167,0.16)' } },
	},
	series: [
		{
			type: 'line',
			smooth: true,
			showSymbol: true,
			symbol: 'circle',
			symbolSize: 5,
			lineStyle: { width: 2, color: '#2f8fff' },
			areaStyle: {
				color: {
					type: 'linear',
					x: 0,
					y: 0,
					x2: 0,
					y2: 1,
					colorStops: [
						{ offset: 0, color: 'rgba(47,143,255,0.35)' },
						{ offset: 1, color: 'rgba(47,143,255,0.03)' },
					],
				},
			},
			data: last7Trend.value.map((item) => item.netCents),
			markLine: {
				symbol: 'none',
				label: { show: false },
				lineStyle: { type: 'dashed', color: 'rgba(120,139,167,0.4)' },
				data: [{ yAxis: 0 }],
			},
		},
	],
}))

const compositionOption = computed<EChartsOption>(() => ({
	animation: true,
	title: {
		text: formatMoney(pageInflowCents.value - pageOutflowCents.value),
		subtext: '净变化',
		left: 'center',
		top: '40%',
		textStyle: {
			fontSize: 13,
			fontWeight: 700,
			color: '#1e3a8a',
		},
		subtextStyle: {
			fontSize: 11,
			color: 'rgba(99,116,148,0.72)',
		},
	},
	tooltip: {
		trigger: 'item',
		borderWidth: 0,
		backgroundColor: 'rgba(18, 28, 45, 0.92)',
		textStyle: { color: '#dbeafe', fontSize: 11 },
		formatter: (params: unknown) => {
			const p = params as { name?: string; value?: number; percent?: number }
			const cents = typeof p.value === 'number' ? p.value : 0
			return `${p.name || ''}: ${formatMoney(cents)} (${(p.percent || 0).toFixed(1)}%)`
		},
	},
	series: [
		{
			type: 'pie',
			radius: ['56%', '78%'],
			center: ['50%', '52%'],
			label: {
				color: 'rgba(99,116,148,0.86)',
				fontSize: 11,
				formatter: '{b}: {d}%',
			},
			labelLine: { length: 10, length2: 8 },
			itemStyle: { borderColor: '#fff', borderWidth: 2 },
			emphasis: { scale: true, scaleSize: 8 },
			data: [
				{
					name: '收入',
					value: Math.max(pageInflowCents.value, 0.0001),
					itemStyle: { color: '#2f8fff' },
				},
				{
					name: '支出',
					value: Math.max(pageOutflowCents.value, 0.0001),
					itemStyle: { color: '#2a78f8' },
				},
			],
		},
	],
}))

const parseInputAmountToCents = (value: number | null): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null
	if (value <= 0) return null
	const normalized = value.toFixed(2)
	const [integerPart, fractionPart = '00'] = normalized.split('.')
	const cents = Number(integerPart) * 100 + Number(fractionPart)
	return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

const refreshWallet = (): void => {
	void walletStore.fetchWallet()
}

const refreshFlows = (): void => {
	void walletStore.fetchFlows({ page: 1, size: flowSize.value || 20 })
}

const submitWallet = async (amountCents: number): Promise<void> => {
	const payload = {
		amountCents,
		businessNo: businessNo.value,
		remark: remark.value,
	}
	if (actionType.value === 'recharge') {
		await walletStore.recharge(payload)
		message.success('充值成功')
	} else {
		await walletStore.consume(payload)
		message.success('消费成功')
	}
	amount.value = null
	businessNo.value = ''
	remark.value = ''
}

const submitAction = async (): Promise<void> => {
	if (actionLoading.value) return
	const amountCents = parseInputAmountToCents(amount.value)
	if (!amountCents) {
		message.warning('请输入大于 0 的金额，最多两位小数')
		return
	}
	actionLoading.value = true
	try {
		await submitWallet(amountCents)
		await Promise.all([
			walletStore.fetchWallet(true),
			walletStore.fetchFlows({ page: 1, size: flowSize.value || 20 }),
		])
	} catch (error) {
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(maybeResponse?.data?.message || '操作失败，请稍后重试')
	} finally {
		actionLoading.value = false
	}
}

const quickTrade = async (
	type: 'recharge' | 'consume',
	amountCents: number,
): Promise<void> => {
	if (actionLoading.value) return
	actionType.value = type
	actionLoading.value = true
	try {
		await submitWallet(amountCents)
		await Promise.all([
			walletStore.fetchWallet(true),
			walletStore.fetchFlows({ page: 1, size: flowSize.value || 20 }),
		])
	} catch (error) {
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(maybeResponse?.data?.message || '操作失败，请稍后重试')
	} finally {
		actionLoading.value = false
	}
}

onMounted(() => {
	void walletStore.fetchWallet()
	void walletStore.fetchFlows({ page: 1, size: flowSize.value || 20 })
	walletStore.startAutoRefresh(5000)
})

onUnmounted(() => {
	walletStore.stopAutoRefresh()
})

watch(
	() => userStore.account,
	(account) => {
		if (!account) {
			walletStore.reset()
			return
		}
		void walletStore.fetchWallet(true)
		void walletStore.fetchFlows({ page: 1, size: flowSize.value || 20 })
	},
)
</script>

<style scoped>
.wallet-terminal {
	background: var(--color-page-bg);
}

.terminal-scroll::-webkit-scrollbar {
	width: 6px;
	height: 6px;
}

.terminal-scroll::-webkit-scrollbar-thumb {
	background: rgba(120, 139, 167, 0.35);
	border-radius: 999px;
}

.terminal-head,
.panel {
	background: var(--color-card-bg);
}

.chart-box {
	height: 220px;
	width: 100%;
	border: 1px solid rgba(120, 139, 167, 0.2);
	border-radius: 10px;
	background: linear-gradient(
		180deg,
		rgba(148, 163, 184, 0.06),
		rgba(148, 163, 184, 0.01)
	);
}

.terminal-muted {
	color: rgba(99, 116, 148, 0.72);
}

.number-font {
	font-variant-numeric: tabular-nums;
	font-feature-settings: 'tnum';
}

.chip {
	height: 22px;
	display: inline-flex;
	align-items: center;
	padding: 0 8px;
	border: 1px solid var(--color-border-default);
	border-radius: 999px;
	background: rgba(148, 163, 184, 0.08);
}

.kpi-card {
	border: 1px solid var(--color-border-default);
	border-radius: 10px;
	padding: 10px;
	background: rgba(148, 163, 184, 0.06);
}

.kpi-label {
	font-size: 11px;
	color: rgba(99, 116, 148, 0.72);
}

.kpi-value {
	margin-top: 4px;
	font-size: 14px;
	font-weight: 600;
}

.kpi-up {
	color: #2f8fff;
}

.kpi-down {
	color: #2a78f8;
}

.seg-btns {
	display: inline-flex;
	border: 1px solid var(--color-border-default);
	border-radius: 8px;
	overflow: hidden;
}

.seg-btn {
	border: 0;
	background: transparent;
	padding: 6px 12px;
	font-size: 12px;
	cursor: pointer;
	color: rgba(99, 116, 148, 0.72);
}

.seg-btn.active {
	background: rgba(47, 143, 255, 0.13);
	color: #2f8fff;
}

.quick-btn {
	height: 34px;
	border: 1px solid var(--color-border-default);
	background: var(--color-card-bg);
	border-radius: 8px;
	font-size: 12px;
	color: var(--color-text-main);
	cursor: pointer;
}

.quick-btn:hover {
	border-color: rgba(47, 143, 255, 0.45);
	background: rgba(47, 143, 255, 0.08);
}

.dark .terminal-muted,
.dark .kpi-label,
.dark .seg-btn {
	color: #9aa0a6;
}

.dark .chart-box {
	border-color: rgba(120, 139, 167, 0.3);
	background: linear-gradient(
		180deg,
		rgba(71, 85, 105, 0.2),
		rgba(71, 85, 105, 0.05)
	);
}

@media (max-width: 768px) {
	.kpi-card {
		padding: 8px;
	}
}
</style>

<template>
	<div class="relative h-full flex flex-col bg-page-bg">
		<!-- Toolbar & Stats -->
		<div class="px-4 sm:px-6 py-4 space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h3 class="text-lg font-bold">交易记录</h3>
					<p class="text-xs text-gray-500">查看历史资金变动明细</p>
				</div>
				<div class="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
					<button
						v-for="item in flowTabs"
						:key="item.value"
						type="button"
						class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
						:class="flowFilter === item.value 
							? 'bg-white dark:bg-zinc-700 text-primary' 
							: 'text-gray-500 hover:text-text-main'"
						@click="setFlowFilter(item.value)"
					>
						{{ item.label }}
					</button>
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
					<p class="text-[10px] uppercase font-bold text-emerald-600/70 mb-1">总收入</p>
					<p class="text-sm font-bold text-emerald-600 number-font">+{{ formatMoney(rechargeTotalCents) }}</p>
				</div>
				<div class="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
					<p class="text-[10px] uppercase font-bold text-orange-600/70 mb-1">总支出</p>
					<p class="text-sm font-bold text-orange-600 number-font">-{{ formatMoney(consumeTotalCents) }}</p>
				</div>
				<div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
					<p class="text-[10px] uppercase font-bold text-blue-600/70 mb-1">净变化</p>
					<p class="text-sm font-bold text-blue-600 number-font" :class="netChangeCents < 0 ? 'text-orange-600' : 'text-emerald-600'">
						{{ netChangeCents >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(netChangeCents)) }}
					</p>
				</div>
			</div>
		</div>

		<!-- List Content -->
		<div class="flex-1 overflow-hidden flex flex-col px-4 sm:px-6">
			<div class="flex-1 overflow-y-auto no-scrollbar bg-card-bg border border-border-default rounded-2xl mb-4">
				<n-spin :show="flowLoading">
					<div v-if="groupedRecords.length > 0" class="divide-y divide-border-default/30">
						<div v-for="group in groupedRecords" :key="group.key" class="group-block">
							<div class="sticky top-0 z-10 bg-card-bg/90 backdrop-blur-md px-4 sm:px-5 py-3 flex flex-wrap justify-between items-center gap-2 border-b border-border-default/20">
								<span class="text-xs font-bold text-gray-500 uppercase tracking-widest">{{ group.label }}</span>
								<div class="flex gap-3 text-[10px] font-bold">
									<span class="text-emerald-500">+{{ formatMoney(group.rechargeTotalCents) }}</span>
									<span class="text-orange-500">-{{ formatMoney(group.consumeTotalCents) }}</span>
								</div>
							</div>
							
								<div 
									v-for="record in group.records" 
									:key="recordKey(record)" 
									class="transaction-item max-sm:flex-col max-sm:items-start max-sm:gap-2"
									@click="openDetail(record)"
								>
								<div class="flex items-center gap-4 flex-1">
									<div 
										class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border-default/50" 
										:class="
											getRecordIconType(record.changeType) === 'reward'
												? 'bg-amber-500/10 text-amber-500'
												: getRecordIconType(record.changeType) === 'transfer'
													? 'bg-cyan-500/10 text-cyan-500'
													: getRecordIconType(record.changeType) === 'vip'
														? 'bg-violet-500/10 text-violet-500'
														: getRecordIconType(record.changeType) === 'inflow'
															? 'bg-emerald-500/5 text-emerald-500'
															: 'bg-gray-500/5 text-gray-400'
										"
									>
										<n-icon size="20">
											<GiftOutline v-if="getRecordIconType(record.changeType) === 'reward'" />
											<SwapHorizontalOutline v-else-if="getRecordIconType(record.changeType) === 'transfer'" />
											<DiamondOutline v-else-if="getRecordIconType(record.changeType) === 'vip'" />
											<ArrowDownLeft24Filled v-else-if="getRecordIconType(record.changeType) === 'inflow'" />
											<ArrowUpRight24Filled v-else />
										</n-icon>
									</div>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-bold truncate">{{ getRecordTypeLabel(record.changeType) }}</p>
										<p class="text-[10px] text-gray-400">{{ formatDateTime(record.createdAt, true) }} · {{ record.businessNo || '无业务单号' }}</p>
									</div>
								</div>
								<div class="text-right max-sm:text-left max-sm:w-full">
									<p 
										class="text-sm font-bold number-font"
										:class="isInflowType(record.changeType) ? 'text-emerald-500' : 'text-text-main'"
									>
										{{ getRecordDirectionSign(record.changeType) }}{{ formatMoney(record.amountCents) }}
									</p>
									<p class="text-[10px] text-gray-400 font-mono">余额: {{ formatMoney(record.afterBalanceCents) }}</p>
								</div>
							</div>
						</div>
					</div>
					<div v-else-if="!flowLoading" class="py-24 flex flex-col items-center justify-center text-gray-400">
						<n-icon size="48" class="opacity-20 mb-2">
							<Receipt24Regular />
						</n-icon>
						<p class="text-sm">没有找到相关记录</p>
					</div>
				</n-spin>
			</div>

			<!-- Pagination -->
			<div class="min-h-14 shrink-0 flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-xs text-gray-400">
				<p>第 {{ flowPage }} / {{ Math.max(flowTotalPages, 1) }} 页 · {{ flowTotal }} 条</p>
				<div class="flex gap-2">
					<button 
						class="pagination-btn"
						:disabled="flowPage <= 1 || flowLoading"
						@click="loadPrevFlowPage"
					>
						上一页
					</button>
					<button 
						class="pagination-btn"
						:disabled="!flowHasMore || flowLoading"
						@click="loadNextFlowPage"
					>
						下一页
					</button>
				</div>
			</div>
		</div>

		<!-- Detail Modal -->
		<n-modal v-model:show="showDetailModal" transform-origin="center">
			<div class="next-wallet-modal w-[min(92vw,460px)] pb-6">
				<div class="flex flex-col items-center pt-8 pb-6 bg-gray-50 dark:bg-zinc-800/50">
					<div
						class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
						:class="isInflowType(activeRecord?.changeType) ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'"
					>
						<n-icon size="32">
							<Receipt24Filled />
						</n-icon>
					</div>
					<h3 class="text-lg font-bold">{{ getRecordTypeLabel(activeRecord?.changeType || 'CONSUME') }}</h3>
					<p class="text-2xl sm:text-3xl font-bold number-font mt-2" :class="isInflowType(activeRecord?.changeType) ? 'text-emerald-500' : ''">
						{{ isInflowType(activeRecord?.changeType) ? '+' : '-' }}{{ formatMoney(activeRecord?.amountCents || 0) }}
					</p>
				</div>

				<div class="px-5 sm:px-8 mt-6 space-y-4">
					<div class="detail-item">
						<span class="detail-label">交易状态</span>
						<span class="detail-value text-emerald-500">支付成功</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">交易类型</span>
						<span class="detail-value">{{ activeRecord?.changeType }}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">交易时间</span>
						<span class="detail-value">{{ formatDateTime(activeRecord?.createdAt || '') }}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">业务单号</span>
						<span class="detail-value font-mono text-[11px] select-all">{{ activeRecord?.businessNo || '---' }}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">备注内容</span>
						<span class="detail-value italic text-gray-400">{{ activeRecord?.remark || '无' }}</span>
					</div>
				</div>

				<div class="px-5 sm:px-8 mt-8">
					<button class="modal-btn-ghost w-full" @click="showDetailModal = false">关闭详情</button>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { NModal, NSpin, NIcon } from 'naive-ui'
import {
	ArrowDownLeft24Filled,
	ArrowUpRight24Filled,
	Receipt24Regular,
	Receipt24Filled,
} from '@vicons/fluent'
import { DiamondOutline, GiftOutline, SwapHorizontalOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useWalletStore, type WalletFlowRecord } from '@renderer/stores/wallet'
import { useUserInfoStore } from '@renderer/stores/userInfo'

const walletStore = useWalletStore()
const userStore = useUserInfoStore()

const {
	currency,
	flowRecords,
	flowLoading,
	flowPage,
	flowTotal,
	flowTotalPages,
	flowHasMore,
	flowSize,
	flowChangeType,
} = storeToRefs(walletStore)

const flowSizeLocal = ref(20)
const initialFlowFilter: 'ALL' | 'RECHARGE' | 'CONSUME' =
	flowChangeType.value === 'RECHARGE' || flowChangeType.value === 'CONSUME'
		? flowChangeType.value
		: 'ALL'
const flowFilter = ref<'ALL' | 'RECHARGE' | 'CONSUME'>(initialFlowFilter)
const showDetailModal = ref(false)
const activeRecord = ref<WalletFlowRecord | null>(null)

const flowTabs = [
	{ label: '全部', value: 'ALL' as const },
	{ label: '收入', value: 'RECHARGE' as const },
	{ label: '支出', value: 'CONSUME' as const },
]

const isInflowType = (changeType?: string): boolean =>
	changeType === 'RECHARGE' ||
	changeType === 'REWARD' ||
	changeType === 'TASK_REWARD' ||
	changeType === 'TRANSFER_IN'

const isRewardType = (changeType?: string): boolean =>
	changeType === 'REWARD' || changeType === 'TASK_REWARD'

const getRecordDirectionSign = (changeType: string): '+' | '-' => (isInflowType(changeType) ? '+' : '-')

const formatMoney = (cents: number): string =>
	walletStore.formatAmount(cents, currency.value)

const getRecordTypeLabel = (type: string): string => {
	const labels: Record<string, string> = {
		RECHARGE: '充值账户',
		REWARD: '奖励入账',
		TASK_REWARD: '奖励入账',
		CONSUME: '商户消费',
		TRANSFER_OUT: '转账（支出）',
		TRANSFER_IN: '转账（收入）',
		VIP_PURCHASE: '会员购买',
	}
	return labels[type] || '其他交易'
}

const getRecordIconType = (
	type: string,
): 'reward' | 'transfer' | 'vip' | 'inflow' | 'outflow' => {
	if (isRewardType(type)) return 'reward'
	if (type === 'TRANSFER_IN' || type === 'TRANSFER_OUT') return 'transfer'
	if (type === 'VIP_PURCHASE') return 'vip'
	if (isInflowType(type)) return 'inflow'
	return 'outflow'
}

const formatDateTime = (value: string, short = false): string => {
	if (!value) return '-'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	if (short) {
		return date.toLocaleTimeString('zh-CN', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		})
	}
	return date.toLocaleString('zh-CN', { hour12: false })
}

const getFlowChangeType = (): 'RECHARGE' | 'CONSUME' | undefined => {
	if (flowFilter.value === 'RECHARGE') return 'RECHARGE'
	if (flowFilter.value === 'CONSUME') return 'CONSUME'
	return undefined
}

const syncFlows = (page = 1): void => {
	void walletStore.fetchFlows({
		page,
		size: flowSizeLocal.value,
		changeType: getFlowChangeType(),
	})
}

const displayRecords = computed(() =>
	[...flowRecords.value].sort((a, b) => {
		const left = new Date(a.createdAt).getTime() || 0
		const right = new Date(b.createdAt).getTime() || 0
		return right - left
	}),
)

const groupedRecords = computed(() => {
	const map = new Map<
		string,
		{
			key: string
			label: string
			records: WalletFlowRecord[]
			rechargeTotalCents: number
			consumeTotalCents: number
		}
	>()

	for (const record of displayRecords.value) {
		const date = new Date(record.createdAt)
		const key = Number.isNaN(date.getTime())
			? 'unknown'
			: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
		const label =
			key === 'unknown'
				? '未知日期'
				: `${date.getMonth() + 1}月${date.getDate()}日`
		if (!map.has(key)) {
			map.set(key, {
				key,
				label,
				records: [],
				rechargeTotalCents: 0,
				consumeTotalCents: 0,
			})
		}
		const group = map.get(key)!
		group.records.push(record)
		if (isInflowType(record.changeType)) {
			group.rechargeTotalCents += record.amountCents
		} else {
			group.consumeTotalCents += record.amountCents
		}
	}

	return Array.from(map.values())
})

const rechargeTotalCents = computed(() =>
	displayRecords.value
		.filter((item) => isInflowType(item.changeType))
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const consumeTotalCents = computed(() =>
	displayRecords.value
		.filter((item) => !isInflowType(item.changeType))
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const netChangeCents = computed(
	() => rechargeTotalCents.value - consumeTotalCents.value,
)

const setFlowFilter = (value: 'ALL' | 'RECHARGE' | 'CONSUME'): void => {
	flowFilter.value = value
	syncFlows(1)
}

const loadPrevFlowPage = (): void => {
	if (flowPage.value <= 1) return
	syncFlows(flowPage.value - 1)
}

const loadNextFlowPage = (): void => {
	if (!flowHasMore.value) return
	syncFlows(flowPage.value + 1)
}

const recordKey = (record: WalletFlowRecord): string =>
	`${record.createdAt}-${record.businessNo}-${record.changeType}-${record.amountCents}`

const openDetail = (record: WalletFlowRecord): void => {
	activeRecord.value = record
	showDetailModal.value = true
}

flowSizeLocal.value = flowSize.value || 20

watch(
	() => userStore.account,
	(account) => {
		if (!account) return
		syncFlows(1)
	},
	{ immediate: true },
)
</script>

<style scoped>
@reference "../../../../assets/base.css";

.number-font {
	font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
	font-variant-numeric: tabular-nums;
}

.transaction-item {
	@apply flex items-center justify-between px-5 py-4 transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5;
}

.pagination-btn {
	@apply px-4 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed;
}

.no-scrollbar::-webkit-scrollbar {
	display: none;
}
.no-scrollbar {
	-ms-overflow-style: none;
	scrollbar-width: none;
}

.next-wallet-modal {
	@apply bg-card-bg rounded-[20px] border border-border-default overflow-hidden;
}

.modal-btn-ghost {
	@apply h-12 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold transition-all active:scale-95;
}

.detail-item {
	@apply flex justify-between items-center;
}
.detail-label {
	@apply text-xs text-gray-500 font-medium;
}
.detail-value {
	@apply text-sm font-bold;
}

</style>

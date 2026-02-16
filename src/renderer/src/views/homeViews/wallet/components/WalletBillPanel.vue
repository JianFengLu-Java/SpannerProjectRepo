<template>
	<div class="bill-terminal">
		<div class="toolbar border border-border-default rounded-lg p-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<div class="text-sm font-semibold">账单面板</div>
					<div class="text-xs panel-muted mt-1">高密度交易流水视图</div>
				</div>
				<div class="tabs">
					<button
						v-for="item in flowTabs"
						:key="item.value"
						type="button"
						:class="['tab-btn', { active: flowFilter === item.value }]"
						@click="setFlowFilter(item.value)"
					>
						{{ item.label }}
					</button>
				</div>
			</div>

			<div class="mt-3 grid grid-cols-3 gap-2">
				<div class="stat-card">
					<div class="stat-label">收入</div>
					<div class="stat-value up">+{{ formatMoney(rechargeTotalCents) }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">支出</div>
					<div class="stat-value down">-{{ formatMoney(consumeTotalCents) }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">净变化</div>
					<div class="stat-value" :class="netChangeCents >= 0 ? 'up' : 'down'">
						{{ netChangeCents >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(netChangeCents)) }}
					</div>
				</div>
			</div>
		</div>

		<div class="table-wrap border border-border-default rounded-lg mt-3 overflow-hidden">
			<div class="table-head">
				<div class="col time">时间</div>
				<div class="col type">类型</div>
				<div class="col amount right">金额</div>
				<div class="col balance right">余额变化</div>
				<div class="col business">业务单号</div>
			</div>

			<div v-if="groupedRecords.length === 0 && !flowLoading" class="empty">暂无账单记录</div>

			<n-spin :show="flowLoading">
				<div v-if="groupedRecords.length > 0" class="table-body">
					<div v-for="group in groupedRecords" :key="group.key" class="group-block">
						<div class="group-row">
							<span>{{ group.label }}</span>
							<span>收入 {{ formatMoney(group.rechargeTotalCents) }} · 支出 {{ formatMoney(group.consumeTotalCents) }}</span>
						</div>
						<div
							v-for="record in group.records"
							:key="recordKey(record)"
							class="data-row"
							@click="openDetail(record)"
						>
							<div class="col time number-font">{{ formatDateTime(record.createdAt, true) }}</div>
							<div class="col type">
								<span class="type-pill" :class="record.changeType === 'RECHARGE' ? 'up-pill' : 'down-pill'">
									{{ record.changeType === 'RECHARGE' ? '收入' : '支出' }}
								</span>
							</div>
							<div class="col amount right number-font" :class="record.changeType === 'RECHARGE' ? 'up' : 'down'">
								{{ record.changeType === 'RECHARGE' ? '+' : '-' }}{{ formatMoney(record.amountCents) }}
							</div>
							<div class="col balance right number-font">
								{{ formatMoney(record.beforeBalanceCents) }} -> {{ formatMoney(record.afterBalanceCents) }}
							</div>
							<div class="col business truncate">{{ record.businessNo || '-' }}</div>
						</div>
					</div>
				</div>
			</n-spin>
		</div>

		<div class="mt-3 flex items-center justify-between text-xs panel-muted">
			<div>第 {{ flowPage }} / {{ Math.max(flowTotalPages, 1) }} 页 · 共 {{ flowTotal }} 条</div>
			<div class="flex gap-2">
				<n-button size="tiny" :disabled="flowPage <= 1 || flowLoading" @click="loadPrevFlowPage">上一页</n-button>
				<n-button size="tiny" :disabled="!flowHasMore || flowLoading" @click="loadNextFlowPage">下一页</n-button>
			</div>
		</div>

		<n-modal v-model:show="showDetailModal" preset="card" title="账单详情" style="width: 460px">
			<div v-if="activeRecord" class="space-y-3 text-sm">
				<div class="detail-row"><span>类型</span><strong>{{ activeRecord.changeType === 'RECHARGE' ? '收入' : '支出' }}</strong></div>
				<div class="detail-row"><span>金额</span><strong>{{ activeRecord.changeType === 'RECHARGE' ? '+' : '-' }}{{ formatMoney(activeRecord.amountCents) }}</strong></div>
				<div class="detail-row"><span>变更前余额</span><span>{{ formatMoney(activeRecord.beforeBalanceCents) }}</span></div>
				<div class="detail-row"><span>变更后余额</span><span>{{ formatMoney(activeRecord.afterBalanceCents) }}</span></div>
				<div class="detail-row"><span>业务单号</span><span class="break-all text-right">{{ activeRecord.businessNo || '-' }}</span></div>
				<div class="detail-row"><span>备注</span><span class="break-all text-right">{{ activeRecord.remark || '-' }}</span></div>
				<div class="detail-row"><span>时间</span><span>{{ formatDateTime(activeRecord.createdAt) }}</span></div>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { NButton, NModal, NSpin } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
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
} = storeToRefs(walletStore)

const flowFilter = ref<'ALL' | 'RECHARGE' | 'CONSUME'>('ALL')
const flowSizeLocal = ref(20)
const showDetailModal = ref(false)
const activeRecord = ref<WalletFlowRecord | null>(null)

const flowTabs = [
	{ label: '全部', value: 'ALL' as const },
	{ label: '收入', value: 'RECHARGE' as const },
	{ label: '支出', value: 'CONSUME' as const },
]

const formatMoney = (cents: number): string =>
	walletStore.formatAmount(cents, currency.value)

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
		if (record.changeType === 'RECHARGE') {
			group.rechargeTotalCents += record.amountCents
		} else {
			group.consumeTotalCents += record.amountCents
		}
	}

	return Array.from(map.values())
})

const rechargeTotalCents = computed(() =>
	displayRecords.value
		.filter((item) => item.changeType === 'RECHARGE')
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const consumeTotalCents = computed(() =>
	displayRecords.value
		.filter((item) => item.changeType === 'CONSUME')
		.reduce((sum, item) => sum + item.amountCents, 0),
)

const netChangeCents = computed(() =>
	rechargeTotalCents.value - consumeTotalCents.value,
)

const setFlowFilter = (value: 'ALL' | 'RECHARGE' | 'CONSUME'): void => {
	flowFilter.value = value
	void walletStore.fetchFlows({
		page: 1,
		size: flowSizeLocal.value,
		changeType: getFlowChangeType(),
	})
}

const loadPrevFlowPage = (): void => {
	if (flowPage.value <= 1) return
	void walletStore.fetchFlows({
		page: flowPage.value - 1,
		size: flowSizeLocal.value,
		changeType: getFlowChangeType(),
	})
}

const loadNextFlowPage = (): void => {
	if (!flowHasMore.value) return
	void walletStore.fetchFlows({
		page: flowPage.value + 1,
		size: flowSizeLocal.value,
		changeType: getFlowChangeType(),
	})
}

const recordKey = (record: WalletFlowRecord): string =>
	`${record.createdAt}-${record.businessNo}-${record.changeType}-${record.amountCents}`

const openDetail = (record: WalletFlowRecord): void => {
	activeRecord.value = record
	showDetailModal.value = true
}

onMounted(() => {
	flowSizeLocal.value = flowSize.value || 20
	void walletStore.fetchFlows({
		page: 1,
		size: flowSizeLocal.value,
		changeType: getFlowChangeType(),
	})
})

watch(
	() => userStore.account,
	(account) => {
		if (!account) {
			walletStore.reset()
			return
		}
		void walletStore.fetchFlows({
			page: 1,
			size: flowSizeLocal.value,
			changeType: getFlowChangeType(),
		})
	},
)
</script>

<style scoped>
.bill-terminal {
	background: var(--color-page-bg);
}

.toolbar,
.table-wrap {
	background: var(--color-card-bg);
}

.panel-muted {
	color: rgba(99, 116, 148, 0.72);
}

.number-font {
	font-variant-numeric: tabular-nums;
	font-feature-settings: 'tnum';
}

.tabs {
	display: inline-flex;
	border: 1px solid var(--color-border-default);
	border-radius: 8px;
	overflow: hidden;
}

.tab-btn {
	border: 0;
	background: transparent;
	padding: 6px 11px;
	font-size: 12px;
	cursor: pointer;
	color: rgba(99, 116, 148, 0.72);
}

.tab-btn.active {
	background: rgba(47, 143, 255, 0.14);
	color: #2f8fff;
}

.stat-card {
	border: 1px solid var(--color-border-default);
	border-radius: 8px;
	padding: 8px;
	background: rgba(148, 163, 184, 0.06);
}

.stat-label {
	font-size: 11px;
	color: rgba(99, 116, 148, 0.72);
}

.stat-value {
	margin-top: 3px;
	font-size: 14px;
	font-weight: 600;
}

.up {
	color: #2f8fff;
}

.down {
	color: #2a78f8;
}

.table-head,
.data-row {
	display: grid;
	grid-template-columns: 96px 80px 120px 220px minmax(180px, 1fr);
	align-items: center;
	gap: 8px;
	padding: 9px 12px;
}

.table-head {
	border-bottom: 1px solid var(--color-border-default);
	font-size: 11px;
	color: rgba(99, 116, 148, 0.72);
}

.table-body {
	max-height: 500px;
	overflow: auto;
}

.group-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px 6px;
	font-size: 11px;
	color: rgba(99, 116, 148, 0.72);
}

.data-row {
	font-size: 12px;
	border-top: 1px solid var(--color-border-default);
	cursor: pointer;
}

.data-row:hover {
	background: rgba(47, 143, 255, 0.07);
}

.col.right {
	text-align: right;
}

.type-pill {
	display: inline-flex;
	align-items: center;
	height: 20px;
	padding: 0 8px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 600;
}

.up-pill {
	background: rgba(47, 143, 255, 0.14);
	color: #2f8fff;
}

.down-pill {
	background: rgba(42, 120, 248, 0.14);
	color: #2a78f8;
}

.empty {
	padding: 36px 0;
	text-align: center;
	font-size: 12px;
	color: rgba(99, 116, 148, 0.72);
}

.detail-row {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	line-height: 1.5;
}

.detail-row span:first-child {
	color: rgba(99, 116, 148, 0.72);
}

.dark .panel-muted,
.dark .tab-btn,
.dark .stat-label,
.dark .group-row,
.dark .table-head,
.dark .empty,
.dark .detail-row span:first-child {
	color: #9aa0a6;
}

@media (max-width: 980px) {
	.table-head,
	.data-row {
		grid-template-columns: 80px 70px 100px minmax(140px, 1fr);
	}

	.col.balance {
		display: none;
	}
}

@media (max-width: 640px) {
	.table-head,
	.data-row {
		grid-template-columns: 68px 66px minmax(110px, 1fr);
	}

	.col.business {
		display: none;
	}
}
</style>

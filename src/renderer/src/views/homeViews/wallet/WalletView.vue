<template>
	<div ref="walletViewRoot" class="relative h-full w-full bg-page-bg overflow-hidden flex flex-col">
		<!-- Header Section -->
		<header class="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border-default/50">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
					<n-icon size="20" class="text-primary">
						<Wallet24Filled />
					</n-icon>
				</div>
				<h2 class="text-lg font-bold text-text-main">我的钱包</h2>
			</div>
			<div class="flex items-center gap-2">
				<n-tooltip trigger="hover">
					<template #trigger>
						<div 
							class="status-chip"
							:class="securityPasswordSet ? 'is-set' : 'is-unset'"
						>
							<n-icon size="14">
								<ShieldCheckmark24Filled v-if="securityPasswordSet" />
								<ShieldDismiss24Filled v-else />
							</n-icon>
							<span>{{ securityPasswordSet ? 'PIN安全' : 'PIN未设置' }}</span>
						</div>
					</template>
					{{ securityPasswordSet ? '支付安全等级：高' : '请尽快前往设置支付安全密码' }}
				</n-tooltip>
				<div class="status-chip" :class="walletStatusClass">
					<div class="w-2 h-2 rounded-full bg-current" />
					<span>{{ walletStatusLabel }}</span>
				</div>
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto no-scrollbar pb-10">
			<div class="max-w-5xl mx-auto px-6 pt-6 space-y-6">
				
				<!-- Balance Hero Card -->
				<section class="balance-hero relative overflow-hidden group">
					<div class="relative z-10 flex flex-col h-full justify-between">
						<div>
							<p class="text-white/60 text-sm font-medium mb-1">总可用余额 ({{ currency }})</p>
							<div class="flex items-baseline gap-2">
								<h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight number-font">
									{{ formattedBalance }}
								</h1>
							</div>
						</div>
						
						<div class="flex items-center justify-between mt-8">
							<div class="flex gap-6">
								<div class="text-white/80">
									<p class="text-[10px] uppercase tracking-wider mb-0.5 opacity-60">钱包编号</p>
									<p class="text-sm font-mono tracking-tight">{{ walletNo || '********' }}</p>
								</div>
								<div class="text-white/80">
									<p class="text-[10px] uppercase tracking-wider mb-0.5 opacity-60">更新时间</p>
									<p class="text-sm tracking-tight">{{ walletUpdatedText }}</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<button
									class="hero-recharge-btn"
									:disabled="!canTrade"
									@click="openRecharge"
								>
									<n-icon size="18">
										<AddCircle24Filled />
									</n-icon>
									<span>快速充值</span>
								</button>
								<button
									class="hero-refresh-btn"
									@click="refreshWallet"
									:class="{ 'animate-spin': walletLoading }"
								>
									<n-icon size="20" class="text-white">
										<ArrowClockwise24Filled />
									</n-icon>
								</button>
							</div>
						</div>
					</div>
					<!-- Background decorative elements -->
					<div class="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
					<div class="absolute right-20 bottom-10 w-24 h-24 bg-white/5 rounded-full blur-2xl font-bold text-white/5 flex items-center justify-center text-8xl italic pointer-events-none">
						{{ currency }}
					</div>
				</section>

				<!-- Recent Transactions -->
				<section class="space-y-4">
					<div class="flex items-center justify-between px-1">
						<h3 class="text-sm font-bold flex items-center gap-2">
							<n-icon size="20" class="text-gray-400"><List24Filled /></n-icon>
							最近交易流水
						</h3>
						<button class="text-xs text-primary font-medium hover:underline" @click="showBillsDrawer = true">
							完整账单
						</button>
					</div>

					<div class="bg-card-bg border border-border-default rounded-2xl overflow-hidden p-2">
						<n-spin :show="overviewLoading">
							<div v-if="overviewFlowRecords.length > 0" class="divide-y divide-border-default/30">
								<div 
									v-for="record in overviewFlowRecords.slice(0, 10)" 
									:key="recordKey(record)"
									class="transaction-row"
									@click="openDetail(record)"
								>
									<div class="flex items-center gap-4 flex-1">
								<div 
									class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" 
									:class="
										getRecordIconType(record.changeType) === 'reward'
											? 'bg-amber-500/10 text-amber-500'
											: getRecordIconType(record.changeType) === 'transfer'
												? 'bg-cyan-500/10 text-cyan-500'
												: getRecordIconType(record.changeType) === 'vip'
													? 'bg-violet-500/10 text-violet-500'
													: getRecordIconType(record.changeType) === 'inflow'
												? 'bg-emerald-500/10 text-emerald-500'
												: 'bg-orange-500/10 text-orange-500'
									"
								>
									<n-icon size="22">
										<GiftOutline v-if="getRecordIconType(record.changeType) === 'reward'" />
										<SwapHorizontalOutline v-else-if="getRecordIconType(record.changeType) === 'transfer'" />
										<DiamondOutline v-else-if="getRecordIconType(record.changeType) === 'vip'" />
										<ArrowDownLeft24Filled v-else-if="getRecordIconType(record.changeType) === 'inflow'" />
										<ArrowUpRight24Filled v-else />
									</n-icon>
								</div>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-bold truncate">{{ getRecordTypeLabel(record.changeType) }}</p>
											<p class="text-xs text-gray-500 truncate">{{ formatDateTime(record.createdAt) }}</p>
										</div>
									</div>
									<div class="text-right flex flex-col items-end">
										<p 
											class="text-base font-bold number-font"
											:class="isInflowType(record.changeType) ? 'text-emerald-500' : 'text-text-main'"
										>
											{{ isInflowType(record.changeType) ? '+' : '-' }}{{ formatMoney(record.amountCents) }}
										</p>
										<p class="text-[10px] text-gray-400 font-mono">{{ record.businessNo?.slice(-8) || 'No Ref' }}</p>
									</div>
								</div>
							</div>
							<div v-else class="py-16 flex flex-col items-center justify-center text-gray-400">
								<n-icon size="48" class="opacity-20 mb-2">
									<Receipt24Regular />
								</n-icon>
								<p class="text-sm">暂无流水记录</p>
							</div>
						</n-spin>
					</div>
				</section>
			</div>
		</main>

		<!-- Modals -->

		<!-- Recharge Modal -->
		<n-modal v-model:show="showRechargeModal" :mask-closable="false" transform-origin="center">
			<div class="next-wallet-modal w-[400px] flex flex-col">
				<div class="modal-header-gradient">
					<div class="text-white">
						<h3 class="text-xl font-bold mb-1">快速充值</h3>
						<p class="text-white/60 text-xs">可用余额: {{ formattedBalance }}</p>
					</div>
					<button class="close-orb" @click="showRechargeModal = false">
						<n-icon size="20" class="text-white/80"><Dismiss24Regular /></n-icon>
					</button>
				</div>
				
				<div class="p-6 space-y-6">
					<div class="space-y-4">
						<div class="space-y-2">
							<label class="text-xs font-bold text-gray-500 ml-1">充值金额 ({{ currency }})</label>
							<n-input-number
								v-model:value="amount"
								:min="0.01"
								:precision="2"
								placeholder="0.00"
								class="input-premium"
							>
								<template #prefix>
									<span class="text-lg opacity-40 font-bold">$</span>
								</template>
							</n-input-number>
						</div>

						<div class="space-y-2">
							<label class="text-xs font-bold text-gray-500 ml-1">业务单号 (可选)</label>
							<n-input
								v-model:value="businessNo"
								placeholder="输入外部单号"
								class="input-premium"
							/>
						</div>

						<div class="space-y-2">
							<label class="text-xs font-bold text-gray-500 ml-1">备注信息</label>
							<n-input
								v-model:value="remark"
								type="textarea"
								:autosize="{ minRows: 2, maxRows: 4 }"
								placeholder="添加备注内容..."
								class="input-premium"
							/>
						</div>
					</div>

					<div class="flex gap-3">
						<button 
							class="modal-btn-ghost flex-1" 
							@click="showRechargeModal = false"
						>
							取消
						</button>
						<button 
							class="modal-btn-primary flex-1 bg-gradient-brand"
							:loading="actionLoading"
							@click="submitAction"
						>
							确认支付
						</button>
					</div>
				</div>
			</div>
		</n-modal>

		<!-- Full Bills Drawer -->
		<n-drawer
			v-model:show="showBillsDrawer"
			placement="right"
			:width="billsDrawerWidth"
			:to="billsDrawerTo"
			:auto-focus="false"
			class="wallet-bills-drawer"
		>
			<n-drawer-content
				title="全部交易记录"
				closable
				:body-content-style="{ padding: '0' }"
			>
				<WalletBillPanel />
			</n-drawer-content>
		</n-drawer>

		<!-- Transaction Details Modal -->
		<n-modal v-model:show="showDetailModal" transform-origin="center">
			<div class="next-wallet-modal w-[420px] pb-6">
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
					<p class="text-3xl font-bold number-font mt-2" :class="isInflowType(activeRecord?.changeType) ? 'text-emerald-500' : ''">
						{{ isInflowType(activeRecord?.changeType) ? '+' : '-' }}{{ formatMoney(activeRecord?.amountCents || 0) }}
					</p>
					<div 
						class="mt-4 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold"
						:class="isInflowType(activeRecord?.changeType) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'"
					>
						交易成功
					</div>
				</div>

				<div class="px-8 mt-6 space-y-4">
					<div class="detail-item">
						<span class="detail-label">支出账户</span>
						<span class="detail-value">{{ isInflowType(activeRecord?.changeType) ? '外部转入' : walletNo }}</span>
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
						<span class="detail-value font-mono text-[11px] select-all cursor-copy">{{ activeRecord?.businessNo || '---' }}</span>
					</div>
					<div class="pt-4 border-t border-gray-100 dark:border-white/5">
						<span class="detail-label block mb-1">备注</span>
						<p class="text-sm text-gray-500 italic">{{ activeRecord?.remark || '无备注内容' }}</p>
					</div>
				</div>

				<div class="px-8 mt-8">
					<button class="modal-btn-ghost w-full" @click="showDetailModal = false">返回</button>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import {
	NInput,
	NInputNumber,
	NModal,
	NDrawer,
	NDrawerContent,
	NIcon,
	NSpin,
	NTooltip,
	useMessage,
} from 'naive-ui'
import {
	Wallet24Filled,
	ShieldCheckmark24Filled,
	ShieldDismiss24Filled,
	AddCircle24Filled,
	List24Filled,
	ArrowClockwise24Filled,
	ArrowDownLeft24Filled,
	ArrowUpRight24Filled,
	Receipt24Regular,
	Dismiss24Regular,
	Receipt24Filled,
} from '@vicons/fluent'
import { DiamondOutline, GiftOutline, SwapHorizontalOutline } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useWalletStore, type WalletFlowRecord } from '@renderer/stores/wallet'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import WalletBillPanel from './components/WalletBillPanel.vue'

const walletStore = useWalletStore()
const userStore = useUserInfoStore()
const message = useMessage()

const {
	walletNo,
	currency,
	walletStatus,
	securityPasswordSet,
	updatedAt,
	formattedBalance,
	isLoading: walletLoading,
	overviewFlowRecords,
	overviewLoading,
} = storeToRefs(walletStore)

const amount = ref<number | null>(null)
const businessNo = ref('')
const remark = ref('')
const walletViewRoot = ref<HTMLElement | null>(null)
const walletViewWidth = ref(0)
let walletViewResizeObserver: ResizeObserver | null = null
const actionLoading = ref(false)
const showBillsDrawer = ref(false)
const showRechargeModal = ref(false)
const showDetailModal = ref(false)
const activeRecord = ref<WalletFlowRecord | null>(null)

const walletStatusLabel = computed(() => {
	if (walletStatus.value === 'ACTIVE') return '正常使用'
	if (walletStatus.value === 'FROZEN') return '账户冻结'
	if (walletStatus.value) return walletStatus.value
	return '连接中'
})

const walletStatusClass = computed(() => {
	if (walletStatus.value === 'ACTIVE') return 'is-active'
	if (walletStatus.value === 'FROZEN') return 'is-frozen'
	return ''
})

const canTrade = computed(
	() => Boolean(walletNo.value) && walletStatus.value !== 'FROZEN',
)
const billsDrawerWidth = computed(() => {
	const parentWidth = walletViewWidth.value
	if (!parentWidth) return 0
	const target = Math.floor(parentWidth * 0.92)
	const maxAllowed = Math.max(parentWidth - 8, 0)
	return Math.min(1040, target, maxAllowed)
})
const billsDrawerTo = computed(() => walletViewRoot.value ?? undefined)

const walletUpdatedText = computed(() => {
	if (!updatedAt.value) return '未同步'
	const date = new Date(updatedAt.value)
	if (Number.isNaN(date.getTime())) return updatedAt.value
	return date.toLocaleTimeString('zh-CN', { hour12: false })
})

const isInflowType = (
	changeType?:
		| 'RECHARGE'
		| 'REWARD'
		| 'TASK_REWARD'
		| 'CONSUME'
		| 'TRANSFER_OUT'
		| 'TRANSFER_IN'
		| 'VIP_PURCHASE'
		| string,
): boolean =>
	changeType === 'RECHARGE' ||
	changeType === 'REWARD' ||
	changeType === 'TASK_REWARD' ||
	changeType === 'TRANSFER_IN'

const isRewardType = (
	changeType?:
		| 'RECHARGE'
		| 'REWARD'
		| 'TASK_REWARD'
		| 'CONSUME'
		| 'TRANSFER_OUT'
		| 'TRANSFER_IN'
		| 'VIP_PURCHASE'
		| string,
): boolean => changeType === 'REWARD' || changeType === 'TASK_REWARD'

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

const formatDateTime = (value: string): string => {
	if (!value) return '-'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleString('zh-CN', { hour12: false })
}

const refreshWallet = (): void => {
	void walletStore.fetchWallet()
}

const refreshFlows = (): void => {
	void walletStore.refreshOverview()
}

const recordKey = (record: WalletFlowRecord): string =>
	`${record.createdAt}-${record.businessNo}-${record.changeType}-${record.amountCents}`

const openRecharge = (): void => {
	amount.value = null
	businessNo.value = ''
	remark.value = ''
	showRechargeModal.value = true
}

const openDetail = (record: WalletFlowRecord): void => {
	activeRecord.value = record
	showDetailModal.value = true
}

const submitAction = async (): Promise<void> => {
	if (actionLoading.value) return
	if (!canTrade.value) {
		message.warning('钱包不可交易')
		return
	}
	if (!amount.value || amount.value <= 0) {
		message.warning('请输入有效金额')
		return
	}
	const amountCents = Math.round(amount.value * 100)
	actionLoading.value = true
	try {
		await walletStore.recharge({
			amountCents,
			businessNo: businessNo.value,
			remark: remark.value,
		})
		message.success('充值成功')
		showRechargeModal.value = false
		refreshWallet()
		refreshFlows()
	} catch (error: unknown) {
		const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败'
		message.error(errorMessage)
	} finally {
		actionLoading.value = false
	}
}

onMounted(() => {
	walletStore.startAutoRefresh(5000)
	const root = walletViewRoot.value
	if (!root) return
	walletViewWidth.value = root.clientWidth
	walletViewResizeObserver = new ResizeObserver((entries) => {
		const entry = entries[0]
		if (!entry) return
		walletViewWidth.value = entry.contentRect.width
	})
	walletViewResizeObserver.observe(root)
})

onUnmounted(() => {
	walletStore.stopAutoRefresh()
	walletViewResizeObserver?.disconnect()
	walletViewResizeObserver = null
})

watch(
	() => userStore.account,
	(account) => {
		if (!account) return
		void walletStore.refreshOverview()
	},
	{ immediate: true },
)
</script>

<style scoped>
@reference "../../../assets/base.css";

.number-font {
	font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
	font-variant-numeric: tabular-nums;
}

.status-chip {
	@apply flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border;
}

.status-chip.is-set {
	@apply bg-emerald-500/10 text-emerald-600 border-emerald-500/20;
}
.status-chip.is-unset {
	@apply bg-orange-500/10 text-orange-600 border-orange-500/20;
}
.status-chip.is-active {
	@apply bg-blue-500/10 text-blue-600 border-blue-500/20;
}
.status-chip.is-frozen {
	@apply bg-red-500/10 text-red-600 border-red-500/20;
}

.balance-hero {
	@apply h-40 p-4 rounded-[18px] border border-white/10;
	background: linear-gradient(135deg, #3695ff 0%, #1e4de7 100%);
}

.hero-recharge-btn {
	@apply h-9 px-3 rounded-xl bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 hover:bg-white/30 transition-colors;
}
.hero-recharge-btn:disabled {
	@apply opacity-60 cursor-not-allowed hover:bg-white/20;
}

.hero-refresh-btn {
	@apply w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors;
}

.transaction-row {
	@apply flex items-center justify-between p-4 rounded-2xl transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5;
}

.input-premium {
	@apply rounded-xl border-border-default/80;
}

.modal-header-gradient {
	@apply h-28 bg-gradient-to-br from-[#3695ff] to-[#1e4de7] p-6 flex justify-between items-start rounded-t-2xl;
}

.close-orb {
	@apply w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors backdrop-blur-sm;
}

.next-wallet-modal {
	@apply bg-card-bg rounded-[20px] border border-border-default overflow-hidden;
}

.modal-btn-primary {
	@apply h-12 rounded-xl text-white font-bold transition-all active:scale-95;
}
.modal-btn-ghost {
	@apply h-12 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold transition-all active:scale-95;
}

.bg-gradient-brand {
	background: linear-gradient(135deg, #3695ff 0%, #1e4de7 100%);
}

.no-scrollbar::-webkit-scrollbar {
	display: none;
}
.no-scrollbar {
	-ms-overflow-style: none;
	scrollbar-width: none;
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

:deep(.wallet-bills-drawer .n-drawer) {
	box-shadow: none !important;
	border-left: 1px solid var(--color-border-default);
}

:deep(.wallet-bills-drawer .n-drawer-content) {
	box-shadow: none !important;
}

:deep(.wallet-bills-drawer .n-base-close) {
	-webkit-app-region: no-drag;
}
</style>

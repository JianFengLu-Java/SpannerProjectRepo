<template>
	<div class="profile-center-page h-full w-full overflow-y-auto">
		<div class="profile-center-shell mx-auto max-w-[980px] p-4 md:p-5">
			<div class="profile-hero rounded-[24px] p-4 md:p-5">
				<div class="profile-hero-top flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div class="flex items-start gap-4">
						<n-avatar :size="64" round :src="user.avatarUrl" class="hero-avatar" />
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h1 class="text-xl font-semibold tracking-wide text-white/95 truncate">
									{{ user.userName || '尊贵会员' }}
								</h1>
								<span class="rank-chip">{{ memberRankText }}</span>
							</div>
							<p class="mt-1 text-sm text-white/70">账号：{{ user.account || '-' }}</p>
							<p class="mt-1 text-sm text-white/70">{{ vipStatusText }}</p>
						</div>
					</div>
					<n-button
						type="warning"
						round
						size="large"
						class="hero-action-btn"
						@click="openPurchaseModal"
					>
						{{ purchaseButtonText }}
					</n-button>
				</div>

				<div class="hero-metrics mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
					<div class="metric-card">
						<div class="metric-meta">
							<p class="metric-label">会员等级</p>
							<n-icon class="metric-icon" :size="14"><MedalOutline /></n-icon>
						</div>
						<p class="metric-value">Lv.{{ userLevel }}</p>
					</div>
					<div class="metric-card">
						<div class="metric-meta">
							<p class="metric-label">成长值</p>
							<n-icon class="metric-icon" :size="14"><RocketOutline /></n-icon>
						</div>
						<p class="metric-value">{{ growthValue }}</p>
					</div>
					<div class="metric-card">
						<div class="metric-meta">
							<p class="metric-label">距离升级</p>
							<n-icon class="metric-icon" :size="14"><FlashOutline /></n-icon>
						</div>
						<p class="metric-value">{{ growthGapText }}</p>
					</div>
					<div class="metric-card">
						<div class="metric-meta">
							<p class="metric-label">专属身份</p>
							<n-icon class="metric-icon" :size="14"><DiamondOutline /></n-icon>
						</div>
						<p class="metric-value">{{ vipActive ? '已激活' : '未激活' }}</p>
					</div>
				</div>

				<div class="progress-panel mt-3 rounded-2xl p-3">
					<div class="flex items-center justify-between text-sm text-white/80">
						<span>成长进度</span>
						<span>{{ growthValue }}/{{ nextLevelGrowthLabel }}</span>
					</div>
					<n-progress
						class="mt-2"
						type="line"
						:show-indicator="false"
						:percentage="progressPercent"
						:height="7"
					/>
					<p class="mt-1.5 text-xs text-white/70">
						{{ growthHintText }}
					</p>
				</div>
			</div>

			<div class="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
				<div class="flex flex-col gap-4">
					<section class="panel-card rounded-3xl p-4 md:p-5">
						<div class="section-head">
							<div>
								<h2 class="section-title"><n-icon :size="16"><GiftOutline /></n-icon>权益入口</h2>
								<p class="section-sub">围绕身份价值的高频权益快速直达</p>
							</div>
							<n-button quaternary size="small" @click="refreshVipData">刷新</n-button>
						</div>
						<n-spin :show="isVipLoading">
							<div class="mt-3 grid gap-2 sm:grid-cols-2">
								<button
									v-for="entry in privilegeEntries"
									:key="entry.title"
									type="button"
									class="entry-card"
								>
									<div class="entry-head">
										<n-icon :size="15" class="entry-icon"><component :is="entry.icon" /></n-icon>
										<p class="entry-title">{{ entry.title }}</p>
									</div>
									<p class="entry-desc">{{ entry.desc }}</p>
									<span class="entry-tag">{{ entry.tag }}</span>
								</button>
							</div>
						</n-spin>
					</section>

					<section class="panel-card rounded-3xl p-4 md:p-5">
						<div class="section-head">
							<div>
								<h2 class="section-title"><n-icon :size="16"><ShieldCheckmarkOutline /></n-icon>专属服务</h2>
								<p class="section-sub">高等级会员可享的定制化服务与优先保障</p>
							</div>
						</div>
						<div class="mt-3 grid gap-2 sm:grid-cols-2">
							<div
								v-for="service in exclusiveServices"
								:key="service.name"
								class="service-card"
							>
								<div class="service-head">
									<n-icon :size="15" class="service-icon"><component :is="service.icon" /></n-icon>
									<p class="service-name">{{ service.name }}</p>
								</div>
								<p class="service-desc">{{ service.desc }}</p>
								<p class="service-level">{{ service.level }}</p>
							</div>
						</div>
					</section>
				</div>

				<div class="flex flex-col gap-4">
					<section class="panel-card rounded-3xl p-4 md:p-5">
						<div class="section-head">
							<div>
								<h2 class="section-title"><n-icon :size="16"><DiamondOutline /></n-icon>会员计划</h2>
								<p class="section-sub">升级或续费，持续解锁高阶权益</p>
							</div>
						</div>
						<div class="mt-3 space-y-2.5">
							<div class="plan-current">
								<p class="text-xs text-gray-500 dark:text-gray-300">当前套餐</p>
								<p class="mt-1.5 text-base font-semibold text-text-main">{{ selectedPlanLabel }}</p>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-300">{{ selectedPlanDetail }}</p>
							</div>
							<n-button type="primary" size="large" class="w-full" @click="openPurchaseModal">
								{{ purchaseButtonText }}
							</n-button>
						</div>
					</section>

					<section class="panel-card rounded-3xl p-4 md:p-5">
						<div class="section-head">
							<div>
								<h2 class="section-title"><n-icon :size="16"><PersonCircleOutline /></n-icon>个人资料</h2>
								<p class="section-sub">用于身份识别与专属服务触达</p>
							</div>
						</div>
						<div class="profile-info-list mt-2.5 space-y-1.5 text-[13px]">
							<div class="info-row">
								<span><n-icon :size="13"><MailOutline /></n-icon>邮箱</span>
								<span>{{ user.email || '-' }}</span>
							</div>
							<div class="info-row">
								<span><n-icon :size="13"><CallOutline /></n-icon>电话</span>
								<span>{{ user.phone || '-' }}</span>
							</div>
							<div class="info-row">
								<span><n-icon :size="13"><HomeOutline /></n-icon>地址</span>
								<span>{{ user.address || '-' }}</span>
							</div>
							<div class="info-row">
								<span><n-icon :size="13"><MaleFemaleOutline /></n-icon>性别 / 年龄</span>
								<span>{{ genderText }} / {{ ageText }}</span>
							</div>
						</div>
					</section>

					<section class="panel-card rounded-3xl p-4 md:p-5">
						<div class="section-head">
							<div>
								<h2 class="section-title"><n-icon :size="16"><CalendarOutline /></n-icon>最近会员订单</h2>
							</div>
						</div>
						<div v-if="orders.length > 0" class="mt-2.5 divide-y divide-border-default/70">
							<div
								v-for="order in orders.slice(0, 4)"
								:key="order.purchaseNo"
								class="py-2.5 flex items-center justify-between gap-2.5"
							>
								<div class="min-w-0">
									<p class="text-sm font-medium text-text-main truncate">{{ order.planName || order.planCode }}</p>
									<p class="mt-1 text-xs text-gray-500 dark:text-gray-300 truncate">
										{{ formatDate(order.createdAt) }}
									</p>
								</div>
								<div class="text-right shrink-0">
									<p class="text-sm font-semibold text-text-main">￥{{ order.amount.toFixed(2) }}</p>
									<p class="mt-1 text-xs text-amber-600">+{{ order.growthBonus }} 成长值</p>
								</div>
							</div>
						</div>
						<div v-else class="mt-3 text-sm text-gray-500 dark:text-gray-300">暂无会员订单</div>
					</section>
				</div>
			</div>
		</div>

		<n-modal
			v-model:show="showPurchaseModal"
			:mask-closable="!purchaseLoading"
			transform-origin="center"
		>
			<div class="next-transfer-modal w-[min(92vw,560px)] max-h-[90vh] flex flex-col">
				<div class="modal-header-section">
					<div class="flex items-center justify-between w-full mb-4">
						<div
							class="text-sm font-medium text-white/90 px-2 py-1 rounded-lg bg-white/10 border border-white/15"
						>
							{{ selectedPlanLabel }}
						</div>
						<button
							class="close-orb hover:bg-white/10 transition-colors"
							:disabled="purchaseLoading"
							@click="showPurchaseModal = false"
						>
							<span class="text-white/80 text-base leading-none">×</span>
						</button>
					</div>
					<div class="text-white">
						<h3 class="text-xl font-bold mb-1">{{ purchaseButtonText }}</h3>
						<p class="text-white/70 text-xs">选择会员套餐并完成安全支付</p>
					</div>
					<div class="text-xs text-blue-100/90 mt-3">选择套餐并输入钱包安全密码完成支付</div>
				</div>

				<div class="p-6 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto">
					<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
						<button
							v-for="plan in plans"
							:key="plan.planCode"
							type="button"
							class="rounded-2xl border p-4 text-left transition-all"
							:class="
								selectedPlanCode === plan.planCode
									? 'border-[#b4863a] bg-[#fff7e7] dark:bg-[#2f2410]'
									: 'border-border-default bg-page-bg hover:border-[#b4863a]/50'
							"
							@click="selectedPlanCode = plan.planCode"
						>
							<div class="text-sm font-semibold text-text-main">{{ plan.planName }}</div>
							<div class="text-xl font-bold mt-2 text-text-main">￥{{ plan.price.toFixed(2) }}</div>
							<div class="text-xs text-gray-500 mt-1">时长 {{ plan.months }} 个月</div>
							<div class="text-xs text-amber-600 mt-1">赠送成长值 +{{ plan.growthBonus }}</div>
						</button>
					</div>

					<div class="space-y-1 mt-2 w-31">
						<label class="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">安全 PIN 码</label>
						<div class="flex gap-2 justify-between">
							<input
								v-for="(_digit, idx) in pinInputs"
								:key="idx"
								:ref="(el) => (pinRefs[idx] = el as HTMLInputElement)"
								v-model="pinInputs[idx]"
								type="password"
								maxlength="1"
								inputmode="numeric"
								class="pin-box"
								:class="{ 'has-value': pinInputs[idx] }"
								@input="handlePinInput(idx, $event)"
								@keydown="handlePinKeyDown(idx, $event)"
								@paste="handlePinPaste"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3 mt-5">
						<button class="modal-btn-ghost" :disabled="purchaseLoading" @click="showPurchaseModal = false">
							取消
						</button>
						<button class="modal-btn-primary" :disabled="purchaseLoading" @click="handlePurchase">
							{{ purchaseLoading ? '正在处理...' : '确认支付' }}
						</button>
					</div>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	NAvatar,
	NButton,
	NIcon,
	NModal,
	NProgress,
	NSpin,
	useMessage,
} from 'naive-ui'
import {
	CalendarOutline,
	CallOutline,
	DiamondOutline,
	FlashOutline,
	GiftOutline,
	HomeOutline,
	MaleFemaleOutline,
	MailOutline,
	MedalOutline,
	PersonCircleOutline,
	RocketOutline,
	RibbonOutline,
	ShieldCheckmarkOutline,
	StarOutline,
} from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useVipStore } from '@renderer/stores/vip'

const user = useUserInfoStore()
const vipStore = useVipStore()
const message = useMessage()

const {
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
	ordersLoading,
	purchaseLoading,
	orders,
} = storeToRefs(vipStore)

const selectedPlanCode = ref<'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string>('MONTHLY')
const securityPassword = ref('')
const pinInputs = ref<string[]>(['', '', '', '', '', ''])
const pinRefs = ref<Array<HTMLInputElement | null>>([null, null, null, null, null, null])
const purchaseNo = ref('')
const showPurchaseModal = ref(false)

const isVipLoading = computed(() => profileLoading.value || plansLoading.value || ordersLoading.value)

const genderText = computed(() => {
	if (user.gender === 'male') return '男'
	if (user.gender === 'female') return '女'
	return '未知'
})

const ageText = computed(() => {
	if (typeof user.age === 'number' && Number.isFinite(user.age)) {
		return `${Math.max(0, Math.floor(user.age))}`
	}
	return '-'
})

const vipExpireText = computed(() => {
	if (!vipExpireAt.value) return '未开通'
	const date = new Date(vipExpireAt.value)
	if (Number.isNaN(date.getTime())) return vipExpireAt.value
	return date.toLocaleString('zh-CN', { hour12: false })
})

const vipStatusText = computed(() =>
	vipActive.value ? `会员有效期至 ${vipExpireText.value}` : '您当前为普通用户，开通后可享专属权益',
)

const memberRankText = computed(() => {
	if (!vipActive.value) return '普通身份'
	if (userLevel.value >= 9) return '黑金会员'
	if (userLevel.value >= 7) return '铂金会员'
	if (userLevel.value >= 4) return '黄金会员'
	return '尊享会员'
})

const growthGapText = computed(() => (growthGap.value > 0 ? `${growthGap.value}` : '已满级'))

const growthHintText = computed(() => {
	if (growthGap.value <= 0) return '您已达到当前成长体系上限，更多权益持续开放中'
	return `再获得 ${growthGap.value} 成长值可升级并解锁更高阶会员权益`
})

const nextLevelGrowthLabel = computed(() => (nextLevelGrowth.value > 0 ? nextLevelGrowth.value : 'MAX'))

const purchaseButtonText = computed(() => (vipActive.value ? '立即续费会员' : '立即开通会员'))

const selectedPlan = computed(() => plans.value.find((item) => item.planCode === selectedPlanCode.value))

const selectedPlanLabel = computed(() => selectedPlan.value?.planName || '暂无可用套餐')

const selectedPlanDetail = computed(() => {
	if (!selectedPlan.value) return '请先刷新会员数据'
	return `￥${selectedPlan.value.price.toFixed(2)} / ${selectedPlan.value.months}个月，赠送成长值 +${selectedPlan.value.growthBonus}`
})

const privilegeEntries = computed(() => [
	{
		title: '权益手册',
		desc: '查看当前等级可用权益与解锁条件',
		tag: `Lv.${userLevel.value} 权益`,
		icon: StarOutline,
	},
	{
		title: '成长任务',
		desc: '完成任务获得成长值，快速提升会员等级',
		tag: `待升 ${growthGapText.value}`,
		icon: RocketOutline,
	},
	{
		title: '会员商城',
		desc: '专属价格与限时礼遇，仅会员可见',
		tag: vipActive.value ? '已解锁' : '开通解锁',
		icon: DiamondOutline,
	},
	{
		title: '权益兑换',
		desc: '使用成长值兑换礼品、券包与服务时长',
		tag: `可用 ${growthValue.value}`,
		icon: GiftOutline,
	},
])

const exclusiveServices = computed(() => [
	{
		name: '专属客服通道',
		desc: '7x24 快速响应，优先处理会员问题',
		level: vipActive.value ? '当前可用' : '开通后可用',
		icon: CallOutline,
	},
	{
		name: '一对一成长顾问',
		desc: '根据活跃行为定制升级建议与权益策略',
		level: userLevel.value >= 4 ? 'Lv.4+ 已解锁' : 'Lv.4 解锁',
		icon: RibbonOutline,
	},
	{
		name: '生日专享礼遇',
		desc: '会员月发放定制礼包与限定权益',
		level: vipActive.value ? '当前可用' : '开通后可用',
		icon: GiftOutline,
	},
	{
		name: '尊贵身份标识',
		desc: '展示高阶会员身份，提升社交信任感',
		level: userLevel.value >= 7 ? '高阶标识已生效' : 'Lv.7 解锁高阶标识',
		icon: MedalOutline,
	},
])

const formatDate = (value: string): string => {
	if (!value) return '-'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleString('zh-CN', { hour12: false })
}

const refreshVipData = async (): Promise<void> => {
	if (!user.account) return
	try {
		await vipStore.refreshAll()
		const defaultPlan = plans.value[0]
		if (defaultPlan?.planCode) {
			selectedPlanCode.value = defaultPlan.planCode
		}
	} catch (error) {
		console.error('刷新会员数据失败', error)
	}
}

const handlePurchase = async (): Promise<void> => {
	if (!selectedPlanCode.value) {
		message.warning('请选择会员套餐')
		return
	}
	if (!/^\d{6}$/.test(securityPassword.value.trim())) {
		message.warning('请输入6位安全密码')
		return
	}
	try {
		await vipStore.purchase({
			planCode: selectedPlanCode.value,
			securityPassword: securityPassword.value,
			purchaseNo: purchaseNo.value,
		})
		message.success('会员购买成功')
		securityPassword.value = ''
		purchaseNo.value = ''
		showPurchaseModal.value = false
	} catch (error: unknown) {
		const errorMessage =
			(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
			'会员购买失败'
		message.error(errorMessage)
	}
}

const syncSecurityPassword = (): void => {
	securityPassword.value = pinInputs.value.join('')
}

const focusPinInput = (index: number): void => {
	const target = pinRefs.value[index]
	if (!target) return
	target.focus()
	target.select()
}

const handlePinInput = (index: number, event: Event): void => {
	const target = event.target as HTMLInputElement
	const digit = (target.value || '').replace(/\D/g, '').slice(-1)
	pinInputs.value[index] = digit
	syncSecurityPassword()
	if (digit && index < pinInputs.value.length - 1) {
		focusPinInput(index + 1)
	}
}

const handlePinKeyDown = (index: number, event: KeyboardEvent): void => {
	if (event.key === 'Backspace' && !pinInputs.value[index] && index > 0) {
		pinInputs.value[index - 1] = ''
		syncSecurityPassword()
		focusPinInput(index - 1)
	}
}

const handlePinPaste = (event: ClipboardEvent): void => {
	const text = event.clipboardData?.getData('text') || ''
	const digits = text
		.replace(/\D/g, '')
		.slice(0, pinInputs.value.length)
		.split('')
	if (!digits.length) return
	event.preventDefault()
	pinInputs.value = pinInputs.value.map((_, index) => digits[index] || '')
	syncSecurityPassword()
	const nextIndex = Math.min(digits.length, pinInputs.value.length - 1)
	focusPinInput(nextIndex)
}

const openPurchaseModal = (): void => {
	if (!plans.value.length) {
		message.warning('暂无可购买套餐，请先刷新')
		return
	}
	if (!selectedPlan.value) {
		selectedPlanCode.value = plans.value[0].planCode
	}
	securityPassword.value = ''
	pinInputs.value = ['', '', '', '', '', '']
	purchaseNo.value = ''
	showPurchaseModal.value = true
	setTimeout(() => {
		focusPinInput(0)
	}, 0)
}

watch(
	() => user.account,
	(account) => {
		if (!account) {
			vipStore.reset()
			return
		}
		void refreshVipData()
	},
	{ immediate: true },
)
</script>

<style scoped>
.profile-center-page {
	position: relative;
	background:
		radial-gradient(circle at 8% 2%, rgba(190, 151, 70, 0.26) 0%, rgba(190, 151, 70, 0) 44%),
		radial-gradient(circle at 91% 14%, rgba(116, 96, 56, 0.24) 0%, rgba(116, 96, 56, 0) 52%),
		linear-gradient(180deg, #f7f3eb 0%, #f4efe4 46%, #f8f6f1 100%);
}

.dark .profile-center-page {
	background:
		radial-gradient(circle at 10% 0%, rgba(186, 145, 57, 0.28) 0%, rgba(186, 145, 57, 0) 48%),
		radial-gradient(circle at 88% 14%, rgba(138, 108, 55, 0.26) 0%, rgba(138, 108, 55, 0) 58%),
		linear-gradient(180deg, #16130e 0%, #1b1710 50%, #181511 100%);
}

.profile-hero {
	position: relative;
	overflow: hidden;
	border: 1px solid rgba(211, 174, 103, 0.35);
	background:
		radial-gradient(circle at 83% 8%, rgba(255, 232, 175, 0.22), transparent 45%),
		linear-gradient(120deg, #302413 0%, #44321d 28%, #5b4425 58%, #2b2011 100%);
	box-shadow:
		0 16px 36px rgba(50, 33, 11, 0.24),
		inset 0 1px 0 rgba(255, 230, 164, 0.26);
}

.profile-hero::after {
	content: '';
	position: absolute;
	right: -80px;
	top: -60px;
	width: 240px;
	height: 240px;
	border-radius: 999px;
	background: radial-gradient(circle, rgba(255, 229, 165, 0.22), transparent 66%);
	pointer-events: none;
}

.hero-avatar {
	border: 2px solid rgba(255, 230, 175, 0.56);
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.24);
}

.rank-chip {
	display: inline-flex;
	align-items: center;
	height: 24px;
	padding: 0 10px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 600;
	color: #fdf2cf;
	background: rgba(255, 226, 156, 0.16);
	border: 1px solid rgba(255, 226, 156, 0.28);
}

.hero-action-btn {
	min-width: 132px;
	background: linear-gradient(135deg, #f7d79a 0%, #ddb163 100%);
	border: none;
	color: #452f0d;
	font-weight: 700;
}

.metric-card {
	border-radius: 16px;
	padding: 10px;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 236, 197, 0.17);
}

.metric-meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.metric-icon {
	color: rgba(255, 239, 206, 0.82);
}

.metric-label {
	font-size: 12px;
	color: rgba(255, 239, 206, 0.72);
}

.metric-value {
	margin-top: 4px;
	font-size: 17px;
	font-weight: 700;
	color: #fff7e5;
}

.progress-panel {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 239, 201, 0.18);
}

.progress-panel :deep(.n-progress-graph-line-rail) {
	background-color: rgba(255, 255, 255, 0.22);
}

.progress-panel :deep(.n-progress-graph-line-fill) {
	background: linear-gradient(90deg, #fff36a 0%, #ffd400 100%);
	box-shadow: 0 0 12px rgba(255, 222, 0, 0.45);
}

.panel-card {
	border: 1px solid rgba(196, 165, 102, 0.2);
	background: rgba(255, 255, 255, 0.74);
	backdrop-filter: blur(12px);
	box-shadow:
		0 10px 24px rgba(69, 49, 18, 0.09),
		inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.dark .panel-card {
	background: rgba(33, 26, 19, 0.72);
	border-color: rgba(187, 145, 72, 0.24);
	box-shadow:
		0 12px 24px rgba(0, 0, 0, 0.32),
		inset 0 1px 0 rgba(255, 223, 170, 0.1);
}

.section-head {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	align-items: flex-start;
}

.section-title {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 16px;
	font-weight: 700;
	color: var(--text-main-color);
}

.section-sub {
	margin-top: 2px;
	font-size: 12px;
	color: rgba(89, 75, 53, 0.68);
}

.dark .section-sub {
	color: rgba(220, 205, 178, 0.64);
}

.entry-card {
	position: relative;
	border-radius: 16px;
	padding: 12px;
	text-align: left;
	background: linear-gradient(135deg, rgba(255, 245, 222, 0.86) 0%, rgba(247, 235, 207, 0.86) 100%);
	border: 1px solid rgba(203, 170, 109, 0.3);
	transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.entry-card:hover {
	transform: translateY(-2px);
	box-shadow: 0 8px 18px rgba(146, 104, 36, 0.14);
}

.dark .entry-card {
	background: linear-gradient(135deg, rgba(56, 42, 25, 0.78) 0%, rgba(71, 53, 30, 0.78) 100%);
	border-color: rgba(200, 157, 85, 0.28);
}

.entry-title {
	font-size: 14px;
	font-weight: 600;
	color: #5f441e;
}

.entry-head {
	display: flex;
	align-items: center;
	gap: 6px;
}

.entry-icon {
	color: #86612b;
}

.dark .entry-title {
	color: #f4dba8;
}

.entry-desc {
	margin-top: 4px;
	font-size: 12px;
	line-height: 1.45;
	color: rgba(93, 71, 37, 0.8);
}

.dark .entry-desc {
	color: rgba(248, 229, 191, 0.74);
}

.entry-tag {
	display: inline-flex;
	margin-top: 8px;
	padding: 2px 8px;
	font-size: 11px;
	border-radius: 999px;
	color: #5f451d;
	background: rgba(255, 234, 189, 0.72);
}

.dark .entry-tag {
	color: #f4dca9;
	background: rgba(140, 107, 53, 0.44);
}

.service-card {
	border-radius: 16px;
	padding: 12px;
	background: rgba(251, 246, 235, 0.92);
	border: 1px solid rgba(210, 181, 124, 0.28);
}

.dark .service-card {
	background: rgba(42, 33, 24, 0.88);
	border-color: rgba(198, 153, 77, 0.24);
}

.service-name {
	font-size: 14px;
	font-weight: 600;
	color: var(--text-main-color);
}

.service-head {
	display: flex;
	align-items: center;
	gap: 6px;
}

.service-icon {
	color: #8e672f;
}

.service-desc {
	margin-top: 4px;
	font-size: 12px;
	line-height: 1.45;
	color: rgba(98, 80, 53, 0.78);
}

.dark .service-desc {
	color: rgba(222, 201, 165, 0.72);
}

.service-level {
	margin-top: 8px;
	font-size: 11px;
	color: #9a702b;
}

.plan-current {
	border-radius: 14px;
	padding: 12px;
	border: 1px solid rgba(197, 159, 85, 0.25);
	background: rgba(255, 255, 255, 0.78);
}

.dark .plan-current {
	background: rgba(28, 22, 16, 0.76);
	border-color: rgba(190, 146, 69, 0.3);
}

.info-row {
	display: flex;
	justify-content: space-between;
	gap: 10px;
	padding: 6px 0;
	border-bottom: 1px dashed rgba(186, 155, 101, 0.22);
	line-height: 1.2;
}

.info-row:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.info-row span:first-child {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: rgba(119, 100, 71, 0.82);
}

.info-row span:last-child {
	color: var(--text-main-color);
	text-align: right;
	max-width: 65%;
	font-size: 12px;
	word-break: break-word;
}

.profile-info-list :deep(.n-icon) {
	transform: scale(0.92);
}

.next-transfer-modal {
	border-radius: 32px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
	box-shadow: none;
}

.modal-header-section {
	padding: 14px 14px;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #6a4c21 0%, #8f6730 100%);
}

.close-orb {
	width: 32px;
	height: 32px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pin-box {
	width: 48px;
	height: 56px;
	border-radius: 14px;
	background: #f4f4f5;
	border: 2px solid transparent;
	text-align: center;
	font-size: 24px;
	font-weight: bold;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	outline: none;
}

.dark .pin-box {
	background: #27272a;
	color: white;
}

.pin-box:focus {
	border-color: #9a702b;
	background: white;
	transform: translateY(-2px);
}

.dark .pin-box:focus {
	background: #18181b;
}

.pin-box.has-value {
	border-color: #9a702b;
	background: white;
}

.dark .pin-box.has-value {
	background: #18181b;
}

.modal-btn-primary {
	height: 48px;
	border-radius: 14px;
	font-size: 13px;
	font-weight: 700;
	color: #fff;
	background: linear-gradient(135deg, #8f6730 0%, #6a4c21 100%);
	transition: all 0.18s ease;
}

.modal-btn-primary:hover:not(:disabled) {
	filter: brightness(1.03);
}

.modal-btn-primary:active:not(:disabled) {
	transform: translateY(0);
}

.modal-btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.modal-btn-ghost {
	height: 48px;
	border-radius: 14px;
	font-size: 13px;
	font-weight: 700;
	color: #606266;
	background: #f4f4f5;
	transition: all 0.18s ease;
}

.dark .modal-btn-ghost {
	color: #c9ccd4;
	background: #27272a;
}

@media (max-width: 768px) {
	.profile-center-shell {
		padding: 12px;
	}

	.metric-card {
		padding: 9px;
	}

	.metric-value {
		font-size: 16px;
	}
}
</style>

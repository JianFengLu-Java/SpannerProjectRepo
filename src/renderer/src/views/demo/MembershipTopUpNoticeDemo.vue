<script setup lang="ts">
import MembershipTopUpNoticeCard, {
	type MembershipNoticeStatus,
} from '@renderer/components/membershipNotice/MembershipTopUpNoticeCard.vue'

interface MembershipTopUpNoticeItem {
	id: string
	status: MembershipNoticeStatus
	amount: number
	currency: string
	durationDays: number
	levelBefore: string
	levelAfter: string
	paidAt: string
	orderId: string
	payMethod: string
}

const mockNotices: MembershipTopUpNoticeItem[] = [
	{
		id: 'notice_success_01',
		status: 'success',
		amount: 88,
		currency: '¥',
		durationDays: 30,
		levelBefore: '白银会员',
		levelAfter: '黄金会员',
		paidAt: '2026-02-19 10:36',
		orderId: 'VIP202602190001998877',
		payMethod: '微信支付',
	},
	{
		id: 'notice_processing_01',
		status: 'processing',
		amount: 218,
		currency: '¥',
		durationDays: 365,
		levelBefore: '黄金会员',
		levelAfter: '铂金会员',
		paidAt: '2026-02-19 11:05',
		orderId: 'VIP202602190001998878',
		payMethod: 'Apple Pay',
	},
	{
		id: 'notice_failed_01',
		status: 'failed',
		amount: 58,
		currency: '¥',
		durationDays: 90,
		levelBefore: '白银会员',
		levelAfter: '黄金会员',
		paidAt: '2026-02-19 11:16',
		orderId: 'VIP202602190001998879',
		payMethod: '支付宝',
	},
]

const handleViewBenefits = (orderId: string): void => {
	window.alert(`查看会员权益：${orderId}`)
}

const handleViewOrder = (orderId: string): void => {
	window.alert(`查看订单详情：${orderId}`)
}

const handleRetryPay = (orderId: string): void => {
	window.alert(`重新支付：${orderId}`)
}

const handleContactSupport = (orderId: string): void => {
	window.alert(`联系客服：${orderId}`)
}
</script>

<template>
	<main
		class="min-h-screen bg-[radial-gradient(circle_at_top,#fff7dd_0%,#fffdf5_52%,#f8fafc_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top,#2b2419_0%,#16120c_55%,#0f172a_100%)] dark:text-slate-100"
	>
		<section class="mx-auto w-full max-w-[430px]">
			<h1 class="text-base font-semibold tracking-tight">
				会员充值到账通知 Demo
			</h1>
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
				用于 IM / 通知流 / 站内信的移动端消息卡片
			</p>

			<div class="mt-4 space-y-4">
				<MembershipTopUpNoticeCard
					v-for="item in mockNotices"
					:key="item.id"
					:status="item.status"
					:amount="item.amount"
					:currency="item.currency"
					:duration-days="item.durationDays"
					:level-before="item.levelBefore"
					:level-after="item.levelAfter"
					:paid-at="item.paidAt"
					:order-id="item.orderId"
					:pay-method="item.payMethod"
					:on-view-benefits="() => handleViewBenefits(item.orderId)"
					:on-view-order="() => handleViewOrder(item.orderId)"
					:on-retry-pay="() => handleRetryPay(item.orderId)"
					:on-contact-support="
						() => handleContactSupport(item.orderId)
					"
				/>
			</div>
		</section>
	</main>
</template>

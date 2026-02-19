<template>
	<div
		ref="messageRootRef"
		class="flex w-full mt-1 message-root"
		:class="[
			isMe ? 'flex-row-reverse' : 'flex-row',
			hasResult ? 'has-result-tip' : '',
		]"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0 avatar-no-select" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
			@contextmenu="handleContextMenu"
		>
			<div
				v-if="senderName && !isMe"
				class="px-1 mb-0.5 text-[11px] avatar-no-select flex items-center gap-1"
			>
				<span :class="senderIsVip ? 'text-red-500' : 'text-gray-500'">{{
					senderName
				}}</span>
				<img
					v-if="senderIsVip"
					:src="vipBadgeIcon"
					alt="VIP"
					class="h-4 w-4 block vip-fill-red"
				/>
			</div>
			<div
				class="message-bubble-row"
				:class="isMe ? 'justify-end' : 'justify-start'"
			>
				<n-tooltip
					v-if="isMe && deliveryStatus === 'failed'"
					placement="top"
					trigger="hover"
				>
					<template #trigger>
						<button
							type="button"
							class="bubble-failed-badge avatar-no-select"
							aria-label="发送失败"
						>
							!
						</button>
					</template>
					{{ result || '发送失败' }}
				</n-tooltip>

				<div
					v-if="shouldRenderVipNoticeCard"
					class="notice-card notice-card-vip avatar-no-select"
					>
						<div class="notice-card-head">
								<span class="notice-card-badge">
									<img
										:src="vipBadgeIcon"
										alt="VIP"
										class="h-4 w-4 block vip-fill-red"
									/>
								</span>
							<span class="notice-card-title">
								{{ noticeTitle || '会员通知' }}
							</span>
						</div>
					<div class="notice-card-body">
						<p
							v-for="(line, index) in noticeDetailLines"
							:key="`${index}-${line}`"
							class="notice-card-line"
						>
							{{ line }}
						</p>
					</div>
				</div>

				<div
					v-else-if="shouldRenderSystemNoticeCard"
					class="notice-card notice-card-system avatar-no-select"
				>
					<div class="notice-card-head">
						<span class="notice-card-badge">系统</span>
						<span class="notice-card-title">
							{{ noticeTitle || '系统通知' }}
						</span>
					</div>
					<div class="notice-card-body">
						<p
							v-for="(line, index) in noticeDetailLines"
							:key="`${index}-${line}`"
							class="notice-card-line"
						>
							{{ line }}
						</p>
					</div>
				</div>

				<div
					v-else-if="isTransferCard"
					class="transfer-card avatar-no-select"
					:class="[
						isMe ? 'transfer-card-me' : 'transfer-card-other',
						(canAcceptTransfer &&
							transferFooterText === '点击收款') ||
						transferFooterText === '已收款' ||
						transferFooterText === '已退还'
							? 'transfer-card-clickable'
							: '',
						`transfer-card-state-${transferVisualState}`,
					]"
					@click="handleTransferCardClick"
				>
					<div class="transfer-card-content">
						<div class="transfer-card-main">
							<div class="transfer-card-title">
								{{ transferTitleText }}
							</div>
							<div class="transfer-card-amount">
								{{ transferAmountText || '金额待确认' }}
							</div>
						</div>
						<div class="transfer-card-status-icon">
							<n-icon
								v-if="transferVisualState === 'pending'"
								size="44"
							>
								<Money24Filled />
							</n-icon>
							<n-icon
								v-else-if="
									transferVisualState === 'accepted' ||
									transferVisualState === 'receipt'
								"
								size="44"
							>
								<CheckmarkCircle24Filled />
							</n-icon>
							<n-icon v-else size="44">
								<ArrowReply24Filled />
							</n-icon>
						</div>
					</div>
					<div
						class="transfer-card-footer"
						:class="transferFooterClass"
					>
						<span class="truncate mr-2">{{
							transferFooterText
						}}</span>
						<span
							v-if="transferRemarkText"
							class="opacity-60 truncate font-normal"
							:title="transferRemarkText"
						>
							{{ transferRemarkText }}
						</span>
					</div>
				</div>

				<div
					v-else-if="isOnlyImage"
					class="msg-content-selectable"
					@click="handleClickEvent"
					v-html="content"
				/>

				<div
					v-else
					class="rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit chat-bubble"
					:class="
						isMe
							? 'chat-bubble-me px-3 py-2'
							: 'chat-bubble-other px-3 py-2'
					"
					@click="handleClickEvent"
				>
					<div class="msg-content-selectable" v-html="content"></div>
				</div>
			</div>

			<div class="flex items-center gap-1 px-1 avatar-no-select">
				<span class="text-[10px] text-gray-400">{{ time }}</span>
			</div>

			<div v-if="hasResult" class="bubble-result-tip avatar-no-select">
				<span class="bubble-result-dot" aria-hidden="true"></span>
				<span class="truncate">{{ result || '消息异常' }}</span>
			</div>
		</div>
	</div>

	<!-- 确认收款弹窗 (NextUI 风格) -->
	<n-modal
		v-model:show="showConfirmModal"
		:mask-closable="false"
		transform-origin="center"
	>
		<div
			class="transfer-modal-content w-[360px] max-h-[90vh] flex flex-col"
		>
			<div class="modal-header-gradient">
				<div class="header-text text-white">确认收款</div>
			</div>

			<div
				class="p-6 bg-white dark:bg-zinc-900 flex flex-col items-center flex-1 overflow-y-auto custom-scrollbar"
			>
				<div
					class="amount-large text-text-main font-bold tracking-tight mb-1"
				>
					{{ transferAmountText || '￥0.00' }}
				</div>
				<div
					class="text-xs text-gray-400 mb-6 px-4 py-1 bg-gray-50 dark:bg-white/5 rounded-full"
				>
					来自 {{ senderName || '对方' }}
				</div>

				<div class="w-full space-y-4 mb-8">
					<div class="detail-item">
						<span class="detail-label">交易号</span>
						<span class="detail-value truncate">
							{{ transferBusinessNo }}
						</span>
					</div>
					<div v-if="transferRemarkText" class="detail-item">
						<span class="detail-label">备注</span>
						<span class="detail-value">
							{{ transferRemarkText }}
						</span>
					</div>
				</div>

				<div
					class="safe-tip flex items-center gap-2 text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 rounded-xl text-[11px] mb-8 w-full"
				>
					<n-icon size="14">
						<ShieldCheckmark24Regular />
					</n-icon>
					<span>确认收钱后，资金将直接存入余额</span>
				</div>

				<div class="grid grid-cols-2 gap-3 w-full">
					<button
						class="modal-btn-secondary hover:bg-gray-100 dark:hover:bg-white/5"
						@click="showConfirmModal = false"
					>
						取消
					</button>
					<button
						class="modal-btn-primary"
						:disabled="isAccepting"
						@click="handleConfirmAccept"
					>
						<span v-if="!isAccepting">确认收钱</span>
						<n-spin v-else size="small" stroke="#fff" />
					</button>
				</div>
			</div>
		</div>
	</n-modal>

	<!-- 转账详情弹窗 (NextUI 风格) -->
	<n-modal v-model:show="showDetailModal" transform-origin="center">
		<div
			class="transfer-modal-content w-[360px] max-h-[90vh] flex flex-col"
		>
			<div class="modal-header-gradient">
				<div class="header-text text-white">交易单据</div>
			</div>

			<div
				class="p-6 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto custom-scrollbar"
			>
				<div class="flex flex-col items-center mb-8">
					<div
						class="amount-large text-text-main font-bold tracking-tight mb-1"
					>
						{{ transferAmountText || '￥0.00' }}
					</div>
					<div class="status-badge" :class="transferVisualState">
						{{ transferFooterText }}
					</div>
				</div>

				<div class="w-full space-y-4 mb-4">
					<div class="detail-item">
						<span class="detail-label">交易流程</span>
						<span class="detail-value">{{
							isMe ? '发出转账' : '收到转账'
						}}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">交易号</span>
						<span
							class="detail-value text-[10px] select-all opacity-80"
						>
							{{ transferBusinessNo }}
						</span>
					</div>
					<div v-if="transferConfirmTimeText" class="detail-item">
						<span class="detail-label">成交时间</span>
						<span class="detail-value">{{
							transferConfirmTimeText
						}}</span>
					</div>
					<div
						class="detail-item border-t border-gray-50 dark:border-white/5 pt-4"
					>
						<span class="detail-label">备注内容</span>
						<span class="detail-value text-gray-400 italic">
							{{ transferRemarkText || '无备注' }}
						</span>
					</div>
				</div>

				<div class="mt-8">
					<button
						class="modal-btn-ghost w-full"
						@click="showDetailModal = false"
					>
						返回聊天
					</button>
				</div>
			</div>
		</div>
	</n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'
import {
	ShieldCheckmark24Regular,
	Money24Filled,
	CheckmarkCircle24Filled,
	ArrowReply24Filled,
} from '@vicons/fluent'
import vipBadgeIcon from '@renderer/assets/vip-fill-svgrepo-com.svg'
import { NModal, NIcon, NSpin, useMessage } from 'naive-ui'
import { useWalletStore } from '@renderer/stores/wallet'
import { useChatStore } from '@renderer/stores/chat'

const walletStore = useWalletStore()
const chatStore = useChatStore()
const message = useMessage()

const props = defineProps<{
	content: string
	messageType?: 'text' | 'image' | 'file' | 'transfer'
	transferStatus?: 'pending' | 'accepting' | 'accepted' | 'refunded'
	transferTargetName?: string
	senderName?: string
	senderIsVip?: boolean
	isMe: boolean
	avatar?: string
	time: string
	hasResult?: boolean
	result?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	isSystemChat?: boolean
	isVipNotice?: boolean
}>()
const messageRootRef = ref<HTMLElement | null>(null)

const showConfirmModal = ref(false)
const showDetailModal = ref(false)
const isAccepting = ref(false)

const normalizeNoticeText = (content: string): string => {
	return content
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/\r/g, '')
		.trim()
}

const noticeText = computed(() => normalizeNoticeText(props.content || ''))

const noticeLines = computed(() =>
	noticeText.value
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => !!line),
)

const noticeTitle = computed(() => noticeLines.value[0] || '')

const noticeDetailLines = computed(() => {
	if (noticeLines.value.length <= 1) return []
	return noticeLines.value.slice(1)
})

const shouldRenderSystemNoticeCard = computed(
	() => !!props.isSystemChat && !props.isMe && !props.isVipNotice,
)

const shouldRenderVipNoticeCard = computed(
	() => !!props.isSystemChat && !props.isMe && !!props.isVipNotice,
)

const emit = defineEmits<{
	(e: 'image-loaded'): void
	(
		e: 'contextmenu',
		ev: MouseEvent,
		type: 'text' | 'image',
		extra?: { text?: string; src?: string },
	): void
}>()

const handleContextMenu = (e: MouseEvent): void => {
	const target = e.target as HTMLElement
	const selection = window.getSelection()?.toString()

	if (target.tagName === 'IMG') {
		// 图片右键：阻止默认并传出 src
		e.preventDefault()
		emit('contextmenu', e, 'image', {
			src: (target as HTMLImageElement).src,
		})
	} else if (selection && selection.trim().length > 0) {
		// 选中文字右键：此时不 preventDefault，允许系统原生的全选/复制操作，
		// 或者你也可以 preventDefault 使用自定义菜单
		emit('contextmenu', e, 'text', { text: selection })
	} else {
		// 空白气泡处右键
		emit('contextmenu', e, 'text')
	}
}

const parseTransferField = (
	content: string,
	fieldName: '金额' | '交易号' | '备注' | '确认时间',
): string => {
	const pattern = new RegExp(`${fieldName}\\s*[：:]\\s*([^<\\n]+)`, 'i')
	const matched = content.match(pattern)
	if (!matched) return ''
	return matched[1]?.trim() || ''
}

const parseTransferBusinessNo = (content: string): string => {
	const dataMatched = content.match(
		/data-business-no\s*=\s*["']([^"']+)["']/i,
	)
	if (dataMatched?.[1]?.trim()) return dataMatched[1].trim()
	return parseTransferField(content, '交易号')
}

const hasTransferMarker = computed(() =>
	/\bchat-transfer-card\b/i.test(props.content),
)
const hasTransferReceiptMarker = computed(() =>
	/\bchat-transfer-receipt-card\b/i.test(props.content),
)
const hasTransferRefundMarker = computed(() =>
	/\bchat-transfer-refund-card\b/i.test(props.content),
)

const transferAmountText = computed(() => {
	return parseTransferField(props.content, '金额')
})

const transferBusinessNo = computed(() => {
	return parseTransferBusinessNo(props.content)
})

const transferRemarkText = computed(() => {
	return parseTransferField(props.content, '备注')
})

const transferConfirmTimeText = computed(() => {
	return parseTransferField(props.content, '确认时间')
})

const isTransferCard = computed(() => {
	return (
		props.messageType === 'transfer' ||
		hasTransferMarker.value ||
		hasTransferReceiptMarker.value ||
		hasTransferRefundMarker.value
	)
})

const canAcceptTransfer = computed(() => {
	return (
		isTransferCard.value &&
		!hasTransferReceiptMarker.value &&
		!hasTransferRefundMarker.value &&
		!props.isMe &&
		!!transferBusinessNo.value
	)
})

const transferStatusValue = computed<
	'pending' | 'accepting' | 'accepted' | 'refunded'
>(() => {
	return props.transferStatus || 'pending'
})

const transferTargetLabel = computed(() => {
	const name = props.transferTargetName?.trim() || '对方'
	return name.length > 10 ? `${name.slice(0, 10)}...` : name
})

const transferFooterText = computed(() => {
	if (hasTransferRefundMarker.value) return '已退还'
	if (hasTransferReceiptMarker.value) return '已收款'
	if (transferStatusValue.value === 'refunded') return '已退还'
	if (transferStatusValue.value === 'accepted') return '已收款'
	if (props.isMe) return `转账给${transferTargetLabel.value}`
	if (!canAcceptTransfer.value) return '转账消息'
	return '点击收款'
})

const transferFooterClass = computed(() => {
	if (hasTransferRefundMarker.value) return 'is-refunded'
	if (hasTransferReceiptMarker.value) return 'is-receipt'
	if (transferStatusValue.value === 'refunded') return 'is-refunded'
	if (props.isMe) return 'is-me'
	if (transferStatusValue.value === 'accepted') return 'is-accepted'
	return 'is-pending'
})

const transferVisualState = computed<
	'pending' | 'accepted' | 'receipt' | 'refunded'
>(() => {
	if (hasTransferRefundMarker.value) return 'refunded'
	if (hasTransferReceiptMarker.value) return 'receipt'
	if (transferStatusValue.value === 'refunded') return 'refunded'
	if (transferStatusValue.value === 'accepted') return 'accepted'
	return 'pending'
})

const transferTitleText = computed(() => {
	if (transferVisualState.value === 'refunded') return '转账已退还'
	if (
		transferVisualState.value === 'accepted' ||
		transferVisualState.value === 'receipt'
	) {
		return '转账已收款'
	}
	if (props.isMe && transferVisualState.value === 'pending') {
		return `转账给${transferTargetLabel.value}`
	}
	return '转账'
})

const handleTransferCardClick = (): void => {
	if (canAcceptTransfer.value && transferStatusValue.value === 'pending') {
		showConfirmModal.value = true
		return
	}
	if (!transferBusinessNo.value) return
	showDetailModal.value = true
}

const handleConfirmAccept = async (): Promise<void> => {
	const businessNo = transferBusinessNo.value?.trim()
	if (!businessNo || isAccepting.value) return

	isAccepting.value = true
	try {
		await walletStore.acceptTransfer({ businessNo })
		const confirmTimeText = new Date().toLocaleString('zh-CN', {
			hour12: false,
		})
		const receiptHtml = `
<div class="chat-transfer-receipt-card" data-business-no="${businessNo}">
	<div><strong>转账已收款</strong></div>
	${transferAmountText.value ? `<div>金额：${transferAmountText.value}</div>` : ''}
	${transferRemarkText.value ? `<div>备注：${transferRemarkText.value}</div>` : ''}
	<div>确认时间：${confirmTimeText}</div>
</div>`.trim()
		chatStore.sendMessage(receiptHtml, 'transfer')
		showConfirmModal.value = false
		message.success('收款成功')
	} catch (error) {
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(
			maybeResponse?.data?.message || '接受转账失败，请稍后重试',
		)
	} finally {
		isAccepting.value = false
	}
}

const isOnlyImage = computed(() => {
	if (isTransferCard.value) return false
	if (!props.content) return false
	let html = props.content.replace(/\s/g, '')
	html = html
		.replace(/<p[^>]*>/gi, '')
		.replace(/<\/p>/gi, '')
		.replace(/<br\s*\/?>/gi, '')
	const imgMatches = html.match(/<img[^>]+>/gi)
	return (
		imgMatches &&
		imgMatches.length > 0 &&
		html
			.replace(/<a[^>]*>/gi, '')
			.replace(/<\/a>/gi, '')
			.replace(/<img[^>]+>/gi, '') === ''
	)
})

const handleClickEvent = (e: MouseEvent): void => {
	const target = e.target as HTMLElement
	if (target.tagName === 'IMG') {
		window.electron.ipcRenderer.send(
			'view-img',
			(target as HTMLImageElement).src,
		)
	}
}

const attachLoadEvents = (): void => {
	const imgs =
		messageRootRef.value?.querySelectorAll('.msg-content-selectable img') ||
		[]
	imgs.forEach((img) => {
		const image = img as HTMLImageElement
		if (image.complete) {
			emit('image-loaded')
			return
		}
		image.onload = () => emit('image-loaded')
	})
}

onMounted(attachLoadEvents)
onUpdated(attachLoadEvents)
</script>

<style scoped>
:deep(.msg-content-selectable img) {
	display: block;
	cursor: pointer;
	max-width: 240px;
	max-height: 320px;
	border-radius: 8px;
	border: #79797a94 solid 1px;
}
.msg-content-selectable,
.msg-content-selectable :deep(*) {
	user-select: text;
	-webkit-user-select: text;
}
.avatar-no-select {
	user-select: none;
	-webkit-user-select: none;
}

.message-root {
	position: relative;
}

.has-result-tip {
	padding-bottom: 24px;
}

.message-bubble-row {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
}

.chat-bubble {
	position: relative;
	line-height: 1.45;
	border-radius: 14px;
	border: 1px solid transparent;
}

.chat-bubble-me {
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
	color: #f8fafc;
	border-color: rgb(24 94 194 / 35%);
	border-bottom-right-radius: 6px;
}

.chat-bubble-other {
	background: #f2f5f9;
	color: #1f2937;
	border-color: #dde3ec;
	border-bottom-left-radius: 6px;
}

.chat-bubble-me :deep(a) {
	color: #dbeeff;
	text-decoration: underline;
	text-decoration-color: rgb(219 238 255 / 70%);
	text-underline-offset: 2px;
}

.chat-bubble-me :deep(a:hover) {
	color: #f4f9ff;
	text-decoration-color: rgb(244 249 255 / 90%);
}

.notice-card {
	min-width: 260px;
	max-width: 360px;
	border-radius: 14px;
	padding: 12px;
	border: 1px solid #dbe3f0;
}

.notice-card-head {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.notice-card-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 34px;
	height: 20px;
	padding: 0 6px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 700;
	line-height: 1;
}

.notice-card-title {
	font-size: 14px;
	font-weight: 700;
	line-height: 1.3;
}

.notice-card-body {
	display: grid;
	gap: 6px;
}

.notice-card-line {
	font-size: 12px;
	line-height: 1.45;
	word-break: break-all;
}

.notice-card-system {
	background: linear-gradient(180deg, #f7fafd 0%, #f2f6fb 100%);
	color: #1f2937;
	border-color: #dce6f2;
}

.notice-card-system .notice-card-badge {
	background: #e9f1fb;
	color: #2f7fe7;
}

.notice-card-vip {
	background:
		radial-gradient(circle at top right, #fff7d6 0%, transparent 52%),
		linear-gradient(155deg, #fff3c8 0%, #f6d477 45%, #ddb250 100%);
	color: #4a3410;
	border-color: #d5af57;
	box-shadow: 0 6px 14px rgba(190, 144, 56, 0.22);
}

.notice-card-vip .notice-card-badge {
	background: #6d4c12;
	color: #ffe8a3;
}

.transfer-card {
	min-width: 260px;
	max-width: 320px;
	border-radius: 12px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	border: 1px solid transparent;
	transition: all 0.2s ease;
	user-select: none;
}

.transfer-card-clickable {
	cursor: pointer;
}

.transfer-card-clickable:active {
	opacity: 0.9;
	transform: scale(0.98);
}

/* 状态系列：待领取 (Pending) */
.transfer-card-state-pending {
	background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
	color: #ffffff;
}

/* 状态系列：已领取/已收款 (Accepted/Receipt) */
.transfer-card-state-accepted,
.transfer-card-state-receipt {
	background: #f0f7ff;
	color: #1890ff;
	border-color: #d6eaff;
}

/* 状态系列：已退还 (Refunded) */
.transfer-card-state-refunded {
	background: #f5f5f5;
	color: #8c8c8c;
	border-color: #e8e8e8;
}

.transfer-card-me {
	border-bottom-right-radius: 4px;
}

.transfer-card-other {
	border-bottom-left-radius: 4px;
}

.transfer-card-content {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 16px;
	gap: 12px;
}

.transfer-card-main {
	flex: 1;
	min-width: 0;
}

.transfer-card-title {
	font-size: 13px;
	font-weight: 500;
	opacity: 0.85;
	margin-bottom: 4px;
}

.transfer-card-amount {
	font-size: 22px;
	font-weight: 700;
	line-height: 1.2;
}

.transfer-card-remark {
	font-size: 12px;
	margin-top: 6px;
	opacity: 0.7;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
}

.transfer-card-status-icon {
	opacity: 0.2;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.transfer-card-state-pending .transfer-card-status-icon {
	opacity: 0.35;
	color: #ffffff;
}

.transfer-card-footer {
	padding: 8px 16px;
	font-size: 12px;
	border-top: 1px solid rgba(0, 0, 0, 0.04);
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.transfer-card-state-pending .transfer-card-footer {
	background: rgba(255, 255, 255, 0.1);
	border-top: none;
	color: rgba(255, 255, 255, 0.85);
}

.transfer-card-state-accepted .transfer-card-footer,
.transfer-card-state-receipt .transfer-card-footer {
	background: rgba(24, 144, 255, 0.03);
	color: #1890ff;
}

.transfer-card-state-refunded .transfer-card-footer {
	background: rgba(0, 0, 0, 0.02);
	color: #8c8c8c;
}

.bubble-failed-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	border-radius: 9999px;
	background: #ef4444;
	border: 0;
	color: #fff;
	font-size: 11px;
	font-weight: 700;
	line-height: 1;
	cursor: default;
	padding: 0;
}

.bubble-result-tip {
	margin-top: 0;
	font-size: 11px;
	line-height: 1.3;
	display: inline-flex;
	align-items: center;
	max-width: min(80%, 420px);
	padding: 5px 10px;
	border-radius: 9999px;
	background: rgb(15 23 42 / 22%);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	color: rgb(255 255 255 / 92%);
	position: absolute;
	left: 50%;
	bottom: 0;
	transform: translateX(-50%);
	border: 1px solid rgb(255 255 255 / 16%);
}

.bubble-result-dot {
	width: 5px;
	height: 5px;
	border-radius: 999px;
	background: currentColor;
	flex-shrink: 0;
	margin-right: 6px;
}

/* NextUI Style Modal */
.transfer-modal-content {
	border-radius: 28px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
}

.modal-header-gradient {
	height: 30px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.icon-wrapper {
	width: 52px;
	height: 52px;
	border-radius: 18px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.header-text {
	font-size: 16px;
	font-weight: 600;
	letter-spacing: 0.5px;
}

.amount-large {
	font-size: 38px;
	font-family: 'Outfit', 'Inter', sans-serif;
}

.detail-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 13px;
}

.detail-label {
	color: #94a3b8;
}

.detail-value {
	color: #1e293b;
	font-weight: 500;
	max-width: 200px;
}

.dark .detail-value {
	color: #e2e8f0;
}

.modal-btn-primary {
	border-radius: 14px;
	height: 48px;
	font-weight: 600;
	color: white;
	border: none;
	cursor: pointer;
	transition: all 0.2s;
	background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.modal-btn-primary:hover {
	transform: perspective(1px) scale(1.02);
	filter: brightness(1.1);
}

.modal-btn-primary:active {
	transform: scale(0.98);
}

.modal-btn-primary:disabled {
	opacity: 0.6;
	cursor: not-allowed;
	transform: none;
}

.modal-btn-secondary {
	border-radius: 14px;
	height: 48px;
	font-weight: 600;
	color: #64748b;
	border: none;
	background: #f1f5f9;
	cursor: pointer;
	transition: all 0.2s;
}

.dark .modal-btn-secondary {
	background: rgba(255, 255, 255, 0.05);
	color: #94a3b8;
}

.modal-btn-ghost {
	border-radius: 14px;
	height: 48px;
	font-weight: 600;
	color: #64748b;
	border: 1px solid #e2e8f0;
	background: transparent;
	cursor: pointer;
	transition: all 0.2s;
}

.dark .modal-btn-ghost {
	border-color: rgba(255, 255, 255, 0.1);
	color: #94a3b8;
}

.status-badge {
	padding: 4px 12px;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 500;
}

.status-badge.receipt,
.status-badge.accepted {
	background: #f0f7ff;
	color: #1890ff;
}

.status-badge.refunded {
	background: #f5f5f5;
	color: #8c8c8c;
}

.status-badge.pending {
	background: rgba(24, 144, 255, 0.1);
	color: #1890ff;
}

.dark .status-badge.receipt,
.dark .status-badge.accepted {
	background: rgba(34, 197, 94, 0.1);
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>

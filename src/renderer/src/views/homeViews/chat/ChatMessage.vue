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
				class="px-1 mb-0.5 text-[11px] text-gray-500 avatar-no-select"
			>
				{{ senderName }}
			</div>
			<div class="message-bubble-row" :class="isMe ? 'justify-end' : 'justify-start'">
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
					v-if="isTransferCard"
					class="transfer-card avatar-no-select"
					:class="[
						isMe ? 'transfer-card-me' : 'transfer-card-other',
						(canAcceptTransfer && transferFooterText === '点击收款') ||
						transferFooterText === '已收款' ||
						transferFooterText === '已退还'
							? 'transfer-card-clickable'
							: '',
						`transfer-card-state-${transferVisualState}`,
					]"
					@click="handleTransferCardClick"
				>
					<div class="transfer-card-content">
						<div class="transfer-card-icon">{{ transferIconText }}</div>
						<div class="transfer-card-main">
							<div class="transfer-card-title">{{ transferTitleText }}</div>
							<div class="transfer-card-amount">
								{{ transferAmountText || '金额待确认' }}
							</div>
							<div
								v-if="transferRemarkText"
								class="transfer-card-remark"
								:title="transferRemarkText"
							>
								{{ transferRemarkText }}
							</div>
						</div>
					</div>
					<div class="transfer-card-footer" :class="transferFooterClass">
						<span>{{ transferFooterText }}</span>
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
					<div v-html="content" class="msg-content-selectable"></div>
				</div>
			</div>

			<div class="flex items-center gap-1 px-1 avatar-no-select">
				<span class="text-[10px] text-gray-400">{{ time }}</span>
			</div>

			<div
				v-if="hasResult"
				class="bubble-result-tip avatar-no-select"
			>
				<span class="bubble-result-dot" aria-hidden="true"></span>
				<span class="truncate">{{ result || '消息异常' }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'

const props = defineProps<{
	content: string
	messageType?: 'text' | 'image' | 'file' | 'transfer'
	transferStatus?: 'pending' | 'accepting' | 'accepted' | 'refunded'
	transferTargetName?: string
	senderName?: string
	isMe: boolean
	avatar?: string
	time: string
	hasResult?: boolean
	result?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
}>()
const messageRootRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
	(e: 'image-loaded'): void
	(
		e: 'contextmenu',
		ev: MouseEvent,
		type: 'text' | 'image',
		extra?: any,
	): void
	(
		e: 'transfer-accept',
		payload: {
			businessNo: string
			amountText: string
			remarkText: string
		},
	): void
	(
		e: 'transfer-detail',
		payload: {
			businessNo: string
			amountText: string
			remarkText: string
			confirmTimeText: string
		},
	): void
}>()

const handleContextMenu = (e: MouseEvent) => {
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
	const dataMatched = content.match(/data-business-no\s*=\s*["']([^"']+)["']/i)
	if (dataMatched?.[1]?.trim()) return dataMatched[1].trim()
	return parseTransferField(content, '交易号')
}

const hasTransferMarker = computed(() => /\bchat-transfer-card\b/i.test(props.content))
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

const transferIconText = computed(() => {
	if (transferVisualState.value === 'refunded') return '↩'
	if (
		transferVisualState.value === 'accepted' ||
		transferVisualState.value === 'receipt'
	) {
		return '✓'
	}
	return '￥'
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
		emit('transfer-accept', {
			businessNo: transferBusinessNo.value,
			amountText: transferAmountText.value,
			remarkText: transferRemarkText.value,
		})
		return
	}
	if (!transferBusinessNo.value) return
	emit('transfer-detail', {
		businessNo: transferBusinessNo.value,
		amountText: transferAmountText.value,
		remarkText: transferRemarkText.value,
		confirmTimeText: transferConfirmTimeText.value,
	})
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

.transfer-card {
	min-width: 248px;
	max-width: 308px;
	border-radius: 8px;
	border: 1px solid #2f80ed;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	background: #2f80ed;
}

.transfer-card-clickable {
	cursor: pointer;
}

.transfer-card-clickable:hover {
	filter: brightness(1.02);
}

.transfer-card-clickable:active {
	filter: brightness(0.98);
}

.transfer-card-me {
	background: #2f80ed;
	color: #f6fbff;
	border-color: #2b74d7;
	border-bottom-right-radius: 6px;
}

.transfer-card-other {
	background: #2f80ed;
	color: #f6fbff;
	border-color: #2b74d7;
	border-bottom-left-radius: 6px;
}

.transfer-card.transfer-card-state-accepted,
.transfer-card.transfer-card-state-receipt {
	background: #dce9fb;
	border-color: #c2d7f8;
	color: #2157a3;
}

.transfer-card.transfer-card-state-refunded {
	background: #e6ebf3;
	border-color: #d2dae8;
	color: #4f5f79;
}

.transfer-card-content {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px;
}

.transfer-card-icon {
	width: 34px;
	height: 34px;
	border-radius: 8px;
	background: rgb(255 255 255 / 20%);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	line-height: 1;
	font-weight: 500;
	flex-shrink: 0;
}

.transfer-card.transfer-card-state-accepted .transfer-card-icon,
.transfer-card.transfer-card-state-receipt .transfer-card-icon {
	background: #c8dbf7;
	color: #2a5fa9;
}

.transfer-card.transfer-card-state-refunded .transfer-card-icon {
	background: #d8dfeb;
	color: #54637a;
}

.transfer-card-main {
	min-width: 0;
	flex: 1;
}

.transfer-card-title {
	font-size: 12px;
	opacity: 0.9;
	font-weight: 500;
}

.transfer-card-amount {
	font-size: 20px;
	font-weight: 600;
	line-height: 1.2;
	margin-top: 3px;
	letter-spacing: 0;
}

.transfer-card-remark {
	font-size: 12px;
	line-height: 1.35;
	opacity: 0.82;
	margin-top: 4px;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
}

.transfer-card-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 7px 12px;
	font-size: 12px;
	line-height: 1.35;
	background: #ffffff;
	border-top: 1px solid #d9e6fb;
	color: #2a5fa9;
}

.transfer-card-footer.is-pending {
	color: #2559a0;
	font-weight: 500;
}

.transfer-card-footer.is-accepting {
	color: #3b6eb3;
}

.transfer-card-footer.is-accepted {
	color: #4a6ea8;
}

.transfer-card-footer.is-me {
	color: #3969ab;
}

.transfer-card-footer.is-receipt {
	color: #3f6298;
	font-weight: 500;
}

.transfer-card-footer.is-refunded {
	color: #55657d;
	font-weight: 500;
}

.transfer-card.transfer-card-state-accepted .transfer-card-footer,
.transfer-card.transfer-card-state-receipt .transfer-card-footer {
	background: #f8fbff;
	border-top-color: #d7e5fa;
	color: #4d6ea4;
}

.transfer-card.transfer-card-state-refunded .transfer-card-footer {
	background: #f5f7fb;
	border-top-color: #dce3ef;
	color: #66768e;
}

.transfer-card-state {
	padding: 0 12px 8px;
	font-size: 11px;
	line-height: 1.35;
	color: rgb(235 245 255 / 92%);
	opacity: 1;
}

.transfer-card.transfer-card-state-accepted .transfer-card-state,
.transfer-card.transfer-card-state-receipt .transfer-card-state {
	color: #4e6fa5;
}

.transfer-card.transfer-card-state-refunded .transfer-card-state {
	color: #66768e;
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
	box-shadow: 0 2px 6px rgb(239 68 68 / 28%);
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
</style>

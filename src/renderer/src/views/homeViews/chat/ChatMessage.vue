<template>
	<div
		ref="messageRootRef"
		class="flex w-full mt-1 message-root"
		:class="[
			isMe ? 'flex-row-reverse' : 'flex-row',
			hasResult ? 'has-result-tip' : '',
		]"
	>
		<n-avatar
			round
			:src="avatar"
			class="mx-2 shrink-0 avatar-no-select"
			@contextmenu="handleAvatarContextMenu"
		/>

		<div
			class="flex flex-col min-w-0"
			:class="[
				isMe ? 'items-end' : 'items-start',
				shouldRenderVipNoticeCard ? 'max-w-[92%]' : 'max-w-[75%]',
			]"
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

				<div v-if="shouldRenderVipNoticeCard" class="avatar-no-select">
					<MembershipTopUpNoticeCard
						:status="vipNoticeStatus"
						:amount="vipNoticeAmount"
						:currency="vipNoticeCurrency"
						:hide-amount="true"
						success-text="开通成功"
						:duration-days="vipNoticeDurationDays"
						:level-before="vipNoticeLevelBefore"
						:level-after="vipNoticeLevelAfter"
						:paid-at="vipNoticePaidAt"
						:order-id="vipNoticeOrderId"
						:pay-method="vipNoticePayMethod"
						:on-view-benefits="handleViewBenefits"
						:on-view-order="handleViewOrder"
						:on-retry-pay="handleRetryVipPay"
						:on-contact-support="handleContactSupport"
					/>
				</div>

				<div
					v-else-if="shouldRenderSystemNoticeCard"
					class="notice-card notice-card-system avatar-no-select"
				>
					<div class="notice-card-top">
						<span class="notice-card-badge">系统通知</span>
						<span class="notice-card-time">{{ time }}</span>
					</div>
					<div
						v-if="systemNoticeTitle"
						class="notice-card-main-title"
					>
						{{ systemNoticeTitle }}
					</div>

					<div
						class="notice-card-body notice-card-body-html"
						v-html="systemNoticeBodyHtml"
					></div>
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
					v-else-if="isCloudDocShareCard"
					class="cloud-doc-card avatar-no-select"
					@click="handleCloudDocCardClick"
				>
					<div class="cloud-doc-card-title">云文档分享</div>
					<div class="cloud-doc-card-name">
						{{ cloudDocShareTitle || '未标题云文档' }}
					</div>
					<div class="cloud-doc-card-desc">点击打开云文档</div>
				</div>

				<div
					v-else-if="isOnlyImage"
					class="chat-image-bubble msg-content-selectable"
					:class="
						isMe
							? 'chat-image-bubble-me'
							: 'chat-image-bubble-other'
					"
					@click="handleClickEvent"
					v-html="renderedContent"
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
					<div
						class="msg-content-selectable"
						v-html="renderedContent"
					></div>
					<div
						v-if="reactionItems && reactionItems.length"
						class="bubble-inline-reaction avatar-no-select"
					>
						<div
							v-for="reaction in reactionItems"
							:key="reaction.key"
							class="message-reaction-chip"
						>
							<img
								v-if="reaction.imageUrl"
								:src="reaction.imageUrl"
								alt="reaction"
								class="message-reaction-image"
							/>
							<span v-else class="message-reaction-emoji">{{
								reaction.emoji
							}}</span>
							<span class="message-reaction-user">{{
								reaction.label
							}}</span>
						</div>
					</div>
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
import { computed, onMounted, onUpdated, ref, watch } from 'vue'
import {
	ShieldCheckmark24Regular,
	Money24Filled,
	CheckmarkCircle24Filled,
	ArrowReply24Filled,
} from '@vicons/fluent'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import MembershipTopUpNoticeCard, {
	type MembershipNoticeStatus,
} from '@renderer/components/membershipNotice/MembershipTopUpNoticeCard.vue'
import { NModal, NIcon, NSpin, useMessage } from 'naive-ui'
import { useWalletStore } from '@renderer/stores/wallet'
import { useChatStore } from '@renderer/stores/chat'
import { useCloudDocStore } from '@renderer/stores/cloudDoc'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import { getMergedEmojiTokenMap } from '@renderer/utils/emojiTokenMap'
import { resolveAvatarUrl } from '@renderer/utils/avatar'

const walletStore = useWalletStore()
const chatStore = useChatStore()
const cloudDocStore = useCloudDocStore()
const sidebarSlotStore = useSidebarSlotStore()
const message = useMessage()

const props = defineProps<{
	content: string
	messageType?: 'text' | 'image' | 'file' | 'transfer'
	transferStatus?: 'pending' | 'accepting' | 'accepted' | 'refunded'
	transferTargetName?: string
	senderName?: string
	senderAccount?: string
	senderIsVip?: boolean
	isMe: boolean
	enableAvatarMenu?: boolean
	avatar?: string
	time: string
	hasResult?: boolean
	result?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	isSystemChat?: boolean
	isVipNotice?: boolean
	reactionItems?: Array<{
		key: string
		emoji?: string
		imageUrl?: string
		label: string
	}>
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

const escapeHtml = (value: string): string => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

const renderEmojiTokensInHtml = (source: string): string => {
	if (!source) return source
	if (!source.includes('[') || !source.includes(']')) return source
	const tokenMap = getMergedEmojiTokenMap()
	if (!Object.keys(tokenMap).length) return source

	const holder = document.createElement('div')
	holder.innerHTML = source
	const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT)
	const textNodes: Text[] = []
	let current = walker.nextNode()
	while (current) {
		if (current.nodeType === Node.TEXT_NODE) {
			textNodes.push(current as Text)
		}
		current = walker.nextNode()
	}

	const tokenPattern = /\[([^\]\s[]{1,24})\]/g
	textNodes.forEach((textNode) => {
		const raw = textNode.nodeValue || ''
		tokenPattern.lastIndex = 0
		if (!tokenPattern.test(raw)) return
		tokenPattern.lastIndex = 0

		const frag = document.createDocumentFragment()
		let lastIndex = 0
		let matched = tokenPattern.exec(raw)
		while (matched) {
			const token = matched[0]
			const start = matched.index
			const end = start + token.length
			const mappedUrl = tokenMap[token]

			if (start > lastIndex) {
				frag.appendChild(
					document.createTextNode(raw.slice(lastIndex, start)),
				)
			}
			if (mappedUrl) {
				const img = document.createElement('img')
				img.className = 'inline-emoji-token'
				img.src = mappedUrl
				img.alt = token
				img.title = token
				img.setAttribute('draggable', 'false')
				frag.appendChild(img)
			} else {
				frag.appendChild(document.createTextNode(token))
			}
			lastIndex = end
			matched = tokenPattern.exec(raw)
		}
		if (lastIndex < raw.length) {
			frag.appendChild(document.createTextNode(raw.slice(lastIndex)))
		}
		textNode.replaceWith(frag)
	})

	return holder.innerHTML
}

const systemNoticeRawHtml = computed(() => {
	const source = props.content || ''
	if (!source.trim()) return ''
	const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(source)
	if (hasHtmlTag) return source.replace(/\r\n?/g, '\n')
	return escapeHtml(source).replace(/\r\n?/g, '\n').replace(/\n/g, '<br/>')
})

const decodeHtmlEntitiesInline = (value: string): string => {
	const text = String(value || '').trim()
	if (!text) return ''
	const holder = document.createElement('textarea')
	holder.innerHTML = text
	return holder.value || text
}

const decodeHtmlEntitiesDeep = (value: string, maxDepth = 2): string => {
	let current = String(value || '')
	for (let i = 0; i < maxDepth; i += 1) {
		const decoded = decodeHtmlEntitiesInline(current)
		if (decoded === current) break
		current = decoded
	}
	return current
}

const normalizeImageCandidate = (value: string): string => {
	const text = String(value || '').trim()
	if (!text) return ''
	const srcsetCandidate = text.split(',')[0]?.trim().split(/\s+/)[0] || ''
	const candidate = srcsetCandidate || text
	if (/^(https?:|blob:|data:image\/|file:)/i.test(candidate)) return candidate
	if (candidate.startsWith('//')) {
		return `${window.location.protocol}${candidate}`
	}
	if (candidate.startsWith('/')) {
		return `${window.location.origin}${candidate}`
	}
	return ''
}

const extractPlainTextFromHtml = (source: string): string => {
	const container = document.createElement('div')
	container.innerHTML = source
	return (container.textContent || '').replace(/\s+/g, ' ').trim()
}

const extractImageLikeUrlFromJson = (value: string): string => {
	const parsed = tryParseJsonObject(value)
	if (!parsed) return ''
	const queue: unknown[] = [parsed]
	const keys = new Set([
		'src',
		'url',
		'image',
		'imageurl',
		'image_url',
		'thumburl',
		'thumbnail',
		'originurl',
		'originalurl',
		'path',
	])
	while (queue.length) {
		const node = queue.shift()
		if (!node || typeof node !== 'object') continue
		for (const [rawKey, rawValue] of Object.entries(
			node as Record<string, unknown>,
		)) {
			const normalizedKey = rawKey.replace(/[\s_\-]/g, '').toLowerCase()
			if (typeof rawValue === 'string') {
				const normalizedValue = normalizeImageCandidate(rawValue)
				if (keys.has(normalizedKey) && normalizedValue) {
					return normalizedValue
				}
				if (normalizedValue) return normalizedValue
			} else if (rawValue && typeof rawValue === 'object') {
				queue.push(rawValue)
			}
		}
	}
	return ''
}

const imageUrlToHtml = (value: string): string => {
	const normalized = normalizeImageCandidate(value)
	if (!normalized) return ''
	return `<img src="${escapeHtml(normalized)}" alt="image" class="notice-card-inline-image" />`
}

const normalizeNoticeHtmlImages = (source: string): string => {
	const container = document.createElement('div')
	container.innerHTML = source
	const imgs = Array.from(container.querySelectorAll('img'))
	let replacedBrokenImage = false
	for (const img of imgs) {
		const srcCandidates = [
			img.getAttribute('src'),
			img.getAttribute('data-src'),
			img.getAttribute('data-origin-src'),
			img.getAttribute('data-original-src'),
			img.getAttribute('data-url'),
			img.getAttribute('data-image'),
			img.getAttribute('srcset'),
			img.getAttribute('data-srcset'),
			img.getAttribute('data-file'),
			img.getAttribute('data-path'),
		]
			.map((item) => String(item || '').trim())
			.filter(Boolean)
		const styleUrl =
			String(img.getAttribute('style') || '')
				.match(/url\((['"]?)([^'")]+)\1\)/i)?.[2]
				?.trim() || ''
		const nextSrc =
			srcCandidates
				.map((item) => normalizeImageCandidate(item))
				.find(Boolean) || normalizeImageCandidate(styleUrl)
		if (!nextSrc) {
			const fallback = document.createElement('span')
			fallback.className = 'notice-card-image-fallback'
			fallback.textContent = '[图片消息]'
			img.replaceWith(fallback)
			replacedBrokenImage = true
			continue
		}
		img.setAttribute('src', nextSrc)
		img.removeAttribute('srcset')
		img.removeAttribute('style')
		img.className = 'notice-card-inline-image'
		img.setAttribute('alt', img.getAttribute('alt') || 'image')
		img.setAttribute('loading', 'eager')
		img.setAttribute('decoding', 'async')
	}
	if (replacedBrokenImage) {
		const plain = extractPlainTextFromHtml(container.innerHTML)
		if (!plain) {
			return '<span class="notice-card-image-fallback">[图片消息]</span>'
		}
	}
	return container.innerHTML
}

const toNoticeContentHtml = (source: string): string => {
	const raw = String(source || '').trim()
	if (!raw) return ''
	const decoded = decodeHtmlEntitiesDeep(raw, 3)
	const normalized = decoded.replace(/\r\n?/g, '\n')
	const jsonImageUrl = extractImageLikeUrlFromJson(normalized)
	if (jsonImageUrl) return imageUrlToHtml(jsonImageUrl)
	const directUrl = normalized.trim()
	if (/^https?:\/\/[^\s]+$/i.test(directUrl)) {
		return imageUrlToHtml(directUrl)
	}
	const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(normalized)
	if (hasHtmlTag) {
		return renderEmojiTokensInHtml(normalizeNoticeHtmlImages(normalized))
	}
	const imageHtml = imageUrlToHtml(normalized)
	if (imageHtml) return imageHtml
	return renderEmojiTokensInHtml(
		escapeHtml(normalized).replace(/\n/g, '<br/>'),
	)
}

const pickNoticePayloadText = (
	payload: Record<string, unknown>,
	keys: string[],
): string => {
	for (const key of keys) {
		const text = normalizeNoticePayloadText(payload[key])
		if (text) return text
	}
	return ''
}

const systemNoticeTemplate = computed(() => {
	const payload = noticeStructuredPayload.value || {}
	const eventType = pickNoticePayloadText(payload, [
		'eventType',
		'type',
		'templateCode',
		'event',
	])
		.trim()
		.toLowerCase()
	const action = pickNoticePayloadText(payload, [
		'action',
		'op',
		'operation',
		'status',
	])
		.trim()
		.toLowerCase()
	const actor = pickNoticePayloadText(payload, [
		'operatorName',
		'senderName',
		'fromName',
		'actorName',
		'operatorId',
		'from',
	])
	const emoji = pickNoticePayloadText(payload, [
		'reaction',
		'emoji',
		'reactionEmoji',
		'reactionKey',
	])
	const snippet = pickNoticePayloadText(payload, [
		'messageContent',
		'messagePreview',
		'messageSnippet',
		'contentSnippet',
		'snippet',
		'content',
	])

	const isReaction =
		eventType.includes('reaction') ||
		eventType.includes('reply_info') ||
		eventType.includes('reply') ||
		eventType.includes('react') ||
		!!payload.reaction ||
		!!payload.reactionEmoji

	if (isReaction || (actor && (emoji || eventType))) {
		const actorText = actor || systemNoticeSenderName.value || '有人'
		const actorAvatar = pickNoticePayloadText(payload, [
			'operatorAvatarUrl',
			'senderAvatarUrl',
			'fromAvatarUrl',
			'actorAvatarUrl',
			'operatorAvatar',
			'senderAvatar',
			'fromAvatar',
			'actorAvatar',
			'avatarUrl',
			'avatar',
		])
		const actionText =
			action.includes('remove') ||
			action.includes('cancel') ||
			action.includes('delete')
				? '取消了互动'
				: '回复了消息'
		const snippetHtml = snippet
			? `<div class="notice-card-quote">${toNoticeContentHtml(snippet)}</div>`
			: ''
		return {
			title: '消息互动提醒',
			bodyHtml: `${snippetHtml}${buildNoticeActionHtml({
				actor: actorText,
				actionText,
				emoji,
				avatarUrl: actorAvatar || systemNoticeSenderAvatar.value,
			})}`,
		}
	}

	return null
})

const systemNoticeSenderName = computed(() => {
	const payload = noticeStructuredPayload.value || {}
	return (
		pickNoticePayloadText(payload, [
			'operatorName',
			'senderName',
			'fromName',
			'actorName',
			'operatorId',
			'from',
		]) ||
		props.senderName?.trim() ||
		'系统助手'
	)
})

const systemNoticeSenderAvatar = computed(() => {
	const payload = noticeStructuredPayload.value || {}
	const raw = pickNoticePayloadText(payload, [
		'operatorAvatarUrl',
		'senderAvatarUrl',
		'fromAvatarUrl',
		'actorAvatarUrl',
		'operatorAvatar',
		'senderAvatar',
		'fromAvatar',
		'actorAvatar',
		'avatarUrl',
		'avatar',
	])
	return resolveAvatarUrl(raw)
})

const buildNoticeActionHtml = (params: {
	actor: string
	actionText: string
	emoji?: string
	avatarUrl?: string
}): string => {
	const actor = params.actor.trim() || '有人'
	const initial = actor.slice(0, 1).toUpperCase() || '系'
	const avatar = resolveAvatarUrl(params.avatarUrl || '')
	const avatarHtml = avatar
		? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(actor)}" class="notice-card-action-avatar" />`
		: `<span class="notice-card-action-avatar notice-card-action-avatar-fallback">${escapeHtml(initial)}</span>`
	const emojiHtml = params.emoji?.trim() ? ` ${escapeHtml(params.emoji)}` : ''
	return `<div class="notice-card-action">${avatarHtml}<span class="notice-card-action-text"><strong>${escapeHtml(actor)}</strong> </span>${params.actionText}${emojiHtml}</div>`
}

const normalizeNoticePayloadText = (value: unknown): string => {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value.trim()
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	return ''
}

const systemNoticePayloadBodyHtml = computed(() => {
	const payload = noticeStructuredPayload.value
	if (!payload) return ''
	const candidateFields = [
		'messageContent',
		'message',
		'content',
		'body',
		'desc',
		'description',
		'detail',
		'text',
		'messageText',
		'summary',
	]
	const lines: string[] = []
	for (const field of candidateFields) {
		const text = normalizeNoticePayloadText(payload[field])
		if (!text) continue
		if (field === 'messageContent') {
			lines.push(
				`<div class="notice-card-quote">${toNoticeContentHtml(text)}</div>`,
			)
		} else {
			lines.push(
				`<div class="notice-card-paragraph">${toNoticeContentHtml(text)}</div>`,
			)
		}
		if (lines.length >= 3) break
	}
	if (!lines.length) {
		const actor = normalizeNoticePayloadText(
			payload.operatorName || payload.actorName || payload.senderName,
		)
		const emoji = normalizeNoticePayloadText(
			payload.emoji || payload.reactionEmoji || payload.reaction,
		)
		const actorAvatar = normalizeNoticePayloadText(
			payload.operatorAvatarUrl ||
				payload.actorAvatarUrl ||
				payload.senderAvatarUrl ||
				payload.avatarUrl ||
				payload.operatorAvatar ||
				payload.actorAvatar ||
				payload.senderAvatar,
		)
		if (actor || emoji) {
			lines.push(
				buildNoticeActionHtml({
					actor: actor || '有人',
					actionText: '回复了信息',
					emoji,
					avatarUrl: actorAvatar || systemNoticeSenderAvatar.value,
				}),
			)
		}
	}
	if (!lines.length) {
		lines.push('<p class="notice-card-action">你收到一条系统消息</p>')
	}
	return `<div class="notice-card-rich">${lines.join('')}</div>`
})

const systemNoticeTitle = computed(() => {
	const payload = noticeStructuredPayload.value
	if (payload) {
		const payloadTitle =
			normalizeNoticePayloadText(payload.title) ||
			normalizeNoticePayloadText(payload.templateName) ||
			normalizeNoticePayloadText(payload.eventName)
		if (payloadTitle) return payloadTitle
	}
	return systemNoticeTemplate.value?.title || noticeTitle.value || ''
})

const systemNoticeBodyHtml = computed(() => {
	if (systemNoticeTemplate.value?.bodyHtml) {
		return `<div class="notice-card-rich">${renderEmojiTokensInHtml(systemNoticeTemplate.value.bodyHtml)}</div>`
	}
	if (systemNoticePayloadBodyHtml.value) {
		return systemNoticePayloadBodyHtml.value
	}
	const html = systemNoticeRawHtml.value
	if (!html) return '<p class="notice-card-line">暂无系统通知内容</p>'
	const rendered = toNoticeContentHtml(html)
	return `<div class="notice-card-rich">${rendered}</div>`
})

const normalizeFieldKey = (value: string): string =>
	value.replace(/[\s_\-:：]/g, '').toLowerCase()

const toScalarText = (value: unknown): string | undefined => {
	if (typeof value === 'string') {
		const trimmed = value.trim()
		return trimmed || undefined
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	return undefined
}

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
	const trimmed = value.trim()
	if (!trimmed) return null
	try {
		const parsed = JSON.parse(trimmed)
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>
		}
		return null
	} catch {
		return null
	}
}

const extractFirstJsonObject = (
	value: string,
): Record<string, unknown> | null => {
	const trimmed = value.trim()
	if (!trimmed) return null
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
	if (fenced?.[1]) {
		const parsed = tryParseJsonObject(fenced[1])
		if (parsed) return parsed
	}
	const direct = tryParseJsonObject(trimmed)
	if (direct) return direct
	const firstBrace = trimmed.indexOf('{')
	const lastBrace = trimmed.lastIndexOf('}')
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		const maybe = trimmed.slice(firstBrace, lastBrace + 1)
		const parsed = tryParseJsonObject(maybe)
		if (parsed) return parsed
	}
	return null
}

const findFieldFromObject = (
	obj: unknown,
	keywords: string[],
	depth = 0,
): string | undefined => {
	if (!obj || typeof obj !== 'object' || depth > 4) return undefined
	const keywordSet = new Set(keywords.map(normalizeFieldKey))
	const row = obj as Record<string, unknown>
	for (const [key, value] of Object.entries(row)) {
		const normalizedKey = normalizeFieldKey(key)
		if (keywordSet.has(normalizedKey)) {
			const scalar = toScalarText(value)
			if (scalar) return scalar
		}
	}
	for (const nested of Object.values(row)) {
		if (Array.isArray(nested)) {
			for (const item of nested) {
				const found = findFieldFromObject(item, keywords, depth + 1)
				if (found) return found
			}
			continue
		}
		const found = findFieldFromObject(nested, keywords, depth + 1)
		if (found) return found
	}
	return undefined
}

const noticeStructuredPayload = computed(() =>
	extractFirstJsonObject(props.content || ''),
)

watch(
	() => props.content,
	(nextContent) => {
		const parsed = extractFirstJsonObject(nextContent || '')
		if (!parsed) return
		console.info('[system-notice-debug] raw-content', nextContent)
		console.info('[system-notice-debug] parsed-json', parsed)
	},
	{ immediate: true },
)

const extractNoticeFieldValue = (keywords: string[]): string | undefined => {
	const fromPayload = findFieldFromObject(
		noticeStructuredPayload.value,
		keywords,
	)
	if (fromPayload) return fromPayload

	for (const rawLine of noticeLines.value) {
		const line = rawLine.trim()
		if (!line) continue
		if (!keywords.some((keyword) => line.includes(keyword))) continue
		const withColon = line.match(/[：:]\s*(.+)$/)
		if (withColon?.[1]?.trim()) {
			const value = withColon[1]
				.trim()
				.split(/[，,；;。]/)[0]
				?.trim()
			if (value) return value
		}
		for (const keyword of keywords) {
			if (!line.includes(keyword)) continue
			const index = line.indexOf(keyword)
			if (index < 0) continue
			const afterKeyword = line.slice(index + keyword.length)
			const normalized = afterKeyword
				.replace(/^(?:\s*[：:=]\s*|已|为|是|\s+)/, '')
				.split(/[，,；;。]/)[0]
				?.trim()
			if (normalized) return normalized
		}
	}
	return undefined
}

const extractNumeric = (value?: string): number | undefined => {
	if (!value?.trim()) return undefined
	const matched = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
	if (!matched) return undefined
	const numeric = Number(matched[0])
	return Number.isFinite(numeric) ? numeric : undefined
}

const parseDateLike = (value?: string): Date | null => {
	if (!value?.trim()) return null
	const normalized = value.trim().replace(/[./]/g, '-')
	const parsed = new Date(normalized)
	if (!Number.isFinite(parsed.getTime())) return null
	return parsed
}

const looksLikeDateText = (value?: string): boolean => {
	if (!value?.trim()) return false
	return /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)
}

const parseDurationDays = (value?: string): number => {
	const raw = (value || '').trim()
	if (!raw) return 0
	if (looksLikeDateText(raw)) return 0

	const byDay = raw.match(/([+-]?\d+(?:\.\d+)?)\s*天/)
	if (byDay) {
		const parsed = Number(byDay[1])
		if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
	}

	const byMonth = raw.match(/([+-]?\d+(?:\.\d+)?)\s*(?:个)?月/)
	if (byMonth) {
		const parsed = Number(byMonth[1])
		if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed * 30))
	}

	const byYear = raw.match(/([+-]?\d+(?:\.\d+)?)\s*年/)
	if (byYear) {
		const parsed = Number(byYear[1])
		if (Number.isFinite(parsed))
			return Math.max(0, Math.floor(parsed * 365))
	}

	const upper = raw.toUpperCase()
	if (
		/(\bMONTHLY\b|月费|包月|月卡|一个月|1个月)/.test(raw) ||
		upper.includes('MONTHLY')
	) {
		return 30
	}
	if (
		/(\bQUARTERLY\b|季度|季卡|三个月|3个月)/.test(raw) ||
		upper.includes('QUARTERLY')
	) {
		return 90
	}
	if (
		/(\bYEARLY\b|年费|年卡|一年|12个月)/.test(raw) ||
		upper.includes('YEARLY')
	) {
		return 365
	}

	const plain = raw.match(/^\d{1,4}$/)
	if (plain) {
		const parsed = Number(plain[0])
		if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1095) {
			return Math.floor(parsed)
		}
	}

	return 0
}

const vipNoticeStatus = computed<MembershipNoticeStatus>(() => {
	const content = noticeText.value
	if (/退款|退还/.test(content)) return 'refunded'
	if (/处理中|确认中|稍后|等待/.test(content)) return 'processing'
	if (/失败|未成功|未完成|异常|错误/.test(content)) return 'failed'
	return 'success'
})

const vipNoticeAmountRaw = computed(
	() =>
		extractNoticeFieldValue([
			'充值金额',
			'支付金额',
			'金额',
			'amount',
			'payAmount',
		]) || '',
)

const vipNoticePlan = computed(
	() =>
		extractNoticeFieldValue([
			'套餐名称',
			'会员套餐',
			'套餐',
			'方案',
			'planName',
			'planCode',
		]) || '',
)

const vipNoticeAmount = computed(() => {
	const numeric = extractNumeric(vipNoticeAmountRaw.value)
	return numeric && numeric > 0 ? numeric : 0
})

const vipNoticeCurrency = computed(() => {
	const raw = vipNoticeAmountRaw.value
	if (/¥|￥/.test(raw)) return '¥'
	if (/\$/.test(raw)) return '$'
	return '¥'
})

const vipNoticeDurationDays = computed(() => {
	const raw =
		extractNoticeFieldValue([
			'时长',
			'会员时长',
			'有效期',
			'months',
			'month',
		]) || ''
	const byDurationField = parseDurationDays(raw)
	if (byDurationField > 0) return byDurationField

	const byPlan = parseDurationDays(vipNoticePlan.value)
	if (byPlan > 0) return byPlan

	const expireField =
		extractNoticeFieldValue([
			'会员到期时间',
			'会员到期',
			'到期时间',
			'到期日期',
			'到期',
			'vipExpireAt',
			'expireAt',
			'endAt',
		]) || ''
	const paidAtField =
		extractNoticeFieldValue([
			'到账时间',
			'支付时间',
			'完成时间',
			'时间',
			'createdAt',
			'sentAt',
		]) ||
		props.time ||
		''
	const expireAt = parseDateLike(expireField)
	const paidAt = parseDateLike(paidAtField)
	if (expireAt && paidAt) {
		const diffMs = expireAt.getTime() - paidAt.getTime()
		const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
		if (diffDays > 0 && diffDays <= 1095) return diffDays
	}

	const matched = noticeText.value.match(/([+-]?\d+)\s*天/)
	if (!matched) return 0
	const parsed = Number(matched[1])
	if (!Number.isFinite(parsed)) return 0
	const normalized = Math.max(0, Math.floor(parsed))
	return normalized <= 1095 ? normalized : 0
})

const vipNoticeLevelBefore = computed(
	() => extractNoticeFieldValue(['升级前等级', '原等级', '充值前等级']) || '',
)

const vipNoticeLevelAfter = computed(
	() =>
		extractNoticeFieldValue([
			'当前等级',
			'升级后等级',
			'会员等级',
			'用户等级',
			'userLevel',
			'level',
		]) || '',
)

const vipNoticePaidAt = computed(() => {
	return (
		extractNoticeFieldValue([
			'到账时间',
			'支付时间',
			'完成时间',
			'时间',
			'createdAt',
			'sentAt',
		]) ||
		props.time ||
		''
	)
})

const normalizeOrderId = (value?: string): string => {
	if (!value) return ''
	const trimmed = value.trim().replace(/[，。；,.]+$/g, '')
	if (!trimmed) return ''
	const pureTimeLike = /^\d{4}[-/]\d{2}[-/]\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/
	if (pureTimeLike.test(trimmed)) return ''
	if (trimmed.length < 8) return ''
	return trimmed
}

const vipNoticeOrderId = computed(() => {
	const billNo =
		normalizeOrderId(
			extractNoticeFieldValue([
				'paymentOrderNo',
				'paymentNo',
				'账单号',
				'账单编号',
				'账单流水号',
				'业务单号',
				'流水号',
				'billNo',
				'businessNo',
				'bizNo',
			]) || '',
		) || ''
	if (billNo) return billNo

	const explicit =
		normalizeOrderId(
			extractNoticeFieldValue(['订单号', '订单编号', '交易单号']) || '',
		) || ''
	if (explicit) return explicit
	const matched = noticeText.value.match(
		/\b(?:VIP[_-]?)?[A-Za-z0-9][A-Za-z0-9_-]{9,}\b/,
	)
	const fallback = normalizeOrderId(matched?.[0] || '')
	return fallback || '--'
})

const normalizePayMethod = (value?: string): string => {
	const raw = (value || '').trim()
	if (!raw) return '未知支付方式'
	const upper = raw.toUpperCase()
	const compactUpper = upper.replace(/[\s_-]+/g, '')
	if (
		/余额|钱包|账户余额/.test(raw) ||
		/(BALANCE|WALLET|ACCOUNTBALANCE|INTERNALBALANCE|CASHIERBALANCE)/.test(
			compactUpper,
		)
	) {
		return '余额支付'
	}
	if (/微信/.test(raw) || /(WECHAT|WXPAY|WEIXIN)/.test(compactUpper)) {
		return '微信支付'
	}
	if (/支付宝/.test(raw) || /ALIPAY/.test(compactUpper)) return '支付宝'
	if (/APPLE\s*PAY/i.test(raw) || /APPLEPAY/.test(compactUpper))
		return 'Apple Pay'
	return raw
}

const detectPayMethodFromText = (text: string): string => {
	const raw = text.trim()
	if (!raw) return ''
	const upper = raw.toUpperCase()
	const compactUpper = upper.replace(/[\s_-]+/g, '')
	if (
		/余额|钱包|账户余额/.test(raw) ||
		/(BALANCE|WALLET|ACCOUNTBALANCE|INTERNALBALANCE|CASHIERBALANCE)/.test(
			compactUpper,
		)
	) {
		return '余额支付'
	}
	if (/微信/.test(raw) || /(WECHAT|WXPAY|WEIXIN)/.test(compactUpper)) {
		return '微信支付'
	}
	if (/支付宝/.test(raw) || /ALIPAY/.test(compactUpper)) return '支付宝'
	if (/APPLE\s*PAY/i.test(raw) || /APPLEPAY/.test(compactUpper))
		return 'Apple Pay'
	return ''
}

const vipNoticePayMethod = computed(() => {
	const fromField = extractNoticeFieldValue([
		'支付方式',
		'支付渠道',
		'支付类型',
		'支付方式编码',
		'支付渠道编码',
		'渠道编码',
		'payMethod',
		'pay_method',
		'paymentMethod',
		'payment_method',
		'paymentType',
		'payment_type',
		'payType',
		'pay_type',
		'channel',
		'payChannel',
		'pay_channel',
	])
	const fromTextMatched = noticeText.value.match(
		/(?:支付(?:方式|渠道|类型|方式编码|渠道编码)|pay(?:ment)?(?:Method|Type)?|pay(?:_|)?channel|channel)\s*[:：=]\s*([^\n,，;；]+)/i,
	)
	const normalized = normalizePayMethod(
		fromField || fromTextMatched?.[1] || '',
	)
	if (normalized !== '未知支付方式') return normalized
	return detectPayMethodFromText(noticeText.value) || '未知支付方式'
})

const handleViewBenefits = (): void => {
	message.info('会员权益页待接入')
}

const handleViewOrder = (): void => {
	message.info(`订单详情待接入：${vipNoticeOrderId.value}`)
}

const handleRetryVipPay = (): void => {
	message.info('重新支付流程待接入')
}

const handleContactSupport = (): void => {
	message.info('客服入口待接入')
}

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
	(
		e: 'avatar-contextmenu',
		ev: MouseEvent,
		extra: { senderAccount?: string; senderName?: string },
	): void
}>()

const handleAvatarContextMenu = (e: MouseEvent): void => {
	if (!props.enableAvatarMenu || props.isMe) return
	e.preventDefault()
	e.stopPropagation()
	emit('avatar-contextmenu', e, {
		senderAccount: props.senderAccount,
		senderName: props.senderName,
	})
}

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

const isCloudDocShareCard = computed(() =>
	/\bchat-cloud-doc-share-card\b/i.test(props.content || ''),
)

const decodeHtmlEntities = (value: string): string => {
	const text = value.trim()
	if (!text) return ''
	const holder = document.createElement('textarea')
	holder.innerHTML = text
	return holder.value || text
}

const cloudDocShareNo = computed(() => {
	const matched = (props.content || '').match(
		/data-share-no\s*=\s*["']([^"']+)["']/i,
	)
	return matched?.[1]?.trim() || ''
})

const cloudDocShareTitle = computed(() => {
	const titleMatched = (props.content || '').match(
		/data-doc-title\s*=\s*["']([^"']+)["']/i,
	)
	if (titleMatched?.[1]) return decodeHtmlEntities(titleMatched[1])
	const lineMatched = (props.content || '').match(/文档\s*[：:]\s*([^<\n]+)/i)
	return decodeHtmlEntities(lineMatched?.[1] || '')
})

const handleCloudDocCardClick = async (): Promise<void> => {
	const shareNo = cloudDocShareNo.value
	if (!shareNo) {
		message.warning('分享标识缺失，无法打开文档')
		return
	}
	try {
		const shared = await cloudDocStore.fetchSharedDocByShareNo(shareNo)
		if (!shared?.doc?.id) {
			message.warning('分享文档不存在或已失效')
			return
		}
		sidebarSlotStore.openSlot({
			slotKey: `cloud-doc-share:${shareNo}`,
			title: `分享: ${shared.doc.title || '未标题云文档'}`,
			componentKey: 'cloud-doc-shared-editor',
			icon: 'cloudDocs',
		})
	} catch (error) {
		console.error('打开分享云文档失败', error)
		message.error('打开分享文档失败，请稍后重试')
	}
}

const isOnlyImage = computed(() => {
	if (isTransferCard.value || isCloudDocShareCard.value) return false
	if (!props.content) return false
	const decoded = decodeHtmlEntitiesDeep(props.content || '', 3).trim()
	if (!decoded) return false
	const imageOnlyUrl = imageUrlToHtml(decoded)
	const candidate = imageOnlyUrl || decoded
	const container = document.createElement('div')
	container.innerHTML = candidate
	const nodes = Array.from(container.childNodes).filter((node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			return !!(node.nodeValue || '').trim()
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement
			const tag = el.tagName.toLowerCase()
			if (tag === 'br') return false
			return true
		}
		return false
	})
	if (!nodes.length) return false
	return nodes.every((node) => {
		if (node.nodeType !== Node.ELEMENT_NODE) return false
		const el = node as HTMLElement
		const tag = el.tagName.toLowerCase()
		if (tag === 'img') return true
		if (tag !== 'a') return false
		const imgChildren = Array.from(el.children).filter(
			(child) => child.tagName.toLowerCase() === 'img',
		)
		return (
			imgChildren.length === el.children.length && imgChildren.length > 0
		)
	})
})

const renderedContent = computed(() => {
	const decoded = decodeHtmlEntitiesDeep(props.content || '', 3).trim()
	if (!decoded) return ''
	const imageOnlyUrl = imageUrlToHtml(decoded)
	return renderEmojiTokensInHtml(imageOnlyUrl || decoded)
})

const handleClickEvent = (e: MouseEvent): void => {
	const target = e.target as HTMLElement
	const card = target.closest('.chat-cloud-doc-share-card')
	if (card instanceof HTMLElement) {
		void handleCloudDocCardClick()
		return
	}
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
:deep(.msg-content-selectable img:not(.inline-emoji-token)) {
	display: block;
	cursor: pointer;
	max-width: 240px;
	max-height: 320px;
	border-radius: 8px;
	border: #79797a94 solid 1px;
}

:deep(.msg-content-selectable img.inline-emoji-token) {
	display: inline-block;
	width: 1.5em;
	height: 1.5em;
	vertical-align: -0.1em;
	margin: 0 0.04em;
	border: none;
	border-radius: 0;
	cursor: text;
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

.chat-image-bubble {
	padding: 0;
	border-radius: 12px;
	border: 1px solid #dbe3ef;
	background: #f8fbff;
	overflow: hidden;
	line-height: 0;
}

.chat-image-bubble-me {
	border-bottom-right-radius: 6px;
	background: #ecf4ff;
	border-color: #cfe2fb;
}

.chat-image-bubble-other {
	border-bottom-left-radius: 6px;
}

.chat-image-bubble.msg-content-selectable {
	display: block;
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

.bubble-inline-reaction {
	margin-top: 6px;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.message-reaction-chip {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 28px;
	padding: 0 10px 0 9px;
	border-radius: 999px;
	background: rgb(255 255 255 / 75%);
	border: 1px solid #dbe3ef;
}

.message-reaction-emoji {
	font-size: 1.5em;
	line-height: 1;
}

.message-reaction-image {
	width: 1.5em;
	height: 1.5em;
	object-fit: contain;
	display: block;
}

.message-reaction-user {
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
	color: #52607a;
	max-width: 7.5em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cloud-doc-card {
	min-width: 250px;
	max-width: 360px;
	padding: 12px;
	border-radius: 12px;
	border: 1px solid #c9dfff;
	background: linear-gradient(160deg, #f7fbff 0%, #ebf4ff 100%);
	cursor: pointer;
}

.cloud-doc-card-title {
	font-size: 12px;
	font-weight: 700;
	color: #2f7fe7;
}

.cloud-doc-card-name {
	margin-top: 6px;
	font-size: 14px;
	font-weight: 600;
	color: #1f2937;
	word-break: break-all;
}

.cloud-doc-card-desc {
	margin-top: 6px;
	font-size: 11px;
	color: #64748b;
}

.notice-card {
	min-width: 260px;
	max-width: 360px;
	border-radius: 16px;
	padding: 12px 12px 10px;
	border: 1px solid #dbe3f0;
}

.notice-card-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
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

.notice-card-time {
	font-size: 11px;
	line-height: 1.2;
	color: #6b7e99;
	white-space: nowrap;
}

.notice-card-main-title {
	margin-bottom: 8px;
	font-size: 14px;
	font-weight: 700;
	line-height: 1.35;
	color: #1f2937;
}

.notice-card-sender {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 8px;
}

.notice-card-sender-avatar-wrap {
	width: 30px;
	height: 30px;
	flex-shrink: 0;
}

.notice-card-sender-avatar {
	width: 100%;
	height: 100%;
	border-radius: 999px;
	object-fit: cover;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid rgb(148 163 184 / 35%);
	background: #fff;
}

.notice-card-sender-avatar-fallback {
	font-size: 12px;
	font-weight: 700;
	color: #325a8f;
	background: linear-gradient(160deg, #d9e8fb 0%, #c7dcf7 100%);
}

.notice-card-sender-meta {
	min-width: 0;
	display: grid;
	gap: 2px;
}

.notice-card-sender-name {
	font-size: 12px;
	font-weight: 700;
	line-height: 1.25;
	color: #1f2937;
	max-width: 220px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.notice-card-sender-role {
	font-size: 11px;
	line-height: 1.2;
	color: #64748b;
}

.notice-card-body {
	display: grid;
	gap: 6px;
}

.notice-card-body-html {
	padding: 10px;
	border-radius: 12px;
	background: rgb(255 255 255 / 75%);
	border: 1px solid rgb(214 226 242 / 80%);
}

.notice-card-body-html :deep(.notice-card-rich) {
	display: grid;
	gap: 6px;
	font-size: 13px;
	line-height: 1.6;
	color: #2e3b50;
	word-break: break-word;
}

.notice-card-body-html :deep(p) {
	margin: 0;
}

.notice-card-body-html :deep(.notice-card-action) {
	font-size: 1em;
	line-height: 1.5;
	color: #1f2937;
	display: flex;
	align-items: center;
	gap: 8px;
}

.notice-card-body-html :deep(.notice-card-action-text) {
	min-width: 0;
}

.notice-card-body-html :deep(.notice-card-action-avatar) {
	width: 18px;
	height: 18px;
	flex-shrink: 0;
	border-radius: 999px;
	object-fit: cover;
	border: 1px solid rgb(148 163 184 / 35%);
	background: #fff;
}

.notice-card-body-html :deep(.notice-card-action-avatar-fallback) {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	font-weight: 700;
	color: #325a8f;
	background: linear-gradient(160deg, #d9e8fb 0%, #c7dcf7 100%);
}

.notice-card-body-html :deep(.notice-card-paragraph) {
	font-size: 1em;
	line-height: 1.55;
}

.notice-card-body-html :deep(.notice-card-quote) {
	padding: 8px 10px;
	border-radius: 10px;
	background: rgb(230 238 248 / 62%);
	border-left: 3px solid #8fb2e5;
	font-size: 12px;
	color: #334155;
}

.notice-card-body-html :deep(.inline-emoji-token) {
	width: 1.5em;
	height: 1.5em;
	vertical-align: -0.06em;
	margin: 0 0.03em;
}

.notice-card-body-html :deep(img:not(.inline-emoji-token)) {
	display: block;
	max-width: 240px;
	max-height: 220px;
	border-radius: 8px;
	border: 1px solid rgb(148 163 184 / 30%);
}

.notice-card-body-html :deep(img.notice-card-inline-image) {
	display: block;
	max-width: 240px;
	max-height: 220px;
	min-height: 48px;
	object-fit: contain;
	border-radius: 8px;
	background: #f2f5f9;
}

.notice-card-body-html :deep(.notice-card-image-fallback) {
	display: inline-flex;
	align-items: center;
	padding: 4px 8px;
	border-radius: 8px;
	font-size: 12px;
	color: #51627c;
	background: rgb(241 245 249 / 85%);
	border: 1px solid rgb(203 213 225 / 90%);
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

.vip-notice-card {
	min-width: 276px;
	max-width: 380px;
	border-radius: 16px;
	padding: 12px;
	background:
		radial-gradient(
			circle at 88% 6%,
			rgb(255 248 214 / 88%) 0%,
			transparent 42%
		),
		linear-gradient(160deg, #fff4d1 0%, #ebca7a 45%, #c9953f 100%);
	border: 1px solid #c3903e;
	color: #4f330f;
	box-shadow:
		0 10px 20px rgb(121 84 24 / 20%),
		inset 0 1px 0 rgb(255 255 255 / 45%);
}

.vip-notice-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
}

.vip-notice-header-left {
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 8px;
}

.vip-notice-icon-wrap {
	width: 26px;
	height: 26px;
	border-radius: 9px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: rgb(87 54 10 / 22%);
	border: 1px solid rgb(87 54 10 / 28%);
}

.vip-fill-gold {
	filter: drop-shadow(0 1px 0 rgb(255 255 255 / 35%)) saturate(1.1)
		hue-rotate(-4deg);
}

.vip-notice-title {
	font-size: 14px;
	font-weight: 800;
	line-height: 1.25;
}

.vip-notice-subtitle {
	margin-top: 2px;
	font-size: 11px;
	line-height: 1.3;
	opacity: 0.88;
}

.vip-notice-chip {
	flex-shrink: 0;
	max-width: 128px;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 10px;
	line-height: 1.3;
	font-weight: 700;
	background: rgb(255 255 255 / 34%);
	border: 1px solid rgb(87 54 10 / 18%);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.vip-notice-context {
	margin-top: 10px;
	padding: 10px;
	border-radius: 12px;
	background: rgb(255 255 255 / 38%);
	border: 1px solid rgb(87 54 10 / 16%);
	backdrop-filter: blur(3px);
}

.vip-notice-growth-panel {
	padding-bottom: 8px;
	border-bottom: 1px dashed rgb(87 54 10 / 24%);
}

.vip-notice-growth-label {
	font-size: 11px;
	opacity: 0.74;
}

.vip-notice-growth-value-row {
	margin-top: 4px;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
}

.vip-notice-growth-value {
	font-size: 24px;
	font-weight: 900;
	letter-spacing: 0.3px;
	line-height: 1;
}

.vip-notice-level-value {
	font-size: 11px;
	font-weight: 700;
	padding: 2px 8px;
	border-radius: 999px;
	background: rgb(87 54 10 / 12%);
}

.vip-notice-metrics {
	margin-top: 8px;
	display: grid;
	gap: 4px;
}

.vip-notice-main-line {
	font-size: 12px;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 3px;
}

.vip-notice-metric-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	font-size: 11px;
}

.vip-notice-metric-label {
	opacity: 0.76;
}

.vip-notice-metric-value {
	max-width: 190px;
	font-weight: 700;
	text-align: right;
	word-break: break-all;
}

.vip-notice-footer {
	margin-top: 10px;
	padding-top: 8px;
	border-top: 1px solid rgb(87 54 10 / 16%);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.vip-notice-footer-meta {
	font-size: 10px;
	opacity: 0.72;
}

.vip-notice-footer-state {
	font-size: 10px;
	font-weight: 800;
	padding: 2px 8px;
	border-radius: 999px;
	background: rgb(87 54 10 / 14%);
	color: #5a3a11;
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

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useFriendStore } from '@renderer/stores/friend'
import { useWalletStore } from '@renderer/stores/wallet'
import { useMessage } from 'naive-ui'
import ChatMessage from './ChatMessage.vue'
import { resolveAvatarUrl } from '@renderer/utils/avatar'

interface MenuContextExtra {
	text?: string
	src?: string
}

interface RenderMessage extends Message {
	__messageKey: string
}

const props = defineProps<{ messages: Message[] }>()
const chatStore = useChatStore()
const { activeChat, messageJumpTarget } = storeToRefs(chatStore)
const userInfo = useUserInfoStore()
const friendStore = useFriendStore()
const { friends } = storeToRefs(friendStore)
const walletStore = useWalletStore()
const message = useMessage()
const groupMemberProfileMap = ref<
	Record<string, { name?: string; avatar?: string }>
>({})

const viewportRef = ref<HTMLElement | null>(null)
const messageItemRefMap = new Map<string, HTMLElement>()
const isSwitching = ref(false)
const isLoadingMore = ref(false)
const hasMoreByChat = new Map<number, boolean>()
const shouldStickToBottom = ref(true)
const BOTTOM_STICK_THRESHOLD = 220
const TOP_PRELOAD_THRESHOLD = 180
const TOP_LOAD_DEBOUNCE_MS = 120
const TOP_LOAD_MIN_VISIBLE_MS = 300
const prevFirstMessageKey = ref('')
const prevLastMessageKey = ref('')
const lastScrollTop = ref(0)
let topLoadDebounceTimer: ReturnType<typeof setTimeout> | null = null
let scrollIndicatorTimer: ReturnType<typeof setTimeout> | null = null
let jumpHighlightTimer: ReturnType<typeof setTimeout> | null = null
const isScrolling = ref(false)
const highlightedMessageKey = ref('')
const SCROLL_INDICATOR_HIDE_DELAY_MS = 700

const isGroupChatActive = computed(
	() => activeChat.value?.chatType === 'GROUP',
)

const normalizeAccount = (value?: string): string => value?.trim() || ''

const refreshActiveGroupMemberProfiles = async (): Promise<void> => {
	const groupNo = activeChat.value?.groupNo?.trim()
	if (!isGroupChatActive.value || !groupNo) {
		groupMemberProfileMap.value = {}
		return
	}
	try {
		const members = await chatStore.getGroupMembers(groupNo)
		const nextMap: Record<string, { name?: string; avatar?: string }> = {}
		for (const member of members) {
			const account = normalizeAccount(member.account)
			if (!account) continue
			nextMap[account] = {
				name: member.name?.trim() || undefined,
				avatar: member.avatarUrl?.trim() || undefined,
			}
		}
		groupMemberProfileMap.value = nextMap
	} catch (error) {
		console.warn('拉取群成员资料失败:', error)
	}
}

const resolveMessageSenderAccount = (item: Message): string => {
	const account = normalizeAccount(item.senderAccount)
	if (account) return account
	if (item.senderId === 'me') {
		return normalizeAccount(userInfo.account)
	}
	if (activeChat.value?.chatType === 'PRIVATE') {
		return normalizeAccount(activeChat.value.peerAccount)
	}
	return ''
}

const resolveMessageName = (item: Message): string => {
	if (item.senderId === 'me') {
		return userInfo.userName?.trim() || userInfo.account?.trim() || '我'
	}
	const senderAccount = resolveMessageSenderAccount(item)
	if (isGroupChatActive.value) {
		const groupProfile = senderAccount
			? groupMemberProfileMap.value[senderAccount]
			: undefined
		const friendProfile = senderAccount
			? friends.value.find((friend) => friend.id === senderAccount)
			: undefined
		return (
			item.senderName?.trim() ||
			groupProfile?.name?.trim() ||
			friendProfile?.remark?.trim() ||
			friendProfile?.name?.trim() ||
			senderAccount ||
			'群成员'
		)
	}
	return activeChat.value?.name?.trim() || senderAccount || '对方'
}

const resolveMessageAvatar = (item: Message): string => {
	const senderAccount = resolveMessageSenderAccount(item)
	if (item.senderId === 'me') {
		return resolveAvatarUrl(
			userInfo.avatarUrl?.trim() ||
				item.senderAvatar?.trim() ||
				`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(senderAccount || 'me')}`,
		)
	}
	if (isGroupChatActive.value) {
		const groupProfile = senderAccount
			? groupMemberProfileMap.value[senderAccount]
			: undefined
		const friendProfile = senderAccount
			? friends.value.find((friend) => friend.id === senderAccount)
			: undefined
		const candidate =
			item.senderAvatar?.trim() ||
			groupProfile?.avatar?.trim() ||
			friendProfile?.avatar?.trim() ||
			`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(senderAccount || 'group-member')}`
		return resolveAvatarUrl(candidate)
	}
	return resolveAvatarUrl(
		activeChat.value?.avatar ||
			item.senderAvatar?.trim() ||
			`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(senderAccount || 'peer')}`,
	)
}

const shouldShowSenderName = (item: Message): boolean => {
	return isGroupChatActive.value && item.senderId !== 'me'
}

// --- 统一的右键状态 ---
const showDropdown = ref(false)
const xRef = ref(0)
const yRef = ref(0)
const currentOptions = ref<Array<Record<string, unknown>>>([])
const contextData = ref<{
	type: 'text' | 'image'
	extra: MenuContextExtra
	msg: Message
} | null>(null)
const transferStatusMap = ref<Record<string, 'pending' | 'accepting' | 'accepted'>>({})
const showTransferDetailModal = ref(false)
const transferDetail = ref<{
	businessNo: string
	amountText: string
	remarkText: string
	confirmTimeText: string
}>({
	businessNo: '',
	amountText: '',
	remarkText: '',
	confirmTimeText: '',
})
const showTransferConfirmModal = ref(false)
const pendingTransferConfirm = ref<{
	businessNo: string
	amountText: string
	remarkText: string
}>({
	businessNo: '',
	amountText: '',
	remarkText: '',
})

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

const extractTransferBusinessNo = (content: string): string => {
	const dataMatched = content.match(/data-business-no\s*=\s*["']([^"']+)["']/i)
	if (dataMatched?.[1]?.trim()) return dataMatched[1].trim()
	const textMatched = content.match(/交易号\s*[：:]\s*([^<\n]+)/i)
	if (!textMatched) return ''
	return textMatched[1]?.trim() || ''
}

const hasTransferReceiptMarker = (content: string): boolean => {
	return /\bchat-transfer-receipt-card\b/i.test(content)
}

const hasTransferRefundMarker = (content: string): boolean => {
	return /\bchat-transfer-refund-card\b/i.test(content)
}

const receiptBusinessNoSet = computed<Set<string>>(() => {
	const set = new Set<string>()
	for (const row of props.messages) {
		if (!hasTransferReceiptMarker(row.text || '')) continue
		const businessNo = extractTransferBusinessNo(row.text || '')
		if (!businessNo) continue
		set.add(businessNo)
	}
	return set
})

const refundBusinessNoSet = computed<Set<string>>(() => {
	const set = new Set<string>()
	for (const row of props.messages) {
		if (!hasTransferRefundMarker(row.text || '')) continue
		const businessNo = extractTransferBusinessNo(row.text || '')
		if (!businessNo) continue
		set.add(businessNo)
	}
	return set
})

const getTransferStatus = (
	item: Message,
): 'pending' | 'accepting' | 'accepted' | 'refunded' => {
	if (hasTransferRefundMarker(item.text || '')) return 'refunded'
	if (hasTransferReceiptMarker(item.text || '')) return 'accepted'
	const businessNo = extractTransferBusinessNo(item.text || '')
	if (!businessNo) return 'pending'
	if (refundBusinessNoSet.value.has(businessNo)) return 'refunded'
	if (receiptBusinessNoSet.value.has(businessNo)) return 'accepted'
	return transferStatusMap.value[businessNo] || 'pending'
}

const openTransferDetail = (payload: {
	businessNo: string
	amountText: string
	remarkText: string
	confirmTimeText: string
}): void => {
	transferDetail.value = {
		businessNo: payload.businessNo || '',
		amountText: payload.amountText || '',
		remarkText: payload.remarkText || '',
		confirmTimeText: payload.confirmTimeText || '',
	}
	showTransferDetailModal.value = true
}

const openTransferConfirmModal = (
	payload: { businessNo: string; amountText: string; remarkText: string },
): void => {
	const businessNo = payload.businessNo?.trim()
	if (!businessNo) {
		message.warning('转账信息缺少交易号，无法接受')
		return
	}
	const currentStatus = transferStatusMap.value[businessNo] || 'pending'
	if (currentStatus === 'accepted' || currentStatus === 'accepting') return
	pendingTransferConfirm.value = {
		businessNo,
		amountText: payload.amountText?.trim() || '',
		remarkText: payload.remarkText?.trim() || '',
	}
	showTransferConfirmModal.value = true
}

const handleTransferAccept = async (): Promise<void> => {
	const businessNo = pendingTransferConfirm.value.businessNo?.trim()
	if (!businessNo) return
	const currentStatus = transferStatusMap.value[businessNo] || 'pending'
	if (currentStatus === 'accepted' || currentStatus === 'accepting') {
		showTransferConfirmModal.value = false
		return
	}
	transferStatusMap.value[businessNo] = 'accepting'
	const amountText = pendingTransferConfirm.value.amountText?.trim()
	const remarkText = pendingTransferConfirm.value.remarkText?.trim()
	try {
		await walletStore.acceptTransfer({ businessNo })
		transferStatusMap.value[businessNo] = 'accepted'
		const confirmTimeText = new Date().toLocaleString('zh-CN', {
			hour12: false,
		})
		const receiptHtml = `
<div class="chat-transfer-receipt-card" data-business-no="${escapeHtml(businessNo)}">
	<div><strong>转账已收款</strong></div>
	${amountText ? `<div>金额：${escapeHtml(amountText)}</div>` : ''}
	${remarkText ? `<div>备注：${escapeHtml(remarkText)}</div>` : ''}
	<div>确认时间：${escapeHtml(confirmTimeText)}</div>
</div>`.trim()
		chatStore.sendMessage(receiptHtml, 'transfer')
		showTransferConfirmModal.value = false
		message.success('转账已确认并入账')
	} catch (error) {
		transferStatusMap.value[businessNo] = 'pending'
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(maybeResponse?.data?.message || '接受转账失败，请稍后重试')
	}
}

const onShowMenu = (
	e: MouseEvent,
	type: 'text' | 'image',
	extra: MenuContextExtra,
	msg: Message,
): void => {
	e.preventDefault()
	showDropdown.value = false
	contextData.value = { type, extra, msg }

	if (type === 'image') {
		currentOptions.value = [
			{ label: '查看图片', key: 'view' },
			{ label: '复制图片链接', key: 'copy-link' },
			{ label: '保存到本地', key: 'save' },
			{ type: 'divider', key: 'd1' },
			{ label: '删除', key: 'delete' },
		]
	} else {
		const hasSelection = !!extra?.text
		currentOptions.value = [
			{
				label: hasSelection ? '复制选中文字' : '复制整条消息',
				key: 'copy',
			},
			{ label: '转发', key: 'forward' },
			{ type: 'divider', key: 'd1' },
			{ label: '删除', key: 'delete' },
		]
	}

	nextTick(() => {
		xRef.value = e.clientX
		yRef.value = e.clientY
		showDropdown.value = true
	})
}

const handleMenuSelect = (key: string): void => {
	showDropdown.value = false
	const { extra, msg } = contextData.value || {}

	switch (key) {
		case 'copy': {
			const text = extra?.text || msg?.text?.replace(/<[^>]*>/g, '') || ''
			navigator.clipboard.writeText(text)
			break
		}
		case 'copy-link':
			navigator.clipboard.writeText(extra?.src || '')
			break
		case 'save':
			window.electron.ipcRenderer.send('save-image', extra?.src)
			break
		case 'view':
			window.electron.ipcRenderer.send('view-img', extra?.src)
			break
		case 'delete':
			if (msg) {
				console.log('删除 ID:', msg.id)
			}
			break
	}
}

const getViewport = (): HTMLElement | null => viewportRef.value

const getMessageKey = (item: Message): string => {
	return `${item.id}-${item.serverMessageId || ''}-${item.clientMessageId || ''}-${item.sentAt || item.timestamp}-${item.senderId}`
}

const setMessageItemRef = (key: string, el: unknown): void => {
	if (el instanceof HTMLElement) {
		messageItemRefMap.set(key, el)
		return
	}
	if (
		el &&
		typeof el === 'object' &&
		'$el' in el &&
		(el as { $el?: unknown }).$el instanceof HTMLElement
	) {
		messageItemRefMap.set(key, (el as { $el: HTMLElement }).$el)
		return
	}
	messageItemRefMap.delete(key)
}

const buildRenderDedupKey = (item: Message): string => {
	const serverId = item.serverMessageId?.trim() || ''
	if (serverId) return `s:${serverId}`
	const clientId = item.clientMessageId?.trim() || ''
	if (clientId) return `c:${clientId}`
	const sentAt = item.sentAt?.trim() || ''
	const time = sentAt || item.timestamp || 'no-time'
	return `f:${item.senderId}|${item.senderAccount || ''}|${item.type}|${time}|${item.text || ''}`
}

const compactRenderMessages = (rows: Message[]): Message[] => {
	if (rows.length <= 1) return rows
	const seen = new Set<string>()
	const compacted: Message[] = []
	for (const row of rows) {
		const key = buildRenderDedupKey(row)
		if (seen.has(key)) continue
		seen.add(key)
		compacted.push(row)
	}
	return compacted
}

const virtualMessages = computed<RenderMessage[]>(() =>
	compactRenderMessages(props.messages).map((item) => ({
		...item,
		__messageKey: getMessageKey(item),
	})),
)

const isNearBottom = (threshold = BOTTOM_STICK_THRESHOLD): boolean => {
	const viewport = getViewport()
	if (!viewport) return true
	const distanceToBottom =
		viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
	return distanceToBottom <= threshold
}

const getMessageTimeScore = (item: Message): number => {
	if (item.sentAt) {
		const t = new Date(item.sentAt).getTime()
		if (!Number.isNaN(t)) return t
	}
	const ts = new Date(item.timestamp || '').getTime()
	if (!Number.isNaN(ts)) return ts
	const serverId = Number(item.serverMessageId || '')
	if (Number.isFinite(serverId) && serverId > 0) return serverId
	return Number(item.id) || 0
}

const getLatestMessageKey = (): string => {
	if (!virtualMessages.value.length) return ''
	let best = virtualMessages.value[0]
	let bestScore = getMessageTimeScore(best)
	for (let i = 1; i < virtualMessages.value.length; i += 1) {
		const row = virtualMessages.value[i]
		const score = getMessageTimeScore(row)
		if (score >= bestScore) {
			best = row
			bestScore = score
		}
	}
	return best.__messageKey
}

const logLatestMessageTime = (): void => {
	if (!import.meta.env.DEV) return
	if (!props.messages.length) return
	const latest = props.messages[props.messages.length - 1]
	const rawTime = latest.sentAt?.trim() || latest.timestamp?.trim() || '-'
	console.info('[chat-message-time]', {
		chatId: activeChat.value?.id ?? null,
		messageId:
			latest.serverMessageId || latest.clientMessageId || latest.id,
		rawTime,
		displayTime: latest.timestamp || '-',
	})
}

const logAllMessageTimes = (reason: string): void => {
	if (!import.meta.env.DEV) return
	if (!props.messages.length) {
		console.info('[chat-message-time-all]', {
			reason,
			chatId: activeChat.value?.id ?? null,
			count: 0,
			rows: [],
		})
		return
	}
	const rows = props.messages.map((item, index) => ({
		index,
		messageId: item.serverMessageId || item.clientMessageId || item.id,
		rawTime: item.sentAt?.trim() || item.timestamp?.trim() || '-',
		sentAt: item.sentAt || '',
		displayTime: item.timestamp || '-',
	}))
	console.info('[chat-message-time-all]', {
		reason,
		chatId: activeChat.value?.id ?? null,
		count: rows.length,
		rows,
	})
}

const scrollToLatestMessage = (behavior: ScrollBehavior = 'auto'): void => {
	if (!virtualMessages.value.length) return
	nextTick(() => {
		requestAnimationFrame(() => {
			const viewport = getViewport()
			if (!viewport) return
			const latestKey = getLatestMessageKey()
			const latestEl = latestKey ? messageItemRefMap.get(latestKey) : null
			if (latestEl) {
				latestEl.scrollIntoView({ block: 'end', behavior })
			}
			viewport.scrollTop = viewport.scrollHeight
		})
	})
}

const findMessageKeyByJumpTarget = (
	target: NonNullable<typeof messageJumpTarget.value>,
): string => {
	const targetServerId = target.serverMessageId?.trim() || ''
	const targetClientId = target.clientMessageId?.trim() || ''
	for (const item of virtualMessages.value) {
		if (item.id === target.messageId) return item.__messageKey
		if (
			targetServerId &&
			(item.serverMessageId?.trim() || '') === targetServerId
		) {
			return item.__messageKey
		}
		if (
			targetClientId &&
			(item.clientMessageId?.trim() || '') === targetClientId
		) {
			return item.__messageKey
		}
	}
	return ''
}

const jumpToTargetMessage = (): void => {
	const target = messageJumpTarget.value
	if (!target) return
	if (!activeChat.value || activeChat.value.id !== target.chatId) return

	nextTick(() => {
		requestAnimationFrame(() => {
			const key = findMessageKeyByJumpTarget(target)
			if (!key) return
			const targetEl = messageItemRefMap.get(key)
			if (!targetEl) return
			targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
			highlightedMessageKey.value = key
			if (jumpHighlightTimer) {
				clearTimeout(jumpHighlightTimer)
			}
			jumpHighlightTimer = setTimeout(() => {
				highlightedMessageKey.value = ''
				jumpHighlightTimer = null
			}, 1800)
			chatStore.clearMessageJump()
		})
	})
}

const handleImageLoaded = (): void => {
	const viewport = getViewport()
	if (!viewport) return
	const distanceToBottom =
		viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
	if (
		shouldStickToBottom.value ||
		distanceToBottom < BOTTOM_STICK_THRESHOLD
	) {
		scrollToLatestMessage('auto')
	}
}

const loadMoreAtTop = async (): Promise<void> => {
	const chatId = activeChat.value?.id
	if (!chatId || isLoadingMore.value) return
	if (hasMoreByChat.get(chatId) === false) return
	const viewport = getViewport()
	if (!viewport) return

	isLoadingMore.value = true
	const loadingStartAt = Date.now()
	const prevHeight = viewport.scrollHeight
	const prevTop = viewport.scrollTop
	try {
		const hasMore = await chatStore.loadMoreChatHistory(chatId, 20)
		hasMoreByChat.set(chatId, hasMore)
		await nextTick()
		const nextHeight = viewport.scrollHeight
		viewport.scrollTop = Math.max(0, nextHeight - prevHeight + prevTop)
	} catch (error) {
		console.warn('加载更多聊天记录失败:', error)
	} finally {
		const elapsed = Date.now() - loadingStartAt
		if (elapsed < TOP_LOAD_MIN_VISIBLE_MS) {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, TOP_LOAD_MIN_VISIBLE_MS - elapsed)
			})
		}
		isLoadingMore.value = false
	}
}

const scheduleTopLoad = (): void => {
	if (topLoadDebounceTimer) {
		clearTimeout(topLoadDebounceTimer)
	}
	topLoadDebounceTimer = setTimeout(() => {
		topLoadDebounceTimer = null
		const viewport = getViewport()
		if (!viewport) return
		if (viewport.scrollTop <= TOP_PRELOAD_THRESHOLD) {
			void loadMoreAtTop()
		}
	}, TOP_LOAD_DEBOUNCE_MS)
}

const onViewportScroll = (): void => {
	if (isSwitching.value) return
	const viewport = getViewport()
	if (!viewport) return
	isScrolling.value = true
	if (scrollIndicatorTimer) {
		clearTimeout(scrollIndicatorTimer)
	}
	scrollIndicatorTimer = setTimeout(() => {
		isScrolling.value = false
		scrollIndicatorTimer = null
	}, SCROLL_INDICATOR_HIDE_DELAY_MS)
	const currentTop = viewport.scrollTop
	const isScrollingUp = currentTop <= lastScrollTop.value

	const distanceToBottom =
		viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
	shouldStickToBottom.value = distanceToBottom < BOTTOM_STICK_THRESHOLD

	if (isScrollingUp && currentTop <= TOP_PRELOAD_THRESHOLD) {
		scheduleTopLoad()
	}
	lastScrollTop.value = currentTop
}

watch(
	() => props.messages.length,
	(newLen, oldLen) => {
		const nearBottomBeforeAppend = isNearBottom()
		const currentFirstKey =
			newLen > 0 ? getMessageKey(props.messages[0]) : ''
		const currentLastKey =
			newLen > 0 ? getMessageKey(props.messages[newLen - 1]) : ''
		const oldFirstKey = prevFirstMessageKey.value
		const oldLastKey = prevLastMessageKey.value
		prevFirstMessageKey.value = currentFirstKey
		prevLastMessageKey.value = currentLastKey

		if (isSwitching.value) return
		if (newLen <= oldLen) return
		logLatestMessageTime()
		logAllMessageTimes('messages-appended')
		if (oldLen === 0) {
			shouldStickToBottom.value = true
			scrollToLatestMessage('auto')
			return
		}

		const isPrepend =
			oldFirstKey !== currentFirstKey && oldLastKey === currentLastKey
		const isAppend = oldLastKey !== currentLastKey

		if (isPrepend) return
		if (isAppend) {
			const latestMessage = props.messages[newLen - 1]
			const isOutgoing = latestMessage?.senderId === 'me'
			if (
				!isOutgoing &&
				!nearBottomBeforeAppend &&
				!shouldStickToBottom.value
			) {
				return
			}
			scrollToLatestMessage('auto')
		}
	},
)

watch(
	() => activeChat.value?.id,
	async (newId) => {
		isSwitching.value = true
		await nextTick()
		if (newId) {
			shouldStickToBottom.value = true
			if (!hasMoreByChat.has(newId)) {
				hasMoreByChat.set(newId, true)
			}
			const list = props.messages
			prevFirstMessageKey.value =
				list.length > 0 ? getMessageKey(list[0]) : ''
			prevLastMessageKey.value =
				list.length > 0 ? getMessageKey(list[list.length - 1]) : ''
			lastScrollTop.value = 0
			logAllMessageTimes('chat-switched')
			scrollToLatestMessage('auto')
			jumpToTargetMessage()
			requestAnimationFrame(() => {
				isSwitching.value = false
			})
		}
	},
	{ immediate: true },
)

watch(
	() => [activeChat.value?.id, activeChat.value?.groupNo, activeChat.value?.chatType],
	() => {
		void refreshActiveGroupMemberProfiles()
	},
	{ immediate: true },
)

watch(
	() => messageJumpTarget.value?.token,
	() => {
		jumpToTargetMessage()
	},
)

onMounted(() => {
	scrollToLatestMessage('auto')
})

onBeforeUnmount(() => {
	if (topLoadDebounceTimer) {
		clearTimeout(topLoadDebounceTimer)
		topLoadDebounceTimer = null
	}
	if (scrollIndicatorTimer) {
		clearTimeout(scrollIndicatorTimer)
		scrollIndicatorTimer = null
	}
	if (jumpHighlightTimer) {
		clearTimeout(jumpHighlightTimer)
		jumpHighlightTimer = null
	}
})
</script>

<template>
	<div class="h-full relative overflow-hidden bg-page-bg">
		<div v-if="isSwitching" class="absolute inset-0 z-10 bg-page-bg" />

		<div
			ref="viewportRef"
			class="h-full overflow-y-auto message-viewport"
			:class="{ 'is-scrolling': isScrolling }"
			@scroll.passive="onViewportScroll"
		>
			<div
				v-if="isLoadingMore"
				class="py-2 text-center text-xs text-gray-400"
			>
				加载历史消息中...
			</div>
			<div
				v-for="item in virtualMessages"
				:key="item.__messageKey"
				:ref="(el) => setMessageItemRef(item.__messageKey, el)"
				class="px-4 py-2 message-row"
				:class="{
					'is-jump-highlight':
						highlightedMessageKey === item.__messageKey,
				}"
			>
				<chat-message
					v-bind="item"
					:content="item.text"
					:message-type="item.type"
					:transfer-status="getTransferStatus(item)"
					:transfer-target-name="activeChat?.name || ''"
					:sender-name="shouldShowSenderName(item) ? resolveMessageName(item) : ''"
					:is-me="item.senderId === 'me'"
					:avatar="resolveMessageAvatar(item)"
					:time="item.timestamp"
					@image-loaded="handleImageLoaded"
					@contextmenu="
						(e, type, extra) => onShowMenu(e, type, extra, item)
					"
					@transfer-accept="openTransferConfirmModal"
					@transfer-detail="openTransferDetail"
				/>
			</div>
		</div>

		<n-dropdown
			size="small"
			trigger="manual"
			placement="bottom-start"
			:show="showDropdown"
			:x="xRef"
			:y="yRef"
			:options="currentOptions"
			@select="handleMenuSelect"
			@clickoutside="showDropdown = false"
		/>

		<n-modal
			v-model:show="showTransferDetailModal"
			preset="card"
			title="转账详情"
			style="width: min(420px, 92vw)"
			:mask-closable="true"
		>
			<div class="space-y-2 text-sm">
				<div><strong>交易号：</strong>{{ transferDetail.businessNo || '-' }}</div>
				<div><strong>金额：</strong>{{ transferDetail.amountText || '-' }}</div>
				<div><strong>备注：</strong>{{ transferDetail.remarkText || '-' }}</div>
				<div><strong>确认时间：</strong>{{ transferDetail.confirmTimeText || '-' }}</div>
			</div>
		</n-modal>

		<n-modal
			v-model:show="showTransferConfirmModal"
			preset="card"
			title="确认收款"
			style="width: min(360px, 92vw)"
			:mask-closable="false"
		>
			<div class="transfer-confirm-body">
				<div class="transfer-confirm-amount">
					{{ pendingTransferConfirm.amountText || '-' }}
				</div>
				<div class="transfer-confirm-actions">
					<n-button
						type="primary"
						block
						:loading="
							transferStatusMap[pendingTransferConfirm.businessNo] ===
							'accepting'
						"
						@click="handleTransferAccept"
					>
						确认收款
					</n-button>
					<div class="transfer-confirm-refund-text">退还</div>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<style scoped>
.message-row {
	content-visibility: auto;
	contain-intrinsic-size: 80px;
}

.message-row.is-jump-highlight {
	background: rgba(54, 149, 255, 0.14);
	border-radius: 6px;
	animation: jump-highlight-fade 1.8s ease-out forwards;
}

@keyframes jump-highlight-fade {
	0% {
		background: rgba(54, 149, 255, 0.22);
	}
	100% {
		background: rgba(54, 149, 255, 0);
	}
}

.message-viewport {
	scrollbar-width: thin;
	scrollbar-color: transparent transparent;
}

.message-viewport::-webkit-scrollbar {
	width: 6px;
}

.message-viewport::-webkit-scrollbar-track {
	background: transparent;
}

.message-viewport::-webkit-scrollbar-thumb {
	background-color: transparent;
	border-radius: 999px;
}

.message-viewport:hover,
.message-viewport.is-scrolling {
	scrollbar-color: rgba(148, 163, 184, 0.65) transparent;
}

.message-viewport:hover::-webkit-scrollbar-thumb,
.message-viewport.is-scrolling::-webkit-scrollbar-thumb {
	background-color: rgba(148, 163, 184, 0.65);
}

.transfer-confirm-body {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.transfer-confirm-amount {
	text-align: center;
	font-size: 30px;
	line-height: 1.2;
	font-weight: 700;
	color: var(--color-text-main);
	padding: 6px 0 2px;
}

.transfer-confirm-actions {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.transfer-confirm-refund-text {
	text-align: center;
	font-size: 13px;
	color: #6b7280;
}
</style>

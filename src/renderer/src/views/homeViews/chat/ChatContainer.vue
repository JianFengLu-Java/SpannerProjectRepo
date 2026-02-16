<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import ChatMessage from './ChatMessage.vue'

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
	return `f:${item.senderId}|${item.type}|${time}|${item.text || ''}`
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
					:is-me="item.senderId === 'me'"
					:avatar="
						item.senderId === 'me'
							? userInfo.avatarUrl
							: activeChat?.avatar
					"
					:time="item.timestamp"
					@image-loaded="handleImageLoaded"
					@contextmenu="
						(e, type, extra) => onShowMenu(e, type, extra, item)
					"
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
</style>

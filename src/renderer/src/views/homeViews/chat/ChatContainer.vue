<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import ChatMessage from './ChatMessage.vue'

interface VirtualListScrollOptions {
	index?: number
	top?: number
	behavior?: 'auto' | 'smooth'
}

interface VirtualListInst {
	scrollTo: (options: VirtualListScrollOptions) => void
	$el?: HTMLElement
}

interface MenuContextExtra {
	text?: string
	src?: string
}

const props = defineProps<{ messages: Message[] }>()
const chatStore = useChatStore()
const { activeChat } = storeToRefs(chatStore)
const userInfo = useUserInfoStore()

const virtualListInst = ref<VirtualListInst | null>(null)
const isSwitching = ref(false)
const isLoadingMore = ref(false)
const hasMoreByChat = new Map<number, boolean>()
const shouldStickToBottom = ref(true)
const prevFirstMessageKey = ref('')
const prevLastMessageKey = ref('')

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
			// TODO: 调用删除 API
			if (msg) {
				console.log('删除 ID:', msg.id)
			}
			break
	}
}

// --- 滚动与图片逻辑（保持不变） ---
const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto'): void => {
	if (!virtualListInst.value || props.messages.length === 0) return
	requestAnimationFrame(() => {
		virtualListInst.value?.scrollTo({
			index: props.messages.length - 1,
			behavior,
		})
	})
}

const handleImageLoaded = (): void => {
	const el = getViewport()
	if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
		scrollToBottom('smooth')
	}
}

const getViewport = (): HTMLElement | null => {
	return (
		virtualListInst.value?.$el?.querySelector('.n-virtual-list-viewport') ||
		null
	)
}

const getMessageKey = (item: Message): string => {
	return `${item.serverMessageId || item.clientMessageId || item.id}`
}

const loadMoreAtTop = async (): Promise<void> => {
	const chatId = activeChat.value?.id
	if (!chatId || isLoadingMore.value) return
	if (hasMoreByChat.get(chatId) === false) return
	const viewport = getViewport()
	if (!viewport) return

	isLoadingMore.value = true
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
		isLoadingMore.value = false
	}
}

const onViewportScroll = (): void => {
	if (isSwitching.value) return
	const viewport = getViewport()
	if (!viewport) return

	const distanceToBottom =
		viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
	shouldStickToBottom.value = distanceToBottom < 180

	if (viewport.scrollTop <= 30) {
		void loadMoreAtTop()
	}
}

const bindViewportScroll = (): void => {
	const viewport = getViewport()
	if (!viewport) return
	viewport.removeEventListener('scroll', onViewportScroll)
	viewport.addEventListener('scroll', onViewportScroll, { passive: true })
}

const unbindViewportScroll = (): void => {
	const viewport = getViewport()
	viewport?.removeEventListener('scroll', onViewportScroll)
}

watch(
	() => props.messages.length,
	(newLen, oldLen) => {
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
		if (oldLen === 0) {
			scrollToBottom('auto')
			return
		}

		const isPrepend =
			oldFirstKey !== currentFirstKey && oldLastKey === currentLastKey
		const isAppend = oldLastKey !== currentLastKey

		if (isPrepend) return
		if (isAppend && shouldStickToBottom.value) {
			scrollToBottom('smooth')
		}
	},
)

const scrollMap = new Map<string, number>()
watch(
	() => activeChat.value?.id,
	async (newId, oldId) => {
		const el = getViewport()
		if (oldId && el) scrollMap.set(oldId.toString(), el.scrollTop)
		isSwitching.value = true
		unbindViewportScroll()
		await nextTick()
		bindViewportScroll()
		if (newId) {
			if (!hasMoreByChat.has(newId)) {
				hasMoreByChat.set(newId, true)
			}
			const list = props.messages
			prevFirstMessageKey.value =
				list.length > 0 ? getMessageKey(list[0]) : ''
			prevLastMessageKey.value =
				list.length > 0 ? getMessageKey(list[list.length - 1]) : ''
			const savedPos = scrollMap.get(newId.toString())
			if (savedPos !== undefined) {
				requestAnimationFrame(() => {
					virtualListInst.value?.scrollTo({ top: savedPos })
					isSwitching.value = false
				})
			} else {
				scrollToBottom('auto')
				requestAnimationFrame(() => {
					isSwitching.value = false
				})
			}
		}
	},
	{ immediate: true },
)

onMounted(() => {
	bindViewportScroll()
	scrollToBottom('auto')
})

onUnmounted(() => {
	unbindViewportScroll()
})
</script>

<template>
	<div class="h-full relative overflow-hidden bg-page-bg">
		<div v-if="isSwitching" class="absolute inset-0 z-10 bg-page-bg" />

		<n-virtual-list
			ref="virtualListInst"
			class="h-full"
			:items="messages"
			:item-size="80"
			item-resizable
			key-field="id"
		>
			<template #default="{ item }">
				<div :key="item.id" class="px-4 py-2">
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
			</template>
		</n-virtual-list>

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

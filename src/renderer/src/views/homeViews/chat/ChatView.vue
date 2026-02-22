<template>
	<div ref="containerRef" class="h-full w-full flex overflow-hidden">
		<!-- 左侧聊天列表 (上下文菜单) -->
		<n-dropdown
			placement="bottom-start"
			trigger="manual"
			:x="contextMenuX"
			:y="contextMenuY"
			:options="contextMenuOptions"
			:show="showContextMenu"
			:on-clickoutside="closeContextMenu"
			@select="handleContextMenuSelect"
		/>

		<!-- 会话列表容器 -->
		<div
			v-if="containerWidth >= 600 || !activeChatId"
			class="h-full flex flex-col bg-page-bg border-r border-border-default/50 shrink-0 overflow-hidden relative"
			:class="[containerWidth < 600 ? 'w-full border-r-0!' : '']"
			:style="{
				width: containerWidth >= 600 ? `${listWidth}px` : '100%',
			}"
		>
			<!-- 顶部标题与搜索 (参考 FriendList 风格) -->
			<div class="p-4 pb-2">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-lg font-bold text-text-main">消息</h2>
					<div class="flex items-center gap-1">
						<n-dropdown
							:options="filterOptions"
							trigger="hover"
							placement="bottom-start"
							@select="handleFilterSelect"
						>
							<div
								class="w-7 h-7 flex items-center no-drag justify-center rounded-xl hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
							>
								<n-icon size="18" class="text-gray-500">
									<Filter24Regular />
								</n-icon>
							</div>
						</n-dropdown>
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 flex items-center no-drag justify-center rounded-xl hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
									@click="handleNewChat"
								>
									<n-icon size="20" class="text-gray-500">
										<Chat24Regular />
									</n-icon>
								</div>
							</template>
							发起聊天
						</n-tooltip>
					</div>
				</div>

				<!-- 搜索栏 -->
				<n-input
					v-model:value="searchQuery"
					placeholder="搜索聊天或记录..."
					size="small"
					class="bg-gray-100/50 dark:bg-zinc-800/60 border-none mb-1"
				>
					<template #prefix>
						<n-icon class="text-gray-400">
							<Search24Regular />
						</n-icon>
					</template>
				</n-input>
			</div>

			<!-- 置顶会话 (水平滑动风格或紧凑风格) -->
			<div
				v-if="filteredPinnedChats.length > 0 && !searchQuery"
				class="px-2 pb-2 mb-1"
			>
				<div class="flex items-center gap-2 px-2 mb-2">
					<span
						class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
						>置顶消息</span
					>
				</div>
				<div
					class="flex overflow-x-auto no-scrollbar gap-1.5 px-1 py-1"
				>
					<div
						v-for="chat in filteredPinnedChats"
						:key="chat.id"
						class="flex flex-col items-center gap-1.5 p-2 rounded-[6px] cursor-copy transition-all duration-200 relative shrink-0 w-[68px]"
						:class="[
							activeChatId === chat.id
								? 'bg-primary/10'
								: 'hover:bg-black/5 dark:hover:bg-white/6',
						]"
						@click="selectChat(chat)"
						@contextmenu.prevent="openContextMenu($event, chat)"
					>
						<n-badge
							:value="chat.unreadCount"
							color="#ef4444"
							:offset="[-2, 2]"
							size="small"
						>
							<div class="relative">
								<n-avatar
									:size="42"
									round
									:src="chat.avatar"
									class="border-2 border-white dark:border-zinc-700"
								/>
								<div
									v-if="isSystemNotificationChat(chat)"
									class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-700 text-white text-[9px] leading-none flex items-center justify-center"
								>
									讯
								</div>
								<div
									v-else-if="chat.chatType === 'GROUP'"
									class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-700 text-white text-[9px] leading-none flex items-center justify-center"
								>
									群
								</div>
								<div
									v-else-if="chat.online"
									class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-blue-500 text-white text-[9px] leading-none flex items-center justify-center"
								>
									在
								</div>
								<div
									v-else
									class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-500 text-white text-[9px] leading-none flex items-center justify-center"
								>
									离
								</div>
							</div>
						</n-badge>
						<span
							class="flex w-full items-center justify-center gap-1 overflow-hidden"
						>
							<span
								class="truncate text-[10px] font-medium"
								:class="
									chat.chatType === 'GROUP'
										? 'text-gray-500 dark:text-gray-300'
										: isVipChat(chat)
											? 'text-red-500 font-semibold'
											: 'text-text-main'
								"
							>
								{{ chat.name }}
							</span>
							<span
								v-if="hasMentionFeedback(chat)"
								class="shrink-0 rounded px-1 py-[1px] text-[9px] font-semibold text-red-500 bg-red-50"
							>
								@你
							</span>
							<img
								v-if="isVipChat(chat)"
								:src="vipBadgeIcon"
								alt="VIP"
								class="h-4 w-4 block vip-fill-red shrink-0"
							/>
						</span>
					</div>
				</div>
			</div>

			<!-- 所有聊天 (虚拟列表) -->
			<div class="flex-1 overflow-hidden">
				<div
					v-if="!searchQuery"
					class="flex items-center gap-2 px-4 mb-1"
				>
					<span
						class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
						>所有消息</span
					>
				</div>

				<div
					ref="chatListScrollRef"
					class="chat-list-scrollbar h-full overflow-y-auto px-2 pb-4"
				>
					<div
						v-for="chat in filteredChatList"
						:key="chat.id"
						class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[6px] transition-all duration-200 group relative"
						:class="[
							activeChatId === chat.id
								? 'bg-primary/10'
								: 'hover:bg-black/5 dark:hover:bg-white/6',
						]"
						@click="selectChat(chat)"
						@contextmenu.prevent="openContextMenu($event, chat)"
					>
						<!-- 头像与状态 -->
						<div class="relative shrink-0">
							<n-badge
								:value="chat.unreadCount"
								color="#ef4444"
								:offset="[-2, 2]"
								size="small"
							>
								<n-avatar
									:size="40"
									round
									:src="chat.avatar"
									class="border border-white/50 dark:border-zinc-700"
								/>
							</n-badge>
							<div
								v-if="isSystemNotificationChat(chat)"
								class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-700 text-white text-[9px] leading-none flex items-center justify-center"
							>
								讯
							</div>
							<div
								v-else-if="chat.chatType === 'GROUP'"
								class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-700 text-white text-[9px] leading-none flex items-center justify-center"
							>
								群
							</div>
							<div
								v-else-if="chat.online"
								class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-blue-500 text-white text-[9px] leading-none flex items-center justify-center"
							>
								在
							</div>
							<div
								v-else
								class="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-white dark:border-zinc-700 bg-gray-500 text-white text-[9px] leading-none flex items-center justify-center"
							>
								离
							</div>
						</div>

						<!-- 聊天简述 -->
						<div
							class="flex-1 min-w-0 flex flex-col justify-center"
						>
							<div
								class="flex items-center justify-between mb-0.5"
							>
								<div class="min-w-0 flex items-center gap-1">
									<span
										class="truncate text-sm font-semibold"
										:class="
											chat.chatType === 'GROUP'
												? 'text-text-main'
												: isVipChat(chat)
													? 'text-red-500 font-bold'
													: 'text-text-main'
										"
									>
										{{ chat.name }}
									</span>
									<span
										v-if="hasMentionFeedback(chat)"
										class="shrink-0 rounded px-1 py-[1px] text-[9px] font-semibold text-red-500 bg-red-50"
									>
										@你
									</span>
									<img
										v-if="isVipChat(chat)"
										:src="vipBadgeIcon"
										alt="VIP"
										class="h-4 w-4 block vip-fill-red shrink-0"
									/>
								</div>
								<span
									class="text-[10px] text-gray-400 shrink-0"
								>
									{{ chat.timestamp }}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<div
									class="text-[11px] truncate pr-2"
									:class="
										hasMentionFeedback(chat)
											? 'text-red-500'
											: isIncomingTransferSummary(chat)
												? 'text-red-500'
												: 'text-gray-400'
									"
									v-html="
										renderSummaryWithEmoji(
											getLastMessagePreview(chat),
										)
									"
								></div>
								<!-- 置顶小图标 -->
								<n-icon
									v-if="chat.isPinned"
									size="12"
									class="text-primary/60 shrink-0 rotate-45"
								>
									<Pin12Filled />
								</n-icon>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 可拖拽调整宽度的分割线 (更精致的视觉效果) -->
		<div
			v-if="containerWidth >= 600"
			class="w-1 cursor-col-resize hover:bg-primary/30 transition-colors duration-200 flex items-center justify-center relative z-10 shrink-0"
			@mousedown="startDrag"
		>
			<div
				class="w-px h-8 bg-border-default/50 group-hover:bg-primary/50"
			></div>
		</div>

		<!-- 主聊天区域 -->
		<div
			v-if="containerWidth >= 600 || activeChatId"
			class="flex-1 overflow-hidden flex flex-col min-w-[320px] shrink-0 bg-page-bg relative"
		>
			<!-- 窄屏返回按钮 -->
			<div
				v-if="containerWidth < 600 && activeChatId"
				class="z-50 pl-2 pb-1 pt-1 border-b border-border-default/50 backdrop-blur-md"
			>
				<button
					class="w-fit h-8 flex no-drag px-2 gap-1 items-center justify-center bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-xl text-gray-600 dark:text-gray-200 active:scale-90 transition-all border border-gray-100 dark:border-zinc-700"
					@click="activeChatId = null"
				>
					<n-icon size="20"><ChevronLeft24Regular /></n-icon>
					<span>返回聊天列表</span>
				</button>
			</div>
			<ChatContext />
		</div>
	</div>

	<n-modal
		v-model:show="showNewChatModal"
		preset="card"
		title="发起聊天"
		:mask-closable="true"
		class="app-modal-card max-w-[420px]"
	>
		<n-input
			v-model:value="newChatKeyword"
			placeholder="搜索好友名称或账号"
			clearable
		>
			<template #prefix>
				<n-icon class="text-gray-400">
					<Search24Regular />
				</n-icon>
			</template>
		</n-input>

		<div class="mt-3 max-h-[360px] overflow-auto pr-1">
			<n-spin :show="isPreparingFriends">
				<div
					v-if="!filteredFriendsForNewChat.length"
					class="py-10 flex justify-center"
				>
					<n-empty
						:description="
							friends.length
								? '未找到匹配好友'
								: '暂无好友，先去好友页面添加联系人'
						"
					/>
				</div>
				<div v-else class="flex flex-col gap-1">
					<button
						v-for="friend in filteredFriendsForNewChat"
						:key="friend.id"
						type="button"
						class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/6 transition-colors"
						@click="startChatWithFriend(friend)"
					>
						<n-avatar :size="36" round :src="friend.avatar" />
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1 min-w-0">
								<div
									class="text-sm font-medium truncate"
									:class="
										friend.isVip
											? 'text-red-500'
											: 'text-text-main'
									"
								>
									{{ friend.remark || friend.name }}
								</div>
								<img
									v-if="friend.isVip"
									:src="vipBadgeIcon"
									alt="VIP"
									class="h-4 w-4 block vip-fill-red"
								/>
							</div>
							<div class="text-[11px] text-gray-400 truncate">
								{{ friend.id }}
							</div>
						</div>
					</button>
				</div>
			</n-spin>
		</div>
		<template #footer>
			<div class="flex justify-end">
				<n-button tertiary @click="showNewChatModal = false">
					关闭
				</n-button>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import {
	ref,
	computed,
	onUnmounted,
	h,
	nextTick,
	onMounted,
	inject,
	Ref,
	watch,
} from 'vue'
import { useTitleStore } from '@renderer/stores/title'
import { useChatStore, ChatItem } from '@renderer/stores/chat'
import { useFriendStore, type Friend } from '@renderer/stores/friend'
import {
	Search24Regular,
	Filter24Regular,
	Chat24Regular,
	Pin16Filled,
	MailRead16Filled,
	Delete16Filled,
	WindowNew20Filled,
	Pin12Filled,
	ChevronLeft24Regular,
} from '@vicons/fluent'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import {
	NDropdown,
	NIcon,
	NAvatar,
	NBadge,
	NInput,
	NTooltip,
	NModal,
	NButton,
	NEmpty,
	NSpin,
	useMessage,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import ChatContext from './ChatContext.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useElementSize } from '@vueuse/core'
import { getMergedEmojiTokenMap } from '@renderer/utils/emojiTokenMap'

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

// 从 localStorage 恢复宽度，如果没有则使用默认值
const STORAGE_KEY = 'chat-list-width'
const savedWidth = localStorage.getItem(STORAGE_KEY)
const listWidth = ref(savedWidth ? parseInt(savedWidth) : 280)

const searchQuery = ref('')
const message = useMessage()
const chatListScrollRef = ref<HTMLElement | null>(null)

const sidebarWidthState = inject<Ref<number>>('sideBarWidth', ref(200))
const isSidebarExpanded = inject<Ref<boolean>>('isExpanded', ref(true))

const titleStore = useTitleStore()
const chatStore = useChatStore()
const friendStore = useFriendStore()
const userInfoStore = useUserInfoStore()
const userName = userInfoStore.userName

const { chatlist, pinnedChats, activeChatId } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)

const RIGHT_PANEL_MIN_WIDTH = 450
const SESSION_LIST_MIN_WIDTH = 220

type ChatFilterKey = 'all' | 'unread' | 'mentions'

const currentFilter = ref<ChatFilterKey>('all')
const showNewChatModal = ref(false)
const newChatKeyword = ref('')
const isPreparingFriends = ref(false)
const currentRightPanelMinWidth = computed(() => RIGHT_PANEL_MIN_WIDTH)

const hasMentionFeedback = (chat: ChatItem): boolean => {
	return (chat.mentionUnreadCount || 0) > 0
}

const getLastMessagePreview = (chat: ChatItem): string => {
	if (hasMentionFeedback(chat)) {
		return `[有人@你] ${chat.lastMessage || ''}`.trim()
	}
	return chat.lastMessage || ''
}

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

const renderSummaryWithEmoji = (text: string): string => {
	const source = text || ''
	if (!source) return ''
	const escaped = escapeHtml(source)
	const tokenMap = getMergedEmojiTokenMap()
	if (!Object.keys(tokenMap).length) return escaped

	return escaped.replace(/\[([^\]\s[]{1,24})\]/g, (token) => {
		const url = tokenMap[token]
		if (!url) return token
		return `<img class="summary-inline-emoji" src="${url}" alt="${token}" title="${token}" draggable="false" />`
	})
}

const matchFilter = (chat: ChatItem): boolean => {
	if (currentFilter.value === 'unread') {
		return (chat.unreadCount || 0) > 0
	}
	if (currentFilter.value === 'mentions') {
		if (hasMentionFeedback(chat)) return true
		const text = (chat.lastMessage || '').toLowerCase()
		return /@我|@me|＠我/.test(text)
	}
	return true
}

const filteredChatList = computed(() => {
	// 基础列表：置顶项排在最前，其余按 store 中的顺序（最近更新的在最前）
	const list = [...chatlist.value].sort((a, b) => {
		if (a.isPinned && !b.isPinned) return -1
		if (!a.isPinned && b.isPinned) return 1
		return 0 // 维持原有的（store 更新后的）先后顺序
	})

	const filteredByType = list.filter(matchFilter)

	if (!searchQuery.value) return filteredByType
	const query = searchQuery.value.toLowerCase()
	return filteredByType.filter(
		(c) =>
			c.name.toLowerCase().includes(query) ||
			getLastMessagePreview(c).toLowerCase().includes(query),
	)
})

const filteredPinnedChats = computed(() =>
	pinnedChats.value.filter(matchFilter),
)

const isSystemNotificationChat = (chat: ChatItem): boolean =>
	(chat.peerAccount || '').trim().toUpperCase() === 'SYSTEM'

const isVipChat = (chat: ChatItem): boolean => {
	if (chat.chatType === 'GROUP' || isSystemNotificationChat(chat))
		return false
	const peerAccount = (chat.peerAccount || '').trim()
	const fallbackId = String(chat.id)
	const friend = friends.value.find((item) => {
		if (peerAccount) {
			return item.id === peerAccount || item.uid === peerAccount
		}
		return item.id === fallbackId || item.uid === fallbackId
	})
	return Boolean(friend?.isVip)
}

const isIncomingTransferSummary = (chat: ChatItem): boolean => {
	return (chat.lastMessage || '').trim().startsWith('[转账]')
}

const filteredFriendsForNewChat = computed(() => {
	const keyword = newChatKeyword.value.trim().toLowerCase()
	if (!keyword) return friends.value
	return friends.value.filter((friend) => {
		const candidate =
			`${friend.remark || ''} ${friend.name || ''} ${friend.id || ''}`.toLowerCase()
		return candidate.includes(keyword)
	})
})

// 监听布局变化，防止右侧被挤压
watch([containerWidth, sidebarWidthState, isSidebarExpanded], ([contWidth]) => {
	// 只在容器宽度有效时才进行调整（避免初始化时的 0 值）
	if (contWidth < 100) return

	const availableForListByLayout =
		contWidth - currentRightPanelMinWidth.value - 1
	// 只在列表宽度超出可用空间时才调整，否则保持用户设置的宽度
	if (listWidth.value > availableForListByLayout) {
		listWidth.value = Math.max(
			SESSION_LIST_MIN_WIDTH,
			availableForListByLayout,
		)
	}
})

const filterOptions = [
	{ label: '全部消息', key: 'all' },
	{ label: '未读', key: 'unread' },
	{ label: '提及我的', key: 'mentions' },
]

const handleFilterSelect = (key: string | number): void => {
	if (key === 'all' || key === 'unread' || key === 'mentions') {
		currentFilter.value = key
	}
}

const handleNewChat = async (): Promise<void> => {
	showNewChatModal.value = true
	if (friends.value.length > 0) return

	isPreparingFriends.value = true
	try {
		const ok = await friendStore.fetchFriends()
		if (!ok) {
			message.error('加载好友列表失败，请稍后再试')
		}
	} finally {
		isPreparingFriends.value = false
	}
}

const startChatWithFriend = async (friend: Friend): Promise<void> => {
	const chatId = await chatStore.getOrCreateChat(friend)
	await chatStore.setActiveChat(chatId)
	chatStore.markAsRead(chatId)
	showNewChatModal.value = false
	newChatKeyword.value = ''
}

const getChatListViewport = (): HTMLElement | null => {
	return chatListScrollRef.value
}

const selectChat = async (chat: ChatItem): Promise<void> => {
	if (activeChatId.value === chat.id) {
		chatStore.markAsRead(chat.id)
		return
	}
	const viewport = getChatListViewport()
	const savedTop = viewport?.scrollTop ?? 0
	await chatStore.setActiveChat(chat.id)
	chatStore.markAsRead(chat.id)
	nextTick(() => {
		const nextViewport = getChatListViewport()
		if (nextViewport) {
			nextViewport.scrollTop = savedTop
		}
	})
}

// 拖拽逻辑
let isDragging = false
const startDrag = (e: MouseEvent): void => {
	isDragging = true
	const startX = e.clientX
	const startWidth = listWidth.value
	let animationFrameId: number | null = null

	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'

	const onMove = (moveEvent: MouseEvent): void => {
		if (!isDragging) return
		if (animationFrameId) cancelAnimationFrame(animationFrameId)

		animationFrameId = requestAnimationFrame(() => {
			const delta = moveEvent.clientX - startX
			const newWidth = startWidth + delta
			const maxAllowedWidth =
				containerWidth.value - currentRightPanelMinWidth.value - 1

			listWidth.value = Math.min(
				Math.max(SESSION_LIST_MIN_WIDTH, newWidth),
				Math.max(SESSION_LIST_MIN_WIDTH, maxAllowedWidth),
			)
		})
	}

	const stopDrag = (): void => {
		isDragging = false
		if (animationFrameId) cancelAnimationFrame(animationFrameId)
		// 保存宽度到 localStorage
		localStorage.setItem(STORAGE_KEY, listWidth.value.toString())
		document.body.style.cursor = ''
		document.body.style.userSelect = ''
		document.removeEventListener('mousemove', onMove)
		document.removeEventListener('mouseup', stopDrag)
	}

	document.addEventListener('mousemove', onMove)
	document.addEventListener('mouseup', stopDrag)
	e.preventDefault()
}

// 右键菜单
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const selectedChatItem = ref<ChatItem | null>(null)

const openContextMenu = (e: MouseEvent, chat: ChatItem): void => {
	selectedChatItem.value = chat
	showContextMenu.value = false
	nextTick().then(() => {
		showContextMenu.value = true
		contextMenuX.value = e.clientX
		contextMenuY.value = e.clientY
	})
}

const contextMenuOptions = computed(() => {
	const chat = selectedChatItem.value
	if (!chat) return []

	const isPinned = chat.isPinned
	const isRead = chat.unreadCount === 0

	return [
		{
			label: isPinned ? '取消置顶' : '置顶聊天',
			key: isPinned ? 'unpin' : 'pin',
			icon: () => h(NIcon, null, { default: () => h(Pin16Filled) }),
		},
		{
			label: '在新窗口打开',
			key: 'openInNewWindow',
			icon: () => h(NIcon, null, { default: () => h(WindowNew20Filled) }),
		},
		{ type: 'divider' },
		{
			label: '标记为已读',
			key: 'markAsRead',
			disabled: isRead,
			icon: () => h(NIcon, null, { default: () => h(MailRead16Filled) }),
		},
		{
			label: '删除聊天',
			key: 'delete',
			icon: () => h(NIcon, null, { default: () => h(Delete16Filled) }),
		},
	]
})

const closeContextMenu = (): void => {
	showContextMenu.value = false
}

const handleContextMenuSelect = (key: string): void => {
	if (!selectedChatItem.value) return

	switch (key) {
		case 'pin':
			chatStore.pinChat(selectedChatItem.value.id)
			break
		case 'unpin':
			chatStore.unpinChat(selectedChatItem.value.id)
			break
		case 'markAsRead':
			chatStore.markAsRead(selectedChatItem.value.id)
			break
		case 'delete':
			chatStore.deleteChat(selectedChatItem.value.id)
			break
		case 'openInNewWindow':
			openInNewWindow(selectedChatItem.value)
			break
	}
	closeContextMenu()
}

const openInNewWindow = (chat: ChatItem): void => {
	window.electron.ipcRenderer.send('open-chat-window', chat.id, chat.name)
}

onMounted(() => {
	titleStore.setTitle('欢迎你！' + userName)
})

onUnmounted(() => {})
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
	display: none;
}
.no-scrollbar {
	-ms-overflow-style: none;
	scrollbar-width: none;
}

.chat-list-scrollbar {
	scrollbar-width: thin;
	scrollbar-color: rgba(0, 0, 0, 0.05) transparent;
}
.chat-list-scrollbar::-webkit-scrollbar {
	width: 4px;
}
.chat-list-scrollbar::-webkit-scrollbar-thumb {
	border-radius: 2px;
}
.chat-list-scrollbar:hover::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.1);
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}

:deep(.summary-inline-emoji) {
	display: inline-block;
	width: 1.02em;
	height: 1.02em;
	vertical-align: -0.16em;
	margin: 0 0.03em;
	border: none;
	border-radius: 0;
}
</style>

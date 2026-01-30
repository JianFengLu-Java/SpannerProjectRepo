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
						>
							<div
								class="w-7 h-7 flex items-center no-drag justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
							>
								<n-icon size="18" class="text-gray-500">
									<Filter24Regular />
								</n-icon>
							</div>
						</n-dropdown>
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 flex items-center no-drag justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
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
					class="rounded-xl bg-gray-100/50 border-none mb-1"
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
				v-if="pinnedChats.length > 0 && !searchQuery"
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
						v-for="chat in pinnedChats"
						:key="chat.id"
						class="flex flex-col items-center gap-1.5 p-2 rounded-2xl cursor-copy transition-all duration-200 relative shrink-0 w-[68px]"
						:class="[
							activeChatId === chat.id
								? 'bg-primary/10'
								: 'hover:bg-black/5',
						]"
						@click="selectChat(chat)"
						@contextmenu.prevent="openContextMenu($event, chat)"
					>
						<n-badge
							:value="chat.unreadCount"
							color="#10b981"
							:offset="[-2, 2]"
							size="small"
						>
							<div class="relative">
								<n-avatar
									:size="42"
									round
									:src="chat.avatar"
									class="border-2 border-white"
								/>
								<div
									v-if="chat.online"
									class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-green-500"
								></div>
							</div>
						</n-badge>
						<span
							class="text-[10px] font-medium text-gray-500 truncate w-full text-center"
						>
							{{ chat.name }}
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

				<n-virtual-list
					:items="filteredChatList"
					:item-size="68"
					class="h-full px-2 pb-4"
				>
					<template #default="{ item: chat }">
						<div
							:key="chat.id"
							class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-2xl transition-all duration-200 group relative"
							:class="[
								activeChatId === chat.id
									? 'bg-primary/10'
									: 'hover:bg-black/5',
							]"
							@click="selectChat(chat)"
							@contextmenu.prevent="openContextMenu($event, chat)"
						>
							<!-- 头像与状态 -->
							<div class="relative shrink-0">
								<n-badge
									:value="chat.unreadCount"
									color="#10b981"
									:offset="[-2, 2]"
									size="small"
								>
									<n-avatar
										:size="40"
										round
										:src="chat.avatar"
										class="border border-white/50"
									/>
								</n-badge>
								<div
									v-if="chat.online"
									class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-green-500"
								></div>
							</div>

							<!-- 聊天简述 -->
							<div
								class="flex-1 min-w-0 flex flex-col justify-center"
							>
								<div
									class="flex items-center justify-between mb-0.5"
								>
									<span
										class="text-sm font-semibold text-text-main truncate"
									>
										{{ chat.name }}
									</span>
									<span
										class="text-[10px] text-gray-400 shrink-0"
									>
										{{ chat.timestamp }}
									</span>
								</div>
								<div class="flex items-center justify-between">
									<div
										class="text-[11px] text-gray-400 truncate pr-2"
									>
										{{ chat.lastMessage }}
									</div>
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
					</template>
				</n-virtual-list>
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
			class="flex-1 overflow-hidden flex flex-col min-w-[320px] shrink-0 bg-white relative"
		>
			<!-- 窄屏返回按钮 -->
			<div
				v-if="containerWidth < 600 && activeChatId"
				class="z-50 pl-2 pb-1 pt-1 border-b border-border-default/50 backdrop-blur-md"
			>
				<button
					class="w-fit h-8 flex no-drag px-2 gap-1 items-center justify-center bg-white/80 backdrop-blur-md rounded-xl text-gray-600 active:scale-90 transition-all border border-gray-100"
					@click="activeChatId = null"
				>
					<n-icon size="20"><ChevronLeft24Regular /></n-icon>
					<span>返回聊天列表</span>
				</button>
			</div>
			<ChatContext />
		</div>
	</div>
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
import {
	NDropdown,
	NIcon,
	NAvatar,
	NVirtualList,
	NBadge,
	NInput,
	NTooltip,
	useMessage,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import ChatContext from './ChatContext.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useElementSize } from '@vueuse/core'

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

// 从 localStorage 恢复宽度，如果没有则使用默认值
const STORAGE_KEY = 'chat-list-width'
const savedWidth = localStorage.getItem(STORAGE_KEY)
const listWidth = ref(savedWidth ? parseInt(savedWidth) : 280)

const searchQuery = ref('')
const message = useMessage()

const sidebarWidthState = inject<Ref<number>>('sideBarWidth', ref(200))
const isSidebarExpanded = inject<Ref<boolean>>('isExpanded', ref(true))

const titleStore = useTitleStore()
const chatStore = useChatStore()
const userInfoStore = useUserInfoStore()
const userName = userInfoStore.userName

const { chatlist, pinnedChats, activeChatId } = storeToRefs(chatStore)

const RIGHT_PANEL_MIN_WIDTH = 450
const SESSION_LIST_MIN_WIDTH = 220

const filteredChatList = computed(() => {
	// 基础列表：置顶项排在最前，其余按 store 中的顺序（最近更新的在最前）
	const list = [...chatlist.value].sort((a, b) => {
		if (a.isPinned && !b.isPinned) return -1
		if (!a.isPinned && b.isPinned) return 1
		return 0 // 维持原有的（store 更新后的）先后顺序
	})

	if (!searchQuery.value) return list
	const query = searchQuery.value.toLowerCase()
	return list.filter(
		(c) =>
			c.name.toLowerCase().includes(query) ||
			c.lastMessage.toLowerCase().includes(query),
	)
})

// 监听布局变化，防止右侧被挤压
watch([containerWidth, sidebarWidthState, isSidebarExpanded], ([contWidth]) => {
	// 只在容器宽度有效时才进行调整（避免初始化时的 0 值）
	if (contWidth < 100) return

	const availableForList = contWidth - RIGHT_PANEL_MIN_WIDTH - 1
	// 只在列表宽度超出可用空间时才调整，否则保持用户设置的宽度
	if (listWidth.value > availableForList) {
		listWidth.value = Math.max(SESSION_LIST_MIN_WIDTH, availableForList)
	}
})

const filterOptions = [
	{ label: '全部消息', key: 'all' },
	{ label: '未读', key: 'unread' },
	{ label: '提及我的', key: 'mentions' },
]

const handleNewChat = (): void => {
	message.info('功能开发中...')
}

const selectChat = (chat: ChatItem): void => {
	activeChatId.value = chat.id
	chatStore.setActiveChat(chat.id)
	chatStore.markAsRead(chat.id)
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
				containerWidth.value - RIGHT_PANEL_MIN_WIDTH - 1

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

:deep(.n-virtual-list) {
	scrollbar-width: thin;
	scrollbar-color: rgba(0, 0, 0, 0.05) transparent;
}
:deep(.n-virtual-list)::-webkit-scrollbar {
	width: 4px;
}
:deep(.n-virtual-list)::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.05);
	border-radius: 2px;
}
:deep(.n-virtual-list):hover::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.1);
}
</style>

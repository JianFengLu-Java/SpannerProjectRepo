<template>
	<div class="h-full w-full flex overflow-hidden">
		<!-- 左侧聊天列表 -->
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
		<!-- 会话列表容器 -->
		<div
			v-if="windowWidth >= 800"
			class="h-full flex flex-col bg-page-bg rounded-xl overflow-hidden transition-all duration-300 ease-in-out shrink-0 relative"
			:style="{
				width: `${listWidth}px`,
			}"
		>
			<!-- 搜索和功能栏 -->
			<div class="p-3 pb-1">
				<div class="flex items-center gap-2">
					<n-dropdown
						:options="options"
						trigger="hover"
						placement="bottom-start"
					>
						<div
							class="no-drag z-60! items-center justify-center flex rounded-md w-8 h-8 hover:bg-sidebar-select-bg/50 transition-colors duration-200 cursor-pointer"
						>
							<n-icon size="20" class="text-gray-600">
								<List28Filled />
							</n-icon>
						</div>
					</n-dropdown>
					<span class="text-sm font-medium text-text-main flex-1"
						>聊天</span
					>
				</div>
			</div>

			<!-- 置顶会话 -->
			<div
				v-if="pinnedChats.length > 0"
				class="px-3 pb-1 border-b border-border-default"
			>
				<div class="flex items-center gap-2 mb-2">
					<span
						class="text-xs font-medium text-gray-500 uppercase tracking-wider"
						>置顶</span
					>
				</div>
				<div class="flex overflow-x-auto no-scrollbar gap-1">
					<div
						v-for="chat in pinnedChats"
						:key="chat.id"
						class="flex items-center p-2 rounded-lg cursor-pointer flex-col hover:bg-sidebar-select-bg/40 transition-colors duration-200"
						:class="{
							' bg-sidebar-select-bg/80 hover:bg-sidebar-select-bg/80':
								activeChatId === chat.id,
						}"
						@click="selectChat(chat)"
						@contextmenu.prevent="openContextMenu($event, chat)"
					>
						<n-badge
							:value="chat.unreadCount"
							color="red"
							size="small"
						>
							<n-avatar
								:size="36"
								round
								:src="chat.avatar"
								class="border border-gray-200 shrink-0"
							/>
						</n-badge>
						<div>
							<span
								class="text-[10px] font-normal text-gray-500 truncate w-12 text-center"
								>{{ chat.name }}</span
							>
						</div>
					</div>
				</div>
			</div>

			<!-- 所有聊天 -->
			<div class="flex-1 overflow-hidden">
				<n-virtual-list
					:items="chatlist"
					:item-size="60"
					class="h-full"
				>
					<template #default="{ item, index }">
						<div
							:key="item.id"
							class="px-2 py-2 m-2 mr-3 hover:bg-chatItem-select-bg/80 rounded-lg cursor-pointer transition-colors duration-100"
							:class="{
								'bg-chatItem-select-bg hover:bg-chatItem-select-bg/80':
									activeChatId === item.id,
								'border-t':
									index === 0 && pinnedChats.length === 0,
							}"
							@click="selectChat(item)"
							@contextmenu.prevent="openContextMenu($event, item)"
						>
							<div class="flex items-center gap-3">
								<!-- 头像和状态 -->
								<div>
									<n-badge
										:value="item.unreadCount"
										:offset="[-3, 0]"
										color="red"
										size="small"
									>
										<n-avatar
											:size="32"
											round
											:src="item.avatar"
											class="border border-gray-200"
										/>
									</n-badge>
								</div>

								<!-- 聊天信息 -->
								<div
									class="flex-1 flex justify-between min-w-0"
								>
									<div
										class="flex flex-col justify-between min-w-0 flex-1"
									>
										<div
											class="text-sm text-text-main truncate"
										>
											{{ item.name }}
										</div>
										<div
											class="text-[11px] text-gray-400 truncate"
										>
											{{ item.lastMessage }}
										</div>
									</div>

									<div
										class="flex items-center gap-2 ml-4 shrink-0"
									>
										<div class="text-[11px] text-gray-500">
											{{ formatTime(item.timestamp) }}
										</div>
									</div>
								</div>
							</div>
						</div>
					</template>
				</n-virtual-list>
			</div>
		</div>

		<!-- 可拖拽调整宽度的分割线 -->
		<div
			v-if="windowWidth >= 800"
			class="w-1 cursor-col-resize hover:bg-blue-400 transition-colors duration-200 flex items-center justify-center relative z-10 shrink-0"
			@mousedown="startDrag"
		>
			<div class="w-px h-6 bg-gray-200/50"></div>
		</div>

		<!-- 主聊天区域 -->
		<div
			class="flex-1 rounded-xl bg-page-bg overflow-hidden flex flex-col min-w-[400px] shrink-0"
		>
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
import { useChatStore } from '@renderer/stores/chat'
import {
	List28Filled,
	Pin16Filled,
	MailRead16Filled,
	Delete16Filled,
	WindowNew20Filled,
} from '@vicons/fluent'
import { NDropdown, NIcon, NAvatar, NVirtualList, NBadge } from 'naive-ui'
import { storeToRefs } from 'pinia'
import ChatContext from './ChatContext.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'

// 定义 ChatItem 接口确保类型安全
interface ChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	unreadCount?: number
}

const listWidth = ref(240)
const windowWidth = inject<Ref<number>>('windowWidth', ref(window.innerWidth))
const sidebarWidthState = inject<Ref<number>>('sideBarWidth', ref(200))
const isSidebarExpanded = inject<Ref<boolean>>('isExpanded', ref(true))

const titleStore = useTitleStore()
const chatStore = useChatStore()
const userInfoStore = useUserInfoStore()
const userName = userInfoStore.userName

const { chatlist, pinnedChats, activeChatId } = storeToRefs(chatStore)

const RIGHT_PANEL_MIN_WIDTH = 400
const SESSION_LIST_MIN_WIDTH = 200

// 监听布局变化，防止右侧被挤压
watch(
	[windowWidth, sidebarWidthState, isSidebarExpanded],
	([winWidth, sideWidth, isExp]) => {
		const currentSidebarWidth = isExp && winWidth >= 700 ? sideWidth : 76
		const availableForList =
			winWidth - currentSidebarWidth - RIGHT_PANEL_MIN_WIDTH - 12

		if (listWidth.value > availableForList) {
			listWidth.value = Math.max(SESSION_LIST_MIN_WIDTH, availableForList)
		}
	},
	{ immediate: true },
)

// 菜单选项
const options = [
	{ label: '全部聊天', key: 'all' },
	{ label: '未读消息', key: 'unread' },
	{ type: 'divider' },
	{ label: '创建群聊', key: 'createGroup' },
	{ label: '添加好友', key: 'addFriend' },
]

// 选择聊天
const selectChat = (chat: ChatItem): void => {
	activeChatId.value = chat.id
	chatStore.setActiveChat(chat.id)
	chatStore.markAsRead(chat.id)
}

// 格式化时间
const formatTime = (time: string): string => {
	return time
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

			// 计算当前侧边栏占据的宽度
			const currentSidebarWidth = isSidebarExpanded.value
				? sidebarWidthState.value
				: 76

			// 计算会话列表允许的最大宽度，确保右侧聊天区域至少保留 400px
			const maxAllowedWidth =
				windowWidth.value -
				currentSidebarWidth -
				RIGHT_PANEL_MIN_WIDTH -
				12 // 预留一些边距

			// 限制宽度范围：[200px, maxAllowedWidth]
			// 这样既保证了左侧不被拖拽关闭，也保证了右侧有最小空间
			listWidth.value = Math.min(
				Math.max(SESSION_LIST_MIN_WIDTH, newWidth),
				Math.max(SESSION_LIST_MIN_WIDTH, maxAllowedWidth),
			)
		})
	}

	const stopDrag = (): void => {
		isDragging = false
		if (animationFrameId) cancelAnimationFrame(animationFrameId)
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
const selectedChat = ref<ChatItem | null>(null)

const openContextMenu = (e: MouseEvent, chat: ChatItem): void => {
	selectedChat.value = chat
	showContextMenu.value = false
	nextTick().then(() => {
		showContextMenu.value = true
		contextMenuX.value = e.clientX
		contextMenuY.value = e.clientY
	})
}

const contextMenuOptions = computed(() => {
	const chat = selectedChat.value
	if (!chat) return []

	const isPinned = pinnedChats.value.some((c) => c.id === chat.id)
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
	if (!selectedChat.value) return

	switch (key) {
		case 'pin':
			chatStore.pinChat(selectedChat.value.id)
			break
		case 'unpin':
			chatStore.unpinChat(selectedChat.value.id)
			break
		case 'markAsRead':
			chatStore.markAsRead(selectedChat.value.id)
			break
		case 'delete':
			chatStore.deleteChat(selectedChat.value.id)
			break
		case 'openInNewWindow':
			openInNewWindow(selectedChat.value)
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

onUnmounted(() => {
	// 拖拽监听已自动清理
})
</script>

<style scoped>
:deep(.n-virtual-list) {
	scrollbar-width: thin;
	scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
}
:deep(.n-virtual-list)::-webkit-scrollbar {
	width: 6px;
}
:deep(.n-virtual-list)::-webkit-scrollbar-thumb {
	background-color: rgba(156, 163, 175, 0.4);
	border-radius: 3px;
}
.w-1:hover {
	background: linear-gradient(
		90deg,
		rgba(59, 130, 246, 0.1) 0%,
		rgba(59, 130, 246, 0.3) 50%,
		rgba(59, 130, 246, 0.1) 100%
	);
}
</style>

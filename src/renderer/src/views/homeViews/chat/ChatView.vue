<template>
	<div class="h-full w-full flex">
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
		<div
			class="h-full flex flex-col bg-white rounded-xl overflow-hidden transition-all duration-200"
			:style="{ width: `${listWidth}px` }"
		>
			<!-- 搜索和功能栏 -->
			<div class="p-3 pb-1 border-gray-100">
				<div class="flex items-center gap-2">
					<n-dropdown
						:options="options"
						trigger="hover"
						placement="bottom-start"
					>
						<div
							class="no-drag z-60! items-center justify-center flex rounded-md w-8 h-8 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
						>
							<n-icon size="20" class="text-gray-600">
								<List28Filled />
							</n-icon>
						</div>
					</n-dropdown>
					<span class="text-sm font-medium text-gray-800 flex-1"
						>聊天</span
					>
				</div>
			</div>

			<!-- 置顶会话 -->
			<div
				v-if="pinnedChats.length > 0"
				class="px-3 pb-1 border-b border-gray-100"
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
						class="flex items-center *: p-2 rounded-lg cursor-pointer flex-col hover:bg-gray-50 transition-colors duration-200"
						:class="{
							'bg-gray-200/80 hover:bg-gray-200/80':
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
								class="text-[10px] font-normal text-gray-500"
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
					:item-size="68"
					class="h-full"
				>
					<template #default="{ item, index }">
						<div
							:key="item.id"
							class="px-2 py-2 m-2 mr-3 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-100"
							:class="{
								'bg-gray-200/80 hover:bg-gray-200/80':
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
										:key="'item' + item"
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
											class="text-sm text-gray-700 truncate"
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
			class="w-1 cursor-col-resize hover:bg-green-300 transition-colors duration-200 flex items-center justify-center"
			@mousedown="startDrag"
		>
			<div class="w-px h-6"></div>
		</div>

		<!-- 主聊天区域 -->
		<div class="flex-1 bg-white rounded-xl">
			<ChatContext />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, h, nextTick, onMounted } from 'vue'
import { useTitleStore } from '@renderer/stores/title'
import { useChatStore } from '@renderer/stores/chat'
import {
	List28Filled,
	Pin16Filled,
	MailRead16Filled,
	Delete16Filled,
} from '@vicons/fluent'
import { NDropdown, NIcon, NAvatar, NVirtualList } from 'naive-ui'

import { storeToRefs } from 'pinia'
import ChatContext from './ChatContext.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'

const listWidth = ref(200)
const titleStore = useTitleStore()
const chatStore = useChatStore()
const userInfoStore = useUserInfoStore()

const userName = userInfoStore.userName

const { chatlist, pinnedChats, activeChatId } = storeToRefs(chatStore)

titleStore.setTitle('聊天')

// 菜单选项
const options = [
	{
		label: '全部聊天',
		key: 'all',
	},
	{
		label: '未读消息',
		key: 'unread',
	},
	{
		type: 'divider',
	},
	{
		label: '创建群聊',
		key: 'createGroup',
	},
	{
		label: '添加好友',
		key: 'addFriend',
	},
]

// 聊天列表

// 选择聊天
const selectChat = (chat): void => {
	activeChatId.value = chat.id
	chatStore.setActiveChat(chat.id)
	chatStore.markAsRead(chat.id)
	console.log('选择聊天:', chat.name)
}

// 格式化时间显示
const formatTime = (time: string): string => {
	if (time.includes(':')) {
		return time
	}
	return time
}

// 拖拽调整宽度
let startX = 0
let startWidth = 0
let isDragging = false

const startDrag = (e: MouseEvent): void => {
	isDragging = true
	startX = e.clientX
	startWidth = listWidth.value

	const onMove = (moveEvent: MouseEvent): void => {
		if (!isDragging) return
		const delta = moveEvent.clientX - startX
		listWidth.value = Math.min(400, Math.max(200, startWidth + delta))
	}

	const stopDrag = (): void => {
		isDragging = false
		document.removeEventListener('mousemove', onMove)
		document.removeEventListener('mouseup', stopDrag)
	}

	document.addEventListener('mousemove', onMove)
	document.addEventListener('mouseup', stopDrag)
	e.preventDefault()
}

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const selectedChat = ref<ChatItem | null>(null)

interface ChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	online: boolean
	unreadCount?: number
	isPinned?: boolean
}

// 打开右键菜单
const openContextMenu = (e: MouseEvent, chat: any): void => {
	// selectChat(chat)
	selectedChat.value = chat
	showContextMenu.value = false
	nextTick().then(() => {
		showContextMenu.value = true
		contextMenuX.value = e.clientX
		contextMenuY.value = e.clientY
	})
}

// 右键菜单选项
const contextMenuOptions = computed(() => {
	const chat = selectedChat.value
	if (!chat) return []

	const isPinned = pinnedChats.value.some(
		(c) => c.id === (chat as { id: number }).id,
	)
	const isRead = (chat as { unreadCount: number }).unreadCount === 0

	return [
		isPinned
			? {
					label: '取消置顶',
					key: 'unpin',
					icon: () =>
						h(NIcon, null, { default: () => h(Pin16Filled) }),
				}
			: {
					label: '置顶聊天',
					key: 'pin',
					icon: () =>
						h(NIcon, null, { default: () => h(Pin16Filled) }),
				},
		{
			type: 'divider',
		},
		isRead
			? {
					label: '标记为已读',
					key: 'markAsRead',
					disabled: true,
					icon: () =>
						h(NIcon, null, { default: () => h(MailRead16Filled) }),
				}
			: {
					label: '标记为已读',
					key: 'markAsRead',
					icon: () =>
						h(NIcon, null, { default: () => h(MailRead16Filled) }),
				},
		{
			label: '删除聊天',
			key: 'delete',
			icon: () => h(NIcon, null, { default: () => h(Delete16Filled) }),
		},
	]
})

// 关闭右键菜单
const closeContextMenu = (): void => {
	showContextMenu.value = false
}

onMounted(() => {
	titleStore.setTitle('欢迎你！' + userName)
})

// 处理菜单项选择
const handleContextMenuSelect = (key: string): void => {
	if (!selectedChat.value) return

	switch (key) {
		case 'pin':
			chatStore.pinChat(selectedChat.value!.id)
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
	}

	closeContextMenu()
}

// 清理事件监听
onUnmounted(() => {
	document.removeEventListener('mousemove', () => {})
	document.removeEventListener('mouseup', () => {})
})
</script>

<style scoped>
/* 自定义滚动条样式 */
:deep(.n-virtual-list) {
	scrollbar-width: thin;
	scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
}

:deep(.n-virtual-list)::-webkit-scrollbar {
	width: 6px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-track {
	background: transparent;
	border-radius: 3px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-thumb {
	background-color: rgba(156, 163, 175, 0.4);
	border-radius: 3px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-thumb:hover {
	background-color: rgba(156, 163, 175, 0.6);
}

/* 拖拽条样式 */
.w-1:hover {
	background: linear-gradient(
		90deg,
		rgba(59, 130, 246, 0.1) 0%,
		rgba(59, 130, 246, 0.3) 50%,
		rgba(59, 130, 246, 0.1) 100%
	);
}

/* 搜索框聚焦效果 */
input:focus {
	box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
</style>

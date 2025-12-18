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
						class="flex items-center *: gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200"
						:class="{
							'bg-gray-100 hover:bg-blue-50':
								activeChatId === chat.id,
						}"
						@click="selectChat(chat)"
						@contextmenu.prevent="openContextMenu($event, chat)"
					>
						<n-avatar
							:size="36"
							round
							:src="chat.avatar"
							class="border border-gray-200 shrink-0"
						/>
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
							class="px-1 py-2 m-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-100 å"
							:class="{
								'bg-gray-100  hover:bg-gray-200':
									activeChatId === item.id,
								'border-t':
									index === 0 && pinnedChats.length === 0,
							}"
							@click="selectChat(item)"
							@contextmenu.prevent="openContextMenu($event, item)"
						>
							<div class="flex items-center gap-3 ml-2 mr-3">
								<!-- 头像和状态 -->
								<div class="relative">
									<n-avatar
										:size="28"
										round
										:src="item.avatar"
										class="border border-gray-200"
									/>
									<!-- 在线状态 -->
									<div
										v-if="item.online"
										class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"
									></div>
								</div>

								<!-- 聊天信息 -->
								<div class="flex-1 min-w-0">
									<div
										class="flex items-center justify-between mb-1"
									>
										<div
											class="text-sm text-gray-700 truncate"
										>
											{{ item.name }}
										</div>
										<div
											class="text-xs text-gray-400 whitespace-nowrap ml-2"
										>
											{{ formatTime(item.timestamp) }}
										</div>
									</div>
									<div class="flex items-center gap-2">
										<div
											class="text-xs text-gray-500 truncate flex-1"
										>
											{{ item.lastMessage }}
										</div>
										<!-- 未读消息标记 -->
										<div
											v-if="item.unreadCount > 0"
											class="shrink-0 flex items-center justify-center min-w-3 h-4 px-1.5 bg-green-500 rounded-full"
										>
											<span
												class="text-xs text-white font-medium leading-none"
											>
												{{
													item.unreadCount > 99
														? '99+'
														: item.unreadCount
												}}
											</span>
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
		<div class="flex-1 bg-white overflow-hidden rounded-xl">
			<ChatContext />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h, nextTick } from 'vue'
import { useTitleStore } from '@renderer/stores/title'
import { useChatStore } from '@renderer/stores/chat'
import {
	List28Filled,
	Pin16Filled,
	PinOff16Filled,
	MailRead16Filled,
	Delete16Filled,
} from '@vicons/fluent'
import { NDropdown, NIcon, NAvatar, NVirtualList } from 'naive-ui'

import { storeToRefs } from 'pinia'
import ChatContext from './chat/ChatContext.vue'

const listWidth = ref(300)
const titleStore = useTitleStore()
const chatStore = useChatStore()

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
const selectChat = (chat: any) => {
	activeChatId.value = chat.id
	chatStore.setActiveChat(chat.id)
	chatStore.markAsRead(chat.id)
	console.log('选择聊天:', chat.name)
}

// 格式化时间显示
const formatTime = (time: string) => {
	if (time.includes(':')) {
		return time
	}
	return time
}

// 拖拽调整宽度
let startX = 0
let startWidth = 0
let isDragging = false

const startDrag = (e: MouseEvent) => {
	isDragging = true
	startX = e.clientX
	startWidth = listWidth.value

	const onMove = (moveEvent: MouseEvent) => {
		if (!isDragging) return
		const delta = moveEvent.clientX - startX
		listWidth.value = Math.min(400, Math.max(260, startWidth + delta))
	}

	const stopDrag = () => {
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
const selectedChat = ref<any>(null)
const contextMenuChat = ref<any>(null)

// 右键菜单选项
const contextMenuOptions = [
	{
		label: '置顶聊天',
		key: 'pin',
		disabled: true,
		icon: () => h(NIcon, null, { default: () => h(Pin16Filled) }),
	},
	{
		label: '取消置顶',
		key: 'unpin',
		icon: () => h(NIcon, null, { default: () => h(PinOff16Filled) }),
	},
	{
		type: 'divider',
	},
	{
		label: '标记为已读',
		key: 'markAsRead',
		icon: () => h(NIcon, null, { default: () => h(MailRead16Filled) }),
	},
	{
		label: '删除聊天',
		key: 'delete',
		icon: () => h(NIcon, null, { default: () => h(Delete16Filled) }),
	},
]

// 打开右键菜单
const openContextMenu = (e: MouseEvent, chat: any) => {
	selectedChat.value = chat
	showContextMenu.value = false
	nextTick().then(() => {
		showContextMenu.value = true
		contextMenuX.value = e.clientX
		contextMenuY.value = e.clientY
	})
}

// 关闭右键菜单
const closeContextMenu = () => {
	showContextMenu.value = false
}

// 处理菜单项选择
const handleContextMenuSelect = (key: string) => {
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

/* 无拖拽区域 */
.no-drag {
	-webkit-app-region: no-drag;
	user-select: none;
}
</style>

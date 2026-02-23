<template>
	<div
		v-if="currentChat"
		ref="chatContextRootRef"
		class="h-full w-full flex flex-col justify-between chat-context-root relative"
	>
		<!-- header -->
		<div class="h-14 shrink-0 flex items-center justify-between w-full p-3">
			<div class="flex gap-2 items-center">
				<n-avatar
					round
					:src="currentChat?.avatar"
					class="no-drag cursor-pointer"
				></n-avatar>
				<div class="flex flex-col">
					<div class="flex items-center gap-1">
						<span
							class="text-[16px] no-drag font-medium w-fit"
							:class="
								currentChatIsVip
									? 'text-red-500'
									: 'text-text-main'
							"
							>{{ currentChat?.name }}</span
						>
						<img
							v-if="currentChatIsVip"
							:src="vipBadgeIcon"
							alt="VIP"
							class="h-4 w-4 block vip-fill-red"
						/>
					</div>
					<span class="text-[11px] text-gray-400">
						{{ currentChatSubtitle }}
					</span>
				</div>
			</div>
			<div class="h-13 flex items-center gap-1 no-drag">
				<n-tooltip
					v-for="item in menus"
					:key="item.key"
					trigger="hover"
				>
					<template #trigger>
						<button
							type="button"
							class="no-drag w-8 h-8 flex items-center justify-center rounded-md transition-colors"
							:class="
								item.disabled
									? 'opacity-45 cursor-not-allowed'
									: 'hover:bg-gray-100 dark:hover:bg-zinc-700/40 cursor-pointer'
							"
							:disabled="item.disabled"
							@click="handleMenuAction(item.key)"
						>
							<n-icon
								size="15"
								class="text-gray-600 dark:text-gray-300"
							>
								<component :is="iconMap[item.icon]" />
							</n-icon>
						</button>
					</template>
					{{ item.label }}
				</n-tooltip>
			</div>
		</div>

		<!-- 消息区域 -->
		<div class="flex-1 overflow-auto">
			<ChatContainer :messages="currentChatMessages" />
		</div>

		<!-- 输入区域 -->
		<div
			class="h-fit py-2 w-full px-4 border-t border-border-main shrink-0"
		>
			<chat-edit
				v-if="activeChatId !== null && !isSystemNotificationChat"
				:key="activeChatId"
				:current-id="activeChatId"
			/>
			<div
				v-else-if="activeChatId !== null"
				class="h-10 flex items-center text-xs text-gray-400"
			>
				系统通知会话仅支持查看，不支持发送消息
			</div>
		</div>

		<n-drawer
			v-model:show="showFriendSettingDrawer"
			placement="right"
			:width="friendSettingDrawerWidth"
			:to="chatContextRootRef || undefined"
			display-directive="show"
			:block-scroll="true"
			:mask-closable="false"
			:trap-focus="true"
			:auto-focus="true"
			:show-mask="true"
			class="chat-friend-setting-drawer"
		>
			<n-drawer-content
				:native-scrollbar="false"
				:body-content-style="{
					padding: '0',
					height: '100%',
					overflow: 'hidden',
				}"
			>
				<ChatFriendSettingPanel
					@close="showFriendSettingDrawer = false"
				/>
			</n-drawer-content>
		</n-drawer>

		<chat-history-search-modal
			v-model:show="showHistorySearchModal"
			:chat-id="activeChatId"
			:chat-name="currentChat?.name || ''"
			:loaded-messages="currentChatMessages"
		/>
	</div>
	<div
		v-if="!currentChat"
		class="h-full w-full flex flex-col justify-center items-center rounded-xl p-8"
	>
		<div class="flex flex-col items-center gap-4 max-w-md text-center">
			<!-- 图标 -->
			<div
				class="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-2"
			>
				<n-icon size="48" class="text-primary">
					<Chat24Regular />
				</n-icon>
			</div>

			<!-- 标题 -->
			<h3 class="text-2xl font-black text-text-main tracking-tight">
				开始对话
			</h3>

			<!-- 描述 -->
			<p class="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
				从左侧选择一个联系人开始聊天<br />
				或点击右上角创建新的对话
			</p>

			<!-- 装饰性提示 -->
			<div
				class="flex items-center gap-2 mt-4 px-4 py-2 bg-primary/5 rounded-full"
			>
				<n-icon size="16" class="text-primary/60">
					<ArrowLeft24Regular />
				</n-icon>
				<span class="text-xs font-medium text-primary/80"
					>选择一个聊天</span
				>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import ChatEdit from './ChatEdit.vue'
import { useChatStore } from '@renderer/stores/chat'
import { EllipsisHorizontal, PersonAddSharp, Search } from '@vicons/ionicons5'
import {
	Chat24Regular,
	ArrowLeft24Regular,
	ChatVideo24Regular,
} from '@vicons/fluent'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import ChatContainer from './ChatContainer.vue'
import { NIcon, NDrawer, NDrawerContent, useMessage } from 'naive-ui'
import { useFriendStore } from '@renderer/stores/friend'
import ChatFriendSettingPanel from './ChatFriendSettingPanel.vue'
import ChatHistorySearchModal from './ChatHistorySearchModal.vue'
import { useElementSize } from '@vueuse/core'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import { videoCallApi } from '@renderer/services/videoCallApi'

const chatStore = useChatStore()
const friendStore = useFriendStore()
const message = useMessage()
const chatContextRootRef = ref<HTMLElement | null>(null)
const { width: chatContextWidth } = useElementSize(chatContextRootRef)

const { activeChat, activeChatId, activeChatMessages } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)

const currentChat = computed(() => {
	return activeChat.value
})

const currentChatMessages = computed(() => {
	return activeChatMessages.value
})

const currentChatFriend = computed(() => {
	const chat = currentChat.value
	if (!chat || chat.chatType === 'GROUP' || isSystemNotificationChat.value) {
		return null
	}
	const peerAccount = (chat.peerAccount || '').trim()
	const fallbackId = String(chat.id)
	return (
		friends.value.find(
			(item) =>
				(peerAccount &&
					(item.id === peerAccount || item.uid === peerAccount)) ||
				item.id === fallbackId ||
				item.uid === fallbackId,
		) || null
	)
})

const currentChatIsVip = computed(() => {
	if (!currentChat.value || currentChat.value.chatType === 'GROUP')
		return false
	if (isSystemNotificationChat.value) return false
	return Boolean(currentChatFriend.value?.isVip)
})

const currentChatSubtitle = computed(() => {
	if (!currentChat.value) return ''
	if (isSystemNotificationChat.value) {
		return '系统账号：SYSTEM'
	}
	if (currentChat.value.chatType === 'GROUP') {
		return `群号：${currentChat.value.groupNo || '-'}`
	}
	const friend = currentChatFriend.value
	return friend?.email?.trim() || '未填写邮箱'
})

const isSystemNotificationChat = computed(() =>
	chatStore.isSystemNotificationChatItem(currentChat.value),
)

const showHistorySearchModal = ref(false)
const showFriendSettingDrawer = ref(false)

const friendSettingDrawerWidth = computed(() => {
	const width = Math.floor(chatContextWidth.value)
	if (!width) return 375
	if (width <= 420) return width
	return 375
})

interface menusItem {
	key: string
	label: string
	icon: string
	disabled?: boolean
}

// 图标映射
const iconMap: Record<string, Component> = {
	search: Search,
	videoCall: ChatVideo24Regular,
	userAdd: PersonAddSharp,
	more: EllipsisHorizontal,
}

const menus = computed<menusItem[]>(() => {
	if (isSystemNotificationChat.value) {
		return [
			{
				key: 'search',
				label: '搜索聊天记录',
				icon: 'search',
			},
		]
	}
	if (currentChat.value?.chatType === 'GROUP') {
		return [
			{
				key: 'search',
				label: '搜索聊天记录',
				icon: 'search',
			},
			{
				key: 'userAdd',
				label: '邀请好友入群',
				icon: 'userAdd',
			},
			{
				key: 'more',
				label: '群聊设置',
				icon: 'more',
			},
		]
	}
	return [
		{
			key: 'search',
			label: '搜索聊天记录',
			icon: 'search',
		},
		{
			key: 'videoCall',
			label: '视频通话',
			icon: 'videoCall',
		},
		{
			key: 'more',
			label: '聊天设置',
			icon: 'more',
		},
	]
})

const startVideoCall = async (): Promise<void> => {
	if (!currentChat.value || currentChat.value.chatType === 'GROUP') {
		message.warning('仅支持在单聊中发起视频通话')
		return
	}
	const peerAccount = (currentChat.value.peerAccount || '').trim()
	if (!peerAccount) {
		message.warning('缺少对方账号，无法发起通话')
		return
	}
	try {
		const response = await videoCallApi.createCall({
			calleeAccount: peerAccount,
			type: 'VIDEO',
		})
		const callId = String(
			response.data?.data?.callId ||
				response.data?.data?.callid ||
				response.data?.data?.id ||
				'',
		).trim()
		if (!callId) {
			message.error('发起通话失败：缺少 callId')
			return
		}
		window.api.openMockVideoCallWindow({
			chatId: currentChat.value.id,
			chatName: currentChat.value.name,
			chatAvatar: currentChat.value.avatar || '',
			type: 'video',
			callId,
			peerAccount,
			role: 'caller',
		})
	} catch (error) {
		console.warn('发起视频通话失败:', error)
		message.error('发起视频通话失败，请稍后重试')
	}
}

const handleMenuAction = (key: string): void => {
	if (!activeChatId.value) return
	if (key === 'search') {
		showHistorySearchModal.value = true
		return
	}
	if (key === 'videoCall') {
		void startVideoCall()
		return
	}
	if (key === 'userAdd') {
		showFriendSettingDrawer.value = true
		return
	}
	if (key === 'more') {
		showFriendSettingDrawer.value = true
	}
}

// 添加一个方法用于子组件获取边界元素
const getBoundaryElement = (): HTMLElement | null => {
	return document.querySelector('.chat-context-root')
}

// 暴露给子组件使用
defineExpose({
	getBoundaryElement,
})

watch(activeChatId, () => {
	showFriendSettingDrawer.value = false
})
</script>

<style scoped>
/* 使用 :deep 穿透组件，确保 ChatContainer 内部的消息也被选中 */
.can-select-text,
.can-select-text :deep(*) {
	-webkit-user-select: text !important;
	user-select: text !important;
	-webkit-app-region: no-drag;
}

.chat-messages,
.chat-messages * {
	user-select: text;
}

/* 确保消息区域可以滚动 */
.flex-1 {
	overflow: auto !important;
	overflow-x: hidden !important;
}

/* 确保父容器有正确的定位和层级 */
.chat-context-root {
	position: relative;
	overflow: hidden;
	z-index: 1;
}

:deep(.chat-friend-setting-drawer .n-drawer-container) {
	position: absolute !important;
	inset: 0;
}

:deep(.chat-friend-setting-drawer .n-drawer-mask) {
	background: rgba(15, 23, 42, 0.38) !important;
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

:deep(.chat-friend-setting-drawer .n-drawer-content-wrapper) {
	top: 0 !important;
	height: 100% !important;
}

:deep(.chat-friend-setting-drawer .n-drawer-content) {
	height: 100%;
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>

<template>
	<div
		class="h-full w-[300px] shrink-0 border-l border-border-default/50 bg-page-bg/95 backdrop-blur-sm overflow-auto"
	>
		<div class="p-4 border-b border-border-default/50 flex items-center justify-between">
			<span class="text-sm font-semibold text-text-main">好友设置</span>
			<n-button
				quaternary
				circle
				size="small"
				class="no-drag"
				@click="$emit('close')"
			>
				<template #icon>
					<n-icon><Dismiss24Regular /></n-icon>
				</template>
			</n-button>
		</div>

		<div v-if="activeChat && currentFriend" class="p-4 flex flex-col gap-4">
			<div class="flex flex-col items-center gap-3 py-2">
				<n-avatar :size="68" round :src="currentFriend.avatar" />
				<div class="text-center">
					<div class="text-base font-semibold text-text-main">
						{{ currentFriend.remark || currentFriend.name }}
					</div>
					<div class="text-xs text-gray-400 mt-1">{{ currentFriend.id }}</div>
				</div>
				<n-tag
					size="small"
					:type="currentFriend.status === 'online' ? 'success' : 'default'"
					:bordered="false"
				>
					{{ currentFriend.status === 'online' ? '在线' : '离线' }}
				</n-tag>
			</div>

			<div class="rounded-xl border border-border-default/60 p-3 text-xs text-gray-500 space-y-2">
				<div>邮箱：{{ currentFriend.email?.trim() || '未填写' }}</div>
				<div>地区：{{ currentFriend.region?.trim() || '未填写' }}</div>
				<div>签名：{{ currentFriend.signature?.trim() || '暂无签名' }}</div>
			</div>

			<div class="flex flex-col gap-2">
				<n-button secondary block @click="togglePinChat">
					{{ activeChat.isPinned ? '取消置顶聊天' : '置顶聊天' }}
				</n-button>
				<n-button secondary block @click="markCurrentChatRead">
					标记为已读
				</n-button>
				<n-button type="error" ghost block @click="deleteCurrentChat">
					删除聊天
				</n-button>
			</div>
		</div>

		<div v-else class="h-[260px] flex items-center justify-center text-xs text-gray-400">
			请选择一个好友聊天
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { NAvatar, NButton, NIcon, NTag } from 'naive-ui'
import { Dismiss24Regular } from '@vicons/fluent'
import { useChatStore } from '@renderer/stores/chat'
import { useFriendStore } from '@renderer/stores/friend'

defineEmits<{
	(e: 'close'): void
}>()

const chatStore = useChatStore()
const friendStore = useFriendStore()

const { activeChat } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)

const currentFriend = computed(() => {
	if (!activeChat.value) return null
	return friends.value.find((item) => Number(item.id) === activeChat.value?.id) || null
})

const togglePinChat = (): void => {
	if (!activeChat.value) return
	if (activeChat.value.isPinned) {
		chatStore.unpinChat(activeChat.value.id)
		return
	}
	chatStore.pinChat(activeChat.value.id)
}

const markCurrentChatRead = (): void => {
	if (!activeChat.value) return
	chatStore.markAsRead(activeChat.value.id)
}

const deleteCurrentChat = (): void => {
	if (!activeChat.value) return
	chatStore.deleteChat(activeChat.value.id)
}
</script>

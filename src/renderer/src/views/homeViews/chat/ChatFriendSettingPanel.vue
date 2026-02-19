<template>
	<div
		class="h-full min-h-0 bg-page-bg/95 backdrop-blur-sm"
		:class="isGroupChat ? 'overflow-hidden' : 'overflow-auto'"
	>
		<div
			v-if="activeChat && !isGroupChat && currentFriend"
			class="p-4 flex flex-col gap-4"
		>
			<div class="flex flex-col items-center gap-3 py-2">
				<n-avatar :size="68" round :src="currentFriend.avatar" />
				<div class="text-center">
					<div class="flex items-center justify-center gap-1">
						<div
							class="text-base font-semibold"
							:class="
								currentFriend.isVip
									? 'text-red-500'
									: 'text-text-main'
							"
						>
							{{ currentFriend.remark || currentFriend.name }}
						</div>
						<img
							v-if="currentFriend.isVip"
							:src="vipBadgeIcon"
							alt="VIP"
							class="h-4 w-4 block vip-fill-red"
						/>
					</div>
					<div class="text-xs text-gray-400 mt-1">
						{{ currentFriend.id }}
					</div>
				</div>
				<n-tag
					size="small"
					:type="
						currentFriend.status === 'online'
							? 'success'
							: 'default'
					"
					:bordered="false"
				>
					{{ currentFriend.status === 'online' ? '在线' : '离线' }}
				</n-tag>
			</div>

			<div
				class="rounded-xl border border-border-default/60 p-3 text-xs text-gray-500 space-y-2"
			>
				<div>邮箱：{{ currentFriend.email?.trim() || '未填写' }}</div>
				<div>地区：{{ currentFriend.region?.trim() || '未填写' }}</div>
				<div>
					签名：{{ currentFriend.signature?.trim() || '暂无签名' }}
				</div>
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

		<div
			v-else-if="activeChat && isGroupChat && currentGroupChat"
			class="h-full min-h-0"
		>
			<GroupChatSettingsDetail
				:group="currentGroupChat"
				:members="groupMembers"
				@close="emit('close')"
				@quit-group="quitCurrentGroup"
				@disband-group="disbandCurrentGroup"
				@clear-history="clearCurrentHistory"
			/>
		</div>

		<div
			v-else
			class="h-[260px] flex items-center justify-center text-xs text-gray-400"
		>
			请选择一个聊天
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NAvatar, NButton, NTag, useMessage } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
import { useFriendStore } from '@renderer/stores/friend'
import type { GroupMember } from '@renderer/services/groupChatApi'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import GroupChatSettingsDetail from './GroupChatSettingsDetail.vue'

const emit = defineEmits<{
	(e: 'close'): void
}>()

const chatStore = useChatStore()
const friendStore = useFriendStore()
const message = useMessage()

const { activeChat } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)

const groupMembers = ref<GroupMember[]>([])
const isLoadingMembers = ref(false)
let groupMembersPollTimer: ReturnType<typeof setInterval> | null = null

const isGroupChat = computed(() => activeChat.value?.chatType === 'GROUP')

const currentGroupChat = computed(() => {
	if (!activeChat.value || !isGroupChat.value) return null
	return activeChat.value
})

const currentFriend = computed(() => {
	const chat = activeChat.value
	if (!chat || chat.chatType === 'GROUP') return null
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

const refreshGroupMembers = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	if (!groupNo) {
		groupMembers.value = []
		return
	}
	isLoadingMembers.value = true
	try {
		groupMembers.value = await chatStore.getGroupMembers(groupNo)
	} catch {
		groupMembers.value = []
	} finally {
		isLoadingMembers.value = false
	}
}

const quitCurrentGroup = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	if (!groupNo) return
	if (currentGroupChat.value?.myRole === 'OWNER') {
		message.warning('群主暂不支持退群，请先转让群主')
		return
	}
	try {
		await chatStore.quitGroupChat(groupNo)
		message.success('已退出群聊')
		emit('close')
	} catch (error) {
		const tip =
			error instanceof Error && error.message
				? error.message
				: '退群失败，请稍后再试'
		message.error(tip)
	}
}

const disbandCurrentGroup = (): void => {
	if (!currentGroupChat.value) return
	if (currentGroupChat.value.myRole !== 'OWNER') {
		message.warning('仅群主可解散群聊')
		return
	}
	void (async () => {
		try {
			await chatStore.disbandGroupChat(currentGroupChat.value?.groupNo || '')
			message.success('群聊已解散')
			emit('close')
		} catch (error) {
			const tip =
				error instanceof Error && error.message
					? error.message
					: '解散群聊失败，请稍后再试'
			message.error(tip)
		}
	})()
}

const clearCurrentHistory = (): void => {
	if (!activeChat.value) return
	message.success('聊天记录已清空')
}

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

const stopGroupMembersPolling = (): void => {
	if (!groupMembersPollTimer) return
	clearInterval(groupMembersPollTimer)
	groupMembersPollTimer = null
}

const startGroupMembersPolling = (): void => {
	stopGroupMembersPolling()
	groupMembersPollTimer = setInterval(() => {
		if (!isGroupChat.value || !currentGroupChat.value) return
		void refreshGroupMembers()
	}, 8000)
}

watch(
	() => [
		activeChat.value?.id,
		activeChat.value?.chatType,
		activeChat.value?.announcement,
	],
	() => {
		if (!isGroupChat.value || !currentGroupChat.value) {
			stopGroupMembersPolling()
			groupMembers.value = []
			return
		}
		startGroupMembersPolling()
		void refreshGroupMembers()
	},
	{ immediate: true },
)

onUnmounted(() => {
	stopGroupMembersPolling()
})
</script>

<style scoped>
.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>

<template>
	<div
		class="h-full w-[300px] shrink-0 border-l border-border-default/50 bg-page-bg/95 backdrop-blur-sm overflow-auto"
	>
		<div class="p-4 border-b border-border-default/50 flex items-center justify-between">
			<span class="text-sm font-semibold text-text-main">{{
				isGroupChat ? '群聊设置' : '好友设置'
			}}</span>
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

		<div v-if="activeChat && !isGroupChat && currentFriend" class="p-4 flex flex-col gap-4">
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

		<div v-else-if="activeChat && isGroupChat && currentGroupChat" class="p-4 flex flex-col gap-4">
			<div class="flex flex-col items-center gap-3 py-2">
				<n-avatar :size="68" round :src="currentGroupChat.avatar" />
				<div class="text-center">
					<div class="text-base font-semibold text-text-main">
						{{ currentGroupChat.name }}
					</div>
					<div class="text-xs text-gray-400 mt-1">
						群号：{{ currentGroupChat.groupNo || '-' }}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<n-tag size="small" :bordered="false" type="info">
						{{ currentGroupChat.myRole || 'MEMBER' }}
					</n-tag>
					<n-tag size="small" :bordered="false">
						{{ currentGroupChat.memberCount || 0 }}/{{ currentGroupChat.maxMembers || 500 }} 人
					</n-tag>
				</div>
			</div>

			<div class="rounded-xl border border-border-default/60 p-3 text-xs text-gray-500 space-y-2">
				<div class="flex items-start justify-between gap-2">
					<span class="break-all">群公告：{{ currentGroupChat.announcement?.trim() || '暂无群公告' }}</span>
				</div>
				<n-input
					v-model:value="announcementDraft"
					type="textarea"
					:autosize="{ minRows: 2, maxRows: 4 }"
					placeholder="输入新公告"
					maxlength="200"
				/>
				<n-button
					size="small"
					block
					secondary
					:disabled="!canEditAnnouncement"
					:loading="isSavingAnnouncement"
					@click="saveAnnouncement"
				>
					{{ canEditAnnouncement ? '更新公告' : '仅群主/管理员可更新公告' }}
				</n-button>
			</div>

			<div class="rounded-xl border border-border-default/60 p-3 space-y-2">
				<div class="text-xs font-semibold text-text-main">邀请好友入群</div>
				<n-select
					v-model:value="selectedInviteAccount"
					:options="inviteOptions"
					placeholder="选择好友"
					filterable
					clearable
					size="small"
				/>
				<n-button
					type="primary"
					block
					:loading="isInvitingFriend"
					:disabled="!selectedInviteAccount"
					@click="inviteSelectedFriend"
				>
					邀请入群
				</n-button>
			</div>

			<div class="rounded-xl border border-border-default/60 p-3 space-y-2">
				<div class="flex items-center justify-between">
					<div class="text-xs font-semibold text-text-main">群成员</div>
					<n-button size="tiny" tertiary :loading="isLoadingMembers" @click="refreshGroupMembers">
						刷新
					</n-button>
				</div>
				<div v-if="groupMembers.length" class="max-h-[180px]">
					<n-scrollbar class="max-h-[180px]">
						<div class="flex flex-col gap-1">
							<div
								v-for="member in groupMembers"
								:key="member.account"
								class="rounded-lg bg-page-bg/80 px-2 py-1.5 text-xs flex items-center justify-between gap-2"
							>
								<div class="min-w-0 flex items-center gap-2">
									<n-avatar
										:size="24"
										round
										:src="getMemberAvatar(member)"
									/>
									<div class="min-w-0">
										<div class="truncate text-text-main">
											{{ getMemberDisplayName(member) }}
										</div>
										<div class="truncate text-[10px] text-gray-400">
											{{ member.account }}
										</div>
									</div>
								</div>
								<n-tag size="tiny" :bordered="false">{{ member.role }}</n-tag>
							</div>
						</div>
					</n-scrollbar>
				</div>
				<n-empty v-else description="暂无成员信息" size="small" />
			</div>

			<div class="flex flex-col gap-2">
				<n-button secondary block @click="copyGroupNo">
					复制群号
				</n-button>
				<n-button secondary block @click="togglePinChat">
					{{ activeChat.isPinned ? '取消置顶聊天' : '置顶聊天' }}
				</n-button>
				<n-button secondary block @click="markCurrentChatRead">
					标记为已读
				</n-button>
				<n-button
					type="error"
					ghost
					block
					:disabled="currentGroupChat.myRole === 'OWNER'"
					@click="quitCurrentGroup"
				>
					{{ currentGroupChat.myRole === 'OWNER' ? '群主暂不可退群' : '退出群聊' }}
				</n-button>
				<n-button type="error" ghost block @click="deleteCurrentChat">
					仅删除本地会话
				</n-button>
			</div>
		</div>

		<div v-else class="h-[260px] flex items-center justify-center text-xs text-gray-400">
			请选择一个聊天
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NAvatar, NButton, NEmpty, NIcon, NInput, NScrollbar, NSelect, NTag, useMessage } from 'naive-ui'
import { Dismiss24Regular } from '@vicons/fluent'
import { useChatStore } from '@renderer/stores/chat'
import { useFriendStore } from '@renderer/stores/friend'
import type { GroupMember } from '@renderer/services/groupChatApi'
import { resolveAvatarUrl } from '@renderer/utils/avatar'

defineEmits<{
	(e: 'close'): void
}>()

const chatStore = useChatStore()
const friendStore = useFriendStore()
const message = useMessage()

const { activeChat } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)
const groupMembers = ref<GroupMember[]>([])
const isLoadingMembers = ref(false)
const selectedInviteAccount = ref<string | null>(null)
const isInvitingFriend = ref(false)
const announcementDraft = ref('')
const isSavingAnnouncement = ref(false)

const isGroupChat = computed(() => activeChat.value?.chatType === 'GROUP')

const currentGroupChat = computed(() => {
	if (!activeChat.value || !isGroupChat.value) return null
	return activeChat.value
})

const currentFriend = computed(() => {
	if (!activeChat.value) return null
	return friends.value.find((item) => Number(item.id) === activeChat.value?.id) || null
})

const canEditAnnouncement = computed(() => {
	const role = currentGroupChat.value?.myRole
	return role === 'OWNER' || role === 'ADMIN'
})

const inviteOptions = computed(() => {
	const memberAccountSet = new Set(groupMembers.value.map((item) => item.account))
	return friends.value
		.filter((friend) => !memberAccountSet.has(friend.id))
		.map((friend) => ({
			label: `${friend.remark || friend.name} (${friend.id})`,
			value: friend.id,
		}))
})

const getMemberDisplayName = (member: GroupMember): string => {
	const friend = friends.value.find((item) => item.id === member.account)
	return (
		member.name?.trim() ||
		friend?.remark?.trim() ||
		friend?.name?.trim() ||
		member.account
	)
}

const getMemberAvatar = (member: GroupMember): string => {
	const friend = friends.value.find((item) => item.id === member.account)
	const avatarUrl = member.avatarUrl?.trim() || friend?.avatar?.trim() || ''
	if (avatarUrl) {
		return resolveAvatarUrl(avatarUrl)
	}
	return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(member.account)}`
}

const refreshGroupMembers = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	if (!groupNo) {
		groupMembers.value = []
		return
	}
	isLoadingMembers.value = true
	try {
		groupMembers.value = await chatStore.getGroupMembers(groupNo)
	} catch (error) {
		groupMembers.value = []
		const tip =
			error instanceof Error && error.message ? error.message : '拉取群成员失败'
		message.error(tip)
	} finally {
		isLoadingMembers.value = false
	}
}

const inviteSelectedFriend = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	const account = selectedInviteAccount.value?.trim()
	if (!groupNo || !account) return
	isInvitingFriend.value = true
	try {
		await chatStore.inviteGroupFriend(groupNo, account)
		message.success('邀请已发送')
		selectedInviteAccount.value = null
		await refreshGroupMembers()
	} catch (error) {
		const tip =
			error instanceof Error && error.message ? error.message : '邀请失败，请稍后再试'
		message.error(tip)
	} finally {
		isInvitingFriend.value = false
	}
}

const saveAnnouncement = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	if (!groupNo || !canEditAnnouncement.value) return
	isSavingAnnouncement.value = true
	try {
		const detail = await chatStore.updateGroupAnnouncement(groupNo, announcementDraft.value)
		announcementDraft.value = detail.announcement || ''
		message.success('群公告已更新')
	} catch (error) {
		const tip =
			error instanceof Error && error.message ? error.message : '更新公告失败'
		message.error(tip)
	} finally {
		isSavingAnnouncement.value = false
	}
}

const copyGroupNo = async (): Promise<void> => {
	const groupNo = currentGroupChat.value?.groupNo?.trim()
	if (!groupNo) return
	try {
		await navigator.clipboard.writeText(groupNo)
		message.success('群号已复制')
	} catch {
		message.error('复制失败，请手动复制')
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
	} catch (error) {
		const tip =
			error instanceof Error && error.message ? error.message : '退群失败，请稍后再试'
		message.error(tip)
	}
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

watch(
	() => [activeChat.value?.id, activeChat.value?.chatType, activeChat.value?.announcement],
	() => {
		if (!isGroupChat.value || !currentGroupChat.value) {
			groupMembers.value = []
			selectedInviteAccount.value = null
			announcementDraft.value = ''
			return
		}
		announcementDraft.value = currentGroupChat.value.announcement || ''
		void refreshGroupMembers()
	},
	{ immediate: true },
)
</script>

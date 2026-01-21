<template>
	<div
		v-if="currentChat"
		class="h-full w-full flex flex-col justify-between can"
	>
		<!-- heard  -->
		<div
			class="h-20 border-b shrink-0 border-gray-200 flex item-center justify-between w-full p-3"
		>
			<div class="flex gap-2 items-center">
				<n-avatar
					round
					:src="currentChat?.avatar"
					class="no-drag cursor-pointer"
				></n-avatar>
				<div class="flex flex-col">
					<span
						class="text-[16px] no-drag font-medium w-fit text-zinc-800"
						>{{ currentChat?.name }}</span
					>
					<span class="text-[11px] text-gray-400"
						>1390703178@dhaudh.com</span
					>
				</div>
			</div>
			<div class="w-40 h-13 grid grid-cols-5 gap-1 no-drag">
				<div
					v-for="item in menus"
					:key="item.key"
					class="z-100! no-drag grid-cols-1 flex items-center justify-center rounded-md h-8 hover:bg-gray-100 cursor-pointer"
				>
					<n-icon size="15" color="#555">
						<component :is="iconMap[item.icon]" />
					</n-icon>
				</div>
			</div>
		</div>
		<!-- context -->
		<div class="flex-1 overflow-hidden relative">
			<ChatContainer :messages="currentChatMessages" />
		</div>
		<!-- input -->
		<div class="h-fit py-2 w-full px-4 border-t border-gray-200 shrink-0">
			<chat-edit
				v-if="activeChatId !== null"
				:key="activeChatId"
				:current-id="activeChatId"
			/>
		</div>
	</div>
	<div
		v-if="!currentChat"
		class="h-full w-full flex justify-center items-center bg-gray-50 rounded-xl"
	>
		点击开始聊天
	</div>
</template>

<script setup lang="ts">
import ChatEdit from '@renderer/components/ChatEdit.vue'
import { useChatStore } from '@renderer/stores/chat'
import {
	Calendar,
	Call,
	EllipsisHorizontal,
	PersonAddSharp,
	Search,
} from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import ChatContainer from '@renderer/components/ChatContainer.vue'
const chatStore = useChatStore()

const { activeChat, activeChatId } = storeToRefs(chatStore)

const currentChat = computed(() => {
	return activeChat.value
})

interface menusItem {
	key: string
	label: string
	icon: string
}

const currentChatMessages = computed(() => {
	return chatStore.messages[activeChatId.value] || []
})

//图标映射
const iconMap: Record<string, Component> = {
	search: Search,
	call: Call,
	userAdd: PersonAddSharp,
	calendar: Calendar,
	more: EllipsisHorizontal,
}

//菜单配置
const menus = ref<menusItem[]>([
	{
		key: 'search',
		label: '搜索更多会话',
		icon: 'search',
	},
	{
		key: 'call',
		label: '通话',
		icon: 'call',
	},
	{
		key: 'userAdd',
		label: 'userAdd',
		icon: 'userAdd',
	},
	{
		key: 'calendar',
		label: 'calendar',
		icon: 'calendar',
	},
	{
		key: 'more',
		label: 'more',
		icon: 'more',
	},
])
</script>

<style scoped>
/* 使用 :deep 穿透组件，确保 ChatContainer 内部的消息也被选中 */
.can-select-text,
.can-select-text :deep(*) {
	-webkit-user-select: text !important;
	user-select: text !important;
	/* 必须加上这个，否则在设置了 drag 的容器下依然无法点击选中 */
	-webkit-app-region: no-drag;
}

.chat-messages,
.chat-messages * {
	user-select: text;
}
</style>

<template>
	<div v-if="currentChat" class="h-full w-full flex flex-col justify-between">
		<!-- header -->
		<div
			class="h-14 shrink-0 border-gray-200 flex items-center justify-between w-full p-3"
		>
			<div class="flex gap-2 items-center">
				<n-avatar
					round
					:src="currentChat?.avatar"
					class="no-drag cursor-pointer"
				></n-avatar>
				<div class="flex flex-col">
					<span
						class="text-[16px] no-drag font-medium w-fit text-text-main"
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
					class="no-drag grid-cols-1 flex items-center justify-center rounded-md h-8 hover:bg-gray-100 cursor-pointer"
				>
					<n-icon size="15" color="#555">
						<component :is="iconMap[item.icon]" />
					</n-icon>
				</div>
			</div>
		</div>

		<div class="border-b border-border-main px-4">
			<div v-for="lab in labs" :key="lab.key" class="">
				<n-icon><component :is="iconMap[lab.icon]" /></n-icon>
			</div>
		</div>

		<!-- 消息区域 - 使用 overflow-auto 而不是 overflow-hidden -->
		<div class="flex-1 overflow-auto">
			<ChatContainer :messages="currentChatMessages" />
		</div>

		<!-- 输入区域 - 简化，不要加太多样式 -->
		<div
			class="h-fit py-2 w-full px-4 border-t border-border-main shrink-0"
		>
			<chat-edit
				v-if="activeChatId !== null"
				:key="activeChatId"
				:current-id="activeChatId"
			/>
		</div>
	</div>
	<div
		v-if="!currentChat"
		class="h-full w-full flex justify-center items-center bg-page-bg rounded-xl"
	>
		点击开始聊天
	</div>
</template>

<script setup lang="ts">
import ChatEdit from './ChatEdit.vue'
import { useChatStore } from '@renderer/stores/chat'
import {
	Calendar,
	Call,
	EllipsisHorizontal,
	FileTray,
	PersonAddSharp,
	Search,
} from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import ChatContainer from './ChatContainer.vue'

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

// 图标映射
const iconMap: Record<string, Component> = {
	search: Search,
	call: Call,
	userAdd: PersonAddSharp,
	calendar: Calendar,
	more: EllipsisHorizontal,
	file: FileTray,
}

const labs = ref<menusItem[]>([
	{
		key: 'fileList',
		label: '文件',
		icon: 'file',
	},
])

// 菜单配置
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
	-webkit-app-region: no-drag;
}

.chat-messages,
.chat-messages * {
	user-select: text;
}

/* 确保所有容器都允许溢出 */
:deep(div) {
	overflow: visible !important;
}

/* 确保消息区域可以滚动 */
.flex-1 {
	overflow: auto !important;
	overflow-x: hidden !important;
}
</style>

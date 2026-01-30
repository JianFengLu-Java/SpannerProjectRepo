<template>
	<div
		v-if="currentChat"
		class="h-full w-full flex flex-col justify-between chat-context-root relative"
	>
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

		<!-- 消息区域 -->
		<div class="flex-1 overflow-auto">
			<ChatContainer :messages="currentChatMessages" />
		</div>

		<!-- 输入区域 -->
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
		class="h-full w-full flex flex-col justify-center items-center bg-linear-to-br from-gray-50 to-white rounded-xl p-8"
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
			<h3 class="text-2xl font-black text-gray-800">开始对话</h3>

			<!-- 描述 -->
			<p class="text-sm text-gray-500 leading-relaxed">
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
import {
	Calendar,
	Call,
	EllipsisHorizontal,
	FileTray,
	PersonAddSharp,
	Search,
} from '@vicons/ionicons5'
import { Chat24Regular, ArrowLeft24Regular } from '@vicons/fluent'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import ChatContainer from './ChatContainer.vue'
import { NIcon } from 'naive-ui'

const chatStore = useChatStore()

const { activeChat, activeChatId, activeChatMessages } = storeToRefs(chatStore)

const currentChat = computed(() => {
	return activeChat.value
})

const currentChatMessages = computed(() => {
	return activeChatMessages.value
})

interface menusItem {
	key: string
	label: string
	icon: string
}

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

// 添加一个方法用于子组件获取边界元素
const getBoundaryElement = () => {
	return document.querySelector('.chat-context-root') as HTMLElement
}

// 暴露给子组件使用
defineExpose({
	getBoundaryElement,
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
</style>

<template>
	<div
		v-if="currentChat"
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
					<span
						class="text-[16px] no-drag font-medium w-fit text-text-main"
						>{{ currentChat?.name }}</span
					>
					<span class="text-[11px] text-gray-400">{{
						currentChatEmail
					}}</span>
				</div>
			</div>
			<div class="w-40 h-13 grid grid-cols-5 gap-1 no-drag">
				<div
					v-for="item in menus"
					:key="item.key"
					class="no-drag grid-cols-1 flex items-center justify-center rounded-md h-8 hover:bg-gray-100 dark:hover:bg-zinc-700/40 cursor-pointer"
					@click="handleMenuAction(item.key)"
				>
					<n-icon size="15" class="text-gray-600 dark:text-gray-300">
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

		<n-modal
			v-model:show="showHistorySearchModal"
			preset="card"
			title="查询聊天记录"
			:mask-closable="false"
			class="max-w-[680px]"
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
				<n-input
					v-model:value="historySearchForm.keyword"
					placeholder="关键词（可选）"
				/>
				<n-select
					v-model:value="historySearchForm.type"
					:options="historyTypeOptions"
				/>
				<n-date-picker
					v-model:value="historySearchForm.range"
					type="daterange"
					clearable
					class="w-full"
				/>
			</div>

			<div class="mt-4 flex items-center gap-2 justify-end">
				<n-button tertiary @click="resetHistorySearchForm">
					重置
				</n-button>
				<n-button
					type="primary"
					:loading="isSearchingHistory"
					@click="runHistorySearch"
				>
					查询
				</n-button>
			</div>

			<div
				class="mt-4 border border-border-main rounded-lg p-3 min-h-[260px]"
			>
				<n-spin :show="isSearchingHistory">
					<div
						v-if="!historySearchResults.length"
						class="h-[220px] flex items-center justify-center"
					>
						<n-empty description="暂无查询结果" />
					</div>

					<n-scrollbar v-else class="max-h-[320px]">
						<div
							v-for="item in historySearchResults"
							:key="`${item.serverMessageId || item.clientMessageId || item.id}`"
							class="py-2 border-b border-border-main/60 last:border-b-0"
						>
							<div
								class="flex items-center justify-between gap-2"
							>
								<n-tag size="small" :bordered="false">
									{{ item.type }}
								</n-tag>
								<n-text depth="3">{{
									getDebugMessageTime(item)
								}}</n-text>
							</div>
							<div class="text-sm text-text-main mt-1 break-all">
								{{ getMessagePlainText(item) }}
							</div>
						</div>
					</n-scrollbar>
				</n-spin>
			</div>
		</n-modal>
	</div>
	<div
		v-if="!currentChat"
		class="h-full w-full flex flex-col justify-center items-center bg-linear-to-br from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-950 rounded-xl p-8"
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
			<h3 class="text-2xl font-black text-gray-800 dark:text-gray-100">
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
import { useChatStore, type Message } from '@renderer/stores/chat'
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
import { useFriendStore } from '@renderer/stores/friend'

const chatStore = useChatStore()
const friendStore = useFriendStore()
const emit = defineEmits<{
	(e: 'toggle-friend-setting'): void
}>()

const { activeChat, activeChatId, activeChatMessages } = storeToRefs(chatStore)
const { friends } = storeToRefs(friendStore)

const currentChat = computed(() => {
	return activeChat.value
})

const currentChatMessages = computed(() => {
	return activeChatMessages.value
})

const currentChatEmail = computed(() => {
	if (!currentChat.value) return '未填写邮箱'
	const friend = friends.value.find(
		(item) => Number(item.id) === currentChat.value?.id,
	)
	return friend?.email?.trim() || '未填写邮箱'
})

type MessageTypeFilter = 'all' | 'text' | 'image' | 'file'

const showHistorySearchModal = ref(false)
const isSearchingHistory = ref(false)
const historySearchForm = ref<{
	keyword: string
	type: MessageTypeFilter
	range: [number, number] | null
}>({
	keyword: '',
	type: 'all',
	range: null,
})
const historySearchResults = ref<Message[]>([])
const historyTypeOptions = [
	{ label: '全部类型', value: 'all' },
	{ label: '文本', value: 'text' },
	{ label: '图片', value: 'image' },
	{ label: '文件', value: 'file' },
]

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

const getMessagePlainText = (item: Message): string => {
	const plain = (item.text || '').replace(/<[^>]*>/g, '').trim()
	return plain || '[图片/富文本消息]'
}

const getDebugMessageTime = (item: Message): string => {
	const source = item.sentAt?.trim() || item.timestamp?.trim() || ''
	if (!source) return '-'
	const date = new Date(source)
	if (Number.isNaN(date.getTime())) return source
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	const hh = String(date.getHours()).padStart(2, '0')
	const mm = String(date.getMinutes()).padStart(2, '0')
	const ss = String(date.getSeconds()).padStart(2, '0')
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const resetHistorySearchForm = (): void => {
	historySearchForm.value = {
		keyword: '',
		type: 'all',
		range: null,
	}
	historySearchResults.value = []
}

const handleMenuAction = (key: string): void => {
	if (!activeChatId.value) return
	if (key === 'search') {
		showHistorySearchModal.value = true
		return
	}
	if (key === 'more') {
		emit('toggle-friend-setting')
	}
}

const runHistorySearch = async (): Promise<void> => {
	if (!activeChatId.value) return

	isSearchingHistory.value = true
	try {
		const range = historySearchForm.value.range
		const startDate = range?.[0]
			? new Date(range[0]).toISOString()
			: undefined
		const endDate = range?.[1]
			? new Date(range[1]).toISOString()
			: undefined
		const result = await chatStore.queryChatHistory(activeChatId.value, {
			keyword: historySearchForm.value.keyword || undefined,
			type: historySearchForm.value.type,
			startDate,
			endDate,
			maxPages: 12,
			pageSize: 50,
		})
		historySearchResults.value = result.messages
	} catch (error) {
		console.warn('查询聊天记录失败:', error)
		historySearchResults.value = []
	} finally {
		isSearchingHistory.value = false
		if (!historySearchResults.value.length) {
			console.warn('查询完成但结果为空:', {
				chatId: activeChatId.value,
				keyword: historySearchForm.value.keyword,
				type: historySearchForm.value.type,
				range: historySearchForm.value.range,
			})
		}
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

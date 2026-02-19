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
							:class="currentChatIsVip ? 'text-red-500' : 'text-text-main'"
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
			:block-scroll="false"
			:trap-focus="false"
			:auto-focus="false"
			:show-mask="false"
			class="chat-friend-setting-drawer"
		>
			<n-drawer-content
				:native-scrollbar="false"
				:body-content-style="{ padding: '0', height: '100%', overflow: 'hidden' }"
			>
				<ChatFriendSettingPanel @close="showFriendSettingDrawer = false" />
			</n-drawer-content>
		</n-drawer>

		<n-modal
			v-model:show="showHistorySearchModal"
			:mask-closable="false"
			transform-origin="center"
		>
			<div class="next-search-modal w-[640px] max-h-[90vh] flex flex-col">
				<!-- Header -->
				<div class="modal-header-section">
					<div class="flex items-center justify-between w-full mb-6">
						<div class="icon-orb bg-white/20 backdrop-blur-md">
							<n-icon size="24" class="text-white">
								<Search />
							</n-icon>
						</div>
						<button
							class="close-orb hover:bg-white/10 transition-colors"
							@click="showHistorySearchModal = false"
						>
							<n-icon size="20" class="text-white/80">
								<Dismiss24Regular />
							</n-icon>
						</button>
					</div>
					<div class="text-white">
						<h3 class="text-xl font-bold mb-1">搜索聊天记录</h3>
						<p class="text-white/60 text-xs">
							查找 {{ currentChat?.name }} 的历史消息
						</p>
					</div>
				</div>

				<!-- Body -->
				<div
					class="p-6 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto custom-scrollbar"
				>
					<!-- Search Inputs -->
					<div class="space-y-4 mb-8">
						<div class="grid grid-cols-12 gap-3">
							<div
								class="col-span-8 flex items-center bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl p-1 focus-within:border-blue-500/50 transition-all"
							>
								<div class="px-3 text-gray-400">
									<n-icon size="18"><Search /></n-icon>
								</div>
								<input
									v-model="historySearchForm.keyword"
									placeholder="输入关键词搜索..."
									class="flex-1 bg-transparent border-none outline-none py-2 text-sm text-text-main placeholder:text-gray-400"
									@keyup.enter="runHistorySearch"
								/>
							</div>
							<div class="col-span-4">
								<n-select
									v-model:value="historySearchForm.type"
									:options="historyTypeOptions"
									class="next-custom-select"
								/>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<div class="flex-1">
								<n-date-picker
									v-model:value="historySearchForm.range"
									type="daterange"
									clearable
									placeholder="选择日期范围"
									class="next-custom-datepicker"
								/>
							</div>
							<div class="flex gap-2">
								<button
									tertiary
									@click="resetHistorySearchForm"
								>
									重置
								</button>
								<button
									class="action-btn-primary px-6 py-2 text-xs font-bold rounded-xl text-white transition-all flex items-center gap-2"
									:disabled="isSearchingHistory"
									@click="runHistorySearch"
								>
									<n-spin
										v-if="isSearchingHistory"
										size="small"
										stroke="#fff"
									/>
									<span>
										{{
											isSearchingHistory
												? '检索中'
												: '执行查询'
										}}
									</span>
								</button>
							</div>
						</div>
					</div>

					<!-- Results Area -->
					<div
						class="results-container border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden bg-gray-50/30 dark:bg-white/[0.02]"
					>
						<n-spin :show="isSearchingHistory">
							<div
								v-if="!historySearchResults.length"
								class="h-[300px] flex flex-col items-center justify-center text-gray-400"
							>
								<n-icon size="48" class="opacity-20 mb-2">
									<Search />
								</n-icon>
								<span class="text-xs">
									{{
										isSearchingHistory
											? '正在为您检索相关信息...'
											: '暂无匹配的查询结果'
									}}
								</span>
							</div>

							<div v-else class="h-[400px]">
								<n-scrollbar trigger="hover">
									<div class="p-3 space-y-2">
										<div
											v-for="item in historySearchResults"
											:key="`${item.serverMessageId || item.clientMessageId || item.id}`"
											class="search-item group"
										>
											<div
												class="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-all"
											>
												<div
													class="type-indicator bg-blue-500/10 text-blue-500 text-[10px] h-5 px-1.5 flex items-center rounded-md font-bold uppercase shrink-0"
												>
													{{ item.type }}
												</div>
												<div class="flex-1 min-w-0">
													<div
														class="flex items-center justify-between mb-1"
													>
														<span
															class="text-[10px] text-gray-400"
														>
															{{
																getDebugMessageTime(
																	item,
																)
															}}
														</span>
													</div>
													<div
														class="text-sm text-text-main leading-relaxed"
														v-html="
															highlightKeyword(
																getMessagePlainText(
																	item,
																),
															)
														"
													></div>
												</div>
											</div>
										</div>
									</div>
								</n-scrollbar>
							</div>
						</n-spin>
					</div>
				</div>
			</div>
		</n-modal>
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
import { useChatStore, type Message } from '@renderer/stores/chat'
import {
	Call,
	EllipsisHorizontal,
	PersonAddSharp,
	Search,
} from '@vicons/ionicons5'
import {
	Chat24Regular,
	ArrowLeft24Regular,
	Dismiss24Regular,
} from '@vicons/fluent'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import ChatContainer from './ChatContainer.vue'
import { NIcon, NDrawer, NDrawerContent, useMessage } from 'naive-ui'
import { useFriendStore } from '@renderer/stores/friend'
import ChatFriendSettingPanel from './ChatFriendSettingPanel.vue'
import { useElementSize } from '@vueuse/core'
import vipBadgeIcon from '@renderer/assets/vip-fill-svgrepo-com.svg'

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
	if (!currentChat.value || currentChat.value.chatType === 'GROUP') return false
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

type MessageTypeFilter = 'all' | 'text' | 'image' | 'file'

const showHistorySearchModal = ref(false)
const showFriendSettingDrawer = ref(false)
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
	call: Call,
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
			key: 'call',
			label: '语音通话（开发中）',
			icon: 'call',
			disabled: true,
		},
		{
			key: 'more',
			label: '聊天设置',
			icon: 'more',
		},
	]
})

const getMessagePlainText = (item: Message): string => {
	const plain = (item.text || '').replace(/<[^>]*>/g, '').trim()
	return plain || '[富文本消息/媒体内容]'
}

const highlightKeyword = (text: string): string => {
	const keyword = historySearchForm.value.keyword.trim()
	if (!keyword) return text
	const regex = new RegExp(`(${keyword})`, 'gi')
	return text.replace(
		regex,
		'<span class="text-blue-500 font-bold">$1</span>',
	)
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
	if (key === 'call') {
		message.info('语音通话功能开发中')
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

watch(activeChatId, (nextId) => {
	if (!nextId) {
		showFriendSettingDrawer.value = false
	}
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

:deep(.chat-friend-setting-drawer .n-drawer-content-wrapper) {
	top: 0 !important;
	height: 100% !important;
}

:deep(.chat-friend-setting-drawer .n-drawer-content) {
	height: 100%;
}

/* NextUI Modal Styles */
.next-search-modal {
	border-radius: 32px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
}

.modal-header-section {
	padding: 32px 24px;
	display: flex;
	flex-direction: column;
	background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.icon-orb {
	width: 48px;
	height: 48px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close-orb {
	width: 32px;
	height: 32px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.action-btn-primary {
	background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.action-btn-primary:hover {
	filter: brightness(1.1);
}

.action-btn-primary:active {
	transform: scale(0.96);
}

.action-btn-secondary {
	background: #f4f4f5;
	color: #71717a;
}

.dark .action-btn-secondary {
	background: #27272a;
	color: #a1a1aa;
}

.action-btn-secondary:hover {
	background: #e4e4e7;
}

.next-custom-select :deep(.n-base-selection) {
	border-radius: 16px;
	background-color: transparent !important;
	border-color: rgba(0, 0, 0, 0.04);
}

.dark .next-custom-select :deep(.n-base-selection) {
	border-color: rgba(255, 255, 255, 0.05);
}

.next-custom-datepicker :deep(.n-input) {
	border-radius: 16px;
	background-color: #f9fafb !important;
	border-color: transparent !important;
}

.dark .next-custom-datepicker :deep(.n-input) {
	background-color: rgba(255, 255, 255, 0.03) !important;
}

.search-item {
	cursor: default;
}

.search-item:last-child div {
	border-bottom: none;
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>

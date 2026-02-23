<template>
	<n-modal
		:show="show"
		:mask-closable="false"
		transform-origin="center"
		@update:show="handleShowUpdate"
	>
		<div class="history-search-modal w-[640px] max-h-[90vh] flex flex-col">
			<div
				class="app-modal-header modal-header-gradient history-search-header"
			>
				<div class="flex items-center justify-between w-full">
					<div class="flex items-center gap-3">
						<div class="history-search-icon">
							<n-icon size="18">
								<Search />
							</n-icon>
						</div>
						<div>
							<h3 class="text-[16px] font-semibold text-white">
								搜索聊天记录
							</h3>
							<p class="text-[12px] text-blue-100/90">
								查找 {{ chatName || '当前会话' }} 的历史消息
							</p>
						</div>
					</div>
					<button
						type="button"
						class="app-modal-close hover:bg-white/10 transition-colors"
						@click="closeModal"
					>
						<n-icon size="18" class="text-white/85">
							<Dismiss24Regular />
						</n-icon>
					</button>
				</div>
			</div>

			<div
				class="history-search-body p-5 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto"
			>
				<div class="space-y-3">
					<div class="grid grid-cols-12 gap-3">
						<div class="col-span-8 history-search-input-wrap">
							<n-icon size="16" class="text-gray-400">
								<Search />
							</n-icon>
							<input
								v-model="historySearchForm.keyword"
								placeholder="输入关键词搜索..."
								class="history-search-input"
								@keyup.enter="runHistorySearch"
							/>
						</div>
						<div class="col-span-4">
							<n-select
								v-model:value="historySearchForm.type"
								:options="historyTypeOptions"
								class="history-search-select"
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
								class="history-search-datepicker"
							/>
						</div>
						<button
							type="button"
							class="app-modal-btn-ghost history-btn-ghost"
							@click="resetHistorySearchForm"
						>
							重置
						</button>
						<button
							type="button"
							class="app-modal-btn-primary history-btn-primary"
							:disabled="isSearchingHistory"
							@click="runHistorySearch"
						>
							<n-spin
								v-if="isSearchingHistory"
								size="small"
								class="mr-1"
							/>
							{{ isSearchingHistory ? '检索中' : '执行查询' }}
						</button>
					</div>
				</div>

				<div class="history-result-panel mt-4">
					<n-spin :show="isSearchingHistory">
						<div
							v-if="!historySearchResults.length"
							class="h-[320px] flex flex-col items-center justify-center text-gray-400 gap-2"
						>
							<n-icon size="42" class="opacity-25">
								<Search />
							</n-icon>
							<span class="text-xs">
								{{
									isSearchingHistory
										? '正在检索相关消息...'
										: '暂无匹配的查询结果'
								}}
							</span>
						</div>

						<div v-else class="h-[400px]">
							<n-scrollbar trigger="hover">
								<div class="p-2.5 space-y-2">
									<button
										v-for="item in historySearchResults"
										:key="`${item.serverMessageId || item.clientMessageId || item.id}`"
										type="button"
										class="history-result-item"
										@click="handleResultClick(item)"
									>
										<div class="history-result-top">
											<span class="history-result-type">
												{{ getTypeLabel(item.type) }}
											</span>
											<span class="history-result-time">
												{{ formatMessageTime(item) }}
											</span>
										</div>
										<div class="history-result-text">
											<template
												v-for="(
													segment, index
												) in buildHighlightedSegments(
													getMessagePlainText(item),
												)"
												:key="`${item.id}-${index}`"
											>
												<mark
													v-if="segment.isHit"
													class="history-highlight"
												>
													{{ segment.text }}
												</mark>
												<span v-else>
													{{ segment.text }}
												</span>
											</template>
										</div>
									</button>
								</div>
							</n-scrollbar>
						</div>
					</n-spin>
				</div>
			</div>
		</div>
	</n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { Search } from '@vicons/ionicons5'
import { Dismiss24Regular } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { requestMessageJumpFromSearchResult } from './utils/messageJump'

type MessageTypeFilter = 'all' | 'text' | 'image' | 'file' | 'transfer'

const props = defineProps<{
	show: boolean
	chatId: number | null
	chatName?: string
	loadedMessages: Message[]
}>()

const emit = defineEmits<{
	(e: 'update:show', value: boolean): void
}>()

const chatStore = useChatStore()
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
	{ label: '转账', value: 'transfer' },
	{ label: '文件', value: 'file' },
]

const escapedKeyword = computed(() =>
	historySearchForm.value.keyword
		.trim()
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
)

const closeModal = (): void => {
	emit('update:show', false)
}

const handleShowUpdate = (value: boolean): void => {
	emit('update:show', value)
}

const resetHistorySearchForm = (): void => {
	historySearchForm.value = {
		keyword: '',
		type: 'all',
		range: null,
	}
	historySearchResults.value = []
}

const runHistorySearch = async (): Promise<void> => {
	if (!props.chatId) return
	isSearchingHistory.value = true
	try {
		const range = historySearchForm.value.range
		const startDate = range?.[0]
			? new Date(range[0]).toISOString()
			: undefined
		const endDate = range?.[1]
			? new Date(range[1]).toISOString()
			: undefined
		const result = await chatStore.queryChatHistory(props.chatId, {
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
	}
}

const getTypeLabel = (type: string): string => {
	if (type === 'text') return '文本'
	if (type === 'image') return '图片'
	if (type === 'file') return '文件'
	if (type === 'transfer') return '转账'
	return '消息'
}

const getMessagePlainText = (item: Message): string => {
	if (item.type === 'image') return '[图片]'
	if (item.type === 'file') return '[文件]'
	if (item.type === 'transfer') return '[转账消息]'
	const plain = (item.text || '').replace(/<[^>]*>/g, '').trim()
	return plain || '[富文本消息/媒体内容]'
}

const buildHighlightedSegments = (
	text: string,
): Array<{ text: string; isHit: boolean }> => {
	const keyword = escapedKeyword.value
	if (!keyword) return [{ text, isHit: false }]
	const splitRegex = new RegExp(`(${keyword})`, 'gi')
	const hitRegex = new RegExp(`^${keyword}$`, 'i')
	const parts = text.split(splitRegex).filter((part) => part.length > 0)
	if (!parts.length) return [{ text, isHit: false }]
	return parts.map((part) => ({
		text: part,
		isHit: hitRegex.test(part),
	}))
}

const formatMessageTime = (item: Message): string => {
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

const handleResultClick = (item: Message): void => {
	if (!props.chatId) return
	requestMessageJumpFromSearchResult({
		chatStore,
		chatId: props.chatId,
		loadedMessages: props.loadedMessages,
		message: item,
	})
	closeModal()
}

watch(
	() => props.chatId,
	() => {
		resetHistorySearchForm()
	},
)
</script>

<style scoped>
.history-search-modal {
	border-radius: 8px;
	overflow: hidden;
	border: 1px solid rgba(148, 163, 184, 0.24) !important;
}

.history-search-header {
	padding: 14px 14px 16px;
}

.history-search-icon {
	width: 32px;
	height: 32px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ffffff;
	background: rgba(255, 255, 255, 0.2);
}

.history-search-body {
	border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.history-search-input-wrap {
	height: 40px;
	padding: 0 12px;
	border-radius: 12px;
	border: 1px solid rgba(148, 163, 184, 0.26);
	display: flex;
	align-items: center;
	gap: 8px;
	background: #f8fafc;
}

.history-search-input-wrap:focus-within {
	border-color: rgba(59, 130, 246, 0.52);
}

.history-search-input {
	flex: 1;
	height: 100%;
	border: none;
	outline: none;
	background: transparent;
	font-size: 13px;
	color: #0f172a;
}

.history-search-input::placeholder {
	color: #94a3b8;
}

.history-btn-ghost,
.history-btn-primary {
	height: 38px;
	padding: 0 16px;
	font-size: 12px;
}

.history-btn-primary:disabled {
	opacity: 0.75;
	cursor: not-allowed;
}

.history-result-panel {
	border-radius: 12px;
	border: 1px solid rgba(148, 163, 184, 0.2);
	background: #f8fafc;
	overflow: hidden;
}

.history-result-item {
	width: 100%;
	text-align: left;
	padding: 10px 12px;
	border-radius: 10px;
	border: 1px solid rgba(148, 163, 184, 0.16);
	background: #ffffff;
	transition:
		border-color 0.18s ease,
		background-color 0.18s ease;
}

.history-result-item:hover {
	border-color: rgba(59, 130, 246, 0.4);
	background: #f8fbff;
}

.history-result-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 6px;
}

.history-result-type {
	height: 20px;
	padding: 0 8px;
	border-radius: 999px;
	font-size: 10px;
	line-height: 20px;
	color: #1d4ed8;
	background: rgba(59, 130, 246, 0.12);
}

.history-result-time {
	font-size: 11px;
	color: #94a3b8;
}

.history-result-text {
	font-size: 13px;
	line-height: 1.55;
	color: #0f172a;
	word-break: break-word;
}

.history-result-text :deep(.history-highlight) {
	padding: 0 2px;
	border-radius: 4px;
	background: rgba(253, 224, 71, 0.38);
	color: #854d0e;
}

.dark .history-search-modal {
	border-color: rgba(82, 82, 91, 0.72) !important;
}

.dark .history-search-body {
	border-top-color: rgba(82, 82, 91, 0.65);
}

.dark .history-search-input-wrap {
	border-color: rgba(82, 82, 91, 0.75);
	background: rgba(39, 39, 42, 0.9);
}

.dark .history-search-input {
	color: #f4f4f5;
}

.dark .history-result-panel {
	border-color: rgba(82, 82, 91, 0.72);
	background: rgba(24, 24, 27, 0.92);
}

.dark .history-result-item {
	border-color: rgba(82, 82, 91, 0.66);
	background: rgba(39, 39, 42, 0.9);
}

.dark .history-result-item:hover {
	border-color: rgba(96, 165, 250, 0.55);
	background: rgba(39, 39, 42, 0.98);
}

.dark .history-result-text {
	color: #f4f4f5;
}

:deep(.history-search-select .n-base-selection) {
	height: 40px;
	border-radius: 12px;
	border-color: rgba(148, 163, 184, 0.26);
	background: #f8fafc;
}

:deep(.history-search-datepicker .n-input) {
	height: 40px;
	border-radius: 12px;
	border-color: rgba(148, 163, 184, 0.26);
	background: #f8fafc;
}

.dark :deep(.history-search-select .n-base-selection),
.dark :deep(.history-search-datepicker .n-input) {
	border-color: rgba(82, 82, 91, 0.75);
	background: rgba(39, 39, 42, 0.9);
}
</style>

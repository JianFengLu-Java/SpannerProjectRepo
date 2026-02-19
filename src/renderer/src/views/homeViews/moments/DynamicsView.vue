<template>
	<div
		ref="containerRef"
		class="h-full w-full flex flex-col overflow-hidden bg-page-bg transition-all duration-300 relative"
	>
		<!-- 列表页 (始终保持在 DOM 中以保留滚动位置与背景视觉) -->
		<div class="h-full flex flex-col">
			<!-- 顶部导航与分类 -->
			<div class="p-6 pb-4 shrink-0">
				<div
					class="flex justify-between mb-4"
					:class="[
						containerWidth < 650
							? 'flex-col gap-4 items-start'
							: 'items-center',
					]"
				>
					<div class="flex items-center gap-4 overflow-hidden w-full">
						<h2
							class="text-2xl font-black text-text-main tracking-tight shrink-0"
						>
							发现精彩
						</h2>
						<div
							class="flex items-center gap-1 bg-gray-100/50 dark:bg-zinc-800/60 p-1 rounded-2xl overflow-x-auto no-scrollbar shrink-0"
						>
							<div
								v-for="tab in tabs"
								:key="tab.key"
								class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all no-drag shrink-0"
								:class="[
									momentStore.activeTab === tab.key
										? 'bg-white dark:bg-zinc-700 text-primary shadow-sm scale-105'
										: 'text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100',
								]"
								@click="momentStore.activeTab = tab.key"
							>
								{{ tab.label }}
							</div>
						</div>
					</div>

					<div
						class="flex items-center gap-3"
						:class="[containerWidth < 650 ? 'w-full' : '']"
					>
						<n-input
							v-model:value="momentStore.searchQuery"
							placeholder="搜索内容..."
							class="rounded-2xl bg-gray-100/50 dark:bg-zinc-800/60 border-none transition-all no-drag duration-300"
							:class="[containerWidth < 650 ? 'flex-1' : 'w-64']"
							size="medium"
						>
							<template #prefix>
								<n-icon class="text-gray-400"
									><Search24Regular
								/></n-icon>
							</template>
						</n-input>

						<n-button
							type="primary"
							class="h-10 px-4 shadow-lg shadow-primary/20 shrink-0 no-drag rounded-xl font-bold"
							@click="handlePublish"
						>
							<template #icon>
								<n-icon size="20"><Add24Filled /></n-icon>
							</template>
							发布
						</n-button>
					</div>
				</div>

				<!-- 热门话题 -->
				<div
					v-if="containerWidth > 500"
					class="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2"
				>
					<div
						v-for="tag in hotTags"
						:key="tag"
						class="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-[11px] font-medium text-gray-500 dark:text-gray-300 hover:border-primary/30 hover:text-primary transition-all cursor-pointer shrink-0"
					>
						# {{ tag }}
					</div>
				</div>
			</div>

			<!-- 动态内容区 (瀑布流布局) -->
			<div class="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar">
				<div
					v-if="momentStore.activeTab === 'friends'"
					class="friend-list-shell mx-auto w-full"
				>
					<FriendMomentList :moments="filteredMoments" />
				</div>
				<div v-else class="grid gap-4" :style="gridStyle">
					<MomentCard
						v-for="moment in filteredMoments"
						:key="moment.id"
						:moment="moment"
						class="w-full"
						@click="handleMomentClick"
					/>
				</div>

				<!-- 加载状态 -->
				<div
					v-if="momentStore.isLoading"
					class="flex justify-center py-8"
				>
					<n-spin size="large" />
				</div>

				<!-- 空状态 -->
				<div
					v-if="filteredMoments.length === 0"
					class="h-[400px] flex flex-col items-center justify-center opacity-30 select-none"
				>
					<n-icon
						size="120"
						class="mb-4 text-gray-300 dark:text-gray-600"
					>
						<LeafOutline />
					</n-icon>
					<span class="text-lg text-gray-400 dark:text-gray-500"
						>暂时没有发现更多动态</span
					>
				</div>
			</div>
		</div>

		<!-- 详情展示区域 (包含遮罩与抽屉) -->
		<div
			class="absolute inset-0 z-50 flex justify-end overflow-hidden pointer-events-none"
		>
			<!-- 侧边抽屉背景遮罩 (仅在大屏模式显示) -->
			<Transition name="fade-backdrop">
				<div
					v-if="momentStore.selectedMoment && containerWidth > 1000"
					class="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
				></div>
			</Transition>

			<!-- 详情抽屉内容 -->
			<Transition
				:name="containerWidth > 1000 ? 'drawer-slide' : 'detail-slide'"
			>
				<div
					v-if="momentStore.selectedMoment"
					ref="detailDrawerRef"
					class="h-full bg-white dark:bg-zinc-900 shadow-2xl relative z-10 pointer-events-auto detail-drawer-no-drag"
					:style="{ width: containerWidth > 1000 ? '550px' : '100%' }"
				>
					<MomentDetail
						:moment="momentStore.selectedMoment!"
						@back="momentStore.selectedMomentId = null"
					/>
				</div>
			</Transition>
		</div>

		<n-modal
			v-model:show="showPublishModal"
			preset="card"
			:style="publishModalStyle"
			title="发布帖子"
			:mask-closable="false"
			:bordered="false"
			size="huge"
			segmented
		>
			<MomentPublishEditor
				:submitting="publishing"
				@cancel="showPublishModal = false"
				@submit="handleSubmitPublish"
			/>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Search24Regular, Add24Filled } from '@vicons/fluent'
import { LeafOutline } from '@vicons/ionicons5'
import { NIcon, NInput, NButton, NSpin, NModal, useMessage } from 'naive-ui'
import { useElementSize, useWindowSize } from '@vueuse/core'
import MomentCard from './MomentCard.vue'
import MomentDetail from './MomentDetail.vue'
import MomentPublishEditor from './MomentPublishEditor.vue'
import FriendMomentList from './FriendMomentList.vue'
import { useMomentStore, Moment } from '@renderer/stores/moment'

const momentStore = useMomentStore()
const message = useMessage()

const containerRef = ref<HTMLElement | null>(null)
const detailDrawerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)
const { width: windowWidth } = useWindowSize()

const showPublishModal = ref(false)
const publishing = ref(false)
// activeTab, searchQuery, selectedMoment 已由于需要保持状态移至 Store

const publishModalStyle = computed(() => {
	if (windowWidth.value <= 768) {
		return {
			width: 'calc(100vw - 20px)',
			height: 'calc(100vh - 20px)',
			maxHeight: 'calc(100vh - 20px)',
			marginTop: '10px',
			overflow: 'hidden',
		}
	}
	return {
		width: 'min(860px, calc(100vw - 48px))',
		height: '80vh',
		maxHeight: 'calc(100vh - 24px)',
		overflow: 'hidden',
	}
})

const gridStyle = computed(() => {
	if (containerWidth.value < 650) {
		return {
			gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
		}
	}

	const gap = 16
	const contentWidth = Math.max(containerWidth.value - 48, 0)
	const targetCardWidth =
		containerWidth.value >= 1800
			? 160
			: containerWidth.value >= 1400
				? 170
				: 180
	const columns = Math.max(
		2,
		Math.floor((contentWidth + gap) / (targetCardWidth + gap)),
	)

	return {
		gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
	}
})

const tabs = [
	{ key: 'recommend', label: '推荐' },
	{ key: 'friends', label: '朋友' },
	{ key: 'nearby', label: '附近' },
	{ key: 'trending', label: '热榜' },
] as const

const hotTags = [
	'猫咪大赏',
	'程序员的日常',
	'深圳探店',
	'极简主义',
	'今日份穿搭',
	'读书分享',
	'我的独处时光',
]

const filteredMoments = computed(() => {
	return momentStore.moments
})

const handlePublish = (): void => {
	showPublishModal.value = true
}

const handleSubmitPublish = async (payload: {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}): Promise<void> => {
	try {
		publishing.value = true
		await momentStore.addMoment(payload)
		showPublishModal.value = false
		message.success('发布成功')
		await momentStore.fetchMoments({ reset: true })
	} catch (error) {
		console.error('发布动态失败', error)
		message.error('发布失败，请稍后重试')
	} finally {
		publishing.value = false
	}
}

const handleMomentClick = async (moment: Moment): Promise<void> => {
	try {
		await momentStore.openMoment(moment.id)
	} catch (error) {
		console.error('加载动态详情失败', error)
		message.error('加载详情失败，请稍后重试')
	}
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let detailNoDragObserver: MutationObserver | null = null
let detailNoDragRafId: number | null = null

const applyNoDragToDrawerTree = (): void => {
	const root = detailDrawerRef.value
	if (!root) return
	root.style.setProperty('-webkit-app-region', 'no-drag', 'important')
	const nodes = root.querySelectorAll<HTMLElement>('*')
	nodes.forEach((node) => {
		node.style.setProperty('-webkit-app-region', 'no-drag', 'important')
	})
}

const scheduleApplyNoDragToDrawerTree = (): void => {
	if (detailNoDragRafId !== null) {
		cancelAnimationFrame(detailNoDragRafId)
	}
	detailNoDragRafId = requestAnimationFrame(() => {
		detailNoDragRafId = null
		applyNoDragToDrawerTree()
	})
}

const startDetailNoDragGuard = (): void => {
	if (!detailDrawerRef.value) return
	scheduleApplyNoDragToDrawerTree()
	if (detailNoDragObserver) {
		detailNoDragObserver.disconnect()
	}
	detailNoDragObserver = new MutationObserver(() => {
		scheduleApplyNoDragToDrawerTree()
	})
	detailNoDragObserver.observe(detailDrawerRef.value, {
		childList: true,
		subtree: true,
	})
}

const stopDetailNoDragGuard = (): void => {
	if (detailNoDragObserver) {
		detailNoDragObserver.disconnect()
		detailNoDragObserver = null
	}
	if (detailNoDragRafId !== null) {
		cancelAnimationFrame(detailNoDragRafId)
		detailNoDragRafId = null
	}
}

const refreshMoments = (delay = 0): void => {
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer)
		searchDebounceTimer = null
	}
	searchDebounceTimer = setTimeout(() => {
		void momentStore.fetchMoments({ reset: true })
	}, delay)
}

watch(
	() => momentStore.activeTab,
	() => refreshMoments(),
)

watch(
	() => momentStore.searchQuery,
	() => refreshMoments(300),
)

watch(
	() => momentStore.selectedMomentId,
	async (selectedMomentId) => {
		if (!selectedMomentId) {
			stopDetailNoDragGuard()
			return
		}
		await nextTick()
		startDetailNoDragGuard()
	},
)

onMounted(() => {
	void momentStore.fetchMoments({ reset: true })
})

onUnmounted(() => {
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer)
		searchDebounceTimer = null
	}
	stopDetailNoDragGuard()
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.05);
	border-radius: 2px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.1);
}

.no-scrollbar::-webkit-scrollbar {
	display: none;
}

.friend-list-shell {
	max-width: min(860px, 100%);
}

@media (max-width: 900px) {
	.friend-list-shell {
		max-width: min(720px, 100%);
	}
}

@media (max-width: 640px) {
	.friend-list-shell {
		max-width: 100%;
	}
}

/* 详情页滑入动效 */
.detail-slide-enter-active,
.detail-slide-leave-active,
.drawer-slide-enter-active,
.drawer-slide-leave-active {
	transition: all 0.45s cubic-bezier(0.32, 1, 0.23, 1);
}

.detail-slide-enter-from,
.detail-slide-leave-to {
	transform: translateY(100%);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
	transform: translateX(100%);
}

/* 毛玻璃遮罩渐变动效 */
.fade-backdrop-enter-active,
.fade-backdrop-leave-active {
	transition: all 0.4s ease;
}

.fade-backdrop-enter-from,
.fade-backdrop-leave-to {
	opacity: 0;
	-webkit-backdrop-filter: blur(0px);
	backdrop-filter: blur(0px);
}

.fade-backdrop-enter-to,
.fade-backdrop-leave-from {
	opacity: 1;
	-webkit-backdrop-filter: blur(4px);
	backdrop-filter: blur(4px);
}

.detail-drawer-no-drag,
.detail-drawer-no-drag * {
	-webkit-app-region: no-drag;
}
</style>

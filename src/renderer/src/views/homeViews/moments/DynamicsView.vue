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
							class="flex items-center gap-1 bg-gray-100/50 dark:bg-zinc-800/60 p-1 rounded-2xl shrink-0"
						>
							<div
								class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all no-drag"
								:class="
									viewMode === 'feed'
										? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
										: 'text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100'
								"
								@click="switchViewMode('feed')"
							>
								动态广场
							</div>
							<div
								class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all no-drag"
								:class="
									viewMode === 'about-me'
										? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
										: 'text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100'
								"
								@click="switchViewMode('about-me')"
							>
								与我相关
							</div>
						</div>
					</div>

					<div
						v-if="viewMode === 'feed'"
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
					v-if="viewMode === 'feed' && containerWidth > 500"
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
			<div
				ref="feedScrollRef"
				class="flex-1 overflow-y-auto px-6 custom-scrollbar"
				:class="viewMode === 'feed' ? 'pb-[120px]' : 'pb-8'"
				@scroll="handleFeedScroll"
			>
				<div v-if="viewMode === 'feed'" class="promo-carousel-shell">
					<n-carousel
						autoplay
						draggable
						:interval="4200"
						dot-type="line"
						class="promo-carousel"
					>
						<div
							v-for="banner in promoBanners"
							:key="banner.id"
							class="promo-slide"
						>
							<img
								:src="banner.image"
								:alt="banner.title"
								class="promo-image"
							/>
							<div class="promo-overlay">
								<div class="promo-tag">{{ banner.tag }}</div>
								<h3 class="promo-title">{{ banner.title }}</h3>
								<p class="promo-subtitle">
									{{ banner.subtitle }}
								</p>
							</div>
						</div>
					</n-carousel>
				</div>

				<div v-if="viewMode === 'feed'" class="feed-cards-section">
					<div class="feed-cards-header">
						<h3 class="feed-cards-title">帖子广场</h3>
						<span class="feed-cards-sub">实时更新的精选动态</span>
					</div>
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
				</div>

				<div v-else>
					<MomentAboutMePanel
						:items="momentStore.aboutMeItems"
						:loading="momentStore.aboutMeLoading"
						:has-more="momentStore.aboutMeHasMore"
						@open-moment="openMomentFromAboutMe"
						@load-more="loadMoreAboutMe"
					/>
				</div>

				<!-- 加载状态 -->
				<div
					v-if="viewMode === 'feed' && momentStore.isLoading"
					class="flex justify-center py-8"
				>
					<n-spin size="large" />
				</div>

				<!-- 空状态 -->
				<div
					v-if="viewMode === 'feed' && filteredMoments.length === 0"
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

		<div v-if="viewMode === 'feed'" class="moments-bottom-nav-wrap">
			<div class="moments-bottom-nav">
				<div class="moments-footer-tabs">
					<button
						v-for="tab in tabs"
						:key="tab.key"
						type="button"
						class="moments-bottom-nav-item"
						:class="{
							'is-active': momentStore.activeTab === tab.key,
						}"
						@click="momentStore.activeTab = tab.key"
					>
						{{ tab.label }}
					</button>
				</div>
				<div class="moments-footer-actions">
					<n-button
						circle
						type="default"
						strong
						class="footer-action-btn refresh-btn"
						@click="handleFooterAction"
					>
						<template #icon>
							<n-icon>
								<ArrowUp24Regular v-if="showBackToTop" />
								<ArrowClockwise24Regular v-else />
							</n-icon>
						</template>
					</n-button>
				</div>
			</div>
		</div>

		<!-- 详情展示区域 (弹窗) -->
		<div class="absolute inset-0 z-50 pointer-events-none">
			<Transition name="fade-backdrop">
				<div
					v-if="momentStore.selectedMoment"
					class="absolute inset-0 bg-black/35 backdrop-blur-sm pointer-events-auto"
					@click="momentStore.selectedMomentId = null"
				/>
			</Transition>

			<Transition name="detail-modal">
				<div
					v-if="momentStore.selectedMoment"
					ref="detailModalRef"
					class="absolute inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6 pointer-events-none"
				>
					<div
						class="w-full h-full md:h-auto md:max-h-[90vh] bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden pointer-events-auto detail-modal-surface detail-modal-no-drag"
						:style="detailModalStyle"
					>
						<MomentDetail
							:moment="momentStore.selectedMoment!"
							@back="momentStore.selectedMomentId = null"
						/>
					</div>
				</div>
			</Transition>
		</div>

		<n-modal
			v-model:show="showPublishModal"
			preset="card"
			class="app-modal-card"
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
import {
	Search24Regular,
	Add24Filled,
	ArrowClockwise24Regular,
	ArrowUp24Regular,
} from '@vicons/fluent'
import { LeafOutline } from '@vicons/ionicons5'
import {
	NIcon,
	NInput,
	NButton,
	NSpin,
	NModal,
	NCarousel,
	useMessage,
} from 'naive-ui'
import { useElementSize, useWindowSize } from '@vueuse/core'
import MomentCard from './MomentCard.vue'
import MomentDetail from './MomentDetail.vue'
import MomentPublishEditor from './MomentPublishEditor.vue'
import FriendMomentList from './FriendMomentList.vue'
import MomentAboutMePanel from './MomentAboutMePanel.vue'
import { useMomentStore, Moment } from '@renderer/stores/moment'

const momentStore = useMomentStore()
const message = useMessage()

const containerRef = ref<HTMLElement | null>(null)
const feedScrollRef = ref<HTMLElement | null>(null)
const detailModalRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)
const { width: windowWidth } = useWindowSize()

const showPublishModal = ref(false)
const publishing = ref(false)
const showBackToTop = ref(false)
const viewMode = ref<'feed' | 'about-me'>('feed')
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

const detailModalStyle = computed(() => {
	if (containerWidth.value <= 768) {
		return {
			width: 'calc(100vw - 16px)',
			height: 'calc(100vh - 16px)',
		}
	}
	if (containerWidth.value <= 1200) {
		return {
			width: 'min(980px, calc(100vw - 48px))',
			height: 'min(88vh, 760px)',
		}
	}
	return {
		width: 'min(1100px, calc(100vw - 72px))',
		height: 'min(88vh, 780px)',
	}
})

const tabs = [
	{ key: 'recommend', label: '推荐' },
	{ key: 'friends', label: '朋友' },
	{ key: 'nearby', label: '附近' },
	{ key: 'trending', label: '热榜' },
] as const

const promoBanners = [
	{
		id: 'ops-1',
		tag: '热推专栏',
		title: '城市夜跑挑战赛上线',
		subtitle: '连续 7 天打卡，解锁限定动态勋章与曝光流量',
		image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
	},
	{
		id: 'ops-2',
		tag: '编辑精选',
		title: '本周创作者榜单',
		subtitle: '优质图文加权推荐，发布你的新作品抢占首页位',
		image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
	},
	{
		id: 'ops-3',
		tag: '活动预告',
		title: '春季摄影企划开启',
		subtitle: '投稿即有机会入选官方合集，并获得流量扶持',
		image: 'https://images.unsplash.com/photo-1493244040629-496f6d136cc3?auto=format&fit=crop&w=1600&q=80',
	},
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

const switchViewMode = (mode: 'feed' | 'about-me'): void => {
	viewMode.value = mode
	if (mode === 'about-me' && momentStore.aboutMeItems.length === 0) {
		void momentStore.fetchAboutMe({ reset: true })
	}
}

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

const handleManualRefresh = async (): Promise<void> => {
	try {
		if (viewMode.value === 'about-me') {
			await momentStore.fetchAboutMe({ reset: true })
			message.success('已刷新消息')
		} else {
			await momentStore.fetchMoments({ reset: true })
			message.success('已刷新动态')
		}
	} catch (error) {
		console.error('刷新动态失败', error)
		message.error('刷新失败，请稍后重试')
	}
}

const handleFeedScroll = (event: Event): void => {
	const target = event.target as HTMLElement | null
	showBackToTop.value = Boolean(target && target.scrollTop > 260)
	if (!target || viewMode.value !== 'about-me') return
	const distanceToBottom =
		target.scrollHeight - target.scrollTop - target.clientHeight
	if (distanceToBottom > 120) return
	if (momentStore.aboutMeLoading || !momentStore.aboutMeHasMore) return
	void momentStore.fetchAboutMe({ reset: false })
}

const backToTop = (): void => {
	feedScrollRef.value?.scrollTo({
		top: 0,
		behavior: 'smooth',
	})
}

const handleFooterAction = (): void => {
	if (showBackToTop.value) {
		backToTop()
		return
	}
	void handleManualRefresh()
}

const loadMoreAboutMe = (): void => {
	if (momentStore.aboutMeLoading || !momentStore.aboutMeHasMore) return
	void momentStore.fetchAboutMe({ reset: false })
}

const openMomentFromAboutMe = async (momentId: string): Promise<void> => {
	viewMode.value = 'feed'
	try {
		await momentStore.openMoment(momentId)
	} catch (error) {
		console.error('加载动态详情失败', error)
		message.error('加载详情失败，请稍后重试')
	}
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let detailNoDragObserver: MutationObserver | null = null
let detailNoDragRafId: number | null = null

const applyNoDragToModalTree = (): void => {
	const root = detailModalRef.value
	if (!root) return
	root.style.setProperty('-webkit-app-region', 'no-drag', 'important')
	const nodes = root.querySelectorAll<HTMLElement>('*')
	nodes.forEach((node) => {
		node.style.setProperty('-webkit-app-region', 'no-drag', 'important')
	})
}

const scheduleApplyNoDragToModalTree = (): void => {
	if (detailNoDragRafId !== null) {
		cancelAnimationFrame(detailNoDragRafId)
	}
	detailNoDragRafId = requestAnimationFrame(() => {
		detailNoDragRafId = null
		applyNoDragToModalTree()
	})
}

const startDetailNoDragGuard = (): void => {
	if (!detailModalRef.value) return
	scheduleApplyNoDragToModalTree()
	if (detailNoDragObserver) {
		detailNoDragObserver.disconnect()
	}
	detailNoDragObserver = new MutationObserver(() => {
		scheduleApplyNoDragToModalTree()
	})
	detailNoDragObserver.observe(detailModalRef.value, {
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

.promo-carousel-shell {
	margin: 2px auto 14px;
	width: min(980px, 100%);
}

.feed-cards-section {
	width: min(980px, 100%);
	margin: 0 auto;
	padding: 14px 14px 10px;
	border-radius: 0;
	background: transparent;
}

.feed-cards-header {
	display: flex;
	align-items: baseline;
	gap: 10px;
	padding: 0 2px 12px;
	border-bottom: 1px solid rgba(226, 232, 240, 0.95);
	margin-bottom: 12px;
}

.feed-cards-title {
	font-size: 26px;
	font-weight: 800;
	color: rgb(31 41 55);
	letter-spacing: 0.2px;
	line-height: 1.15;
}

.feed-cards-sub {
	font-size: 11px;
	color: rgb(148 163 184);
}

.promo-carousel {
	height: 248px;
	border-radius: 20px;
	overflow: hidden;
}

.promo-slide {
	position: relative;
	width: 100%;
	height: 100%;
}

.promo-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transform: scale(1.02);
}

.promo-overlay {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	padding: 18px 18px 16px;
	background:
		linear-gradient(
			180deg,
			rgba(15, 23, 42, 0.06) 22%,
			rgba(15, 23, 42, 0.52) 62%,
			rgba(15, 23, 42, 0.78) 100%
		),
		linear-gradient(
			120deg,
			rgba(239, 68, 68, 0.2),
			rgba(59, 130, 246, 0.08)
		);
}

.promo-tag {
	align-self: flex-start;
	font-size: 11px;
	font-weight: 700;
	padding: 4px 9px;
	border-radius: 999px;
	color: rgba(255, 255, 255, 0.95);
	background: rgba(239, 68, 68, 0.82);
	box-shadow: 0 8px 18px rgba(239, 68, 68, 0.35);
}

.promo-title {
	margin-top: 10px;
	color: #fff;
	font-size: 22px;
	font-weight: 800;
	letter-spacing: 0.3px;
}

.promo-subtitle {
	margin-top: 5px;
	color: rgba(255, 255, 255, 0.88);
	font-size: 12px;
}

:deep(.promo-carousel .n-carousel__dots) {
	bottom: 10px;
}

:deep(.promo-carousel .n-carousel__dot) {
	background: rgba(255, 255, 255, 0.55);
}

:deep(.promo-carousel .n-carousel__dot--active) {
	background: rgba(255, 255, 255, 0.95);
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

	.promo-carousel {
		height: 196px;
		border-radius: 16px;
	}

	.promo-overlay {
		padding: 14px 14px 12px;
	}

	.promo-title {
		font-size: 18px;
	}

	.feed-cards-section {
		padding: 12px 10px 8px;
		border-radius: 16px;
	}
}

/* 详情弹窗动效 */
.detail-modal-enter-active,
.detail-modal-leave-active {
	transition: all 0.45s cubic-bezier(0.32, 1, 0.23, 1);
}

.detail-modal-enter-from,
.detail-modal-leave-to {
	opacity: 0;
	transform: scale(0.96) translateY(20px);
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

.detail-modal-no-drag,
.detail-modal-no-drag * {
	-webkit-app-region: no-drag;
}

.detail-modal-surface {
	border-radius: 1rem;
	isolation: isolate;
	transform: translateZ(0);
	-webkit-mask-image: -webkit-radial-gradient(white, black);
}

.moments-bottom-nav-wrap {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 16px;
	z-index: 30;
	display: flex;
	justify-content: center;
	pointer-events: none;
	padding: 0 12px;
}

.moments-bottom-nav {
	pointer-events: auto;
	display: flex;
	align-items: center;
	gap: 10px;
	width: min(640px, 100%);
	padding: 8px;
	border-radius: 18px;
	border: 1px solid rgba(255, 255, 255, 0.45);
	background: rgba(255, 255, 255, 0.52);
	-webkit-backdrop-filter: blur(16px) saturate(140%);
	backdrop-filter: blur(16px) saturate(140%);
	box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
}

.moments-footer-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
	margin-left: auto;
}

.moments-footer-tabs {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 6px;
	flex: 1;
	min-width: 0;
}

.footer-action-btn {
	width: 34px;
	height: 34px;
	transition:
		transform 0.24s ease,
		opacity 0.24s ease,
		filter 0.24s ease;
	animation: footer-btn-enter 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.footer-action-btn:hover {
	transform: translateY(-1px) scale(1.04);
	filter: saturate(1.08);
}

.footer-action-btn.refresh-btn {
	background: rgba(255, 255, 255, 0.96);
	color: rgb(17 24 39);
	border: 1px solid rgba(226, 232, 240, 0.9);
}

.moments-bottom-nav-item {
	border: 0;
	background: transparent;
	border-radius: 12px;
	height: 38px;
	font-size: 12px;
	font-weight: 700;
	color: rgb(75 85 99);
	transition: all 0.22s ease;
}

.moments-bottom-nav-item:hover {
	background: rgba(255, 255, 255, 0.62);
	color: rgb(31 41 55);
}

.moments-bottom-nav-item.is-active {
	background: rgba(255, 255, 255, 0.95);
	color: var(--color-primary);
	box-shadow: 0 8px 20px rgba(59, 130, 246, 0.22);
}

:deep(.dark) .moments-bottom-nav {
	border-color: rgba(82, 82, 91, 0.65);
	background: rgba(24, 24, 27, 0.66);
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

:deep(.dark) .moments-bottom-nav-item {
	color: rgb(212 212 216);
}

:deep(.dark) .moments-bottom-nav-item:hover {
	background: rgba(63, 63, 70, 0.8);
	color: rgb(244 244 245);
}

:deep(.dark) .moments-bottom-nav-item.is-active {
	background: rgba(39, 39, 42, 0.95);
	color: rgb(96 165 250);
	box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
}

:deep(.dark) .footer-action-btn.refresh-btn {
	background: rgba(244, 244, 245, 0.92);
	color: rgb(9, 9, 11);
	border-color: rgba(212, 212, 216, 0.85);
}

@keyframes footer-btn-enter {
	0% {
		opacity: 0;
		transform: translateY(6px) scale(0.9);
	}
	100% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

:deep(.dark) .feed-cards-section {
	background: transparent;
}

:deep(.dark) .feed-cards-header {
	border-bottom-color: rgba(63, 63, 70, 0.85);
}

:deep(.dark) .feed-cards-title {
	color: rgb(244, 244, 245);
}

:deep(.dark) .feed-cards-sub {
	color: rgb(161, 161, 170);
}

@media (min-width: 768px) {
	.detail-modal-surface {
		border-radius: 1.5rem;
	}
}
</style>

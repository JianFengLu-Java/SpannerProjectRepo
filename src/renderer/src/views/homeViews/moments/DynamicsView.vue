<template>
	<div
		ref="containerRef"
		class="h-full w-full flex flex-col overflow-hidden rounded-[24px] bg-page-bg transition-all duration-300 relative"
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
							class="flex items-center gap-1 bg-gray-100/50 p-1 rounded-2xl overflow-x-auto no-scrollbar shrink-0"
						>
							<div
								v-for="tab in tabs"
								:key="tab.key"
								class="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all no-drag shrink-0"
								:class="[
									momentStore.activeTab === tab.key
										? 'bg-white text-primary shadow-sm scale-105'
										: 'text-gray-400 hover:text-gray-600',
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
							class="rounded-2xl bg-gray-100/50 border-none transition-all no-drag duration-300"
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
						class="px-3 py-1.5 rounded-full bg-white border border-gray-100 text-[11px] font-medium text-gray-500 hover:border-primary/30 hover:text-primary transition-all cursor-pointer shrink-0"
					>
						# {{ tag }}
					</div>
				</div>
			</div>

			<!-- 动态内容区 (瀑布流布局) -->
			<div class="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar">
				<FriendMomentList
					v-if="momentStore.activeTab === 'friends'"
					:moments="filteredMoments"
				/>
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
				<div v-if="loading" class="flex justify-center py-8">
					<n-spin size="large" />
				</div>

				<!-- 空状态 -->
				<div
					v-if="filteredMoments.length === 0"
					class="h-[400px] flex flex-col items-center justify-center opacity-30 select-none"
				>
					<n-icon size="120" class="mb-4 text-gray-300">
						<LeafOutline />
					</n-icon>
					<span class="text-lg text-gray-400"
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
					@click="momentStore.selectedMomentId = null"
				></div>
			</Transition>

			<!-- 详情抽屉内容 -->
			<Transition
				:name="containerWidth > 1000 ? 'drawer-slide' : 'detail-slide'"
			>
				<div
					v-if="momentStore.selectedMoment"
					class="h-full bg-white shadow-2xl relative z-10 pointer-events-auto"
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
			style="width: min(860px, calc(100vw - 48px)); height: 80vh"
			title="发布帖子"
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
import { ref, computed } from 'vue'
import { Search24Regular, Add24Filled } from '@vicons/fluent'
import { LeafOutline } from '@vicons/ionicons5'
import { NIcon, NInput, NButton, NSpin, NModal, useMessage } from 'naive-ui'
import { useElementSize } from '@vueuse/core'
import MomentCard from './MomentCard.vue'
import MomentDetail from './MomentDetail.vue'
import MomentPublishEditor from './MomentPublishEditor.vue'
import FriendMomentList from './FriendMomentList.vue'
import { useMomentStore, Moment } from '@renderer/stores/moment'

const momentStore = useMomentStore()
const message = useMessage()

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

const loading = ref(false)
const showPublishModal = ref(false)
const publishing = ref(false)
// activeTab, searchQuery, selectedMoment 已由于需要保持状态移至 Store

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
]

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
	let list = momentStore.moments
	if (momentStore.searchQuery) {
		const query = momentStore.searchQuery.toLowerCase()
		list = list.filter(
			(m) =>
				m.title.toLowerCase().includes(query) ||
				m.author.name.toLowerCase().includes(query) ||
				(m.content || '').toLowerCase().includes(query),
		)
	}
	return list
})

if (momentStore.activeTab === 'follow') {
	momentStore.activeTab = 'friends'
}

const handlePublish = (): void => {
	showPublishModal.value = true
}

const handleSubmitPublish = (payload: {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}): void => {
	try {
		publishing.value = true
		momentStore.addMoment(payload)
		showPublishModal.value = false
		message.success('发布成功')
	} finally {
		publishing.value = false
	}
}

const handleMomentClick = (moment: Moment): void => {
	momentStore.selectedMomentId = moment.id
}
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
</style>

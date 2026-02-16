<template>
	<div class="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
		<!-- 顶部返回栏 -->
		<div
			class="p-4 border-b border-gray-100 dark:border-zinc-700 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-md z-10"
		>
			<div class="flex items-center gap-3 no-drag">
				<n-button
					circle
					secondary
					class="hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
					@click="$emit('back')"
				>
					<template #icon>
						<n-icon size="20"><ArrowLeft24Regular /></n-icon>
					</template>
				</n-button>
				<span class="font-bold text-gray-800 dark:text-gray-100"
					>动态详情</span
				>
			</div>
			<div class="flex items-center gap-2 no-drag">
				<n-button circle secondary>
					<template #icon>
						<n-icon size="20"><Share24Regular /></n-icon>
					</template>
				</n-button>
				<n-dropdown
					v-if="isAuthor"
					trigger="click"
					:options="manageOptions"
					@select="handleManageSelect"
				>
					<n-button circle secondary>
						<template #icon>
							<n-icon size="20"
								><MoreHorizontal24Regular
							/></n-icon>
						</template>
					</n-button>
				</n-dropdown>
			</div>
		</div>

		<!-- 详情滚动区域 -->
		<div class="flex-1 overflow-y-auto custom-scrollbar">
			<div class="max-w-4xl mx-auto p-6">
				<!-- 作者信息 -->
				<div class="flex items-center justify-between mb-6 no-drag">
					<div class="flex items-center gap-3">
						<n-avatar
							round
							:size="48"
							:src="moment.author.avatar"
							class="border-2 border-primary/10"
						/>
						<div class="flex flex-col">
							<span
								class="font-bold text-gray-900 dark:text-gray-100"
								>{{ moment.author.name }}</span
							>
							<span
								class="text-xs text-gray-400 dark:text-gray-500"
								>{{ moment.timestamp }}</span
							>
						</div>
					</div>
					<n-button
						round
						type="primary"
						secondary
						size="small"
						class="px-5 font-bold"
					>
						{{ isAuthor ? '我的动态' : '添加好友' }}
					</n-button>
				</div>

				<!-- 图片展示（左右滑动） -->
				<div
					v-if="
						(moment.images && moment.images.length > 0) ||
						(moment.cover && moment.cover.trim())
					"
					class="mb-6 rounded-[24px] overflow-hidden border border-gray-100 dark:border-zinc-700"
				>
					<div
						v-if="moment.images && moment.images.length > 0"
						class="moment-image-carousel-wrap"
					>
						<n-carousel
							draggable
							show-arrow
							dot-type="line"
							class="moment-image-carousel"
						>
							<div
								v-for="(img, index) in moment.images"
								:key="index"
								class="moment-image-slide"
							>
								<img :src="img" class="moment-image" />
							</div>
						</n-carousel>
					</div>
					<div v-else-if="moment.cover && moment.cover.trim()" class="moment-image-slide">
						<img :src="moment.cover" class="moment-image" />
					</div>
				</div>

				<!-- 文字内容 -->
				<div class="px-2 mb-8">
					<h1
						class="text-xl font-black text-gray-900 dark:text-gray-100 mb-4 leading-tight"
					>
						{{ moment.title }}
					</h1>
					<div
						v-if="moment.contentHtml"
						class="moment-rich-content text-gray-600 dark:text-gray-300 leading-relaxed"
						v-html="moment.contentHtml"
					></div>
					<p
						v-else
						class="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap"
					>
						{{ moment.content }}
					</p>
				</div>

				<!-- 互动数据 -->
				<div
					class="flex items-center gap-6 px-2 py-4 border-y border-gray-50 dark:border-zinc-800 mb-8"
				>
					<div
						class="flex items-center gap-1.5 cursor-pointer group"
						@click="handleLike"
					>
						<n-icon
							:size="22"
							:class="[
								moment.isLiked
									? 'text-red-500'
									: 'text-gray-400 group-hover:text-red-400',
							]"
							class="transition-colors"
						>
							<Heart24Filled v-if="moment.isLiked" />
							<Heart24Regular v-else />
						</n-icon>
						<span
							class="text-sm font-bold"
							:class="[
								moment.isLiked
									? 'text-red-500'
									: 'text-gray-500',
							]"
							>{{ moment.likes }}</span
						>
					</div>
					<div
						class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500"
					>
						<n-icon :size="22"><Comment24Regular /></n-icon>
						<span class="text-sm font-bold">{{
							moment.commentsCount ?? moment.comments.length
						}}</span>
					</div>
					<div
						class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500"
					>
						<n-icon :size="22"><Star24Regular /></n-icon>
						<span class="text-sm font-bold">收藏</span>
					</div>
				</div>

				<!-- 评论区 -->
				<div class="px-2 pb-20">
					<h3
						class="text-lg font-black text-gray-900 dark:text-gray-100 mb-6"
					>
						全部评论 ({{
							moment.commentsCount ?? moment.comments.length
						}})
					</h3>

					<div v-if="moment.comments.length > 0" class="space-y-6">
						<div
							v-for="comment in moment.comments"
							:key="comment.id"
							class="flex gap-3"
						>
							<n-avatar
								round
								:size="32"
								:src="comment.author.avatar"
								class="shrink-0"
							/>
							<div class="flex-1">
								<div
									class="flex justify-between items-start mb-1"
								>
									<span
										class="text-sm font-bold text-gray-700 dark:text-gray-200"
										>{{ comment.author.name }}</span
									>
									<div
										class="flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
									>
										<n-icon :size="14"
											><Heart16Regular
										/></n-icon>
										<span class="text-[10px]">{{
											comment.likes
										}}</span>
									</div>
								</div>
								<p
									class="text-[13px] text-gray-600 dark:text-gray-300 leading-snug mb-2"
								>
									{{ comment.text }}
								</p>
								<div class="flex items-center gap-4">
									<span
										class="text-[10px] text-gray-400 dark:text-gray-500"
										>{{ comment.timestamp }}</span
									>
									<span
										class="text-[10px] font-bold text-gray-400 dark:text-gray-500 cursor-pointer hover:text-primary transition-colors"
										>回复</span
									>
								</div>
							</div>
						</div>
					</div>
					<div
						v-else
						class="py-10 text-center text-gray-400 dark:text-gray-500 text-sm"
					>
						成为第一个评论的人吧～
					</div>
				</div>
			</div>
		</div>

		<!-- 底部发表评论栏 -->
		<div
			class="p-4 border-t border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center gap-3"
		>
			<n-input
				v-model:value="commentText"
				placeholder="留下你的精彩评论..."
				round
				class="bg-gray-100/50 border-none flex-1"
			>
				<template #prefix>
					<n-icon class="text-gray-400"><Edit24Regular /></n-icon>
				</template>
			</n-input>
			<n-button
				type="primary"
				round
				:disabled="!commentText.trim() || isSubmittingComment"
				class="px-6 font-bold"
				@click="submitComment"
			>
				发送
			</n-button>
		</div>

		<n-modal
			v-model:show="showEditModal"
			preset="card"
			:style="editModalStyle"
			title="编辑动态"
			:mask-closable="false"
			:bordered="false"
			size="huge"
			segmented
		>
			<MomentPublishEditor
				v-if="showEditModal"
				:key="editEditorKey"
				:submitting="isUpdatingMoment"
				:initial-title="moment.title"
				:initial-content-html="moment.contentHtml || ''"
				:initial-images="moment.images || []"
				submit-text="保存"
				@cancel="showEditModal = false"
				@submit="handleUpdateMoment"
			/>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import {
	ArrowLeft24Regular,
	Share24Regular,
	MoreHorizontal24Regular,
	Heart24Regular,
	Heart24Filled,
	Comment24Regular,
	Star24Regular,
	Edit24Regular,
	Heart16Regular,
} from '@vicons/fluent'
import {
	NButton,
	NCarousel,
	NDropdown,
	NIcon,
	NAvatar,
	NInput,
	NModal,
	useMessage,
} from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { Moment, useMomentStore } from '@renderer/stores/moment'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import MomentPublishEditor from './MomentPublishEditor.vue'

const props = defineProps<{
	moment: Moment
}>()

defineEmits<{
	(e: 'back'): void
}>()

const momentStore = useMomentStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()
const commentText = ref('')
const isSubmittingComment = ref(false)
const showEditModal = ref(false)
const isUpdatingMoment = ref(false)
const isDeletingMoment = ref(false)
const editEditorKey = ref(0)
const { width: windowWidth } = useWindowSize()

const editModalStyle = computed(() => {
	if (windowWidth.value <= 768) {
		return {
			width: 'calc(100vw - 20px)',
			height: 'calc(100vh - 20px)',
			marginTop: '10px',
		}
	}
	return {
		width: 'min(860px, calc(100vw - 48px))',
		height: '80vh',
	}
})

const isAuthor = computed(() => {
	const currentAccount = userInfoStore.account?.trim()
	const authorAccount = props.moment.author.account?.trim()
	return Boolean(
		currentAccount && authorAccount && currentAccount === authorAccount,
	)
})

const manageOptions: DropdownOption[] = [
	{
		label: '编辑动态',
		key: 'edit',
	},
	{
		label: '删除动态',
		key: 'delete',
	},
] as const

const handleManageSelect = (key: string): void => {
	if (key === 'edit') {
		editEditorKey.value += 1
		showEditModal.value = true
		return
	}
	if (key === 'delete') {
		void handleDeleteMoment()
	}
}

const handleLike = async (): Promise<void> => {
	try {
		await momentStore.toggleLike(props.moment.id)
	} catch (error) {
		console.error('点赞失败', error)
		message.error('点赞失败，请稍后重试')
	}
}

const submitComment = async (): Promise<void> => {
	if (!commentText.value.trim()) return
	isSubmittingComment.value = true
	try {
		await momentStore.addComment(props.moment.id, commentText.value)
		message.success('评论发表成功！')
		commentText.value = ''
	} catch (error) {
		console.error('发表评论失败', error)
		message.error('发表评论失败，请稍后重试')
	} finally {
		isSubmittingComment.value = false
	}
}

const handleUpdateMoment = async (payload: {
	title: string
	contentHtml: string
	contentText: string
	images: string[]
}): Promise<void> => {
	isUpdatingMoment.value = true
	try {
		await momentStore.updateMoment(props.moment.id, payload)
		showEditModal.value = false
		message.success('动态更新成功')
	} catch (error) {
		console.error('更新动态失败', error)
		message.error('更新失败，请稍后重试')
	} finally {
		isUpdatingMoment.value = false
	}
}

const handleDeleteMoment = async (): Promise<void> => {
	if (isDeletingMoment.value) return
	const confirmed = window.confirm('确认删除这条动态？删除后不可恢复。')
	if (!confirmed) return
	isDeletingMoment.value = true
	try {
		await momentStore.deleteMoment(props.moment.id)
		message.success('动态已删除')
	} catch (error) {
		console.error('删除动态失败', error)
		message.error('删除失败，请稍后重试')
	} finally {
		isDeletingMoment.value = false
	}
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.05);
	border-radius: 3px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.1);
}

:deep(.moment-rich-content p) {
	margin: 0;
}

:deep(.moment-rich-content p + p) {
	margin-top: 0.5rem;
}

:deep(.moment-rich-content img) {
	max-width: 100%;
	max-height: 560px;
	border-radius: 14px;
	margin: 12px 0;
}

.moment-image-carousel-wrap {
	background: #0b0b0b;
}

.moment-image-carousel {
	width: 100%;
	height: min(62vh, 520px);
}

.moment-image-slide {
	width: 100%;
	height: min(62vh, 520px);
	background: #0b0b0b;
	display: flex;
	align-items: center;
	justify-content: center;
}

.moment-image {
	width: 100%;
	height: 100%;
	object-fit: contain;
	background: #0b0b0b;
}
</style>

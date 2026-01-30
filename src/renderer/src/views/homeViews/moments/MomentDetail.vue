<template>
	<div class="h-full flex flex-col bg-white overflow-hidden">
		<!-- 顶部返回栏 -->
		<div
			class="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10"
		>
			<div class="flex items-center gap-3 no-drag">
				<n-button
					circle
					secondary
					class="hover:bg-gray-100 transition-colors"
					@click="$emit('back')"
				>
					<template #icon>
						<n-icon size="20"><ArrowLeft24Regular /></n-icon>
					</template>
				</n-button>
				<span class="font-bold text-gray-800">动态详情</span>
			</div>
			<div class="flex items-center gap-2 no-drag">
				<n-button circle secondary>
					<template #icon>
						<n-icon size="20"><Share24Regular /></n-icon>
					</template>
				</n-button>
				<n-button circle secondary>
					<template #icon>
						<n-icon size="20"><MoreHorizontal24Regular /></n-icon>
					</template>
				</n-button>
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
							<span class="font-bold text-gray-900">{{
								moment.author.name
							}}</span>
							<span class="text-xs text-gray-400">{{
								moment.timestamp
							}}</span>
						</div>
					</div>
					<n-button
						round
						type="primary"
						secondary
						size="small"
						class="px-5 font-bold"
					>
						关注
					</n-button>
				</div>

				<!-- 图片展示 (如果是多图可以用网格) -->
				<div
					class="mb-6 rounded-[24px] overflow-hidden border border-gray-100"
				>
					<div
						v-if="moment.images && moment.images.length > 0"
						class="grid grid-cols-1 gap-1"
					>
						<img
							v-for="(img, index) in moment.images"
							:key="index"
							:src="img"
							class="w-full object-cover max-h-[600px]"
						/>
					</div>
					<img
						v-else
						:src="moment.cover"
						class="w-full object-cover max-h-[600px]"
					/>
				</div>

				<!-- 文字内容 -->
				<div class="px-2 mb-8">
					<h1
						class="text-xl font-black text-gray-900 mb-4 leading-tight"
					>
						{{ moment.title }}
					</h1>
					<p
						class="text-gray-600 leading-relaxed whitespace-pre-wrap"
					>
						{{ moment.content }}
					</p>
				</div>

				<!-- 互动数据 -->
				<div
					class="flex items-center gap-6 px-2 py-4 border-y border-gray-50 mb-8"
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
					<div class="flex items-center gap-1.5 text-gray-400">
						<n-icon :size="22"><Comment24Regular /></n-icon>
						<span class="text-sm font-bold">{{
							moment.comments.length
						}}</span>
					</div>
					<div class="flex items-center gap-1.5 text-gray-400">
						<n-icon :size="22"><Star24Regular /></n-icon>
						<span class="text-sm font-bold">收藏</span>
					</div>
				</div>

				<!-- 评论区 -->
				<div class="px-2 pb-20">
					<h3 class="text-lg font-black text-gray-900 mb-6">
						全部评论 ({{ moment.comments.length }})
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
										class="text-sm font-bold text-gray-700"
										>{{ comment.author.name }}</span
									>
									<div
										class="flex items-center gap-1 text-gray-400 hover:text-red-400 cursor-pointer transition-colors"
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
									class="text-[13px] text-gray-600 leading-snug mb-2"
								>
									{{ comment.text }}
								</p>
								<div class="flex items-center gap-4">
									<span class="text-[10px] text-gray-400">{{
										comment.timestamp
									}}</span>
									<span
										class="text-[10px] font-bold text-gray-400 cursor-pointer hover:text-primary transition-colors"
										>回复</span
									>
								</div>
							</div>
						</div>
					</div>
					<div v-else class="py-10 text-center text-gray-400 text-sm">
						成为第一个评论的人吧～
					</div>
				</div>
			</div>
		</div>

		<!-- 底部发表评论栏 -->
		<div
			class="p-4 border-t border-gray-100 bg-white flex items-center gap-3"
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
				:disabled="!commentText.trim()"
				class="px-6 font-bold"
				@click="submitComment"
			>
				发送
			</n-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
import { NButton, NIcon, NAvatar, NInput, useMessage } from 'naive-ui'
import { Moment, useMomentStore } from '@renderer/stores/moment'

const props = defineProps<{
	moment: Moment
}>()

defineEmits<{
	(e: 'back'): void
}>()

const momentStore = useMomentStore()
const message = useMessage()
const commentText = ref('')

const handleLike = (): void => {
	momentStore.toggleLike(props.moment.id)
}

const submitComment = (): void => {
	if (!commentText.value.trim()) return
	momentStore.addComment(props.moment.id, commentText.value)
	message.success('评论发表成功！')
	commentText.value = ''
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
</style>

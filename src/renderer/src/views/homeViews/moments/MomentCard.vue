<template>
	<div
		class="moment-card group bg-white dark:b0g-zinc-900 rounded-[14px] overflow-hidden border border-gray-200 dark:border-zinc-700 transition-all duration-300 cursor-pointer"
		@click="$emit('click', moment)"
	>
		<!-- 封面图 -->
		<div
			class="relative aspect-square overflow-hidden bg-gray-100 dark:bg-zinc-800"
		>
			<img
				v-if="hasCoverImage"
				:src="moment.cover"
				class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
				loading="lazy"
			/>
			<img
				v-else
				:src="canvasCoverUrl"
				class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
				loading="lazy"
			/>
			<div
				class="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
			></div>
		</div>

		<!-- 内容区 -->
		<div class="p-3">
			<h3
				class="text-[13px] font-bold text-gray-800 dark:text-gray-100 line-clamp-2 mb-2 leading-snug group-hover:text-primary transition-colors"
			>
				{{ moment.title }}
			</h3>

			<div class="flex items-center justify-between">
				<!-- 作者 -->
				<div class="flex items-center gap-1.5 min-w-0">
					<n-avatar
						round
						:size="24"
						:src="moment.author.avatar"
						class="shrink-0 border border-white dark:border-zinc-700"
					/>
					<span
						class="text-[11px] text-gray-500 dark:text-gray-300 truncate"
						>{{ moment.author.name }}</span
					>
				</div>

				<!-- 互动数据 -->
				<div class="flex items-center gap-2.5 shrink-0">
					<!-- 点赞 -->
					<div
						class="flex items-center gap-1 cursor-pointer active:scale-90 transition-transform"
						@click.stop="toggleLike"
					>
						<n-icon
							:size="16"
							:class="[
								moment.isLiked
									? 'text-red-500'
									: 'text-gray-400',
								'transition-colors',
							]"
						>
							<Heart16Filled v-if="moment.isLiked" />
							<Heart16Regular v-else />
						</n-icon>
						<span
							class="text-[11px] font-medium select-none"
							:class="[
								moment.isLiked
									? 'text-red-500'
									: 'text-gray-400',
							]"
							>{{ formatCount(moment.likes) }}</span
						>
					</div>

					<!-- 评论 -->
					<div
						class="flex items-center gap-1 text-gray-400 dark:text-gray-500"
					>
						<n-icon :size="16">
							<Comment16Regular />
						</n-icon>
						<span class="text-[11px] font-medium select-none">{{
							formatCount(
								moment.commentsCount ?? moment.comments.length,
							)
						}}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Heart16Regular, Heart16Filled, Comment16Regular } from '@vicons/fluent'
import { computed } from 'vue'
import { NIcon, NAvatar } from 'naive-ui'
import { Moment, useMomentStore } from '@renderer/stores/moment'
import { createMomentCoverDataUrl } from '@renderer/utils/momentCover'

const props = defineProps<{
	moment: Moment
}>()

defineEmits<{
	(e: 'click', moment: Moment): void
}>()

const momentStore = useMomentStore()
const hasCoverImage = computed(() => Boolean(props.moment.cover?.trim()))
const canvasCoverUrl = computed(() =>
	createMomentCoverDataUrl(props.moment.title),
)

const toggleLike = async (): Promise<void> => {
	try {
		await momentStore.toggleLike(props.moment.id)
	} catch (error) {
		console.error('点赞失败', error)
	}
}

const formatCount = (count: number): string | number => {
	if (count >= 10000) return (count / 10000).toFixed(1) + 'w'
	if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
	return count
}
</script>

<style scoped>
.moment-card {
	break-inside: avoid;
	margin-bottom: 16px;
}

.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	line-clamp: 2;
	overflow: hidden;
}
</style>

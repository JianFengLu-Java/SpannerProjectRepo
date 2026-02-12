<template>
	<div class="space-y-4">
		<article
			v-for="moment in moments"
			:key="moment.id"
			class="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5"
		>
			<header class="flex items-start gap-3">
				<n-avatar
					:size="44"
					:src="moment.author.avatar"
					round
					class="shrink-0"
				/>
				<div class="min-w-0 flex-1">
					<div class="text-[15px] font-bold text-gray-800 truncate">
						{{ moment.author.name }}
					</div>
					<div class="text-[12px] text-gray-400 mt-0.5">
						{{ moment.timestamp }}
					</div>
				</div>
			</header>

			<div class="mt-3">
				<h3 class="text-[15px] font-semibold text-gray-800 leading-6">
					{{ moment.title }}
				</h3>
				<p
					v-if="moment.content"
					class="mt-2 text-[14px] leading-6 text-gray-600 whitespace-pre-wrap"
				>
					{{ moment.content }}
				</p>
			</div>

			<div
				v-if="moment.images && moment.images.length"
				class="mt-3 grid gap-2"
				:style="imageGridStyle(moment.images.length)"
			>
				<img
					v-for="(img, index) in moment.images"
					:key="`${moment.id}-${index}`"
					:src="img"
					class="w-full aspect-square rounded-xl object-cover bg-gray-100"
					loading="lazy"
				/>
			</div>

			<div
				class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between"
			>
				<button
					class="friend-action"
					type="button"
					@click="toggleLike(moment.id)"
				>
					<n-icon :size="18" :class="moment.isLiked ? 'text-red-500' : ''">
						<Heart16Filled v-if="moment.isLiked" />
						<Heart16Regular v-else />
					</n-icon>
					<span>{{ formatCount(moment.likes) }}</span>
				</button>
				<button
					class="friend-action"
					type="button"
					@click="toggleCommentInput(moment.id)"
				>
					<n-icon :size="18"><Comment16Regular /></n-icon>
					<span>{{ formatCount(moment.comments.length) }}</span>
				</button>
			</div>

			<div v-if="showCommentInput[moment.id]" class="mt-3 flex items-center gap-2">
				<n-input
					v-model:value="commentDraft[moment.id]"
					placeholder="写评论..."
					size="small"
					@keyup.enter="submitComment(moment.id)"
				/>
				<n-button
					type="primary"
					size="small"
					:disabled="!(commentDraft[moment.id] || '').trim()"
					@click="submitComment(moment.id)"
				>
					发送
				</n-button>
			</div>

			<div v-if="moment.comments.length" class="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
				<div
					v-for="comment in moment.comments.slice(0, 3)"
					:key="comment.id"
					class="text-[13px] text-gray-600 leading-5"
				>
					<span class="font-semibold text-gray-700">{{ comment.author.name }}：</span
					>{{ comment.text }}
				</div>
			</div>
		</article>
	</div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { Heart16Regular, Heart16Filled, Comment16Regular } from '@vicons/fluent'
import { NAvatar, NIcon, NInput, NButton, useMessage } from 'naive-ui'
import type { Moment } from '@renderer/stores/moment'
import { useMomentStore } from '@renderer/stores/moment'

defineProps<{
	moments: Moment[]
}>()

const momentStore = useMomentStore()
const message = useMessage()

const showCommentInput = reactive<Record<string, boolean>>({})
const commentDraft = reactive<Record<string, string>>({})

const toggleLike = (momentId: string): void => {
	momentStore.toggleLike(momentId)
}

const toggleCommentInput = (momentId: string): void => {
	showCommentInput[momentId] = !showCommentInput[momentId]
}

const submitComment = (momentId: string): void => {
	const text = (commentDraft[momentId] || '').trim()
	if (!text) return
	momentStore.addComment(momentId, text)
	commentDraft[momentId] = ''
	showCommentInput[momentId] = false
	message.success('评论成功')
}

const imageGridStyle = (count: number): Record<string, string> => {
	if (count === 1) {
		return { gridTemplateColumns: 'minmax(0, 280px)' }
	}
	if (count === 2 || count === 4) {
		return { gridTemplateColumns: 'repeat(2, minmax(0, 160px))' }
	}
	return { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
}

const formatCount = (count: number): string | number => {
	if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
	if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
	return count
}
</script>

<style scoped>
.friend-action {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border-radius: 10px;
	color: #6b7280;
	font-size: 13px;
	font-weight: 600;
	transition: all 0.2s ease;
}

.friend-action:hover {
	background: #f3f4f6;
	color: #374151;
}
</style>

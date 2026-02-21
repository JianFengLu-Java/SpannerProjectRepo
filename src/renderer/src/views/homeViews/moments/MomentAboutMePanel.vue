<template>
	<div class="about-me-panel">
		<div v-if="safeItems.length === 0 && !loading" class="empty">
			<p class="empty-title">暂时没有新动态</p>
			<p class="empty-sub">有人评论、回复或点赞你时会出现在这里</p>
		</div>

		<div v-else class="space-y-3">
			<button
				v-for="item in safeItems"
				:key="item.id"
				type="button"
				class="about-item"
				@click="$emit('open-moment', item.momentId)"
			>
				<img
					:src="item.fromUser?.avatar || ''"
					:alt="item.fromUser?.name || '用户'"
					class="avatar"
				/>
				<div class="content">
					<p class="title">
						<span class="name">{{
							item.fromUser?.name || '用户'
						}}</span>
						<span class="action">{{
							resolveActionText(item.type)
						}}</span>
					</p>
					<p class="line">{{ item.content || '互动了你的动态' }}</p>
					<p v-if="item.targetContent" class="target">
						{{ item.targetContent }}
					</p>
					<div class="meta">
						<span>{{ formatTime(item.timestamp) }}</span>
						<span class="moment-title">{{
							item.momentTitle || '未命名动态'
						}}</span>
					</div>
				</div>
			</button>
		</div>

		<div class="load-more">
			<n-spin v-if="loading" size="small" />
			<n-button
				v-else-if="hasMore"
				quaternary
				size="small"
				@click="$emit('load-more')"
			>
				加载更多
			</n-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import type { MomentAboutMeItem } from '@renderer/stores/moment'

const props = withDefaults(
	defineProps<{
		items?: MomentAboutMeItem[]
		loading?: boolean
		hasMore?: boolean
	}>(),
	{
		items: () => [],
		loading: false,
		hasMore: false,
	},
)

const safeItems = computed(() => props.items || [])

defineEmits<{
	(e: 'open-moment', momentId: string): void
	(e: 'load-more'): void
}>()

const resolveActionText = (type: string): string => {
	if (type === 'COMMENT_ON_MY_MOMENT') return '评论了你的动态'
	if (type === 'REPLY_TO_ME') return '回复了你'
	if (type === 'LIKE_MY_MOMENT') return '点赞了你的动态'
	if (type === 'LIKE_MY_COMMENT') return '点赞了你的评论'
	return '和你有新的互动'
}

const formatTime = (value: string): string => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value || '-'
	return date.toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.about-me-panel {
	max-width: min(860px, 100%);
	margin: 0 auto;
}

.empty {
	min-height: 360px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	color: rgb(156 163 175);
}

.empty-title {
	font-size: 16px;
	font-weight: 700;
}

.empty-sub {
	margin-top: 6px;
	font-size: 12px;
}

.about-item {
	width: 100%;
	display: flex;
	gap: 12px;
	align-items: flex-start;
	text-align: left;
	padding: 12px;
	border-radius: 12px;
	border: 1px solid rgba(148, 163, 184, 0.2);
	background: rgba(255, 255, 255, 0.7);
}

.avatar {
	width: 38px;
	height: 38px;
	border-radius: 999px;
	object-fit: cover;
	flex-shrink: 0;
}

.content {
	flex: 1;
	min-width: 0;
}

.title {
	font-size: 13px;
	color: rgb(55 65 81);
}

.name {
	font-weight: 700;
	margin-right: 6px;
}

.action {
	color: rgb(107 114 128);
}

.line {
	margin-top: 4px;
	font-size: 13px;
	color: rgb(17 24 39);
}

.target {
	margin-top: 6px;
	padding: 6px 8px;
	border-radius: 8px;
	background: rgba(148, 163, 184, 0.1);
	font-size: 12px;
	color: rgb(75 85 99);
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.meta {
	margin-top: 8px;
	font-size: 11px;
	color: rgb(156 163 175);
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.moment-title {
	max-width: 320px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.load-more {
	display: flex;
	justify-content: center;
	padding: 16px 0 4px;
}

:deep(.dark) .about-item {
	background: rgba(24, 24, 27, 0.8);
	border-color: rgba(82, 82, 91, 0.6);
}

:deep(.dark) .title {
	color: rgb(228 228 231);
}

:deep(.dark) .action {
	color: rgb(161 161 170);
}

:deep(.dark) .line {
	color: rgb(250 250 250);
}

:deep(.dark) .target {
	background: rgba(63, 63, 70, 0.5);
	color: rgb(212 212 216);
}

:deep(.dark) .meta {
	color: rgb(113 113 122);
}
</style>

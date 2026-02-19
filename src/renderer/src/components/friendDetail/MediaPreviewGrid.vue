<template>
	<div class="space-y-3">
		<div>
			<div class="text-xs text-gray-500 mb-2">最近照片</div>
			<div v-if="privacyBlocked" class="rounded-xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-gray-400">
				对方设置不可见
			</div>
			<div v-else-if="!photos.length" class="rounded-xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-gray-400">
				暂无相册内容
			</div>
			<div v-else class="grid grid-cols-3 gap-2">
				<button
					v-for="(photo, index) in photos.slice(0, 3)"
					:key="photo"
					type="button"
					class="relative aspect-square overflow-hidden rounded-xl"
					@click="$emit('open-photo', index)"
				>
					<img :src="photo" alt="photo" class="h-full w-full object-cover" />
				</button>
			</div>
		</div>

		<div>
			<div class="text-xs text-gray-500 mb-2">最近动态</div>
			<div v-if="privacyBlocked" class="rounded-xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-gray-400">
				对方设置不可见
			</div>
			<div v-else-if="!posts.length" class="rounded-xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-gray-400">
				暂无动态
			</div>
			<div v-else class="space-y-2">
				<button
					v-for="post in posts.slice(0, 2)"
					:key="post.id"
					type="button"
					class="w-full rounded-xl border border-border-default/50 p-3 text-left hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
					@click="$emit('open-post', post.id)"
				>
					<div class="text-sm font-semibold text-text-main truncate">{{ post.title }}</div>
					<div class="mt-1 text-xs text-gray-500 line-clamp-2">{{ post.excerpt }}</div>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { FriendPostPreview } from '@renderer/views/homeViews/friend/friendDetail.types'

defineProps<{
	photos: string[]
	posts: FriendPostPreview[]
	privacyBlocked?: boolean
}>()

defineEmits<{
	(e: 'open-photo', index: number): void
	(e: 'open-post', postId: string): void
}>()
</script>

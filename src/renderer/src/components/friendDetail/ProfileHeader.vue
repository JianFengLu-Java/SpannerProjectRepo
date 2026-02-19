<template>
	<section class="rounded-2xl border border-border-default/60 p-5 bg-[linear-gradient(140deg,rgba(56,189,248,.09),rgba(59,130,246,.05)_40%,rgba(14,116,144,.03))]">
		<div class="flex gap-4 items-start">
			<div class="relative shrink-0 cursor-pointer" @click="$emit('preview-avatar')">
				<n-avatar :size="76" round :src="friend.avatar" />
				<div class="absolute -right-1 -bottom-1 rounded-full px-2 py-0.5 text-[10px] bg-black/70 text-white">
					预览
				</div>
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2 flex-wrap">
					<div class="flex items-center gap-1 min-w-0">
						<h2
							class="text-xl font-semibold truncate max-w-[320px]"
							:class="friend.badges.isVip ? 'text-red-500' : 'text-text-main'"
						>
							{{ friend.nickname }}
						</h2>
						<img
							v-if="friend.badges.isVip"
							:src="vipBadgeIcon"
							alt="VIP"
							class="h-4 w-4 block vip-fill-red shrink-0"
						/>
					</div>
					<n-tag v-if="friend.badges.verified" type="success" size="small" :bordered="false">认证</n-tag>
					<n-tag v-if="friend.badges.userLevel" size="small" :bordered="false">Lv.{{ friend.badges.userLevel }}</n-tag>
				</div>
				<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
					<span>ID: {{ friend.id }}</span>
					<n-button text type="primary" @click="$emit('copy-id')">复制</n-button>
				</div>
				<p class="mt-2 text-sm text-gray-500 line-clamp-2">{{ friend.bio || '这个人很神秘，什么都没有留下。' }}</p>
				<div class="mt-2 text-xs" :class="friend.onlineStatus === 'online' ? 'text-emerald-500' : 'text-gray-400'">
					{{ statusText }}
				</div>
			</div>
		</div>
		<div class="mt-4 flex items-center gap-2">
			<n-button v-if="!hideMainActions" type="primary" size="large" @click="$emit('message')">{{ primaryCtaText }}</n-button>
			<n-button v-if="showAudioVideo" secondary size="large" @click="$emit('voice-video')">语音/视频</n-button>
			<n-button v-if="showAddFriend && !hideMainActions" type="primary" ghost size="large" @click="$emit('add-friend')">添加好友</n-button>
		</div>
		<div v-if="blockedMe" class="mt-3 text-sm text-amber-500">你已被对方限制互动，暂不可发消息或发起通话。</div>
		<div v-if="blockedByMe" class="mt-3 text-sm text-amber-500">你已拉黑对方，可在隐私与安全设置中解除拉黑。</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NButton, NTag } from 'naive-ui'
import type { FriendModel } from '@renderer/views/homeViews/friend/friendDetail.types'
import vipBadgeIcon from '@renderer/assets/VIP.svg'

const props = defineProps<{
	friend: FriendModel
}>()

defineEmits<{
	(e: 'copy-id'): void
	(e: 'message'): void
	(e: 'voice-video'): void
	(e: 'add-friend'): void
	(e: 'preview-avatar'): void
}>()

const blockedMe = computed(() => props.friend.relationshipStatus === 'blocked_me')
const blockedByMe = computed(
	() => props.friend.relationshipStatus === 'blocked_by_me',
)
const showAddFriend = computed(() => props.friend.relationshipStatus === 'not_friend')
const showAudioVideo = computed(
	() =>
		props.friend.relationshipStatus === 'friend' &&
		!blockedByMe.value,
)
const primaryCtaText = computed(() =>
	props.friend.relationshipStatus === 'not_friend' ? '发消息（受限）' : '发消息',
)

const statusText = computed(() => {
	if (props.friend.onlineStatus === 'online') return '在线'
	if (props.friend.lastActiveAt) return `最近活跃：${props.friend.lastActiveAt}`
	return '离线'
})

const hideMainActions = computed(() => blockedMe.value || blockedByMe.value)
</script>

<style scoped>
.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>

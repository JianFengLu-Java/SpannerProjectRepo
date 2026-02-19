<template>
	<section class="rounded-xl border border-border-default/60 bg-page-bg p-4">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-text-main">
				群成员（{{ memberCount }}）
			</h3>
			<button
				type="button"
				class="text-xs text-primary hover:underline no-drag"
				aria-label="查看全部成员"
				@click="$emit('view-all')"
			>
				查看全部
			</button>
		</div>
		<div class="mt-3 grid grid-cols-3 gap-2">
			<div
				v-for="member in previewMembers"
				:key="member.account"
				class="rounded-lg px-2 py-2 bg-page-bg/80 border border-border-default/40"
			>
				<div class="flex items-center gap-2">
					<n-avatar :size="28" round :src="member.avatarUrl" />
					<div class="min-w-0">
						<p class="text-xs text-text-main truncate">
							{{ member.name }}
						</p>
						<p class="text-[10px] text-gray-400 truncate">
							{{ roleText(member.role) }}
						</p>
					</div>
				</div>
			</div>
		</div>
		<div v-if="canManage" class="mt-3 flex items-center gap-2">
			<n-button size="small" secondary @click="$emit('add-member')">
				添加成员
			</n-button>
			<n-button size="small" secondary @click="$emit('remove-member')">
				移除成员
			</n-button>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NButton } from 'naive-ui'

interface MemberPreviewItem {
	account: string
	name: string
	avatarUrl?: string
	role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

const props = defineProps<{
	members: MemberPreviewItem[]
	memberCount: number
	canManage: boolean
}>()

defineEmits<{
	(e: 'view-all'): void
	(e: 'add-member'): void
	(e: 'remove-member'): void
}>()

const previewMembers = computed(() => props.members.slice(0, 9))

const roleText = (role: MemberPreviewItem['role']): string => {
	if (role === 'OWNER') return '群主'
	if (role === 'ADMIN') return '管理员'
	return '成员'
}
</script>

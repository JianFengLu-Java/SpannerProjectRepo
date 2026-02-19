<template>
	<section class="rounded-xl border border-border-default/60 bg-page-bg p-4">
		<div class="flex items-center gap-3">
			<n-avatar :size="56" round :src="avatar" />
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<h3 class="text-base font-semibold text-text-main truncate">
						{{ groupName }}
					</h3>
					<n-tag size="small" :bordered="false" type="info">
						{{ roleLabel }}
					</n-tag>
				</div>
				<div class="mt-1 flex items-center gap-2 text-xs text-gray-400">
					<span class="truncate">群ID：{{ groupNo }}</span>
					<button
						type="button"
						class="underline hover:text-primary no-drag"
						aria-label="复制群ID"
						@click="$emit('copy-group-no')"
					>
						复制
					</button>
				</div>
			</div>
		</div>
		<p class="mt-3 text-xs text-gray-500 line-clamp-2">
			{{ summary || '暂无群简介，点击编辑补充信息。' }}
		</p>
		<div class="mt-3 flex items-center gap-2">
			<n-button size="small" secondary @click="$emit('open-qr')">
				二维码/邀请链接
			</n-button>
			<n-button
				v-if="canEdit"
				size="small"
				type="primary"
				@click="$emit('edit-profile')"
			>
				编辑群资料
			</n-button>
		</div>
	</section>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NTag } from 'naive-ui'

defineProps<{
	avatar?: string
	groupName: string
	groupNo: string
	summary?: string
	roleLabel: string
	canEdit: boolean
}>()

defineEmits<{
	(e: 'copy-group-no'): void
	(e: 'open-qr'): void
	(e: 'edit-profile'): void
}>()
</script>

<template>
	<div
		class="h-full w-full rounded-[14px] border border-border-default bg-card-bg p-6 overflow-y-auto"
	>
		<div class="max-w-[760px] mx-auto flex flex-col gap-6">
			<div class="text-xl font-semibold text-text-main">我的个人名片（测试模块）</div>
			<div class="rounded-2xl border border-border-default/80 bg-page-bg/80 p-5">
				<div class="flex items-start gap-4">
					<n-avatar :size="72" round :src="user.avatarUrl" />
					<div class="flex-1 min-w-0">
						<div class="text-lg font-semibold text-text-main truncate">
							{{ user.userName || '未设置昵称' }}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-300 mt-1">
							账号：{{ user.account || '-' }}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-300 mt-1">
							邮箱：{{ user.email || '-' }}
						</div>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 mt-4 text-sm">
					<div class="rounded-xl bg-card-bg border border-border-default p-3">
						<div class="text-gray-500 dark:text-gray-300">性别</div>
						<div class="text-text-main mt-1">{{ genderText }}</div>
					</div>
					<div class="rounded-xl bg-card-bg border border-border-default p-3">
						<div class="text-gray-500 dark:text-gray-300">年龄</div>
						<div class="text-text-main mt-1">{{ ageText }}</div>
					</div>
					<div class="rounded-xl bg-card-bg border border-border-default p-3 col-span-2">
						<div class="text-gray-500 dark:text-gray-300">电话</div>
						<div class="text-text-main mt-1">{{ user.phone || '-' }}</div>
					</div>
					<div class="rounded-xl bg-card-bg border border-border-default p-3 col-span-2">
						<div class="text-gray-500 dark:text-gray-300">地址</div>
						<div class="text-text-main mt-1">{{ user.address || '-' }}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar } from 'naive-ui'
import { useUserInfoStore } from '@renderer/stores/userInfo'

const user = useUserInfoStore()

const genderText = computed(() => {
	if (user.gender === 'male') return '男'
	if (user.gender === 'female') return '女'
	return '未知'
})

const ageText = computed(() => {
	if (typeof user.age === 'number' && Number.isFinite(user.age)) {
		return `${Math.max(0, Math.floor(user.age))}`
	}
	return '-'
})
</script>

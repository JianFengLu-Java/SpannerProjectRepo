<template>
	<n-modal
		:show="show"
		preset="card"
		title="添加好友"
		:mask-closable="false"
		transform-origin="center"
		:segmented="{ content: true, footer: true }"
		:bordered="false"
		style="max-width: 460px; width: 95%; border-radius: 16px"
		@update:show="(value) => emit('update:show', value)"
	>
		<div class="flex flex-col gap-4">
			<n-input-group>
				<n-input
					v-model:value="searchAccount"
					placeholder="输入账号"
					size="large"
					:style="{ flex: 1 }"
					@keyup.enter="handleSearch"
				/>
				<n-button
					type="primary"
					size="large"
					:loading="searching"
					@click="handleSearch"
				>
					搜索
				</n-button>
			</n-input-group>

			<div
				v-if="searchedUser"
				class="bg-card-bg/90 p-4 rounded-xl border border-border-default/70"
			>
				<div class="flex items-center gap-3">
					<n-avatar
						round
						:size="52"
						:src="searchedUser.avatarUrl"
						class="border border-border-default/60"
					/>
					<div class="min-w-0 flex-1">
						<h3 class="text-base font-bold m-0 truncate text-text-main">
							{{ searchedUser.realName }}
						</h3>
						<p class="text-xs text-gray-400 m-0">
							账号: {{ searchedUser.account }}
						</p>
						<p class="text-xs text-gray-500 m-0 mt-1 truncate">
							签名:
							{{
								searchedUser.signature?.trim() ||
								'这个人太神秘了，还没有个性签名。'
							}}
						</p>
					</div>
				</div>

				<div class="mt-3">
					<p class="text-[11px] text-gray-500 mb-1">
						关系状态: {{ relationText }}
					</p>
					<p
						v-if="searchedUser.verificationMessage"
						class="text-[11px] text-gray-500 mb-1"
					>
						历史验证: {{ searchedUser.verificationMessage }}
					</p>
					<p class="text-xs font-medium text-gray-500 mb-1">验证信息</p>
					<n-input
						v-model:value="verificationMessage"
						type="textarea"
						placeholder="请输入验证信息（可选）"
						:autosize="{ minRows: 2, maxRows: 4 }"
						:disabled="!canApply"
					/>
				</div>
			</div>

			<div
				v-else-if="searched"
				class="py-4 text-sm text-gray-400 text-center border border-dashed border-border-default rounded-xl"
			>
				未查询到该账号
			</div>
		</div>

		<template #footer>
			<div class="grid grid-cols-2 gap-3">
				<n-button size="large" @click="emit('update:show', false)">
					取消
				</n-button>
				<n-button
					type="primary"
					size="large"
					:disabled="!searchedUser || !canApply"
					:loading="submitting"
					@click="handleApply"
				>
					发送申请
				</n-button>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NInputGroup, NInput, NButton, NAvatar, useMessage } from 'naive-ui'
import { useFriendStore } from '@renderer/stores/friend'

const props = defineProps<{
	show: boolean
}>()

const emit = defineEmits<{
	(e: 'update:show', value: boolean): void
	(e: 'applied'): void
}>()

const friendStore = useFriendStore()
const message = useMessage()

const searchAccount = ref('')
const verificationMessage = ref('')
const searching = ref(false)
const searched = ref(false)
const submitting = ref(false)
const searchedUser = ref<Awaited<ReturnType<typeof friendStore.searchUserByAccount>>>(null)

const show = computed(() => props.show)
const canApply = computed(() => {
	if (!searchedUser.value) return false
	if (searchedUser.value.isSelf) return false
	return searchedUser.value.relationType !== 'ACCEPTED'
})
const relationText = computed(() => {
	if (!searchedUser.value) return '未知'
	if (searchedUser.value.isSelf) return '自己'
	if (searchedUser.value.relationType === 'ACCEPTED') return '已是好友'
	if (searchedUser.value.relationType === 'PENDING') return '待处理申请'
	if (searchedUser.value.relationType === 'BLOCKED') return '已被拉黑'
	return '无关系'
})

watch(show, (visible) => {
	if (!visible) {
		searchAccount.value = ''
		verificationMessage.value = ''
		searched.value = false
		searchedUser.value = null
	}
})

const handleSearch = async (): Promise<void> => {
	const account = searchAccount.value.trim()
	if (!account) {
		message.warning('请输入账号')
		return
	}

	searching.value = true
	try {
		searchedUser.value = await friendStore.searchUserByAccount(account)
		searched.value = true
		if (!searchedUser.value) {
			message.warning('未找到该账号')
		}
	} catch (error: any) {
		searchedUser.value = null
		searched.value = true
		if (error?.response?.status === 404) {
			message.warning('未找到该账号')
		} else if (error?.response?.status === 401) {
			message.error('登录状态失效，请重新登录')
		} else {
			message.error('搜索失败，请稍后再试')
		}
	} finally {
		searching.value = false
	}
}

const handleApply = async (): Promise<void> => {
	if (!searchedUser.value) {
		message.warning('请先搜索并选择用户')
		return
	}
	if (!canApply.value) {
		message.warning('当前状态不可发送申请')
		return
	}
	submitting.value = true
	try {
		await friendStore.applyFriendRequestWithMessage(
			searchedUser.value.account,
			verificationMessage.value || null,
		)
		message.success('好友申请已发送')
		emit('update:show', false)
		emit('applied')
	} catch {
		message.error('发送失败，请稍后再试')
	} finally {
		submitting.value = false
	}
}
</script>

<template>
	<n-modal
		v-model:show="show"
		preset="card"
		title="创建群聊"
		:mask-closable="true"
		class="max-w-[420px]"
	>
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-2">
				<n-input
					v-model:value="createGroupName"
					placeholder="输入群名称"
					maxlength="40"
				/>
				<n-input
					v-model:value="createGroupAnnouncement"
					type="textarea"
					:autosize="{ minRows: 2, maxRows: 4 }"
					placeholder="输入群公告（可选）"
					maxlength="200"
				/>
				<n-button
					type="primary"
					:loading="isCreatingGroup"
					:disabled="!createGroupName.trim()"
					@click="createGroup"
				>
					创建群聊
				</n-button>
			</div>
		</div>

		<template #footer>
			<div class="flex justify-end">
				<n-button tertiary @click="show = false">关闭</n-button>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NInput, NButton, useMessage } from 'naive-ui'
import { useChatStore } from '@renderer/stores/chat'
import { useRouter } from 'vue-router'

const props = defineProps<{
	show: boolean
}>()

const emit = defineEmits(['update:show'])

const show = ref(props.show)
watch(
	() => props.show,
	(val) => {
		show.value = val
	},
)
watch(show, (val) => {
	emit('update:show', val)
})

const chatStore = useChatStore()
const message = useMessage()
const router = useRouter()

const createGroupName = ref('')
const createGroupAnnouncement = ref('')
const isCreatingGroup = ref(false)

const createGroup = async (): Promise<void> => {
	const groupName = createGroupName.value.trim()
	if (!groupName) {
		message.warning('请输入群名称')
		return
	}
	isCreatingGroup.value = true
	try {
		const chat = await chatStore.createGroupChat({
			groupName,
			announcement: createGroupAnnouncement.value.trim(),
		})
		await chatStore.setActiveChat(chat.id)
		chatStore.markAsRead(chat.id)
		show.value = false
		createGroupName.value = ''
		createGroupAnnouncement.value = ''
		message.success('创建群聊成功')

		// 如果不在聊天页面，跳转到聊天页面
		await router.push({ name: 'chat' })
	} catch (error) {
		const fallback = '创建群聊失败，请稍后再试'
		const tip =
			error instanceof Error && error.message ? error.message : fallback
		message.error(tip)
	} finally {
		isCreatingGroup.value = false
	}
}
</script>

<template>
	<div
		ref="scrollRef"
		class="h-full overflow-y-auto px-4 py-2 bg-[#f3f4f6]/50"
	>
		<div v-for="(msg, index) in messages" :key="msg.id" class="mb-6">
			<chat-message
				:content="msg.text"
				:is-me="msg.senderId === 'me'"
				:avatar="
					msg.senderId === 'me'
						? userInfo.avatarUrl
						: activeChat?.avatar
				"
				:time="msg.timestamp"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{ messages: any[] }>()
const chatStore = useChatStore()
const { activeChat } = storeToRefs(chatStore)
const scrollRef = ref<HTMLElement | null>(null)
const userInfo = useUserInfoStore()
const avatar = userInfo.avatarUrl

// 逻辑：简单判断是否显示时间（这里简单模拟，每条都显示或按需逻辑）
const shouldShowTime = (index: number) => index === 0

const scrollToBottom = async () => {
	await nextTick()
	if (scrollRef.value) {
		scrollRef.value.scrollTop = scrollRef.value.scrollHeight
	}
}

watch(() => props.messages, scrollToBottom, { deep: true })
onMounted(scrollToBottom)
</script>

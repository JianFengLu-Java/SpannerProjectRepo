<template>
	<div class="h-full w-full flex flex-col justify-between" v-if="currentChat">
		<!-- heard  -->
		<div class="h-20 border-b border-gray-200 flex item-center justify-between w-full p-3">
			<div class="flex gap-2 items-center">
				<n-avatar round :src="currentChat?.avatar"></n-avatar>
				<div class="flex flex-col">
					<span class="text-[16px] font-medium text-zinc-800">{{
						currentChat?.name
					}}</span>
					<span class="text-[11px] text-gray-400">1390703178@dhaudh.com</span>
				</div>
			</div>
			<div>
				<span>占位符</span>
			</div>
		</div>
		<!-- context -->
		<div class="flex-1"></div>
		<!-- input -->
		<div class="h-15 w-full px-4">
			<n-input size="large" :placeholder="`发送给 ${currentChat?.name}`"></n-input>
		</div>
	</div>
	<div v-if="!currentChat" class="h-full w-full flex justify-center items-center bg-gray-50">
		点击开始聊天
	</div>
</template>

<script setup lang="ts">
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const chatStore = useChatStore()

const { activeChatId, activeChat } = storeToRefs(chatStore)

const currentChat = computed(() => {
	return activeChat.value
})
</script>

<template>
	<div class="h-screen w-screen bg-page-bg overflow-hidden flex flex-col p-2">
		<!-- 独立窗口的顶部拖拽区域（如果是 macOS，可以留出位置） -->
		<div
			class="drag h-8 w-full flex items-center shrink-0"
			:class="[isWin ? 'px-16' : 'px-20']"
		>
			<span class="text-xs text-gray-400 no-drag pointer-events-none">
				与 {{ chatName }} 的对话
			</span>
		</div>

		<div
			class="flex-1 overflow-hidden rounded-xl bg-white/50 backdrop-blur-sm border border-white/20 shadow-sm relative"
		>
			<ChatContext ref="chatContextRef" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@renderer/stores/chat'
import ChatContext from './ChatContext.vue'

const route = useRoute()
const chatStore = useChatStore()
const isWin = window.api.platform === 'win32'

const chatId = parseInt(route.query.id as string)
const chatName = route.query.name as string

const chatContextRef = ref(null)

onMounted(() => {
	if (!isNaN(chatId)) {
		// 设置当前活跃聊天，使 ChatContext 能够正确渲染
		chatStore.setActiveChat(chatId)
	}
})

// 可选：当窗口关闭时，可以在这里做一些清理，但通常独立窗口关闭就销毁了
</script>

<style scoped>
.drag {
	-webkit-app-region: drag;
}
.no-drag {
	-webkit-app-region: no-drag;
}
</style>

<template>
	<n-virtual-list
		ref="virtualListInst"
		class="h-full bg-[#ffffff]/50"
		:items="messages"
		:item-size="80"
		item-resizable
		:overscan="15"
		key-field="id"
		@scroll="handleScroll"
	>
		<template #default="{ item, index }">
			<div :key="item.id" class="px-4 py-2">
				<chat-message
					:content="item.text"
					:is-me="item.senderId === 'me'"
					:avatar="
						item.senderId === 'me'
							? userInfo.avatarUrl
							: activeChat?.avatar
					"
					:time="item.timestamp"
				/>
			</div>
		</template>
	</n-virtual-list>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { VirtualListInst } from 'naive-ui'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{ messages: any[] }>()
const chatStore = useChatStore()
const { activeChat } = storeToRefs(chatStore)
const userInfo = useUserInfoStore()

// 引用虚拟列表实例
const virtualListInst = ref<VirtualListInst | null>(null)

/**
 * 滚动到底部逻辑
 */
const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
	if (!virtualListInst.value || props.messages.length === 0) return

	// 延迟执行，确保 ResizeObserver 完成了高度收集
	setTimeout(() => {
		virtualListInst.value?.scrollTo({
			index: props.messages.length - 1,
			behavior,
		})
	}, 60) // 60ms 是一个体感无察觉但足以让计算完成的时间
}

// 监听消息长度变化（发送/接收新消息）
watch(
	() => props.messages.length,
	() => {
		scrollToBottom('smooth')
	},
)

// 切换聊天频道时，直接定位到底部（无动画）
watch(
	() => activeChat.value?.id,
	() => {
		scrollToBottom('auto')
	},
)

onMounted(() => {
	scrollToBottom('auto')
})

// 处理滚动（如果需要处理“向上加载更多”逻辑）
const handleScroll = (e: Event) => {
	const target = e.target as HTMLElement
	if (target.scrollTop === 0) {
		// console.log('触顶，可以加载历史记录')
	}
}
</script>

<style scoped>
/* 确保组件撑满容器 */
:deep(.v-vl) {
	height: 100%;
}
</style>

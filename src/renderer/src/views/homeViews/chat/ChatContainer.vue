<script setup lang="ts">
import { ref, watch, nextTick, onMounted, VNode } from 'vue'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { VirtualListInst } from 'naive-ui'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{ messages: any[] }>()
const chatStore = useChatStore()
const { activeChat } = storeToRefs(chatStore)
const userInfo = useUserInfoStore()

const virtualListInst = ref<VirtualListInst | null>(null)
const isSwitching = ref(false)

/**
 * 核心滚动函数（回归最简版）
 */
const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto'): void => {
	if (!virtualListInst.value || props.messages.length === 0) return

	// 这里的延迟是为了给 ResizeObserver 留出高度收集的时间
	setTimeout(() => {
		virtualListInst.value?.scrollTo({
			index: props.messages.length - 1,
			behavior,
		})
	}, 60)
}
/**
 * 获取虚拟列表的滚动容器 DOM
 */
const getScrollEl = (): HTMLElement | null => {
	return (virtualListInst.value as any)?.$el.querySelector(
		'.n-virtual-list-viewport',
	) as HTMLElement | null
}

/**
 * 图片加载完成的回调
 */
const handleImageLoaded = (): void => {
	const el = getScrollEl()
	if (!el) return

	// 判断当前滚动条位置，如果在底部附近（比如 300px 内），则追随滚动
	// 这样能保证用户在向上翻阅历史记录时，新图片加载不会强行把页面拉到底部
	const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300

	if (isNearBottom) {
		// 调用你已有的置底函数，使用 smooth 让视觉更平滑一点点
		scrollToBottom('smooth')
	}
}
// 1. 监听消息长度变化（发送/接收新消息）
watch(
	() => props.messages.length,
	(_, oldLen) => {
		// 只有在非切换状态下才执行新消息跟随
		if (isSwitching.value) return
		scrollToBottom(oldLen === 0 ? 'auto' : 'smooth')
	},
)

// 2. 切换聊天频道
const scrollMap = new Map<string, number>()

watch(
	() => activeChat.value?.id,
	async (newId, oldId) => {
		// 保存旧位置
		const el = (virtualListInst.value as any)?.$el.querySelector(
			'.n-virtual-list-viewport',
		)
		if (oldId && el) scrollMap.set(oldId.toString(), el.scrollTop)

		// 开启切换锁定（防止用户看到跳动）
		isSwitching.value = true

		await nextTick()

		if (newId) {
			const savedPos = scrollMap.get(newId.toString())
			if (savedPos !== undefined) {
				// 恢复历史位置
				setTimeout(() => {
					virtualListInst.value?.scrollTo({ top: savedPos })
					isSwitching.value = false
				}, 30)
			} else {
				// 无历史记录则定位到底部
				scrollToBottom('auto')
				// 定位完成后关闭锁定
				setTimeout(() => {
					isSwitching.value = false
				}, 100)
			}
		}
	},
	{ immediate: true },
)

onMounted(() => {
	scrollToBottom('auto')
})
</script>

<template>
	<div class="h-full relative overflow-hidden bg-[#ffffff]/50">
		<div v-if="isSwitching" class="absolute inset-0 z-10 bg-[#f9f9f9]" />

		<n-virtual-list
			ref="virtualListInst"
			class="h-full"
			:items="messages"
			:item-size="80"
			item-resizable
			:overscan="30"
			key-field="id"
		>
			<template #default="{ item }">
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
						@image-loaded="handleImageLoaded"
					/>
				</div>
			</template>
		</n-virtual-list>
	</div>
</template>

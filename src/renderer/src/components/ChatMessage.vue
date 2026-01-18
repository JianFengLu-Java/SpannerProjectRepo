<template>
	<div
		class="flex w-full mt-1"
		:class="isMe ? 'flex-row-reverse' : 'flex-row'"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0 avatar-no-select" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
		>
			<div
				class="px-3 py-2 rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit msg-content-selectable"
				:class="
					isMe
						? 'bg-[#eeeeee] text-zinc-900 '
						: 'bg-[#555555] text-white '
				"
				@click="handleClickEvent"
				v-html="content"
			></div>

			<span class="text-[10px] text-gray-400 px-1 avatar-no-select">{{
				time
			}}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated } from 'vue'

defineProps<{
	content: string
	isMe: boolean
	avatar: string
	time: string
}>()

// 定义事件，通知父组件图片加载完了
const emit = defineEmits(['image-loaded'])

const handleClickEvent = (e: MouseEvent): void => {
	const target = e.target as HTMLElement
	if (target.tagName === 'IMG') {
		window.electron.ipcRenderer.send(
			'view-img',
			(target as HTMLImageElement).src,
		)
	}
}

/**
 * 核心逻辑：监听消息内的图片加载
 */
const attachLoadEvents = () => {
	// 找到所有图片
	const imgs = document.querySelectorAll('.msg-content-selectable img')
	imgs.forEach((img) => {
		const image = img as HTMLImageElement
		// 如果图片还没加载完，监听 load 事件
		if (!image.complete) {
			image.onload = () => {
				emit('image-loaded') // 通知父组件：高度变了，请重新滚到底部
			}
		}
	})
}

onMounted(attachLoadEvents)
onUpdated(attachLoadEvents) // 因为 content 是 v-html，更新时也要重新绑定
</script>

<style scoped>
/* --- 关键：给图片增加占位样式 --- */
:deep(.msg-content-selectable img) {
	cursor: pointer !important;
	display: block;
	max-width: 100%;
	/* 1. 核心：预设最小高度，防止图片加载前高度为0导致定位偏差 */
	min-height: 120px;
	/* 2. 增加一点加载中的背景感 */
	background: rgba(0, 0, 0, 0.05);
	border-radius: 4px;
	margin-top: 4px;
}

.msg-content-selectable,
.msg-content-selectable :deep(*),
.msg-content-selectable * {
	user-select: text !important;
	-webkit-user-select: text !important;
	cursor: text !important;
	-webkit-app-region: no-drag !important;
}

:deep(.msg-content-selectable img:hover) {
	opacity: 0.8;
}

.avatar-no-select {
	user-select: none !important;
	-webkit-user-select: none !important;
	-webkit-user-drag: none !important;
	pointer-events: auto !important;
}
</style>

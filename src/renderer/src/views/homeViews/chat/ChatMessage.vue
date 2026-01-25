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
			<!-- ===== 纯图片消息：无气泡 ===== -->
			<div
				v-if="isOnlyImage"
				class="msg-content-selectable"
				@click="handleClickEvent"
				v-html="content"
			/>

			<!-- ===== 其他消息：有气泡 ===== -->
			<div
				v-else
				class="rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit"
				:class="
					isMe
						? 'bg-[#0e6a86] text-white px-3 py-2'
						: 'bg-[#dbdbdb] text-[#333] px-3 py-2'
				"
				@click="handleClickEvent"
			>
				<div v-html="content" class="msg-content-selectable"></div>
				<div v-if="hasResult">
					<n-tag type="success" size="small" round closable>{{
						result
					}}</n-tag>
				</div>
			</div>

			<span class="text-[10px] text-gray-400 px-1 avatar-no-select">
				{{ time }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated } from 'vue'

const props = defineProps<{
	content: string
	isMe: boolean
	avatar?: string
	time: string
	hasResult?: boolean
	result?: string
}>()

/**
 * 判断是否为「纯图片消息」
 * ✅ 允许 img 被 p / a / br 包裹
 */
const isOnlyImage = computed(() => {
	if (!props.content) return false

	// 1. 去掉空白
	let html = props.content.replace(/\s/g, '')

	// 2. 去掉 <p> / </p> / <br>
	html = html
		.replace(/<p[^>]*>/gi, '')
		.replace(/<\/p>/gi, '')
		.replace(/<br\s*\/?>/gi, '')

	// 3. 统计 img
	const imgMatches = html.match(/<img[^>]+>/gi)
	if (!imgMatches || imgMatches.length === 0) return false

	// 4. 去掉 img 和 a 包裹，看是否还有其它内容
	const stripped = html
		.replace(/<a[^>]*>/gi, '')
		.replace(/<\/a>/gi, '')
		.replace(/<img[^>]+>/gi, '')

	return stripped === ''
})

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

const attachLoadEvents = (): void => {
	const imgs = document.querySelectorAll('.msg-content-selectable img')
	imgs.forEach((img) => {
		const image = img as HTMLImageElement
		if (!image.complete) {
			image.onload = () => emit('image-loaded')
		}
	})
}

onMounted(attachLoadEvents)
onUpdated(attachLoadEvents)
</script>

<style scoped>
:deep(.msg-content-selectable img) {
	display: block;
	cursor: pointer;
	max-width: 240px;
	max-height: 320px;
	width: auto;
	height: auto;
	border-radius: 8px;
	border: #79797a94 solid 1px;
}

.msg-content-selectable,
.msg-content-selectable :deep(*) {
	user-select: text;
	-webkit-user-select: text;
	cursor: text;
}

.avatar-no-select {
	user-select: none;
	-webkit-user-select: none;
}
</style>

<template>
	<div
		class="flex w-full mt-1"
		:class="isMe ? 'flex-row-reverse' : 'flex-row'"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0 avatar-no-select" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
			@contextmenu="handleContextMenu"
		>
			<div
				v-if="isOnlyImage"
				class="msg-content-selectable"
				@click="handleClickEvent"
				v-html="content"
			/>

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

			<span class="text-[10px] text-gray-400 px-1 avatar-no-select">{{
				time
			}}</span>
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

const emit = defineEmits<{
	(e: 'image-loaded'): void
	(
		e: 'contextmenu',
		ev: MouseEvent,
		type: 'text' | 'image',
		extra?: any,
	): void
}>()

const handleContextMenu = (e: MouseEvent) => {
	const target = e.target as HTMLElement
	const selection = window.getSelection()?.toString()

	if (target.tagName === 'IMG') {
		// 图片右键：阻止默认并传出 src
		e.preventDefault()
		emit('contextmenu', e, 'image', {
			src: (target as HTMLImageElement).src,
		})
	} else if (selection && selection.trim().length > 0) {
		// 选中文字右键：此时不 preventDefault，允许系统原生的全选/复制操作，
		// 或者你也可以 preventDefault 使用自定义菜单
		emit('contextmenu', e, 'text', { text: selection })
	} else {
		// 空白气泡处右键
		emit('contextmenu', e, 'text')
	}
}

const isOnlyImage = computed(() => {
	if (!props.content) return false
	let html = props.content.replace(/\s/g, '')
	html = html
		.replace(/<p[^>]*>/gi, '')
		.replace(/<\/p>/gi, '')
		.replace(/<br\s*\/?>/gi, '')
	const imgMatches = html.match(/<img[^>]+>/gi)
	return (
		imgMatches &&
		imgMatches.length > 0 &&
		html
			.replace(/<a[^>]*>/gi, '')
			.replace(/<\/a>/gi, '')
			.replace(/<img[^>]+>/gi, '') === ''
	)
})

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
		if (!image.complete) image.onload = () => emit('image-loaded')
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
	border-radius: 8px;
	border: #79797a94 solid 1px;
}
.msg-content-selectable,
.msg-content-selectable :deep(*) {
	user-select: text;
	-webkit-user-select: text;
}
.avatar-no-select {
	user-select: none;
	-webkit-user-select: none;
}
</style>

<template>
	<div
		ref="messageRootRef"
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
						: 'bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-gray-100 px-3 py-2'
				"
				@click="handleClickEvent"
			>
				<div v-html="content" class="msg-content-selectable"></div>
				<div v-if="hasResult">
					<n-tag type="error" size="small" round>
						{{ result }}
					</n-tag>
				</div>
			</div>

			<div class="flex items-center gap-1 px-1 avatar-no-select">
				<span class="text-[10px] text-gray-400">{{ time }}</span>
				<n-tooltip
					v-if="isMe && deliveryStatus === 'failed'"
					placement="top"
					trigger="hover"
				>
					<template #trigger>
						<span class="failed-icon" aria-label="发送失败">!</span>
					</template>
					{{ result || '发送失败' }}
				</n-tooltip>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'

const props = defineProps<{
	content: string
	isMe: boolean
	avatar?: string
	time: string
	hasResult?: boolean
	result?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
}>()
const messageRootRef = ref<HTMLElement | null>(null)

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
	const imgs =
		messageRootRef.value?.querySelectorAll('.msg-content-selectable img') ||
		[]
	imgs.forEach((img) => {
		const image = img as HTMLImageElement
		if (image.complete) {
			emit('image-loaded')
			return
		}
		image.onload = () => emit('image-loaded')
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

.failed-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
	border-radius: 9999px;
	background: #ef4444;
	color: #fff;
	font-size: 10px;
	font-weight: 700;
	line-height: 1;
	cursor: default;
}
</style>

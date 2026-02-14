<template>
	<div
		ref="messageRootRef"
		class="flex w-full mt-1 message-root"
		:class="[
			isMe ? 'flex-row-reverse' : 'flex-row',
			hasResult ? 'has-result-tip' : '',
		]"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0 avatar-no-select" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
			@contextmenu="handleContextMenu"
		>
			<div class="message-bubble-row" :class="isMe ? 'justify-end' : 'justify-start'">
				<n-tooltip
					v-if="isMe && deliveryStatus === 'failed'"
					placement="top"
					trigger="hover"
				>
					<template #trigger>
						<button
							type="button"
							class="bubble-failed-badge avatar-no-select"
							aria-label="发送失败"
						>
							!
						</button>
					</template>
					{{ result || '发送失败' }}
				</n-tooltip>

				<div
					v-if="isOnlyImage"
					class="msg-content-selectable"
					@click="handleClickEvent"
					v-html="content"
				/>

				<div
					v-else
					class="rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit chat-bubble"
					:class="
						isMe
							? 'chat-bubble-me px-3 py-2'
							: 'chat-bubble-other px-3 py-2'
					"
					@click="handleClickEvent"
				>
					<div v-html="content" class="msg-content-selectable"></div>
				</div>
			</div>

			<div class="flex items-center gap-1 px-1 avatar-no-select">
				<span class="text-[10px] text-gray-400">{{ time }}</span>
			</div>

			<div
				v-if="hasResult"
				class="bubble-result-tip avatar-no-select"
			>
				<span class="bubble-result-dot" aria-hidden="true"></span>
				<span class="truncate">{{ result || '消息异常' }}</span>
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

.message-root {
	position: relative;
}

.has-result-tip {
	padding-bottom: 24px;
}

.message-bubble-row {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
}

.chat-bubble {
	position: relative;
	line-height: 1.45;
	border-radius: 14px;
	border: 1px solid transparent;
}

.chat-bubble-me {
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
	color: #f8fafc;
	border-color: rgb(24 94 194 / 35%);
	border-bottom-right-radius: 6px;
}

.chat-bubble-other {
	background: #f2f5f9;
	color: #1f2937;
	border-color: #dde3ec;
	border-bottom-left-radius: 6px;
}

.chat-bubble-me :deep(a) {
	color: #dbeeff;
	text-decoration: underline;
	text-decoration-color: rgb(219 238 255 / 70%);
	text-underline-offset: 2px;
}

.chat-bubble-me :deep(a:hover) {
	color: #f4f9ff;
	text-decoration-color: rgb(244 249 255 / 90%);
}

.bubble-failed-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	border-radius: 9999px;
	background: #ef4444;
	border: 0;
	color: #fff;
	font-size: 11px;
	font-weight: 700;
	line-height: 1;
	cursor: default;
	box-shadow: 0 2px 6px rgb(239 68 68 / 28%);
	padding: 0;
}

.bubble-result-tip {
	margin-top: 0;
	font-size: 11px;
	line-height: 1.3;
	display: inline-flex;
	align-items: center;
	max-width: min(80%, 420px);
	padding: 5px 10px;
	border-radius: 9999px;
	background: rgb(15 23 42 / 22%);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	color: rgb(255 255 255 / 92%);
	position: absolute;
	left: 50%;
	bottom: 0;
	transform: translateX(-50%);
	border: 1px solid rgb(255 255 255 / 16%);
}

.bubble-result-dot {
	width: 5px;
	height: 5px;
	border-radius: 999px;
	background: currentColor;
	flex-shrink: 0;
	margin-right: 6px;
}
</style>

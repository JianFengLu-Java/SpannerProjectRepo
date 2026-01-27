<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{ messages: any[] }>()
const chatStore = useChatStore()
const { activeChat } = storeToRefs(chatStore)
const userInfo = useUserInfoStore()

const virtualListInst = ref<any>(null)
const isSwitching = ref(false)

// --- 统一的右键状态 ---
const showDropdown = ref(false)
const xRef = ref(0)
const yRef = ref(0)
const currentOptions = ref<any[]>([])
const contextData = ref<{ type: string; extra: any; msg: any } | null>(null)

const onShowMenu = (
	e: MouseEvent,
	type: 'text' | 'image',
	extra: any,
	msg: any,
) => {
	e.preventDefault()
	showDropdown.value = false
	contextData.value = { type, extra, msg }

	if (type === 'image') {
		currentOptions.value = [
			{ label: '查看图片', key: 'view' },
			{ label: '复制图片链接', key: 'copy-link' },
			{ label: '保存到本地', key: 'save' },
			{ type: 'divider', key: 'd1' },
			{ label: '删除', key: 'delete' },
		]
	} else {
		const hasSelection = !!extra?.text
		currentOptions.value = [
			{
				label: hasSelection ? '复制选中文字' : '复制整条消息',
				key: 'copy',
			},
			{ label: '转发', key: 'forward' },
			{ type: 'divider', key: 'd1' },
			{ label: '删除', key: 'delete' },
		]
	}

	nextTick(() => {
		xRef.value = e.clientX
		yRef.value = e.clientY
		showDropdown.value = true
	})
}

const handleMenuSelect = (key: string) => {
	showDropdown.value = false
	const { extra, msg } = contextData.value || {}

	switch (key) {
		case 'copy':
			const text = extra?.text || msg?.text?.replace(/<[^>]*>/g, '')
			navigator.clipboard.writeText(text)
			break
		case 'copy-link':
			navigator.clipboard.writeText(extra?.src || '')
			break
		case 'save':
			window.electron.ipcRenderer.send('save-image', extra?.src)
			break
		case 'view':
			window.electron.ipcRenderer.send('view-img', extra?.src)
			break
		case 'delete':
			// TODO: 调用删除 API
			console.log('删除 ID:', msg.id)
			break
	}
}

// --- 滚动与图片逻辑（保持不变） ---
const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto'): void => {
	if (!virtualListInst.value || props.messages.length === 0) return
	setTimeout(() => {
		virtualListInst.value?.scrollTo({
			index: props.messages.length - 1,
			behavior,
		})
	}, 60)
}

const handleImageLoaded = (): void => {
	const el = virtualListInst.value?.$el.querySelector(
		'.n-virtual-list-viewport',
	)
	if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
		scrollToBottom('smooth')
	}
}

watch(
	() => props.messages.length,
	(_, oldLen) => {
		if (!isSwitching.value) scrollToBottom(oldLen === 0 ? 'auto' : 'smooth')
	},
)

const scrollMap = new Map<string, number>()
watch(
	() => activeChat.value?.id,
	async (newId, oldId) => {
		const el = virtualListInst.value?.$el.querySelector(
			'.n-virtual-list-viewport',
		)
		if (oldId && el) scrollMap.set(oldId.toString(), el.scrollTop)
		isSwitching.value = true
		await nextTick()
		if (newId) {
			const savedPos = scrollMap.get(newId.toString())
			if (savedPos !== undefined) {
				setTimeout(() => {
					virtualListInst.value?.scrollTo({ top: savedPos })
					isSwitching.value = false
				}, 30)
			} else {
				scrollToBottom('auto')
				setTimeout(() => {
					isSwitching.value = false
				}, 100)
			}
		}
	},
	{ immediate: true },
)

onMounted(() => scrollToBottom('auto'))
</script>

<template>
	<div class="h-full relative overflow-hidden bg-page-bg">
		<div v-if="isSwitching" class="absolute inset-0 z-10 bg-page-bg" />

		<n-virtual-list
			ref="virtualListInst"
			class="h-full"
			:items="messages"
			:item-size="80"
			item-resizable
			key-field="id"
		>
			<template #default="{ item }">
				<div :key="item.id" class="px-4 py-2">
					<chat-message
						v-bind="item"
						:content="item.text"
						:is-me="item.senderId === 'me'"
						:avatar="
							item.senderId === 'me'
								? userInfo.avatarUrl
								: activeChat?.avatar
						"
						:time="item.timestamp"
						@image-loaded="handleImageLoaded"
						@contextmenu="
							(e, type, extra) => onShowMenu(e, type, extra, item)
						"
					/>
				</div>
			</template>
		</n-virtual-list>

		<n-dropdown
			size="small"
			trigger="manual"
			placement="bottom-start"
			:show="showDropdown"
			:x="xRef"
			:y="yRef"
			:options="currentOptions"
			@select="handleMenuSelect"
			@clickoutside="showDropdown = false"
		/>
	</div>
</template>

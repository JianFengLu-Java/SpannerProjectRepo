<template>
	<div
		class="w-full rounded-xl border bg-white transition-all duration-200 shadow-sm"
		:class="[
			isFocus
				? 'border-blue-500 ring-[3px] ring-blue-50/50'
				: 'border-gray-200 hover:border-gray-300',
			isMultilineMode || imgPreviews.length > 0 ? 'p-2' : 'px-2 py-1.5',
		]"
	>
		<div
			v-if="imgPreviews.length > 0"
			class="flex flex-wrap gap-2 mb-2 px-1"
		>
			<div
				v-for="(url, index) in imgPreviews"
				:key="url"
				class="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-100"
			>
				<img :src="url" class="w-full h-full object-cover" />
				<div
					class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
					@click="removeImg(index)"
				>
					<i class="i-carbon-trash-can text-white text-sm" />
				</div>
			</div>
		</div>

		<div
			:class="[
				isMultilineMode || imgPreviews.length > 0
					? 'flex flex-col'
					: 'flex items-end gap-2',
			]"
		>
			<div class="relative flex-1 min-w-0">
				<textarea
					ref="textareaRef"
					v-model="text"
					rows="1"
					placeholder="输入消息，可直接粘贴图片..."
					class="flex-1 max-h-48 w-full resize-none bg-transparent py-1 focus:outline-none overflow-y-auto leading-6 block text-gray-800 custom-scrollbar"
					@input="handleInput"
					@focus="isFocus = true"
					@blur="isFocus = false"
					@keydown.enter="handleEnter"
					@paste="handlePaste"
				></textarea>
			</div>

			<div
				:class="[
					isMultilineMode || imgPreviews.length > 0
						? 'mt-1 flex items-center justify-end gap-1 pt-1 border-t border-gray-50'
						: 'flex items-center gap-0.5 shrink-0 pb-0.5',
				]"
			>
				<div class="flex items-center gap-0.5">
					<n-button
						quaternary
						circle
						size="small"
						class="text-gray-400 hover:text-blue-500"
					>
						<template #icon><At /></template>
					</n-button>
					<n-button
						quaternary
						circle
						size="small"
						class="text-gray-400 hover:text-blue-500"
						@click="triggerUpload"
					>
						<template #icon><i class="i-carbon-image" /></template>
					</n-button>
					<input
						ref="fileInput"
						type="file"
						accept="image/*"
						class="hidden"
						@change="onFileChange"
					/>
				</div>

				<div
					v-if="isMultilineMode || imgPreviews.length > 0"
					class="mx-1 h-4 w-[1px] bg-gray-200"
				></div>

				<n-button
					type="primary"
					size="small"
					strong
					:disabled="!text.trim() && imgPreviews.length === 0"
					@click="send"
				>
					发送
				</n-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { At } from '@vicons/ionicons5'

const text = ref('')
const isFocus = ref(false)
const isMultilineMode = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// 图片数据
const imgFiles = ref<File[]>([])
const imgPreviews = ref<string[]>([])

const LINE_HEIGHT = 24
const PADDING_V = 8
const THRESHOLD = LINE_HEIGHT + PADDING_V + 4

/**
 * 核心逻辑：粘贴图片处理
 */
const handlePaste = (event: ClipboardEvent) => {
	const items = event.clipboardData?.items
	if (!items) return

	for (const item of items) {
		if (item.type.indexOf('image') !== -1) {
			const file = item.getAsFile()
			if (file) {
				addImg(file)
				// 阻止默认行为（如果不阻止，有些浏览器会尝试在内容中插入二进制字符串）
				event.preventDefault()
			}
		}
	}
}

const addImg = (file: File) => {
	imgFiles.value.push(file)
	const url = URL.createObjectURL(file)
	imgPreviews.value.push(url)
}

const removeImg = (index: number) => {
	URL.revokeObjectURL(imgPreviews.value[index]) // 释放内存
	imgFiles.value.splice(index, 1)
	imgPreviews.value.splice(index, 1)
}

const triggerUpload = () => fileInput.value?.click()

const onFileChange = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files[0]) {
		addImg(files[0])
		if (fileInput.value) fileInput.value.value = '' // 清空 input 以便下次选择同一张图
	}
}

// 保持之前的高度计算逻辑...
const handleInput = () => {
	const el = textareaRef.value
	if (!el) return
	el.style.height = 'auto'
	let currentHeight = el.scrollHeight
	el.style.height = `${currentHeight}px`
	const hasNewline = text.value.includes('\n')

	if (!isMultilineMode.value) {
		if (currentHeight > THRESHOLD || hasNewline) {
			isMultilineMode.value = true
			nextTick(() => handleInput())
		}
	} else {
		if (!hasNewline && currentHeight <= THRESHOLD) {
			isMultilineMode.value = false
			nextTick(() => {
				el.style.height = 'auto'
				if (el.scrollHeight > THRESHOLD) {
					isMultilineMode.value = true
					el.style.height = `${el.scrollHeight}px`
				}
			})
		}
	}
}

const send = () => {
	const payload = {
		content: text.value,
		images: imgFiles.value,
	}
	console.log('发送数据：', payload)

	// 重置状态
	text.value = ''
	imgPreviews.value.forEach((url) => URL.revokeObjectURL(url))
	imgPreviews.value = []
	imgFiles.value = []
	isMultilineMode.value = false
	nextTick(() => {
		if (textareaRef.value) textareaRef.value.style.height = 'auto'
	})
}

// 生命周期逻辑...
let observer: ResizeObserver | null = null
onMounted(() => {
	if (textareaRef.value) {
		observer = new ResizeObserver(() => handleInput())
		observer.observe(textareaRef.value)
	}
})
onUnmounted(() => {
	observer?.disconnect()
	imgPreviews.value.forEach((url) => URL.revokeObjectURL(url))
})

const handleEnter = (e: KeyboardEvent) => {
	if (e.shiftKey) return
	e.preventDefault()
	send()
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NIcon, useMessage } from 'naive-ui'
import { Image24Regular, Dismiss24Filled } from '@vicons/fluent'
import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

const props = withDefaults(
	defineProps<{
		modelValue: string[]
		maxCount?: number
	}>(),
	{
		maxCount: 9,
	},
)

const emit = defineEmits<{
	(e: 'update:modelValue', value: string[]): void
	(e: 'uploading-change', uploading: boolean): void
}>()

const message = useMessage()
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingCount = ref(0)
const dragFromIndex = ref<number | null>(null)

const images = computed(() => props.modelValue || [])
const isUploading = computed(() => uploadingCount.value > 0)
const canUploadMore = computed(() => images.value.length < props.maxCount)

const parseUploadUrl = (payload: Record<string, unknown> | null): string => {
	if (!payload) return ''
	const url =
		(typeof payload.url === 'string' && payload.url) ||
		(typeof payload.fileUrl === 'string' && payload.fileUrl) ||
		(typeof payload.path === 'string' && payload.path) ||
		''
	return url.trim()
}

const uploadSingleImage = async (file: File): Promise<string> => {
	const formData = new FormData()
	formData.append('file', file)
	const response = await request.post<ApiResponse<Record<string, unknown>>>(
		'/files/upload',
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		},
	)
	const url = parseUploadUrl(response.data.data || null)
	if (!url) {
		throw new Error('upload-url-empty')
	}
	return url
}

const setImages = (next: string[]): void => {
	emit('update:modelValue', next)
}

const addFiles = async (files: File[]): Promise<void> => {
	if (!files.length || !canUploadMore.value) return
	const remain = Math.max(0, props.maxCount - images.value.length)
	const selected = files
		.filter((file) => file.type.startsWith('image/'))
		.slice(0, remain)

	if (!selected.length) return

	const oversize = selected.filter((file) => file.size > 10 * 1024 * 1024)
	oversize.forEach((file) => {
		message.warning(`图片 ${file.name} 超过 10MB，已跳过`)
	})
	const validFiles = selected.filter((file) => file.size <= 10 * 1024 * 1024)
	if (!validFiles.length) return

	uploadingCount.value += 1
	emit('uploading-change', true)
	try {
		const settled = await Promise.allSettled(
			validFiles.map((file) => uploadSingleImage(file)),
		)
		const successUrls = settled
			.filter(
				(item): item is PromiseFulfilledResult<string> =>
					item.status === 'fulfilled',
			)
			.map((item) => item.value)
			.filter(Boolean)

		if (successUrls.length > 0) {
			setImages([...images.value, ...successUrls])
		}
		const failed = settled.length - successUrls.length
		if (failed > 0) {
			message.error(`有 ${failed} 张图片上传失败`)
		}
	} catch (error) {
		console.error('上传图片失败', error)
		message.error('上传图片失败，请稍后重试')
	} finally {
		uploadingCount.value = Math.max(0, uploadingCount.value - 1)
		emit('uploading-change', uploadingCount.value > 0)
	}
}

const openFileDialog = (): void => {
	if (!canUploadMore.value) {
		message.warning(`最多上传 ${props.maxCount} 张图片`)
		return
	}
	fileInputRef.value?.click()
}

const onFileChange = async (event: Event): Promise<void> => {
	const input = event.target as HTMLInputElement
	const files = Array.from(input.files || [])
	await addFiles(files)
	input.value = ''
}

const removeImage = (index: number): void => {
	const next = [...images.value]
	next.splice(index, 1)
	setImages(next)
}

const moveImage = (from: number, to: number): void => {
	if (from === to || from < 0 || to < 0) return
	const next = [...images.value]
	const [item] = next.splice(from, 1)
	if (!item) return
	next.splice(to, 0, item)
	setImages(next)
}

const onDragStart = (index: number): void => {
	dragFromIndex.value = index
}

const onDrop = (targetIndex: number): void => {
	if (dragFromIndex.value === null) return
	moveImage(dragFromIndex.value, targetIndex)
	dragFromIndex.value = null
}

const onDropContainer = (): void => {
	dragFromIndex.value = null
}

defineExpose({
	openFileDialog,
	addFiles,
})
</script>

<template>
	<div class="moment-image-uploader">
		<div class="uploader-toolbar">
			<n-button secondary :disabled="isUploading" @click="openFileDialog">
				<template #icon>
					<n-icon size="18"><Image24Regular /></n-icon>
				</template>
				{{ isUploading ? '上传中...' : '上传图片' }}
			</n-button>
			<span class="uploader-hint">
				支持粘贴/拖拽上传，拖动图片可排序（{{ images.length }}/{{
					props.maxCount
				}}）
			</span>
		</div>
		<input
			ref="fileInputRef"
			type="file"
			accept="image/*"
			multiple
			class="hidden"
			@change="onFileChange"
		/>

		<div class="preview-grid" @dragover.prevent @drop="onDropContainer">
			<div
				v-for="(url, index) in images"
				:key="`${url}-${index}`"
				class="preview-item"
				draggable="true"
				@dragstart="onDragStart(index)"
				@dragover.prevent
				@drop.prevent="onDrop(index)"
			>
				<img :src="url" class="preview-image" />
				<div class="preview-order">#{{ index + 1 }}</div>
				<button
					class="preview-remove"
					type="button"
					@click="removeImage(index)"
				>
					<n-icon size="14"><Dismiss24Filled /></n-icon>
				</button>
			</div>
			<div v-if="!images.length" class="preview-empty">
				暂无图片，点击上传或直接粘贴图片
			</div>
		</div>
	</div>
</template>

<style scoped>
.moment-image-uploader {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.uploader-toolbar {
	display: flex;
	align-items: center;
	gap: 10px;
}

.uploader-hint {
	font-size: 12px;
	color: #9ca3af;
}

.preview-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
	gap: 10px;
}

.preview-item {
	position: relative;
	aspect-ratio: 1 / 1;
	border-radius: 12px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
	background: #f8fafc;
	cursor: move;
}

.preview-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.preview-order {
	position: absolute;
	left: 6px;
	top: 6px;
	padding: 1px 6px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 600;
	color: #fff;
	background: rgba(0, 0, 0, 0.5);
}

.preview-remove {
	position: absolute;
	right: 6px;
	top: 6px;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	background: rgba(0, 0, 0, 0.55);
}

.preview-empty {
	grid-column: 1 / -1;
	padding: 14px 12px;
	border-radius: 12px;
	border: 1px dashed rgba(0, 0, 0, 0.12);
	color: #9ca3af;
	font-size: 12px;
	text-align: center;
}

:deep(.dark) .uploader-hint {
	color: #94a3b8;
}

:deep(.dark) .preview-item {
	border-color: rgba(255, 255, 255, 0.12);
	background: rgba(39, 39, 42, 0.6);
}

:deep(.dark) .preview-empty {
	border-color: rgba(255, 255, 255, 0.15);
	color: #94a3b8;
}
</style>

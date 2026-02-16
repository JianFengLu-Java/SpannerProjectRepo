<template>
	<div>
		<input
			ref="fileInputRef"
			type="file"
			class="hidden"
			accept="image/*"
			@change="onFileChange"
		/>

		<n-modal
			v-model:show="showCropper"
			preset="card"
			class="avatar-editor-modal"
			:title="title"
			style="width: 600px"
			:segmented="{ content: 'soft', footer: 'soft' }"
			:mask-closable="false"
		>
			<div class="flex gap-6">
				<div class="flex-1">
					<div
						class="h-[360px] bg-gray-50 dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-700 relative shadow-inner"
					>
						<vue-cropper
							ref="cropperRef"
							:img="tempImg"
							auto-crop
							fixed
							:fixed-number="[1, 1]"
							center-box
							mode="cover"
							@real-time="realTimePreview"
						/>
					</div>
				</div>

				<div class="w-[140px] flex flex-col items-center gap-6 pt-2">
					<p
						class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2"
					>
						预览效果
					</p>

					<div class="preview-container large shadow-sm">
						<div :style="getPreviewStyle(100)">
							<div :style="previews.div" class="preview-content">
								<img
									:src="previews.url"
									:style="previews.img"
									class="max-w-none"
								/>
							</div>
						</div>
					</div>
					<div class="text-xs text-center text-gray-400 dark:text-gray-500 mt-[-10px]">
						100 x 100
					</div>

					<div class="preview-container medium shadow-sm">
						<div :style="getPreviewStyle(60)">
							<div :style="previews.div" class="preview-content">
								<img
									:src="previews.url"
									:style="previews.img"
									class="max-w-none"
								/>
							</div>
						</div>
					</div>
					<div class="text-xs text-center text-gray-400 dark:text-gray-500 mt-[-10px]">
						60 x 60
					</div>
				</div>
			</div>

			<template #footer>
				<div class="flex justify-end gap-3">
					<n-button quaternary @click="showCropper = false">
						取消
					</n-button>
					<n-button
						type="primary"
						class="px-6"
						:loading="isUploading"
						@click="handleCropSave"
					>
						保存头像
					</n-button>
				</div>
			</template>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { NModal, NButton, useMessage } from 'naive-ui'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

interface CropperInst {
	getCropBlob: (cb: (blob: Blob) => void) => void
}

interface CropperPreviewData {
	w?: number
	h?: number
	url?: string
	div?: Record<string, string>
	img?: Record<string, string>
}

const props = withDefaults(
	defineProps<{
		uploadUrl?: string
		title?: string
	}>(),
	{
		uploadUrl: `${import.meta.env.VITE_API_URL}/files/update/avatar`,
		title: '编辑个人头像',
	},
)

const emit = defineEmits<{
	(e: 'uploaded', url: string): void
	(e: 'uploading-change', uploading: boolean): void
}>()

const message = useMessage()
const showCropper = ref(false)
const isUploading = ref(false)
const tempImg = ref('')
const previews = ref<CropperPreviewData>({})
const fileInputRef = ref<HTMLInputElement | null>(null)
const cropperRef = ref<CropperInst | null>(null)

const openFileDialog = (): void => {
	fileInputRef.value?.click()
}

const realTimePreview = (data: CropperPreviewData): void => {
	previews.value = data
}

const getPreviewStyle = (size: number): Record<string, string> => {
	if (!previews.value.w || !previews.value.h) return {}
	const scale = size / previews.value.w
	return {
		width: `${previews.value.w}px`,
		height: `${previews.value.h}px`,
		transform: `scale(${scale})`,
		transformOrigin: 'top left',
	}
}

const onFileChange = (event: Event): void => {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	if (!file.type.startsWith('image/')) {
		message.error('只能上传图片格式')
		return
	}
	const reader = new FileReader()
	reader.onload = (e) => {
		tempImg.value = String(e.target?.result || '')
		showCropper.value = true
	}
	reader.readAsDataURL(file)
}

const handleCropSave = (): void => {
	if (!cropperRef.value) return
	cropperRef.value.getCropBlob(async (blob: Blob) => {
		isUploading.value = true
		emit('uploading-change', true)
		try {
			const formData = new FormData()
			formData.append(
				'file',
				new File([blob], 'avatar.png', { type: 'image/png' }),
			)
			const res = await axios.post(props.uploadUrl, formData)
			const fileUrl = String(res?.data?.fileUrl || '').trim()
			if (!fileUrl) {
				throw new Error('头像上传未返回 fileUrl')
			}
			showCropper.value = false
			emit('uploaded', fileUrl)
		} catch (error) {
			console.error('头像上传失败', error)
			message.error('上传失败，请稍后再试')
		} finally {
			isUploading.value = false
			emit('uploading-change', false)
		}
	})
}

defineExpose({
	openFileDialog,
})
</script>

<style scoped>
.hidden {
	display: none;
}

:deep(.avatar-editor-modal .n-card) {
	border-radius: 6px;
}

.preview-container {
	border-radius: 50%;
	overflow: hidden;
	background-color: #f3f4f6;
	border: 2px solid white;
	box-shadow: 0 0 0 1px #e5e7eb;
}

.dark .preview-container {
	background-color: #27272a;
	border-color: #3f3f46;
	box-shadow: 0 0 0 1px #52525b;
}

.preview-container.large {
	width: 100px;
	height: 100px;
}

.preview-container.medium {
	width: 60px;
	height: 60px;
}

.preview-content img {
	max-width: none !important;
	max-height: none !important;
}
</style>

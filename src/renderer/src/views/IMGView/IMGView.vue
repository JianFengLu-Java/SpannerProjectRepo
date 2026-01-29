<template>
	<div
		class="fixed inset-0 z-50 flex flex-col pt-8 select-none transition-colors duration-300"
		:class="themeStore.isDark ? 'bg-[#1e1e1e]' : 'bg-[#f5f6f7]'"
	>
		<!-- Top Bar (Window Drag Region) -->
		<div
			class="flex items-center justify-between px-4 h-10 app-drag-region"
		>
			<!-- Left: Title or Empty (Feishu often shows filename here) -->
			<div class="flex items-center gap-2 app-no-drag">
				<!-- Back button removed as requested -->
				<span
					class="text-sm font-medium"
					:class="
						themeStore.isDark ? 'text-gray-300' : 'text-gray-700'
					"
				>
					{{ isEditMode ? '编辑图片' : '预览图片' }}
				</span>
			</div>

			<!-- Right: Actions -->
			<div class="app-no-drag">
				<div v-if="!isEditMode">
					<n-button
						size="tiny"
						secondary
						strong
						@click="toggleEditMode"
					>
						编辑
					</n-button>
				</div>
				<div v-else class="flex gap-2">
					<n-button size="tiny" secondary @click="toggleEditMode"
						>取消</n-button
					>
					<n-button type="primary" size="tiny" @click="handleSave"
						>完成</n-button
					>
				</div>
			</div>
		</div>

		<!-- Main Content Area -->
		<div
			class="flex-1 relative overflow-hidden flex items-center justify-center p-4"
		>
			<!-- View Mode -->
			<div
				v-if="!isEditMode"
				class="relative w-full h-full flex items-center justify-center"
				@wheel.prevent="handleWheel"
			>
				<div
					class="transition-transform duration-200 ease-out"
					:style="{
						transform: `scale(${scale}) rotate(${rotate}deg)`,
					}"
				>
					<img
						ref="imgRef"
						:src="imgUrl"
						class="max-w-full max-h-full object-contain shadow-sm"
						alt="Preview"
						draggable="false"
					/>
				</div>
			</div>

			<!-- Edit Mode (Vue Cropper) -->
			<div v-else class="w-full h-full">
				<vue-cropper
					ref="cropperRef"
					:img="imgUrl"
					:output-size="1"
					:output-type="'png'"
					:info="true"
					:full="true"
					:can-move="true"
					:can-move-box="true"
					:original="false"
					:auto-crop="true"
					:fixed="false"
					:center-box="true"
					:high="true"
					mode="contain"
				></vue-cropper>
			</div>
		</div>

		<!-- Footer Toolbar (View Mode Only) -->
		<transition name="fade">
			<div
				v-if="!isEditMode"
				class="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none"
			>
				<div
					class="flex items-center gap-4 px-6 py-2 bg-gray-800/80 backdrop-blur-md rounded-full shadow-lg pointer-events-auto"
				>
					<!-- Zoom Out -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="handleZoomOut"
							>
								<template #icon
									><n-icon size="18"><remove /></n-icon
								></template>
							</n-button>
						</template>
						缩小
					</n-tooltip>

					<!-- Reset -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="resetTransform"
							>
								<template #icon
									><n-icon size="18"><refresh /></n-icon
								></template>
							</n-button>
						</template>
						重置
					</n-tooltip>

					<!-- Zoom In -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="handleZoomIn"
							>
								<template #icon
									><n-icon size="18"><add /></n-icon
								></template>
							</n-button>
						</template>
						放大
					</n-tooltip>

					<div class="w-px h-4 bg-gray-600/50 mx-1"></div>

					<!-- Rotate Left -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="handleRotate(-90)"
							>
								<template #icon
									><n-icon size="18"
										><refresh-circle
											class="transform -scale-x-100" /></n-icon
								></template>
							</n-button>
						</template>
						向左旋转
					</n-tooltip>

					<!-- Rotate Right -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="handleRotate(90)"
							>
								<template #icon
									><n-icon size="18"
										><refresh-circle /></n-icon
								></template>
							</n-button>
						</template>
						向右旋转
					</n-tooltip>

					<!-- Download -->
					<n-tooltip trigger="hover">
						<template #trigger>
							<n-button
								quaternary
								circle
								color="#fff"
								@click="handleDownload"
							>
								<template #icon
									><n-icon size="18"
										><download-outline /></n-icon
								></template>
							</n-button>
						</template>
						下载原图
					</n-tooltip>
				</div>
			</div>
		</transition>

		<!-- Footer Toolbar (Edit Mode Only) -->
		<transition name="fade">
			<div
				v-if="isEditMode"
				class="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none"
			>
				<div
					class="flex items-center gap-4 px-6 py-2 bg-gray-800/80 backdrop-blur-md rounded-full shadow-lg pointer-events-auto"
				>
					<n-button
						quaternary
						circle
						color="#fff"
						@click="handleEditRotateLeft"
					>
						<template #icon
							><n-icon size="18"
								><refresh-circle
									class="transform -scale-x-100" /></n-icon
						></template>
					</n-button>
					<n-button
						quaternary
						circle
						color="#fff"
						@click="handleEditRotateRight"
					>
						<template #icon
							><n-icon size="18"><refresh-circle /></n-icon
						></template>
					</n-button>
					<div class="w-px h-4 bg-gray-600/50 mx-1"></div>
					<n-button
						quaternary
						circle
						color="#fff"
						@click="handleEditZoomOut"
					>
						<template #icon
							><n-icon size="18"><remove /></n-icon
						></template>
					</n-button>
					<n-button
						quaternary
						circle
						color="#fff"
						@click="handleEditZoomIn"
					>
						<template #icon
							><n-icon size="18"><add /></n-icon
						></template>
					</n-button>
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NIcon, NTooltip, useMessage } from 'naive-ui'
import { useThemeStore } from '../../stores/theme'
import {
	Add,
	Remove,
	Refresh,
	RefreshCircle,
	DownloadOutline,
} from '@vicons/ionicons5'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

const route = useRoute()
const message = useMessage()
const themeStore = useThemeStore()

// State
const imgUrl = ref((route.query.url as string) || '')
const isEditMode = ref(false)
const scale = ref(1)
const rotate = ref(0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cropperRef = ref<any>(null)

// Setup Route Listener to update image if it changes without component reload (rare but possible)
watch(
	() => route.query.url,
	(newUrl) => {
		if (newUrl) {
			imgUrl.value = newUrl as string
			resetTransform()
		}
	},
)

// View Mode Actions
const handleZoomIn = (): void => {
	scale.value = Math.min(scale.value + 0.25, 5)
}

const handleZoomOut = (): void => {
	scale.value = Math.max(scale.value - 0.25, 0.25)
}

const handleWheel = (e: WheelEvent): void => {
	if (e.deltaY < 0) {
		handleZoomIn()
	} else {
		handleZoomOut()
	}
}

const handleRotate = (deg: number): void => {
	rotate.value += deg
}

const resetTransform = (): void => {
	scale.value = 1
	rotate.value = 0
}

const handleDownload = (): void => {
	const a = document.createElement('a')
	a.href = imgUrl.value
	a.download = `image-${Date.now()}.png`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	message.success('开始下载')
}

// Edit Mode Actions
const toggleEditMode = (): void => {
	isEditMode.value = !isEditMode.value
	if (!isEditMode.value) {
		// Reset if cancelling edit
		resetTransform()
	}
}

const handleEditRotateLeft = (): void => {
	cropperRef.value?.rotateLeft()
}

const handleEditRotateRight = (): void => {
	cropperRef.value?.rotateRight()
}

const handleEditZoomIn = (): void => {
	cropperRef.value?.changeScale(1)
}

const handleEditZoomOut = (): void => {
	cropperRef.value?.changeScale(-1)
}

const handleSave = (): void => {
	cropperRef.value?.getCropBlob((blob: Blob) => {
		// In a real app, you might upload this blob or save it to filesystem
		// For now, we'll create a local Object URL and display it
		const newUrl = URL.createObjectURL(blob)
		imgUrl.value = newUrl
		isEditMode.value = false
		resetTransform()
		message.success('编辑已保存')
	})
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.app-drag-region {
	-webkit-app-region: drag;
}

.app-no-drag {
	-webkit-app-region: no-drag;
}
</style>

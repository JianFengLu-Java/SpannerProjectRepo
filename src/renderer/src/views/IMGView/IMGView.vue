<template>
	<div class="im-preview-root" tabindex="0" @keydown="handleKeydown">
		<div class="preview-bg-layer"></div>

		<header class="preview-top app-drag-region">
			<div class="top-left app-no-drag">
				<p class="title">图片预览</p>
				<p class="meta">{{ currentMeta }}</p>
			</div>
			<div class="top-actions app-no-drag">
				<n-button quaternary size="small" @click="handleDownload">下载</n-button>
				<n-button quaternary size="small" @click="closeWindow">关闭</n-button>
			</div>
		</header>

		<main class="preview-main" @wheel.prevent="handleWheel">
			<button
				v-if="hasPrev"
				class="nav-btn left app-no-drag"
				type="button"
				@click="goPrev"
			>
				<n-icon size="20"><ChevronBack /></n-icon>
			</button>

			<div
				class="stage app-no-drag"
				@mousedown="onDragStart"
			>
				<img
					v-if="currentSrc"
					:key="currentSrc"
					:src="currentSrc"
					class="preview-image"
					:class="{ hidden: isLoading || hasError }"
					alt="preview"
					@load="onImageLoad"
					@error="onImageError"
					:style="imageStyle"
					draggable="false"
				/>
				<div v-if="isLoading && !hasError" class="state">正在加载图片...</div>
				<div v-else-if="hasError" class="state error">图片加载失败</div>
			</div>

			<button
				v-if="hasNext"
				class="nav-btn right app-no-drag"
				type="button"
				@click="goNext"
			>
				<n-icon size="20"><ChevronForward /></n-icon>
			</button>
		</main>

		<footer class="preview-footer app-no-drag">
			<div class="toolbar">
				<n-button quaternary circle size="small" @click="zoomOut">
					<template #icon><n-icon><Remove /></n-icon></template>
				</n-button>
				<n-button quaternary circle size="small" @click="zoomIn">
					<template #icon><n-icon><Add /></n-icon></template>
				</n-button>
				<n-button quaternary size="small" @click="resetTransform">重置</n-button>
				<n-button quaternary size="small" @click="rotateLeft">左转</n-button>
				<n-button quaternary size="small" @click="rotateRight">右转</n-button>
				<span class="scale-label">{{ Math.round(scale * 100) }}%</span>
			</div>

			<div v-if="imageList.length > 1" class="thumb-strip">
				<button
					v-for="(url, idx) in imageList"
					:key="`${url}-${idx}`"
					type="button"
					class="thumb"
					:class="{ active: idx === currentIndex }"
					@click="setIndex(idx)"
				>
					<img :src="url" alt="thumb" loading="lazy" />
				</button>
			</div>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NIcon, useMessage } from 'naive-ui'
import {
	Add,
	Remove,
	ChevronBack,
	ChevronForward,
} from '@vicons/ionicons5'

const route = useRoute()
const message = useMessage()

const imageList = ref<string[]>([])
const currentIndex = ref(0)
const isLoading = ref(true)
const hasError = ref(false)

const scale = ref(1)
const rotate = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)

const dragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartOffsetX = ref(0)
const dragStartOffsetY = ref(0)
let lastWheelAt = 0

const MIN_SCALE = 0.2
const MAX_SCALE = 5
const BUTTON_ZOOM_STEP = 0.12
const WHEEL_ZOOM_STEP = 0.08
const WHEEL_THROTTLE_MS = 40

const currentSrc = computed(() => imageList.value[currentIndex.value] || '')
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < imageList.value.length - 1)
const currentMeta = computed(() => {
	if (!imageList.value.length) return '0 / 0'
	return `${currentIndex.value + 1} / ${imageList.value.length}`
})

const imageStyle = computed(() => ({
	transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value}) rotate(${rotate.value}deg)`,
}))

const parseRouteImages = (): void => {
	const single = String(route.query.url || '').trim()
	const rawList = String(route.query.urls || '').trim()
	const nextIndex = Number(route.query.index || 0)

	let parsedList: string[] = []
	if (rawList) {
		try {
			const json = JSON.parse(rawList)
			if (Array.isArray(json)) {
				parsedList = json.map((item) => String(item || '').trim()).filter(Boolean)
			}
		} catch {
			parsedList = rawList.split(',').map((item) => item.trim()).filter(Boolean)
		}
	}

	if (!parsedList.length && single) parsedList = [single]

	imageList.value = parsedList
	currentIndex.value = Number.isFinite(nextIndex)
		? Math.min(Math.max(0, nextIndex), Math.max(parsedList.length - 1, 0))
		: 0
	hasError.value = !currentSrc.value
	isLoading.value = !hasError.value
	resetTransform()
}

const setIndex = (idx: number): void => {
	if (idx < 0 || idx >= imageList.value.length) return
	currentIndex.value = idx
	isLoading.value = true
	hasError.value = false
	resetTransform()
}

const goPrev = (): void => {
	if (!hasPrev.value) return
	setIndex(currentIndex.value - 1)
}

const goNext = (): void => {
	if (!hasNext.value) return
	setIndex(currentIndex.value + 1)
}

const applyScaleDelta = (delta: number): void => {
	scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + delta))
}

const zoomIn = (): void => {
	applyScaleDelta(BUTTON_ZOOM_STEP)
}

const zoomOut = (): void => {
	applyScaleDelta(-BUTTON_ZOOM_STEP)
}

const rotateLeft = (): void => {
	rotate.value -= 90
}

const rotateRight = (): void => {
	rotate.value += 90
}

const resetTransform = (): void => {
	scale.value = 1
	rotate.value = 0
	offsetX.value = 0
	offsetY.value = 0
}

const handleWheel = (event: WheelEvent): void => {
	const now = Date.now()
	if (now - lastWheelAt < WHEEL_THROTTLE_MS) return
	lastWheelAt = now

	if (event.deltaY < 0) applyScaleDelta(WHEEL_ZOOM_STEP)
	else applyScaleDelta(-WHEEL_ZOOM_STEP)
}

const onDragStart = (event: MouseEvent): void => {
	if (hasError.value || isLoading.value) return
	dragging.value = true
	dragStartX.value = event.clientX
	dragStartY.value = event.clientY
	dragStartOffsetX.value = offsetX.value
	dragStartOffsetY.value = offsetY.value
	window.addEventListener('mousemove', onDragMove)
	window.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (event: MouseEvent): void => {
	if (!dragging.value) return
	offsetX.value = dragStartOffsetX.value + (event.clientX - dragStartX.value)
	offsetY.value = dragStartOffsetY.value + (event.clientY - dragStartY.value)
}

const onDragEnd = (): void => {
	dragging.value = false
	window.removeEventListener('mousemove', onDragMove)
	window.removeEventListener('mouseup', onDragEnd)
}

const onImageLoad = (): void => {
	isLoading.value = false
	hasError.value = false
}

const onImageError = (): void => {
	isLoading.value = false
	hasError.value = true
}

const handleDownload = (): void => {
	if (!currentSrc.value) return
	const a = document.createElement('a')
	a.href = currentSrc.value
	a.download = `im-image-${Date.now()}.png`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	message.success('开始下载')
}

const closeWindow = (): void => {
	if (window.electron?.ipcRenderer?.send) {
		window.electron.ipcRenderer.send('close-window')
		return
	}
	window.close()
}

const handleKeydown = (event: KeyboardEvent): void => {
	switch (event.key) {
		case 'Escape':
			closeWindow()
			break
		case 'ArrowLeft':
			goPrev()
			break
		case 'ArrowRight':
			goNext()
			break
		case '+':
		case '=':
			zoomIn()
			break
		case '-':
		case '_':
			zoomOut()
			break
		case '0':
			resetTransform()
			break
	}
}

watch(
	() => [route.query.url, route.query.urls, route.query.index],
	() => parseRouteImages(),
	{ immediate: true },
)

onMounted(() => {
	window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
	onDragEnd()
	window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.im-preview-root {
	position: fixed;
	inset: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	color: #334155;
	background: #eef4ff;
	user-select: none;
}

.preview-bg-layer {
	position: absolute;
	inset: 0;
	background:
		radial-gradient(circle at 20% 10%, rgba(96, 165, 250, 0.18), transparent 42%),
		radial-gradient(circle at 80% 90%, rgba(125, 211, 252, 0.16), transparent 45%),
		linear-gradient(160deg, #f4f8ff 0%, #edf3ff 55%, #eaf1ff 100%);
	pointer-events: none;
}

.preview-top {
	position: relative;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 56px;
	padding: 0 16px;
	border-bottom: 1px solid rgba(148, 163, 184, 0.24);
	background: rgba(255, 255, 255, 0.65);
	backdrop-filter: blur(8px);
}

.top-left {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.title {
	font-size: 14px;
	font-weight: 700;
	line-height: 1;
}

.meta {
	font-size: 12px;
	color: rgba(71, 85, 105, 0.72);
	line-height: 1;
}

.top-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.preview-main {
	position: relative;
	z-index: 1;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px 24px;
	overflow: hidden;
}

.stage {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	cursor: grab;
}

.stage:active {
	cursor: grabbing;
}

.preview-image {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
	transition: transform 0.12s linear;
	will-change: transform;
}

.preview-image.hidden {
	visibility: hidden;
}

.state {
	font-size: 13px;
	color: rgba(71, 85, 105, 0.85);
}

.state.error {
	color: rgba(220, 38, 38, 0.85);
}

.nav-btn {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	width: 34px;
	height: 34px;
	border-radius: 999px;
	border: 1px solid rgba(148, 163, 184, 0.35);
	background: rgba(255, 255, 255, 0.68);
	color: #334155;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}

.nav-btn.left {
	left: 20px;
}

.nav-btn.right {
	right: 20px;
}

.preview-footer {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 10px 16px 14px;
	border-top: 1px solid rgba(148, 163, 184, 0.24);
	background: rgba(255, 255, 255, 0.65);
	backdrop-filter: blur(10px);
}

.toolbar {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
}

.scale-label {
	font-size: 12px;
	color: rgba(71, 85, 105, 0.78);
	min-width: 46px;
	text-align: center;
}

.thumb-strip {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	overflow-x: auto;
	padding: 2px 0;
}

.thumb {
	width: 44px;
	height: 44px;
	border-radius: 8px;
	overflow: hidden;
	border: 1px solid rgba(148, 163, 184, 0.28);
	background: rgba(255, 255, 255, 0.9);
	cursor: pointer;
	padding: 0;
	flex: 0 0 auto;
}

.thumb.active {
	border-color: rgba(59, 130, 246, 0.85);
}

.thumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.app-drag-region {
	-webkit-app-region: drag;
}

.app-no-drag {
	-webkit-app-region: no-drag;
}
</style>

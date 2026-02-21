<template>
	<div class="call-window-root">
		<header class="call-window-header drag">
			<div class="header-title no-drag">
				<div class="name">{{ chatName }}</div>
				<div class="meta">视频通话</div>
			</div>
			<div class="header-status no-drag">
				{{ statusText }}<span v-if="phase === 'connected'"> · {{ durationText }}</span>
			</div>
		</header>

		<main ref="callStageRef" class="call-stage">
			<div class="remote-stage" :class="{ dialing: phase === 'calling' }">
				<div class="avatar-ring" :class="{ active: phase === 'calling' }">
					<n-avatar round :size="92" :src="chatAvatar" />
				</div>
				<div class="remote-name">{{ chatName }}</div>
				<div class="remote-hint">
					{{
						cameraError
							? cameraError
							: phase === 'calling'
								? '拨号中，等待对方接通...'
								: '已接通（Mock）'
					}}
				</div>
			</div>
			<div
				ref="localPreviewRef"
				class="local-preview no-drag"
				:style="localPreviewStyle"
				@pointerdown="onPreviewPointerDown"
			>
				<video
					ref="localVideoRef"
					class="local-video"
					autoplay
					playsinline
					muted
				></video>
				<div v-if="!cameraEnabled" class="local-video-mask">
					摄像头已关闭
				</div>
				<div v-else-if="!hasVideoStream" class="local-video-mask">
					等待摄像头...
				</div>
				<span class="preview-label">本地预览</span>
			</div>
		</main>

		<footer class="call-controls no-drag">
			<button type="button" class="control-btn" @click="toggleCamera">
				{{ cameraEnabled ? '关闭摄像头' : '开启摄像头' }}
			</button>
			<button type="button" class="hangup-btn" @click="hangup">
				{{ phase === 'calling' ? '取消拨号' : '挂断' }}
			</button>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAvatar } from 'naive-ui'
import {
	createMockVideoCallSession,
	formatMockCallDuration,
	getMockConnectDelayMs,
} from '@renderer/services/mockVideoCallService'

const route = useRoute()

const chatName = computed(() => {
	const value = String(route.query.name || '').trim()
	return value || '对方'
})

const chatAvatar = computed(() => String(route.query.avatar || '').trim())
const startConnected = computed(
	() => String(route.query.startConnected || '0').trim() === '1',
)

const phase = ref<'calling' | 'connected' | 'ended'>('calling')
const seconds = ref(0)
const cameraEnabled = ref(true)
const cameraError = ref('')
const callStageRef = ref<HTMLElement | null>(null)
const localVideoRef = ref<HTMLVideoElement | null>(null)
const localPreviewRef = ref<HTMLElement | null>(null)
const localStream = ref<MediaStream | null>(null)
const localPreviewX = ref(0)
const localPreviewY = ref(0)
const localPreviewWidth = 220
const localPreviewHeight = 132
const localPreviewStyle = computed(() => ({
	left: `${localPreviewX.value}px`,
	top: `${localPreviewY.value}px`,
}))
const hasVideoStream = computed(() => {
	return Boolean(
		localStream.value &&
			localStream.value.getVideoTracks().some((track) => track.readyState === 'live'),
	)
})

const statusText = computed(() => {
	if (phase.value === 'connected') return '通话中'
	if (phase.value === 'ended') return '已结束'
	return '拨号中'
})

const durationText = computed(() => formatMockCallDuration(seconds.value))

let connectTimer: ReturnType<typeof setTimeout> | null = null
let durationTimer: ReturnType<typeof setInterval> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let dragPointerId: number | null = null
let dragStartClientX = 0
let dragStartClientY = 0
let dragOriginX = 0
let dragOriginY = 0

const clearTimers = (): void => {
	if (connectTimer) {
		clearTimeout(connectTimer)
		connectTimer = null
	}
	if (durationTimer) {
		clearInterval(durationTimer)
		durationTimer = null
	}
	if (closeTimer) {
		clearTimeout(closeTimer)
		closeTimer = null
	}
}

const clampPreviewPosition = (x: number, y: number): { x: number; y: number } => {
	const stage = callStageRef.value
	if (!stage) return { x, y }
	const maxX = Math.max(0, stage.clientWidth - localPreviewWidth - 8)
	const maxY = Math.max(0, stage.clientHeight - localPreviewHeight - 8)
	return {
		x: Math.min(Math.max(8, x), maxX),
		y: Math.min(Math.max(8, y), maxY),
	}
}

const resetPreviewPosition = (): void => {
	const stage = callStageRef.value
	if (!stage) return
	const targetX = stage.clientWidth - localPreviewWidth - 16
	const targetY = 16
	const next = clampPreviewPosition(targetX, targetY)
	localPreviewX.value = next.x
	localPreviewY.value = next.y
}

const clampPreviewPositionInPlace = (): void => {
	const next = clampPreviewPosition(localPreviewX.value, localPreviewY.value)
	localPreviewX.value = next.x
	localPreviewY.value = next.y
}

const onPreviewPointerMove = (event: PointerEvent): void => {
	if (dragPointerId === null || event.pointerId !== dragPointerId) return
	const nextX = dragOriginX + (event.clientX - dragStartClientX)
	const nextY = dragOriginY + (event.clientY - dragStartClientY)
	const next = clampPreviewPosition(nextX, nextY)
	localPreviewX.value = next.x
	localPreviewY.value = next.y
}

const stopPreviewDrag = (): void => {
	dragPointerId = null
	window.removeEventListener('pointermove', onPreviewPointerMove)
	window.removeEventListener('pointerup', stopPreviewDrag)
	window.removeEventListener('pointercancel', stopPreviewDrag)
}

const onPreviewPointerDown = (event: PointerEvent): void => {
	if (event.button !== 0) return
	dragPointerId = event.pointerId
	dragStartClientX = event.clientX
	dragStartClientY = event.clientY
	dragOriginX = localPreviewX.value
	dragOriginY = localPreviewY.value
	window.addEventListener('pointermove', onPreviewPointerMove)
	window.addEventListener('pointerup', stopPreviewDrag)
	window.addEventListener('pointercancel', stopPreviewDrag)
}

const startCall = (): void => {
	clearTimers()
	phase.value = startConnected.value ? 'connected' : 'calling'
	seconds.value = 0
	cameraEnabled.value = true
	if (startConnected.value) {
		durationTimer = setInterval(() => {
			seconds.value += 1
		}, 1000)
		return
	}
	const session = createMockVideoCallSession(chatName.value)
	connectTimer = setTimeout(() => {
		phase.value = 'connected'
		durationTimer = setInterval(() => {
			seconds.value += 1
		}, 1000)
	}, getMockConnectDelayMs(session.id))
}

const stopLocalPreview = (): void => {
	if (localVideoRef.value) {
		localVideoRef.value.srcObject = null
	}
	if (localStream.value) {
		for (const track of localStream.value.getTracks()) {
			track.stop()
		}
		localStream.value = null
	}
}

const startLocalPreview = async (): Promise<void> => {
	cameraError.value = ''
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		cameraError.value = '当前环境不支持摄像头预览'
		return
	}
	try {
		stopLocalPreview()
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { ideal: 640 },
				height: { ideal: 360 },
				facingMode: 'user',
			},
			audio: false,
		})
		localStream.value = stream
		const videoTrack = stream.getVideoTracks()[0]
		cameraEnabled.value = Boolean(videoTrack?.enabled)
		if (localVideoRef.value) {
			localVideoRef.value.srcObject = stream
			void localVideoRef.value.play().catch(() => {
				// ignore autoplay failures in case browser policy changes
			})
		}
	} catch (error) {
		console.warn('启动本地摄像头失败:', error)
		cameraError.value = '摄像头不可用，请检查系统授权'
	}
}

const toggleCamera = (): void => {
	const stream = localStream.value
	if (!stream) {
		void startLocalPreview()
		return
	}
	const tracks = stream.getVideoTracks()
	if (!tracks.length) {
		void startLocalPreview()
		return
	}
	const nextEnabled = !cameraEnabled.value
	for (const track of tracks) {
		track.enabled = nextEnabled
	}
	cameraEnabled.value = nextEnabled
}

const hangup = (): void => {
	if (phase.value === 'ended') {
		window.api.closeWindow()
		return
	}
	clearTimers()
	stopLocalPreview()
	phase.value = 'ended'
	closeTimer = setTimeout(() => {
		window.api.closeWindow()
	}, 500)
}

onMounted(() => {
	resetPreviewPosition()
	window.addEventListener('resize', clampPreviewPositionInPlace)
	void startLocalPreview()
	startCall()
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', clampPreviewPositionInPlace)
	stopPreviewDrag()
	clearTimers()
	stopLocalPreview()
})
</script>

<style scoped>
.call-window-root {
	height: 100vh;
	width: 100vw;
	display: flex;
	flex-direction: column;
	background: #f7f8fa;
	color: #111827;
}

.call-window-header {
	height: 62px;
	padding: 10px 18px 10px 78px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid #e5e7eb;
	background: #ffffff;
}

.header-title .name {
	font-size: 17px;
	font-weight: 600;
	line-height: 1.2;
}

.header-title .meta {
	font-size: 12px;
	color: #6b7280;
	margin-top: 2px;
}

.header-status {
	font-size: 13px;
	font-weight: 500;
	color: #4b5563;
}

.call-stage {
	flex: 1;
	position: relative;
	margin: 18px;
	border-radius: 18px;
	border: 1px solid #e5e7eb;
	background: #ffffff;
	overflow: hidden;
}

.remote-stage {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
}

.avatar-ring {
	width: 126px;
	height: 126px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #eef2ff;
}

.avatar-ring.active {
	animation: ring 1.8s ease-out infinite;
}

.remote-name {
	margin-top: 8px;
	font-size: 24px;
	font-weight: 600;
}

.remote-hint {
	font-size: 13px;
	color: #6b7280;
}

.local-preview {
	position: absolute;
	left: 16px;
	top: 16px;
	width: 220px;
	height: 132px;
	border-radius: 14px;
	border: 1px solid #d1d5db;
	background: #111827;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	cursor: grab;
	touch-action: none;
	user-select: none;
}

.local-preview:active {
	cursor: grabbing;
}

.local-video {
	height: 100%;
	width: 100%;
	object-fit: cover;
	background: #0f172a;
	transform: scaleX(-1);
}

.local-video-mask {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.88);
	background: rgba(15, 23, 42, 0.56);
}

.preview-label {
	position: absolute;
	left: 8px;
	bottom: 8px;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.86);
	background: rgba(15, 23, 42, 0.46);
	padding: 2px 6px;
	border-radius: 8px;
}

.call-controls {
	height: 84px;
	padding: 0 20px 18px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
}

.control-btn {
	height: 38px;
	padding: 0 16px;
	border-radius: 999px;
	border: 1px solid #d1d5db;
	background: #fff;
	color: #111827;
	font-size: 12px;
	font-weight: 500;
}

.control-btn:hover {
	background: #f9fafb;
}

.hangup-btn {
	height: 38px;
	padding: 0 18px;
	border-radius: 999px;
	border: none;
	background: #dc2626;
	color: #fff;
	font-size: 12px;
	font-weight: 600;
}

.hangup-btn:hover {
	filter: brightness(1.07);
}

.drag {
	-webkit-app-region: drag;
}

.no-drag {
	-webkit-app-region: no-drag;
}

@keyframes ring {
	0% {
		box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.28);
	}
	70% {
		box-shadow: 0 0 0 18px rgba(99, 102, 241, 0);
	}
	100% {
		box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
	}
}

@media (max-width: 900px) {
	.call-window-header {
		padding-left: 18px;
	}
}
</style>

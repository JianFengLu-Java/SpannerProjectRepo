<template>
	<div class="call-window-root">
		<header class="call-window-header drag">
			<div class="header-title no-drag">
				<div class="name">{{ chatName }}</div>
				<div class="meta">{{ callTypeLabel }}</div>
			</div>
			<div class="header-status no-drag">
				{{ statusText }}<span v-if="phase === 'connected'"> · {{ durationText }}</span>
			</div>
		</header>

		<main ref="callStageRef" class="call-stage">
			<div v-if="isOutgoingRequesting" class="outgoing-request-layer">
				<div class="request-pulse">
					<n-avatar round :size="96" :src="chatAvatar" />
				</div>
				<div class="request-name">{{ chatName }}</div>
				<div class="request-desc">正在发起通话请求，等待对方接听...</div>
			</div>

			<video
				v-else-if="hasRemoteStream"
				ref="remoteVideoRef"
				class="remote-video"
				autoplay
				playsinline
			></video>

			<div v-else class="remote-stage">
				<div class="avatar-ring" :class="{ active: phase === 'calling' || phase === 'connecting' }">
					<n-avatar round :size="92" :src="chatAvatar" />
				</div>
				<div class="remote-name">{{ chatName }}</div>
				<div class="remote-hint">{{ remoteHintText }}</div>
			</div>
			<audio ref="remoteAudioRef" autoplay playsinline></audio>

			<div
				v-if="callType === 'video'"
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
				<div v-if="!cameraEnabled" class="local-video-mask">摄像头已关闭</div>
				<div v-else-if="!hasLocalStream" class="local-video-mask">等待摄像头...</div>
				<span class="preview-label">本地预览</span>
			</div>
		</main>

		<footer class="call-controls no-drag">
			<button
				v-if="callType === 'video' && phase !== 'ended'"
				type="button"
				class="control-btn"
				@click="toggleCamera"
			>
				{{ cameraEnabled ? '关闭摄像头' : '开启摄像头' }}
			</button>
			<button
				v-if="phase !== 'ended'"
				type="button"
				class="control-btn"
				@click="toggleSpeaker"
			>
				{{ speakerMuted ? '开启声音' : '静音对方' }}
			</button>
			<button type="button" class="hangup-btn" @click="hangup">
				{{ phase === 'calling' ? '取消拨号' : '挂断' }}
			</button>
		</footer>

		<section class="debug-panel no-drag">
			<div class="debug-header">
				<span>调试日志</span>
				<div class="debug-actions">
					<button type="button" class="debug-btn" @click="copyDebugLogs">
						{{ copyStateText }}
					</button>
					<button type="button" class="debug-btn" @click="clearDebugLogs">清空</button>
					<button type="button" class="debug-btn" @click="debugCollapsed = !debugCollapsed">
						{{ debugCollapsed ? '展开' : '收起' }}
					</button>
				</div>
			</div>
			<div v-if="!debugCollapsed" class="debug-body">
				<div v-for="item in debugLogs" :key="item.id" class="debug-line">
					<span class="debug-ts">{{ item.ts }}</span>
					<span>{{ item.text }}</span>
				</div>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAvatar, useMessage } from 'naive-ui'
import { tokenManager } from '@renderer/services/tokenManager'
import {
	privateChatWs,
	type PrivateCallAnsweredFrame,
	type PrivateCallEndedFrame,
	type PrivateCallSignalFrame,
} from '@renderer/services/privateChatWs'
import { subscribeCallSignal } from '@renderer/services/callWindowBridge'
import { formatMockCallDuration } from '@renderer/services/mockVideoCallService'
import { WebRtcCallClient } from '@renderer/services/webrtcCall'
import { videoCallApi } from '@renderer/services/videoCallApi'

const route = useRoute()
const message = useMessage()
const rtcClient = new WebRtcCallClient()
const queuedSignals: PrivateCallSignalFrame[] = []

const chatName = computed(() => String(route.query.name || '').trim() || '对方')
const chatAvatar = computed(() => String(route.query.avatar || '').trim())
const callType = computed(() =>
	String(route.query.type || 'video').trim().toLowerCase() === 'audio'
		? 'audio'
		: 'video',
)
const callTypeLabel = computed(() =>
	callType.value === 'audio' ? '语音通话' : '视频通话',
)
const callId = computed(() =>
	String(
		route.query.callId ||
			route.query.call_id ||
			route.query.id ||
			route.query.sessionId ||
			route.query.session_id ||
			'',
	).trim(),
)
const peerAccount = computed(() =>
	String(
		route.query.peerAccount ||
			route.query.fromAccount ||
			route.query.from ||
			route.query.callerAccount ||
			'',
	).trim(),
)
const role = computed(() =>
	String(route.query.role || 'caller').trim().toLowerCase() === 'callee'
		? 'callee'
		: 'caller',
)

const phase = ref<'calling' | 'connecting' | 'connected' | 'ended' | 'failed'>(
	role.value === 'caller' ? 'calling' : 'connecting',
)
const seconds = ref(0)
const cameraEnabled = ref(callType.value === 'video')
const cameraError = ref('')
const callStageRef = ref<HTMLElement | null>(null)
const localVideoRef = ref<HTMLVideoElement | null>(null)
const remoteVideoRef = ref<HTMLVideoElement | null>(null)
const remoteAudioRef = ref<HTMLAudioElement | null>(null)
const localPreviewX = ref(0)
const localPreviewY = ref(0)
const localPreviewWidth = 220
const localPreviewHeight = 132
const localPreviewStyle = computed(() => ({
	left: `${localPreviewX.value}px`,
	top: `${localPreviewY.value}px`,
}))
const hasLocalStream = ref(false)
const hasRemoteStream = ref(false)
const speakerMuted = ref(false)
const pendingAudioUnlock = ref(false)
const debugCollapsed = ref(false)
const debugLogs = ref<Array<{ id: string; ts: string; text: string }>>([])
const copyStateText = ref('复制')

let durationTimer: ReturnType<typeof setInterval> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let callerAnsweredPollTimer: ReturnType<typeof setInterval> | null = null
let dragPointerId: number | null = null
let dragStartClientX = 0
let dragStartClientY = 0
let dragOriginX = 0
let dragOriginY = 0
let rtcStarted = false
let rtcReady = false
let closeEndReported = false
let callSummarySent = false
let disposeBridgeSignal: (() => void) | null = null
const handledSignalKeys: string[] = []

const pushDebug = (text: string, data?: unknown): void => {
	const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
	let line = text
	if (data !== undefined) {
		try {
			line += ` ${JSON.stringify(data)}`
		} catch {
			line += ` ${String(data)}`
		}
	}
	debugLogs.value.push({
		id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		ts,
		text: line,
	})
	if (debugLogs.value.length > 220) {
		debugLogs.value.splice(0, debugLogs.value.length - 220)
	}
}

const clearDebugLogs = (): void => {
	debugLogs.value = []
}

const copyDebugLogs = async (): Promise<void> => {
	const text = debugLogs.value.map((item) => `${item.ts} ${item.text}`).join('\n').trim()
	if (!text) {
		message.warning('暂无调试日志可复制')
		return
	}
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text)
		} else {
			const textarea = document.createElement('textarea')
			textarea.value = text
			textarea.style.position = 'fixed'
			textarea.style.opacity = '0'
			document.body.appendChild(textarea)
			textarea.focus()
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
		}
		copyStateText.value = '已复制'
		setTimeout(() => {
			copyStateText.value = '复制'
		}, 1500)
	} catch (error) {
		copyStateText.value = '复制失败'
		setTimeout(() => {
			copyStateText.value = '复制'
		}, 1500)
		message.error('复制失败，请手动选择复制')
		pushDebug('[UI] copy debug failed', String(error))
	}
}

const statusText = computed(() => {
	if (phase.value === 'connected') return '通话中'
	if (phase.value === 'connecting') return '连接中'
	if (phase.value === 'ended') return '已结束'
	if (phase.value === 'failed') return '连接失败'
	return '拨号中'
})
const durationText = computed(() => formatMockCallDuration(seconds.value))
const isOutgoingRequesting = computed(
	() => role.value === 'caller' && phase.value === 'calling',
)
const remoteHintText = computed(() => {
	if (cameraError.value) return cameraError.value
	if (phase.value === 'calling') return '拨号中，等待对方接通...'
	if (phase.value === 'connecting') return '正在建立媒体连接...'
	if (phase.value === 'failed') return '媒体连接失败'
	if (!hasRemoteStream.value) return '等待对方视频流...'
	return '通话已建立'
})

const clearTimers = (): void => {
	if (durationTimer) {
		clearInterval(durationTimer)
		durationTimer = null
	}
	if (closeTimer) {
		clearTimeout(closeTimer)
		closeTimer = null
	}
	if (callerAnsweredPollTimer) {
		clearInterval(callerAnsweredPollTimer)
		callerAnsweredPollTimer = null
	}
}

const buildCallSummaryPayload = (
	ended?: Partial<PrivateCallEndedFrame>,
): Record<string, unknown> | null => {
	if (!callId.value || !peerAccount.value) return null
	const callTypeCode = callType.value === 'audio' ? 'AUDIO' : 'VIDEO'
	const callTypeText = callType.value === 'audio' ? '语音通话' : '视频通话'
	const durationFromEnded =
		typeof ended?.durationSeconds === 'number' &&
		Number.isFinite(ended.durationSeconds)
			? Math.max(0, Math.floor(ended.durationSeconds))
			: null
	const durationSeconds = durationFromEnded ?? Math.max(0, Math.floor(seconds.value))
	const minutes = Math.floor(durationSeconds / 60)
	const secs = durationSeconds % 60
	const endedAt = String(ended?.endedAt || '').trim() || new Date().toISOString()
	const endReason = String(ended?.endReason || '').trim() || 'HANGUP'
	return {
		bizType: 'CALL_SUMMARY',
		callId: callId.value,
		callType: callTypeCode,
		callTypeText,
		durationSeconds,
		minutes,
		seconds: secs,
		endedAt,
		endReason,
		displayText: `[${callTypeText}]：${minutes}分：${secs}秒`,
	}
}

const sendCallSummaryIfNeeded = (ended?: Partial<PrivateCallEndedFrame>): void => {
	if (callSummarySent) return
	if (role.value !== 'caller') return
	const payload = buildCallSummaryPayload(ended)
	if (!payload) return
	const clientMessageId = `c_call_summary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	const sent = privateChatWs.sendPrivate(
		peerAccount.value,
		JSON.stringify(payload),
		clientMessageId,
	)
	pushDebug('[WS] send call summary', {
		sent,
		to: peerAccount.value,
		clientMessageId,
		callId: callId.value,
	})
	if (sent) {
		callSummarySent = true
	}
}

const buildEndPayload = (): { requestId: string; reason: string } => ({
	requestId: `req_call_end_close_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
	reason: 'WINDOW_CLOSE',
})

const reportEndOnWindowClose = (): void => {
	if (closeEndReported) return
	if (!callId.value) return
	closeEndReported = true
	pushDebug('[API] close-report /end')
	const baseUrl = String(import.meta.env.VITE_API_URL || '').trim()
	if (!baseUrl) return
	const token = tokenManager.getAccessToken().trim()
	const url = `${baseUrl.replace(/\/$/, '')}/calls/${encodeURIComponent(callId.value)}/end`
	void fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(buildEndPayload()),
		keepalive: true,
	}).catch(() => {
		// ignore
	})
}

const startDurationTimer = (): void => {
	if (durationTimer) return
	pushDebug('[UI] start duration timer')
	durationTimer = setInterval(() => {
		seconds.value += 1
	}, 1000)
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
	const next = clampPreviewPosition(
		stage.clientWidth - localPreviewWidth - 16,
		16,
	)
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

const playElementSafely = async (
	el: HTMLMediaElement | null,
	label: 'audio' | 'video',
): Promise<void> => {
	if (!el) return
	try {
		await el.play()
		if (label === 'audio') {
			pendingAudioUnlock.value = false
		}
	} catch (error) {
		pushDebug(`[RTC] ${label} autoplay blocked`, String(error))
		if (label === 'audio') {
			pendingAudioUnlock.value = true
		}
	}
}

const ensureRemotePlayback = async (): Promise<void> => {
	if (remoteAudioRef.value) {
		remoteAudioRef.value.muted = speakerMuted.value
		remoteAudioRef.value.volume = speakerMuted.value ? 0 : 1
	}
	if (remoteVideoRef.value) {
		remoteVideoRef.value.muted = speakerMuted.value
		remoteVideoRef.value.volume = speakerMuted.value ? 0 : 1
	}
	await playElementSafely(remoteAudioRef.value, 'audio')
	await playElementSafely(remoteVideoRef.value, 'video')
}

const tryUnlockAudioPlayback = (): void => {
	if (!pendingAudioUnlock.value) return
	void ensureRemotePlayback()
}

const bindStreams = (): void => {
	rtcClient.onDebug = (line) => pushDebug(line)
	rtcClient.onLocalStream = (stream) => {
		hasLocalStream.value = Boolean(stream)
		if (localVideoRef.value) {
			localVideoRef.value.srcObject = stream
			void localVideoRef.value.play().catch(() => {
				// ignore
			})
		}
	}
	rtcClient.onRemoteStream = (stream) => {
		hasRemoteStream.value = Boolean(stream && stream.getTracks().length)
		pushDebug('[RTC] remote stream', {
			audioTracks: stream?.getAudioTracks().length || 0,
			videoTracks: stream?.getVideoTracks().length || 0,
		})
		if (remoteVideoRef.value) {
			remoteVideoRef.value.srcObject = stream
		}
		if (remoteAudioRef.value) {
			remoteAudioRef.value.srcObject = stream
		}
		void ensureRemotePlayback()
	}
	rtcClient.onConnectionStateChange = (state) => {
		pushDebug('[RTC] connection', state)
		if (state === 'connected') {
			phase.value = 'connected'
			startDurationTimer()
			return
		}
		if (state === 'connecting') {
			if (phase.value !== 'connected') phase.value = 'connecting'
			return
		}
		if (state === 'failed' || state === 'disconnected') {
			if (phase.value !== 'ended') phase.value = 'failed'
		}
	}
	rtcClient.onError = (error) => {
		cameraError.value = '摄像头或麦克风不可用，请检查系统授权'
		phase.value = 'failed'
		pushDebug('[RTC] error', String(error))
	}
}

const normalizeSignalType = (
	signal: PrivateCallSignalFrame,
): 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'RENEGOTIATE' => {
	const normalized = String(signal.signalType || signal.type || '')
		.trim()
		.toUpperCase()
	if (
		normalized === 'OFFER' ||
		normalized === 'ANSWER' ||
		normalized === 'ICE_CANDIDATE' ||
		normalized === 'RENEGOTIATE'
	) {
		return normalized
	}
	return 'ICE_CANDIDATE'
}

const mapSignal = (signal: PrivateCallSignalFrame) => {
	const raw = signal as Record<string, unknown>
	const description = raw.description as
		| string
		| { type?: string; sdp?: string }
		| undefined
	const mappedSdp =
		signal.sdp ||
		(typeof description === 'string'
			? description
			: (description as { sdp?: string } | undefined)?.sdp) ||
		(raw.offer as string | undefined) ||
		(raw.answer as string | undefined) ||
		undefined
	const mappedCandidate =
		signal.candidate ||
		(raw.iceCandidate as string | undefined) ||
		(raw.ice as string | undefined) ||
		undefined
	const mappedSdpMid =
		signal.sdpMid === null
			? null
			: String(
					signal.sdpMid ||
						raw.mid ||
						(raw.candidate as { sdpMid?: string } | undefined)?.sdpMid ||
						'',
				).trim() || undefined
	const mappedSdpMLineIndex =
		typeof signal.sdpMLineIndex === 'number'
			? signal.sdpMLineIndex
			: typeof raw.mLineIndex === 'number'
				? raw.mLineIndex
				: typeof (raw.candidate as { sdpMLineIndex?: number } | undefined)?.sdpMLineIndex ===
					  'number'
					? ((raw.candidate as { sdpMLineIndex?: number }).sdpMLineIndex as number)
					: null
	return {
		signalType: normalizeSignalType(signal),
		from: String(signal.from || raw.fromAccount || '').trim() || 'unknown',
		to: String(signal.to || raw.toAccount || '').trim() || undefined,
		sdp: mappedSdp,
		candidate: mappedCandidate,
		sdpMid: mappedSdpMid,
		sdpMLineIndex: mappedSdpMLineIndex,
	}
}

const startRtcIfNeeded = async (): Promise<void> => {
	if (rtcStarted) return
	if (!callId.value || !peerAccount.value) {
		phase.value = 'failed'
		cameraError.value = '缺少通话参数，请重新发起通话'
		pushDebug('[RTC] missing params', {
			callId: callId.value,
			peerAccount: peerAccount.value,
		})
		return
	}
	rtcStarted = true
	rtcReady = false
	phase.value = phase.value === 'connected' ? 'connected' : 'connecting'
	bindStreams()
	pushDebug('[RTC] start', {
		callId: callId.value,
		role: role.value,
		peerAccount: peerAccount.value,
	})
	await rtcClient.start({
		callId: callId.value,
		role: role.value,
		peerAccount: peerAccount.value,
		callType: callType.value,
	})
	rtcReady = true
	cameraEnabled.value = callType.value === 'video'
	while (queuedSignals.length) {
		const signal = queuedSignals.shift()
		if (!signal) break
		await rtcClient.handleSignal(mapSignal(signal))
	}
	pushDebug('[RTC] ready')
}

const startCallerAnsweredPolling = (): void => {
	if (role.value !== 'caller' || !callId.value || callerAnsweredPollTimer) return
	let retryCount = 0
	callerAnsweredPollTimer = setInterval(async () => {
		retryCount += 1
		if (retryCount > 30 || phase.value === 'ended') {
			clearTimers()
			return
		}
		try {
			const response = await videoCallApi.getCallSession(callId.value)
			const status = String(response.data?.data?.status || '')
				.trim()
				.toUpperCase()
			pushDebug('[API] poll status', status)
			if (status === 'ANSWERED' || status === 'CONNECTING' || status === 'CONNECTED') {
				if (status === 'CONNECTED') {
					phase.value = 'connected'
					startDurationTimer()
				}
				void startRtcIfNeeded()
				if (callerAnsweredPollTimer) {
					clearInterval(callerAnsweredPollTimer)
					callerAnsweredPollTimer = null
				}
				return
			}
			if (
				status === 'REJECTED' ||
				status === 'CANCELED' ||
				status === 'NO_ANSWER' ||
				status === 'BUSY' ||
				status === 'ENDED' ||
				status === 'FAILED'
			) {
				phase.value = 'ended'
				if (callerAnsweredPollTimer) {
					clearInterval(callerAnsweredPollTimer)
					callerAnsweredPollTimer = null
				}
			}
		} catch (error) {
			pushDebug('[API] poll failed', String(error))
		}
	}, 1000)
}

const handleCallAnswered = (payload: PrivateCallAnsweredFrame): void => {
	if (!callId.value) return
	if (String(payload.callId || '').trim() !== callId.value) return
	pushDebug('[WS] call.answered', payload)
	if (role.value === 'caller') {
		void startRtcIfNeeded()
	}
}

const handleCallEnded = (payload: PrivateCallEndedFrame): void => {
	if (!callId.value) return
	if (String(payload.callId || '').trim() !== callId.value) return
	pushDebug('[WS] call.ended', payload)
	sendCallSummaryIfNeeded(payload)
	phase.value = 'ended'
	clearTimers()
	rtcClient.dispose()
	closeTimer = setTimeout(() => {
		window.api.closeWindow()
	}, 500)
}

const handleCallSignal = (payload: PrivateCallSignalFrame): void => {
	if (!callId.value) return
	const rawPayload = payload as Record<string, unknown>
	const payloadCallId = String(
		payload.callId ||
			rawPayload.call_id ||
			rawPayload.id ||
			rawPayload.sessionId ||
			rawPayload.session_id ||
			'',
	).trim()
	if (payloadCallId !== callId.value) return
	const normalizedType = normalizeSignalType(payload)
	const candidateText =
		typeof payload.candidate === 'string'
			? payload.candidate
			: String(payload.candidate?.candidate || '')
	const signalKey = [
		payloadCallId,
		normalizedType,
		String(payload.from || ''),
		String(payload.to || ''),
		String(payload.sdp || ''),
		candidateText,
		String(payload.sdpMid || ''),
		String(payload.sdpMLineIndex || ''),
	].join('|')
	pushDebug('[WS] call.signal', {
		type: payload.signalType || payload.type,
		normalizedType,
		from: payload.from,
		to: payload.to,
		sdpLength:
			typeof payload.sdp === 'string'
				? payload.sdp.length
				: String(
						(payload as Record<string, unknown>).offer ||
							(payload as Record<string, unknown>).answer ||
							'',
					).length || 0,
	})
	if (!rtcStarted || !rtcReady) {
		queuedSignals.push(payload)
		pushDebug('[RTC] queue signal', {
			signalType: normalizedType,
			rtcStarted,
			rtcReady,
		})
		if (role.value === 'callee') {
			void startRtcIfNeeded()
		}
		return
	}
	if (normalizedType === 'ICE_CANDIDATE') {
		if (handledSignalKeys.includes(signalKey)) return
		handledSignalKeys.push(signalKey)
		if (handledSignalKeys.length > 300) {
			handledSignalKeys.splice(0, handledSignalKeys.length - 300)
		}
	}
	void rtcClient.handleSignal(mapSignal(payload))
}

const bindCallWs = async (): Promise<void> => {
	const token = await tokenManager.getValidAccessToken()
	if (!token) return
	pushDebug('[WS] bind')
	privateChatWs.connect(token, {
		onCallAnswered: handleCallAnswered,
		onCallEnded: handleCallEnded,
		onCallSignal: handleCallSignal,
		onConnected: () => {
			pushDebug('[WS] connected')
		},
		onDisconnected: () => {
			pushDebug('[WS] disconnected')
		},
		onError: (payload) => {
			pushDebug('[WS] error', payload)
		},
	})
}

const toggleCamera = (): void => {
	const nextEnabled = !cameraEnabled.value
	cameraEnabled.value = nextEnabled
	rtcClient.setCameraEnabled(nextEnabled)
	pushDebug('[UI] toggle camera', nextEnabled)
}

const toggleSpeaker = (): void => {
	speakerMuted.value = !speakerMuted.value
	void ensureRemotePlayback()
	pushDebug('[UI] toggle speaker', { muted: speakerMuted.value })
}

const hangup = async (): Promise<void> => {
	if (phase.value === 'ended') {
		window.api.closeWindow()
		return
	}
	try {
		if (!callId.value) {
			window.api.closeWindow()
			return
		}
		if (phase.value === 'calling' && role.value === 'caller') {
			pushDebug('[API] cancel')
			await videoCallApi.cancelCall(callId.value)
		} else if (phase.value === 'calling' && role.value === 'callee') {
			pushDebug('[API] reject')
			await videoCallApi.rejectCall(callId.value)
		} else {
			pushDebug('[API] end')
			await videoCallApi.endCall(callId.value)
		}
		sendCallSummaryIfNeeded({
			callId: callId.value,
			endedAt: new Date().toISOString(),
			endReason:
				phase.value === 'calling' && role.value === 'caller'
					? 'CANCELED'
					: 'HANGUP',
			durationSeconds: seconds.value,
		})
		closeEndReported = true
	} catch (error) {
		pushDebug('[API] hangup failed', String(error))
		message.error('挂断失败，请重试')
		return
	}
	phase.value = 'ended'
	clearTimers()
	rtcClient.dispose()
	window.api.closeWindow()
}

onMounted(async () => {
	pushDebug('[UI] mounted', {
		callId: callId.value,
		role: role.value,
		peerAccount: peerAccount.value,
		callType: callType.value,
	})
	resetPreviewPosition()
	window.addEventListener('resize', clampPreviewPositionInPlace)
	await bindCallWs()
	disposeBridgeSignal = subscribeCallSignal((payload) => {
		handleCallSignal(payload)
	})
	if (!callId.value) {
		phase.value = 'failed'
		cameraError.value = '缺少 callId，请重新发起通话'
		pushDebug('[UI] missing callId')
		return
	}
	if (role.value === 'callee') {
		void startRtcIfNeeded()
	}
	if (role.value === 'caller') {
		startCallerAnsweredPolling()
	}
	window.addEventListener('beforeunload', reportEndOnWindowClose)
	window.addEventListener('pagehide', reportEndOnWindowClose)
	window.addEventListener('pointerdown', tryUnlockAudioPlayback, true)
	window.addEventListener('keydown', tryUnlockAudioPlayback, true)
})

onBeforeUnmount(() => {
	reportEndOnWindowClose()
	window.removeEventListener('beforeunload', reportEndOnWindowClose)
	window.removeEventListener('pagehide', reportEndOnWindowClose)
	window.removeEventListener('pointerdown', tryUnlockAudioPlayback, true)
	window.removeEventListener('keydown', tryUnlockAudioPlayback, true)
	window.removeEventListener('resize', clampPreviewPositionInPlace)
	stopPreviewDrag()
	clearTimers()
	if (disposeBridgeSignal) {
		disposeBridgeSignal()
		disposeBridgeSignal = null
	}
	rtcReady = false
	rtcClient.dispose()
	pushDebug('[UI] unmounted')
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

.remote-video {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	background: #111827;
}

.outgoing-request-layer,
.remote-stage {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	background: rgba(255, 255, 255, 0.84);
}

.request-pulse,
.avatar-ring {
	width: 126px;
	height: 126px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #eef2ff;
	animation: ring 1.8s ease-out infinite;
}

.request-name,
.remote-name {
	font-size: 24px;
	font-weight: 600;
}

.request-desc,
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

.drag {
	-webkit-app-region: drag;
}

.no-drag {
	-webkit-app-region: no-drag;
}

.debug-panel {
	position: absolute;
	right: 12px;
	bottom: 12px;
	width: min(560px, calc(100vw - 24px));
	max-height: 40vh;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 10px;
	color: #e5e7eb;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	overflow: hidden;
	user-select: text;
	-webkit-user-select: text;
}

.debug-header {
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 10px;
	font-size: 11px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.debug-actions {
	display: flex;
	gap: 6px;
}

.debug-btn {
	height: 22px;
	padding: 0 8px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	background: rgba(255, 255, 255, 0.1);
	color: #e5e7eb;
	font-size: 11px;
}

.debug-body {
	max-height: calc(40vh - 32px);
	overflow: auto;
	padding: 6px 10px 8px;
	user-select: text;
	-webkit-user-select: text;
}

.debug-line {
	font-size: 11px;
	line-height: 1.45;
	word-break: break-all;
	user-select: text;
	-webkit-user-select: text;
}

.debug-ts {
	color: #93c5fd;
	margin-right: 6px;
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
</style>

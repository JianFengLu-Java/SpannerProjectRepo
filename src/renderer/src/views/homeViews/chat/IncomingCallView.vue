<template>
	<div class="incoming-root drag">
		<div class="incoming-panel no-drag">
			<div class="incoming-badge">{{ callTypeLabel }}</div>
			<n-avatar round :size="92" :src="fromAvatar" class="mt-4" />
			<div class="incoming-name">{{ fromName }}</div>
			<div class="incoming-subtitle">正在呼叫你</div>
			<div class="incoming-actions">
				<button type="button" class="reject-btn" @click="rejectCall">
					挂断
				</button>
				<button type="button" class="accept-btn" @click="acceptCall">
					接听
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAvatar, useMessage } from 'naive-ui'
import { videoCallApi } from '@renderer/services/videoCallApi'

const route = useRoute()
const message = useMessage()

const callId = computed(
	() =>
		String(
			route.query.callId ||
				route.query.call_id ||
				route.query.id ||
				route.query.sessionId ||
				route.query.session_id ||
				'',
		).trim(),
)
const fromAccount = computed(
	() =>
		String(
			route.query.fromAccount ||
				route.query.from ||
				route.query.callerAccount ||
				'',
		).trim(),
)
const fromName = computed(
	() =>
		String(route.query.fromName || route.query.callerName || '').trim() ||
		'未知联系人',
)
const fromAvatar = computed(
	() =>
		String(
			route.query.fromAvatar ||
				route.query.callerAvatar ||
				route.query.fromAvatarUrl ||
				'',
		).trim(),
)
const chatId = computed(() => {
	const raw = Number(route.query.chatId)
	return Number.isFinite(raw) ? Math.floor(raw) : undefined
})
const callType = computed(() =>
	String(route.query.type || route.query.callType || 'video')
		.trim()
		.toLowerCase() === 'audio'
		? 'audio'
		: 'video',
)
const callTypeLabel = computed(() =>
	callType.value === 'audio' ? '语音来电' : '视频来电',
)

const rejectCall = async (): Promise<void> => {
	if (callId.value) {
		try {
			await videoCallApi.rejectCall(callId.value)
		} catch (error) {
			console.warn('拒接通话失败:', error)
			message.error('挂断失败，请重试')
			return
		}
	}
	window.api.closeWindow()
}

const acceptCall = async (): Promise<void> => {
	if (!callId.value) {
		message.error('来电数据缺少 callId，无法接听')
		return
	}
	if (callId.value) {
		try {
			await videoCallApi.acceptCall(callId.value)
		} catch (error) {
			console.warn('接听通话失败:', error)
			message.error('接听失败，请稍后重试')
			return
		}
	}
	window.api.openMockVideoCallWindow({
		chatId: chatId.value || Date.now(),
		chatName: fromName.value,
		chatAvatar: fromAvatar.value,
		type: callType.value,
		callId: callId.value,
		peerAccount: fromAccount.value,
		role: 'callee',
	})
	window.api.closeWindow()
}
</script>

<style scoped>
.incoming-root {
	height: 100vh;
	width: 100vw;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f3f4f6;
}

.incoming-panel {
	width: calc(100% - 28px);
	height: calc(100% - 28px);
	border-radius: 18px;
	background: #fff;
	border: 1px solid #e5e7eb;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 18px;
}

.incoming-badge {
	font-size: 12px;
	color: #4b5563;
	padding: 3px 8px;
	border-radius: 999px;
	background: #f3f4f6;
	border: 1px solid #e5e7eb;
}

.incoming-name {
	margin-top: 12px;
	font-size: 22px;
	font-weight: 600;
	color: #111827;
}

.incoming-subtitle {
	margin-top: 6px;
	font-size: 13px;
	color: #6b7280;
}

.incoming-actions {
	display: flex;
	gap: 12px;
	margin-top: 28px;
}

.reject-btn,
.accept-btn {
	height: 40px;
	min-width: 108px;
	border-radius: 999px;
	border: none;
	font-size: 13px;
	font-weight: 600;
}

.reject-btn {
	background: #ef4444;
	color: #fff;
}

.accept-btn {
	background: #2563eb;
	color: #fff;
}

.drag {
	-webkit-app-region: drag;
}

.no-drag {
	-webkit-app-region: no-drag;
}
</style>

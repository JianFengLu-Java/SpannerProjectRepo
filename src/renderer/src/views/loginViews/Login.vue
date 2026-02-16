<template>
	<div
		class="relative h-full w-full overflow-hidden bg-linear-to-br from-grad-start via-[#eef5ff] to-[#e9f4ff] dark:via-[#121620]"
	>
		<div
			class="auth-blob absolute -left-20 -top-20 h-56 w-56 rounded-full bg-sky-300/45 blur-3xl"
		></div>
		<div
			class="auth-blob-delayed absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-indigo-300/35 blur-3xl"
		></div>

		<div
			class="relative z-10 flex h-full w-full items-center justify-center px-4 py-8"
		>
			<div
				class="auth-shell flex h-full max-h-[740px] w-full max-w-[940px] overflow-hidden rounded-[8px] border border-white/65 bg-white/82 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/80"
			>
				<div
					class="relative flex w-[42%] min-w-[320px] flex-col justify-between overflow-hidden bg-linear-to-b from-[#091226] via-[#12284f] to-[#234b8f] px-8 py-10 text-white"
				>
					<BrandParticleLayer />

					<div class="relative z-10">
						<p class="text-4xl font-black tracking-tight">LinkR</p>
						<p class="mt-3 text-sm tracking-[0.2em] text-white/75">
							连接思维 · 提高效率
						</p>
					</div>
					<div class="left-info-loop relative z-10 text-sm text-white/80">
						<div
							class="left-info-track"
							:style="{
								'--scroll-distance': `-${scrollDistance}px`,
								'--scroll-duration': `${scrollDuration}s`,
							}"
						>
							<p
								v-for="(item, index) in loopInfo"
								:key="`${item}-${index}`"
								class="left-info-item rounded-xl border border-white/10 bg-white/5 px-4 py-3"
							>
								{{ item }}
							</p>
						</div>
					</div>
					<p class="relative z-10 text-xs text-white/45">Spanner Tools Workspace</p>
				</div>

				<div class="flex flex-1 flex-col bg-page-bg px-8 py-10">
					<div
						class="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center"
					>
						<div class="mb-5">
							<p class="inline-flex items-center rounded-full bg-[#2f7fe7]/12 px-3 py-1 text-xs font-semibold tracking-wide text-[#2f7fe7]">
								Hi again
							</p>
							<h2 class="text-2xl font-bold text-text-main/90">
								欢迎回来
							</h2>
							<p class="mt-1 text-sm text-text-main/55">
								登录你的账号以继续使用
							</p>
						</div>

						<n-tabs
							v-model:value="loginType"
							type="segment"
							size="small"
							animated
							class="px-4"
						>
							<n-tab-pane name="account" tab="账号登录">
								<div class="space-y-3 pt-1">
									<n-input
										v-model:value="userName"
										placeholder="请输入用户名"
										size="large"
										clearable
										@keyup.enter="handleLogin"
									/>
									<n-input
										v-model:value="password"
										type="password"
										placeholder="请输入密码"
										size="large"
										clearable
										@keyup.enter="handleLogin"
									/>
								</div>

								<div
									class="mt-4 flex items-center justify-between px-1"
								>
									<n-checkbox size="large">记住我</n-checkbox>
									<a
										class="text-sm text-text-main/60 hover:text-[#3695ff] cursor-pointer"
									>
										忘记密码？
									</a>
								</div>

								<div class="gap-4 mt-6 flex flex-col">
									<n-button
										type="primary"
										size="large"
										block
										:loading="isLoading"
										@click="handleLogin"
										class="font-bold login-primary-btn"
									>
										登录
									</n-button>
									<n-button
										size="large"
										block
										quaternary
										class="mt-4 login-secondary-btn"
										@click="handleRegister"
									>
										创建新账号
									</n-button>
								</div>
							</n-tab-pane>

							<n-tab-pane name="qr" tab="扫码登录">
								<div
									class="flex h-full flex-col items-center justify-center gap-4 pt-3"
								>
									<div
										class="overflow-hidden rounded-[14px] border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
									>
										<div class="p-3 pb-2">
											<n-qr-code
												:value="qrValue"
												:size="156"
												class="p-0!"
											/>
										</div>
										<div
											class="border-b w-full border-gray-200 dark:border-zinc-700"
										></div>
										<div
											class="h-8 w-full bg-slate-800 flex items-center justify-center"
										>
											<p
												class="text-xs font-semibold tracking-wide text-white/95"
											>
												请使用手机 App 扫码登录
											</p>
										</div>
									</div>

									<n-button
										text
										type="primary"
										size="small"
										class="login-text-primary-btn"
										@click="refreshQr"
									>
										刷新二维码
										<template #icon>
											<n-icon>
												<refresh-sharp />
											</n-icon>
										</template>
									</n-button>
								</div>
							</n-tab-pane>
						</n-tabs>
					</div>

					<p
						class="mt-4 text-center text-xs text-text-main/40 select-none"
					>
						© {{ currentYear }} LinkR. All rights reserved.
					</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	NButton,
	NInput,
	NCheckbox,
	NTabs,
	NTabPane,
	NQrCode,
	useMessage,
} from 'naive-ui'
import { ref, nextTick, watch, onUnmounted } from 'vue'
import { RefreshSharp } from '@vicons/ionicons5'
import { useTitleStore } from '@renderer/stores/title'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import request from '@renderer/utils/request'
import { tokenManager } from '@renderer/services/tokenManager'
import axios from 'axios'
import BrandParticleLayer from '@renderer/components/BrandParticleLayer.vue'

const titleStore = useTitleStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()
const currentYear = new Date().getFullYear()
const baseInfo = [
	'多端同步会话与工作记录，保持上下文连续。',
	'账号登录与扫码登录并行，切换更流畅。',
	'统一工作台入口，快速恢复上次进度。',
	'企业通讯录与项目对话快速聚合，查找更直接。',
	'消息、成员、资料一体化管理，减少切换成本。',
	'面向高频协作场景优化，响应更稳定更轻量。',
]
const loopInfo = [...baseInfo, ...baseInfo]
const itemStride = 72
const scrollDistance = itemStride * baseInfo.length
const scrollDuration = baseInfo.length * 4

titleStore.setTitle('Spanner Tools')

/* Tabs */
const loginType = ref<'account' | 'qr'>('account')

/* 表单 */
const userName = ref('')
const password = ref('')
const isLoading = ref(false)

/* 二维码 */
const qrValue = ref('')
let pollTimer: number | null = null
const QR_API = {
	CREATE: `${import.meta.env.VITE_API_URL}/login/qr/create`,
	STATUS: `${import.meta.env.VITE_API_URL}/login/qr/status`,
}

function handleLogin(): void {
	if (!userName.value || !password.value) {
		message.error('用户名或密码不能为空')
		return
	}

	isLoading.value = true
	request
		.post('/user/login', {
			account: userName.value,
			password: password.value,
		})
		.then(async (response) => {
			if (response.status) {
				message.success('登录成功')
				userInfoStore.setUserInfo(
					response.data.data,
					response.data.token,
				)
				tokenManager.setTokenBundle({
					token: response.data.token,
					refreshToken: response.data.refreshToken,
					accessTokenExpiresIn: response.data.accessTokenExpiresIn,
				})
				await nextTick()
				window.electron.ipcRenderer.send('login-success-open-home')
			} else {
				message.error('登录失败')
			}
		})
		.catch(() => {
			message.error('登录失败，请检查用户名和密码')
		})
		.finally(() => {
			isLoading.value = false
		})
}

/* 扫码登录 */
function generateQr() {
	const uuid = crypto.randomUUID()
	qrValue.value = `spanner-login:${uuid}`

	axios.post(QR_API.CREATE, {
		uuid,
	})

	startPolling(uuid)
}

function startPolling(uuid: string) {
	stopPolling()
	pollTimer = window.setInterval(async () => {
		const { data } = await axios.get(`${QR_API.STATUS}/${uuid}`)

		if (data.status === 'confirmed') {
			message.success('扫码成功')
			stopPolling()
			window.electron.ipcRenderer.send('login-success-open-home')
		}
	}, 2000)
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}

function refreshQr() {
	generateQr()
}

/* 切换到扫码页自动生成 */
watch(loginType, (val) => {
	if (val === 'qr') {
		generateQr()
	} else {
		stopPolling()
	}
})

onUnmounted(stopPolling)

function handleRegister(): void {
	window.electron.ipcRenderer.send('open-register-window')
}
</script>

<style scoped>
.auth-shell {
	animation: auth-fade-up 0.45s ease-out;
}

.auth-blob {
	animation: blob-float 9s ease-in-out infinite;
}

.auth-blob-delayed {
	animation: blob-float 10s ease-in-out infinite reverse;
}

.left-info-loop {
	height: 156px;
	overflow: hidden;
	-webkit-mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		#000 22%,
		#000 78%,
		transparent 100%
	);
	mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		#000 22%,
		#000 78%,
		transparent 100%
	);
}

.left-info-track {
	display: flex;
	flex-direction: column;
	gap: 12px;
	animation: info-scroll-up var(--scroll-duration) linear infinite;
	will-change: transform;
}

.left-info-item {
	min-height: 60px;
	display: flex;
	align-items: center;
	line-height: 1.55;
}

@keyframes info-scroll-up {
	0% {
		transform: translateY(0);
	}
	100% {
		transform: translateY(var(--scroll-distance));
	}
}

:deep(.login-primary-btn.n-button--primary-type) {
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
	border: none;
	border-radius: 12px;
	transition: transform 0.2s ease;
}

:deep(.login-primary-btn.n-button--primary-type:hover) {
	background: linear-gradient(180deg, #4aa2ff 0%, #2f7fe7 100%);
	transform: translateY(-1px);
}

:deep(.login-primary-btn.n-button--primary-type:active) {
	background: linear-gradient(180deg, #2f88f0 0%, #266fd3 100%);
}

:deep(.login-text-primary-btn.n-button) {
	color: #2f7fe7;
}

:deep(.login-text-primary-btn.n-button:hover) {
	color: #3695ff;
}

:deep(.login-secondary-btn.n-button) {
	border-radius: 12px;
	font-weight: 600;
}

:deep(.n-tabs .n-tabs-pane-wrapper) {
	overflow: visible;
}

:deep(.n-tabs .n-tab-pane) {
	padding-bottom: 8px;
}

@keyframes auth-fade-up {
	0% {
		opacity: 0;
		transform: translateY(8px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes blob-float {
	0%,
	100% {
		transform: translate3d(0, 0, 0);
	}
	50% {
		transform: translate3d(0, -10px, 0);
	}
}

</style>

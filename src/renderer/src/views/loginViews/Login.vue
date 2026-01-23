<template>
	<div
		class="flex h-screen w-screen items-center justify-center bg-linear-to-br from-grad-start to-grad-end"
	>
		<div
			class="w-[360px] border rounded-3xl shadow-xl overflow-hidden border-border-default"
		>
			<div
				class="relative w-full flex justify-center flex-col items-center h-40 overflow-hidden"
			>
				<p class="text-white font-bold text-5xl z-10 tracking-tight">
					LinkR
				</p>
				<p
					class="text-white/80 font-medium text-sm z-10 tracking-widest mt-1"
				>
					连接思维 · 提高效率
				</p>

				<div class="absolute inset-0">
					<img
						src="http://47.108.39.129:9000/pic/bg_login.jpg"
						class="w-full h-full object-cover select-none blur-lg scale-110"
					/>
					<div class="absolute inset-0 bg-black/30"></div>
				</div>
			</div>
			<!-- Logo -->

			<!-- Tabs -->
			<div class="p-8 gap-2 bg-page-bg">
				<n-tabs
					type="segment"
					size="medium"
					animated
					v-model:value="loginType"
				>
					<!-- 账号登录 -->
					<n-tab-pane name="account" tab="账号登录">
						<div class="form px-2 pt-3">
							<n-input
								v-model:value="userName"
								placeholder="用户名"
								size="large"
								clearable
								@keyup.enter="handleLogin"
							/>
							<n-input
								v-model:value="password"
								type="password"
								placeholder="密码"
								size="large"
								clearable
								@keyup.enter="handleLogin"
							/>
						</div>

						<div class="actions px-2 pt-2">
							<n-button
								type="primary"
								size="large"
								block
								:loading="isLoading"
								color="#333"
								@click="handleLogin"
							>
								登录
							</n-button>

							<n-button
								size="large"
								block
								quaternary
								@click="handleRegister"
							>
								创建新账号
							</n-button>
						</div>
					</n-tab-pane>

					<!-- 扫码登录 -->
					<n-tab-pane name="qr" tab="扫码登录">
						<div
							class="flex w-full h-full justify-center items-center flex-col gap-2 pt-2"
						>
							<div
								class="rounded-md overflow-hidden flex justify-center items-center flex-col border border-gray-200"
							>
								<div class="p-2 pb-0">
									<n-qr-code
										:value="qrValue"
										:size="141"
										class="p-0!"
									/>
								</div>
								<div
									class="border-b w-full border-gray-200"
								></div>
								<div
									class="w-full h-6 flex justify-center items-center bg-[#444]"
								>
									<p class="text-xs font-bold text-white">
										请使用手机 App 扫码登录
									</p>
								</div>
							</div>

							<n-button
								text
								type="primary"
								size="tiny"
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
				<!-- 底部 -->
				<div class="footer mt-2">
					<n-checkbox size="large">记住我</n-checkbox>
					<a class="forgot text-[15px]">忘记密码？</a>
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
import { h, ref, nextTick, VNode, watch, onUnmounted } from 'vue'
import {
	LogIn as OkIcon,
	Sparkles as RegisterIcon,
	RefreshSharp,
	RefreshCircleSharp,
} from '@vicons/ionicons5'
import { useTitleStore } from '@renderer/stores/title'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import request from '@renderer/utils/request'
import axios from 'axios'

const titleStore = useTitleStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()

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

	axios.post('http://localhost:8080/login/qr/create', {
		uuid,
	})

	startPolling(uuid)
}

function startPolling(uuid: string) {
	stopPolling()
	pollTimer = window.setInterval(async () => {
		const { data } = await axios.get(
			`http://localhost:8080/login/qr/status/${uuid}`,
		)

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

function okIcon(): VNode {
	return h(OkIcon)
}

function registerIcon(): VNode {
	return h(RegisterIcon)
}
</script>

<style scoped>
.login-root {
	height: 100vh;
	width: 100vw;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
}

.logo-wrapper {
	display: flex;
	justify-content: center;
}

.logo {
	width: 72px;
	height: 72px;
	border-radius: 50%;
}

.title {
	text-align: center;
}

.title h1 {
	font-size: 20px;
	font-weight: 600;
	color: #111827;
}

.title p {
	font-size: 13px;
	color: #6b7280;
	margin-top: 4px;
}

.form {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.actions {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 8px;
}

.footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 12px;
	color: #6b7280;
}

.forgot {
	cursor: pointer;
	color: #6b7280;
}

.forgot:hover {
	color: #10b981;
}
</style>

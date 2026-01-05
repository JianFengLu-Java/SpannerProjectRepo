<template>
	<div class="login-root">
		<div class="absolute top-3">
			<div class="rounded-full px-2 py-1 bg-gray-300/40">
				<p class="font-bold text-white">Spanner</p>
			</div>
		</div>
		<div class="login-card border border-gray-200">
			<!-- Logo -->
			<div class="logo-wrapper">
				<n-gradient-text :size="40" type="success">
					Hello
				</n-gradient-text>
			</div>

			<!-- Tabs -->
			<n-tabs
				type="segment"
				size="small"
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
							:render-icon="okIcon"
							@click="handleLogin"
							color="#333"
						>
							登录
						</n-button>

						<n-button
							size="large"
							block
							quaternary
							:render-icon="registerIcon"
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
									:size="150"
									class="p-0!"
								/>
							</div>
							<div class="border-b w-full border-gray-200"></div>
							<div
								class="w-full h-6 flex justify-center items-center bg-[#75da93]"
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
						</n-button>
					</div>
				</n-tab-pane>
			</n-tabs>

			<!-- 底部 -->
			<div class="footer">
				<n-checkbox>记住我</n-checkbox>
				<a class="forgot">忘记密码？</a>
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
import { LogIn as OkIcon, Sparkles as RegisterIcon } from '@vicons/ionicons5'
import { useTitleStore } from '../stores/title'
import { useUserInfoStore } from '../stores/userInfo'
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
	axios
		.post('http://localhost:8080/user/login', {
			username: userName.value,
			password: password.value,
		})
		.then(async (response) => {
			if (response.status) {
				message.success('登录成功')
				userInfoStore.setUserInfo(response.data.data)
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

.login-card {
	width: 360px;
	background: #fff;
	border-radius: 16px;
	padding: 28px;
	display: flex;
	flex-direction: column;
	gap: 5px;
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

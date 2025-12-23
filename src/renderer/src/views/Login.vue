<template>
	<div class="h-full w-full justify-center flex items-center">
		<!-- 登录表单主体 -->

		<div class="justify-center flex w-full h-full bg-amber-50">
			<form class="flex flex-col h-full w-full gap-3">
				<div
					class="flex flex-col h-full pt-20 p-6 items-center gap-3 bg-gray-50"
				>
					<div class="h-20 w-20 flex items-center justify-center">
						<img
							src="https://http.cat/401"
							alt="Ok Icon"
							class="aspect-square rounded-full"
							draggable="false"
						/>
					</div>
					<div class="flex flex-col gap-3 w-full">
						<n-input
							placeholder="用户名"
							class="w-full"
							clearable
							v-model:value="userName"
						/>
						<n-input
							type="password"
							placeholder="密码"
							class="w-full"
							clearable
							v-model:value="password"
						/>
					</div>
					<div class="gap-2 mt-2 flex flex-col w-full">
						<n-button
							type="primary"
							class="w-full"
							:render-icon="okIcon"
							@click="handleLogin"
							>登录</n-button
						>
						<n-button
							type="primary"
							class="w-full"
							color="#10b981"
							:render-icon="registerIcon"
							@click="handleRegister"
							>注册</n-button
						>
					</div>
					<div class="justify-between w-full flex mt-2">
						<n-checkbox>记住我</n-checkbox>
						<a class="text-sm text-gray-400" draggable="false"
							>忘记密码？</a
						>
					</div>
				</div>
			</form>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	NButton,
	NInput,
	NGradientText,
	NCheckbox,
	NImage,
	useMessage,
	c,
} from 'naive-ui'
import { h, ref, nextTick } from 'vue'
import { LogIn as OkIcon, Sparkles as RegisterIcon } from '@vicons/ionicons5'
import { useTitleStore } from '../stores/title'
import { useUserInfoStore } from '../stores/userInfo'

import axios from 'axios'
import { useRouter } from 'vue-router'

const titleStore = useTitleStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()
titleStore.setTitle('Spanner Tools')

const router = useRouter()
/**
 *
 * 声明动态值
 *
 */
const userName = ref('')
const password = ref('')
const isLoading = ref(false)

function handleLogin() {
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
			console.log(response.status)
			if (response.status) {
				message.success('登录成功')
				console.log('用户信息：', response.data)

				userInfoStore.setUserInfo({
					userName: response.data.data.userName,
					gender: response.data.data.gender,
					email: response.data.data.email,
					avatarUrl: response.data.data.avatarUrl,
				})

				console.log('用户信息存储：', userInfoStore.userName)
				await nextTick()

				window.electron.ipcRenderer.send('login-success-open-home')
			} else {
				message.error('登录失败，请检查用户名和密码')
			}
			// 处理登录成功逻辑，例如存储令牌、重定向等
		})
		.catch(() => {
			message.error('登录失败，请检查用户名和密码')
		})
		.finally(() => {
			isLoading.value = false
		})
}

function handleRegister() {
	window.electron.ipcRenderer.send('open-register-window')
}

// import Background from '../components/Background.vue';
const hello: string = 'Hello, world!'
console.log(hello)
/**
 * 登录按钮图标渲染函数
 */
function okIcon() {
	return h(OkIcon, {
		deafult: OkIcon,
	})
}

/**
 * 注册按钮图标渲染函数
 */
function registerIcon() {
	return h(RegisterIcon, {
		deafult: RegisterIcon,
	})
}
</script>

<style scoped></style>

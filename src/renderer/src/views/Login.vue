<template>
	<div class="h-full w-full justify-center flex items-center bg-gray-200">
		<!-- 登录表单主体 -->

		<div class="justify-center flex w-full h-full rounded-2xl p-1">
			<form class="flex flex-col h-full w-full gap-3">
				<div
					class="flex flex-col h-full pt-20 px-10 items-center gap-3 rounded-xl bg-white"
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
							v-model:value="userName"
							placeholder="用户名"
							class="w-full"
							clearable
						/>
						<n-input
							v-model:value="password"
							type="password"
							placeholder="密码"
							class="w-full"
							clearable
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
import { NButton, NInput, NCheckbox, useMessage } from 'naive-ui'
import { h, ref, nextTick, VNode } from 'vue'
import { LogIn as OkIcon, Sparkles as RegisterIcon } from '@vicons/ionicons5'
import { useTitleStore } from '../stores/title'
import { useUserInfoStore } from '../stores/userInfo'

import axios from 'axios'

const titleStore = useTitleStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()
titleStore.setTitle('Spanner Tools')

/**
 *
 * 声明动态值
 *
 */
const userName = ref('')
const password = ref('')
const isLoading = ref(false)

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

function handleRegister(): void {
	window.electron.ipcRenderer.send('open-register-window')
}

// import Background from '../components/Background.vue';
const hello: string = 'Hello, world!'
console.log(hello)
/**
 * 登录按钮图标渲染函数
 */
function okIcon(): VNode {
	return h(OkIcon, {
		deafult: OkIcon,
	})
}

/**
 * 注册按钮图标渲染函数
 */
function registerIcon(): VNode {
	return h(RegisterIcon, {
		deafult: RegisterIcon,
	})
}
</script>

<style scoped></style>

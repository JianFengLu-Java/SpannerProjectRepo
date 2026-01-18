<template>
	<n-result
		status="success"
		title="成功"
		:description="`你的账号是 ${prop.userInfo}`"
	>
		<template #footer>
			<n-button @click="handleLogin">返回登录</n-button>
		</template>
	</n-result>
</template>

<script lang="ts" setup>
const prop = defineProps({
	userInfo: String,
})

const handleLogin = () => {
	window.electron.ipcRenderer.send('register-success-open-loginWindow')
}
</script>

<style lang="scss" scoped></style>

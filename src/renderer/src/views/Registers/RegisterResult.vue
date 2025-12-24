<template>
	<n-result
		status="success"
		title="成功"
		:description="`你的账号是 ${prop.userInfo}`"
	>
		<template #footer>
			<n-button @click="$router.push('/login')">我喜欢</n-button>
		</template>
	</n-result>
</template>

<script lang="ts" setup>
const prop = defineProps({
	userInfo: String,
})
</script>

<style lang="scss" scoped></style>

<template>
	<div class="h-full w-full rounded-xl bg-white"></div>
</template>

<script setup lang="ts">
import { useTitleStore } from '@renderer/stores/title'

const titleStore = useTitleStore()
titleStore.setTitle('用户管理')
</script>

<style scoped></style>

<template>
	<div
		class="flex w-full mt-1"
		:class="isMe ? 'flex-row-reverse' : 'flex-row'"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0 avatar-no-select" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
		>
			<div
				class="px-3 py-2 rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit msg-content-selectable"
				:class="
					isMe
						? 'bg-[#eeeeee] text-zinc-900 '
						: 'bg-[#555555] text-white '
				"
				v-html="content"
			></div>

			<span class="text-[10px] text-gray-400 px-1 avatar-no-select">{{
				time
			}}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	content: string
	isMe: boolean
	avatar: string
	time: string
}>()
</script>
<style scoped>
/* 1. 强制气泡及其内部所有元素可选中 */
.msg-content-selectable,
.msg-content-selectable :deep(*),
.msg-content-selectable * {
	user-select: text !important;
	-webkit-user-select: text !important;
	cursor: text !important;
	/* 必须：解除 Electron 的拖拽锁定，否则无法划选 */
	-webkit-app-region: no-drag !important;
}

/* 2. 只有头像和时间保持不可选 */
.avatar-no-select {
	user-select: none !important;
	-webkit-user-select: none !important;
	-webkit-user-drag: none !important;
	/* 避免干扰气泡的选择范围 */
	pointer-events: auto !important;
}
</style>

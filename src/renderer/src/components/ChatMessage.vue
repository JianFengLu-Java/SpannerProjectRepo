<template>
	<div
		class="flex w-full mt-1"
		:class="isMe ? 'flex-row-reverse' : 'flex-row'"
	>
		<n-avatar round :src="avatar" class="mx-2 shrink-0" />

		<div
			class="flex flex-col max-w-[75%] min-w-0"
			:class="isMe ? 'items-end' : 'items-start'"
		>
			<div
				class="px-3 py-2 rounded-lg text-[14px] wrap-anywhere whitespace-pre-wrap h-fit"
				:class="
					isMe
						? 'bg-[#e3e3e3] text-zinc-900 '
						: 'bg-[#51ac5a] text-white '
				"
			>
				{{ content }}
			</div>
			<span class="text-[10px] text-gray-400 px-1">{{ time }}</span>
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

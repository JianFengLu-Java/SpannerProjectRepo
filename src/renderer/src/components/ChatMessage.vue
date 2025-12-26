<template>
	<div
		class="flex w-full mb-4"
		:class="isMe ? 'flex-row-reverse' : 'flex-row'"
	>
		<n-avatar round size="small" :src="avatar" class="mx-2 flex-shrink-0" />

		<div
			class="flex flex-col max-w-[75%]"
			:class="isMe ? 'items-end' : 'items-start'"
		>
			<div
				class="px-3 py-2 rounded-lg text-[14px] shadow-sm break-words whitespace-pre-wrap h-fit"
				:class="
					isMe
						? 'bg-[#95ec69] text-zinc-900 rounded-tr-none'
						: 'bg-white text-zinc-800 rounded-tl-none'
				"
			>
				{{ content }}
			</div>
			<span class="text-[10px] text-gray-400 mt-1 px-1">{{ time }}</span>
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

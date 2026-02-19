<template>
	<n-modal :show="show" preset="card" :title="title" class="app-modal-card max-w-[420px]" @mask-click="$emit('cancel')">
		<div class="text-sm text-gray-500">{{ content }}</div>
		<template #footer>
			<div class="flex justify-end gap-2">
				<n-button @click="$emit('cancel')">取消</n-button>
				<n-button :type="confirmType" @click="$emit('confirm')">{{ confirmText || '确认' }}</n-button>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { NButton, NModal } from 'naive-ui'

defineProps<{
	show: boolean
	title: string
	content: string
	confirmText?: string
	confirmType?: 'primary' | 'error' | 'warning' | 'success'
}>()

defineEmits<{
	(e: 'cancel'): void
	(e: 'confirm'): void
}>()
</script>

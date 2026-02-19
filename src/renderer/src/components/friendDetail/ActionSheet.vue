<template>
	<n-modal :show="show" @mask-click="$emit('close')">
		<div class="mx-auto mt-[120px] w-[360px] rounded-2xl border border-border-default/60 bg-card-bg p-2">
			<button
				v-for="item in actions"
				:key="item.key"
				type="button"
				class="w-full rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/6"
				:class="item.danger ? 'text-red-500' : 'text-text-main'"
				@click="$emit('select', item.key)"
			>
				{{ item.label }}
			</button>
		</div>
	</n-modal>
</template>

<script setup lang="ts">
import { NModal } from 'naive-ui'

export interface ActionSheetItem {
	key: string
	label: string
	danger?: boolean
}

defineProps<{
	show: boolean
	actions: ActionSheetItem[]
}>()

defineEmits<{
	(e: 'close'): void
	(e: 'select', key: string): void
}>()
</script>

<template>
	<div
		class="px-4 py-3 flex items-center justify-between gap-3 border-t border-border-default/40 first:border-t-0"
	>
		<div class="min-w-0">
			<label
				:for="switchId"
				class="text-sm text-text-main font-medium cursor-pointer"
			>
				{{ label }}
			</label>
			<p v-if="description" class="mt-1 text-xs text-gray-400">
				{{ description }}
			</p>
		</div>
		<n-switch
			:id="switchId"
			:value="modelValue"
			:disabled="disabled"
			:aria-label="label"
			@update:value="(val: boolean) => $emit('update:modelValue', val)"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSwitch } from 'naive-ui'

const props = defineProps<{
	label: string
	description?: string
	modelValue: boolean
	disabled?: boolean
}>()

defineEmits<{
	(e: 'update:modelValue', value: boolean): void
}>()

const switchId = computed(() => `switch-${props.label.replace(/\s+/g, '-')}`)
</script>

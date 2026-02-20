<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'

const props = withDefaults(
	defineProps<{
		label?: string
		active?: boolean
		disabled?: boolean
	}>(),
	{
		label: '',
		active: false,
		disabled: false,
	},
)

const emit = defineEmits<{
	(e: 'click'): void
}>()

const buttonType = computed(() => (props.active ? 'primary' : 'default'))
</script>

<template>
	<n-button
		quaternary
		size="small"
		:type="buttonType"
		:disabled="disabled"
		@click="emit('click')"
	>
		<slot>
			{{ label }}
		</slot>
	</n-button>
</template>

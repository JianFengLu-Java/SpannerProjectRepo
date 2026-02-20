<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NInput, NPopover, NSpace } from 'naive-ui'

const props = withDefaults(
	defineProps<{
		value?: string
		disabled?: boolean
	}>(),
	{
		value: '',
		disabled: false,
	},
)

const emit = defineEmits<{
	(e: 'apply', value: string): void
	(e: 'clear'): void
}>()

const show = ref(false)
const linkValue = ref(props.value)

watch(
	() => props.value,
	(value) => {
		if (!show.value) linkValue.value = value || ''
	},
)

const open = (): void => {
	linkValue.value = props.value || ''
	show.value = true
}

const close = (): void => {
	show.value = false
}

const apply = (): void => {
	emit('apply', linkValue.value)
	show.value = false
}

const clear = (): void => {
	emit('clear')
	show.value = false
}
</script>

<template>
	<n-popover
		v-model:show="show"
		trigger="manual"
		placement="bottom"
		:show-arrow="false"
	>
		<template #trigger>
			<n-button quaternary size="small" :disabled="disabled" @click="open">
				链接
			</n-button>
		</template>
		<div class="link-popover-panel">
			<n-input v-model:value="linkValue" placeholder="https://example.com" size="small" />
			<n-space class="mt-2" justify="end">
				<n-button size="tiny" quaternary @click="clear">清除</n-button>
				<n-button size="tiny" type="primary" @click="apply">应用</n-button>
				<n-button size="tiny" quaternary @click="close">取消</n-button>
			</n-space>
		</div>
	</n-popover>
</template>

<style scoped>
.link-popover-panel {
	width: 240px;
}
</style>

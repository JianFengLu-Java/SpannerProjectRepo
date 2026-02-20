<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import {
	Add24Regular,
	ReOrderDotsVertical24Regular,
} from '@vicons/fluent'

const props = withDefaults(
	defineProps<{
		visible?: boolean
		blockId?: string
		x?: number
		y?: number
	}>(),
	{
		visible: false,
		blockId: '',
		x: 0,
		y: 0,
	},
)

const emit = defineEmits<{
	(e: 'drag-start', payload: { blockId: string; clientX: number; clientY: number }): void
	(e: 'add'): void
	(e: 'hover-enter'): void
	(e: 'hover-leave'): void
}>()

// Use dragstart event for HTML5 drag-and-drop
const onDragStart = (event: DragEvent): void => {
	if (!props.blockId) return
	// Set dataTransfer for the drag operation
	event.dataTransfer?.setData('application/x-block-id', props.blockId)
	event.dataTransfer?.setData('text/plain', `__block__:${props.blockId}`)
	event.dataTransfer?.setData(`application/x-spanner-block-id-${props.blockId}`, '')
	event.dataTransfer!.effectAllowed = 'move'
	// Emit coordinates for handle positioning
	emit('drag-start', {
		blockId: props.blockId,
		clientX: event.clientX,
		clientY: event.clientY,
	})
}
</script>

<template>
	<div
		class="block-handle"
		:class="{ 'block-handle-visible': props.visible && props.blockId }"
		:style="{ top: `${props.y}px`, left: `${props.x}px` }"
		@mouseenter="emit('hover-enter')"
		@mouseleave="emit('hover-leave')"
	>
		<div class="block-rail">
			<n-button size="tiny" quaternary class="rail-btn" @click="emit('add')">
				<template #icon>
					<n-icon size="14"><Add24Regular /></n-icon>
				</template>
			</n-button>
			<div
				class="block-dragger rail-btn"
				draggable="true"
				@dragstart="onDragStart"
			>
				<n-icon size="14"><ReOrderDotsVertical24Regular /></n-icon>
			</div>
		</div>
	</div>
</template>

<style scoped>
.block-handle {
	position: absolute;
	z-index: 120;
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 2px;
	opacity: 0;
	pointer-events: none;
	transform: translateX(2px);
	transition: opacity 0.12s ease, transform 0.12s ease;
}

.block-handle-visible {
	opacity: 1;
	pointer-events: auto;
	transform: translateX(0);
}

.block-rail {
	display: flex;
	align-items: center;
	gap: 2px;
}

.rail-btn {
	width: 22px;
	height: 22px;
	padding: 0;
}

.block-dragger {
	user-select: none;
	cursor: grab;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6px;
	color: color-mix(in srgb, var(--color-text-main) 52%, transparent);
}

.block-dragger:hover {
	background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.block-dragger:active {
	cursor: grabbing;
}
</style>

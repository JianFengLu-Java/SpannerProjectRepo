<script setup lang="ts">
import { EditorContent, type Editor } from '@tiptap/vue-3'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface BlockHoverPayload {
	blockId: string
	x: number
	y: number
}

interface BlockDropPayload {
	sourceBlockId: string
	targetBlockId: string
	before: boolean
}

interface TopLevelBlock {
	element: HTMLElement
	blockId: string
	top: number
	bottom: number
	height: number
}

const props = defineProps<{
	editor: Editor | null | undefined
	draggingBlockId: string
	draggingPointer: { x: number; y: number } | null
}>()

const emit = defineEmits<{
	(e: 'hover-block', payload: BlockHoverPayload): void
	(e: 'leave-block'): void
	(e: 'drop-block', payload: BlockDropPayload): void
	(e: 'drag-end'): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)

const dropIndicatorVisible = ref(false)
const dropIndicatorY = ref(0)
const currentDropTarget = ref<{ targetBlockId: string; before: boolean } | null>(null)

const dragPreviewVisible = ref(false)
const dragPreviewX = ref(0)
const dragPreviewY = ref(0)
const dragPreviewText = ref('')

const activeDragSourceId = ref('')
let sourceDragElement: HTMLElement | null = null

let hoverFrame = 0
let lastHoverId = ''
let lastHoverX = -1
let lastHoverY = -1

const getContentRoot = (): HTMLElement | null =>
	wrapperRef.value?.querySelector<HTMLElement>('.structured-editor-content') || null

const normalizeTargetElement = (target: EventTarget | null): HTMLElement | null => {
	if (target instanceof HTMLElement) return target
	if (target instanceof Node) return target.parentElement
	return null
}

const isInsideCanvas = (clientX: number, clientY: number): boolean => {
	const rect = wrapperRef.value?.getBoundingClientRect()
	if (!rect) return false
	return (
		clientX >= rect.left &&
		clientX <= rect.right &&
		clientY >= rect.top &&
		clientY <= rect.bottom
	)
}

const collectBlocks = (): TopLevelBlock[] => {
	const root = getContentRoot()
	if (!root) return []
	const blocks: TopLevelBlock[] = []
	for (const child of Array.from(root.children) as HTMLElement[]) {
		const blockId = String(child.getAttribute('data-block-id') || '')
		if (!blockId) continue
		const rect = child.getBoundingClientRect()
		blocks.push({
			element: child,
			blockId,
			top: rect.top,
			bottom: rect.bottom,
			height: Math.max(1, rect.height),
		})
	}
	return blocks
}

const getTopLevelFromTarget = (target: EventTarget | null): TopLevelBlock | null => {
	const root = getContentRoot()
	if (!root) return null
	const normalized = normalizeTargetElement(target)
	if (!normalized) return null
	let node: HTMLElement | null = normalized
	while (node && node !== root) {
		if (node.parentElement === root) {
			const blockId = String(node.getAttribute('data-block-id') || '')
			if (!blockId) return null
			const rect = node.getBoundingClientRect()
			return {
				element: node,
				blockId,
				top: rect.top,
				bottom: rect.bottom,
				height: Math.max(1, rect.height),
			}
		}
		node = node.parentElement
	}
	return null
}

const resetHoverState = (): void => {
	lastHoverId = ''
	lastHoverX = -1
	lastHoverY = -1
}

const clearSourceHidden = (): void => {
	if (!sourceDragElement) return
	sourceDragElement.classList.remove('drag-source-hidden')
	sourceDragElement = null
}

const hideSourceBlock = (sourceId: string): void => {
	clearSourceHidden()
	if (!sourceId) return
	const blocks = collectBlocks()
	const source = blocks.find((item) => item.blockId === sourceId)
	if (!source) return
	source.element.classList.add('drag-source-hidden')
	sourceDragElement = source.element
	const text = source.element.innerText?.trim() || ''
	dragPreviewText.value = text.slice(0, 90) || '块元素'
}

const clearDragVisualState = (): void => {
	dropIndicatorVisible.value = false
	currentDropTarget.value = null
	dragPreviewVisible.value = false
	dragPreviewText.value = ''
	clearSourceHidden()
}

const updateHover = (target: EventTarget | null): void => {
	const block = getTopLevelFromTarget(target)
	if (!block) {
		resetHoverState()
		emit('leave-block')
		return
	}
	const wrapperRect = wrapperRef.value?.getBoundingClientRect()
	const canvas = wrapperRef.value?.closest('.editor-canvas') as HTMLElement | null
	const canvasRect = canvas?.getBoundingClientRect()
	const scrollTop = canvas?.scrollTop || 0
	const scrollLeft = canvas?.scrollLeft || 0
	const contentRect = getContentRoot()?.getBoundingClientRect()
	const contentLeft = contentRect
		? contentRect.left - (canvasRect?.left || wrapperRect?.left || 0) + scrollLeft
		: block.top
	const x = Math.max(10, contentLeft - 20)
	const y = block.top - (canvasRect?.top || wrapperRect?.top || 0) + scrollTop + 2
	const stableX = Math.round(x)
	const stableY = Math.round(y)
	if (
		lastHoverId === block.blockId &&
		lastHoverX === stableX &&
		Math.abs(lastHoverY - stableY) <= 1
	) {
		return
	}
	lastHoverId = block.blockId
	lastHoverX = stableX
	lastHoverY = stableY
	emit('hover-block', {
		blockId: block.blockId,
		x: stableX,
		y: stableY,
	})
}

const resolveDropTarget = (clientY: number): { targetBlockId: string; before: boolean; lineY: number } | null => {
	const sourceId = activeDragSourceId.value
	if (!sourceId) return null
	const blocks = collectBlocks().filter((item) => item.blockId !== sourceId)
	if (!blocks.length) return null

	let chosen = blocks[blocks.length - 1]
	let before = false
	for (const block of blocks) {
		const mid = block.top + block.height / 2
		if (clientY <= mid) {
			chosen = block
			before = true
			break
		}
		chosen = block
		before = false
	}

	return {
		targetBlockId: chosen.blockId,
		before,
		lineY: before ? chosen.top : chosen.bottom,
	}
}

const updateDragByPoint = (clientX: number, clientY: number): void => {
	if (!activeDragSourceId.value) return
	dragPreviewVisible.value = true
	dragPreviewX.value = clientX + 16
	dragPreviewY.value = clientY + 18

	if (!isInsideCanvas(clientX, clientY)) {
		dropIndicatorVisible.value = false
		currentDropTarget.value = null
		return
	}

	const target = resolveDropTarget(clientY)
	if (!target) {
		dropIndicatorVisible.value = false
		currentDropTarget.value = null
		return
	}

	const wrapperRect = wrapperRef.value?.getBoundingClientRect()
	const canvas = wrapperRef.value?.closest('.editor-canvas') as HTMLElement | null
	const scrollTop = canvas?.scrollTop || 0
	currentDropTarget.value = {
		targetBlockId: target.targetBlockId,
		before: target.before,
	}
	dropIndicatorY.value = target.lineY - (wrapperRect?.top || 0) + scrollTop
	dropIndicatorVisible.value = true
}

const commitDrop = (): void => {
	const sourceId = activeDragSourceId.value
	const target = currentDropTarget.value
	if (!sourceId || !target || sourceId === target.targetBlockId) return
	emit('drop-block', {
		sourceBlockId: sourceId,
		targetBlockId: target.targetBlockId,
		before: target.before,
	})
}

const handleMouseMove = (event: MouseEvent): void => {
	if (hoverFrame) cancelAnimationFrame(hoverFrame)
	hoverFrame = requestAnimationFrame(() => {
		const pointTarget =
			document.elementFromPoint(event.clientX, event.clientY) || event.target
		updateHover(pointTarget)
	})
}

const handleMouseLeave = (): void => {
	resetHoverState()
	emit('leave-block')
}

const handleGlobalMouseMove = (event: MouseEvent): void => {
	if (!activeDragSourceId.value) return
	if (event.buttons === 0) {
		commitDrop()
		activeDragSourceId.value = ''
		clearDragVisualState()
		emit('drag-end')
		return
	}
	event.preventDefault()
	updateDragByPoint(event.clientX, event.clientY)
}

const handleGlobalMouseUp = (event: MouseEvent): void => {
	if (!activeDragSourceId.value) return
	event.preventDefault()
	updateDragByPoint(event.clientX, event.clientY)
	commitDrop()
	activeDragSourceId.value = ''
	clearDragVisualState()
	emit('drag-end')
}

watch(
	() => props.draggingBlockId,
	(value) => {
		if (!value) {
			activeDragSourceId.value = ''
			clearDragVisualState()
			return
		}
		activeDragSourceId.value = value
		hideSourceBlock(value)
		// 起手兜底：如果句柄来源不准，用鼠标点位命中校正 source block
		if (!sourceDragElement && props.draggingPointer) {
			const pointTarget = document.elementFromPoint(
				props.draggingPointer.x,
				props.draggingPointer.y,
			)
			const pointBlock = getTopLevelFromTarget(pointTarget)
			if (pointBlock?.blockId) {
				activeDragSourceId.value = pointBlock.blockId
				hideSourceBlock(pointBlock.blockId)
			}
		}
		if (props.draggingPointer) {
			dragPreviewVisible.value = true
			dragPreviewX.value = props.draggingPointer.x + 16
			dragPreviewY.value = props.draggingPointer.y + 18
		}
	},
)

onMounted(() => {
	const wrapper = wrapperRef.value
	if (!wrapper) return
	wrapper.addEventListener('mousemove', handleMouseMove)
	wrapper.addEventListener('mouseleave', handleMouseLeave)
	document.addEventListener('mousemove', handleGlobalMouseMove, true)
	document.addEventListener('mouseup', handleGlobalMouseUp, true)
})

onBeforeUnmount(() => {
	if (hoverFrame) {
		cancelAnimationFrame(hoverFrame)
		hoverFrame = 0
	}
	clearDragVisualState()
	const wrapper = wrapperRef.value
	if (wrapper) {
		wrapper.removeEventListener('mousemove', handleMouseMove)
		wrapper.removeEventListener('mouseleave', handleMouseLeave)
	}
	document.removeEventListener('mousemove', handleGlobalMouseMove, true)
	document.removeEventListener('mouseup', handleGlobalMouseUp, true)
})
</script>

<template>
	<div ref="wrapperRef" class="block-renderer-root">
		<EditorContent :editor="props.editor || undefined" />

		<div
			v-if="dropIndicatorVisible"
			class="drop-indicator"
			:style="{ top: `${dropIndicatorY}px` }"
		/>

		<div
			v-if="dragPreviewVisible && activeDragSourceId"
			class="drag-preview"
			:style="{ left: `${dragPreviewX}px`, top: `${dragPreviewY}px` }"
		>
			<div class="drag-preview-dot">⋮⋮</div>
			<div class="drag-preview-text">{{ dragPreviewText }}</div>
		</div>
	</div>
</template>

<style scoped>
.block-renderer-root {
	position: relative;
	height: 100%;
	min-height: 0;
}

.drop-indicator {
	position: absolute;
	left: 22px;
	right: 22px;
	height: 3px;
	border-radius: 999px;
	background: #2f7cff;
	box-shadow: 0 0 0 1px rgba(47, 124, 255, 0.12);
	pointer-events: none;
	z-index: 140;
}

.drag-preview {
	position: fixed;
	z-index: 2600;
	pointer-events: none;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	max-width: 360px;
	padding: 6px 10px;
	border: 1px solid #d9d9d9;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.78);
	backdrop-filter: blur(4px);
	color: #2f3437;
}

.drag-preview-dot {
	color: #8a8f98;
	font-size: 12px;
	line-height: 1;
}

.drag-preview-text {
	font-size: 12px;
	line-height: 1.3;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.block-renderer-root :deep(.drag-source-hidden) {
	display: none !important;
}
</style>

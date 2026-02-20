<script setup lang="ts">
export interface SlashMenuItem {
	key: string
	label: string
	desc: string
}

const props = withDefaults(
	defineProps<{
		visible?: boolean
		top?: number
		left?: number
		items?: SlashMenuItem[]
		activeIndex?: number
	}>(),
	{
		visible: false,
		top: 0,
		left: 0,
		items: () => [],
		activeIndex: 0,
	},
)

const emit = defineEmits<{
	(e: 'select', index: number): void
}>()
</script>

<template>
	<div
		v-if="props.visible"
		class="slash-menu"
		:style="{ top: `${props.top}px`, left: `${props.left}px` }"
	>
		<div
			v-for="(item, index) in props.items"
			:key="item.key"
			class="slash-item"
			:class="{ 'slash-item-active': index === props.activeIndex }"
			@mousedown.prevent="emit('select', index)"
		>
			<div class="slash-item-title">{{ item.label }}</div>
			<div class="slash-item-desc">{{ item.desc }}</div>
		</div>
		<div v-if="props.items.length === 0" class="slash-empty">没有匹配命令</div>
	</div>
</template>

<style scoped>
.slash-menu {
	position: fixed;
	z-index: 1900;
	width: 260px;
	max-height: 320px;
	overflow: auto;
	padding: 6px;
	border-radius: 8px;
	border: 1px solid var(--color-border-default);
	background: var(--color-card-bg);
}

.slash-item {
	padding: 8px;
	border-radius: 6px;
	cursor: pointer;
}

.slash-item:hover,
.slash-item-active {
	background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.slash-item-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-main);
}

.slash-item-desc,
.slash-empty {
	font-size: 11px;
	color: color-mix(in srgb, var(--color-text-main) 68%, transparent);
}

.slash-empty {
	padding: 10px;
	text-align: center;
}
</style>

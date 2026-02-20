<script setup lang="ts">
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'

export interface SlashCommandItem {
	key: string
	label: string
	desc: string
	group?: string
	icon?: Component
}

const props = withDefaults(
	defineProps<{
		visible?: boolean
		x?: number
		y?: number
		items?: SlashCommandItem[]
		activeIndex?: number
	}>(),
	{
		visible: false,
		x: 0,
		y: 0,
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
		:style="{ top: `${props.y}px`, left: `${props.x}px` }"
	>
		<div class="slash-filter-chip">输入以过滤命令</div>
		<div
			v-for="(item, index) in props.items"
			:key="item.key"
			class="slash-item"
			:class="{ 'slash-item-active': index === props.activeIndex }"
			@mousedown.prevent="emit('select', index)"
		>
			<div class="slash-item-leading">
				<div class="slash-item-icon-wrap">
					<n-icon v-if="item.icon" size="15"><component :is="item.icon" /></n-icon>
					<span v-else class="slash-item-fallback">/</span>
				</div>
			</div>
			<div class="slash-item-main">
				<div class="slash-item-head">
					<div class="slash-item-label">{{ item.label }}</div>
					<div v-if="item.group" class="slash-item-group">{{ item.group }}</div>
				</div>
				<div class="slash-item-desc">{{ item.desc }}</div>
			</div>
			<div class="slash-item-shortcut">↵</div>
		</div>
		<div v-if="props.items.length === 0" class="slash-empty">没有匹配命令</div>
	</div>
</template>

<style scoped>
.slash-menu {
	position: fixed;
	z-index: 1900;
	width: 320px;
	max-height: 360px;
	overflow-y: auto;
	padding: 8px;
	border: 1px solid rgba(0, 0, 0, 0.08);
	border-radius: 12px;
	background: #ffffff;
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
	font-family:
		-apple-system,
		BlinkMacSystemFont,
		'Segoe UI',
		Roboto,
		'Helvetica Neue',
		Arial,
		sans-serif;
}

.slash-filter-chip {
	display: flex;
	align-items: center;
	height: 28px;
	padding: 0 10px;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.04);
	color: #888;
	font-size: 12px;
	margin-bottom: 8px;
	font-weight: 500;
}

.slash-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 10px;
	border-radius: 8px;
	cursor: pointer;
	transition: background-color 0.1s ease;
	margin-bottom: 2px;
}

.slash-item:hover,
.slash-item-active {
	background: rgba(0, 0, 0, 0.05);
}

.slash-item-leading {
	width: 36px;
	display: flex;
	justify-content: center;
	align-items: center;
}

.slash-item-icon-wrap {
	width: 36px;
	height: 36px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 1px solid rgba(0, 0, 0, 0.06);
	border-radius: 8px;
	color: #555;
	background: #ffffff;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.slash-item-fallback {
	font-size: 14px;
	line-height: 1;
	color: #999;
}

.slash-item-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 2px;
}

.slash-item-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.slash-item-label {
	font-size: 14px;
	font-weight: 600;
	color: #333;
}

.slash-item-group {
	font-size: 10px;
	line-height: 1;
	padding: 3px 6px;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.06);
	color: #666;
	font-weight: 500;
}

.slash-item-desc {
	font-size: 12px;
	color: #888;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.slash-item-shortcut {
	display: none; /* Simplify UI */
}

.slash-empty {
	padding: 24px 16px;
	text-align: center;
	color: #999;
	font-size: 13px;
}
</style>

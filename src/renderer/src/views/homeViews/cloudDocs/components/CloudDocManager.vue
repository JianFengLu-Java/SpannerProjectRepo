<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NIcon, NScrollbar, NTag, NText, NTooltip } from 'naive-ui'
import { Add, TrashOutline, DocumentTextOutline } from '@vicons/ionicons5'
import type { CloudDoc } from '@renderer/types/cloudDoc'

const props = defineProps<{
	docs: CloudDoc[]
	activeDocId: string | null
	loading?: boolean
}>()

const emit = defineEmits<{
	(e: 'create'): void
	(e: 'select', docId: string): void
	(e: 'delete', docId: string): void
}>()

const empty = computed(() => props.docs.length === 0)

const formatTime = (time: string): string => {
	if (!time) return '--'
	const date = new Date(time)
	if (Number.isNaN(date.getTime())) return '--'
	return date.toLocaleString('zh-CN', {
		hour12: false,
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}
</script>

<template>
	<div class="doc-manager-root">
		<div class="doc-manager-header">
			<div class="doc-manager-heading">
				<div class="doc-manager-title">文档列表</div>
				<div class="doc-manager-subtitle">
					共 {{ props.docs.length }} 篇文档
				</div>
			</div>
			<n-button
				type="primary"
				size="small"
				:disabled="props.loading"
				@click="emit('create')"
			>
				<template #icon>
					<n-icon><Add /></n-icon>
				</template>
				新建
			</n-button>
		</div>

		<div v-if="props.loading" class="doc-manager-empty">
			<n-text depth="3">加载文档中...</n-text>
		</div>

		<div v-else-if="empty" class="doc-manager-empty">
			<n-icon size="24"><DocumentTextOutline /></n-icon>
			<n-text depth="3">还没有云文档</n-text>
			<n-button quaternary type="primary" @click="emit('create')"
				>创建第一篇文档</n-button
			>
		</div>

		<n-scrollbar v-else class="doc-manager-scroll">
			<div class="doc-list">
				<div
					v-for="item in docs"
					:key="item.id"
					class="doc-item"
					:class="{ 'doc-item-active': item.id === activeDocId }"
					@click="emit('select', item.id)"
				>
					<div class="doc-item-top">
						<n-tag
							size="small"
							:bordered="false"
							class="doc-item-tag"
							>Doc</n-tag
						>
						<n-tooltip trigger="hover" placement="top">
							<template #trigger>
								<n-button
									quaternary
									type="error"
									size="tiny"
									@click.stop="emit('delete', item.id)"
								>
									<template #icon>
										<n-icon><TrashOutline /></n-icon>
									</template>
								</n-button>
							</template>
							删除
						</n-tooltip>
					</div>
					<div class="doc-item-title">
						{{ item.title || '未标题云文档' }}
					</div>
					<div class="doc-item-time">
						更新于 {{ formatTime(item.updatedAt) }}
					</div>
				</div>
			</div>
		</n-scrollbar>
	</div>
</template>

<style scoped>
.doc-manager-root {
	height: 100%;
	display: flex;
	flex-direction: column;
	border-radius: 10px;
	border: 1px solid
		color-mix(in srgb, var(--color-border-default) 74%, #bed6ff);
	background: linear-gradient(
		165deg,
		color-mix(in srgb, var(--color-card-bg) 96%, #ffffff),
		color-mix(in srgb, var(--color-card-bg) 88%, #ecf4ff)
	);
}

.doc-manager-heading {
	min-width: 0;
}

.doc-manager-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 10px 12px;
	border-bottom: 1px solid
		color-mix(in srgb, var(--color-border-default) 82%, #c8dcfb);
}

.doc-manager-title {
	font-size: 15px;
	font-weight: 700;
	color: var(--color-text-main);
}

.doc-manager-subtitle {
	margin-top: 2px;
	font-size: 12px;
	color: color-mix(in srgb, var(--color-text-main) 72%, transparent);
}

.doc-manager-empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
}

.doc-manager-scroll {
	flex: 1;
	min-height: 0;
}

.doc-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 6px;
}

.doc-item {
	position: relative;
	padding: 7px 9px;
	border-radius: 8px;
	border: 1px solid
		color-mix(in srgb, var(--color-border-default) 78%, #c8ddff);
	background: color-mix(in srgb, var(--color-card-bg) 92%, #ffffff);
	cursor: pointer;
	transition:
		border-color 0.16s ease,
		background 0.16s ease;
}

.doc-item:hover {
	border-color: color-mix(
		in srgb,
		var(--color-primary) 52%,
		var(--color-border-default)
	);
}

.doc-item-active {
	border-color: var(--color-primary);
	background: color-mix(
		in srgb,
		var(--color-primary) 10%,
		var(--color-card-bg)
	);
}

.doc-item-active::before {
	content: '';
	position: absolute;
	left: 0;
	top: 7px;
	bottom: 7px;
	width: 3px;
	border-radius: 999px;
	background: var(--color-primary);
}

.doc-item-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.doc-item-tag {
	background: rgba(54, 149, 255, 0.14);
	color: #225eb5;
	font-weight: 600;
}

.doc-item-title {
	margin-top: 6px;
	font-size: 13px;
	font-weight: 600;
	line-height: 1.3;
	color: var(--color-text-main);
	word-break: break-word;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.doc-item-time {
	margin-top: 6px;
	font-size: 11px;
	color: color-mix(in srgb, var(--color-text-main) 70%, transparent);
}

:global(.dark) .doc-manager-root {
	border-color: color-mix(in srgb, var(--color-border-default) 84%, #32577a);
	background: linear-gradient(
		165deg,
		rgba(33, 43, 56, 0.96),
		rgba(28, 37, 49, 0.96)
	);
}

:global(.dark) .doc-manager-header {
	border-bottom-color: color-mix(
		in srgb,
		var(--color-border-default) 84%,
		#3a5f84
	);
}

:global(.dark) .doc-item {
	border-color: color-mix(in srgb, var(--color-border-default) 88%, #486b8f);
	background: rgba(37, 47, 62, 0.88);
}

:global(.dark) .doc-item-active {
	background: color-mix(in srgb, var(--color-primary) 16%, #212d3f);
}

:global(.dark) .doc-item-tag {
	background: rgba(74, 140, 255, 0.24);
	color: #abd0ff;
}
</style>

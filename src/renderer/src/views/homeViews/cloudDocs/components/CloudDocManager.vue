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
			<div>
				<div class="doc-manager-title">文档列表</div>
				<div class="doc-manager-subtitle">使用 Tiptap 样式组件布局</div>
			</div>
			<n-button type="primary" size="small" :disabled="props.loading" @click="emit('create')">
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
			<n-button quaternary type="primary" @click="emit('create')">创建第一篇文档</n-button>
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
						<n-tag size="small" :bordered="false" type="info">Doc</n-tag>
						<n-tooltip trigger="hover" placement="top">
							<template #trigger>
								<n-button quaternary type="error" size="tiny" @click.stop="emit('delete', item.id)">
									<template #icon>
										<n-icon><TrashOutline /></n-icon>
									</template>
								</n-button>
							</template>
							删除
						</n-tooltip>
					</div>
					<div class="doc-item-title">{{ item.title || '未标题云文档' }}</div>
					<div class="doc-item-time">更新于 {{ formatTime(item.updatedAt) }}</div>
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
	background: var(--color-card-bg);
	border: 1px solid var(--color-border-default);
	border-radius: 10px;
}

.doc-manager-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px;
	border-bottom: 1px solid var(--color-border-default);
}

.doc-manager-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--color-text-main);
}

.doc-manager-subtitle {
	font-size: 11px;
	color: color-mix(in srgb, var(--color-text-main) 66%, transparent);
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
	gap: 8px;
	padding: 10px;
}

.doc-item {
	padding: 10px;
	border-radius: 8px;
	border: 1px solid var(--color-border-default);
	background: var(--color-card-bg);
	cursor: pointer;
	transition: border-color 0.15s ease;
}

.doc-item:hover {
	border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border-default));
}

.doc-item-active {
	border-color: var(--color-primary);
}

.doc-item-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.doc-item-title {
	margin-top: 8px;
	font-size: 13px;
	font-weight: 600;
	line-height: 1.35;
	color: var(--color-text-main);
	word-break: break-word;
}

.doc-item-time {
	margin-top: 8px;
	font-size: 11px;
	color: color-mix(in srgb, var(--color-text-main) 66%, transparent);
}
</style>

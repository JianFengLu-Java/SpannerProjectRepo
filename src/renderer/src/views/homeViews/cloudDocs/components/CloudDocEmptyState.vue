<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import { AddCircleOutline, DocumentTextOutline } from '@vicons/ionicons5'

const emit = defineEmits<{
	(e: 'create'): void
}>()
</script>

<template>
	<div class="cloud-doc-empty-state">
		<n-icon size="42" class="empty-icon"><DocumentTextOutline /></n-icon>
		<div class="empty-title">开始你的云文档</div>
		<div class="empty-desc">
			可以在左侧管理文档列表，点击新建后默认命名为“未标题云文档”。
		</div>
		<n-button type="primary" size="large" @click="emit('create')">
			<template #icon>
				<n-icon><AddCircleOutline /></n-icon>
			</template>
			新建云文档
		</n-button>
	</div>
</template>

<style scoped>
.cloud-doc-empty-state {
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 28px;
	border-radius: 16px;
	background: linear-gradient(150deg, rgba(255, 255, 255, 0.86), rgba(242, 248, 255, 0.86));
	border: 1px dashed rgba(159, 182, 214, 0.8);
}

.empty-icon {
	color: rgba(55, 113, 205, 0.75);
	margin-bottom: 14px;
}

.empty-title {
	font-size: 22px;
	font-weight: 700;
	color: #1d2a3b;
}

.empty-desc {
	margin-top: 10px;
	margin-bottom: 18px;
	max-width: 420px;
	line-height: 1.65;
	font-size: 13px;
	color: rgba(60, 73, 93, 0.86);
}

:global(.dark) .cloud-doc-empty-state {
	background: linear-gradient(150deg, rgba(32, 42, 58, 0.92), rgba(25, 35, 49, 0.92));
	border-color: rgba(77, 97, 124, 0.85);
}

:global(.dark) .empty-icon {
	color: rgba(124, 174, 255, 0.85);
}

:global(.dark) .empty-title {
	color: #e4ecf8;
}

:global(.dark) .empty-desc {
	color: rgba(191, 204, 223, 0.84);
}
</style>

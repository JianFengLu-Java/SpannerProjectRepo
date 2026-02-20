<script setup lang="ts">
import { onMounted } from 'vue'
import { useDialog } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCloudDocStore } from '@renderer/stores/cloudDoc'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import CloudDocManager from './components/CloudDocManager.vue'

const dialog = useDialog()
const cloudDocStore = useCloudDocStore()
const sidebarSlotStore = useSidebarSlotStore()
const { docs, activeDocId, loading } = storeToRefs(cloudDocStore)

const CLOUD_DOC_SLOT_PREFIX = 'cloud-doc:'

const openDocSlot = async (docId: string): Promise<void> => {
	const target = docs.value.find((doc) => doc.id === docId)
	if (!target) return
	await cloudDocStore.selectDoc(docId)
	sidebarSlotStore.openSlot({
		slotKey: `${CLOUD_DOC_SLOT_PREFIX}${docId}`,
		title: target.title || '未标题云文档',
		componentKey: 'cloud-doc-editor',
		icon: 'cloudDocs',
	})
}

const ensureInit = async (): Promise<void> => {
	await cloudDocStore.init()
}

const handleCreateDoc = async (): Promise<void> => {
	await cloudDocStore.createDoc()
	if (!cloudDocStore.activeDocId) return
	await openDocSlot(cloudDocStore.activeDocId)
}

const handleSelectDoc = async (docId: string): Promise<void> => {
	await openDocSlot(docId)
}

const handleDeleteDoc = (docId: string): void => {
	dialog.warning({
		title: '删除云文档',
		content: '删除后将无法恢复，是否继续？',
		positiveText: '删除',
		negativeText: '取消',
		onPositiveClick: () => {
			void cloudDocStore.deleteDoc(docId)
		},
	})
}

onMounted(() => {
	void ensureInit()
})
</script>

<template>
	<div class="docs-manage-page">
		<header class="docs-manage-header">
			<div class="docs-title">Cloud Docs</div>
			<div class="docs-subtitle">Tiptap UI 风格管理面板</div>
		</header>
		<section class="docs-manage-body">
			<CloudDocManager
				:docs="docs"
				:active-doc-id="activeDocId"
				:loading="loading"
				@create="handleCreateDoc"
				@select="handleSelectDoc"
				@delete="handleDeleteDoc"
			/>
		</section>
	</div>
</template>

<style scoped>
.docs-manage-page {
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px;
	background: var(--color-page-bg);
}

.docs-manage-header {
	padding: 10px 12px;
	border: 1px solid var(--color-border-default);
	border-radius: 10px;
	background: var(--color-card-bg);
}

.docs-title {
	font-size: 15px;
	font-weight: 700;
	color: var(--color-text-main);
}

.docs-subtitle {
	margin-top: 2px;
	font-size: 12px;
	color: color-mix(in srgb, var(--color-text-main) 66%, transparent);
}

.docs-manage-body {
	flex: 1;
	min-height: 0;
}
</style>

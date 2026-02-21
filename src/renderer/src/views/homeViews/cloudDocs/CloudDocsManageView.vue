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
const { docs, activeDocId, loading, sharedDocs, sharedLoading } =
	storeToRefs(cloudDocStore)

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
	await Promise.all([
		cloudDocStore.init(),
		cloudDocStore.loadReceivedShares('ACTIVE'),
	])
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

const handleOpenSharedDoc = async (shareNo: string): Promise<void> => {
	try {
		const item = await cloudDocStore.fetchSharedDocByShareNo(shareNo)
		if (!item?.doc?.id) return
		sidebarSlotStore.openSlot({
			slotKey: `cloud-doc-share:${item.shareNo}`,
			title: `分享: ${item.doc.title || '未标题云文档'}`,
			componentKey: 'cloud-doc-shared-editor',
			icon: 'cloudDocs',
		})
	} catch (error) {
		console.warn('打开朋友分享文档失败:', error)
	}
}

onMounted(() => {
	void ensureInit()
})
</script>

<template>
	<div class="docs-manage-page">
		<header class="docs-manage-header">
			<div class="docs-title-row">
				<div class="docs-title">云文档管理</div>
				<div class="docs-badge">Workspace</div>
			</div>
			<div class="docs-subtitle">统一入口管理与访问你的云文档</div>
		</header>
		<section class="docs-manage-body">
			<div class="docs-manage-grid">
				<CloudDocManager
					:docs="docs"
					:active-doc-id="activeDocId"
					:loading="loading"
					@create="handleCreateDoc"
					@select="handleSelectDoc"
					@delete="handleDeleteDoc"
				/>
				<aside class="shared-docs-panel">
					<div class="shared-docs-head">
						<div class="shared-docs-title">朋友分享的文档</div>
						<div class="shared-docs-subtitle">
							{{ sharedDocs.length }} 篇
						</div>
					</div>
					<div v-if="sharedLoading" class="shared-docs-empty">
						加载中...
					</div>
					<div
						v-else-if="!sharedDocs.length"
						class="shared-docs-empty"
					>
						暂无朋友分享文档
					</div>
					<div v-else class="shared-docs-list">
						<button
							v-for="item in sharedDocs"
							:key="item.shareNo"
							type="button"
							class="shared-doc-item"
							@click="handleOpenSharedDoc(item.shareNo)"
						>
							<div class="shared-doc-item-title">
								{{ item.doc.title || '未标题云文档' }}
							</div>
							<div class="shared-doc-item-meta">
								分享标识 {{ item.shareNo }} ·
								{{
									item.doc.editable
										? '协作可编辑'
										: '仅查看只读'
								}}
							</div>
						</button>
					</div>
				</aside>
			</div>
		</section>
	</div>
</template>

<style scoped>
.docs-manage-page {
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 8px;
	background: linear-gradient(135deg, #f5f9ff 0%, #edf4ff 48%, #e4efff 100%);
}

.docs-manage-header {
	padding: 10px 12px;
	border-radius: 10px;
	border: 1px solid
		color-mix(in srgb, var(--color-border-default) 70%, #bdd4f8);
	background: linear-gradient(
		160deg,
		color-mix(in srgb, var(--color-card-bg) 92%, #ffffff),
		color-mix(in srgb, var(--color-card-bg) 90%, #eaf2ff)
	);
}

.docs-title-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.docs-title {
	font-size: 16px;
	font-weight: 700;
	color: var(--color-text-main);
}

.docs-badge {
	padding: 2px 10px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: #225eb5;
	background: rgba(54, 149, 255, 0.14);
}

.docs-subtitle {
	margin-top: 4px;
	font-size: 12px;
	color: color-mix(in srgb, var(--color-text-main) 74%, transparent);
}

.docs-manage-body {
	flex: 1;
	min-height: 0;
}

.docs-manage-grid {
	height: 100%;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 320px;
	gap: 8px;
}

.shared-docs-panel {
	border-radius: 10px;
	border: 1px solid
		color-mix(in srgb, var(--color-border-default) 74%, #bed6ff);
	background: linear-gradient(
		165deg,
		color-mix(in srgb, var(--color-card-bg) 96%, #ffffff),
		color-mix(in srgb, var(--color-card-bg) 88%, #ecf4ff)
	);
	padding: 10px;
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.shared-docs-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: 8px;
}

.shared-docs-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--color-text-main);
}

.shared-docs-subtitle {
	font-size: 12px;
	color: color-mix(in srgb, var(--color-text-main) 70%, transparent);
}

.shared-docs-empty {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: color-mix(in srgb, var(--color-text-main) 70%, transparent);
}

.shared-docs-list {
	flex: 1;
	min-height: 0;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.shared-doc-item {
	text-align: left;
	padding: 7px 9px;
	border-radius: 8px;
	border: 1px solid
		color-mix(in srgb, var(--color-border-default) 80%, #c8ddff);
	background: color-mix(in srgb, var(--color-card-bg) 92%, #ffffff);
	transition: border-color 0.14s ease;
}

.shared-doc-item:hover {
	border-color: color-mix(
		in srgb,
		var(--color-primary) 50%,
		var(--color-border-default)
	);
}

.shared-doc-item-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-main);
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
}

.shared-doc-item-meta {
	margin-top: 4px;
	font-size: 11px;
	color: color-mix(in srgb, var(--color-text-main) 68%, transparent);
}

:global(.dark) .docs-manage-page {
	background: linear-gradient(135deg, #1e252f 0%, #1a2230 46%, #151d29 100%);
}

:global(.dark) .docs-manage-header {
	border-color: color-mix(in srgb, var(--color-border-default) 84%, #304869);
	background: linear-gradient(
		160deg,
		rgba(36, 46, 60, 0.96),
		rgba(29, 39, 53, 0.96)
	);
}

:global(.dark) .docs-badge {
	color: #a7cbff;
	background: rgba(82, 148, 255, 0.2);
}

@media (max-width: 980px) {
	.docs-manage-grid {
		grid-template-columns: 1fr;
	}
}
</style>

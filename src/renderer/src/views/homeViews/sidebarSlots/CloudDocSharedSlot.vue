<script setup lang="ts">
import { computed, getCurrentInstance, onActivated, onMounted } from 'vue'
import { NButton, NEmpty } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCloudDocStore } from '@renderer/stores/cloudDoc'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import CloudDocEditor from '../cloudDocs/components/CloudDocEditor.vue'

const cloudDocStore = useCloudDocStore()
const sidebarSlotStore = useSidebarSlotStore()
const { sharedDocs } = storeToRefs(cloudDocStore)

const CLOUD_DOC_SHARE_SLOT_PREFIX = 'cloud-doc-share:'
const instanceKey = String(getCurrentInstance()?.vnode.key || '')
const slotKey = instanceKey.includes(':')
	? instanceKey.slice(instanceKey.indexOf(':') + 1)
	: ''

const shareNo = computed(() => {
	if (!slotKey.startsWith(CLOUD_DOC_SHARE_SLOT_PREFIX)) return ''
	return slotKey.slice(CLOUD_DOC_SHARE_SLOT_PREFIX.length)
})

const sharedDoc = computed(() => {
	const key = shareNo.value
	if (!key) return null
	return sharedDocs.value.find((item) => item.shareNo === key) || null
})

const ensureSharedDoc = async (): Promise<void> => {
	const key = shareNo.value
	if (!key) return
	if (sharedDoc.value) return
	try {
		const loaded = await cloudDocStore.fetchSharedDocByShareNo(key)
		if (loaded?.doc?.id) {
			cloudDocStore.startCollabSync(loaded.doc.id)
		}
	} catch (error) {
		console.warn('加载分享云文档失败:', error)
	}
}

onMounted(() => {
	void ensureSharedDoc()
	const current = sharedDoc.value
	if (current?.doc?.id) {
		cloudDocStore.startCollabSync(current.doc.id)
	}
})

onActivated(() => {
	void ensureSharedDoc()
	const current = sharedDoc.value
	if (current?.doc?.id) {
		cloudDocStore.startCollabSync(current.doc.id)
	}
})
</script>

<template>
	<div class="docs-editor-slot-page">
		<section v-if="sharedDoc" class="docs-editor-slot-body">
			<CloudDocEditor
				:doc="sharedDoc.doc"
				save-state="idle"
				save-error-message=""
				:collab-cursors="[]"
			/>
		</section>

		<section v-else class="docs-editor-slot-empty">
			<n-empty description="分享文档不存在或已失效">
				<template #extra>
					<n-button type="primary" @click="sidebarSlotStore.clearActiveSlot()">
						关闭当前插槽
					</n-button>
				</template>
			</n-empty>
		</section>
	</div>
</template>

<style scoped>
.docs-editor-slot-page {
	height: 100%;
	display: flex;
	flex-direction: column;
	padding: 0;
	background: #ffffff;
}

.docs-editor-slot-body {
	flex: 1;
	min-height: 0;
	padding: 0;
}

.docs-editor-slot-empty {
	flex: 1;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #ffffff;
}
</style>

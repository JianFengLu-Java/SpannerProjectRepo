<script setup lang="ts">
import {
	computed,
	getCurrentInstance,
	onActivated,
	onBeforeUnmount,
	onMounted,
	watch,
} from 'vue'
import { NButton, NEmpty } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCloudDocStore } from '@renderer/stores/cloudDoc'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import CloudDocEditor from '../cloudDocs/components/CloudDocEditor.vue'

const cloudDocStore = useCloudDocStore()
const sidebarSlotStore = useSidebarSlotStore()
const { sharedDocs, saveState, saveErrorMessage } = storeToRefs(cloudDocStore)

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
const sharedDocCursors = computed(() => {
	const docId = String(sharedDoc.value?.doc?.id || '').trim()
	if (!docId) return []
	return cloudDocStore.getDocCursors(docId)
})
const sharedDocOnlineCount = computed(() => {
	const docId = String(sharedDoc.value?.doc?.id || '').trim()
	if (!docId) return 0
	return cloudDocStore.getDocOnlineCount(docId)
})

const ensureSharedDoc = async (): Promise<void> => {
	const key = shareNo.value
	if (!key) return
	if (sharedDoc.value) return
	try {
		const loaded = await cloudDocStore.fetchSharedDocByShareNo(key)
		if (loaded?.doc?.id && loaded.doc.editable !== false) {
			cloudDocStore.startCollabSync(loaded.doc.id)
		}
	} catch (error) {
		console.warn('加载分享云文档失败:', error)
	}
}

const syncSharedDocCollab = (): void => {
	const current = sharedDoc.value
	if (!current?.doc?.id) {
		return
	}
	if (current.doc.editable === false) {
		cloudDocStore.stopCollabSyncByDocId(current.doc.id)
		return
	}
	cloudDocStore.startCollabSync(current.doc.id)
}

onMounted(() => {
	void ensureSharedDoc()
	syncSharedDocCollab()
})

onActivated(() => {
	void ensureSharedDoc()
	syncSharedDocCollab()
})

watch(
	() => [sharedDoc.value?.doc?.id, sharedDoc.value?.doc?.editable],
	() => {
		syncSharedDocCollab()
	},
)

onBeforeUnmount(() => {
	const exists = sidebarSlotStore.slots.some(
		(item) => item.slotKey === slotKey,
	)
	if (!exists) {
		const docId = String(sharedDoc.value?.doc?.id || '').trim()
		cloudDocStore.stopCollabSyncByDocId(docId)
	}
})
</script>

<template>
	<div class="docs-editor-slot-page">
		<section v-if="sharedDoc" class="docs-editor-slot-body">
			<CloudDocEditor
				:doc="sharedDoc.doc"
				:save-state="saveState"
				:save-error-message="saveErrorMessage"
				:collab-cursors="sharedDocCursors"
				:collab-online-count="sharedDocOnlineCount"
				@update:title="
					cloudDocStore.updateDocTitleById(sharedDoc.doc.id, $event)
				"
				@update:content="
					cloudDocStore.updateDocContentById(sharedDoc.doc.id, $event)
				"
			/>
		</section>

		<section v-else class="docs-editor-slot-empty">
			<n-empty description="分享文档不存在或已失效">
				<template #extra>
					<n-button
						type="primary"
						@click="sidebarSlotStore.clearActiveSlot()"
					>
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

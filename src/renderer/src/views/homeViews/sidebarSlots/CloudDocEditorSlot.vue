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
const {
	docs,
	activeDoc,
	saveState,
	saveErrorMessage,
	activeDocCursors,
	activeDocOnlineCount,
} = storeToRefs(cloudDocStore)

const CLOUD_DOC_SLOT_PREFIX = 'cloud-doc:'
const instanceKey = String(getCurrentInstance()?.vnode.key || '')
const slotKey = instanceKey.includes(':')
	? instanceKey.slice(instanceKey.indexOf(':') + 1)
	: ''

const slotDocId = computed(() => {
	if (!slotKey.startsWith(CLOUD_DOC_SLOT_PREFIX)) return ''
	return slotKey.slice(CLOUD_DOC_SLOT_PREFIX.length)
})

const currentDoc = computed(() => {
	const id = slotDocId.value
	if (!id) return null
	return docs.value.find((doc) => doc.id === id) || null
})
const isCurrentSlotActive = computed(
	() => sidebarSlotStore.activeSlotKey === slotKey,
)

const ensureActiveDoc = async (): Promise<void> => {
	await cloudDocStore.init()
	const id = slotDocId.value
	if (!id) return
	if (activeDoc.value?.id === id) return
	await cloudDocStore.selectDoc(id)
}

const syncSlotTitle = (): void => {
	const doc = currentDoc.value
	if (!doc) return
	sidebarSlotStore.openSlot({
		slotKey,
		title: doc.title || '未标题云文档',
		componentKey: 'cloud-doc-editor',
		icon: 'cloudDocs',
	})
}

onMounted(() => {
	void ensureActiveDoc()
})

onActivated(() => {
	void ensureActiveDoc()
})

watch(
	() => currentDoc.value?.title,
	() => {
		if (!isCurrentSlotActive.value) return
		syncSlotTitle()
	},
)

onBeforeUnmount(() => {
	cloudDocStore.stopCollabSync()
	void cloudDocStore.flushSave()
})
</script>

<template>
	<div class="docs-editor-slot-page">
		<section
			v-if="currentDoc && activeDoc && activeDoc.id === slotDocId"
			class="docs-editor-slot-body"
		>
			<CloudDocEditor
				:doc="activeDoc"
				:save-state="saveState"
				:save-error-message="saveErrorMessage"
				:collab-cursors="activeDocCursors"
				:collab-online-count="activeDocOnlineCount"
				@update:title="cloudDocStore.updateActiveTitle"
				@update:content="cloudDocStore.updateActiveContent"
			/>
		</section>

		<section v-else class="docs-editor-slot-empty">
			<n-empty description="文档不存在或已删除">
				<template #extra>
					<n-button
						type="primary"
						@click="sidebarSlotStore.clearActiveSlot()"
						>关闭当前插槽</n-button
					>
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

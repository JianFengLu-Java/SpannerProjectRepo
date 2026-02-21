<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { NButton, NEmpty } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCloudDocStore } from '@renderer/stores/cloudDoc'
import CloudDocEditor from './components/CloudDocEditor.vue'

const router = useRouter()
const route = useRoute()
const cloudDocStore = useCloudDocStore()
const {
	docs,
	activeDoc,
	saveState,
	saveErrorMessage,
	activeDocCursors,
	activeDocOnlineCount,
} = storeToRefs(cloudDocStore)

const routeDocId = computed(() => String(route.params.docId || ''))

const hasCurrentDoc = computed(() => {
	const id = routeDocId.value
	return !!id && docs.value.some((doc) => doc.id === id)
})

const syncActiveDocByRoute = async (): Promise<void> => {
	await cloudDocStore.init()
	const id = routeDocId.value
	if (!id) return
	await cloudDocStore.selectDoc(id)
}

const goBackToManager = async (): Promise<void> => {
	await router.push({ name: 'cloudDocs' })
}

onMounted(() => {
	void syncActiveDocByRoute()
})

watch(
	() => route.params.docId,
	() => {
		void syncActiveDocByRoute()
	},
)

onBeforeUnmount(() => {
	cloudDocStore.stopCollabSync()
	void cloudDocStore.flushSave()
})
</script>

<template>
	<div class="docs-editor-page">
		<section
			v-if="hasCurrentDoc && activeDoc && activeDoc.id === routeDocId"
			class="docs-editor-body"
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

		<section v-else class="docs-editor-empty">
			<n-empty description="文档不存在或已删除">
				<template #extra>
					<n-button type="primary" @click="goBackToManager">
						返回云文档管理
					</n-button>
				</template>
			</n-empty>
		</section>
	</div>
</template>

<style scoped>
.docs-editor-page {
	height: 100%;
	display: flex;
	flex-direction: column;
	padding: 0;
	background: #ffffff;
}

.docs-editor-body {
	flex: 1;
	min-height: 0;
	padding: 0;
}

.docs-editor-empty {
	flex: 1;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #ffffff;
}
</style>

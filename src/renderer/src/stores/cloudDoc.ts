import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { mockCloudDocService } from '@renderer/services/mockCloudDocService'
import type { CloudDoc, CloudDocSaveState } from '@renderer/types/cloudDoc'

const AUTO_SAVE_DEBOUNCE_MS = 900

export const useCloudDocStore = defineStore('cloudDoc', () => {
	const docs = ref<CloudDoc[]>([])
	const activeDocId = ref<string | null>(null)
	const ready = ref(false)
	const loading = ref(false)
	const saveState = ref<CloudDocSaveState>('idle')
	const saveErrorMessage = ref('')

	let saveTimer: ReturnType<typeof setTimeout> | null = null
	let queuedSaveDocId: string | null = null

	const activeDoc = computed<CloudDoc | null>(() => {
		if (!activeDocId.value) return null
		return docs.value.find((doc) => doc.id === activeDocId.value) || null
	})

	const clearSaveTimer = (): void => {
		if (!saveTimer) return
		clearTimeout(saveTimer)
		saveTimer = null
	}

	const ensureActiveDoc = (): CloudDoc | null => {
		if (!activeDocId.value) return null
		return docs.value.find((doc) => doc.id === activeDocId.value) || null
	}

	const replaceDoc = (nextDoc: CloudDoc): void => {
		const index = docs.value.findIndex((doc) => doc.id === nextDoc.id)
		if (index < 0) {
			docs.value.unshift(nextDoc)
		} else {
			docs.value[index] = nextDoc
		}
		docs.value.sort((a, b) => {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		})
	}

	const flushSave = async (): Promise<void> => {
		clearSaveTimer()
		const docId = queuedSaveDocId
		if (!docId) return
		queuedSaveDocId = null
		const target = docs.value.find((doc) => doc.id === docId)
		if (!target) return

		saveState.value = 'saving'
		saveErrorMessage.value = ''
		try {
			const saved = await mockCloudDocService.updateDoc(target.id, {
				title: target.title,
				contentHtml: target.contentHtml,
				contentJson: target.contentJson,
			})
			if (!saved) {
				saveState.value = 'error'
				saveErrorMessage.value = '文档不存在，保存失败'
				return
			}
			replaceDoc(saved)
			saveState.value = 'saved'
		} catch (error) {
			console.error('保存云文档失败:', error)
			saveState.value = 'error'
			saveErrorMessage.value = '网络异常，请稍后重试'
		}
	}

	const scheduleSave = (docId: string): void => {
		queuedSaveDocId = docId
		saveState.value = 'idle'
		saveErrorMessage.value = ''
		clearSaveTimer()
		saveTimer = setTimeout(() => {
			void flushSave()
		}, AUTO_SAVE_DEBOUNCE_MS)
	}

	const init = async (): Promise<void> => {
		if (ready.value || loading.value) return
		loading.value = true
		try {
			docs.value = await mockCloudDocService.listDocs()
			activeDocId.value = null
			ready.value = true
		} finally {
			loading.value = false
		}
	}

	const createDoc = async (): Promise<void> => {
		const next = await mockCloudDocService.createDoc()
		replaceDoc(next)
		activeDocId.value = next.id
		saveState.value = 'saved'
		saveErrorMessage.value = ''
	}

	const selectDoc = async (docId: string): Promise<void> => {
		if (activeDocId.value === docId) return
		await flushSave()
		activeDocId.value = docId
		saveState.value = 'idle'
		saveErrorMessage.value = ''
	}

	const updateActiveTitle = (title: string): void => {
		const doc = ensureActiveDoc()
		if (!doc) return
		doc.title = title
		doc.updatedAt = new Date().toISOString()
		replaceDoc({ ...doc })
		scheduleSave(doc.id)
	}

	const updateActiveContent = (payload: {
		contentHtml: string
		contentJson: string
	}): void => {
		const doc = ensureActiveDoc()
		if (!doc) return
		doc.contentHtml = payload.contentHtml
		doc.contentJson = payload.contentJson
		doc.updatedAt = new Date().toISOString()
		replaceDoc({ ...doc })
		scheduleSave(doc.id)
	}

	const deleteDoc = async (docId: string): Promise<void> => {
		if (queuedSaveDocId === docId) {
			queuedSaveDocId = null
			clearSaveTimer()
		}
		await mockCloudDocService.deleteDoc(docId)
		docs.value = docs.value.filter((doc) => doc.id !== docId)
		if (activeDocId.value === docId) {
			activeDocId.value = null
			saveState.value = 'idle'
			saveErrorMessage.value = ''
		}
	}

	return {
		docs,
		activeDocId,
		activeDoc,
		ready,
		loading,
		saveState,
		saveErrorMessage,
		init,
		createDoc,
		selectDoc,
		updateActiveTitle,
		updateActiveContent,
		flushSave,
		deleteDoc,
	}
})

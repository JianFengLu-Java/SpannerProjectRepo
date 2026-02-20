import axios from 'axios'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
	cloudDocApi,
	type CloudDocDetailDto,
	type CloudDocSummaryDto,
} from '@renderer/services/cloudDocApi'
import type { CloudDoc, CloudDocSaveState } from '@renderer/types/cloudDoc'

const AUTO_SAVE_DEBOUNCE_MS = 900
const DEFAULT_DOC_TITLE = '未标题云文档'

const normalizeDoc = (
	payload: Partial<CloudDocSummaryDto & CloudDocDetailDto>,
	fallback?: CloudDoc,
): CloudDoc => {
	const now = new Date().toISOString()
	return {
		id: String(payload.id || fallback?.id || ''),
		title: String(payload.title || fallback?.title || DEFAULT_DOC_TITLE),
		snippet:
			typeof payload.snippet === 'string' ? payload.snippet : fallback?.snippet,
		contentHtml: String(payload.contentHtml || fallback?.contentHtml || ''),
		contentJson: String(payload.contentJson || fallback?.contentJson || ''),
		createdAt: String(payload.createdAt || fallback?.createdAt || now),
		updatedAt: String(payload.updatedAt || fallback?.updatedAt || now),
		lastSavedAt:
			typeof payload.lastSavedAt === 'string'
				? payload.lastSavedAt
				: payload.lastSavedAt === null
					? null
					: (fallback?.lastSavedAt ?? null),
		version:
			typeof payload.version === 'number' && Number.isFinite(payload.version)
				? payload.version
				: (fallback?.version ?? 0),
		ownerAccount:
			typeof payload.ownerAccount === 'string'
				? payload.ownerAccount
				: fallback?.ownerAccount,
		editable:
			typeof payload.editable === 'boolean'
				? payload.editable
				: (fallback?.editable ?? true),
		deleted:
			typeof payload.deleted === 'boolean' ? payload.deleted : fallback?.deleted,
	}
}

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
		if (!target || target.editable === false) return

		saveState.value = 'saving'
		saveErrorMessage.value = ''
		try {
			const response = await cloudDocApi.saveDoc(target.id, {
				title: target.title,
				contentHtml: target.contentHtml,
				contentJson: target.contentJson,
				baseVersion: target.version,
			})
			const saved = response.data.data
			replaceDoc(
				normalizeDoc(
					{
						...target,
						updatedAt: saved.updatedAt,
						lastSavedAt: saved.lastSavedAt,
						version: saved.version,
					},
					target,
				),
			)
			saveState.value = 'saved'
		} catch (error) {
			console.error('保存云文档失败:', error)
			const latestVersion = Number(
				(error as { response?: { data?: { data?: { latestVersion?: number } } } })
					.response?.data?.data?.latestVersion,
			)
			if (axios.isAxiosError(error) && error.response?.status === 409) {
				saveState.value = 'error'
				saveErrorMessage.value = Number.isFinite(latestVersion)
					? `文档版本冲突，请刷新后重试（最新版本 ${latestVersion}）`
					: '文档版本冲突，请刷新后重试'

				try {
					const latestResp = await cloudDocApi.getDoc(target.id)
					const latestDoc = normalizeDoc(latestResp.data.data, target)
					replaceDoc(latestDoc)
				} catch (refreshError) {
					console.warn('冲突后拉取最新文档失败:', refreshError)
				}
				return
			}
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
			const response = await cloudDocApi.listDocs({ page: 1, size: 100 })
			const records = response.data.data?.records || []
			docs.value = records.map((item) => normalizeDoc(item))
			activeDocId.value = null
			ready.value = true
		} finally {
			loading.value = false
		}
	}

	const createDoc = async (): Promise<void> => {
		const response = await cloudDocApi.createDoc(DEFAULT_DOC_TITLE)
		const next = normalizeDoc(response.data.data)
		replaceDoc(next)
		activeDocId.value = next.id
		saveState.value = 'saved'
		saveErrorMessage.value = ''
	}

	const selectDoc = async (docId: string): Promise<void> => {
		if (!docId) return
		if (activeDocId.value !== docId) {
			await flushSave()
		}

		const current = docs.value.find((doc) => doc.id === docId)
		if (!current) return

		try {
			const response = await cloudDocApi.getDoc(docId)
			const detail = normalizeDoc(response.data.data, current)
			replaceDoc(detail)
			activeDocId.value = docId
			saveState.value = 'idle'
			saveErrorMessage.value = ''
		} catch (error) {
			console.error('加载云文档详情失败:', error)
			activeDocId.value = docId
			saveState.value = 'error'
			saveErrorMessage.value = '文档加载失败，请稍后重试'
		}
	}

	const updateActiveTitle = (title: string): void => {
		const doc = ensureActiveDoc()
		if (!doc || doc.editable === false) return
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
		if (!doc || doc.editable === false) return
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
		await cloudDocApi.deleteDoc(docId)
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

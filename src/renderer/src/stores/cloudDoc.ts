import axios from 'axios'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { tokenManager } from '@renderer/services/tokenManager'
import {
	cloudDocWs,
	type CloudDocWsEventFrame,
} from '@renderer/services/cloudDocWs'
import {
	cloudDocApi,
	type CloudDocDetailDto,
	type ReceivedCloudDocShareDto,
	type CloudDocShareResponseDto,
	type CloudDocSummaryDto,
} from '@renderer/services/cloudDocApi'
import type {
	CloudDoc,
	CloudDocSaveState,
	CollabCursor,
} from '@renderer/types/cloudDoc'
import { useUserInfoStore } from './userInfo'

const AUTO_SAVE_DEBOUNCE_MS = 900
const COLLAB_SYNC_INTERVAL_MS = 2500
const DEFAULT_DOC_TITLE = '未标题云文档'
const DEFAULT_SHARED_DOC_TITLE = '朋友分享文档'
const CURSOR_COLOR_PALETTE = [
	'#3b82f6',
	'#10b981',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#06b6d4',
]

export interface SharedCloudDoc {
	shareNo: string
	doc: CloudDoc
	friendAccount?: string
	ownerAccount?: string
	status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | string
	expired?: boolean
	lastViewedAt?: string | null
	createdAt?: string
	expireAt?: string | null
	sharePath?: string
}

const normalizeDoc = (
	payload: Partial<CloudDocSummaryDto & CloudDocDetailDto>,
	fallback?: CloudDoc,
): CloudDoc => {
	const now = new Date().toISOString()
	return {
		id: String(payload.id || fallback?.id || ''),
		title: String(payload.title || fallback?.title || DEFAULT_DOC_TITLE),
		snippet:
			typeof payload.snippet === 'string'
				? payload.snippet
				: fallback?.snippet,
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
			typeof payload.version === 'number' &&
			Number.isFinite(payload.version)
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
			typeof payload.deleted === 'boolean'
				? payload.deleted
				: fallback?.deleted,
	}
}

const hasDocBodyContent = (doc?: CloudDoc | null): boolean => {
	if (!doc) return false
	return (
		!!String(doc.contentHtml || '').trim() ||
		!!String(doc.contentJson || '').trim()
	)
}

export const useCloudDocStore = defineStore('cloudDoc', () => {
	const userInfoStore = useUserInfoStore()
	const docs = ref<CloudDoc[]>([])
	const activeDocId = ref<string | null>(null)
	const ready = ref(false)
	const loading = ref(false)
	const saveState = ref<CloudDocSaveState>('idle')
	const saveErrorMessage = ref('')
	const sharedDocs = ref<SharedCloudDoc[]>([])
	const sharedLoading = ref(false)
	const collabCursorsByDocId = ref<Record<string, CollabCursor[]>>({})

	let saveTimer: ReturnType<typeof setTimeout> | null = null
	let queuedSaveDocId: string | null = null
	let collabSyncTimer: ReturnType<typeof setInterval> | null = null
	let collabSyncDocId: string | null = null
	let collabSyncing = false
	let collabWsBoundDocId: string | null = null

	const activeDoc = computed<CloudDoc | null>(() => {
		if (!activeDocId.value) return null
		return docs.value.find((doc) => doc.id === activeDocId.value) || null
	})
	const activeDocCursors = computed<CollabCursor[]>(() => {
		const docId = String(activeDocId.value || '').trim()
		if (!docId) return []
		return collabCursorsByDocId.value[docId] || []
	})

	const clearSaveTimer = (): void => {
		if (!saveTimer) return
		clearTimeout(saveTimer)
		saveTimer = null
	}

	const stopCollabSync = (): void => {
		if (collabWsBoundDocId) {
			cloudDocWs.leave({ docId: collabWsBoundDocId })
			collabWsBoundDocId = null
		}
		cloudDocWs.disconnect()
		if (collabSyncTimer) {
			clearInterval(collabSyncTimer)
			collabSyncTimer = null
		}
		collabSyncDocId = null
		collabSyncing = false
	}

	const pickCursorColor = (seed: string): string => {
		let hash = 0
		for (let i = 0; i < seed.length; i += 1) {
			hash = (hash << 5) - hash + seed.charCodeAt(i)
			hash |= 0
		}
		const index = Math.abs(hash) % CURSOR_COLOR_PALETTE.length
		return CURSOR_COLOR_PALETTE[index]
	}

	const upsertDocCursor = (docId: string, cursor: CollabCursor): void => {
		const normalizedDocId = String(docId || '').trim()
		const normalizedUserId = String(cursor.userId || '').trim()
		if (!normalizedDocId || !normalizedUserId) return
		const list = collabCursorsByDocId.value[normalizedDocId]
			? [...collabCursorsByDocId.value[normalizedDocId]]
			: []
		const nextCursor: CollabCursor = {
			userId: normalizedUserId,
			name:
				String(cursor.name || normalizedUserId).trim() ||
				normalizedUserId,
			color:
				String(cursor.color || '').trim() ||
				pickCursorColor(normalizedUserId),
			position: Number.isFinite(cursor.position) ? cursor.position : 0,
			anchor: Number.isFinite(cursor.anchor)
				? Number(cursor.anchor)
				: Number.isFinite(cursor.position)
					? Number(cursor.position)
					: 0,
			head: Number.isFinite(cursor.head)
				? Number(cursor.head)
				: Number.isFinite(cursor.position)
					? Number(cursor.position)
					: 0,
			updatedAt:
				typeof cursor.updatedAt === 'string'
					? cursor.updatedAt
					: new Date().toISOString(),
		}
		const index = list.findIndex((item) => item.userId === normalizedUserId)
		if (index < 0) {
			list.push(nextCursor)
		} else {
			list[index] = nextCursor
		}
		collabCursorsByDocId.value = {
			...collabCursorsByDocId.value,
			[normalizedDocId]: list,
		}
	}

	const removeDocCursor = (docId: string, userId: string): void => {
		const normalizedDocId = String(docId || '').trim()
		const normalizedUserId = String(userId || '').trim()
		if (!normalizedDocId || !normalizedUserId) return
		const list = collabCursorsByDocId.value[normalizedDocId] || []
		const next = list.filter((item) => item.userId !== normalizedUserId)
		collabCursorsByDocId.value = {
			...collabCursorsByDocId.value,
			[normalizedDocId]: next,
		}
	}

	const clearDocCursors = (docId: string): void => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return
		if (!(normalizedDocId in collabCursorsByDocId.value)) return
		const next = { ...collabCursorsByDocId.value }
		delete next[normalizedDocId]
		collabCursorsByDocId.value = next
	}

	const parseCursorPayload = (
		event: CloudDocWsEventFrame,
	): Record<string, unknown> | null => {
		const raw = (event.data || {}) as Record<string, unknown>
		const payloadRaw = raw.payload
		if (typeof payloadRaw === 'string' && payloadRaw.trim()) {
			try {
				const parsed = JSON.parse(payloadRaw) as Record<string, unknown>
				return parsed
			} catch {
				return null
			}
		}
		return raw
	}

	const applyRemoteCollabCursor = (event: CloudDocWsEventFrame): void => {
		const docId = String(event.docId || '').trim()
		if (!docId) return
		const currentAccount = String(userInfoStore.account || '').trim()
		const payload = parseCursorPayload(event)
		if (!payload) return
		const userId = String(
			payload.userId ||
				payload.account ||
				payload.from ||
				event.from ||
				'',
		).trim()
		if (!userId) return
		if (currentAccount && userId === currentAccount) return
		const eventType = String(event.eventType || '')
			.trim()
			.toLowerCase()
		if (eventType === 'cursor.leave' || eventType === 'presence.leave') {
			removeDocCursor(docId, userId)
			return
		}
		const anchorRaw = Number(payload.anchor)
		const headRaw = Number(payload.head)
		const positionRaw = Number(payload.position)
		const anchor = Number.isFinite(anchorRaw)
			? anchorRaw
			: Number.isFinite(positionRaw)
				? positionRaw
				: 0
		const head = Number.isFinite(headRaw)
			? headRaw
			: Number.isFinite(positionRaw)
				? positionRaw
				: anchor
		upsertDocCursor(docId, {
			userId,
			name:
				String(payload.name || payload.userName || userId).trim() ||
				userId,
			color:
				String(payload.color || '').trim() || pickCursorColor(userId),
			position: head,
			anchor,
			head,
			updatedAt: String(event.at || new Date().toISOString()),
		})
	}

	const pullRemoteDocIfNewer = async (docId: string): Promise<void> => {
		const targetId = String(docId || '').trim()
		if (!targetId || collabSyncing) return
		const local = docs.value.find((item) => item.id === targetId)
		if (!local) return
		collabSyncing = true
		try {
			const response = await cloudDocApi.getDoc(targetId)
			const remote = normalizeDoc(response.data.data, local)
			if ((remote.version || 0) <= (local.version || 0)) return
			replaceDoc(remote)
		} catch (error) {
			console.warn('云端协同拉取失败:', error)
		} finally {
			collabSyncing = false
		}
	}

	const applyRemoteCollabPatch = async (
		event: CloudDocWsEventFrame,
	): Promise<void> => {
		const eventType = String(event.eventType || '')
			.trim()
			.toLowerCase()
		if (eventType.includes('cursor') || eventType.includes('presence')) {
			applyRemoteCollabCursor(event)
			return
		}
		if (event.eventType !== 'content.patch') return
		const eventDocId = String(event.docId || '').trim()
		if (!eventDocId) return
		const currentAccount = String(userInfoStore.account || '').trim()
		if (
			currentAccount &&
			String(event.from || '').trim() === currentAccount
		) {
			return
		}
		const local = docs.value.find((item) => item.id === eventDocId) || null
		const relatedShared = sharedDocs.value.filter(
			(item) => item.doc.id === eventDocId,
		)
		if (!local && relatedShared.length === 0) return
		const data = (event.data || {}) as Record<string, unknown>
		const payloadRaw = String(data.payload || '').trim()
		if (!payloadRaw) {
			// 增量 patch 可能不携带完整快照，空 payload 直接忽略，避免用 REST 旧数据回滚实时内容。
			return
		}
		try {
			const payload = JSON.parse(payloadRaw) as Record<string, unknown>
			const nextHtml = String(payload.contentHtml || '').trim()
			const nextJson = String(payload.contentJson || '').trim()
			const nextTitle = String(payload.title || '').trim()
			if (!nextHtml && !nextJson && !nextTitle) {
				// 当前协议可能只传 path/value（非完整内容快照）。
				// 此处不回退 REST 拉取，避免把未落库协同内容覆盖掉。
				return
			}
			if (local) {
				replaceDoc(
					normalizeDoc(
						{
							...local,
							title: nextTitle || local.title,
							contentHtml: nextHtml || local.contentHtml,
							contentJson: nextJson || local.contentJson,
							updatedAt: String(
								event.at || new Date().toISOString(),
							),
						},
						local,
					),
				)
			}
			for (const shared of relatedShared) {
				upsertSharedDoc({
					...shared,
					shareNo: shared.shareNo,
					doc: normalizeDoc(
						{
							...shared.doc,
							title: nextTitle || shared.doc.title,
							contentHtml: nextHtml || shared.doc.contentHtml,
							contentJson: nextJson || shared.doc.contentJson,
							updatedAt: String(
								event.at || new Date().toISOString(),
							),
						},
						shared.doc,
					),
				})
			}
		} catch {
			// payload 结构不匹配时直接忽略，避免用落库版本回滚实时编辑状态。
		}
	}

	const ensureCollabWs = async (docId: string): Promise<void> => {
		const targetId = String(docId || '').trim()
		if (!targetId) return
		const token = await tokenManager.getValidAccessToken()
		if (!token) return
		cloudDocWs.connect(token, {
			onConnected: () => {
				if (collabSyncDocId) {
					cloudDocWs.join({ docId: collabSyncDocId })
					collabWsBoundDocId = collabSyncDocId
				}
			},
			onEvent: (event) => {
				void applyRemoteCollabPatch(event)
			},
		})
		if (collabSyncDocId) {
			cloudDocWs.join({ docId: collabSyncDocId })
			collabWsBoundDocId = collabSyncDocId
		}
	}

	const startCollabSync = (docId: string): void => {
		const targetId = String(docId || '').trim()
		if (!targetId) {
			stopCollabSync()
			return
		}
		if (collabSyncDocId === targetId && collabSyncTimer) return
		if (collabWsBoundDocId && collabWsBoundDocId !== targetId) {
			cloudDocWs.leave({ docId: collabWsBoundDocId })
			collabWsBoundDocId = null
		}
		stopCollabSync()
		collabSyncDocId = targetId
		clearDocCursors(targetId)
		void ensureCollabWs(targetId)
		collabSyncTimer = setInterval(() => {
			void pullRemoteDocIfNewer(targetId)
		}, COLLAB_SYNC_INTERVAL_MS)
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
			return (
				new Date(b.updatedAt).getTime() -
				new Date(a.updatedAt).getTime()
			)
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
				(
					error as {
						response?: {
							data?: { data?: { latestVersion?: number } }
						}
					}
				).response?.data?.data?.latestVersion,
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
		startCollabSync(next.id)
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
			startCollabSync(docId)
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
		cloudDocWs.sendPatch({
			docId: doc.id,
			baseVersion: doc.version,
			opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			opType: 'setTitle',
			payload: JSON.stringify({
				title: doc.title,
				contentHtml: doc.contentHtml,
				contentJson: doc.contentJson,
			}),
		})
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
		cloudDocWs.sendPatch({
			docId: doc.id,
			baseVersion: doc.version,
			opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			opType: 'setContent',
			payload: JSON.stringify({
				title: doc.title,
				contentHtml: doc.contentHtml,
				contentJson: doc.contentJson,
			}),
		})
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
			stopCollabSync()
			activeDocId.value = null
			saveState.value = 'idle'
			saveErrorMessage.value = ''
		}
		clearDocCursors(docId)
	}

	const upsertSharedDoc = (
		payload: Partial<SharedCloudDoc> & { shareNo: string; doc: CloudDoc },
	): SharedCloudDoc => {
		const normalizedShareNo = String(payload.shareNo || '').trim()
		const next: SharedCloudDoc = {
			shareNo: normalizedShareNo,
			doc: payload.doc,
			friendAccount: payload.friendAccount?.trim() || undefined,
			ownerAccount: payload.ownerAccount?.trim() || undefined,
			status: payload.status,
			expired: payload.expired,
			lastViewedAt:
				typeof payload.lastViewedAt === 'string'
					? payload.lastViewedAt
					: payload.lastViewedAt === null
						? null
						: undefined,
			createdAt: payload.createdAt,
			expireAt: payload.expireAt ?? null,
			sharePath: payload.sharePath?.trim() || undefined,
		}
		const index = sharedDocs.value.findIndex(
			(item) => item.shareNo === normalizedShareNo,
		)
		if (index < 0) {
			sharedDocs.value.unshift(next)
		} else {
			sharedDocs.value[index] = next
		}
		sharedDocs.value.sort((a, b) => {
			const at = new Date(a.createdAt || a.doc.updatedAt).getTime()
			const bt = new Date(b.createdAt || b.doc.updatedAt).getTime()
			return bt - at
		})
		return next
	}

	const cacheSharedDocFromShareResult = (
		shareResult: Partial<CloudDocShareResponseDto> | null | undefined,
		doc?: CloudDoc,
	): SharedCloudDoc | null => {
		const shareNo = String(shareResult?.shareNo || '').trim()
		if (!shareNo || !doc) return null
		return upsertSharedDoc({
			shareNo,
			doc: {
				...doc,
				editable: false,
				title: doc.title || DEFAULT_SHARED_DOC_TITLE,
			},
			friendAccount: shareResult?.friendAccount,
			createdAt: shareResult?.createdAt,
			expireAt: shareResult?.expireAt ?? null,
			sharePath: shareResult?.sharePath,
			status: 'ACTIVE',
			expired: false,
		})
	}

	const mapReceivedShareToSharedDoc = (
		item: ReceivedCloudDocShareDto,
	): SharedCloudDoc | null => {
		const shareNo = String(item.shareNo || '').trim()
		const docId = String(item.docId || '').trim()
		if (!shareNo || !docId) return null
		const now = new Date().toISOString()
		const doc = normalizeDoc(
			{
				id: docId,
				title: item.title || DEFAULT_SHARED_DOC_TITLE,
				snippet: item.snippet,
				ownerAccount: item.ownerAccount,
				editable: false,
				createdAt: item.createdAt || now,
				updatedAt: item.lastViewedAt || item.createdAt || now,
				lastSavedAt: null,
				version: 0,
			},
			undefined,
		)
		return {
			shareNo,
			doc,
			ownerAccount: item.ownerAccount,
			status: item.status,
			expired: item.expired,
			createdAt: item.createdAt,
			expireAt: item.expireAt ?? null,
			lastViewedAt: item.lastViewedAt ?? null,
		}
	}

	const fetchSharedDocByShareNo = async (
		shareNo: string,
	): Promise<SharedCloudDoc | null> => {
		const normalizedShareNo = String(shareNo || '').trim()
		if (!normalizedShareNo) return null
		const existing = sharedDocs.value.find(
			(item) => item.shareNo === normalizedShareNo,
		)
		// received 列表仅有摘要，若本地无正文则必须继续拉详情接口。
		if (existing && hasDocBodyContent(existing.doc)) return existing
		const response = await cloudDocApi.getSharedDoc(normalizedShareNo)
		const payload = response.data.data || {}
		const detail = payload.doc
		if (!detail?.id) return null
		const normalizedDoc = normalizeDoc(
			{
				...detail,
				editable: false,
				title: detail.title || DEFAULT_SHARED_DOC_TITLE,
			},
			undefined,
		)
		return upsertSharedDoc({
			shareNo: String(payload.shareNo || normalizedShareNo),
			doc: normalizedDoc,
			ownerAccount: normalizedDoc.ownerAccount,
			status: 'ACTIVE',
			expired: false,
		})
	}

	const loadReceivedShares = async (
		status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' = 'ACTIVE',
	): Promise<void> => {
		if (sharedLoading.value) return
		sharedLoading.value = true
		try {
			const response = await cloudDocApi.listReceivedShares({
				page: 1,
				size: 100,
				status,
			})
			const records = response.data.data?.records || []
			const mapped = records
				.map((item) => mapReceivedShareToSharedDoc(item))
				.filter((item): item is SharedCloudDoc => !!item)
			sharedDocs.value = mapped
		} finally {
			sharedLoading.value = false
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
		sharedDocs,
		sharedLoading,
		activeDocCursors,
		init,
		createDoc,
		selectDoc,
		updateActiveTitle,
		updateActiveContent,
		flushSave,
		deleteDoc,
		upsertSharedDoc,
		cacheSharedDocFromShareResult,
		fetchSharedDocByShareNo,
		loadReceivedShares,
		startCollabSync,
		stopCollabSync,
	}
})

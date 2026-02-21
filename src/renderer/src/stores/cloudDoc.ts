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

const AUTO_SAVE_DEBOUNCE_MS = 1000
const COLLAB_AUTO_SAVE_DEBOUNCE_MS = 900
const COLLAB_LOCAL_QUIET_MS = 600
const COLLAB_REMOTE_QUIET_MS = 900
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
const COLLAB_PENDING_STALE_MS = 12_000
const COLLAB_SAVE_MAX_VERSION_DRIFT = 8

interface CollabPendingOp {
	opId: string
	baseVersion: number
	opType: string
	payload: string
	createdAt: number
	sent: boolean
	sentAt?: number
}

interface CollabDocState {
	serverVersion: number
	pendingOps: CollabPendingOp[]
	ackedOps: Set<string>
	connected: boolean
	inCollabMode: boolean
	inResync: boolean
	pauseSending: boolean
	dirty: boolean
	lastLocalEditAt: number
	lastRemotePatchAt: number
	conflictBackoffUntil: number
}

export interface SharedCloudDoc {
	shareNo: string
	doc: CloudDoc
	friendAccount?: string
	ownerAccount?: string
	shareMode?: 'READONLY' | 'COLLAB' | string
	collaborative?: boolean
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
	const collabOnlineCountByDocId = ref<Record<string, number>>({})
	const collabStateByDocId = ref<Record<string, CollabDocState>>({})

	let saveTimer: ReturnType<typeof setTimeout> | null = null
	let queuedSaveDocId: string | null = null
	let collabSyncTimer: ReturnType<typeof setInterval> | null = null
	let collabSyncDocId: string | null = null
	let collabSyncing = false
	let collabWsBoundDocId: string | null = null
	const localPatchOpIds = new Set<string>()
	const savingDocIds = new Set<string>()

	const activeDoc = computed<CloudDoc | null>(() => {
		if (!activeDocId.value) return null
		return docs.value.find((doc) => doc.id === activeDocId.value) || null
	})
	const activeDocCursors = computed<CollabCursor[]>(() => {
		const docId = String(activeDocId.value || '').trim()
		if (!docId) return []
		return collabCursorsByDocId.value[docId] || []
	})
	const activeDocOnlineCount = computed<number>(() => {
		const docId = String(activeDocId.value || '').trim()
		if (!docId) return 0
		return collabOnlineCountByDocId.value[docId] || 0
	})

	const clearSaveTimer = (): void => {
		if (!saveTimer) return
		clearTimeout(saveTimer)
		saveTimer = null
	}

	const ensureCollabDocState = (
		docId: string,
		seedVersion = 0,
	): CollabDocState => {
		const normalizedDocId = String(docId || '').trim()
		const existing = collabStateByDocId.value[normalizedDocId]
		if (existing) {
			if (seedVersion > 0 && existing.serverVersion <= 0) {
				existing.serverVersion = seedVersion
			}
			return existing
		}
		const created: CollabDocState = {
			serverVersion: Math.max(0, seedVersion),
			pendingOps: [],
			ackedOps: new Set<string>(),
			connected: false,
			inCollabMode: true,
			inResync: false,
			pauseSending: false,
			dirty: false,
			lastLocalEditAt: 0,
			lastRemotePatchAt: 0,
			conflictBackoffUntil: 0,
		}
		collabStateByDocId.value = {
			...collabStateByDocId.value,
			[normalizedDocId]: created,
		}
		return created
	}

	const getCollabDocState = (docId: string): CollabDocState | null => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return null
		return collabStateByDocId.value[normalizedDocId] || null
	}

	const clearCollabDocState = (docId: string): void => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return
		if (!(normalizedDocId in collabStateByDocId.value)) return
		const next = { ...collabStateByDocId.value }
		delete next[normalizedDocId]
		collabStateByDocId.value = next
	}

	const setCollabServerVersion = (docId: string, version: number): void => {
		const normalizedVersion = Number(version)
		if (!Number.isFinite(normalizedVersion) || normalizedVersion < 0) return
		const state = ensureCollabDocState(docId, normalizedVersion)
		state.serverVersion = Math.max(state.serverVersion, normalizedVersion)
	}

	const clearCollabPendingOps = (docId: string): void => {
		const state = getCollabDocState(docId)
		if (!state) return
		state.pendingOps = []
	}

	const takeCollabPendingOp = (
		docId: string,
		opId: string,
	): CollabPendingOp | null => {
		const state = getCollabDocState(docId)
		if (!state) return null
		const normalized = String(opId || '').trim()
		if (!normalized) return null
		const index = state.pendingOps.findIndex(
			(item) => item.opId === normalized,
		)
		if (index < 0) return null
		const [op] = state.pendingOps.splice(index, 1)
		return op || null
	}

	const hasInFlightPendingOp = (docId: string): boolean => {
		const state = getCollabDocState(docId)
		if (!state) return false
		return state.pendingOps.some((item) => item.sent)
	}

	const upsertLatestUnsentPendingOp = (
		docId: string,
		op: CollabPendingOp,
	): void => {
		const state = ensureCollabDocState(docId, op.baseVersion)
		const sentOps = state.pendingOps.filter((item) => item.sent)
		const unsentOps = state.pendingOps.filter((item) => !item.sent)
		if (unsentOps.length > 0) {
			const latestUnsent = unsentOps[unsentOps.length - 1]
			latestUnsent.opId = op.opId
			latestUnsent.baseVersion = op.baseVersion
			latestUnsent.opType = op.opType
			latestUnsent.payload = op.payload
			latestUnsent.createdAt = op.createdAt
			latestUnsent.sent = false
			latestUnsent.sentAt = undefined
			state.pendingOps = [...sentOps, latestUnsent]
			return
		}
		state.pendingOps = [...sentOps, op]
	}

	const markPendingOpSent = (
		docId: string,
		opId: string,
		baseVersion: number,
	): void => {
		const state = getCollabDocState(docId)
		if (!state) return
		const normalized = String(opId || '').trim()
		if (!normalized) return
		const target = state.pendingOps.find((item) => item.opId === normalized)
		if (!target) return
		target.baseVersion = baseVersion
		target.sent = true
		target.sentAt = Date.now()
	}

	const trySendNextPendingPatch = (docId: string): void => {
		const state = getCollabDocState(docId)
		if (!state) return
		if (!state.inCollabMode || state.pauseSending || state.inResync) return
		if (!state.connected) return
		if (hasInFlightPendingOp(docId)) return
		const next = state.pendingOps.find((item) => !item.sent)
		if (!next) return
		const baseVersion =
			state.serverVersion > 0 ? state.serverVersion : next.baseVersion
		const sent = cloudDocWs.sendPatch({
			docId,
			baseVersion,
			opId: next.opId,
			opType: next.opType,
			payload: next.payload,
		})
		if (!sent) {
			console.warn('[cloud-docs.ws] patch:send-failed', {
				docId,
				opId: next.opId,
				baseVersion,
			})
			return
		}
		markPendingOpSent(docId, next.opId, baseVersion)
		console.debug('[cloud-docs.ws] patch:send', {
			docId,
			opId: next.opId,
			baseVersion,
		})
	}

	const shiftCollabPendingOp = (docId: string): CollabPendingOp | null => {
		const state = getCollabDocState(docId)
		if (!state || state.pendingOps.length === 0) return null
		const op = state.pendingOps.shift()
		return op || null
	}

	const pruneStalePendingOps = (docId: string): number => {
		const state = getCollabDocState(docId)
		if (!state || state.pendingOps.length === 0) return 0
		const now = Date.now()
		const before = state.pendingOps.length
		state.pendingOps = state.pendingOps.filter(
			(item) => now - item.createdAt <= COLLAB_PENDING_STALE_MS,
		)
		return before - state.pendingOps.length
	}

	const markLocalPatchOp = (opId: string): void => {
		const normalized = String(opId || '').trim()
		if (!normalized) return
		localPatchOpIds.add(normalized)
		setTimeout(() => {
			localPatchOpIds.delete(normalized)
		}, 30_000)
	}

	const stopCollabSync = (): void => {
		const stoppingDocId = collabSyncDocId
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
		if (stoppingDocId) {
			const state = getCollabDocState(stoppingDocId)
			if (state) {
				state.connected = false
				state.pauseSending = false
				state.inResync = false
				state.pendingOps = []
				state.ackedOps.clear()
			}
		}
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

	const setDocOnlineCount = (docId: string, count: number): void => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return
		const nextCount = Math.max(0, Math.round(count))
		collabOnlineCountByDocId.value = {
			...collabOnlineCountByDocId.value,
			[normalizedDocId]: nextCount,
		}
	}

	const clearDocOnlineCount = (docId: string): void => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return
		if (!(normalizedDocId in collabOnlineCountByDocId.value)) return
		const next = { ...collabOnlineCountByDocId.value }
		delete next[normalizedDocId]
		collabOnlineCountByDocId.value = next
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

	const parsePatchDocSnapshot = (
		event: CloudDocWsEventFrame,
	): {
		title?: string
		contentHtml?: string
		contentJson?: string
		serverVersion?: number
	} | null => {
		const rawData = (event.data || {}) as Record<string, unknown>
		const payloadRaw = rawData.payload
		let payloadObj: Record<string, unknown> | null = null
		if (typeof payloadRaw === 'string' && payloadRaw.trim()) {
			try {
				payloadObj = JSON.parse(payloadRaw) as Record<string, unknown>
			} catch {
				payloadObj = null
			}
		}
		const valueObj =
			(payloadObj?.value as Record<string, unknown> | undefined) || {}
		const title = String(
			payloadObj?.title ?? valueObj.title ?? rawData.title ?? '',
		).trim()
		const contentHtml = String(
			payloadObj?.contentHtml ??
				valueObj.contentHtml ??
				rawData.contentHtml ??
				'',
		)
		const contentJson = String(
			payloadObj?.contentJson ??
				valueObj.contentJson ??
				rawData.contentJson ??
				'',
		)
		const hasAnyBody = !!contentHtml.trim() || !!contentJson.trim()
		const serverVersionNum = Number(rawData.serverVersion)
		const serverVersion = Number.isFinite(serverVersionNum)
			? serverVersionNum
			: undefined
		if (!hasAnyBody && !title) return null
		return {
			title: title || undefined,
			contentHtml: hasAnyBody ? contentHtml : undefined,
			contentJson: hasAnyBody ? contentJson : undefined,
			serverVersion,
		}
	}

	const applyRemotePatchSnapshot = (
		docId: string,
		event: CloudDocWsEventFrame,
	): boolean => {
		const scope = findDocScopeById(docId)
		if (!scope) return false
		const snapshot = parsePatchDocSnapshot(event)
		if (!snapshot) return false
		const localDoc = scope.doc
		const nextDoc = normalizeDoc(
			{
				...localDoc,
				title: snapshot.title ?? localDoc.title,
				contentHtml: snapshot.contentHtml ?? localDoc.contentHtml,
				contentJson: snapshot.contentJson ?? localDoc.contentJson,
				updatedAt: String(event.at || new Date().toISOString()),
				version:
					typeof snapshot.serverVersion === 'number'
						? Math.max(
								localDoc.version || 0,
								snapshot.serverVersion,
							)
						: localDoc.version,
			},
			localDoc,
		)
		const unchanged =
			String(nextDoc.title || '') === String(localDoc.title || '') &&
			String(nextDoc.contentHtml || '') ===
				String(localDoc.contentHtml || '') &&
			String(nextDoc.contentJson || '') ===
				String(localDoc.contentJson || '') &&
			Number(nextDoc.version || 0) <= Number(localDoc.version || 0)
		if (unchanged) return true
		if (scope.sharedRef) {
			upsertSharedDoc({
				...scope.sharedRef,
				shareNo: scope.sharedRef.shareNo,
				doc: nextDoc,
			})
		} else {
			replaceDoc(nextDoc)
		}
		setCollabServerVersion(docId, nextDoc.version)
		return true
	}

	const extractCursorUserId = (
		event: CloudDocWsEventFrame,
		payload: Record<string, unknown>,
	): string => {
		const fromPayload = String(
			payload.account ||
				payload.userId ||
				(payload.user as Record<string, unknown> | undefined)
					?.account ||
				(payload.member as Record<string, unknown> | undefined)
					?.account ||
				'',
		).trim()
		if (fromPayload) return fromPayload
		const fromEvent = String(event.from || '').trim()
		if (!fromEvent || fromEvent.toUpperCase() === 'SYSTEM') return ''
		return fromEvent
	}

	const extractCursorRange = (
		payload: Record<string, unknown>,
	): { anchor: number; head: number } => {
		const nestedCursor =
			(payload.cursor as Record<string, unknown> | undefined) || {}
		const anchorRaw = Number(payload.anchor ?? nestedCursor.anchor)
		const headRaw = Number(payload.head ?? nestedCursor.head)
		const positionRaw = Number(payload.position ?? nestedCursor.position)
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
		return { anchor, head }
	}

	const applyRemoteCollabCursor = (event: CloudDocWsEventFrame): void => {
		const docId = String(event.docId || '').trim()
		if (!docId) return
		const currentAccount = String(userInfoStore.account || '').trim()
		const payload = parseCursorPayload(event)
		if (!payload) return
		const eventType = String(event.eventType || '')
			.trim()
			.toLowerCase()

		if (eventType === 'presence.snapshot') {
			const members = Array.isArray(payload.members)
				? payload.members
				: []
			const nextCursors: CollabCursor[] = members
				.map((member) => member as Record<string, unknown>)
				.map((member) => {
					const account = String(member.account || '').trim()
					const cursor = (member.cursor || {}) as Record<
						string,
						unknown
					>
					const range = extractCursorRange(cursor)
					if (!account) return null
					if (currentAccount && account === currentAccount)
						return null
					return {
						userId: account,
						name: account,
						color: pickCursorColor(account),
						position: range.head,
						anchor: range.anchor,
						head: range.head,
						updatedAt: String(event.at || new Date().toISOString()),
					} as CollabCursor
				})
				.filter((item): item is CollabCursor => !!item)
			collabCursorsByDocId.value = {
				...collabCursorsByDocId.value,
				[docId]: nextCursors,
			}
			const onlineCountRaw = Number(payload.onlineCount)
			setDocOnlineCount(
				docId,
				Number.isFinite(onlineCountRaw)
					? onlineCountRaw
					: nextCursors.length + 1,
			)
			const snapshotVersion = Number(payload.serverVersion)
			if (Number.isFinite(snapshotVersion)) {
				setCollabServerVersion(docId, snapshotVersion)
			}
			return
		}

		const userId = extractCursorUserId(event, payload)
		if (!userId) return
		if (currentAccount && userId === currentAccount) return
		if (eventType === 'cursor.leave' || eventType === 'presence.leave') {
			removeDocCursor(docId, userId)
			const current = collabOnlineCountByDocId.value[docId]
			if (Number.isFinite(current)) {
				setDocOnlineCount(docId, Math.max(0, Number(current) - 1))
			}
			return
		}
		const range = extractCursorRange(payload)
		upsertDocCursor(docId, {
			userId,
			name:
				String(payload.name || payload.userName || userId).trim() ||
				userId,
			color:
				String(payload.color || '').trim() || pickCursorColor(userId),
			position: range.head,
			anchor: range.anchor,
			head: range.head,
			updatedAt: String(event.at || new Date().toISOString()),
		})
		if (eventType === 'presence.join') {
			const current = collabOnlineCountByDocId.value[docId]
			const fallback =
				(collabCursorsByDocId.value[docId] || []).length + 1
			setDocOnlineCount(
				docId,
				Number.isFinite(current) ? Number(current) + 1 : fallback,
			)
		}
	}

	const pullRemoteDocIfNewer = async (docId: string): Promise<void> => {
		const targetId = String(docId || '').trim()
		if (!targetId || collabSyncing) return
		const scope = findDocScopeById(targetId)
		if (!scope) return
		const local = scope.doc
		collabSyncing = true
		try {
			const response = await cloudDocApi.getDoc(targetId)
			const remote = normalizeDoc(response.data.data, local)
			const localVersion = Number(local.version || 0)
			const remoteVersion = Number(remote.version || 0)
			if (remoteVersion <= localVersion) return
			if (scope.sharedRef) {
				upsertSharedDoc({
					...scope.sharedRef,
					shareNo: scope.sharedRef.shareNo,
					doc: remote,
				})
			} else {
				replaceDoc(remote)
			}
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
		const isContentPatchEvent =
			eventType === 'content.patch' ||
			eventType.endsWith('.patch') ||
			eventType.includes('patch')
		if (!isContentPatchEvent) return
		const eventDocId = String(event.docId || '').trim()
		if (!eventDocId) return
		const patchData = (event.data || {}) as Record<string, unknown>
		const patchOpId = String(patchData.opId || '').trim()
		if (patchOpId && localPatchOpIds.has(patchOpId)) {
			return
		}
		const state = ensureCollabDocState(eventDocId)
		state.lastRemotePatchAt = Date.now()
		// 实时优先：先吃 patch 里的正文快照，随后后台兜底 resync。
		const applied = applyRemotePatchSnapshot(eventDocId, event)
		if (!applied) {
			void resyncDocById(eventDocId, 'PATCH_GAP')
			return
		}
		setTimeout(() => {
			void resyncDocById(eventDocId, 'PATCH_GAP')
		}, 400)
	}

	const resyncDocById = async (
		docId: string,
		reason:
			| 'ACK_CONFLICT'
			| 'PATCH_GAP'
			| 'PATCH_PARSE'
			| 'RECONNECT'
			| 'SAVE_409',
	): Promise<void> => {
		const normalizedDocId = String(docId || '').trim()
		if (!normalizedDocId) return
		const scope = findDocScopeById(normalizedDocId)
		if (!scope) return
		const state = ensureCollabDocState(normalizedDocId, scope.doc.version)
		if (state.inResync) return
		state.inResync = true
		state.pauseSending = true
		try {
			console.debug('[cloud-docs.collab] resync:start', {
				docId: normalizedDocId,
				reason,
			})
			const detailResp = await cloudDocApi.getDoc(normalizedDocId)
			const latestDoc = normalizeDoc(detailResp.data.data, scope.doc)
			const localVersion = Number(scope.doc.version || 0)
			const latestVersion = Number(latestDoc.version || 0)
			const sameBody =
				String(latestDoc.contentJson || '') ===
					String(scope.doc.contentJson || '') &&
				String(latestDoc.contentHtml || '') ===
					String(scope.doc.contentHtml || '')
			const shouldForceReplace =
				reason === 'ACK_CONFLICT' || reason === 'SAVE_409'
			if (
				!shouldForceReplace &&
				latestVersion <= localVersion &&
				!sameBody
			) {
				console.warn(
					'[cloud-docs.collab] resync:skip-stale-overwrite',
					{
						docId: normalizedDocId,
						reason,
						localVersion,
						latestVersion,
					},
				)
				return
			}
			if (scope.sharedRef) {
				upsertSharedDoc({
					...scope.sharedRef,
					shareNo: scope.sharedRef.shareNo,
					doc: latestDoc,
				})
			} else {
				replaceDoc(latestDoc)
			}
			state.serverVersion = latestDoc.version
			state.pendingOps = []
			state.ackedOps.clear()
			state.conflictBackoffUntil = 0
			console.debug('[cloud-docs.collab] resync:done', {
				docId: normalizedDocId,
				serverVersion: state.serverVersion,
			})
		} catch (error) {
			console.warn('[cloud-docs.collab] resync:error', {
				docId: normalizedDocId,
				reason,
				error,
			})
		} finally {
			state.inResync = false
			state.pauseSending = false
		}
	}

	const ensureCollabWs = async (docId: string): Promise<void> => {
		const targetId = String(docId || '').trim()
		if (!targetId) return
		const token = await tokenManager.getValidAccessToken()
		if (!token) return
		cloudDocWs.connect(token, {
			onConnected: () => {
				console.info('[cloud-docs.ws] connected')
				const state = ensureCollabDocState(targetId)
				state.connected = true
				if (collabSyncDocId) {
					cloudDocWs.join({ docId: collabSyncDocId })
					collabWsBoundDocId = collabSyncDocId
					trySendNextPendingPatch(collabSyncDocId)
					void resyncDocById(collabSyncDocId, 'RECONNECT')
				}
			},
			onEvent: (event) => {
				console.debug('[cloud-docs.ws] event', event)
				void applyRemoteCollabPatch(event)
			},
			onAck: (ack) => {
				console.debug('[cloud-docs.ws] ack', ack)
				const ackDocId = String(ack.docId || '').trim()
				if (!ackDocId) return
				const state = ensureCollabDocState(ackDocId)
				const ackStatus = String(ack.status || '')
					.trim()
					.toUpperCase()
				const ackOpId = String(ack.opId || '').trim()
				if (ackStatus === 'APPLIED') {
					if (ackOpId) {
						const pending = takeCollabPendingOp(ackDocId, ackOpId)
						state.ackedOps.add(ackOpId)
						if (
							pending &&
							!Number.isFinite(Number(ack.serverVersion))
						) {
							setCollabServerVersion(
								ackDocId,
								pending.baseVersion + 1,
							)
						}
					} else {
						const pending = shiftCollabPendingOp(ackDocId)
						if (
							pending &&
							!Number.isFinite(Number(ack.serverVersion))
						) {
							setCollabServerVersion(
								ackDocId,
								pending.baseVersion + 1,
							)
						}
					}
					const serverVersion = Number(ack.serverVersion)
					if (Number.isFinite(serverVersion)) {
						state.serverVersion = Math.max(
							state.serverVersion,
							serverVersion,
						)
					}
					trySendNextPendingPatch(ackDocId)
					return
				}
				if (ackStatus === 'SENT') {
					const serverVersion = Number(ack.serverVersion)
					if (Number.isFinite(serverVersion)) {
						state.serverVersion = Math.max(
							state.serverVersion,
							serverVersion,
						)
					}
					return
				}
				if (ackStatus === 'DUPLICATE') {
					if (ackOpId) {
						takeCollabPendingOp(ackDocId, ackOpId)
						state.ackedOps.add(ackOpId)
					}
					trySendNextPendingPatch(ackDocId)
					return
				}
				if (ackStatus === 'CONFLICT') {
					void resyncDocById(ackDocId, 'ACK_CONFLICT')
					return
				}
				if (ackStatus === 'REJECTED') {
					if (ackOpId) takeCollabPendingOp(ackDocId, ackOpId)
					void resyncDocById(ackDocId, 'ACK_CONFLICT')
				}
			},
			onError: (payload) => {
				console.warn('[cloud-docs.ws] error', payload)
				const code = String(payload.code || '')
					.trim()
					.toUpperCase()
				const message = String(payload.message || '').trim()
				if (
					code.includes('FORBIDDEN') ||
					code.includes('DENIED') ||
					message.includes('无权限')
				) {
					stopCollabSync()
				}
			},
			onDisconnected: () => {
				const state = getCollabDocState(targetId)
				if (state) state.connected = false
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
		const ownDoc = docs.value.find((item) => item.id === targetId)
		const sharedDoc = sharedDocs.value.find(
			(item) => item.doc.id === targetId,
		)
		const editable = ownDoc?.editable ?? sharedDoc?.doc?.editable ?? true
		if (editable === false) {
			const state = ensureCollabDocState(targetId)
			state.inCollabMode = false
			stopCollabSync()
			return
		}
		const seedVersion =
			(ownDoc?.version ?? sharedDoc?.doc.version ?? 0) || 0
		const state = ensureCollabDocState(targetId, seedVersion)
		state.inCollabMode = true
		state.pauseSending = false
		if (collabSyncDocId === targetId && collabSyncTimer) return
		if (collabWsBoundDocId && collabWsBoundDocId !== targetId) {
			cloudDocWs.leave({ docId: collabWsBoundDocId })
			collabWsBoundDocId = null
		}
		stopCollabSync()
		collabSyncDocId = targetId
		clearDocCursors(targetId)
		clearDocOnlineCount(targetId)
		clearCollabPendingOps(targetId)
		void ensureCollabWs(targetId)
		collabSyncTimer = setInterval(() => {
			void pullRemoteDocIfNewer(targetId)
			trySendNextPendingPatch(targetId)
		}, COLLAB_SYNC_INTERVAL_MS)
	}

	const ensureActiveDoc = (): CloudDoc | null => {
		if (!activeDocId.value) return null
		return docs.value.find((doc) => doc.id === activeDocId.value) || null
	}

	const findDocScopeById = (
		docId: string,
	): { doc: CloudDoc; sharedRef?: SharedCloudDoc } | null => {
		const normalized = String(docId || '').trim()
		if (!normalized) return null
		const ownDoc = docs.value.find((doc) => doc.id === normalized)
		if (ownDoc) return { doc: ownDoc }
		const sharedRef =
			sharedDocs.value.find((item) => item.doc.id === normalized) || null
		if (!sharedRef) return null
		return { doc: sharedRef.doc, sharedRef }
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
		if (savingDocIds.has(docId)) {
			scheduleSave(docId, 300)
			return
		}
		queuedSaveDocId = null
		savingDocIds.add(docId)
		const scope = findDocScopeById(docId)
		if (!scope || scope.doc.editable === false) {
			savingDocIds.delete(docId)
			return
		}
		const target = scope.doc
		const collabState = ensureCollabDocState(target.id, target.version)
		try {
			const now = Date.now()
			if (collabState.inCollabMode && !collabState.dirty) {
				return
			}
			if (
				collabState.inCollabMode &&
				collabState.conflictBackoffUntil > now
			) {
				scheduleSave(
					target.id,
					collabState.conflictBackoffUntil - now + 200,
				)
				return
			}
			const pruned = pruneStalePendingOps(target.id)
			if (pruned > 0) {
				console.warn('[cloud-docs.collab] pending:stale-pruned', {
					docId: target.id,
					pruned,
				})
			}
			if (
				collabState.inCollabMode &&
				(collabState.inResync || collabState.pauseSending)
			) {
				scheduleSave(target.id)
				return
			}
			if (collabState.inCollabMode && collabState.pendingOps.length > 0) {
				if (!collabState.connected) {
					console.warn(
						'[cloud-docs.collab] pending:drop-when-disconnected',
						{
							docId: target.id,
							pending: collabState.pendingOps.length,
						},
					)
					collabState.pendingOps = []
				} else {
					scheduleSave(target.id)
					return
				}
			}
			if (
				collabState.inCollabMode &&
				now - collabState.lastRemotePatchAt < COLLAB_REMOTE_QUIET_MS
			) {
				scheduleSave(target.id, COLLAB_REMOTE_QUIET_MS)
				return
			}
			if (
				collabState.inCollabMode &&
				now - collabState.lastLocalEditAt < COLLAB_LOCAL_QUIET_MS
			) {
				scheduleSave(target.id, COLLAB_LOCAL_QUIET_MS)
				return
			}

			let saveTarget = target
			if (collabState.inCollabMode) {
				try {
					const latestResp = await cloudDocApi.getDoc(target.id)
					const latestDoc = normalizeDoc(latestResp.data.data, target)
					const rebasedDoc = normalizeDoc(
						{
							...latestDoc,
							title: target.title,
							contentHtml: target.contentHtml,
							contentJson: target.contentJson,
							updatedAt: target.updatedAt,
						},
						latestDoc,
					)
					if (scope.sharedRef) {
						upsertSharedDoc({
							...scope.sharedRef,
							doc: rebasedDoc,
							shareNo: scope.sharedRef.shareNo,
						})
					} else {
						replaceDoc(rebasedDoc)
					}
					saveTarget = rebasedDoc
					setCollabServerVersion(target.id, rebasedDoc.version)
				} catch (preflightError) {
					console.warn(
						'[cloud-docs.rest] save:preflight-get-failed',
						{
							docId: target.id,
							error: preflightError,
						},
					)
				}
			}

			const docVersion = Math.max(0, Number(saveTarget.version) || 0)
			const collabVersion = Math.max(
				0,
				Number(collabState.serverVersion) || 0,
			)
			let saveBaseVersion = docVersion
			if (collabState.inCollabMode) {
				const drift = collabVersion - docVersion
				if (
					collabVersion > 0 &&
					drift <= COLLAB_SAVE_MAX_VERSION_DRIFT
				) {
					saveBaseVersion = Math.max(docVersion, collabVersion)
				} else if (drift > COLLAB_SAVE_MAX_VERSION_DRIFT) {
					console.warn(
						'[cloud-docs.collab] save:version-drift-clamped',
						{
							docId: target.id,
							docVersion,
							collabVersion,
						},
					)
				}
			}

			saveState.value = 'saving'
			saveErrorMessage.value = ''
			console.debug('[cloud-docs.rest] save:start', {
				docId: target.id,
				baseVersion: saveBaseVersion,
			})
			const response = await cloudDocApi.saveDoc(target.id, {
				title: saveTarget.title,
				contentHtml: saveTarget.contentHtml,
				contentJson: saveTarget.contentJson,
				baseVersion: saveBaseVersion,
			})
			const saved = response.data.data
			console.debug('[cloud-docs.rest] save:ok', {
				docId: target.id,
				version: saved.version,
				lastSavedAt: saved.lastSavedAt,
			})
			const updated = normalizeDoc(
				{
					...saveTarget,
					updatedAt: saved.updatedAt,
					lastSavedAt: saved.lastSavedAt,
					version: saved.version,
				},
				saveTarget,
			)
			if (scope.sharedRef) {
				upsertSharedDoc({
					...scope.sharedRef,
					doc: updated,
					shareNo: scope.sharedRef.shareNo,
				})
			} else {
				replaceDoc(updated)
			}
			setCollabServerVersion(target.id, updated.version)
			collabState.dirty = false
			collabState.conflictBackoffUntil = 0
			saveState.value = 'saved'
		} catch (error) {
			console.error('保存云文档失败:', error)
			console.warn('[cloud-docs.rest] save:error', {
				docId: target.id,
				error,
			})
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
				if (collabState.inCollabMode) {
					if (Number.isFinite(latestVersion) && latestVersion > 0) {
						try {
							console.warn(
								'[cloud-docs.rest] save:retry-with-latest-version',
								{
									docId: target.id,
									latestVersion,
								},
							)
							setCollabServerVersion(target.id, latestVersion)
							const fastRetryResp = await cloudDocApi.saveDoc(
								target.id,
								{
									title: target.title,
									contentHtml: target.contentHtml,
									contentJson: target.contentJson,
									baseVersion: latestVersion,
								},
							)
							const fastSaved = fastRetryResp.data.data
							const fastUpdated = normalizeDoc(
								{
									...target,
									updatedAt: fastSaved.updatedAt,
									lastSavedAt: fastSaved.lastSavedAt,
									version: fastSaved.version,
								},
								target,
							)
							if (scope.sharedRef) {
								upsertSharedDoc({
									...scope.sharedRef,
									doc: fastUpdated,
									shareNo: scope.sharedRef.shareNo,
								})
							} else {
								replaceDoc(fastUpdated)
							}
							setCollabServerVersion(
								target.id,
								fastUpdated.version,
							)
							collabState.dirty = false
							collabState.conflictBackoffUntil = 0
							saveState.value = 'saved'
							saveErrorMessage.value = ''
							return
						} catch (latestRetryError) {
							console.warn(
								'[cloud-docs.rest] save:retry-with-latest-version-failed',
								{
									docId: target.id,
									latestVersion,
									error: latestRetryError,
								},
							)
						}
					}
					void resyncDocById(target.id, 'SAVE_409')
					const backoffMs = 3000 + Math.floor(Math.random() * 2000)
					collabState.conflictBackoffUntil = Date.now() + backoffMs
					saveState.value = 'idle'
					saveErrorMessage.value =
						'协同编辑中，已自动同步并延迟重试保存'
					scheduleSave(target.id, backoffMs + 200)
					return
				}
				let retryError: unknown = null
				let retrySuccess = false
				for (let attempt = 1; attempt <= 3; attempt += 1) {
					try {
						const latestResp = await cloudDocApi.getDoc(target.id)
						const latestDoc = normalizeDoc(
							latestResp.data.data,
							target,
						)
						const rebasedDoc = normalizeDoc(
							{
								...latestDoc,
								title: target.title,
								contentHtml: target.contentHtml,
								contentJson: target.contentJson,
								updatedAt: target.updatedAt,
							},
							latestDoc,
						)
						if (scope.sharedRef) {
							upsertSharedDoc({
								...scope.sharedRef,
								doc: rebasedDoc,
								shareNo: scope.sharedRef.shareNo,
							})
						} else {
							replaceDoc(rebasedDoc)
						}
						console.debug('[cloud-docs.rest] save:retry', {
							docId: target.id,
							baseVersion: rebasedDoc.version,
							attempt,
						})
						const retryResp = await cloudDocApi.saveDoc(target.id, {
							title: rebasedDoc.title,
							contentHtml: rebasedDoc.contentHtml,
							contentJson: rebasedDoc.contentJson,
							baseVersion: rebasedDoc.version,
						})
						const retrySaved = retryResp.data.data
						const retryUpdatedDoc = normalizeDoc(
							{
								...rebasedDoc,
								updatedAt: retrySaved.updatedAt,
								lastSavedAt: retrySaved.lastSavedAt,
								version: retrySaved.version,
							},
							rebasedDoc,
						)
						if (scope.sharedRef) {
							upsertSharedDoc({
								...scope.sharedRef,
								doc: retryUpdatedDoc,
								shareNo: scope.sharedRef.shareNo,
							})
						} else {
							replaceDoc(retryUpdatedDoc)
						}
						setCollabServerVersion(
							target.id,
							retryUpdatedDoc.version,
						)
						saveState.value = 'saved'
						saveErrorMessage.value = ''
						retrySuccess = true
						break
					} catch (attemptError) {
						retryError = attemptError
						if (
							!axios.isAxiosError(attemptError) ||
							attemptError.response?.status !== 409
						) {
							break
						}
					}
				}
				if (!retrySuccess) {
					console.warn('冲突后自动重试保存失败:', retryError)
					void resyncDocById(target.id, 'SAVE_409')
					saveState.value = 'idle'
					saveErrorMessage.value = Number.isFinite(latestVersion)
						? `协同繁忙，正在自动重试（最新版本 ${latestVersion}）`
						: '协同繁忙，正在自动重试'
					scheduleSave(target.id)
				}
				return
			}
			saveState.value = 'error'
			saveErrorMessage.value = '网络异常，请稍后重试'
		} finally {
			savingDocIds.delete(docId)
		}
	}

	const scheduleSave = (docId: string, customDelayMs?: number): void => {
		queuedSaveDocId = docId
		saveState.value = 'idle'
		saveErrorMessage.value = ''
		clearSaveTimer()
		let delayMs =
			typeof customDelayMs === 'number' && customDelayMs > 0
				? customDelayMs
				: AUTO_SAVE_DEBOUNCE_MS
		if (customDelayMs == null) {
			const state = getCollabDocState(docId)
			if (state?.inCollabMode) {
				delayMs =
					COLLAB_AUTO_SAVE_DEBOUNCE_MS +
					Math.floor(Math.random() * 200)
			}
		}
		saveTimer = setTimeout(() => {
			void flushSave()
		}, delayMs)
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
		setCollabServerVersion(next.id, next.version)
		activeDocId.value = next.id
		if (next.editable !== false) {
			startCollabSync(next.id)
		} else {
			stopCollabSync()
		}
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
			setCollabServerVersion(detail.id, detail.version)
			activeDocId.value = docId
			if (detail.editable !== false) {
				startCollabSync(docId)
			} else {
				stopCollabSync()
			}
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
		if (!doc) return
		updateDocTitleById(doc.id, title)
	}

	const updateDocTitleById = (docId: string, title: string): void => {
		const scope = findDocScopeById(docId)
		if (!scope || scope.doc.editable === false) return
		const doc = scope.doc
		doc.title = title
		doc.updatedAt = new Date().toISOString()
		if (scope.sharedRef) {
			upsertSharedDoc({
				...scope.sharedRef,
				doc: { ...doc },
				shareNo: scope.sharedRef.shareNo,
			})
		} else {
			replaceDoc({ ...doc })
		}
		const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		const payload = JSON.stringify({
			path: '/title',
			value: doc.title,
			title: doc.title,
			contentHtml: doc.contentHtml,
			contentJson: doc.contentJson,
		})
		const state = ensureCollabDocState(doc.id, doc.version)
		if (state.inCollabMode && !state.pauseSending && !state.inResync) {
			state.dirty = true
			state.lastLocalEditAt = Date.now()
			const baseVersion = state.serverVersion || doc.version
			markLocalPatchOp(opId)
			upsertLatestUnsentPendingOp(doc.id, {
				opId,
				baseVersion,
				opType: 'replace',
				payload,
				createdAt: Date.now(),
				sent: false,
			})
			trySendNextPendingPatch(doc.id)
		}
		scheduleSave(doc.id)
	}

	const updateActiveContent = (payload: {
		contentHtml: string
		contentJson: string
	}): void => {
		const doc = ensureActiveDoc()
		if (!doc) return
		updateDocContentById(doc.id, payload)
	}

	const updateDocContentById = (
		docId: string,
		payload: { contentHtml: string; contentJson: string },
	): void => {
		const scope = findDocScopeById(docId)
		if (!scope || scope.doc.editable === false) return
		const doc = scope.doc
		doc.contentHtml = payload.contentHtml
		doc.contentJson = payload.contentJson
		doc.updatedAt = new Date().toISOString()
		if (scope.sharedRef) {
			upsertSharedDoc({
				...scope.sharedRef,
				doc: { ...doc },
				shareNo: scope.sharedRef.shareNo,
			})
		} else {
			replaceDoc({ ...doc })
		}
		const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		const payloadForPatch = JSON.stringify({
			path: '/content',
			value: {
				title: doc.title,
				contentHtml: doc.contentHtml,
				contentJson: doc.contentJson,
			},
			title: doc.title,
			contentHtml: doc.contentHtml,
			contentJson: doc.contentJson,
		})
		const state = ensureCollabDocState(doc.id, doc.version)
		if (state.inCollabMode && !state.pauseSending && !state.inResync) {
			state.dirty = true
			state.lastLocalEditAt = Date.now()
			const baseVersion = state.serverVersion || doc.version
			markLocalPatchOp(opId)
			upsertLatestUnsentPendingOp(doc.id, {
				opId,
				baseVersion,
				opType: 'replace',
				payload: payloadForPatch,
				createdAt: Date.now(),
				sent: false,
			})
			trySendNextPendingPatch(doc.id)
		}
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
		clearDocOnlineCount(docId)
		clearCollabDocState(docId)
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
			shareMode: payload.shareMode,
			collaborative: payload.collaborative,
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
			shareMode: shareResult?.shareMode,
			collaborative: shareResult?.shareMode === 'COLLAB',
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
				editable: item.shareMode === 'COLLAB',
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
			shareMode: item.shareMode,
			collaborative: item.shareMode === 'COLLAB',
			status: item.status,
			expired: item.expired,
			createdAt: item.createdAt,
			expireAt: item.expireAt ?? null,
			lastViewedAt: item.lastViewedAt ?? null,
		}
	}

	const removeSharedDocByShareNo = (shareNo: string): void => {
		const normalizedShareNo = String(shareNo || '').trim()
		if (!normalizedShareNo) return
		sharedDocs.value = sharedDocs.value.filter(
			(item) => item.shareNo !== normalizedShareNo,
		)
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
				title: detail.title || DEFAULT_SHARED_DOC_TITLE,
			},
			undefined,
		)
		if (normalizedDoc.deleted) {
			removeSharedDocByShareNo(normalizedShareNo)
			return null
		}
		const shareMode = String(payload.shareMode || '').trim() || undefined
		const upserted = upsertSharedDoc({
			shareNo: String(payload.shareNo || normalizedShareNo),
			doc: normalizedDoc,
			ownerAccount: normalizedDoc.ownerAccount,
			shareMode,
			collaborative:
				typeof payload.collaborative === 'boolean'
					? payload.collaborative
					: shareMode === 'COLLAB',
			status: 'ACTIVE',
			expired: false,
		})
		setCollabServerVersion(upserted.doc.id, upserted.doc.version)
		return upserted
	}

	const getDocCursors = (docId: string): CollabCursor[] => {
		const key = String(docId || '').trim()
		if (!key) return []
		return collabCursorsByDocId.value[key] || []
	}

	const getDocOnlineCount = (docId: string): number => {
		const key = String(docId || '').trim()
		if (!key) return 0
		return collabOnlineCountByDocId.value[key] || 0
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

			// 过滤已删除或已不可访问的分享文档，避免在列表展示僵尸条目。
			const resolvedList = await Promise.all(
				mapped.map(async (item) => {
					try {
						const detailResp = await cloudDocApi.getSharedDoc(
							item.shareNo,
						)
						const payload = detailResp.data.data || {}
						const detail = payload.doc
						if (!detail?.id) return null
						const normalizedDoc = normalizeDoc(
							{
								...detail,
								title: detail.title || DEFAULT_SHARED_DOC_TITLE,
							},
							item.doc,
						)
						if (normalizedDoc.deleted) return null
						const shareMode =
							String(payload.shareMode || '').trim() ||
							item.shareMode
						return {
							...item,
							doc: normalizedDoc,
							shareMode,
							collaborative:
								typeof payload.collaborative === 'boolean'
									? payload.collaborative
									: shareMode === 'COLLAB',
							status: 'ACTIVE',
							expired: false,
						} as SharedCloudDoc
					} catch {
						return null
					}
				}),
			)
			const visible = resolvedList.filter(
				(item): item is SharedCloudDoc => !!item,
			)
			sharedDocs.value = visible
			for (const item of visible) {
				setCollabServerVersion(item.doc.id, item.doc.version)
			}
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
		activeDocOnlineCount,
		init,
		createDoc,
		selectDoc,
		updateActiveTitle,
		updateActiveContent,
		updateDocTitleById,
		updateDocContentById,
		flushSave,
		deleteDoc,
		upsertSharedDoc,
		cacheSharedDocFromShareResult,
		fetchSharedDocByShareNo,
		loadReceivedShares,
		startCollabSync,
		stopCollabSync,
		getDocCursors,
		getDocOnlineCount,
	}
})

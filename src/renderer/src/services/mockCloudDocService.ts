import type { CloudDoc } from '@renderer/types/cloudDoc'

const CLOUD_DOCS_STORAGE_KEY = 'mock-cloud-docs:v1'
const MOCK_DELAY_MS = 180

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms)
	})

const readDocsFromStorage = (): CloudDoc[] => {
	try {
		const raw = window.localStorage.getItem(CLOUD_DOCS_STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return []
		return parsed
			.filter(
				(item): item is Omit<CloudDoc, 'contentJson'> & {
					contentJson?: string
				} =>
					!!item &&
					typeof item.id === 'string' &&
					typeof item.title === 'string' &&
					typeof item.contentHtml === 'string' &&
					typeof item.createdAt === 'string' &&
					typeof item.updatedAt === 'string',
			)
			.map((item) => ({
				...item,
				contentJson: typeof item.contentJson === 'string' ? item.contentJson : '',
			}))
	} catch {
		return []
	}
}

const writeDocsToStorage = (docs: CloudDoc[]): void => {
	window.localStorage.setItem(CLOUD_DOCS_STORAGE_KEY, JSON.stringify(docs))
}

const sortByUpdatedAt = (docs: CloudDoc[]): CloudDoc[] =>
	[...docs].sort((a, b) => {
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	})

const generateDocId = (): string =>
	`doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const mockCloudDocService = {
	async listDocs(): Promise<CloudDoc[]> {
		await sleep(MOCK_DELAY_MS)
		return sortByUpdatedAt(readDocsFromStorage())
	},

	async createDoc(): Promise<CloudDoc> {
		await sleep(MOCK_DELAY_MS)
		const docs = readDocsFromStorage()
		const now = new Date().toISOString()
		const next: CloudDoc = {
			id: generateDocId(),
			title: '未标题云文档',
			contentHtml: '',
			contentJson: '',
			createdAt: now,
			updatedAt: now,
			lastSavedAt: now,
		}
		const merged = sortByUpdatedAt([next, ...docs])
		writeDocsToStorage(merged)
		return next
	},

	async updateDoc(
		docId: string,
		payload: Pick<CloudDoc, 'title' | 'contentHtml' | 'contentJson'>,
	): Promise<CloudDoc | null> {
		await sleep(MOCK_DELAY_MS)
		const docs = readDocsFromStorage()
		const targetIndex = docs.findIndex((doc) => doc.id === docId)
		if (targetIndex === -1) return null
		const now = new Date().toISOString()
		const target = docs[targetIndex]
		const updated: CloudDoc = {
			...target,
			title: payload.title,
			contentHtml: payload.contentHtml,
			contentJson: payload.contentJson,
			updatedAt: now,
			lastSavedAt: now,
		}
		docs[targetIndex] = updated
		writeDocsToStorage(sortByUpdatedAt(docs))
		return updated
	},

	async deleteDoc(docId: string): Promise<void> {
		await sleep(MOCK_DELAY_MS)
		const docs = readDocsFromStorage()
		const filtered = docs.filter((doc) => doc.id !== docId)
		writeDocsToStorage(filtered)
	},
}

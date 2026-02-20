import { computed, ref } from 'vue'
import type {
	CloudDoc,
	StructuredDoc,
	StructuredDocBlock,
	DocPatch,
	CollabCursor,
} from '@renderer/types/cloudDoc'

interface TiptapNode {
	type?: string
	text?: string
	attrs?: Record<string, unknown>
	content?: TiptapNode[]
}

const BLOCK_NODE_TYPES = new Set([
	'paragraph',
	'heading',
	'taskList',
	'taskItem',
	'bulletList',
	'orderedList',
	'listItem',
	'blockquote',
	'codeBlock',
	'horizontalRule',
	'image',
	'table',
	'tableRow',
	'callout',
])

const toPlainText = (node?: TiptapNode): string => {
	if (!node) return ''
	if (typeof node.text === 'string') return node.text
	if (!Array.isArray(node.content)) return ''
	return node.content.map((child) => toPlainText(child)).join('')
}

const serializeBlock = (node: TiptapNode, index: number): StructuredDocBlock => {
	const rawType = node.type || 'paragraph'
	const type = rawType === 'taskList' ? 'todo' : rawType
	const attrs = node.attrs || {}
	return {
		id:
			typeof attrs.blockId === 'string' && attrs.blockId
				? attrs.blockId
				: `block_${index}_${Date.now()}`,
		type,
		content: toPlainText(node),
		attrs,
		children: Array.isArray(node.content)
			? node.content
					.filter((child) => !!child && typeof child === 'object')
					.map((child, childIndex) => serializeBlock(child, childIndex))
			: undefined,
	}
}

const parseBlocksFromJson = (contentJson: string): StructuredDocBlock[] => {
	if (!contentJson) return []
	try {
		const parsed = JSON.parse(contentJson) as TiptapNode
		const nodes = Array.isArray(parsed?.content) ? parsed.content : []
		return nodes
			.filter((node) => BLOCK_NODE_TYPES.has(node?.type || ''))
			.map((node, index) => serializeBlock(node, index))
	} catch {
		return []
	}
}

export const useDocumentStore = (doc: CloudDoc) => {
	const draftStorageKey = `cloud-doc-draft:${doc.id}`
	const version = ref(1)
	const patches = ref<DocPatch[]>([])
	const cursors = ref<CollabCursor[]>([])
	const structuredDoc = ref<StructuredDoc>({
		id: doc.id,
		title: doc.title,
		blocks: parseBlocksFromJson(doc.contentJson),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
		version: 1,
	})

	const updateTitle = (title: string): void => {
		structuredDoc.value.title = title
	}

	const updateFromContentJson = (contentJson: string): void => {
		structuredDoc.value.blocks = parseBlocksFromJson(contentJson)
	}

	const recordPatch = (summary: string): void => {
		version.value += 1
		structuredDoc.value.version = version.value
		structuredDoc.value.updatedAt = new Date().toISOString()
		patches.value.push({
			version: version.value,
			timestamp: structuredDoc.value.updatedAt,
			summary,
		})
	}

	const setCursor = (cursor: CollabCursor): void => {
		const index = cursors.value.findIndex((item) => item.userId === cursor.userId)
		if (index < 0) {
			cursors.value.push(cursor)
			return
		}
		cursors.value[index] = cursor
	}

	const exportJson = computed(() => JSON.stringify(structuredDoc.value, null, 2))

	const saveDraft = (): void => {
		window.localStorage.setItem(
			draftStorageKey,
			JSON.stringify({
				version: version.value,
				structuredDoc: structuredDoc.value,
			}),
		)
	}

	const loadDraft = (): StructuredDoc | null => {
		const raw = window.localStorage.getItem(draftStorageKey)
		if (!raw) return null
		try {
			const parsed = JSON.parse(raw) as {
				version?: number
				structuredDoc?: StructuredDoc
			}
			if (!parsed?.structuredDoc) return null
			structuredDoc.value = parsed.structuredDoc
			version.value = Number.isFinite(parsed.version)
				? Number(parsed.version)
				: structuredDoc.value.version
			return structuredDoc.value
		} catch {
			return null
		}
	}

	const loadFromJson = (raw: string): StructuredDoc | null => {
		try {
			const parsed = JSON.parse(raw) as StructuredDoc
			if (!parsed || !parsed.id || !Array.isArray(parsed.blocks)) return null
			structuredDoc.value = {
				...parsed,
				version: Number.isFinite(parsed.version) ? parsed.version : version.value,
			}
			version.value = structuredDoc.value.version
			return structuredDoc.value
		} catch {
			return null
		}
	}

	return {
		structuredDoc,
		version,
		patches,
		cursors,
		exportJson,
		updateTitle,
		updateFromContentJson,
		recordPatch,
		setCursor,
		loadFromJson,
		saveDraft,
		loadDraft,
	}
}

export interface CloudDoc {
	id: string
	title: string
	contentHtml: string
	contentJson: string
	createdAt: string
	updatedAt: string
	lastSavedAt: string | null
}

export type CloudDocSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface StructuredDocBlock {
	id: string
	type: string
	content: string
	attrs?: Record<string, unknown>
	children?: StructuredDocBlock[]
}

export interface StructuredDoc {
	id: string
	title: string
	blocks: StructuredDocBlock[]
	createdAt: string
	updatedAt: string
	version: number
}

export interface DocPatch {
	version: number
	timestamp: string
	summary: string
}

export interface CollabCursor {
	userId: string
	name: string
	color: string
	position: number
}

import { Extension, Mark, type JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'

const MOVABLE_TOP_LEVEL_NODE_TYPES = new Set([
	'paragraph',
	'heading',
	'taskList',
	'bulletList',
	'orderedList',
	'blockquote',
	'codeBlock',
	'horizontalRule',
	'image',
	'table',
])

const BLOCK_ID_NODE_TYPES = [
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
] as const

const createBlockId = (): string =>
	`block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const findMovableTopLevelByBlockId = (
	doc: ProseMirrorNode,
	blockId: string,
): { pos: number; node: ProseMirrorNode; index: number } | null => {
	for (let i = 0, pos = 0; i < doc.childCount; i += 1) {
		const child = doc.child(i)
		if (!MOVABLE_TOP_LEVEL_NODE_TYPES.has(child.type.name)) {
			pos += child.nodeSize
			continue
		}
		if (child.attrs?.blockId === blockId) {
			return { pos, node: child, index: i }
		}
		let matched = false
		child.descendants((node) => {
			if (node.attrs?.blockId === blockId) {
				matched = true
				return false
			}
			return true
		})
		if (matched) {
			return { pos, node: child, index: i }
		}
		pos += child.nodeSize
	}
	return null
}

const cloneWithNewBlockIds = (content: JSONContent): JSONContent => {
	const nextAttrs = {
		...(content.attrs || {}),
		blockId: createBlockId(),
	}
	const children = Array.isArray(content.content)
		? content.content.map((child) => cloneWithNewBlockIds(child))
		: undefined
	return {
		...content,
		attrs: nextAttrs,
		content: children,
	}
}

export const HighlightMark = Mark.create({
	name: 'customHighlight',
	parseHTML() {
		return [
			{
				tag: 'mark',
			},
			{
				style: 'background-color',
			},
		]
	},
	renderHTML({ HTMLAttributes }) {
		return [
			'mark',
			{
				...HTMLAttributes,
				style:
					HTMLAttributes.style ||
					'background-color: rgba(250, 204, 21, 0.35);',
			},
			0,
		]
	},
	addCommands() {
		return {
			toggleCustomHighlight:
				() =>
				({ commands }) =>
					commands.toggleMark(this.name),
		}
	},
})

export const BlockKitExtension = Extension.create({
	name: 'blockKit',
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction: (transactions, _oldState, newState) => {
					// 仅在真实文档变更后做补齐，避免无意义事务
					if (!transactions.some((tr) => tr.docChanged)) return null
					let tr = newState.tr
					let changed = false
					newState.doc.descendants((node, pos) => {
						if (!BLOCK_ID_NODE_TYPES.includes(node.type.name as any)) return true
						if (node.attrs?.blockId) return true
						tr = tr.setNodeMarkup(pos, undefined, {
							...node.attrs,
							blockId: createBlockId(),
						})
						changed = true
						return true
					})
					return changed ? tr : null
				},
			}),
		]
	},
	addGlobalAttributes() {
		return [
			{
				types: [...BLOCK_ID_NODE_TYPES],
				attributes: {
					blockId: {
						default: null,
						parseHTML: (el) => el.getAttribute('data-block-id'),
						renderHTML: (attrs) => {
							if (!attrs.blockId) return {}
							return {
								'data-block-id': attrs.blockId,
							}
						},
					},
				},
			},
		]
	},
	addCommands() {
		return {
			ensureBlockIds:
				() =>
				({ state, dispatch }) => {
					let tr = state.tr
					let changed = false
					state.doc.descendants((node, pos) => {
						if (!BLOCK_ID_NODE_TYPES.includes(node.type.name as any)) return true
						if (node.attrs?.blockId) return true
						tr = tr.setNodeMarkup(pos, undefined, {
							...node.attrs,
							blockId: createBlockId(),
						})
						changed = true
						return true
					})
					if (!changed) return false
					dispatch?.(tr)
					return true
				},
			moveBlockById:
				(blockId: string, targetBlockId: string, before = true) =>
				({ state, dispatch }) => {
					if (!blockId || !targetBlockId || blockId === targetBlockId) return false
					const source = findMovableTopLevelByBlockId(state.doc, blockId)
					const target = findMovableTopLevelByBlockId(state.doc, targetBlockId)
					if (!source || !target) return false
					const sourceEnd = source.pos + source.node.nodeSize
					let insertPos = before
						? target.pos
						: target.pos + target.node.nodeSize
					if (source.pos < insertPos) {
						insertPos -= source.node.nodeSize
					}
					let tr = state.tr
					const sourceSlice = state.doc.slice(source.pos, sourceEnd)
					tr = tr.delete(source.pos, sourceEnd)
					tr = tr.insert(insertPos, sourceSlice.content)
					dispatch?.(tr.scrollIntoView())
					return true
				},
			moveBlockByOffset:
				(blockId: string, offset: -1 | 1) =>
				({ state }) => {
					const source = findMovableTopLevelByBlockId(state.doc, blockId)
					if (!source) return false
					const targetIndex = source.index + offset
					if (
						targetIndex < 0 ||
						targetIndex >= state.doc.childCount
					) {
						return false
					}
					const target = state.doc.child(targetIndex)
					const targetId = target.attrs?.blockId
					if (!targetId) return false
					return (this.editor.commands as any).moveBlockById(
						blockId,
						targetId,
						offset < 0,
					)
				},
			deleteBlockById:
				(blockId: string) =>
				({ state, dispatch }) => {
					const source = findMovableTopLevelByBlockId(state.doc, blockId)
					if (!source) return false
					const tr = state.tr.delete(
						source.pos,
						source.pos + source.node.nodeSize,
					)
					dispatch?.(tr)
					return true
				},
			duplicateBlockById:
				(blockId: string) =>
				({ state, dispatch }) => {
					const source = findMovableTopLevelByBlockId(state.doc, blockId)
					if (!source) return false
					const json = source.node.toJSON() as JSONContent
					const cloned = cloneWithNewBlockIds(json)
					let tr = state.tr
					tr = tr.insert(
						source.pos + source.node.nodeSize,
						state.schema.nodeFromJSON(cloned),
					)
					dispatch?.(tr)
					return true
				},
		}
	},
})

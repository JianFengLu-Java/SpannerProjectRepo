import '@tiptap/core'

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		blockKit: {
			ensureBlockIds: () => ReturnType
			moveBlockById: (
				blockId: string,
				targetBlockId: string,
				before?: boolean,
			) => ReturnType
			moveBlockByOffset: (blockId: string, offset: -1 | 1) => ReturnType
			deleteBlockById: (blockId: string) => ReturnType
			duplicateBlockById: (blockId: string) => ReturnType
		}
		tableBlock: {
			insertTableBlock: (attrs?: { rows?: number; cols?: number }) => ReturnType
		}
		customHighlight: {
			toggleCustomHighlight: () => ReturnType
		}
		fontSize: {
			setFontSize: (size: string) => ReturnType
			unsetFontSize: () => ReturnType
		}
	}
}

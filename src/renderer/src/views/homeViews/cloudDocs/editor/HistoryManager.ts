import { ref } from 'vue'

interface HistorySnapshot {
	timestamp: string
	contentHtml: string
	contentJson: string
}

const MAX_HISTORY_LENGTH = 100

export const useHistoryManager = () => {
	const history = ref<HistorySnapshot[]>([])
	const pointer = ref(-1)

	const push = (snapshot: Omit<HistorySnapshot, 'timestamp'>): void => {
		const last = history.value[pointer.value]
		if (
			last &&
			last.contentHtml === snapshot.contentHtml &&
			last.contentJson === snapshot.contentJson
		) {
			return
		}

		if (pointer.value < history.value.length - 1) {
			history.value = history.value.slice(0, pointer.value + 1)
		}

		history.value.push({
			timestamp: new Date().toISOString(),
			...snapshot,
		})

		if (history.value.length > MAX_HISTORY_LENGTH) {
			history.value.shift()
		}

		pointer.value = history.value.length - 1
	}

	const undo = (): HistorySnapshot | null => {
		if (pointer.value <= 0) return null
		pointer.value -= 1
		return history.value[pointer.value] || null
	}

	const redo = (): HistorySnapshot | null => {
		if (pointer.value >= history.value.length - 1) return null
		pointer.value += 1
		return history.value[pointer.value] || null
	}

	const canUndo = (): boolean => pointer.value > 0
	const canRedo = (): boolean => pointer.value < history.value.length - 1

	return {
		history,
		pointer,
		push,
		undo,
		redo,
		canUndo,
		canRedo,
	}
}

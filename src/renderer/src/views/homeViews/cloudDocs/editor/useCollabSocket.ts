import { onBeforeUnmount, ref } from 'vue'
import type { DocPatch } from '@renderer/types/cloudDoc'

interface UseCollabSocketOptions {
	docId: string
	onRemotePatch?: (patch: DocPatch) => void
}

export const useCollabSocket = (options: UseCollabSocketOptions) => {
	const connected = ref(false)
	const lastError = ref('')

	// 预留：后续可替换为真实 ws 实现
	let timer: ReturnType<typeof setTimeout> | null = null

	const connect = (): void => {
		if (connected.value) return
		connected.value = true
		lastError.value = ''
	}

	const disconnect = (): void => {
		connected.value = false
		if (timer) {
			clearTimeout(timer)
			timer = null
		}
	}

	const sendPatch = (patch: DocPatch): void => {
		if (!connected.value) return
		if (!options.onRemotePatch) return
		// 模拟网络延迟和回包
		timer = setTimeout(() => {
			options.onRemotePatch?.(patch)
		}, 60)
	}

	onBeforeUnmount(disconnect)

	return {
		connected,
		lastError,
		connect,
		disconnect,
		sendPatch,
	}
}

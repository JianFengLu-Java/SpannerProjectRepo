export interface MockVideoCallSession {
	id: string
	peerName: string
	startedAt: number
}

export const createMockVideoCallSession = (
	peerName: string,
): MockVideoCallSession => {
	const normalizedPeerName = peerName.trim() || '对方'
	return {
		id: `mock-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		peerName: normalizedPeerName,
		startedAt: Date.now(),
	}
}

export const getMockConnectDelayMs = (seed: string): number => {
	let hash = 0
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
	}
	return 1000 + (hash % 1400)
}

export const formatMockCallDuration = (seconds: number): string => {
	const safeSeconds = Math.max(0, Math.floor(seconds))
	const minute = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
	const second = String(safeSeconds % 60).padStart(2, '0')
	return `${minute}:${second}`
}

import { videoCallApi } from './videoCallApi'

type Role = 'caller' | 'callee'

interface StartOptions {
	callId: string
	role: Role
	peerAccount: string
	callType: 'video' | 'audio'
}

interface SignalPayload {
	signalType: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'RENEGOTIATE'
	from: string
	to?: string
	sdp?: string | { type?: string; sdp?: string } | null
	candidate?:
		| string
		| { candidate?: string; sdpMid?: string; sdpMLineIndex?: number }
		| null
	sdpMid?: string | null
	sdpMLineIndex?: number | null
}

export class WebRtcCallClient {
	private pc: RTCPeerConnection | null = null
	private localStream: MediaStream | null = null
	private remoteStream: MediaStream | null = null
	private callId = ''
	private role: Role = 'caller'
	private peerAccount = ''
	private callType: 'video' | 'audio' = 'video'
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null
	private offerRetryTimer: ReturnType<typeof setInterval> | null = null
	private pendingCandidates: RTCIceCandidateInit[] = []
	private lastOfferSdp = ''
	private offerRetryCount = 0

	onLocalStream?: (stream: MediaStream | null) => void
	onRemoteStream?: (stream: MediaStream | null) => void
	onConnectionStateChange?: (state: RTCPeerConnectionState) => void
	onError?: (error: unknown) => void
	onDebug?: (line: string) => void

	private debug(message: string, payload?: unknown): void {
		if (!this.onDebug) return
		if (payload === undefined) {
			this.onDebug(message)
			return
		}
		let tail = ''
		try {
			tail = ` ${JSON.stringify(payload)}`
		} catch {
			tail = ` ${String(payload)}`
		}
		this.onDebug(`${message}${tail}`)
	}

	private normalizeSdpText(rawSdp: string): string {
		let text = rawSdp
		text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
		// Recover escaped line breaks from JSON-escaped transport payloads.
		text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n')
		text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
		// Some relays accidentally collapse line breaks to spaces.
		if (!text.includes('\n') && /\b[a-z]=/i.test(text)) {
			text = text.replace(/\s+(?=[a-z]=)/g, '\n')
		}
		// Normalize to RFC-compatible CRLF endings.
		const lines = text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
		const normalized = `${lines.join('\r\n')}\r\n`
		this.debug('[RTC] normalize sdp', {
			rawLength: rawSdp.length,
			normalizedLength: normalized.length,
			rawHasEscapedBreaks: /\\r\\n|\\n|\\r/.test(rawSdp),
			rawHasBreaks: /\r|\n/.test(rawSdp),
			lineCount: lines.length,
		})
		return normalized
	}

	private stripOptionalSsrcLines(sdpText: string): string {
		const lines = sdpText
			.replace(/\r\n/g, '\n')
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
		const filtered = lines.filter(
			(line) =>
				!line.startsWith('a=ssrc:') && !line.startsWith('a=ssrc-group:'),
		)
		const output = `${filtered.join('\r\n')}\r\n`
		this.debug('[RTC] strip ssrc lines', {
			before: lines.length,
			after: filtered.length,
		})
		return output
	}

	private async sendSignal(
		payload: Parameters<typeof videoCallApi.sendSignal>[1],
	): Promise<void> {
		try {
			const response = await videoCallApi.sendSignal(this.callId, payload)
			this.debug('[API] send signal ok', {
				signalType: payload.signalType,
				to: payload.to,
				accepted: response.data?.data?.accepted,
			})
		} catch (error) {
			this.debug('[API] send signal failed', {
				signalType: payload.signalType,
				to: payload.to,
				error: String(error),
			})
			throw error
		}
	}

	async start(options: StartOptions): Promise<void> {
		this.callId = options.callId
		this.role = options.role
		this.peerAccount = options.peerAccount
		this.callType = options.callType
		this.debug('[RTC] start', {
			callId: this.callId,
			role: this.role,
			peerAccount: this.peerAccount,
			callType: this.callType,
		})
		this.remoteStream = new MediaStream()
		this.onRemoteStream?.(this.remoteStream)

		const iceServers = await this.loadIceServers()
		this.debug('[RTC] loaded ice servers', { count: iceServers.length })
		this.pc = new RTCPeerConnection({
			iceServers,
		})
		this.pc.onicecandidate = (event) => {
			if (!event.candidate) return
			this.debug('[RTC] local ICE candidate', {
				sdpMid: event.candidate.sdpMid,
				sdpMLineIndex: event.candidate.sdpMLineIndex,
			})
			void this.sendSignal({
				signalType: 'ICE_CANDIDATE',
				to: this.peerAccount,
				candidate: event.candidate.candidate,
				sdpMid: event.candidate.sdpMid,
				sdpMLineIndex: event.candidate.sdpMLineIndex,
			}).catch(() => {
				// ignore and continue ICE gathering
			})
		}
		this.pc.ontrack = (event) => {
			this.debug('[RTC] remote track', {
				kind: event.track.kind,
				id: event.track.id,
			})
			if (!this.remoteStream) return
			for (const track of event.streams[0]?.getTracks() || [event.track]) {
				this.remoteStream.addTrack(track)
			}
			this.onRemoteStream?.(this.remoteStream)
		}
		this.pc.onconnectionstatechange = () => {
			if (!this.pc) return
			this.debug('[RTC] connection state', this.pc.connectionState)
			this.debug('[RTC] descriptions', {
				signalingState: this.pc.signalingState,
				local: this.pc.localDescription?.type || null,
				remote: this.pc.remoteDescription?.type || null,
			})
			this.onConnectionStateChange?.(this.pc.connectionState)
			if (
				this.pc.connectionState === 'connected' ||
				this.pc.connectionState === 'closed' ||
				this.pc.connectionState === 'failed'
			) {
				this.stopOfferRetry()
			}
		}

		await this.ensureLocalStream(this.callType)
		if (this.localStream) {
			this.debug('[RTC] local stream ready', {
				audioTracks: this.localStream.getAudioTracks().length,
				videoTracks: this.localStream.getVideoTracks().length,
			})
			for (const track of this.localStream.getTracks()) {
				this.pc.addTrack(track, this.localStream)
			}
			this.onLocalStream?.(this.localStream)
		}

		if (this.role === 'caller') {
			const offer = await this.pc.createOffer({
				offerToReceiveAudio: true,
				offerToReceiveVideo: this.callType === 'video',
			})
			await this.pc.setLocalDescription(offer)
			this.lastOfferSdp = offer.sdp || ''
			this.offerRetryCount = 0
			this.debug('[RTC] send OFFER', { sdpLength: offer.sdp?.length || 0 })
			await this.sendSignal({
				signalType: 'OFFER',
				to: this.peerAccount,
				sdp: offer.sdp || '',
			})
			this.startOfferRetry()
		}

		this.heartbeatTimer = setInterval(() => {
			void videoCallApi.heartbeat(this.callId).catch(() => {
				// ignore heartbeat failures
			})
		}, 15000)
	}

	async handleSignal(payload: SignalPayload): Promise<void> {
		if (!this.pc) return
		this.debug('[RTC] handle signal', {
			signalType: payload.signalType,
			from: payload.from,
			sdpLength:
				typeof payload.sdp === 'string'
					? payload.sdp.length
					: String(payload.sdp?.sdp || '').length || 0,
		})
		const resolveSdpText = (
			value: SignalPayload['sdp'],
		): string | undefined => {
			if (typeof value === 'string') {
				const text = value.trim()
				return text ? this.normalizeSdpText(text) : undefined
			}
			if (value && typeof value === 'object') {
				const text = String(value.sdp || '').trim()
				return text ? this.normalizeSdpText(text) : undefined
			}
			return undefined
		}
		const resolveCandidateInit = (
			value: SignalPayload['candidate'],
			sdpMid?: string | null,
			sdpMLineIndex?: number | null,
		): RTCIceCandidateInit | null => {
			if (typeof value === 'string') {
				const candidate = value.trim()
				if (!candidate) return null
				return {
					candidate,
					sdpMid: sdpMid || undefined,
					sdpMLineIndex:
						typeof sdpMLineIndex === 'number'
							? sdpMLineIndex
							: undefined,
				}
			}
			if (value && typeof value === 'object') {
				const candidate = String(value.candidate || '').trim()
				if (!candidate) return null
				return {
					candidate,
					sdpMid: String(value.sdpMid || sdpMid || '').trim() || undefined,
					sdpMLineIndex:
						typeof value.sdpMLineIndex === 'number'
							? value.sdpMLineIndex
							: typeof sdpMLineIndex === 'number'
								? sdpMLineIndex
								: undefined,
				}
			}
			return null
		}

		if (payload.signalType === 'OFFER') {
			try {
				const sdpText = resolveSdpText(payload.sdp)
				if (!sdpText) {
					this.debug('[RTC] OFFER missing sdp', payload)
					return
				}
				await this.pc.setRemoteDescription(
					new RTCSessionDescription({
						type: 'offer',
						sdp: sdpText,
					}),
				)
				const answer = await this.pc.createAnswer()
				await this.pc.setLocalDescription(answer)
				this.debug('[RTC] send ANSWER', {
					sdpLength: answer.sdp?.length || 0,
				})
				await this.sendSignal({
					signalType: 'ANSWER',
					to: this.peerAccount,
					sdp: answer.sdp || '',
				})
				await this.flushPendingCandidates()
			} catch (error) {
				const reason = String(error || '')
				if (reason.includes('Invalid SDP line')) {
					try {
						const sdpText = resolveSdpText(payload.sdp)
						if (sdpText) {
							const sanitized = this.stripOptionalSsrcLines(sdpText)
							await this.pc.setRemoteDescription(
								new RTCSessionDescription({
									type: 'offer',
									sdp: sanitized,
								}),
							)
							const answer = await this.pc.createAnswer()
							await this.pc.setLocalDescription(answer)
							this.debug('[RTC] send ANSWER (sanitized)', {
								sdpLength: answer.sdp?.length || 0,
							})
							await this.sendSignal({
								signalType: 'ANSWER',
								to: this.peerAccount,
								sdp: answer.sdp || '',
							})
							await this.flushPendingCandidates()
							return
						}
					} catch (retryError) {
						this.debug('[RTC] handle OFFER retry failed', {
							error: String(retryError),
							signalingState: this.pc.signalingState,
						})
					}
				}
				this.debug('[RTC] handle OFFER failed', {
					error: String(error),
					signalingState: this.pc.signalingState,
				})
			}
			return
		}
		if (payload.signalType === 'ANSWER') {
			try {
				const sdpText = resolveSdpText(payload.sdp)
				if (!sdpText) {
					this.debug('[RTC] ANSWER missing sdp', payload)
					return
				}
				await this.pc.setRemoteDescription(
					new RTCSessionDescription({
						type: 'answer',
						sdp: sdpText,
					}),
				)
				this.stopOfferRetry()
				await this.flushPendingCandidates()
			} catch (error) {
				this.debug('[RTC] handle ANSWER failed', {
					error: String(error),
					signalingState: this.pc.signalingState,
				})
			}
			return
		}
		if (payload.signalType === 'ICE_CANDIDATE') {
			const candidateInit = resolveCandidateInit(
				payload.candidate,
				payload.sdpMid,
				payload.sdpMLineIndex,
			)
			if (!candidateInit) return
			if (!this.pc.remoteDescription) {
				this.pendingCandidates.push(candidateInit)
				return
			}
			try {
				await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit))
				this.debug('[RTC] add remote ICE ok', {
					sdpMid: candidateInit.sdpMid,
					sdpMLineIndex: candidateInit.sdpMLineIndex,
				})
			} catch (error) {
				console.warn('添加 ICE 候选失败:', error, candidateInit)
				this.debug('[RTC] add remote ICE failed', {
					error: String(error),
				})
			}
		}
	}

	setCameraEnabled(enabled: boolean): void {
		for (const track of this.localStream?.getVideoTracks() || []) {
			track.enabled = enabled
		}
	}

	getLocalStream(): MediaStream | null {
		return this.localStream
	}

	private async loadIceServers(): Promise<RTCIceServer[]> {
		try {
			const response = await videoCallApi.getIceServers()
			const rows = response.data?.data?.servers || []
			return rows
		} catch {
			this.debug('[RTC] use fallback STUN server')
			return [{ urls: ['stun:stun.l.google.com:19302'] }]
		}
	}

	private async ensureLocalStream(
		callType: 'video' | 'audio',
	): Promise<void> {
		try {
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video:
					callType === 'video'
						? {
								width: { ideal: 640 },
								height: { ideal: 360 },
								facingMode: 'user',
							}
						: false,
			})
		} catch (error) {
			this.onError?.(error)
			this.debug('[RTC] getUserMedia failed', { error: String(error) })
			throw error
		}
	}

	private async flushPendingCandidates(): Promise<void> {
		if (!this.pc || !this.pendingCandidates.length) return
		const queue = [...this.pendingCandidates]
		this.pendingCandidates = []
		for (const candidate of queue) {
			try {
				await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
			} catch {
				// ignore invalid candidate during race window
			}
		}
	}

	private startOfferRetry(): void {
		if (this.role !== 'caller') return
		this.stopOfferRetry()
		this.offerRetryTimer = setInterval(() => {
			if (!this.pc || !this.lastOfferSdp) return
			if (this.pc.remoteDescription || this.pc.connectionState === 'connected') {
				this.stopOfferRetry()
				return
			}
			this.offerRetryCount += 1
			if (this.offerRetryCount > 8) {
				this.debug('[RTC] stop OFFER retry', {
					retryCount: this.offerRetryCount,
				})
				this.stopOfferRetry()
				return
			}
			this.debug('[RTC] resend OFFER', { retryCount: this.offerRetryCount })
			void this.sendSignal({
				signalType: 'OFFER',
				to: this.peerAccount,
				sdp: this.lastOfferSdp,
			}).catch(() => {
				// keep retrying
			})
		}, 1200)
	}

	private stopOfferRetry(): void {
		if (!this.offerRetryTimer) return
		clearInterval(this.offerRetryTimer)
		this.offerRetryTimer = null
	}

	dispose(): void {
		this.debug('[RTC] dispose')
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
		this.stopOfferRetry()
		this.lastOfferSdp = ''
		this.offerRetryCount = 0
		if (this.pc) {
			this.pc.close()
			this.pc = null
		}
		if (this.localStream) {
			for (const track of this.localStream.getTracks()) {
				track.stop()
			}
			this.localStream = null
		}
		if (this.remoteStream) {
			for (const track of this.remoteStream.getTracks()) {
				track.stop()
			}
			this.remoteStream = null
		}
	}
}

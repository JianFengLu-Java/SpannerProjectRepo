import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

const COVER_SIZE = 720
const MAX_LINES = 4
const LINE_HEIGHT = 112
const TITLE_FONT_SIZE = 96
const TITLE_MAX_WIDTH_RATIO = 0.82

const fontFamilies = [
	'"PingFang SC", "Microsoft YaHei", sans-serif',
	'"Hiragino Sans GB", "Microsoft YaHei", sans-serif',
	'"STHeiti", "Microsoft YaHei", sans-serif',
	'"Heiti SC", "Microsoft YaHei", sans-serif',
	'"Noto Sans SC", "Microsoft YaHei", sans-serif',
	'"Source Han Sans SC", "Microsoft YaHei", sans-serif',
]

const hashString = (value: string): number => {
	let hash = 0
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(i)
		hash |= 0
	}
	return Math.abs(hash)
}

const parseUploadUrl = (payload: Record<string, unknown> | null): string => {
	if (!payload) return ''
	const url =
		(typeof payload.url === 'string' && payload.url) ||
		(typeof payload.fileUrl === 'string' && payload.fileUrl) ||
		(typeof payload.path === 'string' && payload.path) ||
		''
	return url.trim()
}

const dataUrlToBlob = (dataUrl: string): Blob => {
	const [meta, raw] = dataUrl.split(',')
	const mimeMatch = meta.match(/data:(.*?);base64/)
	const mime = mimeMatch?.[1] || 'image/png'
	const binary = atob(raw || '')
	const buffer = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) {
		buffer[i] = binary.charCodeAt(i)
	}
	return new Blob([buffer], { type: mime })
}

const createCoverCanvas = (title: string): HTMLCanvasElement => {
	const canvas = document.createElement('canvas')
	canvas.width = COVER_SIZE
	canvas.height = COVER_SIZE
	const ctx = canvas.getContext('2d')
	if (!ctx) return canvas

	const finalTitle = (title || '未命名动态').trim()
	const hash = hashString(finalTitle)
	const hue = hash % 360
	const saturation = 80
	const lightness = 82
	const font = fontFamilies[hash % fontFamilies.length]

	ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
	ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE)

	ctx.save()
	ctx.font = `900 ${TITLE_FONT_SIZE}px ${font}`
	ctx.textBaseline = 'top'
	ctx.textAlign = 'center'
	ctx.fillStyle = '#111111'

	const maxWidth = COVER_SIZE * TITLE_MAX_WIDTH_RATIO
	const chars = Array.from(finalTitle)
	const lines: string[] = []
	let current = ''

	chars.forEach((char) => {
		const next = current + char
		if (current && ctx.measureText(next).width > maxWidth) {
			lines.push(current)
			current = char
			return
		}
		current = next
	})
	if (current) lines.push(current)

	const visibleLines = lines.slice(0, MAX_LINES)
	if (lines.length > MAX_LINES) {
		let lastLine = visibleLines[MAX_LINES - 1] || ''
		while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
			lastLine = lastLine.slice(0, -1)
		}
		visibleLines[MAX_LINES - 1] = `${lastLine}...`
	}

	const blockHeight = visibleLines.length * LINE_HEIGHT
	let y = (COVER_SIZE - blockHeight) / 2
	visibleLines.forEach((line) => {
		ctx.fillText(line, COVER_SIZE / 2, y)
		y += LINE_HEIGHT
	})

	ctx.restore()
	return canvas
}

export const createMomentCoverDataUrl = (title: string): string => {
	const canvas = createCoverCanvas(title)
	return canvas.toDataURL('image/png')
}

export const createMomentCoverBlob = async (title: string): Promise<Blob> => {
	const canvas = createCoverCanvas(title)
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
	})
	if (blob) return blob
	return dataUrlToBlob(canvas.toDataURL('image/png'))
}

export const uploadMomentCover = async (title: string): Promise<string> => {
	const blob = await createMomentCoverBlob(title)
	const formData = new FormData()
	formData.append('file', blob, `moment-cover-${Date.now()}.png`)
	const response = await request.post<ApiResponse<Record<string, unknown>>>(
		'/files/upload',
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		},
	)
	const url = parseUploadUrl(response.data.data || null)
	if (!url) throw new Error('cover-upload-url-empty')
	return url
}

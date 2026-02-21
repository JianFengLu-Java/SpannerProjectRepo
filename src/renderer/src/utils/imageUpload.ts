import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

interface CompressOptions {
	maxDimension?: number
	targetBytes?: number
	maxBytes?: number
	maxGifBytes?: number
	maxGifDimension?: number
	minQuality?: number
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
	maxDimension: 1440,
	targetBytes: 900 * 1024,
	maxBytes: 10 * 1024 * 1024,
	maxGifBytes: 8 * 1024 * 1024,
	maxGifDimension: 1200,
	minQuality: 0.55,
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

const isGifFile = (file: File): boolean => {
	if (file.type === 'image/gif') return true
	return /\.gif$/i.test(file.name)
}

const loadImageSize = async (
	file: Blob,
): Promise<{ width: number; height: number }> => {
	if ('createImageBitmap' in window) {
		const bitmap = await createImageBitmap(file)
		const size = { width: bitmap.width, height: bitmap.height }
		bitmap.close()
		return size
	}

	const objectUrl = URL.createObjectURL(file)
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const next = new Image()
			next.onload = () => resolve(next)
			next.onerror = () => reject(new Error('image-decode-failed'))
			next.src = objectUrl
		})
		return { width: img.naturalWidth, height: img.naturalHeight }
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

const compressRasterImage = async (
	file: File,
	options: Required<CompressOptions>,
): Promise<File> => {
	const { width, height } = await loadImageSize(file)
	if (!width || !height) return file

	const maxEdge = Math.max(width, height)
	const needScale = maxEdge > options.maxDimension
	const needCompress = file.size > options.targetBytes
	if (!needScale && !needCompress) return file

	const outputType =
		file.type === 'image/webp' || file.type === 'image/png'
			? 'image/webp'
			: 'image/jpeg'

	let currentScale = needScale ? options.maxDimension / maxEdge : 1
	let currentQuality = 0.86
	let blob: Blob | null = null

	for (let i = 0; i < 7; i += 1) {
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(width * currentScale))
		canvas.height = Math.max(1, Math.round(height * currentScale))
		const ctx = canvas.getContext('2d', { alpha: true })
		if (!ctx) break

		const objectUrl = URL.createObjectURL(file)
		try {
			const img = await new Promise<HTMLImageElement>(
				(resolve, reject) => {
					const next = new Image()
					next.onload = () => resolve(next)
					next.onerror = () => reject(new Error('image-load-failed'))
					next.src = objectUrl
				},
			)
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
		} finally {
			URL.revokeObjectURL(objectUrl)
		}

		blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(
				(nextBlob) => resolve(nextBlob),
				outputType,
				currentQuality,
			)
		})
		if (!blob) break
		if (
			blob.size <= options.targetBytes ||
			currentQuality <= options.minQuality
		) {
			break
		}
		currentQuality = Math.max(options.minQuality, currentQuality - 0.08)
		currentScale = Math.max(0.45, currentScale * 0.9)
	}

	if (!blob) return file
	if (blob.size >= file.size && maxEdge <= options.maxDimension) return file

	const ext = outputType === 'image/webp' ? 'webp' : 'jpg'
	const nextName = file.name.replace(/\.[^.]+$/, '') || `upload-${Date.now()}`
	return new File([blob], `${nextName}.${ext}`, {
		type: outputType,
		lastModified: Date.now(),
	})
}

export const prepareImageForUpload = async (
	file: File,
	customOptions: CompressOptions = {},
): Promise<File> => {
	const options = { ...DEFAULT_OPTIONS, ...customOptions }
	if (!file.type.startsWith('image/')) {
		throw new Error('upload-file-not-image')
	}

	if (file.size > options.maxBytes) {
		throw new Error('upload-file-too-large')
	}

	if (isGifFile(file)) {
		const { width, height } = await loadImageSize(file)
		if (
			Math.max(width, height) > options.maxGifDimension ||
			file.size > options.maxGifBytes
		) {
			throw new Error('upload-gif-too-large')
		}
		return file
	}

	return compressRasterImage(file, options)
}

export const uploadImageToFileService = async (file: File): Promise<string> => {
	const formData = new FormData()
	formData.append('file', file)
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
	if (!url) {
		throw new Error('upload-url-empty')
	}
	return url
}

export const imageUploadErrorToMessage = (error: unknown): string => {
	const text = String((error as Error)?.message || '')
	if (text.includes('upload-file-not-image')) return '只能上传图片或动图文件'
	if (text.includes('upload-file-too-large')) return '文件超过 10MB，无法上传'
	if (text.includes('upload-gif-too-large')) {
		return '动图过大，请控制在 8MB 且最长边不超过 1200px'
	}
	return '上传失败，请稍后重试'
}

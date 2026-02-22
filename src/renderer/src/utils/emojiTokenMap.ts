interface NativeEmojiLike {
	name?: string
	url?: string
}

const NATIVE_EMOJI_KEY = 'spanner.chat.nativeEmojiPack'
const FAVORITE_EMOJI_KEY = 'spanner.chat.favoriteEmojis'

const builtInEmojiImages = import.meta.glob('../assets/eif-emojis/*.png', {
	eager: true,
	import: 'default',
}) as Record<string, string>

const normalizeEmojiName = (raw: string): string => {
	const trimmed = raw.trim().replace(/\.[^.]+$/, '')
	const safe = trimmed.replace(/\[|\]|\s+/g, '')
	return safe || ''
}

export const toEmojiToken = (name: string): string => `[${name}]`

const appendTokenAlias = (
	map: Record<string, string>,
	name: string,
	url: string,
): void => {
	const normalizedName = normalizeEmojiName(name)
	if (!normalizedName || !url) return
	map[toEmojiToken(normalizedName)] = url
	const numericMatch = normalizedName.match(/^表情0*(\d+)$/)
	if (!numericMatch) return
	const rawNum = numericMatch[1]
	if (!rawNum) return
	const trimmedNum = String(Number(rawNum))
	if (!trimmedNum || trimmedNum === 'NaN') return
	map[toEmojiToken(`表情${trimmedNum}`)] = url
}

export const getBuiltInEmojiTokenMap = (): Record<string, string> => {
	const map: Record<string, string> = {}
	Object.entries(builtInEmojiImages).forEach(([filePath, url]) => {
		const fileName = filePath.split('/').pop() || ''
		const matched = fileName.match(/emoji_(\d+)\.png$/i)
		const num = matched?.[1] || ''
		const name = num ? `表情${num}` : normalizeEmojiName(fileName)
		if (!name || !url) return
		appendTokenAlias(map, name, url)
	})
	return map
}

export const getStoredEmojiTokenMap = (): Record<string, string> => {
	if (typeof window === 'undefined') return {}
	const map: Record<string, string> = {}
	try {
		const raw = window.localStorage.getItem(NATIVE_EMOJI_KEY)
		if (!raw) return map
		const parsed = JSON.parse(raw) as NativeEmojiLike[]
		if (!Array.isArray(parsed)) return map
		parsed.forEach((item) => {
			const name = normalizeEmojiName(item?.name || '')
			const url = (item?.url || '').trim()
			if (!name || !url) return
			appendTokenAlias(map, name, url)
		})
	} catch (error) {
		console.warn('读取原生表情 token 映射失败', error)
	}
	try {
		const raw = window.localStorage.getItem(FAVORITE_EMOJI_KEY)
		if (!raw) return map
		const parsed = JSON.parse(raw) as Array<
			NativeEmojiLike & { isGif?: boolean }
		>
		if (!Array.isArray(parsed)) return map
		parsed.forEach((item) => {
			if (item?.isGif) return
			const name = normalizeEmojiName(item?.name || '')
			const url = (item?.url || '').trim()
			if (!name || !url) return
			appendTokenAlias(map, name, url)
		})
	} catch (error) {
		console.warn('读取收藏表情 token 映射失败', error)
	}
	return map
}

export const getMergedEmojiTokenMap = (): Record<string, string> => {
	return {
		...getBuiltInEmojiTokenMap(),
		...getStoredEmojiTokenMap(),
	}
}

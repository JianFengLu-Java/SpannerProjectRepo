<template>
	<div
		class="emoji-picker-container bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col"
	>
		<div
			class="flex items-center px-2 pt-2 gap-1 border-b border-gray-50 dark:border-zinc-700 bg-gray-50/30 dark:bg-zinc-800/40"
		>
			<button
				v-for="tab in tabs"
				:key="tab.id"
				type="button"
				class="px-3 py-1.5 cursor-pointer transition-all duration-200 rounded-t-lg text-xs font-medium relative"
				:class="[
					activeTab === tab.id
						? 'text-blue-600 bg-white dark:bg-zinc-800 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]'
						: 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-zinc-700/50',
				]"
				@click="activeTab = tab.id"
			>
				{{ tab.name }}
				<div
					v-if="activeTab === tab.id"
					class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full mx-2"
				></div>
			</button>
		</div>

		<div
			class="flex-1 overflow-y-auto p-3 custom-scrollbar min-h-[300px] max-h-[400px]"
		>
			<div v-if="activeTab === 'native'" class="flex flex-col gap-3">
				<div class="toolbar-row">
					<button
						type="button"
						class="upload-btn"
						:disabled="isUploadingNative"
						@click="openNativeImport"
					>
						{{
							isUploadingNative
								? '导入中...'
								: '导入 PNG 原生表情'
						}}
					</button>
					<span class="text-[10px] text-gray-400 dark:text-gray-500">
						插入时将输出替代符，如 [微笑]
					</span>
				</div>
				<input
					ref="nativeInputRef"
					type="file"
					accept="image/png"
					multiple
					class="hidden"
					@change="onSelectNativeFiles"
				/>

				<div v-if="!nativeEmojis.length" class="empty-tip">
					还没有导入原生表情 PNG
				</div>
				<div v-else class="grid grid-cols-5 gap-2">
					<div
						v-for="item in nativeEmojis"
						:key="item.id"
						class="native-item group"
						@click="selectNative(item)"
					>
						<img
							:src="item.url"
							:alt="item.name"
							class="native-image"
							loading="lazy"
						/>
						<div class="native-name">{{ item.name }}</div>
						<button
							type="button"
							class="remove-btn"
							@click.stop="removeNative(item.id)"
						>
							×
						</button>
					</div>
				</div>
			</div>

			<div
				v-else-if="activeTab === 'favorite'"
				class="flex flex-col gap-4"
			>
				<div class="toolbar-row">
					<button
						type="button"
						class="upload-btn"
						:disabled="isUploadingFavorite"
						@click="openFavoriteImport"
					>
						{{ isUploadingFavorite ? '上传中...' : '上传收藏表情' }}
					</button>
					<span class="text-[10px] text-gray-400 dark:text-gray-500">
						支持 png/jpg/webp/gif，静态图上传前压缩
					</span>
				</div>
				<input
					ref="favoriteInputRef"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					class="hidden"
					@change="onSelectFavoriteFile"
				/>

				<div v-if="!favorites.length" class="empty-tip">
					还没有收藏表情，点击上方按钮上传
				</div>
				<div v-else class="grid grid-cols-4 gap-2">
					<div
						v-for="item in favorites"
						:key="item.id"
						class="favorite-item group"
						@click="selectFavorite(item)"
					>
						<img
							:src="item.url"
							:alt="item.name"
							class="w-full h-full object-contain"
							loading="lazy"
						/>
						<span v-if="item.isGif" class="gif-tag">GIF</span>
						<button
							type="button"
							class="remove-btn"
							@click.stop="removeFavorite(item.id)"
						>
							×
						</button>
					</div>
				</div>
			</div>
		</div>

		<div
			class="p-2 border-t border-gray-50 dark:border-zinc-700 bg-gray-50/20 dark:bg-zinc-800/30 flex items-center justify-between"
		>
			<div class="text-[10px] text-gray-400 dark:text-gray-500">
				示例：你好，{{ previewToken }}
			</div>
			<div class="text-[10px] text-gray-300 dark:text-gray-500">
				Spanner Emojis
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import {
	prepareImageForUpload,
	uploadImageToFileService,
	imageUploadErrorToMessage,
} from '@renderer/utils/imageUpload'
import { toEmojiToken } from '@renderer/utils/emojiTokenMap'

interface NativeEmoji {
	id: string
	name: string
	url: string
}

interface FavoriteEmoji {
	id: string
	name: string
	url: string
	isGif: boolean
}

const NATIVE_EMOJI_KEY = 'spanner.chat.nativeEmojiPack'
const FAVORITE_EMOJI_KEY = 'spanner.chat.favoriteEmojis'
const BUILT_IN_IMPORTED_KEY = 'spanner.chat.nativeEmojiBuiltInImported.v1'
const MAX_NATIVE_EMOJI_COUNT = 500

const builtInEmojiImages = import.meta.glob('../assets/eif-emojis/*.png', {
	eager: true,
	import: 'default',
}) as Record<string, string>

const emit = defineEmits<{
	(e: 'select', payload: { i: string }): void
	(
		e: 'select-custom',
		payload: {
			url: string
			name: string
			type: 'sticker' | 'emoji-img'
			token?: string
		},
	): void
}>()

const message = useMessage()
const activeTab = ref<'native' | 'favorite'>('native')
const nativeInputRef = ref<HTMLInputElement | null>(null)
const favoriteInputRef = ref<HTMLInputElement | null>(null)
const isUploadingNative = ref(false)
const isUploadingFavorite = ref(false)
const previewToken = ref('[微笑]')
const nativeEmojis = ref<NativeEmoji[]>([])
const favorites = ref<FavoriteEmoji[]>([])

const tabs = [
	{ id: 'native', name: '原生表情' },
	{ id: 'favorite', name: '收藏贴纸' },
] as const

const normalizeEmojiName = (raw: string): string => {
	const trimmed = raw.trim().replace(/\.[^.]+$/, '')
	const safe = trimmed.replace(/\[|\]|\s+/g, '')
	return safe || '表情'
}

const toToken = (name: string): string => toEmojiToken(name)

const getBuiltInNativeEmojis = (): NativeEmoji[] => {
	const list = Object.entries(builtInEmojiImages)
		.map(([filePath, url]) => {
			const fileName = filePath.split('/').pop() || ''
			const matched = fileName.match(/emoji_(\d+)\.png$/i)
			const num = matched?.[1] || ''
			const name = num ? `表情${num}` : normalizeEmojiName(fileName)
			return {
				id: `builtin-${name}`,
				name,
				url,
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

	return list
}

const mergeNativeEmojis = (
	existing: NativeEmoji[],
	incoming: NativeEmoji[],
): NativeEmoji[] => {
	const map = new Map<string, NativeEmoji>()
	existing.forEach((item) => {
		if (item?.name && item?.url) map.set(item.name, item)
	})
	incoming.forEach((item) => {
		if (!item?.name || !item?.url) return
		if (!map.has(item.name)) {
			map.set(item.name, item)
		}
	})
	return Array.from(map.values()).slice(0, MAX_NATIVE_EMOJI_COUNT)
}

const loadState = (): void => {
	let loadedNative: NativeEmoji[] = []
	try {
		const nativeRaw = window.localStorage.getItem(NATIVE_EMOJI_KEY)
		if (nativeRaw) {
			const parsed = JSON.parse(nativeRaw) as NativeEmoji[]
			if (Array.isArray(parsed)) {
				loadedNative = parsed
					.filter((item) => !!item?.url && !!item?.name)
					.slice(0, MAX_NATIVE_EMOJI_COUNT)
			}
		}
	} catch (error) {
		console.warn('加载原生表情失败', error)
	}

	const builtIn = getBuiltInNativeEmojis()
	const builtInUrlSet = new Set(builtIn.map((item) => item.url))
	loadedNative = loadedNative.filter((item) => {
		if (item.url.includes('/assets/eif-emojis/')) {
			return builtInUrlSet.has(item.url)
		}
		return true
	})
	const alreadyImported =
		window.localStorage.getItem(BUILT_IN_IMPORTED_KEY) === '1'
	const merged = mergeNativeEmojis(loadedNative, builtIn)
	nativeEmojis.value = merged
	if (!alreadyImported || merged.length !== loadedNative.length) {
		window.localStorage.setItem(BUILT_IN_IMPORTED_KEY, '1')
		window.localStorage.setItem(
			NATIVE_EMOJI_KEY,
			JSON.stringify(merged.slice(0, MAX_NATIVE_EMOJI_COUNT)),
		)
	}

	try {
		const favoriteRaw = window.localStorage.getItem(FAVORITE_EMOJI_KEY)
		if (favoriteRaw) {
			const parsed = JSON.parse(favoriteRaw) as FavoriteEmoji[]
			if (Array.isArray(parsed)) {
				favorites.value = parsed
					.filter((item) => !!item?.url)
					.slice(0, 60)
			}
		}
	} catch (error) {
		console.warn('加载收藏表情失败', error)
	}
}

const saveNative = (): void => {
	window.localStorage.setItem(
		NATIVE_EMOJI_KEY,
		JSON.stringify(nativeEmojis.value.slice(0, MAX_NATIVE_EMOJI_COUNT)),
	)
}

const saveFavorite = (): void => {
	window.localStorage.setItem(
		FAVORITE_EMOJI_KEY,
		JSON.stringify(favorites.value.slice(0, 60)),
	)
}

const openNativeImport = (): void => {
	if (isUploadingNative.value) return
	nativeInputRef.value?.click()
}

const openFavoriteImport = (): void => {
	if (isUploadingFavorite.value) return
	favoriteInputRef.value?.click()
}

const removeNative = (id: string): void => {
	nativeEmojis.value = nativeEmojis.value.filter((item) => item.id !== id)
	saveNative()
}

const removeFavorite = (id: string): void => {
	favorites.value = favorites.value.filter((item) => item.id !== id)
	saveFavorite()
}

const isGifFile = (file: File): boolean =>
	file.type === 'image/gif' || /\.gif$/i.test(file.name)

const hasPngTransparencyChannel = async (file: File): Promise<boolean> => {
	const buf = await file.arrayBuffer()
	const bytes = new Uint8Array(buf)
	if (bytes.length < 33) return false

	const pngSig = [137, 80, 78, 71, 13, 10, 26, 10]
	for (let i = 0; i < pngSig.length; i += 1) {
		if (bytes[i] !== pngSig[i]) return false
	}

	// IHDR color type: 4(gray+alpha) / 6(RGBA) means true alpha channel
	const colorType = bytes[25]
	if (colorType === 4 || colorType === 6) return true
	return false
}

const selectNative = (item: NativeEmoji): void => {
	const token = toToken(item.name)
	previewToken.value = token
	emit('select-custom', {
		url: item.url,
		name: item.name,
		type: 'emoji-img',
		token,
	})
}

const selectFavorite = (item: FavoriteEmoji): void => {
	const token = toToken(item.name)
	emit('select-custom', {
		url: item.url,
		name: item.name,
		type: item.isGif ? 'sticker' : 'emoji-img',
		token: item.isGif ? undefined : token,
	})
}

const onSelectNativeFiles = async (event: Event): Promise<void> => {
	const input = event.target as HTMLInputElement
	const files = Array.from(input.files || [])
	input.value = ''
	if (!files.length) return

	const pngFiles = files.filter(
		(file) => file.type === 'image/png' || /\.png$/i.test(file.name),
	)
	if (!pngFiles.length) {
		message.warning('请导入 PNG 格式原生表情')
		return
	}

	isUploadingNative.value = true
	try {
		const transparencyChecked = await Promise.allSettled(
			pngFiles.map(async (file) => {
				const hasTransparency = await hasPngTransparencyChannel(file)
				return {
					file,
					hasTransparency,
				}
			}),
		)
		const transparentPngFiles = transparencyChecked
			.filter(
				(
					item,
				): item is PromiseFulfilledResult<{
					file: File
					hasTransparency: boolean
				}> => item.status === 'fulfilled',
			)
			.filter((item) => item.value.hasTransparency)
			.map((item) => item.value.file)

		const removedNoAlphaCount = pngFiles.length - transparentPngFiles.length
		if (removedNoAlphaCount > 0) {
			message.warning(
				`${removedNoAlphaCount} 个表情不带透明通道，已自动移除`,
			)
		}
		if (!transparentPngFiles.length) {
			return
		}

		const settled = await Promise.allSettled(
			transparentPngFiles.map(async (file) => {
				const prepared = await prepareImageForUpload(file, {
					maxDimension: 128,
					targetBytes: 35 * 1024,
					maxBytes: 5 * 1024 * 1024,
				})
				const url = await uploadImageToFileService(prepared)
				const name = normalizeEmojiName(file.name)
				return { url, name }
			}),
		)

		const success = settled
			.filter(
				(
					item,
				): item is PromiseFulfilledResult<{
					url: string
					name: string
				}> => item.status === 'fulfilled',
			)
			.map((item) => item.value)

		if (success.length) {
			const map = new Map<string, NativeEmoji>()
			nativeEmojis.value.forEach((item) => map.set(item.name, item))
			success.forEach((item) => {
				map.set(item.name, {
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					name: item.name,
					url: item.url,
				})
			})
			nativeEmojis.value = Array.from(map.values()).slice(
				0,
				MAX_NATIVE_EMOJI_COUNT,
			)
			saveNative()
			message.success(`已导入 ${success.length} 个原生表情`)
		}

		const failed = settled.length - success.length
		if (failed > 0) {
			message.warning(`${failed} 个表情导入失败，请检查图片大小`)
		}
	} catch (error) {
		console.error('导入原生表情失败', error)
		message.error(imageUploadErrorToMessage(error))
	} finally {
		isUploadingNative.value = false
	}
}

const onSelectFavoriteFile = async (event: Event): Promise<void> => {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return

	if (!file.type.startsWith('image/')) {
		message.warning('只能上传图片或动图')
		return
	}

	isUploadingFavorite.value = true
	try {
		const prepared = await prepareImageForUpload(file, {
			maxDimension: 960,
			targetBytes: 550 * 1024,
			maxGifBytes: 8 * 1024 * 1024,
			maxGifDimension: 1200,
		})
		const url = await uploadImageToFileService(prepared)
		const name = normalizeEmojiName(file.name)
		const deduped = favorites.value.filter((item) => item.url !== url)
		deduped.unshift({
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			name,
			url,
			isGif: isGifFile(file),
		})
		favorites.value = deduped.slice(0, 60)
		saveFavorite()
		message.success('收藏表情上传成功')
	} catch (error) {
		console.error('收藏表情上传失败', error)
		message.error(imageUploadErrorToMessage(error))
	} finally {
		isUploadingFavorite.value = false
	}
}

onMounted(() => {
	loadState()
})
</script>

<style scoped>
.emoji-picker-container {
	width: 360px;
	user-select: none;
}

.custom-scrollbar::-webkit-scrollbar {
	width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
	background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
	background: #e2e8f0;
	border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
	background: #cbd5e1;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
	background: #3f3f46;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
	background: #52525b;
}

.toolbar-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.upload-btn {
	background: #2563eb;
	color: #fff;
	border: none;
	font-size: 12px;
	line-height: 1;
	padding: 8px 10px;
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.2s;
}

.upload-btn:hover {
	background: #1d4ed8;
}

.upload-btn:disabled {
	opacity: 0.7;
	cursor: not-allowed;
}

.native-item,
.favorite-item {
	position: relative;
	aspect-ratio: 1 / 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 6px;
	border-radius: 10px;
	cursor: pointer;
	transition: all 0.2s;
	background: rgba(59, 130, 246, 0.06);
}

.native-item {
	flex-direction: column;
	gap: 4px;
}

.native-item:hover,
.favorite-item:hover {
	background: rgba(59, 130, 246, 0.14);
}

.native-image {
	width: 28px;
	height: 28px;
	object-fit: contain;
}

.native-name {
	font-size: 10px;
	line-height: 1;
	color: #6b7280;
	max-width: 52px;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.gif-tag {
	position: absolute;
	left: 4px;
	bottom: 4px;
	font-size: 9px;
	padding: 1px 4px;
	border-radius: 5px;
	background: rgba(17, 24, 39, 0.7);
	color: #fff;
}

.remove-btn {
	position: absolute;
	right: 4px;
	top: 4px;
	width: 16px;
	height: 16px;
	border: none;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.5);
	color: #fff;
	font-size: 12px;
	line-height: 16px;
	cursor: pointer;
	opacity: 0;
	transition: opacity 0.2s;
}

.native-item:hover .remove-btn,
.favorite-item:hover .remove-btn {
	opacity: 1;
}

.empty-tip {
	font-size: 12px;
	color: #9ca3af;
	padding: 10px;
	border: 1px dashed #d1d5db;
	border-radius: 10px;
}
</style>

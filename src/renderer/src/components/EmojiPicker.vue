<template>
	<div
		class="emoji-picker-container bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col"
	>
		<div
			class="flex items-center px-1.5 pt-1.5 gap-1 border-b border-gray-50 dark:border-zinc-700 bg-gray-50/30 dark:bg-zinc-800/40"
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
			class="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-[260px] max-h-[360px]"
		>
			<div v-if="activeTab === 'native'" class="flex flex-col gap-2">
				<div v-if="!nativeEmojis.length" class="empty-tip">
					暂无原生表情
				</div>
				<div v-else class="emoji-grid-panel grid grid-cols-7 gap-1">
					<div
						v-for="item in nativeEmojis"
						:key="item.id"
						v-memo="[item.id, item.url]"
						class="native-item group"
						:title="`表情：${item.name}`"
						@click="selectNative(item)"
					>
						<img
							:src="item.url"
							:alt="item.name"
							class="native-image"
							loading="lazy"
						/>
					</div>
				</div>
			</div>

			<div
				v-else-if="activeTab === 'favorite'"
				class="flex flex-col gap-2"
			>
				<div class="toolbar-row">
					<button
						type="button"
						class="upload-btn"
						:disabled="isUploadingFavorite"
						title="上传收藏表情"
						@click="openFavoriteImport"
					>
						{{ isUploadingFavorite ? '上传中...' : '上传收藏表情' }}
					</button>
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
				<div v-else class="emoji-grid-panel grid grid-cols-6 gap-1">
					<div
						v-for="item in favorites"
						:key="item.id"
						v-memo="[item.id, item.url, item.isGif]"
						class="favorite-item group"
						:title="`表情：${item.name}`"
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
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
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
const favoriteInputRef = ref<HTMLInputElement | null>(null)
const isUploadingFavorite = ref(false)
const nativeEmojis = shallowRef<NativeEmoji[]>([])
const favorites = shallowRef<FavoriteEmoji[]>([])

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

const BUILT_IN_NATIVE_EMOJIS: NativeEmoji[] = Object.entries(builtInEmojiImages)
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
		if (!map.has(item.name)) map.set(item.name, item)
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

	const builtInUrlSet = new Set(
		BUILT_IN_NATIVE_EMOJIS.map((item) => item.url),
	)
	loadedNative = loadedNative.filter((item) => {
		if (item.url.includes('/assets/eif-emojis/')) {
			return builtInUrlSet.has(item.url)
		}
		return true
	})

	const alreadyImported =
		window.localStorage.getItem(BUILT_IN_IMPORTED_KEY) === '1'
	const merged = mergeNativeEmojis(loadedNative, BUILT_IN_NATIVE_EMOJIS)
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

const saveFavorite = (): void => {
	window.localStorage.setItem(
		FAVORITE_EMOJI_KEY,
		JSON.stringify(favorites.value.slice(0, 60)),
	)
}

const openFavoriteImport = (): void => {
	if (isUploadingFavorite.value) return
	favoriteInputRef.value?.click()
}

const removeFavorite = (id: string): void => {
	favorites.value = favorites.value.filter((item) => item.id !== id)
	saveFavorite()
}

const isGifFile = (file: File): boolean =>
	file.type === 'image/gif' || /\.gif$/i.test(file.name)

const selectNative = (item: NativeEmoji): void => {
	const token = toToken(item.name)
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
	width: min(360px, calc(100vw - 16px));
	max-width: 100%;
	margin: 0;
	user-select: none;
	box-sizing: border-box;
	contain: layout paint;
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
	justify-content: flex-start;
	gap: 6px;
}

.upload-btn {
	background: #2563eb;
	color: #fff;
	border: none;
	font-size: 12px;
	line-height: 1;
	padding: 7px 9px;
	border-radius: 7px;
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

.emoji-grid-panel {
	contain: content;
}

.native-item,
.favorite-item {
	position: relative;
	aspect-ratio: 1 / 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2px;
	border-radius: 6px;
	cursor: pointer;
	transition: all 0.16s;
	background: rgba(59, 130, 246, 0.06);
}

.native-item:hover,
.favorite-item:hover {
	background: rgba(59, 130, 246, 0.14);
}

.native-image {
	width: 24px;
	height: 24px;
	object-fit: contain;
}

.gif-tag {
	position: absolute;
	left: 3px;
	bottom: 3px;
	font-size: 9px;
	padding: 1px 4px;
	border-radius: 5px;
	background: rgba(17, 24, 39, 0.7);
	color: #fff;
}

.remove-btn {
	position: absolute;
	right: 3px;
	top: 3px;
	width: 15px;
	height: 15px;
	border: none;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.5);
	color: #fff;
	font-size: 11px;
	line-height: 15px;
	cursor: pointer;
	opacity: 0;
	transition: opacity 0.16s;
}

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

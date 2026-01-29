<template>
	<div
		class="emoji-picker-container bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
	>
		<!-- 顶部 Tab 切换 -->
		<div
			class="flex items-center px-2 pt-2 gap-1 border-b border-gray-50 bg-gray-50/30"
		>
			<div
				v-for="tab in tabs"
				:key="tab.id"
				class="px-3 py-1.5 cursor-pointer transition-all duration-200 rounded-t-lg text-xs font-medium relative group"
				:class="[
					activeTab === tab.id
						? 'text-green-600 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.02)]'
						: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50',
				]"
				@click="activeTab = tab.id"
			>
				{{ tab.name }}
				<div
					v-if="activeTab === tab.id"
					class="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full mx-2"
				></div>
			</div>
		</div>

		<!-- 内容区域 -->
		<div
			class="flex-1 overflow-y-auto p-3 custom-scrollbar min-h-[300px] max-h-[400px]"
		>
			<!-- 标准表情包 -->
			<div v-if="activeTab === 'emoji'" class="emoji-grid">
				<EmojiPicker
					:native="true"
					class="v3-emoji-picker-override"
					@select="handleSelectEmoji"
				/>
			</div>

			<!-- 常用表情 (自定义区域) -->
			<div v-else-if="activeTab === 'custom'" class="flex flex-col gap-4">
				<div v-for="category in customEmojis" :key="category.title">
					<div
						class="text-[10px] text-gray-400 font-medium mb-2 uppercase tracking-wider px-1"
					>
						{{ category.title }}
					</div>
					<div class="grid grid-cols-4 gap-2">
						<div
							v-for="(item, index) in category.items"
							:key="index"
							class="aspect-square flex items-center justify-center p-1.5 rounded-xl hover:bg-green-50/50 cursor-pointer transition-all duration-200 group active:scale-90"
							@click="handleSelectCustom(item)"
						>
							<img
								:src="item.url"
								:alt="item.name"
								class="w-full h-full object-contain filter group-hover:drop-shadow-sm transition-all"
								loading="lazy"
							/>
						</div>
					</div>
				</div>

				<!-- 动态贴纸 (更大尺寸) -->
				<div v-if="stickers.length > 0">
					<div
						class="text-[10px] text-gray-400 font-medium mb-2 uppercase tracking-wider px-1"
					>
						我的贴纸
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div
							v-for="(item, index) in stickers"
							:key="index"
							class="aspect-square flex items-center justify-center p-2 rounded-xl border border-transparent hover:border-green-100 hover:bg-green-50/30 cursor-pointer transition-all duration-300 group overflow-hidden"
							@click="handleSelectCustom(item, true)"
						>
							<img
								:src="item.url"
								:alt="item.name"
								class="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 底部操作栏 -->
		<div
			class="p-2 border-t border-gray-50 bg-gray-50/20 flex items-center justify-between"
		>
			<div class="flex gap-2 text-[10px] text-gray-400">
				<span>快选:</span>
				<span
					class="hover:text-green-500 cursor-pointer transition-colors"
					@click="quickInsert('😊')"
					>😊</span
				>
				<span
					class="hover:text-green-500 cursor-pointer transition-colors"
					@click="quickInsert('👍')"
					>👍</span
				>
				<span
					class="hover:text-green-500 cursor-pointer transition-colors"
					@click="quickInsert('❤️')"
					>❤️</span
				>
			</div>
			<div class="text-[10px] text-gray-300">Spanner Emojis</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'

const emit = defineEmits(['select', 'select-custom'])

const activeTab = ref('emoji')

const tabs = [
	{ id: 'emoji', name: '经典' },
	{ id: 'custom', name: '贴纸包' },
]

// 模拟自定义表情数据 (可以通过 Props 传入以实现动态化)
const customEmojis = ref([
	{
		title: '热度前排',
		items: [
			{
				name: 'doge',
				url: 'https://api.dicebear.com/7.x/bottts/svg?seed=doge',
			},
			{
				name: 'think',
				url: 'https://api.dicebear.com/7.x/bottts/svg?seed=think',
			},
			{
				name: 'wow',
				url: 'https://api.dicebear.com/7.x/bottts/svg?seed=wow',
			},
			{
				name: 'cool',
				url: 'https://api.dicebear.com/7.x/bottts/svg?seed=cool',
			},
		],
	},
	{
		title: '抽象艺术',
		items: [
			{
				name: 'pixel-1',
				url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Felix',
			},
			{
				name: 'pixel-2',
				url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Milo',
			},
			{
				name: 'pixel-3',
				url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Toby',
			},
			{
				name: 'pixel-4',
				url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Bella',
			},
		],
	},
])

const stickers = ref([
	{ name: 'sticker-1', url: 'https://picsum.photos/seed/sticker1/200/200' },
	{ name: 'sticker-2', url: 'https://picsum.photos/seed/sticker2/200/200' },
	{ name: 'sticker-3', url: 'https://picsum.photos/seed/sticker3/200/200' },
	{ name: 'sticker-4', url: 'https://picsum.photos/seed/sticker4/200/200' },
])

const handleSelectEmoji = (emoji: { i: string }): void => {
	emit('select', emoji)
}

const handleSelectCustom = (
	item: { url: string; name: string },
	isSticker = false,
): void => {
	emit('select-custom', {
		...item,
		type: isSticker ? 'sticker' : 'emoji-img',
	})
}

const quickInsert = (emojiStr: string): void => {
	emit('select', { i: emojiStr })
}
</script>

<style scoped>
.emoji-picker-container {
	width: 320px;
	user-select: none;
}

/* 覆盖库样式以适应我们的设计 */
.v3-emoji-picker-override {
	width: 100% !important;
	box-shadow: none !important;
	border: none !important;
	--v3-spacing: 4px;
}

:deep(.v3-emoji-picker) {
	background: transparent !important;
}

:deep(.v3-header) {
	padding: 0 4px 8px 4px !important;
}

:deep(.v3-body) {
	padding: 0 4px !important;
}

:deep(.v3-footer) {
	display: none !important;
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

.emoji-grid {
	width: 100%;
}
</style>

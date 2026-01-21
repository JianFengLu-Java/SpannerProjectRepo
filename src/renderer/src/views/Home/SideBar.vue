<template>
	<div
		class="gap-3 h-full flex flex-col items-center justify-between rounded-[14px] transition-[width] duration-300 ease-in-out relative bg-[#ECEDEE]"
		:style="{ width: isExpanded ? width + 'px' : '76px' }"
	>
		<div
			class="h-full fixed top-0 drag -z-10"
			:style="{ width: isExpanded ? width + 'px' : '76px' }"
			@mousedown="handleDown"
		></div>

		<div
			class="flex flex-col items-center gap-4 no-drag"
			:class="[
				platfrom === 'darwin' ? 'mt-10' : 'mt-2',
				isExpanded ? 'px-4 items-start w-full' : 'items-center',
			]"
		>
			<div class="flex items-center gap-3 w-full">
				<n-dropdown
					trigger="click"
					placement="right-start"
					style="border: 1px solid #ccc; border-radius: 10px"
					:options="userMenuOptions"
				>
					<n-avatar
						round
						:src="user.avatarUrl"
						class="cursor-pointer shrink-0"
					/>
				</n-dropdown>
				<div v-if="isExpanded" class="flex flex-col flex-1">
					<span class="text-sm font-bold">{{ user.userName }}</span>
					<span class="text-[10px] text-gray-500">在线</span>
				</div>
				<div v-if="isExpanded">
					<n-dropdown
						trigger="click"
						placement="right-start"
						style="
							width: 140px;
							border: 1px solid #ccc;
							border-radius: 10px;
						"
						:options="addMenuOptions"
					>
						<n-icon size="20" class="text-gray-400">
							<Add16Filled />
						</n-icon>
					</n-dropdown>
				</div>
			</div>
		</div>

		<div class="no-drag w-full px-2 flex justify-center">
			<div
				class="text-zinc-800 flex items-center bg-gray-50 rounded-xl border border-gray-200 hover:bg-zinc-300 cursor-pointer transition-all overflow-hidden"
				:class="
					isExpanded
						? 'w-full h-8 px-3 gap-2'
						: 'w-9 h-9	 justify-center'
				"
				@click="showSearchModal = true"
			>
				<n-icon size="20">
					<Search />
				</n-icon>
				<span
					v-if="isExpanded"
					class="text-[12px] text-zinc-500 whitespace-nowrap"
					>搜索内容...</span
				>
			</div>
		</div>

		<div v-if="!isExpanded" class="no-drag w-full px-4 flex justify-center">
			<n-dropdown
				trigger="click"
				placement="right-start"
				style="
					width: 140px;
					border: 1px solid #ccc;
					border-radius: 10px;
				"
				:options="addMenuOptions"
			>
				<div
					class="text-zinc-800 flex items-center bg-gray-50 rounded-full hover:bg-zinc-300 cursor-pointer transition-all overflow-hidden"
					:class="
						isExpanded
							? 'w-full h-8 px-3 gap-2'
							: 'w-9 h-9 justify-center'
					"
				>
					<n-icon size="20">
						<Add />
					</n-icon>
					<span
						v-if="isExpanded"
						class="text-[12px] text-zinc-500 whitespace-nowrap"
						>新建/添加</span
					>
				</div>
			</n-dropdown>
		</div>

		<div
			class="flex-1 w-full flex flex-col items-center gap-1 rounded-md pt-0 p-2"
		>
			<div
				v-for="item in menus"
				:key="item.key"
				:class="[
					'flex items-center cursor-pointer  transition-all no-drag',
					isExpanded
						? 'w-full px-2 h-9 gap-2 rounded-lg'
						: 'w-16 h-16 flex-col justify-center gap-1 rounded-xl',
					route.name === item.name
						? ' bg-white text-primary-600'
						: 'hover:bg-gray-50 ',
				]"
				@click="go(item)"
			>
				<n-badge :dot="item.hasMessage">
					<div class="flex justify-center items-center">
						<n-icon
							size="18"
							:color="route.name === item.name ? '#444' : '#aaa'"
						>
							<component :is="iconMap[item.icon]" />
						</n-icon>
					</div>
				</n-badge>

				<span
					v-if="isExpanded"
					class="text-xs whitespace-nowrap overflow-hidden"
					:style="{
						color: route.name === item.name ? '#444' : '#aaa',
					}"
				>
					{{ item.label }}
				</span>

				<span
					v-else
					class="text-[10px] leading-none"
					:style="{
						color: route.name === item.name ? '#444' : '#aaa',
					}"
				>
					{{ item.label }}
				</span>
			</div>
		</div>

		<div
			:class="[
				'mb-4 no-drag w-full flex border-t border-gray-200/50 pt-4',
				isExpanded ? 'justify-end px-4' : 'justify-center',
			]"
		>
			<div
				class="text-zinc-400 w-8 h-8 flex justify-center items-center rounded-full hover:bg-zinc-200 cursor-pointer transition-all"
				@click="$emit('toggle')"
			>
				<n-icon size="20">
					<component
						:is="isExpanded ? ChevronBack : ChevronForward"
					/>
				</n-icon>
			</div>
		</div>

		<n-modal
			v-model:show="showSearchModal"
			preset="dialog"
			title="搜索"
			style="width: 600px; border-radius: 18px"
			:bordered="false"
		>
			<n-input-group>
				<n-input type="text" placeholder="请输入关键词..." />
				<n-button type="primary"> 搜索 </n-button>
			</n-input-group>
		</n-modal>

		<n-modal
			v-model:show="showAddFriendModal"
			preset="dialog"
			style="width: 600px; border-radius: 18px"
			:bordered="false"
		>
			<n-input-group>
				<n-input type="text" placeholder="请输入用户账号查找" />
				<n-button type="primary"> 查找 </n-button>
			</n-input-group>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import {
	NAvatar,
	NIcon,
	NTag,
	NDropdown,
	NModal,
	NInputGroup,
	NInput,
	NButton,
	NBadge,
} from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	Chatbubbles,
	Person,
	Settings,
	SearchOutline as Search,
	Add,
	ChevronBackOutline as ChevronBack,
	ChevronForwardOutline as ChevronForward,
} from '@vicons/ionicons5'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { Add16Filled } from '@vicons/fluent'

defineProps<{ isExpanded: boolean; width: number }>()
const emit = defineEmits(['toggle'])

const user = useUserInfoStore()
const router = useRouter()
const route = useRoute()
const showSearchModal = ref(false)
const showAddFriendModal = ref(false)
const platfrom = window.api.platform

interface MenuItem {
	key: string
	name: string
	icon: string
	label?: string
	hasMessage?: boolean
}

const addMenuOptions = [
	{
		label: '新建聊天',
		key: 'new-chat',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
	},
	{
		label: '新建群组',
		key: 'new-group',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
	},
	{
		label: '添加好友',
		key: 'new-friend',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
		props: {
			onClick: () => {
				showAddFriendModal.value = true
			},
		},
	},
]

const userMenuOptions = [
	{
		key: 'user-info',
		label: '个人信息',
		type: 'render',
		render: () => {
			return h('div', { class: 'p-4 flex flex-col w-200px' }, [
				h('div', { class: 'flex ' }, [
					h(NAvatar, {
						class: ' text-lg mb-2',
						src: user.avatarUrl,
						size: 62,
						round: true,
					}),
					h(
						'div',
						{ class: 'ml-4 h-full flex flex-col justify-center' },
						[
							h(
								'div',
								{
									class: 'text-lg font-semibold flex items-center text-gray-800',
								},
								[
									h('span', null, user.userName),
									h(
										NTag,
										{
											class: 'ml-2 text-xs',
											type: 'success',
											size: 'small',
											round: true,
										},
										{
											default: () => '董事长',
											icon: () =>
												h(
													NIcon,
													{ size: 12 },
													{
														default: () =>
															h(Person),
													},
												),
										},
									),
								],
							),
							h(
								'div',
								{ class: 'text-xs text-gray-500' },
								user.email,
							),
						],
					),
				]),
			])
		},
	},
	{ type: 'divider' },
	{ label: '我的个人名片', key: 'my-card' },
	{ type: 'divider' },
	{
		label: '退出登录',
		key: 'logout',
		props: {
			onClick: () => {
				window.electron.ipcRenderer.send('logout-open-loginWindow')
			},
		},
	},
]

const iconMap: Record<string, Component> = {
	chat: Chatbubbles,
	user: Person,
	setting: Settings,
}

const handleDown = (e: MouseEvent): void => {
	document.body.click()
}

const menus = ref<MenuItem[]>([])
onMounted(() => {
	menus.value = [
		{
			key: 'home',
			name: 'home',
			icon: 'chat',
			label: '消息',
			hasMessage: true,
		},
		{ key: 'user', name: 'user', icon: 'user', label: '通讯录' },
		{ key: 'setting', name: 'setting', icon: 'setting', label: '设置' },
	]
})

function go(item: MenuItem): void {
	if (route.name !== item.name) {
		router.push({ name: item.name })
	}
}
</script>

<style scoped>
.drag {
	-webkit-app-region: drag;
}
.no-drag {
	-webkit-app-region: no-drag;
}

/* 菜单文字淡入效果 */
.whitespace-nowrap {
	animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateX(-5px);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
}
</style>

<template>
    <div class="w-[76px] gap-3 h-full flex flex-col items-center justify-between rounded-[14px]">
        <!-- 顶部：头像 -->
        <div class="flex mt-10 flex-col items-center gap-4 cursor-pointer">
            <n-dropdown trigger="click" placement="right-start" style="

					border: 1px solid #ccc;
					border-radius: 10px;
                    
				" :options="userMenuOptions">
                <n-avatar round :src="user.avatarUrl" />
            </n-dropdown>
        </div>
        <div>
            <div
                class="text-zinc-800 w-9 h-9 flex justify-center bg-gray-50 items-center rounded-full hover:bg-zinc-300 cursor-pointer">
                <n-icon size="20">
                    <Search />
                </n-icon>
            </div>
        </div>
        <div>
            <n-dropdown trigger="click" placement="right-start" style="
					width: 140px;
					border: 1px solid #ccc;
					border-radius: 10px;
				" :options="[
                    {
                        label: '新建聊天',
                        key: 'new-chat',
                        icon() {
                            return h(NIcon, null, {
                                default: () => h(Add),
                            })
                        },
                        onClick: () => {
                            console.log('新建聊天')
                        },
                    },
                    {
                        label: '新建群组',
                        key: 'new-group',
                        icon() {
                            return h(NIcon, null, {
                                default: () => h(Add),
                            })
                        },
                        onClick: () => {
                            console.log('新建群组')
                        },
                    },
                ]">
                <div
                    class="text-zinc-800 w-9 h-9 flex justify-center bg-gray-50 items-center rounded-full hover:bg-zinc-300 cursor-pointer">
                    <n-icon size="20">
                        <Add />
                    </n-icon>
                </div>
            </n-dropdown>
        </div>

        <div class="flex-1 w-full flex flex-col items-center gap-1 rounded-md pt-0 p-2">
            <!-- 自定义按钮结构 -->
            <div v-for="item in menus" :key="item.key" :class="[
                'flex flex-col items-center justify-center gap-1 h-14 w-16 cursor-pointer rounded-lg transition-all',
                route.name === item.name
                    ? ' bg-white text-primary-600'
                    : 'hover:bg-gray-50 ',
            ]" @click="go(item)">
                <!-- 图标 -->
                <n-badge :dot="item.hasMessage" color="red" size="small">
                    <div class="h-8 w-8 flex flex-col gap-1 justify-center items-center">
                        <n-icon size="18" :color="route.name === item.name ? '#444' : '#aaa'">
                            <component :is="iconMap[item.icon]" />
                        </n-icon>
                        <!-- 文字 -->
                        <span class="text-[10px] leading-none font-medium" :style="{
                            color:
                                route.name === item.name ? '#444' : '#aaa',
                        }">
                            {{ item.label }}
                        </span>
                    </div>
                </n-badge>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NIcon, NTag } from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import type { Component, render } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
    Chatbubbles,
    Person,
    Settings,
    SearchOutline as Search,
    LogOutOutline,
    Add,
} from '@vicons/ionicons5'
import { useUserInfoStore } from '@renderer/stores/userInfo'

const user = useUserInfoStore()

console.log('用户信息：', user.avatarUrl)
/**
 * 侧边栏组件
 */
const router = useRouter()
const route = useRoute()

/**
 * 菜单项接口
 */
interface MenuItem {
    key: string
    name: string
    icon: string
    label?: string
    hasMessage?: boolean
}

/**
 * 用户头像下拉菜单
 * 
 */

const userMenuOptions = [

    {
        key: 'user-info',
        label: '个人信息',
        type: 'render',
        render: () => {
            return h('div', { class: 'p-4 flex flex-col w-200px' }, [
                h('div', { class: 'flex ' }, [
                    h(NAvatar, { class: ' text-lg mb-2', src: user.avatarUrl, size: 62, round: true }),
                    h('div', { class: 'ml-4 h-full flex flex-col justify-center' }, [
                        h('div', { class: 'text-lg font-semibold flex items-center text-gray-800' }, [
                            h('span', null, user.userName),
                            h(NTag, { class: 'ml-2 text-xs', type: 'success', size: 'small', round: true, }, {
                                default: () => '董事长',
                                icon: () => h(NIcon, { size: 12 }, { default: () => h(Person) }),
                            }),
                        ]),
                        h('div', { class: 'text-xs text-gray-500' }, user.email),
                    ]),
                ]),

            ])
        },
    },
    {
        type: 'divider',
    },
    {

        label: '我的个人名片',
        key: 'my-card',
        props: {
            onClick: () => {
                console.log('我的名片与二维码')
            },
        },
    },
    {
        type: 'divider',
    },

    {
        label: '退出登录',
        key: 'logout',
        props: {
            onClick: () => {
                handleLogout()
            },
        },
    },

]



/**
 * 图标映射
 */
const iconMap: Record<string, Component> = {
    chat: Chatbubbles,
    user: Person,
    setting: Settings,
}

/**
 * 路由菜单
 */
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

function go(item: MenuItem) {
    if (route.name !== item.name) {
        router.push({ name: item.name })
    }
}

/**
 * 退出登录逻辑
 */
function handleLogout() {
    // 调用preload脚本中暴露的接口
    window.electron.ipcRenderer.send('logout-open-loginWindow')
}
</script>

<style scoped>
/* 可选：让选中态更明显 */
</style>

<template>
    <div class="w-[76px] gap-3 h-full flex flex-col items-center justify-between rounded-[14px]">
        <!-- 顶部：头像 -->
        <div class="mt-10 flex flex-col items-center gap-4  cursor-pointer">
            <n-dropdown trigger="click" placement="right-start"
                style="width: 140px; border: 1px solid #ccc; border-radius: 10px;" :options="[
                    {
                        render: () => {
                            return h('div', {
                                class: 'p-2 cursor-pointer hover:bg-gray-100 rounded-md',
                                onClick: handleLogout
                            }, '确认退出登录？')
                        }
                    },
                    {
                        label: '退出登录',
                        key: 'logout',
                        icon() {
                            return h(NIcon, null, {
                                default: () => h(LogOutOutline)
                            })
                        }


                    }
                ]">
                <n-avatar round :src="user.avatarUrl" />
            </n-dropdown>
        </div>
        <div>
            <div
                class=" text-zinc-800 w-9 h-9 flex justify-center bg-gray-50 items-center rounded-full hover:bg-zinc-300 cursor-pointer">
                <n-icon size="20">
                    <Search />
                </n-icon>
            </div>
        </div>

        <div class="flex-1 w-full flex flex-col items-center gap-1 rounded-md pt-0 p-2">
            <!-- 自定义按钮结构 -->
            <div v-for="item in menus" :key="item.key" @click="go(item)" :class="[
                'flex flex-col items-center justify-center gap-1 h-14 w-16 cursor-pointer rounded-lg transition-all',
                route.name === item.name
                    ? ' bg-white text-primary-600'
                    : 'hover:bg-gray-50 '
            ]">
                <!-- 图标 -->
                <n-badge :dot="item.hasMessage" color="red" size="small">
                    <div class="h-8 w-8 flex flex-col gap-1 justify-center items-center">
                        <n-icon size="18" :color="route.name === item.name ? '#444' : '#aaa'">
                            <component :is="iconMap[item.icon]" />
                        </n-icon>
                        <!-- 文字 -->
                        <span class=" text-[10px] leading-none font-medium"
                            :style="{ color: route.name === item.name ? '#444' : '#aaa' }">
                            {{ item.label }}
                        </span>
                    </div>
                </n-badge>
            </div>
        </div>


    </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NIcon } from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import type { Component, render } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
    Chatbubbles,
    Person,
    Settings
    , SearchOutline as Search,
    LogOutOutline
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
 * 图标映射
 */
const iconMap: Record<string, Component> = {
    chat: Chatbubbles,
    user: Person,
    setting: Settings
}

/**
 * 路由菜单
 */
const menus = ref<MenuItem[]>([])
onMounted(() => {
    menus.value = [
        { key: 'home', name: 'home', icon: 'chat', label: '消息', hasMessage: true },
        { key: 'user', name: 'user', icon: 'user', label: '通讯录' },
        { key: 'setting', name: 'setting', icon: 'setting', label: '设置' }
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
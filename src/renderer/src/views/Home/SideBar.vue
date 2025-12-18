<template>
    <div class="w-[76px] gap-3 h-full flex flex-col items-center justify-between rounded-[14px]">
        <!-- 顶部：头像 -->
        <div class="mt-10 flex flex-col items-center gap-4">
            <n-avatar round src="https://http.cat/200" />
        </div>

        <div class="flex-1 w-full flex flex-col items-center gap-1 rounded-md  p-2">
            <!-- 自定义按钮结构 -->
            <div v-for="item in menus" :key="item.key" @click="go(item)" :class="[
                'flex flex-col items-center justify-center gap-1 h-14 w-16 cursor-pointer rounded-lg transition-all',
                route.name === item.name
                    ? ' bg-white text-primary-600'
                    : 'hover:bg-gray-50 '
            ]">
                <!-- 图标 -->
                <n-icon size="24" :color="route.name === item.name ? '#18a058' : '#aaa'">
                    <component :is="iconMap[item.icon]" />
                </n-icon>

                <!-- 文字 -->
                <span class=" text-[10px] leading-none"
                    :style="{ color: route.name === item.name ? '#18a058' : '#aaa' }">
                    {{ item.label }}
                </span>
            </div>
        </div>

        <!-- 底部：退出登录 -->
        <div class="h-20 flex items-center">
            <a class="text-xs text-gray-500 cursor-pointer" @click="$router.push('/login')">
                退出
            </a>
        </div>
    </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NIcon } from 'naive-ui'
import { ref, onMounted } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
    Chatbubbles,
    Person,
    Settings
} from '@vicons/ionicons5'

/* ---------------- router ---------------- */
const router = useRouter()
const route = useRoute()

/* ---------------- 后端菜单结构 ---------------- */
interface MenuItem {
    key: string
    name: string
    icon: string
    label?: string
}

/* ---------------- icon 映射 ---------------- */
const iconMap: Record<string, Component> = {
    chat: Chatbubbles,
    user: Person,
    setting: Settings
}

/* ---------------- 菜单数据 ---------------- */
const menus = ref<MenuItem[]>([])

onMounted(() => {
    menus.value = [
        { key: 'home', name: 'home', icon: 'chat', label: '聊天' },
        { key: 'user', name: 'user', icon: 'user', label: '用户' },
        { key: 'setting', name: 'setting', icon: 'setting', label: '设置' }
    ]
})

function go(item: MenuItem) {
    if (route.name !== item.name) {
        router.push({ name: item.name })
    }
}
</script>

<style scoped>
/* 可选：让选中态更明显 */
.n-button--primary {
    box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.3);
}
</style>
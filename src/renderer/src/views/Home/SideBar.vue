<template>
    <div class="w-12 h-full gap-5  flex flex-col justify-between items-center rounded-[14px] ">
        <div class=" mt-4 flex flex-col gap-2 justify-center items-center">
             <n-avatar round src="https://http.cat/200" />

            <n-button circle strong secondary :render-icon="cashIcon" class="w-6">
            </n-button>
            <n-button circle strong secondary class="w-6">
                 <template #icon>
                    <SearchCircle/>
                </template>
            </n-button>
        </div>

    
        <div class=" flex-1 w-full flex justify-center items-center text-gray-400 text-sm bg-gray-200">
            导航list
        </div>
        <div class="h-20">
            <a @click="$router.push('/login')">退出登录</a>
        </div>

    </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, } from 'naive-ui';
import { AddCircleSharp as CashIcon,SearchCircle } from '@vicons/ionicons5';
import { h } from 'vue';

function cashIcon() {
    return h(CashIcon, {
        default: CashIcon
    });
}
</script>

<style scoped></style>
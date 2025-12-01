<template>
    <div class="h-full w-full flex justify-center items-center">
        <div class=" grid grid-cols-5 grid-rows-9 h-[450px] w-[600px] rounded-lg border-2 bg-white border-gray-200">
         
            <div class=" col-span-5 row-span-2 flex flex-col justify-center items-center mt-5">
                <h1 class=" text-3xl font-bold text-gray-800 mb-2">注册 Spanner Tools账号</h1>
                <p class=" text-sm text-gray-300">欢迎加入 Spanner Tools，请填写信息注册</p>
            </div>
            <n-divider class=" col-span-5 row-span-1 "/>

            <!-- 注册表单主体 -->
            <div class="col-span-5 row-span-4 rounded-lg ml-10 mr-10 mb-10">
                <form class="flex flex-col gap-3">
                    <n-input placeholder="用户名" class="w-full "  clearable />
                    <n-input-group>
                        <n-input placeholder="邮箱"  class="w-full "  clearable />
                        <n-input-group-label  class=" !important rounded-r-3xl" >@okrsek.com</n-input-group-label>
                        <n-button class=" !important rounded-l-3xl"  >发送验证码</n-button>
                    </n-input-group>

                    <n-input type="password" placeholder="密码" show-password-on="mousedown" class="w-full"  clearable />
                    <n-input type="password" placeholder="确认密码"  class="w-full"  clearable />
                        <n-input-otp block/>

                    <div class="grid grid-cols-5 gap-2 mt-2">
                        <n-button type="primary" class="w-full col-span-5">注册</n-button>
                        <n-button class="w-full col-span-5" :render-icon="goBackIcon" @click="$router.push('/login')">返回</n-button>

                    </div>
                </form>
            </div>

        </div>
    </div>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { ArrowBackCircleOutline as GoBackIcon} from '@vicons/ionicons5';
import {useTitleStore} from '../stores/title';
const titleStore = useTitleStore();

titleStore.setTitle('注册账号');

function goBackIcon(){
    return h(GoBackIcon, { 
        deafult: GoBackIcon
     });
}

</script>

<style scoped>

</style>
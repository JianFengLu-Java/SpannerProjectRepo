<template>
  <div class="h-full w-full justify-center flex items-center">

    <div class="flex justify-center items-center">
      <div class="grid grid-cols-8 grid-rows-10 border-2 z-11 border-gray-200 w-[680px] h-[530px] rounded-xl bg-white">
        <div
          class="row-span-10 col-span-3 flex justify-center items-center overflow-hidden border-r border-gray-200 h-full">
          <img src="../assets/logo-Login.png" alt="Login Illustration" class="aspect-square w-40 h-40"
            draggable="false" />
        </div>

        <!-- 顶部标题 -->
        <div class="col-span-5 row-span-2 flex flex-col ml-10 text-xl justify-center">
          <h1 class="font-bold">
            欢迎使用
            <n-gradient-text :size="26" type="success">
              Spanner 工具箱
            </n-gradient-text>
          </h1>
          <p class="text-sm text-gray-300">
            Welcome to Spanner Tools,please login below
          </p>
        </div>

        <!-- 登录表单主体 -->
        <div class="col-span-5 row-span-8 flex rounded-lg ml-16 mr-16 mb-10">
          <div class="justify-center flex w-full h-full pt-2">
            <form class="flex flex-col w-full gap-3">
              <div class="flex flex-col justify-center items-center gap-3">
                <div class="h-20 w-20 flex items-center justify-center">
                  <img src="https://http.cat/401" alt="Ok Icon" class="aspect-square rounded-full" draggable="false" />
                </div>
                <div class="flex flex-col gap-3 w-full">
                  <n-input placeholder="用户名" class="w-full" clearable v-model:value="userName" />
                  <n-input type="password" placeholder="密码" class="w-full" clearable v-model:value="password" />
                </div>
              </div>
              <div class="grid grid-cols-5 gap-2 mt-2">
                <n-button type="primary" class="w-full col-span-3" size="large" :render-icon="okIcon"
                  @click="handleLogin">登录</n-button>
                <n-button type="primary" class="w-full col-span-2" size="large" color="#10b981"
                  :render-icon="registerIcon" @click="$router.push('/register')">注册</n-button>
              </div>
              <div class="justify-between flex mt-2">
                <n-checkbox>记住我</n-checkbox>
                <a class="text-sm text-gray-400" draggable="false">忘记密码？</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NGradientText, NCheckbox, NImage, useMessage } from 'naive-ui'
import { h, ref } from 'vue'
import { LogIn as OkIcon, Sparkles as RegisterIcon } from '@vicons/ionicons5'
import { useTitleStore } from '../stores/title'
import axios from 'axios'
import { useRouter } from 'vue-router'
const titleStore = useTitleStore()
const message = useMessage()
titleStore.setTitle('Spanner Tools')

/**
 *
 * 声明动态值
 *
 */
const userName = ref('')
const password = ref('')
const isLoading = ref(false)
const router = useRouter()


function handleLogin() {
  if (!userName.value || !password.value) {
    message.error('用户名或密码不能为空')

    return
  }
  isLoading.value = true
  axios
    .post('http://localhost:8080/user/login', {
      username: userName.value,
      password: password.value,
    })
    .then((response) => {
      console.log(response.status)
      if (response.status) {
        message.success('登录成功')
        router.push('/home')
      } else {
        message.error('登录失败，请检查用户名和密码')
      }
      // 处理登录成功逻辑，例如存储令牌、重定向等
    })
    .catch((error) => {
      message.error('登录失败，请检查用户名和密码')
    })
    .finally(() => {
      isLoading.value = false
    })



}



// import Background from '../components/Background.vue';
const hello: string = 'Hello, world!'
console.log(hello)
/**
 * 登录按钮图标渲染函数
 */
function okIcon() {
  return h(OkIcon, {
    deafult: OkIcon,
  })
}

/**
 * 注册按钮图标渲染函数
 */
function registerIcon() {
  return h(RegisterIcon, {
    deafult: RegisterIcon,
  })
}
</script>

<style scoped></style>

<template>
    <div class="h-full w-full flex justify-center items-center">
        <div class="grid grid-cols-5 grid-rows-9 h-[700px] w-[600px] rounded-lg border-2 bg-white border-gray-200">
            <div class="col-span-5 row-span-1 flex flex-col justify-center items-center mt-5">
                <h1 class="text-xl font-bold text-gray-800">
                    注册 Spanner Tools账号
                </h1>
                <p class="text-xs text-gray-300">
                    欢迎加入 Spanner Tools，请填写信息注册
                </p>
            </div>
            <n-divider class="col-span-5 row-span-1" />

            <!-- 注册表单主体 -->
            <div class="col-span-5 row-span-4 rounded-lg ml-30 mr-30 mb-10">
                <n-form label-placement="left" class="flex flex-col">
                    <div class=" w-full justify-center items-center flex">
                        <div class=" w-30">
                            <n-upload list-type="image-card" :max="1" :on-before-upload="beforeUpload"
                                :on-finish="handleUploadFinish" :on-error="handleUploadError"
                                :custom-request="customUploadRequest" :show-preview-button="false">
                            </n-upload>
                        </div>
                    </div>
                    <n-form-item path="userName" label="真实姓名:">
                        <n-input v-model:value="userName" placeholder="输入您的真实姓名" class="w-full" clearable />

                    </n-form-item>
                    <n-form-item path="email" label="邮箱地址:">
                        <n-input-group>
                            <n-input v-model:value="email" placeholder="邮箱" class="w-full" clearable />
                            <n-input-group-label class="!important rounded-r-3xl">{{ emailSuffix
                                }}</n-input-group-label>
                        </n-input-group>
                    </n-form-item>
                    <n-form-item path="sex" label="性别:">
                        <div class=" pl-6 w-full">
                            <n-radio-group v-model:value="sex">
                                <n-radio v-for="option in sexChange" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </n-radio>
                            </n-radio-group>
                        </div>

                    </n-form-item>


                    <n-input v-model:value="address" placeholder="地址" class="w-full" clearable />
                    <n-input v-model:value="password" type="password" placeholder="密码" show-password-on="mousedown"
                        class="w-full" clearable />
                    <n-input v-model:value="confirmPassword" type="password" placeholder="确认密码" class="w-full"
                        clearable />

                    <div class="grid grid-cols-5 gap-2 mt-2">
                        <n-button type="primary" class="w-full col-span-5" @click="submitRegistration">注册</n-button>
                        <n-button class="w-full col-span-5" :render-icon="goBackIcon"
                            @click="$router.push('/login')">返回</n-button>
                    </div>
                </n-form>
            </div>
            <div>
                <n-json-pretty :data="displayData" />

            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * Register.vue
 * 注册页面
 */
import { h, ref } from 'vue'
import { ArrowBackCircleOutline as GoBackIcon } from '@vicons/ionicons5'
import { useTitleStore } from '../../stores/title'
import { useMessage } from 'naive-ui'
import axios from 'axios'
import { useRouter } from 'vue-router'

const updateAvatarUrl = 'http://localhost:8080/files/update/avatar'


const sex = ref<string | null>(null)
const sexChange = [{
    value: "male",
    label: "男"
},
{
    value: "female",
    label: "女"
}
].map((s) => {
    s.value = s.value
    return s
})



const emailSuffix = ref('@oakevergames.com')
const message = useMessage()
const router = useRouter()
const avatarUrl = ref('')
const userName = ref('')
const email = ref('')
const password = ref('')
const address = ref('')
const confirmPassword = ref('')

const displayData = ref({})

async function submitRegistration() {
    displayData.value = {
        userName: userName.value,
        email: email.value + emailSuffix.value,
        password: password.value,
        confirmPassword: confirmPassword.value,
        avatarUrl: avatarUrl.value,
        address: address.value,
        sex: sex.value,
    }
    console.log('Submitting registration with data:', displayData.value)

    const response = await axios.post(
        updateAvatarUrl,
        displayData.value,
        {
            headers: {
                // 'Content-Type': 'multipart/form-data',
            },
        },
    )

    if (response.data.code === 200) {
        message.success('注册成功！请登录。')
        // router.push('/login')

        router.push({
            name: 'RegisterResult',
            params: {
                userInfo: "12345"
            }
        })
    } else {
        message.error(`注册失败：${response.data.message}`)
    }
}


async function customUploadRequest({ file, onFinish, onError }) {
    console.log('Uploading file:', file)

    const formData = new FormData()
    formData.append('file', file.file)

    try {
        const response = await axios.post(
            updateAvatarUrl,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            },
        )

        file.response = response.data
        console.log('Upload response:', response.data)

        onFinish({
            file,
            event: null
        })
    } catch (error) {
        onError(error)
    }
}

function beforeUpload({ file }) {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
        message.error('只能上传图片文件！')
    }
    return isImage
}

function handleUploadFinish({ file }) {
    console.log(file.response.status)
    const response = file.response

    if (response?.status === "success") {
        avatarUrl.value = response.fileUrl
        message.success('头像上传成功！')
    } else {
        message.error('头像上传失败，请重试！')
        console.error('头像上传失败:', response?.message || '未知错误')
        return
    }
}

function handleUploadError() {
    message.error('头像上传失败，请重试！cuowu')
}

const titleStore = useTitleStore()

titleStore.setTitle('注册账号')

function goBackIcon() {
    return h(GoBackIcon, {
        deafult: GoBackIcon,
    })
}
</script>

<style scoped></style>

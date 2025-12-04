<template>
    <div class=" h-screen w-full flex gap-2 pl-1">
        <SideBar />
        <div class="  h-full  overflow-y-auto bg-white border border-gray-300 rounded-xl w-full p-3">
            <router-view />
            <n-button @click="openWindow">
                hello
            </n-button>
            <n-button @click="userInfo">
                获取用户信息
            </n-button>
            <div>
                {{ userInfoContent }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue';
import axios from 'axios';
import { ref } from 'vue';

const openWindow = () => {
    window.electron.ipcRenderer.send('open-login-window');
};
const userInfoContent: any = ref({});

const userInfo = () => {
    axios.get('http://localhost:8080/users/getUserInfoByName/admin').then((response) => {
        console.log(response.data);
        userInfoContent.value = response.data;
    }).catch((error) => {
        console.error('Error fetching user info:', error);
        userInfoContent.value = { name: 'Error fetching user info' };
    });
}



</script>

<style scoped></style>
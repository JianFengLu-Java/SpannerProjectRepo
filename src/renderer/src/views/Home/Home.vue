<template>
    <div class="h-full w-full flex bg-[#ECEDEE] gap-1 p-1">
        <SideBar />
        <div class="h-full  w-full overflow-hidden">
            <router-view />
        </div>

    </div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue'
</script>

<style scoped></style>

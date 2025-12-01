<script setup lang="ts">
import { useTitleStore } from './stores/title';
const titleStore = useTitleStore();

</script>

<template>
<div class=" h-screen w-screen">
  <div class=" flex flex-col  h-full  rounded-2xl  bg-gray-100 overflow-hidden pt-0 p-1">
    <div class=" h-9 w-full drag">
      <div class=" h-full w-full pl-20 flex  items-center text-gray-500 font-bold text-sm select-none">
        {{ titleStore.title }}
      </div>
    </div>
   
      <router-view/>
  </div>
</div>

  

</template>

<style>
* {
    user-select: none;
    -webkit-user-select: none; /* Chrome/Safari */
  -moz-user-select: none;    /* Firefox */
  -ms-user-select: none;
}
.drag {
    -webkit-app-region: drag;
}
</style>
<script setup lang="ts">
import { GlobalThemeOverrides, NConfigProvider, NThemeEditor } from 'naive-ui';
import { useTitleStore } from './stores/title';
const titleStore = useTitleStore();

const themeOverrides: GlobalThemeOverrides = {
  Message: {
    borderRadius: '8px',
    margin: '20px',
  },
  Card: {
    borderRadius: '8px',
  },
  Upload: {
    borderRadius: '100%',
  },
  Input: {
    borderRadius: '8px',
  },
  Button: {
    borderRadiusTiny: '8px',
    borderRadiusSmall: '8px',
    borderRadiusMedium: '8px',
    borderRadiusLarge: '8px',
  }
}

</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-theme-editor>


      <div class=" h-screen w-screen">
        <div class=" flex flex-col  h-full  rounded-2xl  bg-gray-100 overflow-hidden pt-0 p-1">
          <div class=" h-9 w-full drag">
            <div class=" h-full w-full pl-20 flex  items-center text-gray-500 font-bold text-sm select-none">
              {{ titleStore.title }}
            </div>
          </div>
          <n-message-provider>
            <router-view />
          </n-message-provider>
        </div>
      </div>
    </n-theme-editor>

  </n-config-provider>

</template>

<style>
* {
  user-select: none;
  -webkit-user-select: none;
  /* Chrome/Safari */
  -moz-user-select: none;
  /* Firefox */
  -ms-user-select: none;
}

.drag {
  -webkit-app-region: drag;
}
</style>
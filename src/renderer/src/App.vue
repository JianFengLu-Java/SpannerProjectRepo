<script setup lang="ts">
import { GlobalThemeOverrides, NConfigProvider, NThemeEditor } from 'naive-ui';
import { useTitleStore } from './stores/title';
const titleStore = useTitleStore();

const themeOverrides: GlobalThemeOverrides = {
  Message: {
    borderRadius: '8px',

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
    borderRadiusLarge: '9px',
  }
}

</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-theme-editor>
      <div class=" h-screen w-screen overflow-hidden">

        <div class=" h-full w-full  overflow-hidden  ">
          <n-message-provider :top="38">
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
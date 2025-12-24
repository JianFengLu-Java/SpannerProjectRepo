<script setup lang="ts">
import { GlobalThemeOverrides, NConfigProvider, NThemeEditor } from 'naive-ui'
import { useTitleStore } from './stores/title'
import Dragable from './components/Dragable.vue'
import { ref } from 'vue'
const titleStore = useTitleStore()

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
		borderRadiusTiny: '10px',
		borderRadiusSmall: '10px',
		borderRadiusMedium: '10px',
		borderRadiusLarge: '10px',
	},
	Dropdown: {
		borderRadius: '8px',
	},
	Badge: {
		fontSize: '10px',
		color: '#FF0004FF',
	},
}
</script>

<template>
	<n-config-provider :theme-overrides="themeOverrides">
		<dragable />

		<div class="h-screen w-screen overflow-hidden relative">
			<div class="h-full w-full overflow-hidden">
				<n-message-provider
					:container-style="{ marginTop: '16px' }"
					max="5"
				>
					<router-view />
				</n-message-provider>
			</div>
		</div>
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
</style>

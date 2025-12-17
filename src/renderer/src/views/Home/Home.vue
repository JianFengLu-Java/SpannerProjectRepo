<template>
	<div class="h-full w-full flex bg-[#ECEDEE] gap-1 p-2">
		<SideBar />
		<div class="h-full w-full overflow-hidden">
			<router-view v-slot="{ Component, route }">
				<keep-alive>
					<component :is="Component" :key="route.name" />
				</keep-alive>
			</router-view>
		</div>
	</div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue'
</script>

<style scoped></style>

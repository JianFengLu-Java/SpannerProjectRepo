<template>
	<div class="h-full w-full flex bg-[#ECEDEE] gap-0">
		<SideBar />
		<div class="h-full w-full overflow-hidden pl-0 p-1.5">
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

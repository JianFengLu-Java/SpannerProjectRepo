<template>
	<div>{{ imgString }}</div>
	<img :src="imgString" />
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router'
const route = useRoute()
const imgString = route.query.url
</script>

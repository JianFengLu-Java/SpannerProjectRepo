<template>
	<div class="brand-particle-layer">
		<span
			v-for="particle in particles"
			:key="particle.id"
			class="brand-particle"
			:style="{
				left: `${particle.x}%`,
				top: `${particle.y}%`,
				width: `${particle.size}px`,
				height: `${particle.size}px`,
				opacity: particle.opacity,
				'--drift-x': `${particle.driftX}px`,
				'--drift-y': `${particle.driftY}px`,
				'--duration': `${particle.duration}s`,
				'--delay': `${particle.delay}s`,
			}"
		></span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		count?: number
	}>(),
	{
		count: 22,
	},
)

const particles = computed(() =>
	Array.from({ length: props.count }, (_, id) => ({
		id,
		x: Math.random() * 100,
		y: Math.random() * 100,
		size: Math.random() * 5 + 2,
		opacity: Math.random() * 0.3 + 0.18,
		driftX: Math.random() * 26 - 13,
		driftY: Math.random() * 30 + 12,
		duration: Math.random() * 8 + 8,
		delay: Math.random() * 5,
	})),
)
</script>

<style scoped>
.brand-particle-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.brand-particle {
	position: absolute;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.5);
	animation-name: particle-drift, particle-twinkle;
	animation-duration: var(--duration), 3.6s;
	animation-delay: var(--delay), calc(var(--delay) * 0.6);
	animation-iteration-count: infinite, infinite;
	animation-timing-function: ease-in-out, ease-in-out;
}

@keyframes particle-drift {
	0%,
	100% {
		transform: translate3d(0, 0, 0) scale(1);
	}
	50% {
		transform: translate3d(var(--drift-x), calc(-1 * var(--drift-y)), 0)
			scale(1.2);
	}
}

@keyframes particle-twinkle {
	0%,
	100% {
		filter: brightness(0.95);
	}
	50% {
		filter: brightness(1.35);
	}
}
</style>

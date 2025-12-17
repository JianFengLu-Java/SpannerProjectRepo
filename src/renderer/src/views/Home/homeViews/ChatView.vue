<template>
    <div class="root gap-0.5">
        <div class="flex rounded-sm bg-white" :style="{ width: listWidth + 'px' }">
            list view
        </div>

        <div class="drag hover:bg-green-400  duration-1200 rounded-2xl" @mousedown="startDrag" />

        <div class=" flex rounded-sm  bg-white w-full">
            🚧
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useTitleStore } from '@renderer/stores/title'

const listWidth = ref(250)
const titleStore = useTitleStore()
titleStore.setTitle('聊天')


let startX = 0
let startWidth = 0

function startDrag(e: MouseEvent) {
    startX = e.clientX
    startWidth = listWidth.value

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stopDrag)
}

function onMove(e: MouseEvent) {
    const delta = e.clientX - startX
    listWidth.value = Math.min(300, Math.max(230, startWidth + delta))
}

function stopDrag() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', stopDrag)
}
</script>
<style scoped>
.root {
    display: flex;
    height: 100%;
    width: 100%;
}


.drag {
    width: 4px;
    cursor: col-resize;

}

.content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
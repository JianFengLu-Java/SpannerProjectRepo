<template>
  <div class="h-full w-full flex">
    <!-- 左侧聊天列表 -->
    <div class="h-full flex flex-col bg-white  rounded-xl overflow-hidden transition-all duration-200"
      :style="{ width: `${listWidth}px` }">
      <!-- 搜索和功能栏 -->
      <div class="p-3 pb-1 border-gray-100">
        <div class="flex items-center gap-2 ">
          <n-dropdown :options="options" trigger="hover" placement="bottom-start">
            <div
              class="no-drag z-60! items-center justify-center flex rounded-md w-8 h-8 hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
              <n-icon size="20" class="text-gray-600">
                <List28Filled />
              </n-icon>
            </div>
          </n-dropdown>
          <span class="text-sm font-medium text-gray-800 flex-1">聊天</span>

        </div>
      </div>

      <!-- 置顶会话 -->
      <div v-if="pinnedChats.length > 0" class="px-3  pb-1 border-b border-gray-100">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">置顶</span>
        </div>
        <div class=" flex">
          <div v-for="chat in pinnedChats" :key="chat.id"
            class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            :class="{ 'bg-gray-100 hover:bg-blue-50': activeChatId === chat.id }" @click="selectChat(chat)">
            <n-avatar :size="36" round :src="chat.avatar" class="border border-gray-200" />
          </div>
        </div>
      </div>

      <!-- 所有聊天 -->
      <div class="flex-1 overflow-hidden">
        <n-virtual-list :items="chatlist" :item-size="68" class="h-full">
          <template #default="{ item, index }">
            <div :key="item.id"
              class="px-1 py-2 m-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-100  å"
              :class="{
                'bg-gray-100  hover:bg-gray-200': activeChatId === item.id,
                'border-t': index === 0 && pinnedChats.length === 0
              }" @click="selectChat(item)">
              <div class="flex items-center gap-3 ml-2 mr-3">
                <!-- 头像和状态 -->
                <div class="relative">
                  <n-avatar :size="28" round :src="item.avatar" class="border border-gray-200" />
                  <!-- 在线状态 -->
                  <div v-if="item.online"
                    class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                <!-- 聊天信息 -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <div class="text-sm text-gray-700 truncate">
                      {{ item.name }}
                    </div>
                    <div class="text-xs text-gray-400 whitespace-nowrap ml-2">
                      {{ formatTime(item.timestamp) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="text-xs text-gray-500 truncate flex-1">
                      {{ item.lastMessage }}
                    </div>
                    <!-- 未读消息标记 -->
                    <div v-if="item.unreadCount > 0"
                      class="shrink-0 flex items-center justify-center min-w-3 h-4 px-1.5 bg-green-500 rounded-full">
                      <span class="text-xs text-white font-medium leading-none">
                        {{ item.unreadCount > 99 ? '99+' : item.unreadCount }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </n-virtual-list>
      </div>

    </div>

    <!-- 可拖拽调整宽度的分割线 -->
    <div
      class="w-1 cursor-col-resize hover:bg-green-300 transition-colors duration-200 flex items-center justify-center"
      @mousedown="startDrag">
      <div class="w-px h-6"></div>
    </div>

    <!-- 主聊天区域 -->
    <div class="flex-1 bg-white overflow-hidden rounded-xl">
      <ChatDemo />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTitleStore } from '@renderer/stores/title'
import {
  List28Filled,
  Add16Regular,
  Search16Regular,
  ChevronRight20Regular
} from '@vicons/fluent'
import { NDropdown, NIcon, NAvatar, NVirtualList } from 'naive-ui'
import ChatDemo from '@renderer/components/ChatDemo.vue'

const listWidth = ref(300)
const titleStore = useTitleStore()
titleStore.setTitle('聊天')

// 当前选中的聊天
const activeChatId = ref<number>(1)

// 菜单选项
const options = [
  {
    label: '全部聊天',
    key: 'all'
  },
  {
    label: '未读消息',
    key: 'unread'
  },
  {
    type: 'divider'
  },
  {
    label: '创建群聊',
    key: 'createGroup'
  },
  {
    label: '添加好友',
    key: 'addFriend'
  }
]

// 置顶聊天
const pinnedChats = ref([
  {
    id: 1,
    name: '张三',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    lastMessage: '项目文档已更新',
    timestamp: '10:30',
    online: true
  },
  {
    id: 2,
    name: '李四',
    avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
    lastMessage: '会议纪要已同步',
    timestamp: '昨天',
    online: false
  }
])

// 聊天列表
const chatlist = ref([
  {
    id: 1,
    name: '张三',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    lastMessage: '设计稿已上传，请查收',
    timestamp: '10:30',
    online: true,
    unreadCount: 2
  },
  {
    id: 2,
    name: '李四',
    avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
    lastMessage: '请问你们的服务时间是？',
    timestamp: '9:15',
    online: true,
    unreadCount: 0
  },
  {
    id: 3,
    name: '王五',
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
    lastMessage: '谢谢你的帮助！',
    timestamp: '昨天',
    online: false,
    unreadCount: 5
  },
  {
    id: 4,
    name: '赵六',
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    lastMessage: '我有一个问题想咨询一下',
    timestamp: '周一',
    online: true,
    unreadCount: 0
  },
  {
    id: 5,
    name: '钱七',
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    lastMessage: '我想了解一下你们的最新产品',
    timestamp: '周日',
    online: false,
    unreadCount: 0
  },
  {
    id: 6,
    name: '孙八',
    avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
    lastMessage: '请问你们的服务时间是？',
    timestamp: '周六',
    online: true,
    unreadCount: 3
  },
  {
    id: 7,
    name: '周九',
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
    lastMessage: '谢谢你的帮助！',
    timestamp: '周五',
    online: false,
    unreadCount: 0
  },
  {
    id: 8,
    name: '吴十',
    avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
    lastMessage: '我有一个问题想咨询一下',
    timestamp: '周四',
    online: true,
    unreadCount: 0
  }
])

// 选择聊天
const selectChat = (chat: any) => {
  activeChatId.value = chat.id
  console.log('选择聊天:', chat.name)
}

// 格式化时间显示
const formatTime = (time: string) => {
  if (time.includes(':')) {
    return time
  }
  return time
}

// 拖拽调整宽度
let startX = 0
let startWidth = 0
let isDragging = false

const startDrag = (e: MouseEvent) => {
  isDragging = true
  startX = e.clientX
  startWidth = listWidth.value

  const onMove = (moveEvent: MouseEvent) => {
    if (!isDragging) return
    const delta = moveEvent.clientX - startX
    listWidth.value = Math.min(400, Math.max(260, startWidth + delta))
  }

  const stopDrag = () => {
    isDragging = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', stopDrag)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

// 清理事件监听
onUnmounted(() => {
  document.removeEventListener('mousemove', () => { })
  document.removeEventListener('mouseup', () => { })
})
</script>

<style scoped>
/* 自定义滚动条样式 */
:deep(.n-virtual-list) {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
}

:deep(.n-virtual-list)::-webkit-scrollbar {
  width: 6px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.4);
  border-radius: 3px;
}

:deep(.n-virtual-list)::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.6);
}

/* 拖拽条样式 */
.w-1:hover {
  background: linear-gradient(90deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(59, 130, 246, 0.3) 50%,
      rgba(59, 130, 246, 0.1) 100%);
}

/* 搜索框聚焦效果 */
input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* 无拖拽区域 */
.no-drag {
  -webkit-app-region: no-drag;
  user-select: none;
}
</style>
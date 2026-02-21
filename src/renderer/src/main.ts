import { createApp } from 'vue'
import App from './App.vue'
import './assets/base.css'
import router from './router'
import naive from 'naive-ui'
import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'
import { tokenManager } from '@renderer/services/tokenManager'
import { onIncomingCall } from '@renderer/services/callSignal'

const app = createApp(App)

// 创建 pinia 实例
const pinia = createPinia()

pinia.use(piniaPersist)
tokenManager.init()
const seenCallIds = new Set<string>()
onIncomingCall((payload) => {
	if (seenCallIds.has(payload.callId)) return
	seenCallIds.add(payload.callId)
	window.api.openIncomingCallWindow({
		callId: payload.callId,
		fromAccount: payload.fromAccount,
		fromName: payload.fromName,
		fromAvatar: payload.fromAvatar,
		chatId: payload.chatId,
		type: payload.type,
	})
})

// 挂载到 app
app.use(router).use(naive).use(pinia).mount('#app')

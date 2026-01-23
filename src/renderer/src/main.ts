import { createApp } from 'vue'
import App from './App.vue'
import './assets/base.css'
import router from './router'
import naive from 'naive-ui'
import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'

const app = createApp(App)

// 创建 pinia 实例
const pinia = createPinia()

pinia.use(piniaPersist)

// 挂载到 app
app.use(router).use(naive).use(pinia).mount('#app')

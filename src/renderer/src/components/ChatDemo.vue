<template>
    <div>
        <n-button @click="connect" :disabled="connected">Connect</n-button>
        <n-input v-model:value="sendContent" placeholder="Type your message" :disabled="!connected" />
        <n-button @click="send" :disabled="!connected || !sendContent">Send</n-button>
        <n-button @click="disconnect" :disabled="!connected">Disconnect</n-button>

        <div>Messages:</div>
        <ul>
            <li v-for="(msg, index) in messages" :key="index">{{ msg }}</li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Client } from '@stomp/stompjs'
import { useMessage } from 'naive-ui'

const messageProvider = useMessage()
const messages = ref<string[]>([])
const sendContent = ref('')
const connected = ref(false)
let client: Client | null = null

function connect() {
    client = new Client({
        brokerURL: 'ws://localhost:8080/ws',
        reconnectDelay: 5000,
        onConnect: () => {
            messageProvider.success('WebSocket connected!')
            connected.value = true
            console.log('Connected to WebSocket')

            client?.subscribe('/topic/public', (msg) => {
                if (msg.body) messages.value.push(msg.body)
                console.log('Received:', msg.body)
            })
        },
        onStompError: (frame) => {
            console.error('STOMP Error:', frame.headers['message'])
        }
    })
    client.activate()
}

function send() {
    if (!client || !connected.value || !sendContent.value) return

    client.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
            from: 'vue-user',
            content: sendContent.value
        })
    })

    sendContent.value = ''  // 清空输入框
}

function disconnect() {
    if (client) {
        client.deactivate()
        connected.value = false
        console.log('Disconnected from WebSocket')
    }
}
</script>
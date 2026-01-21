import axios from 'axios'

const server = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	timeout: 10000,
})

export default server

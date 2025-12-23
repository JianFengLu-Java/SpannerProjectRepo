import {
	openLoginWindow,
	openHomeWindow,
	openRegisterWindow,
} from '../windowStatue/windowManage'
import { ipcMain } from 'electron'

function login(): void {
	ipcMain.on('login-success-open-home', () => {
		openHomeWindow()
	})

	ipcMain.on('open-register-window', () => {
		openRegisterWindow()
	})

	ipcMain.on('register-success-open-loginWindow', () => {
		openLoginWindow()
	})

	ipcMain.on('logout-open-loginWindow', () => {
		openLoginWindow()
	})
}

export default login

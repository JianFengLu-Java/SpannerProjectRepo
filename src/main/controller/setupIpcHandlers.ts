import { ipcMain } from 'electron'
import {
	openLoginWindow,
	openHomeWindow,
	openRegisterWindow,
	viewIMGWindow,
} from '../windowStatue/windowManage'

export function setupIpcHandlers(): void {
	// 登录成功
	ipcMain.on('login-success-open-home', () => {
		openHomeWindow()
	})

	// 打开注册（单例模式由 windowManage 保证）
	ipcMain.on('open-register-window', () => {
		openRegisterWindow()
	})

	// 注册成功回登录
	ipcMain.on('register-success-open-loginWindow', () => {
		openLoginWindow()
	})

	// 退出登录
	ipcMain.on('logout-open-loginWindow', () => {
		openLoginWindow()
	})

	//打开图片预览【测试】
	ipcMain.on('view-img', (e, imgUrl) => {
		viewIMGWindow(imgUrl)
	})
}

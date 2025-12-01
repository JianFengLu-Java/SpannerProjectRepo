import { is } from "@electron-toolkit/utils";
import { ipcMain,BrowserWindow } from "electron"
import { join } from 'path'

let onlyWindow: BrowserWindow | null = null;

function createNewWindow(): void {

    if (onlyWindow) {
        onlyWindow.show();
        onlyWindow.focus();
        return;
    }

    // Create the browser window.
    const newWindow = new BrowserWindow({
        width: 800,
        height: 600,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })
    onlyWindow = newWindow;
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    newWindow.loadURL( process.env['ELECTRON_RENDERER_URL'] + '#/register' );
  }
    
    newWindow.on('closed', () => {
        // @ts-ignores
        onlyWindow = null;  
    });
    }


function login(): boolean {

    ipcMain.on('hello',(): String=>{
        console.log('nihao!')
        return '你好！'
    })
    ipcMain.on('open-login-window',()=>{
        createNewWindow();
    })

    return true
}

export default login;
import { BrowserWindow } from "electron"
import { join } from 'path'



let currentWindow: BrowserWindow | null = null;

function createBaseWindows(options: Electron.BrowserWindowConstructorOptions){
    return new BrowserWindow({
        ...options,


        frame:false,
        titleBarStyle:'hiddenInset',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    });

}

function destroyCurrentWindow() {
    if (currentWindow) {
        currentWindow.removeAllListeners()
        currentWindow.close();
        currentWindow = null;
    }
    
}

function loadPage(window: BrowserWindow, page: string) {
    if (process.env.ELECTRON_RENDERER_URL) {
        window.loadURL(process.env['ELECTRON_RENDERER_URL'] + `#/${page}`);
    
    }else {
        window.loadFile(join(__dirname, '../renderer/index.html'), { hash: `#/${page}` });
    }

    window.once('ready-to-show', () => {
        window.show();
    });
}

export function openLoginWindow() {
    destroyCurrentWindow();
    currentWindow = createBaseWindows({ width: 320, height: 540, resizable: false });
    loadPage(currentWindow, 'login');
}


export function openRegisterWindow() {
    destroyCurrentWindow();
    currentWindow = createBaseWindows({ width: 620, height: 740,  });
    loadPage(currentWindow, 'register');
}
export function openHomeWindow() {
    destroyCurrentWindow();
    currentWindow = createBaseWindows({ width: 800, height: 600,minHeight:600,minWidth:800 });
    loadPage(currentWindow, 'home');
}
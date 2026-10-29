// @ts-nocheck
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { launchMinecraft } from "./minecraftLauncher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

// 全局监听所有新窗口创建，强制去掉菜单栏
app.on('browser-window-created', (_, window) => {
  window.setMenu(null); 
  window.setMenuBarVisibility(false);
});

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400, height: 300, transparent: true, frame: false, alwaysOnTop: true, resizable: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const iconPath = path.join(__dirname, "../../resources/icon.ico");
  let iconBase64 = "";
  try {
    if (fs.existsSync(iconPath)) {
      const bitmap = fs.readFileSync(iconPath);
      iconBase64 = `data:image/x-icon;base64,${bitmap.toString("base64")}`;
    }
  } catch (e) {}

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: rgba(30, 30, 30, 0.85); color: white; font-family: system-ui, sans-serif; border-radius: 12px; user-select: none; }
        .logo { width: 120px; height: 120px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin-bottom: 20px; animation: pulse 2s infinite ease-in-out; }
        .title { font-size: 20px; font-weight: bold; letter-spacing: 2px; margin-bottom: 8px; }
        .status { font-size: 12px; color: #aaa; margin-bottom: 16px; }
        .spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #9c27b0; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      </style>
    </head>
    <body>
      ${iconBase64 ? `<img class="logo" src="${iconBase64}" alt="logo" />` : `<div style="width:120px;height:120px;background:#9c27b0;border-radius:20px;margin-bottom:20px;"></div>`}
      <div class="title">BlackGod Craft</div>
      <div class="status">正在初始化启动器...</div>
      <div class="spinner"></div>
    </body>
    </html>
  `;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, "../preload/preload.mjs");
  const iconPath = path.join(__dirname, "../../resources/icon.ico");

  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1000, minHeight: 700, show: false, icon: iconPath, autoHideMenuBar: true, 
    webPreferences: { preload: preloadPath, sandbox: false, contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        frame: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      }
    };
  });

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      if (splashWindow) { splashWindow.destroy(); splashWindow = null; }
      if (mainWindow) { mainWindow.show(); }
    }, 2000); 
  });

  // 接收启动游戏请求
  ipcMain.handle("launcher:start", async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) { await launchMinecraft(win, options); }
  });

  // 🌟 核心修复：在主进程中发起 LittleSkin 认证请求，彻底绕过 CORS 限制
  ipcMain.handle("auth:littleskin", async (event, { username, password }) => {
    try {
      // 使用 Node.js 全局 fetch (Node 18+)
      const res = await fetch("https://littleskin.cn/api/yggdrasil/authserver/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": "zh-CN" },
        body: JSON.stringify({
          username: username,
          password: password,
          clientToken: "BlackGodLauncher_" + Date.now(),
          agent: { name: "Minecraft", version: 1 },
          requestUser: true
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, message: data.errorMessage || data.error || "账号或密码错误" };
      }
      
      return { success: true, data: data };
    } catch (err) {
      return { success: false, message: `网络请求失败: ${err.message}` };
    }
  });
}

app.whenReady().then(() => {
  createSplashWindow(); 
  createMainWindow();   
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
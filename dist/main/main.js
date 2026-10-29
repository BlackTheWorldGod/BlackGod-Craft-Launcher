import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Launch } from "mc-java-core-333";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
async function launchMinecraft(win, options) {
  let authenticator;
  const authType = options.auth.type;
  try {
    win.webContents.send("launcher:log", `正在准备 ${authType} 登录...`);
    if (authType === "offline") {
      authenticator = {
        access_token: "offline",
        client_token: "",
        uuid: "00000000-0000-0000-0000-000000000000",
        name: options.auth.username,
        user_properties: "{}",
        meta: { type: "offline", demo: false }
      };
    } else if (authType === "littleskin") {
      win.webContents.send("launcher:log", "正在连接 LittleSkin 服务器...");
      const response = await fetch("https://littleskin.cn/api/yggdrasil/authserver/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: options.auth.email,
          password: options.auth.password,
          clientToken: "BlackGodLauncher"
        })
      });
      if (!response.ok) throw new Error("LittleSkin 账号或密码错误");
      const data = await response.json();
      win.webContents.send("launcher:log", `LittleSkin 登录成功: ${data.selectedProfile.name}`);
      authenticator = {
        access_token: data.accessToken,
        client_token: data.clientToken,
        uuid: data.selectedProfile.id,
        name: data.selectedProfile.name,
        user_properties: "{}",
        meta: { type: "mojang", demo: false }
      };
    } else {
      throw new Error("未知的登录类型");
    }
  } catch (authError) {
    win.webContents.send("launcher:error", `认证失败: ${authError.message || String(authError)}`);
    return;
  }
  let gamePath = "./.minecraft";
  if (options.isolation === "all") {
    gamePath = `./.minecraft/versions/${options.version}`;
    win.webContents.send("launcher:log", `[隔离] 已开启完全隔离，游戏目录: ${gamePath}`);
  } else if (options.isolation === "mods") {
    const lowerVer = options.version.toLowerCase();
    if (lowerVer.includes("forge") || lowerVer.includes("fabric") || lowerVer.includes("quilt")) {
      gamePath = `./.minecraft/versions/${options.version}`;
      win.webContents.send("launcher:log", `[隔离] 检测到模组版本，游戏目录: ${gamePath}`);
    } else {
      win.webContents.send("launcher:log", `[隔离] 原版游戏，使用共享目录`);
    }
  } else {
    win.webContents.send("launcher:log", `[隔离] 已关闭版本隔离，使用共享目录`);
  }
  const launcher = new Launch();
  launcher.on("progress", (progress, size) => {
    const percent = size > 0 ? Math.min(Math.round(progress / size * 100), 100) : 0;
    win.webContents.send("launcher:progress", percent);
  }).on("data", (line) => {
    const text = String(line);
    if (text.includes("StatusLogger Reconfiguration failed") || text.includes("ERROR StatusLogger")) return;
    win.webContents.send("launcher:log", text);
  }).on("close", () => {
    win.webContents.send("launcher:closed");
  });
  try {
    await launcher.Launch({
      path: "./.minecraft",
      // 固定：游戏核心路径（版本库、依赖库都在这里）
      gamePath,
      // 🌟 动态：游戏数据路径（Mods、存档、配置在这里）
      authenticator,
      version: options.version,
      memory: { min: "2G", max: options.memory },
      detached: true
    });
    win.webContents.send("launcher:started");
  } catch (err) {
    win.webContents.send("launcher:error", String(err));
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let splashWindow = null;
let mainWindow = null;
app.on("browser-window-created", (_, window) => {
  window.setMenu(null);
  window.setMenuBarVisibility(false);
});
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  const iconPath = path.join(__dirname$1, "../../resources/icon.ico");
  let iconBase64 = "";
  try {
    if (fs.existsSync(iconPath)) {
      const bitmap = fs.readFileSync(iconPath);
      iconBase64 = `data:image/x-icon;base64,${bitmap.toString("base64")}`;
    }
  } catch (e) {
  }
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
  const preloadPath = path.join(__dirname$1, "../preload/preload.mjs");
  const iconPath = path.join(__dirname$1, "../../resources/icon.ico");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1e3,
    minHeight: 700,
    show: false,
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: { preload: preloadPath, sandbox: false, contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: "allow",
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
    mainWindow.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.destroy();
        splashWindow = null;
      }
      if (mainWindow) {
        mainWindow.show();
      }
    }, 2e3);
  });
  ipcMain.handle("launcher:start", async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      await launchMinecraft(win, options);
    }
  });
  ipcMain.handle("auth:littleskin", async (event, { username, password }) => {
    try {
      const res = await fetch("https://littleskin.cn/api/yggdrasil/authserver/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": "zh-CN" },
        body: JSON.stringify({
          username,
          password,
          clientToken: "BlackGodLauncher_" + Date.now(),
          agent: { name: "Minecraft", version: 1 },
          requestUser: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.errorMessage || data.error || "账号或密码错误" };
      }
      return { success: true, data };
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

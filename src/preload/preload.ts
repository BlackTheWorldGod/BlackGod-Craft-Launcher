// @ts-nocheck
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("launcherAPI", {
  start: (options: any) => ipcRenderer.invoke("launcher:start", options),
  
  // 🌟 新增：暴露 LittleSkin 认证方法
  authLittleSkin: (data: { username: string; password: string }) => 
    ipcRenderer.invoke("auth:littleskin", data),

  onProgress: (cb: any) => ipcRenderer.on("launcher:progress", (_e, p) => cb(p)),
  onLog: (cb: any) => ipcRenderer.on("launcher:log", (_e, line) => cb(line)),
  onClosed: (cb: any) => ipcRenderer.on("launcher:closed", () => cb()),
  onError: (cb: any) => ipcRenderer.on("launcher:error", (_e, msg) => cb(msg)),
});
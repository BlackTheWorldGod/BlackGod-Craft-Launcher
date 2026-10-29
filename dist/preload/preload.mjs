import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("launcherAPI", {
  start: (options) => ipcRenderer.invoke("launcher:start", options),
  // 🌟 新增：暴露 LittleSkin 认证方法
  authLittleSkin: (data) => ipcRenderer.invoke("auth:littleskin", data),
  onProgress: (cb) => ipcRenderer.on("launcher:progress", (_e, p) => cb(p)),
  onLog: (cb) => ipcRenderer.on("launcher:log", (_e, line) => cb(line)),
  onClosed: (cb) => ipcRenderer.on("launcher:closed", () => cb()),
  onError: (cb) => ipcRenderer.on("launcher:error", (_e, msg) => cb(msg))
});

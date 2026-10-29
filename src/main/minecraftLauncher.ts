// @ts-nocheck
import { BrowserWindow, clipboard } from "electron";
import { Launch, Microsoft } from "mc-java-core-333"; 

export async function launchMinecraft(
  win: BrowserWindow,
  options: { version: string; memory: string; isolation: string; auth: any }
) {
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
        meta: { type: "offline", demo: false },
      };
    } 
    else if (authType === "littleskin") {
      win.webContents.send("launcher:log", "正在连接 LittleSkin 服务器...");
      const response = await fetch("https://littleskin.cn/api/yggdrasil/authserver/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: options.auth.email,
          password: options.auth.password,
          clientToken: "BlackGodLauncher",
        }),
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
        meta: { type: "mojang", demo: false },
      };
    } 
    else {
      throw new Error("未知的登录类型");
    }
  } catch (authError: any) {
    win.webContents.send("launcher:error", `认证失败: ${authError.message || String(authError)}`);
    return;
  }

  // ================= 版本隔离逻辑 =================
  // 默认不隔离（所有版本共用 .minecraft/mods 等）
  let gamePath = "./.minecraft"; 

  if (options.isolation === "all") {
    // 隔离所有版本：每个版本在 versions 下独立文件夹
    gamePath = `./.minecraft/versions/${options.version}`;
    win.webContents.send("launcher:log", `[隔离] 已开启完全隔离，游戏目录: ${gamePath}`);
  } 
  else if (options.isolation === "mods") {
    // 仅隔离模组版本：如果版本名包含 forge, fabric, neoforge 等字眼才隔离
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

  // ================= 下载并启动游戏 =================
  const launcher = new Launch();

  launcher
    .on("progress", (progress: number, size: number) => {
      const percent = size > 0 ? Math.min(Math.round((progress / size) * 100), 100) : 0;
      win.webContents.send("launcher:progress", percent);
    })
    .on("data", (line: any) => {
      const text = String(line);
      if (text.includes("StatusLogger Reconfiguration failed") || text.includes("ERROR StatusLogger")) return;
      win.webContents.send("launcher:log", text);
    })
    .on("close", () => {
      win.webContents.send("launcher:closed");
    });

  try {
    await launcher.Launch({
      path: "./.minecraft", // 固定：游戏核心路径（版本库、依赖库都在这里）
      gamePath: gamePath,   // 🌟 动态：游戏数据路径（Mods、存档、配置在这里）
      authenticator: authenticator,
      version: options.version,
      memory: { min: "2G", max: options.memory },
      detached: true,
    });
    win.webContents.send("launcher:started");
  } catch (err: any) {
    win.webContents.send("launcher:error", String(err));
  }
}
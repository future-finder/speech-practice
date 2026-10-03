const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const { spawn, execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
let backend, connection, win;

async function startBackend() {
  const root =
    process.env.SPEECH_DATA_DIR ||
    path.join(
      process.env.LOCALAPPDATA || app.getPath("userData"),
      "speech-practice",
    );
  const command = app.isPackaged
    ? path.join(process.resourcesPath, "backend", "speech-backend.exe")
    : path.join(app.getAppPath(), ".venv", "Scripts", "python.exe");
  const args = app.isPackaged
    ? []
    : [path.join(app.getAppPath(), "backend", "server.py")];
  backend = spawn(command, args, {
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      SPEECH_DATA_DIR: root,
      SPEECH_UI_DIR: app.isPackaged
        ? path.join(process.resourcesPath, "ui")
        : path.join(app.getAppPath(), "dist"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  backend.stderr.on("data", async (data) => {
    await fs.mkdir(root, { recursive: true });
    await fs.appendFile(path.join(root, "backend.log"), data).catch(() => {});
  });
  connection = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("Backend startup timed out. See backend.log.")),
      45000,
    );
    backend.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    backend.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Backend exited (${code}). See backend.log.`));
    });
    backend.stdout.on("data", (data) => {
      buffer += data;
      const end = buffer.indexOf("\n");
      if (end >= 0) {
        try {
          const value = JSON.parse(buffer.slice(0, end));
          clearTimeout(timer);
          resolve({
            base: `http://127.0.0.1:${value.port}`,
            token: value.token,
          });
        } catch {
          /* only the backend protocol can supply connection information */
        }
      }
    });
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (
        (
          await fetch(connection.base + "/api/health", {
            headers: { Authorization: `Bearer ${connection.token}` },
          })
        ).ok
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Backend failed health check.");
}

function trusted(event) {
  if (
    !win ||
    event.sender !== win.webContents ||
    !event.senderFrame?.url.startsWith(connection.base + "/")
  )
    throw new Error("Untrusted window.");
}
ipcMain.handle("connection", (event) => {
  trusted(event);
  return connection;
});
ipcMain.handle("choose-directory", async (event) => {
  trusted(event);
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("choose-runtime", async (event) => {
  trusted(event);
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Speech Practice component", extensions: ["zip"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("save-audio", async (event, id) => {
  trusted(event);
  if (typeof id !== "string" || !/^[a-f0-9]{32,64}$/.test(id))
    throw new Error("Invalid audio ID.");
  const selected = await dialog.showSaveDialog(win, {
    defaultPath: `speech-${id.slice(0, 10)}.wav`,
    filters: [{ name: "WAV audio", extensions: ["wav"] }],
  });
  if (selected.canceled || !selected.filePath) return false;
  const response = await fetch(
    `${connection.base}/api/assets/${id}?download=true`,
    { headers: { Authorization: `Bearer ${connection.token}` } },
  );
  if (!response.ok) throw new Error("Audio unavailable.");
  // Stream large speech exports to disk rather than buffering them in the desktop process.
  const { Readable } = require("node:stream");
  const { pipeline } = require("node:stream/promises");
  await pipeline(
    Readable.fromWeb(response.body),
    require("node:fs").createWriteStream(selected.filePath),
  );
  return true;
});

app.whenReady().then(async () => {
  try {
    await startBackend();
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        callback(
          contents === win?.webContents &&
            permission === "media" &&
            details.requestingUrl?.startsWith(connection.base + "/") &&
            (!details.mediaTypes ||
              details.mediaTypes.every((type) => type === "audio")),
        );
      },
    );
    session.defaultSession.setPermissionCheckHandler(
      (contents, permission, origin) =>
        contents === win?.webContents &&
        permission === "media" &&
        origin === connection.base,
    );
    win = new BrowserWindow({
      show: process.env.SPEECH_TEST_HIDDEN !== "1",
      width: 1400,
      height: 960,
      minWidth: 1050,
      minHeight: 700,
      backgroundColor: "#f4f1e9",
      title: "Speech Practice",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(connection.base + "/")) event.preventDefault();
    });
    await win.loadURL(connection.base + "/");
  } catch (error) {
    if (process.env.SPEECH_TEST_HIDDEN === "1") console.error(error.message);
    else dialog.showErrorBox("Speech Practice", error.message);
    app.quit();
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (backend?.pid) {
    if (process.platform === "win32")
      execFile(
        "taskkill",
        ["/pid", String(backend.pid), "/T", "/F"],
        { windowsHide: true },
        () => {},
      );
    else backend.kill("SIGTERM");
  }
});

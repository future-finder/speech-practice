const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  connection: () => ipcRenderer.invoke("connection"),
  saveAudio: (id) => ipcRenderer.invoke("save-audio", id),
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  chooseRuntime: () => ipcRenderer.invoke("choose-runtime"),
});

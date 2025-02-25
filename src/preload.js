const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => {
    ipcRenderer.send("minimize-window");
  },
  onDisplayMessage: (callback) => {
    ipcRenderer.on("display-message", (event, message) => callback(message));
  },
  onFocusInput: (callback) => {
    ipcRenderer.on("focus-input", (event) => callback());
  },
  onStreamMessage: (callback) => {
    ipcRenderer.on("stream-message", (event, message) => callback(message));
  },
  onSelectedFilePath: (callback) => {
    ipcRenderer.on("selected-file-path", (event, filePath) => callback(filePath));
  },
  respond: async (userInputText) => {
    const response = await ipcRenderer.invoke("respond", userInputText);
    return response;
  },
  openFilePicker: () => {
    ipcRenderer.invoke("open-file-picker");
  },
  getClipboardText: () => {
    return ipcRenderer.invoke("get-clipboard-text");
  },
  clearHistory: () => {
    ipcRenderer.invoke("clear-history");
  },
});

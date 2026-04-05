const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** Open a native file picker and return selected files as { name, content } objects. */
  openFiles: () => ipcRenderer.invoke('dialog:open-files'),
})

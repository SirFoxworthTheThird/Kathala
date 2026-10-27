const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** Open a native file picker and return selected files as { name, content } objects. */
  openFiles: () => ipcRenderer.invoke('dialog:open-files'),
  /** The AI audit's API key, encrypted by the system keychain in the main process; the page never stores it. */
  anthropicKey: {
    available: () => ipcRenderer.invoke('anthropic-key:available'),
    get: () => ipcRenderer.invoke('anthropic-key:get'),
    set: (value) => ipcRenderer.invoke('anthropic-key:set', value),
    clear: () => ipcRenderer.invoke('anthropic-key:clear'),
  },
})

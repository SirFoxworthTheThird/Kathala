const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /** Open a native file picker and return selected files as { name, content } objects. */
  openFiles: () => ipcRenderer.invoke('dialog:open-files'),
  /** The AI audit's API keys, one per provider, encrypted by the system keychain in the main process; the page never stores them. */
  aiKeys: {
    available: () => ipcRenderer.invoke('ai-key:available'),
    get: (provider) => ipcRenderer.invoke('ai-key:get', provider),
    set: (provider, value) => ipcRenderer.invoke('ai-key:set', provider, value),
    clear: (provider) => ipcRenderer.invoke('ai-key:clear', provider),
  },
})

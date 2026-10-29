const { contextBridge, ipcRenderer } = require('electron');

// StoreKit lives in the main process; the page reaches it over IPC.
contextBridge.exposeInMainWorld('store', {
  products: () => ipcRenderer.invoke('products'),
  purchase: (productId) => ipcRenderer.invoke('purchase', productId),
  restore: () => ipcRenderer.invoke('restore'),
});

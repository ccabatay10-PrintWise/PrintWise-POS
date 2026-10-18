const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("printwiseDesktop", {
  isElectron: true,
  openCustomerDisplay: () => ipcRenderer.invoke("printwise:open-customer-display"),
  closeCustomerDisplay: () => ipcRenderer.invoke("printwise:close-customer-display"),
  openCashDrawer: () => ipcRenderer.invoke("printwise:open-cash-drawer"),
});

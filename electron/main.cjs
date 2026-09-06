const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

const POS_URL = process.env.PRINTWISE_URL || "http://localhost:3000";
const CUSTOMER_DISPLAY_PATH = "/customer-display";

let mainWindow = null;
let customerDisplayWindow = null;

function getExternalDisplay() {
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  return displays.find((display) => display.id !== primary.id) || null;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.close();
    }
  });

  mainWindow.loadURL(POS_URL);
}

function openCustomerDisplay() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const externalDisplay = getExternalDisplay();
  if (!externalDisplay) return;

  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    positionCustomerDisplay(externalDisplay);
    customerDisplayWindow.show();
    customerDisplayWindow.focus();
    return;
  }

  const { x, y } = externalDisplay.bounds;
  const { width, height } = externalDisplay.workAreaSize;

  customerDisplayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  customerDisplayWindow.once("ready-to-show", () => {
    customerDisplayWindow.show();
    customerDisplayWindow.focus();
  });

  customerDisplayWindow.on("closed", () => {
    customerDisplayWindow = null;
  });

  customerDisplayWindow.loadURL(new URL(CUSTOMER_DISPLAY_PATH, POS_URL).toString());
}

function positionCustomerDisplay(display) {
  if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) return;
  const { x, y } = display.bounds;
  const { width, height } = display.workAreaSize;
  customerDisplayWindow.setBounds({ x, y, width, height });
  customerDisplayWindow.setFullScreen(true);
  customerDisplayWindow.setKiosk(true);
}

function handleDisplayTopologyChange() {
  if (getExternalDisplay()) {
    openCustomerDisplay();
  } else if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.close();
    customerDisplayWindow = null;
  }
}

app.whenReady().then(() => {
  ipcMain.handle("printwise:open-customer-display", () => {
    openCustomerDisplay();
    return true;
  });

  ipcMain.handle("printwise:close-customer-display", () => {
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.close();
      customerDisplayWindow = null;
    }
    return true;
  });

  createMainWindow();

  // Automatically create the Customer Display as soon as Windows reports
  // that an extended/secondary monitor is available.
  setTimeout(handleDisplayTopologyChange, 1000);
  screen.on("display-added", handleDisplayTopologyChange);
  screen.on("display-removed", handleDisplayTopologyChange);
  screen.on("display-metrics-changed", handleDisplayTopologyChange);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    handleDisplayTopologyChange();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

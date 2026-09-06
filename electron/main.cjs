const { app, BrowserWindow, screen, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

const CONFIGURED_URL = process.env.PRINTWISE_URL || "";
const LOCAL_PORT = 3210;
let POS_URL = CONFIGURED_URL || `http://127.0.0.1:${LOCAL_PORT}`;

let mainWindow = null;
let customerDisplayWindow = null;
let nextServerProcess = null;

function getExternalDisplay() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().find((display) => display.id !== primary.id) || null;
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`PrintWise server did not start within ${timeoutMs}ms.`);
}

async function startBundledNextServer() {
  if (CONFIGURED_URL || !app.isPackaged) return;

  const appRoot = app.getAppPath();
  const standaloneRoot = path.join(appRoot, ".next", "standalone");
  const serverPath = path.join(standaloneRoot, "server.js");

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneRoot,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ELECTRON_NO_ASAR: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(LOCAL_PORT),
    },
    stdio: "ignore",
  });

  nextServerProcess.on("exit", () => {
    nextServerProcess = null;
  });

  await waitForServer(POS_URL);
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

function positionCustomerDisplay(display) {
  if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) return;
  const { x, y } = display.bounds;
  const { width, height } = display.workAreaSize;
  customerDisplayWindow.setBounds({ x, y, width, height });
  customerDisplayWindow.setFullScreen(true);
  customerDisplayWindow.setKiosk(true);
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
    show: false,
    frame: false,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
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

  customerDisplayWindow.loadURL(new URL("/customer-display", POS_URL).toString());
}

function handleDisplayTopologyChange() {
  if (getExternalDisplay()) {
    openCustomerDisplay();
  } else if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.close();
    customerDisplayWindow = null;
  }
}

app.whenReady().then(async () => {
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

  try {
    await startBundledNextServer();
    createMainWindow();

    setTimeout(handleDisplayTopologyChange, 1000);
    screen.on("display-added", handleDisplayTopologyChange);
    screen.on("display-removed", handleDisplayTopologyChange);
    screen.on("display-metrics-changed", handleDisplayTopologyChange);
  } catch (error) {
    console.error("PrintWise startup failed:", error);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    handleDisplayTopologyChange();
  });
});

app.on("before-quit", () => {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

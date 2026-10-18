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

  ipcMain.handle("printwise:open-cash-drawer", async () => {
    if (process.platform !== "win32") {
      throw new Error("Automatic cash drawer opening is currently supported only on Windows.");
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$printer = Get-Printer | Where-Object { $_.Name -match 'GLPrinter80|R80A' } | Select-Object -First 1
if (-not $printer) { throw 'Cannot find a Windows printer named GLPrinter80 or R80A.' }
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class RawDrawerPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOC_INFO_1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOC_INFO_1 docInfo);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@
$handle = [IntPtr]::Zero
if (-not [RawDrawerPrinter]::OpenPrinter($printer.Name, [ref]$handle, [IntPtr]::Zero)) { throw 'Unable to open receipt printer queue.' }
try {
  $doc = New-Object RawDrawerPrinter+DOC_INFO_1
  $doc.pDocName = 'WISE POS Cash Drawer'
  $doc.pDataType = 'RAW'
  $job = [RawDrawerPrinter]::StartDocPrinter($handle, 1, $doc)
  if ($job -eq 0) { throw 'Unable to start cash drawer command job.' }
  try {
    if (-not [RawDrawerPrinter]::StartPagePrinter($handle)) { throw 'Unable to start printer page.' }
    try {
      $bytes = [byte[]](0x1B,0x70,0x00,0x19,0xFA)
      $written = 0
      if (-not [RawDrawerPrinter]::WritePrinter($handle, $bytes, $bytes.Length, [ref]$written) -or $written -ne $bytes.Length) { throw 'Cash drawer command was not fully sent.' }
    } finally { [void][RawDrawerPrinter]::EndPagePrinter($handle) }
  } finally { [void][RawDrawerPrinter]::EndDocPrinter($handle) }
} finally { [void][RawDrawerPrinter]::ClosePrinter($handle) }
Write-Output ('Cash drawer command sent to ' + $printer.Name)
`;
    const { stdout } = await new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => { out += chunk.toString(); });
      child.stderr.on("data", (chunk) => { err += chunk.toString(); });
      child.once("error", reject);
      child.once("close", (code) => code === 0 ? resolve({ stdout: out }) : reject(new Error((err || out || "Cash drawer command failed").trim())));
    });
    return { ok: true, message: String(stdout || "").trim() };
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

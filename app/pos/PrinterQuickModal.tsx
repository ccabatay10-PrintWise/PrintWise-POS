"use client";

import { useEffect, useState } from "react";
import { Bluetooth, Cable, CheckCircle2, Info, Loader2, Printer, X } from "lucide-react";

const USB_VENDOR_FILTERS: USBDeviceFilter[] = [];

export default function PrinterQuickModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"bluetooth" | "usb">("usb");
  const [device, setDevice] = useState<any>(null);
  const [status, setStatus] = useState("Not Connected");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".wise-quick-action") as HTMLElement | null;
      if (!button) return;
      const label = button.querySelector("span")?.textContent?.trim().toLowerCase();
      if (label !== "printer") return;
      event.preventDefault();
      event.stopPropagation();
      setMessage("");
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const scanUsb = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!("usb" in navigator)) throw new Error("Web USB is not supported by this browser. Use Chrome or Edge over HTTPS.");
      const usb = (navigator as any).usb;
      const selected = await usb.requestDevice({ filters: USB_VENDOR_FILTERS, acceptAllDevices: true });
      await selected.open();
      if (selected.configuration == null) await selected.selectConfiguration(1);
      setDevice(selected);
      setStatus("Connected");
      setMessage(`${selected.productName || "USB thermal printer"} is ready.`);
    } catch (error: any) {
      if (error?.name === "NotFoundError") setMessage("No printer was selected.");
      else setMessage(error?.message || "Unable to connect to the USB printer.");
      setStatus("Not Connected");
    } finally {
      setBusy(false);
    }
  };

  const scanBluetooth = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!("bluetooth" in navigator)) throw new Error("Bluetooth printing is not supported by this browser. Use Chrome or Edge with Bluetooth enabled.");
      const bluetooth = (navigator as any).bluetooth;
      const selected = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb"] });
      setDevice(selected);
      setStatus("Connected");
      setMessage(`${selected.name || "Bluetooth printer"} selected.`);
    } catch (error: any) {
      if (error?.name === "NotFoundError") setMessage("No printer was selected.");
      else setMessage(error?.message || "Unable to connect to the Bluetooth printer.");
      setStatus("Not Connected");
    } finally {
      setBusy(false);
    }
  };

  const scan = () => mode === "usb" ? scanUsb() : scanBluetooth();

  const testPrint = async () => {
    if (!device) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "usb") {
        const interfaces = device.configuration?.interfaces ?? [];
        let target: { interfaceNumber: number; endpointNumber: number } | null = null;
        for (const iface of interfaces) {
          for (const alternate of iface.alternates ?? []) {
            const endpoint = (alternate.endpoints ?? []).find((item: any) => item.direction === "out");
            if (endpoint) { target = { interfaceNumber: iface.interfaceNumber, endpointNumber: endpoint.endpointNumber }; break; }
          }
          if (target) break;
        }
        if (!target) throw new Error("No writable USB printer endpoint was found.");
        await device.claimInterface(target.interfaceNumber);
        const encoder = new TextEncoder();
        const data = new Uint8Array([...encoder.encode("WISE POS\n"), ...encoder.encode("Printer Test Print\n\n"), 0x1d, 0x56, 0x00]);
        await device.transferOut(target.endpointNumber, data);
        setMessage("Test print sent successfully.");
      } else {
        if (!device.gatt) throw new Error("This Bluetooth printer does not expose a browser GATT connection.");
        const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
        const services = [];
        for (const uuid of ["0000ffe0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb"]) {
          try { services.push(await server.getPrimaryService(uuid)); } catch {}
        }
        for (const service of services) {
          const characteristics = await service.getCharacteristics();
          const writable = characteristics.find((characteristic: any) => characteristic.properties?.write || characteristic.properties?.writeWithoutResponse);
          if (writable) {
            const data = new TextEncoder().encode("WISE POS\nPrinter Test Print\n\n");
            await writable.writeValue(data);
            setMessage("Test print sent successfully.");
            return;
          }
        }
        throw new Error("No writable Bluetooth printer characteristic was found. Check the printer's Bluetooth profile.");
      }
    } catch (error: any) {
      setMessage(error?.message || "Unable to send the test print.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="wise-printer-backdrop" role="dialog" aria-modal="true" aria-labelledby="wise-printer-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="wise-printer-modal">
        <header className="wise-printer-head">
          <div className="wise-printer-title-row"><Printer size={25} strokeWidth={2.2} /><h2 id="wise-printer-title">Printer Settings</h2></div>
          <button className="wise-printer-close" onClick={() => setOpen(false)} aria-label="Close"><X size={21} /></button>
          <p>Connect your thermal printer via USB or Bluetooth to print receipts</p>
        </header>

        <div className="wise-printer-tabs" role="tablist">
          <button className={mode === "bluetooth" ? "active" : ""} onClick={() => { setMode("bluetooth"); setMessage(""); }}><Bluetooth size={18} /> Bluetooth</button>
          <button className={mode === "usb" ? "active" : ""} onClick={() => { setMode("usb"); setMessage(""); }}><Cable size={18} /> Wired (USB)</button>
        </div>

        <section className="wise-printer-status-card">
          <div className="wise-printer-status-label">Status</div>
          <div className={status === "Connected" ? "wise-printer-status connected" : "wise-printer-status"}>
            {status === "Connected" ? <CheckCircle2 size={15} /> : <span className="wise-printer-status-dot" />}
            {status}
          </div>
          {status !== "Connected" ? (
            <p>No authorized {mode === "usb" ? "USB" : "Bluetooth"} printers yet. Connect your printer, click Scan Printer, then choose it in the browser prompt. <a href="https://developer.chrome.com/docs/capabilities/usb" target="_blank" rel="noreferrer">Watch Tutorial</a></p>
          ) : <p className="wise-printer-ready">Your printer is connected and ready for a test print.</p>}
        </section>

        <div className="wise-printer-guide"><Info size={16} /> Getting an <em>Access Denied</em> error? <a href="https://developer.chrome.com/docs/capabilities/usb" target="_blank" rel="noreferrer">Check this guide</a></div>
        {message && <div className="wise-printer-message">{message}</div>}

        <button className="wise-printer-scan" onClick={scan} disabled={busy}>{busy ? <Loader2 size={18} className="wise-spin" /> : <Printer size={18} />}{busy ? "Connecting..." : "Scan Printer"}</button>
        <button className="wise-printer-test" onClick={testPrint} disabled={busy || !device}>{busy ? "Working..." : "Test Print"}</button>
      </div>
    </div>
  );
}

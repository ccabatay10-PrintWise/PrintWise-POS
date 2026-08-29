"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

const ACTIVE_JOB_KEY = "printwise_active_received_file_job";
const ORDER: Record<string, number> = { RECEIVED: 1, REVIEWING: 2, PROCESSING: 3, READY: 4, READY_FOR_PICKUP: 4, COMPLETED: 5 };

type Trigger = "VALIDATING" | "PROCESSING" | "READY";

async function notify(jobId: string, trigger: Trigger) {
  try { await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, trigger, automatic: true }) }); } catch {}
}

async function moveJobForward(jobId: string, nextStatus: "REVIEWING" | "PROCESSING" | "READY", trigger: Trigger) {
  const { data: current, error: readError } = await supabase.from("received_file_jobs").select("status").eq("id", jobId).single();
  if (readError || !current) return;
  const currentStatus = String(current.status || "RECEIVED").toUpperCase();
  if ((ORDER[currentStatus] || 0) >= ORDER[nextStatus]) return;
  const { error: updateError } = await supabase.from("received_file_jobs").update({ status: nextStatus }).eq("id", jobId);
  if (updateError) return;
  window.dispatchEvent(new CustomEvent("printwise-job-status", { detail: { jobId, status: nextStatus } }));
  await notify(jobId, trigger);
}

function injectSmartPricingButtons() {
  const match = window.location.pathname.match(/^\/received-files\/([^/]+)$/);
  if (!match) return;
  const jobId = match[1];
  document.querySelectorAll<HTMLElement>(".file-actions").forEach((actions, index) => {
    if (actions.querySelector("[data-smart-pricing-button]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.smartPricingButton = "true";
    button.className = "smart-pricing-action";
    button.innerHTML = '<span aria-hidden="true">🧠</span> Smart Pricing';
    button.title = "Analyze this document and compute a suggested price";
    button.addEventListener("click", () => {
      const url = `/smart-pricing?jobId=${encodeURIComponent(jobId)}&fileIndex=${index}`;
      window.open(url, "PrintWiseSmartPricing", "popup=yes,width=1100,height=820,resizable=yes,scrollbars=yes");
    });
    actions.appendChild(button);
  });
}

export default function ReceivedFileNotificationBridge() {
  useEffect(() => {
    const observer = new MutationObserver(() => injectSmartPricingButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    injectSmartPricingButtons();

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
      const path = window.location.pathname;
      const detailMatch = path.match(/^\/received-files\/([^/]+)$/);
      if (detailMatch) {
        const jobId = detailMatch[1];
        if (label === "OPEN" || label === "DOWNLOAD") { void moveJobForward(jobId, "REVIEWING", "VALIDATING"); return; }
        if (label === "PRINT DIRECTLY") { void moveJobForward(jobId, "PROCESSING", "PROCESSING"); return; }
        if (label.includes("ADD JOB TO POS")) sessionStorage.setItem(ACTIVE_JOB_KEY, jobId);
      }
      if (path === "/pos" && label === "DONE") {
        const jobId = sessionStorage.getItem(ACTIVE_JOB_KEY);
        if (!jobId) return;
        void moveJobForward(jobId, "READY", "READY").finally(() => sessionStorage.removeItem(ACTIVE_JOB_KEY));
      }
    };

    document.addEventListener("click", onClick, true);
    return () => { observer.disconnect(); document.removeEventListener("click", onClick, true); };
  }, []);

  return <style jsx global>{`.file-actions .smart-pricing-action{background:#1f2937!important;color:#fff!important;border-color:#1f2937!important}.file-actions .smart-pricing-action:hover{filter:brightness(1.08)}.file-actions .smart-pricing-action span{font-size:16px;line-height:1}`}</style>;
}

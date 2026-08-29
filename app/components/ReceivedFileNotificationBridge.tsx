"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

const ACTIVE_JOB_KEY = "printwise_active_received_file_job";
const ORDER: Record<string, number> = { RECEIVED: 1, REVIEWING: 2, PROCESSING: 3, READY: 4, READY_FOR_PICKUP: 4, COMPLETED: 5 };

type Trigger = "VALIDATING" | "PROCESSING" | "READY";

async function notify(jobId: string, trigger: Trigger) {
  try {
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, trigger, automatic: true }),
    });
  } catch {
    // A temporary email problem must never block the staff workflow.
  }
}

async function moveJobForward(jobId: string, nextStatus: "REVIEWING" | "PROCESSING" | "READY", trigger: Trigger) {
  const { data: current, error: readError } = await supabase
    .from("received_file_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (readError || !current) return;

  const currentStatus = String(current.status || "RECEIVED").toUpperCase();
  const currentOrder = ORDER[currentStatus] || 0;
  const nextOrder = ORDER[nextStatus];

  // Never move a job backward. Repeated clicks also do not create a new status transition.
  if (currentOrder >= nextOrder) return;

  const { error: updateError } = await supabase
    .from("received_file_jobs")
    .update({ status: nextStatus })
    .eq("id", jobId);

  if (updateError) return;

  // Tell any open screen about the confirmed transition immediately.
  window.dispatchEvent(new CustomEvent("printwise-job-status", { detail: { jobId, status: nextStatus } }));
  await notify(jobId, trigger);
}

export default function ReceivedFileNotificationBridge() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
      const path = window.location.pathname;
      const detailMatch = path.match(/^\/received-files\/([^/]+)$/);

      if (detailMatch) {
        const jobId = detailMatch[1];

        if (label === "OPEN" || label === "DOWNLOAD") {
          void moveJobForward(jobId, "REVIEWING", "VALIDATING");
          return;
        }

        if (label === "PRINT DIRECTLY") {
          void moveJobForward(jobId, "PROCESSING", "PROCESSING");
          return;
        }

        if (label.includes("ADD JOB TO POS")) {
          sessionStorage.setItem(ACTIVE_JOB_KEY, jobId);
        }
      }

      if (path === "/pos" && label === "DONE") {
        const jobId = sessionStorage.getItem(ACTIVE_JOB_KEY);
        if (!jobId) return;
        void moveJobForward(jobId, "READY", "READY").finally(() => {
          sessionStorage.removeItem(ACTIVE_JOB_KEY);
        });
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

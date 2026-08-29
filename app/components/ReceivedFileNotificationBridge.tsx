"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

const ACTIVE_JOB_KEY = "printwise_active_received_file_job";

async function notify(jobId: string, trigger: "VALIDATING" | "PROCESSING" | "READY") {
  try {
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, trigger, automatic: true }),
    });
  } catch {
    // Staff workflow should continue even if the email provider is temporarily unavailable.
  }
}

async function updateJob(jobId: string, status: string, trigger: "VALIDATING" | "PROCESSING" | "READY") {
  const { error } = await supabase.from("received_file_jobs").update({ status }).eq("id", jobId);
  if (!error) await notify(jobId, trigger);
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
          void updateJob(jobId, "REVIEWING", "VALIDATING");
          return;
        }

        if (label === "PRINT DIRECTLY") {
          void updateJob(jobId, "PROCESSING", "PROCESSING");
          return;
        }

        if (label.includes("ADD JOB TO POS")) {
          sessionStorage.setItem(ACTIVE_JOB_KEY, jobId);
        }
      }

      if (path === "/pos" && label === "DONE") {
        const jobId = sessionStorage.getItem(ACTIVE_JOB_KEY);
        if (!jobId) return;
        void updateJob(jobId, "READY", "READY").then(() => {
          sessionStorage.removeItem(ACTIVE_JOB_KEY);
        });
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

import { useEffect, useState } from "react";
import {
  api,
  isTerminal,
  type VerificationStatusView,
  type VerificationActivityEvent,
  type VerificationReport,
} from "./api.js";

interface RunData {
  status: VerificationStatusView | null;
  events: VerificationActivityEvent[];
  report: VerificationReport | null;
  error: string | null;
  refreshedAt: string | null;
}
const empty: RunData = { status: null, events: [], report: null, error: null, refreshedAt: null };

export function useRun(runId: string | null) {
  const [data, setData] = useState<RunData>(empty);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setData(empty);
    if (!runId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let after = 0;
    const poll = async (): Promise<void> => {
      try {
        const status = await api.status(runId, controller.signal);
        const activity = await api.events(runId, after, controller.signal);
        const report = status.reportId ? await api.report(runId, controller.signal) : null;
        if (controller.signal.aborted) return;
        after = activity.events.at(-1)?.sequence ?? after;
        setData((previous) => ({
          status,
          report,
          events: [...previous.events, ...activity.events],
          error: null,
          refreshedAt: new Date().toISOString(),
        }));
        if (!isTerminal(status))
          timer = setTimeout(() => {
            void poll();
          }, 1500);
      } catch (error) {
        if (controller.signal.aborted) return;
        setData((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : "The local service could not be reached.",
        }));
        timer = setTimeout(() => {
          void poll();
        }, 5000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId, retry]);
  return { ...data, refresh: () => setRetry((value) => value + 1) };
}

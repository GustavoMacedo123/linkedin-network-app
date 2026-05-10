import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Phase = "idle" | "available" | "downloading" | "installing" | "error";

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const u = await check();
        if (!cancelled && u?.available) {
          setUpdate(u);
          setPhase("available");
        }
      } catch {
        // network unavailable, GitHub not reachable, etc. — silently ignore
      }
    };
    tick();
    const id = setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (phase === "idle" || !update) return null;

  const onInstall = async () => {
    try {
      setPhase("downloading");
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall(event => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) setProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === "Finished") {
          setPhase("installing");
        }
      });
      await relaunch();
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
    }
  };

  return (
    <div className="bg-blue-600 text-white text-xs px-3 py-1.5 flex items-center justify-between gap-3">
      <span>
        {phase === "available" && <>Update available: v{update.version}</>}
        {phase === "downloading" && <>Downloading v{update.version}… {progress}%</>}
        {phase === "installing" && <>Installing v{update.version}…</>}
        {phase === "error" && <>Update failed: {errorMsg}</>}
      </span>
      {phase === "available" && (
        <button
          type="button"
          onClick={onInstall}
          className="px-2 py-0.5 bg-white text-blue-700 rounded font-medium hover:bg-blue-50"
        >Install &amp; restart</button>
      )}
    </div>
  );
}

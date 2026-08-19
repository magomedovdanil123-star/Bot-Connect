import { useEffect, useState } from "react";
import { ExternalLink, Loader2, UploadCloud, Youtube } from "lucide-react";

type Props = { projectId: number; projectStatus: string };
type YoutubeStatus = { connected: boolean; channelTitle: string | null };

export function YoutubePublisher({ projectId, projectStatus }: Props) {
  const [status, setStatus] = useState<YoutubeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/youtube/status");
      if (response.ok) setStatus(await response.json() as YoutubeStatus);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  const connect = () => {
    setMessage(null);
    window.open("/api/youtube/connect", "youtube-oauth", "popup,width=620,height=760");
  };

  const upload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/youtube-upload`, { method: "POST" });
      const payload = await response.json() as { videoId?: string; error?: string; privacyStatus?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить видео");
      setMessage(`Загружено в YouTube как ${payload.privacyStatus || "private"}. ID: ${payload.videoId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить видео");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5" data-testid="youtube-publisher">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-500/10 p-2.5 text-red-500"><Youtube size={20} /></div>
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-muted-foreground">Private publishing</p>
            <h2 className="display-font mt-1 text-xl font-bold">YouTube Shorts</h2>
          </div>
        </div>
        {!status?.connected ? (
          <button type="button" onClick={connect} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
            <ExternalLink size={14} /> Подключить YouTube
          </button>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
            {status.channelTitle || "Канал подключён"}
          </span>
        )}
      </div>
      {status?.connected && projectStatus === "completed" && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="button" onClick={upload} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            Загрузить как private
          </button>
          <p className="text-xs text-muted-foreground">Ролик не станет публичным автоматически.</p>
        </div>
      )}
      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </section>
  );
}
import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, UploadCloud, Youtube } from "lucide-react";

type Props = { projectId: number; projectStatus: string };
type YoutubeChannel = { id: number; channelId: string | null; channelTitle: string | null };
type YoutubeStatus = { connected: boolean; channelTitle: string | null };
type YoutubeUploadResult = {
  channelTitle: string | null;
  videoId?: string;
  error?: string;
};

export function YoutubePublisher({ projectId, projectStatus }: Props) {
  const [status, setStatus] = useState<YoutubeStatus | null>(null);
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [statusResponse, channelsResponse] = await Promise.all([
        fetch("/api/youtube/status"),
        fetch("/api/youtube/channels"),
      ]);
      if (statusResponse.ok) setStatus(await statusResponse.json() as YoutubeStatus);
      if (channelsResponse.ok) {
        const payload = await channelsResponse.json() as { channels?: YoutubeChannel[] };
        const nextChannels = payload.channels || [];
        setChannels(nextChannels);
        setSelectedIds((current) => current.filter((id) => nextChannels.some((channel) => channel.id === id)));
      }
    } catch {
      setStatus(null);
      setChannels([]);
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
    if (!selectedIds.length) {
      setMessage("Сначала выберите хотя бы один YouTube-канал.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/youtube-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionIds: selectedIds, privacyStatus: "private" }),
      });
      const payload = await response.json() as { results?: YoutubeUploadResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить видео");
      const results = payload.results || [];
      setMessage(results.map((result) =>
        result.videoId
          ? `✅ ${result.channelTitle || "Канал"}: загружено как private (${result.videoId})`
          : `❌ ${result.channelTitle || "Канал"}: ${result.error || "ошибка загрузки"}`,
      ).join(" • "));
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
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold">Куда выпустить этот ролик?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedIds(channels.map((channel) => channel.id))} className="text-[11px] font-semibold text-primary">
                Выбрать все
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="text-[11px] font-semibold text-muted-foreground">
                Снять все
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {channels.map((channel) => {
              const selected = selectedIds.includes(channel.id);
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedIds((current) => selected
                    ? current.filter((id) => id !== channel.id)
                    : [...current, channel.id])}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs transition-colors ${
                    selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}>
                    {selected && <Check size={13} />}
                  </span>
                  <span className="truncate font-semibold">{channel.channelTitle || `Канал #${channel.id}`}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={upload} disabled={busy || !selectedIds.length} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              Загрузить на выбранные ({selectedIds.length})
            </button>
            <p className="text-xs text-muted-foreground">Публикация будет private. Без выбора каналов загрузка не выполняется.</p>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </section>
  );
}
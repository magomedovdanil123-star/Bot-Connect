import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Instagram,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Youtube,
} from 'lucide-react';

type YoutubeChannel = {
  id: number;
  channelId: string | null;
  channelTitle: string | null;
};

type YoutubeStatus = {
  connected: boolean;
  channelTitle: string | null;
  connectionId: number | null;
};

type InstagramAccount = {
  id: number;
  username: string | null;
  displayName: string | null;
  pageName: string | null;
  updatedAt: string;
};

export default function Channels() {
  const [youtubeStatus, setYoutubeStatus] = useState<YoutubeStatus | null>(null);
  const [youtubeChannels, setYoutubeChannels] = useState<YoutubeChannel[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingInstagramId, setRemovingInstagramId] = useState<number | null>(null);

  const refresh = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [youtubeStatusResponse, youtubeChannelsResponse, instagramResponse] = await Promise.all([
        fetch('/api/youtube/status'),
        fetch('/api/youtube/channels'),
        fetch('/api/instagram/accounts'),
      ]);
      const failures = [youtubeStatusResponse, youtubeChannelsResponse, instagramResponse].filter((response) => !response.ok);
      if (failures.length) throw new Error('Не удалось получить актуальный статус подключений.');
      const [nextYoutubeStatus, nextYoutubeChannels, nextInstagram] = await Promise.all([
        youtubeStatusResponse.json() as Promise<YoutubeStatus>,
        youtubeChannelsResponse.json() as Promise<{ channels?: YoutubeChannel[] }>,
        instagramResponse.json() as Promise<{ accounts?: InstagramAccount[] }>,
      ]);
      setYoutubeStatus(nextYoutubeStatus);
      setYoutubeChannels(nextYoutubeChannels.channels || []);
      setInstagramAccounts(nextInstagram.accounts || []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Не удалось загрузить каналы.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const removeInstagram = async (id: number) => {
    setRemovingInstagramId(id);
    setError(null);
    try {
      const response = await fetch(`/api/instagram/accounts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Не удалось отключить Instagram.');
      }
      await refresh(true);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Не удалось отключить Instagram.');
    } finally {
      setRemovingInstagramId(null);
    }
  };

  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-10 md:py-12">
        <header className="animate-rise-in flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end">
          <div>
            <p className="eyebrow inline-flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Дистрибуция</p>
            <h1 className="display-font mt-4 text-5xl font-bold tracking-[-.065em] md:text-6xl">Каналы фермы</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Подключения и рабочие маршруты для готовых роликов. Telegram остаётся отдельным привычным контуром и не меняется.</p>
          </div>
          <button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40 disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Обновить статус
          </button>
        </header>

        {error && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
        {loading ? <ChannelsLoading /> : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <YoutubeConnectionCard status={youtubeStatus} channels={youtubeChannels} />
            <InstagramConnectionCard accounts={instagramAccounts} onRemove={(id) => void removeInstagram(id)} removingId={removingInstagramId} />
            <TelegramConnectionCard />
            <PublishingNote />
          </div>
        )}
      </div>
    </div>
  );
}

function YoutubeConnectionCard({ status, channels }: { status: YoutubeStatus | null; channels: YoutubeChannel[] }) {
  const connected = Boolean(status?.connected);
  return (
    <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6" data-testid="card-channel-youtube">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-500"><Youtube size={21} /></span>
          <div><p className="eyebrow text-muted-foreground">Видеосеть</p><h2 className="display-font mt-1 text-2xl font-bold tracking-[-.045em]">YouTube Shorts</h2></div>
        </div>
        <StatusDot connected={connected} />
      </div>
      <div className="mt-6 rounded-xl border border-border/70 bg-background/45 p-4">
        <p className="text-xs text-muted-foreground">{connected ? 'Подключённый аккаунт' : 'Аккаунт пока не подключён'}</p>
        <p className="mt-2 text-lg font-bold">{status?.channelTitle || 'Подключите YouTube'}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{connected ? `${channels.length} каналов доступны для выбора при публикации.` : 'OAuth подключение откроется в отдельном окне.'}</p>
      </div>
      {channels.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="eyebrow text-muted-foreground">Доступные каналы</p>
          {channels.map((channel) => <div key={channel.id} className="flex items-center gap-3 rounded-xl border border-border/70 px-3.5 py-3"><span className="h-2 w-2 rounded-full bg-primary" /><span className="truncate text-sm font-semibold">{channel.channelTitle || `Канал #${channel.id}`}</span><span className="ml-auto text-[10px] text-muted-foreground">готов</span></div>)}
        </div>
      )}
      {!connected && <a href="/api/youtube/connect" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><ExternalLink size={14} /> Подключить YouTube</a>}
      {connected && <Link href="/projects" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary">Открыть проекты для публикации <ExternalLink size={13} /></Link>}
    </section>
  );
}

function InstagramConnectionCard({ accounts, onRemove, removingId }: { accounts: InstagramAccount[]; onRemove: (id: number) => void; removingId: number | null }) {
  return (
    <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6" data-testid="card-channel-instagram">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500"><Instagram size={21} /></span>
          <div><p className="eyebrow text-muted-foreground">Социальная сеть</p><h2 className="display-font mt-1 text-2xl font-bold tracking-[-.045em]">Instagram Reels</h2></div>
        </div>
        <StatusDot connected={accounts.length > 0} />
      </div>
      {accounts.length ? (
        <div className="mt-6 space-y-2">
          {accounts.map((account) => <div key={account.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/45 p-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500"><Instagram size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{account.username ? `@${account.username}` : account.displayName || 'Instagram-аккаунт'}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{account.pageName || 'Профессиональный аккаунт'}</span></span><button type="button" onClick={() => onRemove(account.id)} disabled={removingId === account.id} aria-label={`Отключить ${account.username || 'Instagram-аккаунт'}`} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60">{removingId === account.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</button></div>)}
        </div>
      ) : <div className="mt-6 rounded-xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">Подключите профессиональный аккаунт, чтобы подготовить Reels из готовых проектов.</div>}
      <a href="/api/instagram/connect" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><ExternalLink size={14} /> {accounts.length ? 'Добавить Instagram' : 'Подключить Instagram'}</a>
    </section>
  );
}

function TelegramConnectionCard() {
  return (
    <section className="rounded-2xl border border-card-border bg-sidebar p-5 text-sidebar-foreground shadow-[var(--shadow-sm)] md:p-6" data-testid="card-channel-telegram">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Send size={20} /></span><div><p className="eyebrow text-sidebar-foreground/55">Основной рабочий контур</p><h2 className="display-font mt-1 text-2xl font-bold tracking-[-.045em]">Telegram</h2></div></div>
        <CheckCircle2 size={20} className="text-sidebar-primary" />
      </div>
      <p className="mt-6 max-w-md text-sm leading-6 text-sidebar-foreground/65">Сценарии, ручные истории, проверка MP4 и пакетные действия остаются в боте без изменений. Веб-кабинет дополняет его, а не заменяет.</p>
      <p className="mt-5 border-t border-sidebar-border pt-4 text-xs text-sidebar-foreground/45">Telegram не требует повторного подключения в этом кабинете.</p>
    </section>
  );
}

function PublishingNote() {
  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/5 p-5 md:p-6">
      <p className="eyebrow text-accent">Рабочая схема</p>
      <h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Один ролик — несколько маршрутов</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Соберите и проверьте MP4 в проекте, затем выберите канал публикации. Статусы аккаунтов здесь реальные; просмотры и доход появятся после отдельного подключения аналитики.</p>
      <Link href="/projects" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary">Перейти к проектам <ExternalLink size={13} /></Link>
    </section>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-primary' : 'bg-border'}`} />{connected ? 'Подключён' : 'Не подключён'}</span>;
}

function ChannelsLoading() {
  return <div className="mt-8 grid gap-6 lg:grid-cols-2" data-testid="status-channels-loading">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-card-border bg-card p-6"><div className="skeleton-bar h-11 w-11 rounded-xl" /><div className="skeleton-bar mt-7 h-5 w-2/5 rounded" /><div className="skeleton-bar mt-4 h-20 rounded-xl" /></div>)}</div>;
}
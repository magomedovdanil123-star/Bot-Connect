import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ExternalLink, Film, Image, MoonStar, RefreshCw, Sparkles, Video } from 'lucide-react';
import { Link } from 'wouter';

type VisualAsset = {
  id: number;
  zodiacSign: string | null;
  symbol: string | null;
  label: string | null;
  kind: 'image' | 'video';
  provider: string;
  title: string;
  sourceUrl: string;
  creator: string | null;
  license: string;
  licenseUrl: string | null;
  durationSeconds: number | null;
  isActive: boolean;
};

const zodiacOrder = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

export default function Horoscope() {
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/horoscope/visual-library');
      if (!response.ok) throw new Error('Не удалось загрузить библиотеку гороскопов.');
      const payload = await response.json() as { assets?: VisualAsset[] };
      setAssets(payload.assets || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить библиотеку гороскопов.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const zodiacAssets = useMemo(
    () => zodiacOrder.map((key) => assets.find((asset) => asset.zodiacSign === key)).filter((asset): asset is VisualAsset => Boolean(asset)),
    [assets],
  );
  const cosmicPhotos = assets.filter((asset) => !asset.zodiacSign && asset.kind === 'image');
  const cosmicVideos = assets.filter((asset) => !asset.zodiacSign && asset.kind === 'video');

  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
        <header className="dashboard-hero animate-rise-in overflow-hidden rounded-[1.6rem] border border-card-border p-6 shadow-[var(--shadow-sm)] md:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="eyebrow inline-flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Контент / Horoscope</p>
              <h1 className="display-font mt-5 text-5xl font-bold tracking-[-.065em] md:text-7xl">Гороскопы</h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Отдельный рабочий контур для horoscope-роликов. Сценарии автоматически получают знак из текста, космическое фото и лицензированное космическое видео.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void loadAssets(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40 disabled:opacity-60">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Обновить
              </button>
              <Link href="/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-[0_5px_0_hsl(174_58%_20%)] transition-transform hover:-translate-y-0.5">
                <Sparkles size={14} /> Новый horoscope-сценарий
              </Link>
            </div>
          </div>
          <div className="mt-9 grid gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:grid-cols-3">
            <Signal label="Знаки" value={`${zodiacAssets.length}/12 готовы`} />
            <Signal label="Космос" value={`${cosmicPhotos.length} фото · ${cosmicVideos.length} видео`} />
            <Signal label="Режим" value="Stock без AI-картинок" tone="good" />
          </div>
        </header>

        {error && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
        {loading ? <HoroscopeLoading /> : (
          <>
            <section className="mt-6 rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-primary">Знаки зодиака</p>
                  <h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Визуалы для сценариев</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Каждая карточка соответствует отдельному stock-визуалу с названием и символом знака. При нескольких знаках система вставляет их по очереди.</p>
                </div>
                <MoonStar className="hidden text-primary sm:block" size={21} />
              </div>
              {zodiacAssets.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {zodiacAssets.map((asset) => <ZodiacCard key={asset.id} asset={asset} />)}
                </div>
              ) : <EmptyState text="Библиотека знаков пока не загружена." />}
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <StockSummary kind="image" title="Космические фото" assets={cosmicPhotos} icon={Image} note="Чередуются между сценами и роликами по rotation key канала." />
              <StockSummary kind="video" title="Космические видео" assets={cosmicVideos} icon={Video} note="Четыре видео ротируются между каналами и не используются всегда в одном порядке." />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Signal({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' }) {
  return <div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${tone === 'good' ? 'bg-primary' : 'bg-border'}`} /><span className="eyebrow text-muted-foreground">{label}</span><span className="truncate text-foreground/75">{value}</span></div>;
}

function ZodiacCard({ asset }: { asset: VisualAsset }) {
  return <article className="rounded-xl border border-border/70 bg-background/45 p-4 transition-colors hover:border-primary/35">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">{asset.symbol || '✦'}</span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold">{asset.label || asset.zodiacSign}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{asset.provider} · {asset.license}</p>
      </div>
    </div>
    <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">Источник <ExternalLink size={12} /></a>
  </article>;
}

function StockSummary({ kind, title, assets, icon: Icon, note }: { kind: 'image' | 'video'; title: string; assets: VisualAsset[]; icon: typeof Image; note: string }) {
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6">
    <div className="flex items-start justify-between gap-4">
      <div><p className="eyebrow text-accent">Stock library</p><h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">{title}</h2></div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon size={19} /></span>
    </div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
    {assets.length ? <div className="mt-5 space-y-2">{assets.map((asset, index) => <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/45 p-3"><span className="mono-font w-5 text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kind === 'video' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>{kind === 'video' ? <Film size={15} /> : <Image size={15} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{asset.title}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{asset.provider} · {asset.license}{asset.durationSeconds ? ` · ${asset.durationSeconds} сек.` : ''}</span></span><a href={asset.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Открыть источник: ${asset.title}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><ExternalLink size={14} /></a></div>)}</div> : <EmptyState text="Stock-материалы пока не загружены." />}
    <Link href="/new" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary">Перейти к созданию <ArrowRight size={14} /></Link>
  </section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs text-muted-foreground">{text}</div>;
}

function HoroscopeLoading() {
  return <div className="mt-6 grid gap-6 lg:grid-cols-2" data-testid="status-horoscope-loading">{[1, 2].map((item) => <div key={item} className="rounded-2xl border border-card-border bg-card p-6"><div className="skeleton-bar h-4 w-36 rounded" /><div className="skeleton-bar mt-4 h-8 w-2/3 rounded" /><div className="grid gap-3 sm:grid-cols-2"><div className="skeleton-bar mt-6 h-20 rounded-xl" /><div className="skeleton-bar mt-6 h-20 rounded-xl" /></div></div>)}</div>;
}
import { useMemo } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FolderOpen, Gauge, Layers3, Plus, RefreshCw, Send, Sparkles, Youtube } from 'lucide-react';
import { useHealthCheck, useListProjects, type Project } from '@workspace/api-client-react';

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  completed: 'Готов',
  error: 'Нужна проверка',
};

const stageLabels: Record<string, string> = {
  draft: 'Сценарий',
  completed: 'Видео готово',
  error: 'Повторить',
};

export default function Dashboard() {
  const projectsQuery = useListProjects();
  const healthQuery = useHealthCheck();
  const projects = projectsQuery.data ?? [];
  const metrics = useMemo(() => {
    const active = projects.filter((project) => project.status === 'draft').length;
    const completed = projects.filter((project) => project.status === 'completed').length;
    const errors = projects.filter((project) => project.status === 'error').length;
    const minutes = projects.reduce((total, project) => total + project.duration, 0);
    return { active, completed, errors, minutes };
  }, [projects]);

  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
        <header className="dashboard-hero animate-rise-in overflow-hidden rounded-[1.6rem] border border-card-border p-6 shadow-[var(--shadow-sm)] md:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="eyebrow inline-flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Операционный обзор</p>
              <h1 className="display-font mt-5 max-w-3xl text-4xl font-bold leading-[.98] tracking-[-.065em] md:text-7xl">Идеи не должны ждать своей очереди.</h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">Здесь видно, что уже движется по фабрике, где застрял следующий ролик и что готово к отправке в каналы.</p>
            </div>
            <Link href="/new" data-testid="link-dashboard-new-script" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_6px_0_hsl(174_58%_20%)] transition-transform hover:-translate-y-0.5 active:translate-y-[2px]">
              <Plus size={16} /> Запустить производство
            </Link>
          </div>
          <div className="mt-9 grid gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:grid-cols-3">
            <Signal label="Сегодня" value={`${projects.length} проектов в библиотеке`} />
            <Signal label="Ритм" value={`${metrics.minutes} секунд сценарного хронометража`} />
            <Signal label="Состояние" value={healthQuery.isError ? 'Сервис требует внимания' : healthQuery.isLoading ? 'Проверяем сервис' : 'Сервис отвечает'} tone={healthQuery.isError ? 'warn' : 'good'} />
          </div>
        </header>

        {projectsQuery.isLoading && <DashboardLoading />}
        {projectsQuery.isError && <DashboardError onRetry={() => projectsQuery.refetch()} />}
        {!projectsQuery.isLoading && !projectsQuery.isError && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ключевые показатели">
              <MetricCard label="В производстве" value={metrics.active} detail="сценарии ждут сборки" icon={Layers3} accent="teal" />
              <MetricCard label="Готово к работе" value={metrics.completed} detail="проектов с финальным статусом" icon={CheckCircle2} accent="coral" />
              <MetricCard label="Всего проектов" value={projects.length} detail="в текущей библиотеке" icon={FolderOpen} accent="blue" />
              <MetricCard label="Точки внимания" value={metrics.errors} detail={metrics.errors ? 'проектов с ошибкой' : 'ошибок не обнаружено'} icon={Gauge} accent={metrics.errors ? 'warn' : 'teal'} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
              <ProductionBoard projects={projects} />
              <ReadinessBoard projects={projects} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Throughput projects={projects} />
              <DistributionBoard />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Signal({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  return <div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${tone === 'good' ? 'bg-primary' : tone === 'warn' ? 'bg-accent' : 'bg-border'}`} /><span className="eyebrow text-muted-foreground">{label}</span><span className="truncate text-foreground/75">{value}</span></div>;
}

function MetricCard({ label, value, detail, icon: Icon, accent }: { label: string; value: number; detail: string; icon: typeof Gauge; accent: 'teal' | 'coral' | 'blue' | 'warn' }) {
  const colors = { teal: 'bg-primary/10 text-primary', coral: 'bg-accent/12 text-accent', blue: 'bg-slate-500/10 text-slate-600', warn: 'bg-destructive/10 text-destructive' };
  return <article className="animate-rise-in rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
    <div className="flex items-start justify-between"><p className="eyebrow text-muted-foreground">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[accent]}`}><Icon size={17} /></span></div>
    <div className="mt-7 flex items-end justify-between gap-3"><p className="display-font text-4xl font-bold tracking-[-.06em]" data-testid={`text-metric-${label}`}>{value}</p><p className="max-w-[130px] text-right text-xs leading-4 text-muted-foreground">{detail}</p></div>
  </article>;
}

function ProductionBoard({ projects }: { projects: Project[] }) {
  const recent = [...projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-primary">Производственная лента</p><h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Что сейчас на столе</h2></div><Link href="/projects" data-testid="link-dashboard-projects" className="group inline-flex items-center gap-1.5 text-xs font-bold text-primary">Все проекты <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></Link></div>
    {recent.length === 0 ? <EmptyBlock /> : <div className="mt-6 divide-y divide-border/70">{recent.map((project, index) => <ProductionRow key={project.id} project={project} index={index} />)}</div>}
  </section>;
}

function ProductionRow({ project, index }: { project: Project; index: number }) {
  return <Link href={`/projects/${project.id}`} data-testid={`row-dashboard-project-${project.id}`} className="group flex items-center gap-3 py-4 first:pt-0 last:pb-0">
    <span className="mono-font w-7 text-xs text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
    <span className={`h-2 w-2 rounded-full ${project.status === 'error' ? 'bg-destructive' : project.status === 'completed' ? 'bg-primary' : 'bg-accent'}`} />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold transition-colors group-hover:text-primary">{project.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{project.format} · {project.duration} сек. · {stageLabels[project.status] ?? 'В очереди'}</span></span>
    <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-semibold sm:block ${project.status === 'error' ? 'bg-destructive/10 text-destructive' : project.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{statusLabels[project.status] ?? project.status}</span>
    <ArrowRight size={15} className="text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
  </Link>;
}

function ReadinessBoard({ projects }: { projects: Project[] }) {
  const hasReady = projects.some((project) => project.status === 'completed');
  const items = [
    { label: 'YouTube Shorts', note: hasReady ? 'Можно подготовить публикацию' : 'Ждёт готового видео', icon: Youtube, tone: hasReady ? 'ready' : 'idle' },
    { label: 'Telegram', note: hasReady ? 'Можно отправить MP4 вручную' : 'Ждёт готового видео', icon: Send, tone: 'idle' },
    { label: 'Instagram', note: hasReady ? 'Проверьте ролик перед экспортом' : 'Подготовка после рендера', icon: Sparkles, tone: 'idle' },
  ];
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6">
    <p className="eyebrow text-accent">Распределение</p><h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Готовность каналов</h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Это рабочая подсказка по материалам — не отчёт о публикациях и не статус подключений.</p>
    <div className="mt-6 space-y-3">{items.map(({ label, note, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/45 p-3.5"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone === 'ready' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{note}</span></span><span className={`h-2 w-2 rounded-full ${tone === 'ready' ? 'bg-primary' : 'bg-border'}`} /></div>)}</div>
    <Link href="/channels" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary">Управлять каналами <ArrowRight size={14} /></Link>
  </section>;
}

function Throughput({ projects }: { projects: Project[] }) {
  const counts = [0, 0, 0, 0, 0, 0, 0].map((_, index) => projects.filter((project) => new Date(project.created_at).getDay() === (index + 1) % 7).length);
  const max = Math.max(...counts, 1);
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow text-primary">Ритм фабрики</p><h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Поток идей</h2></div><Clock3 size={18} className="text-muted-foreground" /></div><div className="mt-7 flex h-28 items-end gap-2">{counts.map((count, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-primary/15" style={{ height: `${Math.max(12, (count / max) * 100)}%` }}><div className="signal-line h-full w-full rounded-t-md opacity-80" /></div><span className="mono-font text-[9px] text-muted-foreground">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index]}</span></div>)}</div><p className="mt-5 border-t border-border/70 pt-4 text-xs text-muted-foreground">График построен по дате создания проектов. Публикации и просмотры здесь не считаются.</p></section>;
}

function DistributionBoard() {
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-6"><p className="eyebrow text-accent">Следующий шаг</p><h2 className="display-font mt-2 text-2xl font-bold tracking-[-.045em]">Маршрут готового ролика</h2><div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center"><RouteNode number="01" label="Сценарий" /><ArrowRight className="hidden text-muted-foreground sm:block" size={16} /><RouteNode number="02" label="Сборка" /><ArrowRight className="hidden text-muted-foreground sm:block" size={16} /><RouteNode number="03" label="Каналы" /></div><p className="mt-6 rounded-xl bg-secondary/60 p-3.5 text-xs leading-5 text-secondary-foreground">Сначала соберите видео в проекте. После этого можно использовать реальные действия публикации и отправки, доступные в карточке проекта.</p></section>;
}

function RouteNode({ number, label }: { number: string; label: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/45 p-3"><span className="mono-font text-[10px] text-accent">{number}</span><span className="text-xs font-semibold">{label}</span></div>;
}

function EmptyBlock() {
  return <div className="mt-6 flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center"><FolderOpen size={22} className="text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Лента пока пуста</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Создайте первый сценарий — он появится здесь сразу после генерации.</p><Link href="/new" data-testid="link-empty-dashboard-new" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary"><Plus size={14} /> Новый сценарий</Link></div>;
}

function DashboardLoading() {
  return <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="status-dashboard-loading">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-card-border bg-card p-5"><div className="skeleton-bar h-3 w-28 rounded" /><div className="skeleton-bar mt-7 h-10 w-14 rounded" /><div className="skeleton-bar mt-3 h-3 w-32 rounded" /></div>)}<div className="skeleton-bar h-80 rounded-2xl sm:col-span-2 xl:col-span-3" /><div className="skeleton-bar h-80 rounded-2xl" /></div>;
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 text-center" data-testid="status-dashboard-error"><AlertCircle size={25} className="text-destructive" /><h2 className="display-font mt-4 text-2xl font-bold">Обзор не загрузился</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Не удалось получить проекты. Данные не подменяем — попробуйте обновить запрос.</p><button type="button" onClick={onRetry} data-testid="button-retry-dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><RefreshCw size={14} /> Повторить</button></div>;
}
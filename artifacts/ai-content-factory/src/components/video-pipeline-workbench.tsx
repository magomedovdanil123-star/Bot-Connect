import { useEffect } from "react";
import { AlertCircle, Check, Clapperboard, Download, LoaderCircle, Play, RotateCw } from "lucide-react";
import {
  useGenerateProjectVideo,
  getGetProjectVideoGenerationQueryKey,
  useGetProjectVideoGeneration,
  useRetryVideoGeneration,
  type Project,
  type VideoGenerationJob,
} from "@workspace/api-client-react";

const stages = [
  ["script", "Сценарий"],
  ["images", "Изображения"],
  ["voice", "Озвучка"],
  ["music", "Музыка"],
  ["sfx", "Звуковые эффекты"],
  ["rendering", "Монтаж и MP4"],
] as const;

export function VideoPipelineWorkbench({ project, autoStart = false, onStarted }: {
  project: Project;
  autoStart?: boolean;
  onStarted?: (job: VideoGenerationJob) => void;
}) {
  const pipeline = useGetProjectVideoGeneration(project.id, {
    query: {
      queryKey: getGetProjectVideoGenerationQueryKey(project.id),
      retry: false,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "processing" || status === "pending" ? 1500 : false;
      },
    },
  });
  const generate = useGenerateProjectVideo();
  const retry = useRetryVideoGeneration();
  const job = pipeline.data;

  const start = () => {
    generate.mutate({
      id: project.id,
      data: { format: "9:16", duration: project.duration as 30 | 60 | 90 | 120 | 180, style: project.style, tone: project.tone },
    }, { onSuccess: (created) => onStarted?.(created) });
  };

  useEffect(() => {
    if (autoStart && project.status === "completed" && !job && !generate.isPending && !pipeline.isLoading) start();
    // autoStart is intentionally only acted on once by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, job, pipeline.isLoading]);

  const active = generate.isPending || retry.isPending || job?.status === "processing" || job?.status === "pending";
  return (
    <section id="video-pipeline" className="mt-8 overflow-hidden rounded-2xl border border-card-border bg-card shadow-[var(--shadow-md)]" data-testid="panel-video-pipeline">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-secondary/40 px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Clapperboard size={17} /></span>
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.17em] text-primary">One-click production</p>
            <h2 className="display-font mt-0.5 text-xl font-bold">Create video / Создать видео</h2>
          </div>
        </div>
        {project.status === "completed" && !active && (!job || job.status === "failed") && (
          <button type="button" onClick={job?.status === "failed" ? () => retry.mutate({ id: job.id }) : start} disabled={generate.isPending || retry.isPending} data-testid="button-create-video" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60">
            {job?.status === "failed" ? <RotateCw size={14} /> : <Clapperboard size={14} />}
            {job?.status === "failed" ? "Повторить сборку" : "Создать видео"}
          </button>
        )}
      </div>
      <div className="p-5 md:p-7">
        {(pipeline.isLoading || active) && !job && <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={16} className="animate-spin text-primary" /> Preparing the production pipeline…</div>}
        {job && <PipelineStatus job={job} />}
        {generate.isError && <ErrorMessage text="Не удалось запустить полный pipeline. Проверьте настройки provider." />}
        {retry.isError && <ErrorMessage text="Не удалось повторить pipeline." />}
         {project.status === "draft" && <p className="text-sm text-muted-foreground">Сначала отредактируйте и утвердите сценарий выше. После утверждения здесь появится запуск озвучки, изображений, музыки и монтажа.</p>}
         {project.status === "completed" && pipeline.isError && !job && <p className="text-sm text-muted-foreground">Готового video pipeline ещё нет. Нажмите «Создать видео», чтобы запустить все стадии автоматически.</p>}
      </div>
    </section>
  );
}

function PipelineStatus({ job }: { job: VideoGenerationJob }) {
  const stagesMap = job.stages as Record<string, { status?: string }>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Создание видео</p>
          <p className="mt-1 text-sm font-semibold">{job.status === "completed" ? "✅ ВИДЕО ГОТОВО" : job.status === "failed" ? "Pipeline остановлен" : `Стадия: ${stageLabel(job.current_stage)}`}</p>
        </div>
        <span className="mono-font rounded-full bg-primary/10 px-3 py-1.5 text-[10px] uppercase tracking-[.12em] text-primary">{job.progress}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${job.progress}%` }} /></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([key, label]) => {
          const state = stagesMap[key]?.status;
          const done = state === "completed";
          const processing = state === "processing" || job.current_stage === key && job.status === "processing";
          return <div key={key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : processing ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>{done ? <Check size={12} /> : processing ? <LoaderCircle size={12} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span>{label}</span></div>;
        })}
      </div>
      {job.status === "failed" && <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{job.error || "Pipeline failed"}</span></div>}
       {job.status === "completed" && job.video_url && <div className="mt-6 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">Видео готово к просмотру</p><p className="mt-1 text-xs text-muted-foreground">Вертикальный MP4 с voice, music и SFX — без субтитров.</p></div><div className="flex gap-2"><a href={job.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Play size={13} /> Смотреть</a><a href={job.video_url} download className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold"><Download size={13} /> Скачать MP4</a></div></div><video controls className="mt-4 max-h-[520px] w-full rounded-lg bg-black" src={job.video_url} /></div>}
    </div>
  );
}

function stageLabel(stage: string) {
  return stages.find(([key]) => key === stage)?.[1] || stage;
}

function ErrorMessage({ text }: { text: string }) {
  return <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"><AlertCircle size={15} className="mt-0.5 shrink-0" />{text}</div>;
}
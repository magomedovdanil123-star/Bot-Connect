import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AudioWaveform, CheckCircle2, Clock3, Download, Layers3, LoaderCircle, Radio, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import {
  getGetProjectSoundDesignQueryKey,
  getListProjectMusicQueryKey,
  getListProjectVoiceQueryKey,
  type Project,
  type ProjectSoundEffect,
  useDeleteProjectSoundDesign,
  useGenerateSoundDesign,
  useGetProjectSoundDesign,
  useListProjectVoice,
  useMixProjectSoundDesign,
} from '@workspace/api-client-react';

export function SoundDesignWorkbench({ project }: { project: Project }) {
  const projectId = project.id;
  const queryClient = useQueryClient();
  const key = getGetProjectSoundDesignQueryKey(projectId);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const voiceQuery = useListProjectVoice(projectId, { query: { queryKey: getListProjectVoiceQueryKey(projectId) } });
  const stateQuery = useGetProjectSoundDesign(projectId, {
    query: {
      queryKey: key,
      refetchInterval: (query) => {
        const data = query.state.data;
        const busyPlan = data?.job && ['pending', 'processing', 'assets'].includes(data.job.status);
        const busyMix = data?.mixes.some((mix) => mix.status === 'pending' || mix.status === 'processing');
        return busyPlan || busyMix ? 2500 : false;
      },
    },
  });
  const generate = useGenerateSoundDesign();
  const mix = useMixProjectSoundDesign();
  const remove = useDeleteProjectSoundDesign();
  const state = stateQuery.data;
  const activeVoices = voiceQuery.data?.filter((row) => !row.is_full_voice && row.is_active && row.status === 'completed') ?? [];
  const voiceReady = activeVoices.length === project.script.scenes.length;
  const latestMix = state?.mixes[0];
  const planBusy = !!state?.job && ['pending', 'processing', 'assets'].includes(state.job.status);
  const mixBusy = !!latestMix && (latestMix.status === 'pending' || latestMix.status === 'processing');
  const planSummary = useMemo(() => readPlanSummary(state?.job?.plan), [state?.job?.plan]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: getListProjectMusicQueryKey(projectId) });
  };

  const start = () => generate.mutate({ id: projectId }, { onSuccess: refresh });
  const startMix = () => mix.mutate({ id: projectId }, { onSuccess: refresh });
  const clear = () => remove.mutate({ id: projectId }, { onSuccess: refresh });

  return (
    <section id="sound-design-workbench" className="mt-12 border-t border-border pt-10" data-testid="section-sound-design-workbench">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><AudioWaveform size={16} /></span><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Stage 05 / Sound Design</p></div>
          <h2 className="display-font mt-4 text-3xl font-bold tracking-[-.05em] md:text-4xl">Auto Sound Design / Звук</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">AI analyzes the script and active voice timeline, then the backend finds real SFX and ambience, stores them, and builds a ducked FFmpeg mix.</p>
        </div>
        <div className="inline-flex self-start rounded-lg border border-border bg-card p-1 sm:self-auto"><button type="button" onClick={() => setMode('auto')} data-testid="button-sound-mode-auto" className={`rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] ${mode === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Auto</button><button type="button" onClick={() => setMode('manual')} data-testid="button-sound-mode-manual" className={`rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] ${mode === 'manual' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}>Manual</button></div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-accent">{mode === 'auto' ? 'AI analysis' : 'Manual timeline'}</p>
            <h3 className="display-font mt-2 text-lg font-bold">{mode === 'auto' ? 'Design the full sound pass' : 'Review and mix'}</h3>
            {mode === 'auto' ? <><p className="mt-3 text-xs leading-5 text-muted-foreground">The model chooses search terms and timing only. It cannot invent or choose file URLs.</p><div className={`mt-4 rounded-lg border p-3 text-[11px] ${voiceReady ? 'border-primary/25 bg-primary/5 text-primary' : 'border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300'}`}>{voiceReady ? <><CheckCircle2 size={13} className="mr-1.5 inline" /> Active voice timeline ready · {activeVoices.length} scenes</> : <><AlertCircle size={13} className="mr-1.5 inline" /> Generate active voice for all {project.script.scenes.length} scenes first.</>}</div><button type="button" onClick={start} disabled={!voiceReady || planBusy || generate.isPending} data-testid="button-generate-sound-design" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{planBusy || generate.isPending ? <><LoaderCircle size={16} className="animate-spin" /> Designing sound…</> : <><WandSparkles size={16} /> Auto sound design</>}</button></> : <><p className="mt-3 text-xs leading-5 text-muted-foreground">Music controls live in the workbench above. Review generated events here, then render a fresh mix after every adjustment.</p><div className="mt-4 rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground"><Layers3 size={13} className="mr-1.5 inline text-accent" /> {state?.music.length || 0} music track · {state?.sound_effects.length || 0} sound events</div></>}
            {(generate.isError || state?.job?.status === 'failed') && <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] leading-5 text-destructive"><AlertCircle size={13} className="mr-1 inline" /> {state?.job?.error || 'Could not start sound design.'}</p>}
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">Final audio</p>
            <h3 className="display-font mt-2 text-lg font-bold">Voice + music + SFX</h3>
            <button type="button" onClick={startMix} disabled={!voiceReady || mixBusy || mix.isPending} data-testid="button-mix-project-audio" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground disabled:opacity-50">{mixBusy || mix.isPending ? <><LoaderCircle size={16} className="animate-spin" /> Mixing audio…</> : <><AudioWaveform size={16} /> Create mixed audio</>}</button>
            {latestMix?.status === 'failed' && <p className="mt-3 text-[11px] text-destructive">{latestMix.error || 'Mix failed.'}</p>}
            {latestMix?.status === 'completed' && latestMix.audio_url && <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="text-xs font-bold text-primary"><CheckCircle2 size={13} className="mr-1 inline" /> mixed_audio.mp3 ready</p><audio controls preload="metadata" src={latestMix.audio_url} className="mt-3 h-9 w-full" data-testid="audio-final-mix" /><div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground"><span>{latestMix.duration ? `${(latestMix.duration / 1000).toFixed(1)}s` : '—'} · {latestMix.file_size ? `${(latestMix.file_size / 1024 / 1024).toFixed(1)} MB` : '—'}</span><a href={latestMix.audio_url} download="mixed_audio.mp3" data-testid="link-download-final-mix" className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><Download size={11} /> Download</a></div></div>}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <SoundPlanSummary status={state?.job?.status} summary={planSummary} />
          <SoundTimeline effects={state?.sound_effects || []} sceneCount={project.script.scenes.length} />
          {(state?.job || state?.music.length || state?.sound_effects.length || state?.mixes.length) && <div className="flex justify-end"><button type="button" onClick={clear} disabled={remove.isPending || planBusy || mixBusy} data-testid="button-clear-sound-design" className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={13} /> Clear sound design</button></div>}
        </div>
      </div>
    </section>
  );
}

function SoundPlanSummary({ status, summary }: { status?: string; summary: ReturnType<typeof readPlanSummary> }) {
  if (!status) return <div className="rounded-2xl border border-dashed border-border bg-card/35 px-6 py-12 text-center"><Sparkles size={25} className="mx-auto text-muted-foreground" /><p className="mt-4 text-sm font-bold">No sound plan yet</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Auto mode will analyze emotional dynamics scene by scene.</p></div>;
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">SoundDesignPlan</p><h3 className="display-font mt-2 text-xl font-bold">{summary?.mood || 'Analyzing'} sound arc</h3></div><span className={`mono-font rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[.12em] ${status === 'completed' ? 'bg-primary/10 text-primary' : status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>{status}</span></div>{summary && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Energy" value={summary.energy} /><Metric label="Tension" value={summary.tension} /><Metric label="Scenes" text={String(summary.scenes)} /><Metric label="Music style" text={summary.musicStyle} /></div>}</div>;
}

function Metric({ label, value, text }: { label: string; value?: number; text?: string }) {
  return <div className="rounded-lg border border-border bg-background/50 p-3"><p className="mono-font text-[9px] uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className="mt-2 truncate text-xs font-bold">{text ?? `${Math.round((value || 0) * 100)}%`}</p>{value != null && <div className="mt-2 h-1 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-accent" style={{ width: `${value * 100}%` }} /></div>}</div>;
}

function SoundTimeline({ effects, sceneCount }: { effects: ProjectSoundEffect[]; sceneCount: number }) {
  if (!effects.length) return <div className="rounded-2xl border border-card-border bg-card p-5"><p className="mono-font text-[10px] uppercase tracking-[.16em] text-muted-foreground">Sound timeline</p><p className="mt-4 text-xs leading-5 text-muted-foreground">Generated SFX and ambience will appear here with scene-relative timing and playable stored audio.</p></div>;
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-accent">Sound timeline</p><h3 className="display-font mt-2 text-lg font-bold">{effects.length} events across {sceneCount} scenes</h3></div><Radio size={18} className="text-accent" /></div><div className="mt-5 space-y-3">{effects.map((effect) => <article key={effect.id} className="rounded-xl border border-border bg-background/45 p-4" data-testid={`row-sound-effect-${effect.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${effect.kind === 'ambience' ? 'bg-accent' : 'bg-primary'}`} /><p className="text-xs font-bold">{effect.title || effect.category || 'Sound effect'}</p></div><p className="mt-1 text-[10px] text-muted-foreground">Scene {effect.scene_id} · {effect.kind} · volume {Math.round(effect.volume * 100)}%</p></div><span className="mono-font inline-flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 size={10} /> {(effect.start_time / 1000).toFixed(2)}s</span></div>{effect.audio_url && <audio controls preload="none" src={effect.audio_url} className="mt-3 h-8 w-full" />}{effect.license === 'unknown' ? <p className="mt-2 text-[10px] text-amber-600">license_status = unknown — verify usage rights</p> : <p className="mt-2 text-[10px] text-muted-foreground">License {effect.license}{effect.requires_attribution ? ' · attribution required' : ''}</p>}</article>)}</div></div>;
}

function readPlanSummary(plan: Record<string, unknown> | null | undefined) {
  if (!plan || typeof plan !== 'object') return null;
  const overall = plan.overall;
  const scenes = plan.scenes;
  if (!overall || typeof overall !== 'object' || !Array.isArray(scenes)) return null;
  const value = overall as Record<string, unknown>;
  if (typeof value.mood !== 'string' || typeof value.energy !== 'number' || typeof value.tension !== 'number' || typeof value.music_style !== 'string') return null;
  return { mood: value.mood, energy: value.energy, tension: value.tension, musicStyle: value.music_style, scenes: scenes.length };
}

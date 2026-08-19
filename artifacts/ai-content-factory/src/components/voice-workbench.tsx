import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AudioLines, Check, ChevronRight, Clock3, Download, LoaderCircle, Mic2, RefreshCw, RotateCw, ShieldCheck, Trash2, UserRound, Volume2, X } from 'lucide-react';
import {
  getGetVoiceQueryKey,
  getGetVoiceStatusQueryKey,
  getListProjectVoiceQueryKey,
  getListVoicesQueryKey,
  type Project,
  type Voice,
  type VoiceGeneration,
  type VoiceGenerationInput,
  useActivateVoice,
  useDeleteVoice,
  useGenerateProjectVoice,
  useGetVoice,
  useGetVoiceStatus,
  useListProjectVoice,
  useListVoices,
  useRefreshVoices,
  useRegenerateVoice,
} from '@workspace/api-client-react';

const tones = ['natural', 'storytelling', 'cinematic', 'dramatic', 'advertising', 'news', 'calm', 'energetic'] as const;
const defaultVoiceSettings: VoiceGenerationInput = {
  voice_id: '',
  voice_name: null,
  model_id: 'eleven_multilingual_v2',
  speed: 1,
  stability: 0.5,
  similarity: 0.75,
  style: 0.2,
  speaker_boost: true,
  tone: 'natural',
};

export function VoiceWorkbench({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const projectId = project.id;
  const projectVoiceKey = getListProjectVoiceQueryKey(projectId);
  const voicesQuery = useListVoices({ query: { queryKey: getListVoicesQueryKey() } });
  const refreshVoices = useRefreshVoices();
  const voiceListQuery = useListProjectVoice(projectId, {
    query: {
      queryKey: projectVoiceKey,
      refetchInterval: (query) => {
        const rows = (query.state.data as VoiceGeneration[] | undefined) ?? [];
        return rows.some((row) => row.status === 'pending' || row.status === 'processing') ? 2600 : false;
      },
    },
  });
  const generateVoice = useGenerateProjectVoice();
  const voices = useMemo(() => voicesQuery.data ?? [], [voicesQuery.data]);
  const generations = voiceListQuery.data ?? [];
  const [settings, setSettings] = useState<VoiceGenerationInput>(defaultVoiceSettings);
  const [open, setOpen] = useState(true);
  const [targetTotal, setTargetTotal] = useState(0);
  const [selectedGenerationId, setSelectedGenerationId] = useState<number | null>(null);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const completed = generations.filter((row) => row.status === 'completed' && row.is_active).length;
  const pending = generations.some((row) => row.status === 'pending' || row.status === 'processing');
  const total = targetTotal || generations.length;
  const selectedVoice = voices.find((voice) => voice.voice_id === settings.voice_id);
  const configMissing = isConfigError(voicesQuery.error) || isConfigError(voiceListQuery.error) || isConfigError(generateVoice.error);

  useEffect(() => {
    if (!settings.voice_id && voices[0]) selectVoice(voices[0]);
  }, [settings.voice_id, voices]);

  const updateSetting = <K extends keyof VoiceGenerationInput>(key: K, value: VoiceGenerationInput[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const selectVoice = (voice: Voice) => {
    setSettings((current) => ({ ...current, voice_id: voice.voice_id, voice_name: voice.name }));
    setVoicePickerOpen(false);
  };
  const refresh = () => {
    refreshVoices.mutate(undefined, {
      onSuccess: (nextVoices) => {
        queryClient.setQueryData(getListVoicesQueryKey(), nextVoices);
        if (!settings.voice_id && nextVoices[0]) selectVoice(nextVoices[0]);
      },
    });
  };
  const startGeneration = () => {
    if (!settings.voice_id) return;
    generateVoice.mutate({ id: projectId, data: settings }, {
      onSuccess: (job) => {
        setTargetTotal(job.total);
        queryClient.invalidateQueries({ queryKey: projectVoiceKey });
      },
    });
  };
  const sceneRows = useMemo(() => project.script.scenes.map((scene) => ({
    scene,
    versions: generations.filter((row) => !row.is_full_voice && row.scene_id === scene.scene_number),
  })), [generations, project.script.scenes]);
  const fullVoice = generations.find((row) => row.is_full_voice);

  return (
    <section className="mt-12 border-t border-border pt-10" data-testid="section-elevenlabs-voice">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><AudioLines size={16} /></span><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Stage 03 / ElevenLabs Voice</p></div>
          <h2 className="display-font mt-4 text-3xl font-bold tracking-[-.05em] md:text-4xl">ElevenLabs Voice / Озвучка</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Find the voice that carries the idea. Generate a scene-by-scene read without touching your script.</p>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)} data-testid="button-toggle-voice-workbench" className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold sm:self-auto">{open ? 'Collapse tools' : 'Open voice tools'} <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} /></button>
      </div>
      {open && (
        <div className="mt-8 grid gap-7 xl:grid-cols-[330px_1fr]">
          <div className="space-y-5">
            <VoicePicker voices={voices} selectedVoice={selectedVoice} isLoading={voicesQuery.isLoading} isRefreshing={refreshVoices.isPending} onRefresh={refresh} onSelect={selectVoice} isOpen={voicePickerOpen} onToggle={() => setVoicePickerOpen((current) => !current)} />
            <VoiceSettings settings={settings} updateSetting={updateSetting} onGenerate={startGeneration} isGenerating={generateVoice.isPending} disabled={!settings.voice_id} />
          </div>
          <div className="min-w-0">
            {configMissing && <ConfigurationNotice />}
            {!configMissing && voicesQuery.isError && <VoiceError onRetry={() => voicesQuery.refetch()} />}
            <VoiceProgress completed={completed} total={total} pending={pending} />
            {generateVoice.isError && !configMissing && <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive" data-testid="status-voice-generation-error"><AlertCircle size={14} className="mr-1.5 inline" />Voice generation could not start. Your script and image work remain safe.</div>}
            {voiceListQuery.isLoading && <VoiceRowsLoading />}
            {voiceListQuery.isError && !voiceListQuery.isLoading && <VoiceError onRetry={() => voiceListQuery.refetch()} />}
            {!voiceListQuery.isLoading && !voiceListQuery.isError && generations.length === 0 && <VoiceEmptyState />}
            {!voiceListQuery.isLoading && !voiceListQuery.isError && generations.length > 0 && (
              <div className="mt-5 space-y-4" data-testid="list-project-voice">
                {fullVoice && <FullVoiceRow generation={fullVoice} onOpen={() => setSelectedGenerationId(fullVoice.id)} />}
                {sceneRows.map(({ scene, versions }) => <SceneVoiceRow key={scene.scene_number} sceneNumber={scene.scene_number} sceneText={scene.voice_text} versions={versions} settings={settings} onOpen={(id) => setSelectedGenerationId(id)} onRefresh={() => queryClient.invalidateQueries({ queryKey: projectVoiceKey })} />)}
              </div>
            )}
          </div>
        </div>
      )}
      {selectedGenerationId !== null && <VoiceDetail generationId={selectedGenerationId} onClose={() => setSelectedGenerationId(null)} />}
    </section>
  );
}

function VoicePicker({ voices, selectedVoice, isLoading, isRefreshing, onRefresh, onSelect, isOpen, onToggle }: { voices: Voice[]; selectedVoice?: Voice; isLoading: boolean; isRefreshing: boolean; onRefresh: () => void; onSelect: (voice: Voice) => void; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]" data-testid="panel-voice-library">
      <div className="flex items-start justify-between gap-3"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-accent">Voice library</p><h3 className="display-font mt-2 text-lg font-bold">Who is speaking?</h3></div><button type="button" onClick={onRefresh} disabled={isRefreshing} data-testid="button-refresh-voices" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"><RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} /></button></div>
      <button type="button" onClick={onToggle} disabled={isLoading || voices.length === 0} data-testid="button-select-voice" className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3.5 py-3 text-left outline-none transition-colors hover:border-primary/45 disabled:opacity-60"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar text-sidebar-primary"><Mic2 size={16} /></span><span className="min-w-0">{isLoading ? <span className="skeleton-bar block h-3 w-28 rounded" /> : selectedVoice ? <><span className="block truncate text-sm font-bold">{selectedVoice.name}</span><span className="mono-font mt-1 block truncate text-[9px] text-muted-foreground">{selectedVoice.voice_id}</span></> : <span className="text-sm text-muted-foreground">Choose a voice</span>}</span></span><ChevronRight size={15} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} /></button>
      {isOpen && <div className="mt-3 max-h-[350px] space-y-2 overflow-y-auto pr-1" data-testid="list-available-voices">{voices.map((voice) => <VoiceOption key={voice.voice_id} voice={voice} selected={voice.voice_id === selectedVoice?.voice_id} onSelect={() => onSelect(voice)} />)}</div>}
      {!isLoading && voices.length === 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground">No cached voices are available yet. Refresh the library to ask the server for the latest list.</p>}
    </div>
  );
}

function VoiceOption({ voice, selected, onSelect }: { voice: Voice; selected: boolean; onSelect: () => void }) {
  return <div className={`rounded-xl border p-3 transition-colors ${selected ? 'border-primary/45 bg-primary/5' : 'border-border bg-background/45'}`} data-testid={`card-available-voice-${voice.voice_id}`}><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><UserRound size={14} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold">{voice.name}</p>{selected && <Check size={14} className="shrink-0 text-primary" />}</div><p className="mono-font mt-1 truncate text-[9px] text-muted-foreground">{voice.voice_id}</p>{(voice.gender || voice.language || voice.accent) && <p className="mt-2 text-[10px] capitalize text-muted-foreground">{[voice.gender, voice.language, voice.accent].filter(Boolean).join(' · ')}</p>}{voice.description && <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{voice.description}</p>}<div className="mt-3 flex items-center gap-2">{voice.preview_url && <audio controls preload="none" src={voice.preview_url} className="h-7 min-w-0 flex-1" data-testid={`audio-voice-preview-${voice.voice_id}`} />}<button type="button" onClick={onSelect} data-testid={`button-choose-voice-${voice.voice_id}`} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${selected ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:border-primary/40'}`}>{selected ? 'Selected' : 'Select'}</button></div></div></div></div>;
}

function VoiceSettings({ settings, updateSetting, onGenerate, isGenerating, disabled }: { settings: VoiceGenerationInput; updateSetting: <K extends keyof VoiceGenerationInput>(key: K, value: VoiceGenerationInput[K]) => void; onGenerate: () => void; isGenerating: boolean; disabled: boolean }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]" data-testid="panel-voice-settings">
      <div className="flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">Voice recipe</p><h3 className="display-font mt-2 text-lg font-bold">Shape the read</h3></div><Volume2 size={18} className="text-accent" /></div>
      <div className="mt-6 space-y-5">
        <label className="block"><span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">Model ID</span><input value={settings.model_id} onChange={(event) => updateSetting('model_id', event.target.value)} data-testid="input-voice-model-id" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-xs outline-none focus:border-primary" /></label>
        <RangeSetting label="Speed" value={settings.speed} min={0.8} max={1.2} step={0.05} suffix="x" onChange={(value) => updateSetting('speed', value)} testId="input-voice-speed" />
        <RangeSetting label="Stability" value={settings.stability} min={0} max={1} step={0.05} onChange={(value) => updateSetting('stability', value)} testId="input-voice-stability" />
        <RangeSetting label="Similarity" value={settings.similarity} min={0} max={1} step={0.05} onChange={(value) => updateSetting('similarity', value)} testId="input-voice-similarity" />
        <RangeSetting label="Style" value={settings.style} min={0} max={1} step={0.05} onChange={(value) => updateSetting('style', value)} testId="input-voice-style" />
        <label className="block"><span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">Tone</span><select value={settings.tone} onChange={(event) => updateSetting('tone', event.target.value as VoiceGenerationInput['tone'])} data-testid="select-voice-tone" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm capitalize outline-none focus:border-primary">{tones.map((tone) => <option key={tone} value={tone}>{tone}</option>)}</select></label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background/55 px-3 py-3"><span><span className="block text-xs font-bold">Speaker boost</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Keep words clear over visuals</span></span><input type="checkbox" checked={settings.speaker_boost} onChange={(event) => updateSetting('speaker_boost', event.target.checked)} data-testid="input-speaker-boost" className="h-4 w-4 accent-[hsl(var(--primary))]" /></label>
      </div>
      <button type="button" onClick={onGenerate} disabled={disabled || isGenerating} data-testid="button-start-voice-generation" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{isGenerating ? <><LoaderCircle size={16} className="animate-spin" /> Preparing voice...</> : <><AudioLines size={16} /> Generate voice track</>}</button>
      {disabled && <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Select a voice above before generating.</p>}
    </div>
  );
}

function RangeSetting({ label, value, min, max, step, suffix, onChange, testId }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void; testId: string }) {
  return <label className="block"><div className="flex items-center justify-between"><span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</span><span className="mono-font text-[10px] text-primary">{value.toFixed(2)}{suffix ?? ''}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} data-testid={testId} className="mt-2 h-1.5 w-full accent-[hsl(var(--primary))]" /></label>;
}

function VoiceProgress({ completed, total, pending }: { completed: number; total: number; pending: boolean }) {
  const percentage = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return <div className="rounded-xl border border-border bg-card p-4" data-testid="status-voice-progress"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${pending ? 'animate-pulse bg-accent' : 'bg-primary'}`} /><span className="text-xs font-bold">{pending ? 'Rendering the read' : total ? 'Voice pass ready' : 'No voice pass yet'}</span></div><span className="mono-font text-[10px] uppercase tracking-[.12em] text-muted-foreground">{completed} / {total || '—'} complete</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percentage}%` }} /></div></div>;
}

function FullVoiceRow({ generation, onOpen }: { generation: VoiceGeneration; onOpen: () => void }) {
  return <article className="rounded-2xl border border-accent/30 bg-accent/5 p-4 md:p-5" data-testid={`row-full-voice-${generation.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mono-font text-[10px] uppercase tracking-[.15em] text-accent">Full voice track</p><p className="mt-1 text-sm font-bold">{generation.voice_name || generation.voice_id} · version {generation.version}</p></div><span className={`mono-font text-[10px] uppercase tracking-[.13em] ${generation.status === 'completed' ? 'text-primary' : generation.status === 'failed' ? 'text-destructive' : 'text-accent'}`}>{generation.status}</span></div>{generation.status === 'completed' && generation.audio_url && <audio controls preload="none" src={generation.audio_url} className="mt-4 h-9 w-full" data-testid={`audio-full-voice-${generation.id}`} />}<div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 size={11} /> {formatSeconds(generation.duration)}</span><button type="button" onClick={onOpen} data-testid={`button-detail-full-voice-${generation.id}`} className="font-bold text-accent hover:underline">View version detail</button>{generation.status === 'completed' && generation.audio_url && <a href={generation.audio_url} download data-testid={`link-download-full-voice-${generation.id}`} className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><Download size={12} /> Download</a>}</div></article>;
}

function SceneVoiceRow({ sceneNumber, sceneText, versions, settings, onOpen, onRefresh }: { sceneNumber: number; sceneText: string; versions: VoiceGeneration[]; settings: VoiceGenerationInput; onOpen: (id: number) => void; onRefresh: () => void }) {
  return <article className="rounded-2xl border border-card-border bg-card p-4 shadow-[var(--shadow-sm)] md:p-5" data-testid={`row-scene-voice-${sceneNumber}`}><div className="flex items-start gap-3"><span className="display-font text-2xl font-bold text-primary">0{sceneNumber}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Scene {sceneNumber}</p><p className="mt-2 text-sm font-semibold leading-6">{sceneText}</p></div><span className="mono-font text-[10px] text-muted-foreground">{versions.length} version{versions.length === 1 ? '' : 's'}</span></div>{versions.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">Waiting for this scene to render.</p> : <div className="mt-4 space-y-2">{versions.map((generation) => <VoiceVersion key={generation.id} generation={generation} settings={settings} onOpen={() => onOpen(generation.id)} onRefresh={onRefresh} />)}</div>}</div></div></article>;
}

function VoiceVersion({ generation, settings, onOpen, onRefresh }: { generation: VoiceGeneration; settings: VoiceGenerationInput; onOpen: () => void; onRefresh: () => void }) {
  const regenerateVoice = useRegenerateVoice();
  const activateVoice = useActivateVoice();
  const deleteVoice = useDeleteVoice();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const regenerate = () => {
    regenerateVoice.mutate({ id: generation.id, data: { ...settings, voice_id: settings.voice_id || generation.voice_id, voice_name: settings.voice_name || generation.voice_name } }, { onSuccess: onRefresh });
  };
  const activate = () => activateVoice.mutate({ id: generation.id }, { onSuccess: onRefresh });
  const remove = () => deleteVoice.mutate({ id: generation.id }, { onSuccess: onRefresh });
  return <div className={`rounded-xl border p-3 ${generation.is_active ? 'border-primary/35 bg-primary/5' : 'border-border bg-background/45'}`} data-testid={`card-voice-version-${generation.id}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={`mono-font text-[10px] uppercase tracking-[.13em] ${generation.status === 'completed' ? 'text-primary' : generation.status === 'failed' ? 'text-destructive' : 'text-accent'}`}>{generation.status}</span><span className="mono-font text-[10px] text-muted-foreground">version {generation.version}</span>{generation.is_active && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-1 text-[9px] font-bold text-primary"><ShieldCheck size={10} /> Active</span>}</div><span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 size={11} /> {formatSeconds(generation.duration)}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{generation.text}</p><p className="mt-2 mono-font text-[10px] text-muted-foreground">Timeline {formatSeconds(generation.start_time)} — {formatSeconds(generation.end_time)}</p>{generation.status === 'completed' && generation.audio_url && <div className="mt-3 flex items-center gap-2"><audio controls preload="none" src={generation.audio_url} className="h-8 min-w-0 flex-1" data-testid={`audio-scene-voice-${generation.id}`} /><a href={generation.audio_url} download data-testid={`link-download-scene-voice-${generation.id}`} className="rounded-md border border-border p-2 text-muted-foreground hover:text-primary"><Download size={14} /></a></div>}<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"><button type="button" onClick={regenerate} disabled={regenerateVoice.isPending} data-testid={`button-regenerate-voice-${generation.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-2 text-[10px] font-bold text-accent-foreground"><RotateCw size={12} className={regenerateVoice.isPending ? 'animate-spin' : ''} /> New version</button>{!generation.is_active && generation.status === 'completed' && <button type="button" onClick={activate} disabled={activateVoice.isPending} data-testid={`button-activate-voice-${generation.id}`} className="rounded-md border border-border px-2.5 py-2 text-[10px] font-bold hover:border-primary/45">Activate</button>}<button type="button" onClick={onOpen} data-testid={`button-detail-voice-${generation.id}`} className="rounded-md border border-border px-2.5 py-2 text-[10px] font-bold">Details</button><button type="button" onClick={() => setConfirmDelete(true)} data-testid={`button-delete-voice-${generation.id}`} className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button></div>{confirmDelete && <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-destructive/5 px-3 py-2"><span className="text-[10px] font-semibold text-destructive">Delete this version?</span><div className="flex gap-1.5"><button type="button" onClick={remove} disabled={deleteVoice.isPending} data-testid={`button-confirm-delete-voice-${generation.id}`} className="rounded bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Delete</button><button type="button" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-voice-${generation.id}`} className="rounded border border-border px-2 py-1 text-[10px] font-bold">Keep</button></div></div>}</div>;
}

function VoiceDetail({ generationId, onClose }: { generationId: number; onClose: () => void }) {
  const detailQuery = useGetVoice(generationId, { query: { enabled: generationId > 0, queryKey: getGetVoiceQueryKey(generationId) } });
  const statusQuery = useGetVoiceStatus(generationId, { query: { enabled: generationId > 0, queryKey: getGetVoiceStatusQueryKey(generationId), refetchInterval: (query) => query.state.data?.status === 'pending' || query.state.data?.status === 'processing' ? 2600 : false } });
  const generation = detailQuery.data;
  const status = statusQuery.data?.status ?? generation?.status;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-card-border bg-card shadow-[var(--shadow-md)]" onClick={(event) => event.stopPropagation()} data-testid="dialog-voice-detail"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="mono-font text-[10px] uppercase tracking-[.15em] text-primary">Voice detail</p><p className="mt-1 text-sm font-bold">Version {generation?.version ?? '—'}</p></div><button type="button" onClick={onClose} data-testid="button-close-voice-detail" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></div>{detailQuery.isLoading ? <div className="p-6"><div className="skeleton-bar h-4 w-36 rounded" /><div className="skeleton-bar mt-5 h-20 w-full rounded-xl" /></div> : generation ? <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="mono-font rounded bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[.13em] text-primary">{status}</span><span className="text-xs text-muted-foreground">{generation.voice_name || generation.voice_id}</span></div><p className="mt-5 text-sm leading-6">{generation.text}</p><dl className="mt-6 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Timeline</dt><dd className="font-semibold">{formatSeconds(generation.start_time)} — {formatSeconds(generation.end_time)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Duration</dt><dd className="font-semibold">{formatSeconds(generation.duration)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Model</dt><dd className="font-semibold">{generation.model_id}</dd></div></dl>{generation.status === 'completed' && generation.audio_url && <audio controls autoPlay={false} src={generation.audio_url} className="mt-6 h-9 w-full" data-testid="audio-voice-detail" />}</div> : <div className="p-8 text-center text-sm text-muted-foreground">This voice version is no longer available.</div>}</div></div>;
}

function ConfigurationNotice() {
  return <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5" data-testid="status-voice-config-missing"><div className="flex items-start gap-3"><AlertCircle size={19} className="mt-0.5 shrink-0 text-accent" /><div><p className="text-sm font-bold">ElevenLabs is not connected yet.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">ElevenLabs API key is not configured. Add it on the server, then refresh voices to continue.</p></div></div></div>;
}

function VoiceError({ onRetry }: { onRetry: () => void }) {
  return <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-5" data-testid="status-voice-error"><div className="flex items-start gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0 text-destructive" /><div><p className="text-sm font-bold">Voice library needs another look.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">We could not load the current voice data.</p><button type="button" onClick={onRetry} data-testid="button-retry-voice" className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[10px] font-bold"><RefreshCw size={12} /> Try again</button></div></div></div>;
}

function VoiceEmptyState() {
  return <div className="mt-5 flex min-h-[270px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center" data-testid="status-voice-empty"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><AudioLines size={22} /></span><h3 className="display-font mt-4 text-xl font-bold">Your read starts here.</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Choose a voice and generate a scene-by-scene track. Earlier versions will stay available as you refine it.</p></div>;
}

function VoiceRowsLoading() {
  return <div className="mt-5 space-y-4" data-testid="status-voice-loading">{[1, 2, 3].map((item) => <div key={item} className="rounded-2xl border border-card-border bg-card p-5"><div className="skeleton-bar h-4 w-28 rounded" /><div className="skeleton-bar mt-4 h-4 w-4/5 rounded" /><div className="skeleton-bar mt-5 h-8 w-full rounded" /></div>)}</div>;
}

function isConfigError(error: unknown) {
  if (!error) return false;
  const candidate = error as { status?: number; response?: { status?: number }; cause?: { status?: number } };
  const status = candidate.status ?? candidate.response?.status ?? candidate.cause?.status;
  return status === 400 || status === 503;
}

function formatSeconds(value: number | null) {
  return value === null ? '—' : `${(value / 1000).toFixed(2)}s`;
}
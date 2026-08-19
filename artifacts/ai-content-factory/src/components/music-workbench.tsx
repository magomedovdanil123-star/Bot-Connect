import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ExternalLink, LoaderCircle, Music2, Search, ShieldAlert, SlidersHorizontal, Trash2, Upload, Volume2 } from 'lucide-react';
import {
  getGetProjectSoundDesignQueryKey,
  getListProjectMusicQueryKey,
  type AudioAsset,
  type Project,
  type ProjectMusic,
  useDeleteProjectMusic,
  useGetProjectSoundDesign,
  useSearchMusic,
  useSelectProjectMusic,
  useUpdateProjectMusic,
} from '@workspace/api-client-react';

type Controls = { volume: number; fade_in: number; fade_out: number; loop: boolean; ducking: boolean };
const defaults: Controls = { volume: 0.12, fade_in: 1000, fade_out: 1500, loop: true, ducking: true };

export function MusicWorkbench({ project }: { project: Project }) {
  const projectId = project.id;
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const stateKey = getGetProjectSoundDesignQueryKey(projectId);
  const soundState = useGetProjectSoundDesign(projectId);
  const active = soundState.data?.music.find((row) => row.is_active);
  const searchMusic = useSearchMusic();
  const selectMusic = useSelectProjectMusic();
  const updateMusic = useUpdateProjectMusic();
  const deleteMusic = useDeleteProjectMusic();
  const [query, setQuery] = useState(`${project.style} ${project.tone} cinematic instrumental`);
  const [results, setResults] = useState<AudioAsset[]>([]);
  const [controls, setControls] = useState<Controls>(defaults);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [appendTrack, setAppendTrack] = useState(false);
  const [transitionStartSeconds, setTransitionStartSeconds] = useState(5);
  const activeTracks = soundState.data?.music.filter((row) => row.is_active) || [];
  const audioBusy = !!soundState.data?.job && ['pending', 'processing', 'assets'].includes(soundState.data.job.status)
    || !!soundState.data?.mixes.some((mix) => mix.status === 'pending' || mix.status === 'processing');

  useEffect(() => {
    if (active) setControls({ volume: active.volume, fade_in: active.fade_in, fade_out: active.fade_out, loop: active.loop, ducking: active.ducking });
  }, [active?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: stateKey });
    queryClient.invalidateQueries({ queryKey: getListProjectMusicQueryKey(projectId) });
  };
  const runSearch = () => {
    if (!query.trim()) return;
    searchMusic.mutate({ data: { query: query.trim(), category: 'instrumental background music', limit: 8 } }, { onSuccess: setResults });
  };
  const choose = (asset: AudioAsset) => {
    if (audioBusy) return;
    selectMusic.mutate({
      id: projectId,
      data: {
        provider: 'openverse',
        external_id: asset.external_id,
        start_time: appendTrack ? Math.round(transitionStartSeconds * 1000) : 0,
        replace_existing: !appendTrack,
        settings: controls,
      },
    }, {
      onSuccess: () => {
        refresh();
        setAppendTrack(false);
      },
    });
  };
  const saveControls = () => { if (!audioBusy) updateMusic.mutate({ id: projectId, data: controls }, { onSuccess: refresh }); };
  const remove = () => { if (!audioBusy) deleteMusic.mutate({ id: projectId }, { onSuccess: refresh }); };
  const upload = async (file?: File) => {
    if (!file || !rightsConfirmed || audioBusy) return;
    setUploadError('');
    setUploading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/music/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
          'x-file-name': file.name,
          'x-rights-confirmed': 'true',
        },
        body: file,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `Upload failed (${response.status})`);
      }
      refresh();
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section id="music-workbench" className="mt-12 border-t border-border pt-10" data-testid="section-music-workbench">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent"><Music2 size={16} /></span><p className="mono-font text-[10px] uppercase tracking-[.2em] text-accent">Stage 04 / Music</p></div>
          <h2 className="display-font mt-4 text-3xl font-bold tracking-[-.05em] md:text-4xl">Music Workbench / Музыка</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search real Openverse audio, review the license, or upload a track you have the rights to use.</p>
        </div>
        {active && <span className="mono-font self-start rounded-full bg-primary/10 px-3 py-1.5 text-[10px] uppercase tracking-[.13em] text-primary sm:self-auto"><Check size={11} className="mr-1 inline" /> {activeTracks.length} active {activeTracks.length === 1 ? 'track' : 'tracks'}</span>}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">Openverse library</p>
            <h3 className="display-font mt-2 text-lg font-bold">Find a soundtrack</h3>
            <div className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} data-testid="input-music-search" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-xs outline-none focus:border-primary" placeholder="cinematic suspense instrumental" /><button type="button" onClick={runSearch} disabled={searchMusic.isPending} data-testid="button-search-music" className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-60">{searchMusic.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}</button></div>
            {active && <div className="mt-4 rounded-lg border border-border bg-background/55 p-3"><label className="flex items-center gap-2 text-[11px] font-bold"><input type="checkbox" checked={appendTrack} onChange={(event) => setAppendTrack(event.target.checked)} disabled={audioBusy} className="accent-[hsl(var(--primary))]" /> Add as a music transition</label>{appendTrack && <label className="mt-3 flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span>Transition at (seconds)</span><input type="number" min={0.1} step={0.1} value={transitionStartSeconds} onChange={(event) => setTransitionStartSeconds(Math.max(0.1, Number(event.target.value) || 0.1))} className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-right text-xs text-foreground" /></label>}{appendTrack && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">The mixer applies up to a 1.5-second crossfade at this point.</p>}</div>}
            {searchMusic.isError && <p className="mt-3 text-xs text-destructive"><AlertCircle size={12} className="mr-1 inline" /> Could not search the audio library.</p>}
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-accent">Your audio</p>
            <h3 className="display-font mt-2 text-lg font-bold">Upload MP3, WAV or M4A</h3>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/55 p-3 text-[11px] leading-5 text-muted-foreground"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} data-testid="checkbox-upload-rights" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" /><span>I confirm that I own this audio or have permission to use it. Uploaded files are marked with <strong>license_status = unknown</strong>.</span></label>
            <input ref={fileInput} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={(event) => upload(event.target.files?.[0])} disabled={!rightsConfirmed || uploading || audioBusy} data-testid="input-upload-music" className="mt-4 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-bold disabled:opacity-50" />
            {uploading && <p className="mt-3 text-xs text-muted-foreground"><LoaderCircle size={13} className="mr-1 inline animate-spin" /> Validating and storing audio…</p>}
            {uploadError && <p className="mt-3 text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          {active && <ActiveMusicCard active={active} controls={controls} setControls={setControls} onSave={saveControls} onDelete={remove} saving={updateMusic.isPending} deleting={deleteMusic.isPending} disabled={audioBusy} />}
          {!active && !results.length && <div className="rounded-2xl border border-dashed border-border bg-card/35 px-6 py-12 text-center"><Music2 size={26} className="mx-auto text-muted-foreground" /><p className="mt-4 text-sm font-bold">No soundtrack selected</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Search the library or upload your own track. Voice audio stays untouched until you create a mix.</p></div>}
          {results.length > 0 && <div><div className="mb-3 flex items-center justify-between"><p className="mono-font text-[10px] uppercase tracking-[.16em] text-muted-foreground">Search results / {results.length}</p><span className="text-[10px] text-muted-foreground">Listen before selecting</span></div><div className="grid gap-3 md:grid-cols-2">{results.map((asset) => <MusicAssetCard key={asset.external_id} asset={asset} selected={active?.music_track_id != null && active.title === asset.title} onSelect={() => choose(asset)} pending={selectMusic.isPending || audioBusy} actionLabel={appendTrack ? 'Add transition' : 'Use track'} />)}</div></div>}
        </div>
      </div>
    </section>
  );
}

function MusicAssetCard({ asset, selected, onSelect, pending, actionLabel }: { asset: AudioAsset; selected: boolean; onSelect: () => void; pending: boolean; actionLabel: string }) {
  const unknown = asset.license.toLowerCase() === 'unknown';
  return <article className={`rounded-xl border p-4 ${selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`} data-testid={`card-music-result-${asset.external_id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{asset.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{asset.creator || 'Unknown creator'} · {asset.duration ? `${Math.round(asset.duration / 1000)}s` : 'duration unknown'}</p></div><span className={`mono-font shrink-0 rounded px-1.5 py-1 text-[9px] ${unknown ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground'}`}>{asset.license}</span></div>{asset.preview_url && <audio controls preload="none" src={asset.preview_url} className="mt-3 h-8 w-full" data-testid={`audio-music-preview-${asset.external_id}`} />}<div className="mt-3 flex items-center justify-between gap-3"><a href={asset.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary">Source <ExternalLink size={10} /></a><button type="button" onClick={onSelect} disabled={pending} data-testid={`button-select-music-${asset.external_id}`} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground disabled:opacity-60">{selected && actionLabel === 'Use track' ? 'Selected' : actionLabel}</button></div></article>;
}

function ActiveMusicCard({ active, controls, setControls, onSave, onDelete, saving, deleting, disabled }: { active: ProjectMusic; controls: Controls; setControls: (value: Controls) => void; onSave: () => void; onDelete: () => void; saving: boolean; deleting: boolean; disabled: boolean }) {
  return <article className="rounded-2xl border border-primary/25 bg-card p-5 shadow-[var(--shadow-sm)]" data-testid="card-active-project-music"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">Current soundtrack</p><h3 className="display-font mt-2 text-xl font-bold">{active.title || 'Uploaded track'}</h3><p className="mt-1 text-xs text-muted-foreground">{active.artist || (active.source === 'upload' ? 'User upload' : 'Unknown creator')}</p></div><div className="flex gap-2"><button type="button" onClick={onDelete} disabled={deleting || disabled} className="rounded-lg border border-destructive/20 p-2 text-destructive hover:bg-destructive/5 disabled:opacity-50"><Trash2 size={14} /></button></div></div>{active.audio_url && <audio controls preload="metadata" src={active.audio_url} className="mt-4 h-9 w-full" data-testid="audio-active-project-music" />}{active.license === 'unknown' ? <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-700 dark:text-amber-300"><ShieldAlert size={14} className="mt-0.5 shrink-0" /><span>License status is unknown. Verify that this audio may be used in your intended distribution.</span></div> : <p className="mt-3 text-[10px] text-muted-foreground">License: <a href={active.license_url || active.source_url || '#'} target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline">{active.license}</a>{active.requires_attribution ? ' · attribution required' : ''}</p>}<div className="mt-6 border-t border-border pt-5"><div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={14} className="text-accent" /><p className="text-xs font-bold">Mix controls</p></div><div className="grid gap-5 sm:grid-cols-3"><ControlRange label="Volume" value={controls.volume} min={0} max={0.25} step={0.01} display={`${Math.round(controls.volume * 100)}%`} onChange={(value) => setControls({ ...controls, volume: value })} /><ControlRange label="Fade in" value={controls.fade_in} min={0} max={5000} step={100} display={`${(controls.fade_in / 1000).toFixed(1)}s`} onChange={(value) => setControls({ ...controls, fade_in: value })} /><ControlRange label="Fade out" value={controls.fade_out} min={0} max={5000} step={100} display={`${(controls.fade_out / 1000).toFixed(1)}s`} onChange={(value) => setControls({ ...controls, fade_out: value })} /></div><div className="mt-5 flex flex-wrap items-center gap-3"><Toggle label="Loop to voice length" checked={controls.loop} onChange={(checked) => setControls({ ...controls, loop: checked })} /><Toggle label="Voice ducking" checked={controls.ducking} onChange={(checked) => setControls({ ...controls, ducking: checked })} /><button type="button" onClick={onSave} disabled={saving || disabled} data-testid="button-save-music-controls" className="ml-auto inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground disabled:opacity-50">{saving ? <LoaderCircle size={13} className="animate-spin" /> : <Volume2 size={13} />} Save controls</button></div></div></article>;
}

function ControlRange({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return <label><span className="flex justify-between text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span>{label}</span><strong className="text-primary">{display}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-1.5 w-full accent-[hsl(var(--primary))]" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[hsl(var(--primary))]" />{label}</label>;
}

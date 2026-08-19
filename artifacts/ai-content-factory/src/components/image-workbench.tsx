import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronRight, CircleHelp, Clock3, Copy, Image as ImageIcon, Layers3, LoaderCircle, Palette, RefreshCw, Sparkles, Star, Trash2, X } from 'lucide-react';
import {
  getGetImageQueryKey,
  getListProjectImagesQueryKey,
  type GeneratedImage,
  type ImageGenerationInput,
  type Project,
  useDeleteImage,
  useGenerateProjectImages,
  useGetImage,
  useListProjectImages,
  useRegenerateImage,
  useSetPrimaryImage,
} from '@workspace/api-client-react';

const defaultSettings: ImageGenerationInput = {
  count: 1,
  aspect_ratio: '9:16',
  visual_style: 'cinematic editorial',
  realism: 'high',
  people: 'optional',
  color_atmosphere: 'warm dusk',
  consistent_character: true,
  character_profile: null,
};

const visualStyles = ['cinematic editorial', 'documentary handheld', 'graphic collage', 'moody noir', 'bright studio'];
const atmospheres = ['warm dusk', 'cool moonlight', 'sun-bleached', 'neon evening', 'muted earth'];

export function ImageWorkbench({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const projectId = project.id;
  const imageQueryKey = getListProjectImagesQueryKey(projectId);
  const imagesQuery = useListProjectImages(projectId, {
    query: {
      queryKey: imageQueryKey,
      refetchInterval: (query) => {
        const data = (query.state.data as GeneratedImage[] | undefined) ?? [];
        return data.some((image) => image.status === 'pending' || image.status === 'processing') ? 2600 : false;
      },
    },
  });
  const generateImages = useGenerateProjectImages();
  const [settings, setSettings] = useState<ImageGenerationInput>(defaultSettings);
  const [targetTotal, setTargetTotal] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const images = imagesQuery.data ?? [];
  const completed = images.filter((image) => image.status === 'completed').length;
  const total = targetTotal || images.length;
  const inFlight = images.some((image) => image.status === 'pending' || image.status === 'processing');
  const updateSetting = <K extends keyof ImageGenerationInput>(key: K, value: ImageGenerationInput[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const startGeneration = () => {
    generateImages.mutate({ id: projectId, data: settings }, {
      onSuccess: (job) => {
        setTargetTotal(job.total);
        queryClient.invalidateQueries({ queryKey: imageQueryKey });
      },
    });
  };
  const sceneProgress = useMemo(() => project.script.scenes.map((scene) => {
    const sceneImages = images.filter((image) => image.scene_id === scene.scene_number);
    return { scene, count: sceneImages.length, completed: sceneImages.filter((image) => image.status === 'completed').length };
  }), [images, project.script.scenes]);

  return (
    <section className="mt-12 border-t border-border pt-10" data-testid="section-script-to-images">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent"><Layers3 size={16} /></span>
            <p className="mono-font text-[10px] uppercase tracking-[.2em] text-accent">Stage 02 / Script to images</p>
          </div>
          <h2 className="display-font mt-4 text-3xl font-bold tracking-[-.05em] md:text-4xl">Give every beat a frame.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Create a visual pass for your scene map. Tune the atmosphere, then keep the strongest versions ready for video.</p>
        </div>
        <button type="button" onClick={() => setIsOpen((open) => !open)} data-testid="button-toggle-image-workbench" className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold sm:self-auto">
          {isOpen ? 'Collapse tools' : 'Open image tools'} <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {isOpen && (
        <div className="mt-8 grid gap-7 xl:grid-cols-[300px_1fr]">
          <ImageSettings settings={settings} updateSetting={updateSetting} onGenerate={startGeneration} isGenerating={generateImages.isPending} />
          <div className="min-w-0">
            <ProgressHeader completed={completed} total={total} inFlight={inFlight} />
            {generateImages.isError && <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive" data-testid="status-image-generation-error"><AlertCircle size={15} className="mt-0.5 shrink-0" />Image generation could not start. Your script is unchanged.</div>}
            {imagesQuery.isLoading && <ImageGridLoading />}
            {imagesQuery.isError && !imagesQuery.isLoading && <ImageLoadError onRetry={() => imagesQuery.refetch()} />}
            {!imagesQuery.isLoading && !imagesQuery.isError && images.length === 0 && <ImageEmptyState />}
            {!imagesQuery.isLoading && !imagesQuery.isError && images.length > 0 && (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="list-generated-images">
                  {images.map((image) => <ImageCard key={image.id} image={image} onOpen={() => setSelectedImageId(image.id)} />)}
                </div>
                {sceneProgress.length > 0 && <SceneProgress items={sceneProgress} />}
              </>
            )}
          </div>
        </div>
      )}
      {selectedImageId !== null && <ImageDetail imageId={selectedImageId} onClose={() => setSelectedImageId(null)} onDeleted={() => { setSelectedImageId(null); queryClient.invalidateQueries({ queryKey: imageQueryKey }); }} />}
    </section>
  );
}

function ImageSettings({ settings, updateSetting, onGenerate, isGenerating }: { settings: ImageGenerationInput; updateSetting: <K extends keyof ImageGenerationInput>(key: K, value: ImageGenerationInput[K]) => void; onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <div><p className="mono-font text-[10px] uppercase tracking-[.16em] text-primary">Image recipe</p><h3 className="display-font mt-2 text-lg font-bold">Set the frame</h3></div>
        <Palette size={18} className="text-accent" />
      </div>
      <div className="mt-6 space-y-5">
        <label className="block"><span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">Images per scene</span><div className="mt-2 flex items-center gap-3"><input type="number" min={1} max={20} value={settings.count} onChange={(event) => updateSetting('count', Math.max(1, Math.min(20, Number(event.target.value) || 1)))} data-testid="input-image-count" className="w-20 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><span className="text-xs text-muted-foreground">1 to 20</span></div></label>
        <SettingSelect label="Aspect ratio" value={settings.aspect_ratio} options={['9:16', '16:9', '1:1']} onChange={(value) => updateSetting('aspect_ratio', value as ImageGenerationInput['aspect_ratio'])} testId="select-image-aspect-ratio" />
        <SettingSelect label="Visual style" value={settings.visual_style} options={visualStyles} onChange={(value) => updateSetting('visual_style', value)} testId="select-image-style" />
        <SettingSelect label="Realism" value={settings.realism} options={['low', 'medium', 'high']} onChange={(value) => updateSetting('realism', value as ImageGenerationInput['realism'])} testId="select-image-realism" />
        <SettingSelect label="People" value={settings.people} options={['none', 'optional', 'required']} onChange={(value) => updateSetting('people', value as ImageGenerationInput['people'])} testId="select-image-people" />
        <SettingSelect label="Color atmosphere" value={settings.color_atmosphere} options={atmospheres} onChange={(value) => updateSetting('color_atmosphere', value)} testId="select-image-atmosphere" />
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background/55 px-3 py-3"><span><span className="block text-xs font-bold">Consistent character</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Keep the lead visually aligned</span></span><input type="checkbox" checked={settings.consistent_character} onChange={(event) => updateSetting('consistent_character', event.target.checked)} data-testid="input-consistent-character" className="h-4 w-4 accent-[hsl(var(--primary))]" /></label>
      </div>
      <button type="button" onClick={onGenerate} disabled={isGenerating} data-testid="button-start-image-generation" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{isGenerating ? <><LoaderCircle size={16} className="animate-spin" /> Queuing frames...</> : <><Sparkles size={16} /> Generate images</>}</button>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground"><CircleHelp size={12} className="mt-0.5 shrink-0" /> New generations create new versions. Your earlier frames stay on the shelf.</p>
    </div>
  );
}

function SettingSelect({ label, value, options, onChange, testId }: { label: string; value: string; options: string[]; onChange: (value: string) => void; testId: string }) {
  return <label className="block"><span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm capitalize outline-none focus:border-primary">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ProgressHeader({ completed, total, inFlight }: { completed: number; total: number; inFlight: boolean }) {
  const percentage = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return <div className="rounded-xl border border-border bg-card p-4" data-testid="status-image-progress"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${inFlight ? 'animate-pulse bg-accent' : 'bg-primary'}`} /><span className="text-xs font-bold">{inFlight ? 'Rendering your frames' : total ? 'Image pass ready' : 'No image pass yet'}</span></div><span className="mono-font text-[10px] uppercase tracking-[.12em] text-muted-foreground">{completed} / {total || '—'} complete</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percentage}%` }} /></div></div>;
}

function ImageCard({ image, onOpen }: { image: GeneratedImage; onOpen: () => void }) {
  const queryClient = useQueryClient();
  const regenerateImage = useRegenerateImage();
  const deleteImage = useDeleteImage();
  const setPrimary = useSetPrimaryImage();
  const [prompt, setPrompt] = useState(image.prompt);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListProjectImagesQueryKey(image.project_id) });
  const regenerate = () => {
    if (!prompt.trim()) return;
    regenerateImage.mutate({ id: image.id, data: { prompt: prompt.trim() } }, { onSuccess: refresh });
  };
  const remove = () => deleteImage.mutate({ id: image.id }, { onSuccess: refresh });
  return (
    <article className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-[var(--shadow-sm)]" data-testid={`card-generated-image-${image.id}`}>
      <button type="button" onClick={onOpen} data-testid={`button-open-image-${image.id}`} className="group relative block aspect-[9/10] w-full overflow-hidden bg-sidebar text-left">
        {image.image_url ? <img src={image.image_url} alt={`Generated frame for scene ${image.scene_id}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sidebar-foreground/55">{image.status === 'failed' ? <AlertCircle size={24} className="text-destructive" /> : <LoaderCircle size={24} className="animate-spin text-sidebar-primary" />}<span className="mono-font text-[10px] uppercase tracking-[.15em]">{image.status === 'processing' ? 'Rendering frame' : image.status}</span></div>}
        <div className="absolute left-3 top-3 flex items-center gap-2"><span className="mono-font rounded-md bg-sidebar/85 px-2 py-1 text-[10px] uppercase tracking-[.13em] text-sidebar-foreground">Scene {image.scene_id}</span>{image.is_primary && <span className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground"><Star size={10} fill="currentColor" /> Primary</span>}</div>
      </button>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3"><span className={`mono-font text-[10px] uppercase tracking-[.13em] ${image.status === 'completed' ? 'text-primary' : image.status === 'failed' ? 'text-destructive' : 'text-accent'}`}>{image.status}</span><span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 size={11} /> {image.generation_time ? `${image.generation_time.toFixed(1)}s` : '—'}</span></div>
        {editing ? <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} data-testid={`input-image-prompt-${image.id}`} className="mt-3 min-h-[75px] w-full resize-none rounded-lg border border-primary/40 bg-background px-3 py-2 text-xs leading-5 outline-none" /> : <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground" data-testid={`text-image-prompt-${image.id}`}>{image.prompt}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {editing ? <><button type="button" onClick={regenerate} disabled={regenerateImage.isPending} data-testid={`button-save-image-prompt-${image.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-2 text-[10px] font-bold text-primary-foreground"><RefreshCw size={12} className={regenerateImage.isPending ? 'animate-spin' : ''} /> New version</button><button type="button" onClick={() => { setPrompt(image.prompt); setEditing(false); }} data-testid={`button-cancel-image-prompt-${image.id}`} className="rounded-md border border-border px-2.5 py-2 text-[10px] font-bold">Cancel</button></> : <button type="button" onClick={() => setEditing(true)} data-testid={`button-edit-image-prompt-${image.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-[10px] font-bold hover:border-primary/40"><Copy size={12} /> Edit prompt</button>}
          {!image.is_primary && image.status === 'completed' && <button type="button" onClick={() => setPrimary.mutate({ id: image.id }, { onSuccess: refresh })} disabled={setPrimary.isPending} data-testid={`button-set-primary-${image.id}`} className="rounded-md border border-border px-2.5 py-2 text-[10px] font-bold hover:border-accent/50 hover:text-accent">Set primary</button>}
          <button type="button" onClick={() => setConfirmDelete(true)} data-testid={`button-delete-image-${image.id}`} className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
        </div>
        {confirmDelete && <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-destructive/5 px-3 py-2"><span className="text-[10px] font-semibold text-destructive">Delete this version?</span><div className="flex gap-1.5"><button type="button" onClick={remove} disabled={deleteImage.isPending} data-testid={`button-confirm-delete-image-${image.id}`} className="rounded bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Delete</button><button type="button" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-image-${image.id}`} className="rounded border border-border px-2 py-1 text-[10px] font-bold">Keep</button></div></div>}
      </div>
    </article>
  );
}

function SceneProgress({ items }: { items: { scene: { scene_number: number; voice_text: string }; count: number; completed: number }[] }) {
  return <div className="mt-6 rounded-xl border border-border bg-card p-4" data-testid="list-scene-progress"><div className="mb-3 flex items-center justify-between"><p className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Scene progress</p><span className="text-[10px] text-muted-foreground">Frames by beat</span></div><div className="space-y-3">{items.map(({ scene, count, completed }) => <div key={scene.scene_number} className="flex items-center gap-3"><span className="mono-font w-10 text-[10px] text-primary">0{scene.scene_number}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${count ? (completed / count) * 100 : 0}%` }} /></div><span className="mono-font w-12 text-right text-[10px] text-muted-foreground">{completed}/{count || '—'}</span></div>)}</div></div>;
}

function ImageEmptyState() {
  return <div className="mt-5 flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center" data-testid="status-images-empty"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent"><ImageIcon size={22} /></span><h3 className="display-font mt-4 text-xl font-bold">Your visual pass starts here.</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Set a frame recipe, then generate one image per scene to start shaping the cut.</p></div>;
}

function ImageGridLoading() {
  return <div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="status-images-loading">{[1, 2].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-card-border bg-card"><div className="skeleton-bar aspect-[9/10]" /><div className="p-4"><div className="skeleton-bar h-3 w-20 rounded" /><div className="skeleton-bar mt-4 h-4 w-full rounded" /><div className="skeleton-bar mt-2 h-4 w-4/5 rounded" /></div></div>)}</div>;
}

function ImageLoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="mt-5 flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 text-center" data-testid="status-images-error"><AlertCircle size={22} className="text-destructive" /><p className="mt-3 text-sm font-semibold">Frames could not be loaded.</p><button type="button" onClick={onRetry} data-testid="button-retry-images" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold"><RefreshCw size={13} /> Try again</button></div>;
}

function ImageDetail({ imageId, onClose, onDeleted }: { imageId: number; onClose: () => void; onDeleted: () => void }) {
  const imageQuery = useGetImage(imageId, { query: { enabled: imageId > 0, queryKey: getGetImageQueryKey(imageId) } });
  const deleteImage = useDeleteImage();
  const image = imageQuery.data;
  const remove = () => deleteImage.mutate({ id: imageId }, { onSuccess: onDeleted });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-card-border bg-card shadow-[var(--shadow-md)]" onClick={(event) => event.stopPropagation()} data-testid="dialog-image-detail"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="mono-font text-[10px] uppercase tracking-[.15em] text-primary">Frame detail</p><p className="mt-1 text-sm font-bold">Version {image?.version ?? '—'}</p></div><button type="button" onClick={onClose} data-testid="button-close-image-detail" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></div>{imageQuery.isLoading ? <div className="p-6"><div className="skeleton-bar aspect-video w-full rounded-xl" /><div className="skeleton-bar mt-5 h-4 w-full rounded" /></div> : image ? <div className="grid gap-5 p-5 md:grid-cols-[minmax(220px, .8fr)_1fr]">{image.image_url ? <img src={image.image_url} alt={`Detailed generated frame for scene ${image.scene_id}`} className="max-h-[470px] w-full rounded-xl bg-sidebar object-contain" /> : <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground/50"><ImageIcon size={30} /></div>}<div><div className="flex items-center gap-2"><span className="mono-font rounded bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[.13em] text-accent">Scene {image.scene_id}</span><span className="mono-font text-[10px] text-muted-foreground">{image.status}</span></div><p className="mt-4 text-sm leading-6">{image.prompt}</p><dl className="mt-6 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Aspect ratio</dt><dd className="font-semibold">{image.aspect_ratio}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Model</dt><dd className="font-semibold">{image.model}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Generation time</dt><dd className="font-semibold">{image.generation_time ? `${image.generation_time.toFixed(1)}s` : '—'}</dd></div></dl><button type="button" onClick={remove} disabled={deleteImage.isPending} data-testid="button-delete-image-detail" className="mt-7 inline-flex items-center gap-2 rounded-lg border border-destructive/25 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5"><Trash2 size={14} /> Delete version</button></div></div> : <div className="p-8 text-center text-sm text-muted-foreground">This frame is no longer available.</div>}</div></div>;
}
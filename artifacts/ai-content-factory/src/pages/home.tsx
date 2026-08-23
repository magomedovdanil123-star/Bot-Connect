import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'wouter';
import { AlertCircle, ArrowRight, Lightbulb, RotateCw, WandSparkles } from 'lucide-react';
import { useCreateProject, useGenerateProjectVideo, useRegenerateProject, type Project, type ProjectInput } from '@workspace/api-client-react';
import { ScriptReader } from '@/components/script-reader';

const formats = ['Shorts', 'Reels', 'TikTok'] as const;
const durations = [30, 60, 90] as const;
const styles = ['realistic', 'dramatic', 'funny', 'relatable', 'crime', 'motivational'] as const;
const tones = ['serious', 'emotional', 'bold', 'intriguing'] as const;

export default function Home() {
  const [generated, setGenerated] = useState<Project | null>(null);
  const [, navigate] = useLocation();
  const createProject = useCreateProject();
  const generateVideo = useGenerateProjectVideo();
  const regenerateProject = useRegenerateProject();
  const form = useForm<ProjectInput>({ defaultValues: { topic: '', format: 'Shorts', duration: 60, style: 'relatable', tone: 'intriguing' } });
  const submit = (input: ProjectInput) => {
     createProject.mutate({ data: input }, { onSuccess: (project) => {
       setGenerated(project);
     }});
  };
  const approve = async (script: Project['script']) => {
    if (!generated) return;
    const response = await fetch(`/api/projects/${generated.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });
    if (!response.ok) throw new Error('Could not approve script');
    const project = await response.json() as Project;
    setGenerated(project);
    generateVideo.mutate({ id: project.id, data: { format: "9:16", duration: project.duration as 30 | 60 | 90 | 120 | 180, style: project.style, tone: project.tone } }, {
      onSuccess: () => navigate(`/projects/${project.id}#video-pipeline`),
      onError: () => navigate(`/projects/${project.id}#video-pipeline`),
    });
  };
  const regenerate = () => {
    if (!generated) return;
    regenerateProject.mutate({ id: generated.id }, { onSuccess: (project) => setGenerated(project) });
  };
  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1420px] px-5 py-10 md:px-10 md:py-16">
        <div className="grid gap-10 xl:grid-cols-[minmax(360px,460px)_1fr] xl:gap-20">
          <div className="animate-rise-in">
            <div className="mono-font inline-flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />New production draft</div>
            <h1 className="display-font mt-6 max-w-[520px] text-5xl font-bold leading-[.98] tracking-[-.065em] md:text-7xl">Turn the spark into a <span className="text-primary">shootable story.</span></h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">Give the factory a rough idea. Get back a structured short-form script with scenes, voice, visuals, and a reason to keep watching.</p>
            <div className="mt-8 flex items-center gap-3">
              <Link href="/projects" data-testid="link-view-shelf" className="group inline-flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary">Browse project shelf <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></Link>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">01 / 03</span>
            </div>
            <div className="mt-14 hidden border-l-2 border-accent/45 pl-4 sm:block">
              <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Lightbulb size={14} className="text-accent" /> Strong stories start specific.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">A place, a person, a tension. The more concrete the seed, the sharper the result.</p>
            </div>
          </div>
          <div className="animate-rise-in [animation-delay:100ms]">
            <form onSubmit={form.handleSubmit(submit)} className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] md:p-8" data-testid="form-new-script">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="mono-font text-[10px] uppercase tracking-[.18em] text-muted-foreground">Story brief</p>
                  <h2 className="display-font mt-2 text-xl font-bold tracking-[-.03em]">What are we making?</h2>
                </div>
                <WandSparkles size={22} className="text-primary" />
              </div>
              <label className="mt-6 block">
                <span className="mono-font text-[10px] uppercase tracking-[.14em] text-muted-foreground">Topic or rough idea</span>
                <textarea {...form.register('topic', { required: 'Add a topic to begin.', minLength: { value: 3, message: 'Give the idea a little more shape.' } })} data-testid="input-topic" placeholder="A night-shift baker who knows every customer's secret..." className="mt-2 min-h-[112px] w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                {form.formState.errors.topic && <span className="mt-2 block text-xs text-destructive">{form.formState.errors.topic.message}</span>}
              </label>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <ChoiceField label="Format" name="format" value={form.watch('format')} options={formats} onChange={(value) => form.setValue('format', value as ProjectInput['format'])} />
                <ChoiceField label="Runtime" name="duration" value={String(form.watch('duration'))} options={durations.map(String)} displayOptions={durations.map((duration) => `${duration}s`)} onChange={(value) => form.setValue('duration', Number(value) as ProjectInput['duration'])} />
                <ChoiceField label="Visual language" name="style" value={form.watch('style')} options={styles} onChange={(value) => form.setValue('style', value as ProjectInput['style'])} />
                <ChoiceField label="Narrative temperature" name="tone" value={form.watch('tone')} options={tones} onChange={(value) => form.setValue('tone', value as ProjectInput['tone'])} />
              </div>
               <button type="submit" disabled={createProject.isPending} data-testid="button-generate-script" className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_7px_0_hsl(166_62%_22%)] transition-transform hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-[0_3px_0_hsl(166_62%_22%)] disabled:cursor-wait disabled:opacity-60">
                {createProject.isPending ? <><RotateCw size={16} className="animate-spin" /> Generating script...</> : <>📝 Generate script <ArrowRight size={16} /></>}
              </button>
              {createProject.isError && <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive" data-testid="status-create-error"><AlertCircle size={15} className="mt-0.5 shrink-0" />The factory hit a snag. Check the brief and try again.</div>}
            </form>
          </div>
        </div>
        {createProject.isPending && <ScriptLoading />}
         {generated && !createProject.isPending && <div className="mt-14"><ScriptReader project={generated} onRegenerate={regenerate} isRegenerating={regenerateProject.isPending} onApprove={approve} isApproving={generateVideo.isPending} /></div>}
        {regenerateProject.isError && <p className="mt-3 text-right text-xs text-destructive">Regeneration failed. Your current draft is still safe.</p>}
      </div>
    </div>
  );
}

function ChoiceField({ label, name, value, options, displayOptions, onChange }: { label: string; name: string; value: string; options: readonly string[]; displayOptions?: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mono-font text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} data-testid={`select-${name}`} className="mt-2 w-full appearance-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm capitalize outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15">
        {options.map((option, index) => <option key={option} value={option}>{displayOptions?.[index] ?? option}</option>)}
      </select>
    </label>
  );
}

function ScriptLoading() {
  return (
    <section className="mt-14 overflow-hidden rounded-2xl border border-card-border bg-card p-6 shadow-[var(--shadow-sm)] md:p-8" data-testid="status-script-loading">
      <div className="flex items-center gap-3"><span className="h-9 w-9 animate-pulse-soft rounded-lg bg-primary/15" /><div className="skeleton-bar h-3 w-36 rounded" /></div>
      <div className="skeleton-bar mt-8 h-10 max-w-xl rounded-lg" /><div className="skeleton-bar mt-4 h-4 max-w-2xl rounded" />
      <div className="mt-9 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="grid gap-4 rounded-xl border border-border p-5 md:grid-cols-[80px_1fr]"><div className="skeleton-bar h-8 w-12 rounded" /><div><div className="skeleton-bar h-3 w-16 rounded" /><div className="skeleton-bar mt-3 h-4 w-4/5 rounded" /><div className="skeleton-bar mt-2 h-4 w-3/5 rounded" /></div></div>)}</div>
    </section>
  );
}
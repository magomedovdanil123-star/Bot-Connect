import { useEffect, useState } from 'react';
import { Check, Copy, Film, Layers3, RotateCw, Sparkles } from 'lucide-react';
import type { Project } from '@workspace/api-client-react';
import { Link } from 'wouter';

export function ScriptReader({ project, onRegenerate, isRegenerating, onApprove, isApproving }: { project: Project; onRegenerate: () => void; isRegenerating: boolean; onApprove?: (script: Project['script']) => void; isApproving?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [script, setScript] = useState(project.script);
  useEffect(() => setScript(project.script), [project.script]);
  const editable = project.status === 'draft';
  const update = (patch: Partial<typeof script>) => setScript((current) => ({ ...current, ...patch }));
  const updateScene = (sceneNumber: number, patch: Partial<typeof script.scenes[number]>) => {
    setScript((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => scene.scene_number === sceneNumber ? { ...scene, ...patch } : scene),
    }));
  };
  const copyScript = async () => {
    if (!script) return;
    const text = [
      script.title,
      `HOOK\n${script.hook}`,
      `DESCRIPTION\n${script.description}`,
       ...script.scenes.map((scene) => [
         `SCENE ${scene.scene_number} · ${scene.duration_seconds}s`,
         `PURPOSE\n${scene.scene_purpose || ''}`,
         `STORY BEAT\n${scene.story_beat || ''}`,
         `CAUSE\n${scene.cause || ''}`,
         `ACTION\n${scene.action || ''}`,
         `OBSTACLE\n${scene.obstacle || ''}`,
         `CHANGE\n${scene.change || ''}`,
         `CONTINUITY\n${scene.continuity || ''}`,
         `TRANSITION\n${scene.transition || ''}`,
         `VOICE\n${scene.voice_text}`,
         `VISUAL\n${scene.visual_description}`,
         `IMAGE PROMPT\n${scene.image_prompt}`,
       ].join('\n')),
      `ENDING\n${script.ending}`,
      `CTA\n${script.cta}`,
    ].join('\n\n');
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="animate-rise-in overflow-hidden rounded-2xl border border-card-border bg-card shadow-[var(--shadow-md)]" data-testid="panel-generated-script">
       <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-secondary/40 px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles size={17} /></span>
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.17em] text-primary">Production draft</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Ready to shape into a shoot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copyScript} data-testid="button-copy-script" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted">
            {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy script'}
          </button>
           <button type="button" onClick={onRegenerate} disabled={isRegenerating || isApproving} data-testid="button-regenerate-script" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
            <RotateCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
             {isRegenerating ? 'Rewriting' : 'Regenerate draft'}
          </button>
           {editable && onApprove && <button type="button" onClick={() => onApprove(script)} disabled={isApproving || isRegenerating} data-testid="button-approve-script" className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60">
             <Check size={14} /> {isApproving ? 'Saving…' : 'Approve & create video'}
           </button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/5 px-5 py-3.5 md:px-7">
         <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Layers3 size={14} className="text-accent" /> {editable ? 'Edit this draft, then approve it to start production.' : 'Approved script — production can use this version.'}</p>
         {!editable && <Link href={`/projects/${project.id}`} data-testid="link-script-to-images" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline">Open production <span aria-hidden="true">→</span></Link>}
      </div>
      <div className="p-5 md:p-8">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-font rounded-full bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-accent">{project.format}</span>
            <span className="mono-font text-[10px] uppercase tracking-[.12em] text-muted-foreground">{project.duration}s / {project.style} / {project.tone}</span>
          </div>
           {editable ? <input value={script.title} onChange={(event) => update({ title: event.target.value })} data-testid="input-script-title" className="display-font mt-5 w-full border-b border-primary/30 bg-transparent text-3xl font-bold leading-[1.08] tracking-[-.04em] outline-none md:text-5xl" /> : <h2 data-testid="text-script-title" className="display-font mt-5 text-3xl font-bold leading-[1.08] tracking-[-.04em] text-foreground md:text-5xl">{script.title}</h2>}
           {editable ? <textarea value={script.description} onChange={(event) => update({ description: event.target.value })} data-testid="input-script-description" className="mt-4 min-h-20 w-full max-w-2xl resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{script.description}</p>}
        </div>
        <div className="mt-9 grid gap-5 border-y border-border py-6 md:grid-cols-[1fr_1.6fr] md:gap-10">
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-accent">The hook</p>
             {editable ? <textarea value={script.hook} onChange={(event) => update({ hook: event.target.value })} data-testid="input-script-hook" className="mt-3 min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p data-testid="text-script-hook" className="mt-3 display-font text-xl font-semibold leading-7 text-foreground">“{script.hook}”</p>}
          </div>
          <div className="rounded-xl bg-sidebar px-5 py-5 text-sidebar-foreground">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-sidebar-primary">Opening direction</p>
             <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">{script.hook}</p>
          </div>
        </div>
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-muted-foreground">Scene map</p>
            <span className="mono-font text-[10px] text-muted-foreground">{script.scenes.length} scenes · {script.duration_seconds}s total</span>
          </div>
          <div className="space-y-3">
            {script.scenes.map((scene) => (
              <article key={scene.scene_number} data-testid={`card-scene-${scene.scene_number}`} className="group grid gap-4 rounded-xl border border-border bg-background/55 p-4 transition-colors hover:border-primary/35 md:grid-cols-[80px_1fr] md:p-5">
                <div className="flex items-start justify-between md:block">
                  <div className="flex items-center gap-2 md:block">
                    <span className="display-font text-2xl font-bold text-primary">0{scene.scene_number}</span>
                    <span className="mono-font text-[10px] text-muted-foreground md:mt-2 md:block">{scene.duration_seconds}s</span>
                  </div>
                  <Film size={16} className="text-muted-foreground/50 md:hidden" />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
                  <div>
                    <p className="mono-font text-[10px] uppercase tracking-[.13em] text-accent">Voice</p>
                     {editable ? <textarea value={scene.voice_text} onChange={(event) => setScript((current) => ({ ...current, scenes: current.scenes.map((item) => item.scene_number === scene.scene_number ? { ...item, voice_text: event.target.value } : item) }))} data-testid={`input-scene-voice-${scene.scene_number}`} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{scene.voice_text}</p>}
                  </div>
                  <div>
                    <p className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">Visual direction</p>
                     {editable ? <textarea value={scene.visual_description} onChange={(event) => setScript((current) => ({ ...current, scenes: current.scenes.map((item) => item.scene_number === scene.scene_number ? { ...item, visual_description: event.target.value } : item) }))} data-testid={`input-scene-visual-${scene.scene_number}`} className="mt-2 min-h-20 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p className="mt-2 text-sm leading-6 text-muted-foreground">{scene.visual_description}</p>}
                     {editable ? <textarea value={scene.image_prompt} onChange={(event) => setScript((current) => ({ ...current, scenes: current.scenes.map((item) => item.scene_number === scene.scene_number ? { ...item, image_prompt: event.target.value } : item) }))} data-testid={`input-scene-prompt-${scene.scene_number}`} className="mt-3 min-h-16 w-full resize-y rounded-lg border border-input bg-background p-3 text-xs italic leading-5 outline-none focus:border-primary" /> : <p className="mt-3 border-l-2 border-primary/35 pl-3 text-xs italic leading-5 text-muted-foreground/80">{scene.image_prompt}</p>}
                  </div>
                </div>
                 <details className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3 lg:col-start-2" open={editable ? undefined : false}>
                   <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-[.13em] text-primary">Scene logic · why this scene exists</summary>
                   <div className="mt-3 grid gap-3 sm:grid-cols-2">
                     {([
                       ['scene_purpose', 'Purpose', 'Why this scene is needed'],
                       ['story_beat', 'Story beat', 'Setup, complication, turn, climax, consequence or hook'],
                       ['cause', 'Cause', 'What from the previous scene forces this moment'],
                       ['action', 'Hero action', 'What the hero concretely does'],
                       ['obstacle', 'Obstacle', 'What blocks or complicates the goal'],
                       ['change', 'Change', 'What is different by the end of the scene'],
                       ['continuity', 'Continuity', 'Place, props, time, weather and emotional state'],
                       ['transition', 'Next transition', 'Why the next scene follows from this one'],
                     ] as const).map(([field, label, placeholder]) => (
                       <label key={field} className="block">
                         <span className="mono-font text-[9px] uppercase tracking-[.12em] text-muted-foreground">{label}</span>
                         {editable ? (
                           <textarea
                             value={scene[field] || ''}
                             onChange={(event) => updateScene(scene.scene_number, { [field]: event.target.value })}
                             placeholder={placeholder}
                             data-testid={`input-scene-${field}-${scene.scene_number}`}
                             className="mt-1.5 min-h-16 w-full resize-y rounded-md border border-input bg-background p-2.5 text-xs leading-5 outline-none focus:border-primary"
                           />
                         ) : (
                           <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{scene[field] || '—'}</p>
                         )}
                       </label>
                     ))}
                   </div>
                 </details>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
           <div className="rounded-xl bg-muted/60 p-5">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-muted-foreground">Landing beat</p>
             {editable ? <textarea value={script.ending} onChange={(event) => update({ ending: event.target.value })} data-testid="input-script-ending" className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p className="mt-3 text-sm font-semibold leading-6">{script.ending}</p>}
          </div>
          <div className="rounded-xl border border-accent/25 bg-accent/5 p-5">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-accent">Call to action</p>
             {editable ? <textarea value={script.cta} onChange={(event) => update({ cta: event.target.value })} data-testid="input-script-cta" className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /> : <p className="mt-3 text-sm font-semibold leading-6">{script.cta}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
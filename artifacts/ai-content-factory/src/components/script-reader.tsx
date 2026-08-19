import { useState } from 'react';
import { Check, Copy, Film, RotateCw, Sparkles } from 'lucide-react';
import type { Project } from '@workspace/api-client-react';

export function ScriptReader({ project, onRegenerate, isRegenerating }: { project: Project; onRegenerate: () => void; isRegenerating: boolean }) {
  const [copied, setCopied] = useState(false);
  const script = project.script;
  const copyScript = async () => {
    if (!script) return;
    const text = [
      script.title,
      `HOOK\n${script.hook}`,
      `DESCRIPTION\n${script.description}`,
      ...script.scenes.map((scene) => `SCENE ${scene.scene_number} · ${scene.duration_seconds}s\nVOICE\n${scene.voice_text}\nVISUAL\n${scene.visual_description}\nIMAGE PROMPT\n${scene.image_prompt}`),
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
          <button type="button" onClick={onRegenerate} disabled={isRegenerating} data-testid="button-regenerate-script" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
            <RotateCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
            {isRegenerating ? 'Rewriting' : 'Regenerate'}
          </button>
        </div>
      </div>
      <div className="p-5 md:p-8">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-font rounded-full bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-accent">{project.format}</span>
            <span className="mono-font text-[10px] uppercase tracking-[.12em] text-muted-foreground">{project.duration}s / {project.style} / {project.tone}</span>
          </div>
          <h2 data-testid="text-script-title" className="display-font mt-5 text-3xl font-bold leading-[1.08] tracking-[-.04em] text-foreground md:text-5xl">{script.title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{script.description}</p>
        </div>
        <div className="mt-9 grid gap-5 border-y border-border py-6 md:grid-cols-[1fr_1.6fr] md:gap-10">
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-accent">The hook</p>
            <p data-testid="text-script-hook" className="mt-3 display-font text-xl font-semibold leading-7 text-foreground">“{script.hook}”</p>
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
                    <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{scene.voice_text}</p>
                  </div>
                  <div>
                    <p className="mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground">Visual direction</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{scene.visual_description}</p>
                    <p className="mt-3 border-l-2 border-primary/35 pl-3 text-xs italic leading-5 text-muted-foreground/80">{scene.image_prompt}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl bg-muted/60 p-5">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-muted-foreground">Landing beat</p>
            <p className="mt-3 text-sm font-semibold leading-6">{script.ending}</p>
          </div>
          <div className="rounded-xl border border-accent/25 bg-accent/5 p-5">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-accent">Call to action</p>
            <p className="mt-3 text-sm font-semibold leading-6">{script.cta}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
import { Link } from 'wouter';
import { AlertCircle, ArrowUpRight, Clock3, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { useListProjects } from '@workspace/api-client-react';

export default function Projects() {
  const projectsQuery = useListProjects();
  const projects = projectsQuery.data ?? [];
  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1280px] px-5 py-10 md:px-10 md:py-14">
        <div className="flex flex-col justify-between gap-7 border-b border-border pb-8 sm:flex-row sm:items-end">
          <div className="animate-rise-in">
            <p className="mono-font inline-flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Archive / 02</p>
            <h1 className="display-font mt-4 text-5xl font-bold tracking-[-.065em] md:text-6xl">Project shelf</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">The ideas you gave a second life. Keep the good ones moving.</p>
          </div>
          <Link href="/" data-testid="link-create-project" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"><Plus size={16} /> New script</Link>
        </div>
        {projectsQuery.isLoading && <ProjectsLoading />}
        {projectsQuery.isError && <ErrorState onRetry={() => projectsQuery.refetch()} />}
        {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && <EmptyShelf />}
        {!projectsQuery.isLoading && !projectsQuery.isError && projects.length > 0 && (
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="list-projects">
            {projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: { id: number; title: string; topic: string; format: string; duration: number; style: string; tone: string; status: string; created_at: string }; index: number }) {
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(project.created_at));
  return (
    <Link href={`/projects/${project.id}`} data-testid={`card-project-${project.id}`} className="group animate-rise-in flex min-h-[240px] flex-col rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-md)]" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <span className="mono-font rounded-full bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-accent">{project.format}</span>
        <span className={`mono-font rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[.1em] ${project.status === 'completed' ? 'bg-primary/10 text-primary' : project.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{project.status}</span>
      </div>
      <h2 className="display-font mt-6 line-clamp-2 text-2xl font-bold leading-tight tracking-[-.04em] group-hover:text-primary">{project.title}</h2>
      <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{project.topic}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-7">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> {project.duration}s</span>
          <span className="capitalize">{project.style}</span>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-primary">{date}<ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function EmptyShelf() {
  return (
    <div className="mt-10 flex min-h-[390px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center" data-testid="status-projects-empty">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FolderOpen size={24} /></span>
      <h2 className="display-font mt-5 text-2xl font-bold tracking-[-.04em]">Your shelf is waiting.</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with the idea you keep replaying in your head. We will give it a shape you can film.</p>
      <Link href="/" data-testid="link-empty-create" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Plus size={15} /> Create first script</Link>
    </div>
  );
}

function ProjectsLoading() {
  return <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="status-projects-loading">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="rounded-2xl border border-card-border bg-card p-5"><div className="skeleton-bar h-5 w-20 rounded-full" /><div className="skeleton-bar mt-7 h-7 w-4/5 rounded" /><div className="skeleton-bar mt-3 h-4 w-full rounded" /><div className="skeleton-bar mt-2 h-4 w-2/3 rounded" /><div className="skeleton-bar mt-12 h-4 w-1/2 rounded" /></div>)}</div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="mt-10 flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 text-center" data-testid="status-projects-error"><AlertCircle size={24} className="text-destructive" /><h2 className="display-font mt-4 text-xl font-bold">The shelf is out of reach.</h2><p className="mt-2 text-sm text-muted-foreground">We could not load your saved projects.</p><button type="button" onClick={onRetry} data-testid="button-retry-projects" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold"><RefreshCw size={14} /> Try again</button></div>;
}
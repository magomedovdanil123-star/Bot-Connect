import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectQueryKey, getListProjectsQueryKey, useGetProject, useRegenerateProject } from '@workspace/api-client-react';
import { ScriptReader } from '@/components/script-reader';

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const projectQuery = useGetProject(id, { query: { enabled: Number.isFinite(id), queryKey: getGetProjectQueryKey(id) } });
  const regenerateProject = useRegenerateProject();
  const [currentProject, setCurrentProject] = useState(projectQuery.data);
  useEffect(() => { if (projectQuery.data) setCurrentProject(projectQuery.data); }, [projectQuery.data]);
  const regenerate = () => {
    if (!Number.isFinite(id)) return;
    regenerateProject.mutate({ id }, { onSuccess: (project) => { setCurrentProject(project); queryClient.setQueryData(getGetProjectQueryKey(id), project); queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); } });
  };
  if (!Number.isFinite(id) || projectQuery.isError) return <DetailError onRetry={() => projectQuery.refetch()} />;
  return (
    <div className="shell-grid min-h-[calc(100dvh-68px)]">
      <div className="mx-auto max-w-[1140px] px-5 py-8 md:px-10 md:py-12">
        <Link href="/projects" data-testid="link-back-projects" className="group inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"><ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" /> Back to shelf</Link>
        {projectQuery.isLoading && <DetailLoading />}
        {currentProject && !projectQuery.isLoading && (
          <div className="mt-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Saved production / {String(id).padStart(2, '0')}</p>
                <h1 data-testid="text-project-detail-title" className="display-font mt-3 text-4xl font-bold tracking-[-.06em] md:text-6xl">{currentProject.title}</h1>
                <p className="mt-3 text-sm text-muted-foreground">{currentProject.topic}</p>
              </div>
              <span className="mono-font rounded-full bg-primary/10 px-3 py-1.5 text-[10px] uppercase tracking-[.13em] text-primary">{currentProject.status}</span>
            </div>
            <ScriptReader project={currentProject} onRegenerate={regenerate} isRegenerating={regenerateProject.isPending} />
            {regenerateProject.isError && <div className="mt-4 flex items-center justify-end gap-2 text-xs text-destructive"><AlertCircle size={14} /> Could not regenerate. The last version is still here.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailLoading() {
  return <div className="mt-8 rounded-2xl border border-card-border bg-card p-8" data-testid="status-project-loading"><div className="skeleton-bar h-3 w-28 rounded" /><div className="skeleton-bar mt-5 h-12 max-w-xl rounded" /><div className="skeleton-bar mt-3 h-4 max-w-sm rounded" /><div className="mt-10 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton-bar h-24 w-full rounded-xl" />)}</div></div>;
}

function DetailError({ onRetry }: { onRetry: () => void }) {
  return <div className="shell-grid flex min-h-[calc(100dvh-68px)] items-center justify-center px-5"><div className="max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center" data-testid="status-project-detail-error"><AlertCircle size={25} className="mx-auto text-destructive" /><h1 className="display-font mt-4 text-2xl font-bold">This draft went missing.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">It may have moved, or the shelf needs another look.</p><div className="mt-6 flex justify-center gap-3"><Link href="/projects" data-testid="link-error-back" className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-xs font-bold">Back to shelf</Link><button type="button" onClick={onRetry} data-testid="button-retry-project" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><RefreshCw size={14} /> Try again</button></div></div></div>;
}
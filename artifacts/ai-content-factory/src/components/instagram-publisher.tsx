import { useEffect, useState } from "react";
import { ExternalLink, Instagram, Loader2, Trash2 } from "lucide-react";

type Props = { projectId?: number };
type InstagramAccount = {
  id: number;
  username: string | null;
  displayName: string | null;
  pageName: string | null;
  updatedAt: string;
};

export function InstagramPublisher({ projectId: _projectId }: Props) {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/instagram/accounts");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Не удалось загрузить аккаунты Instagram");
      }
      const payload = await response.json() as { accounts?: InstagramAccount[] };
      setAccounts(payload.accounts || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить аккаунты Instagram");
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  const connect = () => {
    setMessage(null);
    window.open("/api/instagram/connect", "instagram-oauth", "popup,width=620,height=760");
  };

  const remove = async (id: number) => {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/instagram/accounts/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось удалить аккаунт");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить аккаунт");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5" data-testid="instagram-connections">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-pink-500/10 p-2.5 text-pink-500"><Instagram size={20} /></div>
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-muted-foreground">Account connections</p>
            <h2 className="display-font mt-1 text-xl font-bold">Instagram Reels</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={connect}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
        >
          <ExternalLink size={14} /> {accounts.length ? "Добавить Instagram" : "Подключить Instagram"}
        </button>
      </div>

      {accounts.length ? (
        <div className="mt-5 grid gap-2 border-t border-border pt-4 md:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {account.username ? `@${account.username}` : account.displayName || "Instagram-аккаунт"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.pageName ? `Страница: ${account.pageName}` : "Профессиональный аккаунт"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(account.id)}
                disabled={busyId === account.id}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Удалить ${account.username || "Instagram-аккаунт"}`}
              >
                {busyId === account.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          Можно подключить несколько профессиональных Instagram-аккаунтов. Новое подключение не заменяет предыдущие.
        </p>
      )}
      {message && <p className="mt-3 text-xs text-destructive">{message}</p>}
    </section>
  );
}
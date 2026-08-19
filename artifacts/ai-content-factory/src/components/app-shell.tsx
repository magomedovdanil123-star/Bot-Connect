import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Clapperboard, FolderOpen, Menu, Plus, X } from 'lucide-react';

const navItems = [
  { href: '/', label: 'New script', icon: Plus },
  { href: '/projects', label: 'Project shelf', icon: FolderOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="texture min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground md:flex">
        <ShellBrand />
        <nav className="mt-10 flex flex-col gap-1 px-4" aria-label="Main navigation">
          <p className="mono-font mb-3 px-3 text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</p>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
              className={`group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-5 pb-6">
          <div className="border-t border-sidebar-border pt-5">
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-sidebar-foreground/40">Creator mode</p>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/55">One clear idea at a time. Make it worth watching.</p>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/25 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-[280px] bg-sidebar text-sidebar-foreground p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <ShellBrand />
              <button type="button" onClick={() => setMobileOpen(false)} data-testid="button-close-menu" className="rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent">
                <X size={18} />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-1" aria-label="Mobile navigation">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent'}`}>
                  <Icon size={17} />{label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-10">
          <button type="button" onClick={() => setMobileOpen(true)} data-testid="button-open-menu" className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden">
            <Menu size={20} />
          </button>
          <div className="mono-font ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Studio / 01
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function ShellBrand() {
  return (
    <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <Clapperboard size={19} strokeWidth={2.2} />
      </span>
      <span>
        <span className="display-font block text-[15px] font-bold tracking-tight">Content Factory</span>
        <span className="mono-font block text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/40">AI story studio</span>
      </span>
    </Link>
  );
}
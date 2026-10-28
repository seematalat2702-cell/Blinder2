import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BarChart3, Boxes, BriefcaseBusiness, ChevronRight, CirclePlus, FileBarChart2, Menu, ShoppingCart, Wrench, X } from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/sales", label: "Sales", icon: BriefcaseBusiness },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/master-data", label: "Master data", icon: Boxes },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
];

export function AppShell({
  children,
  onAddSale,
  onAddPurchase,
}: {
  children: ReactNode;
  onAddSale: () => void;
  onAddPurchase: () => void;
}) {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const current = nav.find((n) => n.href === path);
  return <div className="app-shell">
    {open && <button aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/30 md:hidden" />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="mb-10 flex items-center gap-3 px-1">
        <div className="brand-symbol"><Wrench size={20} strokeWidth={2.5} /></div>
        <div><div className="brand-mark">JHARKHAND<br />ENTERPRISES</div><div className="mt-1 text-[9px] font-semibold tracking-[.18em] text-[#8d9097]">WHOLESALE TOOLS</div></div>
      </div>
      <div className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[#727680]">Workspace</div>
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link ${path === href ? "active" : ""}`} data-testid={`link-${label.toLowerCase().replaceAll(" ", "-")}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{path === href && <ChevronRight className="ml-auto" size={14} />}</Link>)}
      </nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-[#f1c94b]"><Activity size={15} /><span className="text-[10px] font-bold uppercase tracking-[.12em]">Live operations</span></div>
        <p className="text-[11px] leading-5 text-[#a7a9ae]">Every invoice, purchase and margin in one clear view.</p>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-[#9fa2a8]"><span className="h-1.5 w-1.5 rounded-full bg-[#58c18b]" /> Connected to business records</div>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-white/10 px-1 pt-4">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#30343d] text-xs font-bold text-[#f5cf54]">JE</div><div><div className="text-xs font-semibold">Enterprise workspace</div><div className="mt-0.5 text-[10px] text-[#8c9098]">Distributor account</div></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="flex items-center gap-3">
          <button className="mobile-menu icon-button" aria-label="Open navigation" data-testid="button-open-navigation" onClick={() => setOpen(true)}><Menu size={17} /></button>
          <div><div className="eyebrow">Jharkhand Enterprises</div><div className="mt-1 flex items-center gap-1 text-[13px] font-bold text-[#252831]">{current?.label || "Workspace"}<ChevronRight size={13} className="text-[#afb0b1]" /></div></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-[#898a8d] sm:block">Business workspace</span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#e5deca] bg-[#fffdf6] text-[10px] font-bold text-[#927317]">JE</span>
        </div>
      </header>
      {children}
    </main>
    <div className="no-print fixed bottom-5 right-5 z-30 flex flex-col items-end sm:bottom-7 sm:right-7">
      {quickOpen && <div className="mb-2 flex flex-col items-end gap-2">
        <button
          className="button-secondary h-10 bg-white shadow-lg"
          onClick={() => { setQuickOpen(false); onAddSale(); }}
          data-testid="button-quick-add-sale"
        >
          <CirclePlus size={15} /> Add Sale
        </button>
        <button
          className="button-secondary h-10 bg-white shadow-lg"
          onClick={() => { setQuickOpen(false); onAddPurchase(); }}
          data-testid="button-quick-add-purchase"
        >
          <CirclePlus size={15} /> Add Purchase
        </button>
      </div>}
      <button
        className="button-primary h-11 shadow-lg"
        onClick={() => setQuickOpen((value) => !value)}
        aria-expanded={quickOpen}
        aria-label={quickOpen ? "Close quick add menu" : "Open quick add menu"}
        data-testid="button-quick-add"
      >
        {quickOpen ? <X size={15} /> : <CirclePlus size={15} />}
        {quickOpen ? "Close" : "Add entry"}
      </button>
    </div>
  </div>;
}

export function PageHeading({ kicker, title, description, actions }: { kicker: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><div className="eyebrow mb-2">{kicker}</div><h1 className="font-[var(--app-font-serif)] text-[30px] font-extrabold leading-tight tracking-[-.045em] text-[#20232a] sm:text-[34px]">{title}</h1><p className="mt-2 max-w-xl text-[13px] leading-5 text-[#85878c]">{description}</p></div>
    {actions}
  </div>;
}

export function Modal({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog-card">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#eee9de] pb-4"><div><h2 className="font-[var(--app-font-serif)] text-xl font-extrabold tracking-[-.03em]">{title}</h2>{subtitle && <p className="mt-1 text-xs text-[#898a8d]">{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16} /></button></div>
      {children}{footer && <div className="mt-6 flex justify-end gap-2 border-t border-[#eee9de] pt-4">{footer}</div>}
    </section>
  </div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 3000); return () => window.clearTimeout(t); }, [onDone]);
  return <div role="status" className="toast-note">{message}</div>;
}

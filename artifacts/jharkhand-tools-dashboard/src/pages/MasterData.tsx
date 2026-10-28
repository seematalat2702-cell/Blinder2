import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMasterDataQueryKey, getListSalesQueryKey, getListPurchasesQueryKey, getGetDashboardQueryKey, useCreateMasterData, useDeleteMasterData, useListMasterData, useUpdateMasterData } from "@workspace/api-client-react";
import type { MasterInput, MasterRecord } from "@workspace/api-client-react";
import { Building2, CirclePlus, Download, Package, Pencil, Search, Store, Truck, Trash2, Users } from "lucide-react";
import { EmptyState, LoadingLines, downloadExcel, localDate, money } from "../lib/utils";
import { Modal, PageHeading, Toast } from "../components/AppShell";

const groups = [
  { type: "companies", label: "Companies", icon: Building2, description: "Brands and manufacturers in your catalogue." },
  { type: "products", label: "Products", icon: Package, description: "Tools and stock items across your portfolio." },
  { type: "customers", label: "Customers / dealers", icon: Users, description: "Retail partners and wholesale customers." },
  { type: "suppliers", label: "Suppliers", icon: Truck, description: "Partners supplying stock to your business." },
] as const;
type MasterType = (typeof groups)[number]["type"];
const classField = "field";
const singular = (kind: MasterType) => kind === "companies" ? "company" : kind === "products" ? "product" : kind === "customers" ? "customer / dealer" : "supplier";
function EditForm({ kind, row, companies, onSubmit, busy, onClose }: { kind: MasterType; row?: MasterRecord; companies: MasterRecord[]; onSubmit: (value: MasterInput) => void; busy: boolean; onClose: () => void }) {
  return <Modal title={`${row ? "Edit" : "Add"} ${singular(kind)}`} subtitle="Maintain business records used throughout your ledgers." onClose={onClose} footer={<><button className="button-secondary" onClick={onClose}>Cancel</button><button form="master-form" className="button-primary" disabled={busy} data-testid="button-save-master">{busy ? "Saving…" : row ? "Save changes" : "Add record"}</button></>}>
    <form id="master-form" onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget); const raw: MasterInput = { name: String(f.get("name") || "").trim() };
      if (kind === "products") { raw.category = String(f.get("category") || "") || undefined; raw.companyId = Number(f.get("companyId")) || undefined; raw.purchasePrice = Number(f.get("purchasePrice")) || 0; raw.sellingPrice = Number(f.get("sellingPrice")) || 0; }
      if (kind === "companies") { raw.contact = String(f.get("contact") || "") || undefined; }
      if (kind === "customers" || kind === "suppliers") { raw.phone = String(f.get("phone") || "") || undefined; raw.area = String(f.get("area") || "") || undefined; raw.contact = String(f.get("contact") || "") || undefined; }
      onSubmit(raw);
    }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="label">Name</span><input className={classField} name="name" defaultValue={row?.name || ""} placeholder={kind === "products" ? "e.g. 18V impact driver" : "Business or record name"} required /></label>
        {kind === "companies" && <label className="block sm:col-span-2"><span className="label">Contact</span><input className={classField} name="contact" defaultValue={row?.contact || ""} placeholder="Sales desk or contact details" /></label>}
        {kind === "products" && <>
          <label className="block"><span className="label">Category</span><input className={classField} name="category" defaultValue={row?.category || ""} placeholder="Power tools" required /></label>
          <label className="block"><span className="label">Company / brand</span><select className={classField} name="companyId" defaultValue={row?.companyId || ""} required><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block"><span className="label">Purchase price (₹)</span><input type="number" min="0" step=".01" className={classField} name="purchasePrice" defaultValue={row?.purchasePrice ?? 0} required /></label>
          <label className="block"><span className="label">Selling price (₹)</span><input type="number" min="0" step=".01" className={classField} name="sellingPrice" defaultValue={row?.sellingPrice ?? 0} required /></label>
        </>}
        {(kind === "customers" || kind === "suppliers") && <>
          <label className="block"><span className="label">Phone</span><input className={classField} name="phone" defaultValue={row?.phone || ""} placeholder="+91" /></label>
          <label className="block"><span className="label">Area / location</span><input className={classField} name="area" defaultValue={row?.area || ""} placeholder="City or territory" /></label>
          <label className="block sm:col-span-2"><span className="label">Contact person</span><input className={classField} name="contact" defaultValue={row?.contact || ""} placeholder="Primary contact name" /></label>
        </>}
      </div>
    </form>
  </Modal>;
}

export default function MasterData() {
  const [kind, setKind] = useState<MasterType>("companies");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MasterRecord>();
  const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState("");
  const companies = useListMasterData("companies");
  const products = useListMasterData("products");
  const customers = useListMasterData("customers");
  const suppliers = useListMasterData("suppliers");
  const create = useCreateMasterData();
  const update = useUpdateMasterData();
  const removeMutation = useDeleteMasterData();
  const client = useQueryClient();
  const queries = { companies, products, customers, suppliers };
  const active = queries[kind];
  const records = active.data || [];
  const filtered = useMemo(() => records.filter((r) => `${r.name} ${r.category || ""} ${r.companyName || ""} ${r.contact || ""} ${r.area || ""}`.toLowerCase().includes(search.toLowerCase())), [records, search]);
  const busy = create.isPending || update.isPending;
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: getListMasterDataQueryKey(kind) }),
    client.invalidateQueries({ queryKey: getListMasterDataQueryKey("companies") }),
    client.invalidateQueries({ queryKey: getListMasterDataQueryKey("products") }),
    client.invalidateQueries({ queryKey: getListMasterDataQueryKey("customers") }),
    client.invalidateQueries({ queryKey: getListMasterDataQueryKey("suppliers") }),
    client.invalidateQueries({ queryKey: getListSalesQueryKey() }),
    client.invalidateQueries({ queryKey: getListPurchasesQueryKey() }),
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
  ]);
  const close = () => { setDialog(false); setEditing(undefined); };
  const submit = (value: MasterInput) => {
    if (!value.name) { setMessage("A name is required."); return; }
    const opts = { onSuccess: () => { void invalidate(); close(); setMessage(editing ? "Record updated." : "Record added."); }, onError: () => setMessage("Could not save this record. Please try again.") };
    if (editing) update.mutate({ type: kind, id: editing.id, data: value }, opts);
    else create.mutate({ type: kind, data: value }, opts);
  };
  const remove = (row: MasterRecord) => {
    if (!window.confirm(`Delete ${row.name}? This action cannot be undone.`)) return;
    removeMutation.mutate({ type: kind, id: row.id }, { onSuccess: () => { void invalidate(); setMessage("Record deleted."); }, onError: () => setMessage("This record could not be deleted.") });
  };
  const current = groups.find((g) => g.type === kind)!;
  const Icon = current.icon;
  return <div className="page-content">
    <PageHeading kicker="Business records · Reference data" title="Master data" description="One dependable catalogue for the companies, products and partners behind every transaction." actions={<div className="flex gap-2"><button className="button-secondary" onClick={() => downloadExcel(`${kind}.xlsx`, filtered.map((r) => ({ name: r.name, category: r.category, company: r.companyName, purchasePrice: r.purchasePrice, sellingPrice: r.sellingPrice, phone: r.phone, area: r.area, contact: r.contact, createdAt: r.createdAt })), kind)} disabled={!filtered.length}><Download size={14} /> Export list</button><button className="button-primary" onClick={() => { setEditing(undefined); setDialog(true); }} data-testid="button-add-master"><CirclePlus size={15} /> Add {singular(kind)}</button></div>} />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[245px_1fr]">
      <aside className="panel h-fit p-3">
        <div className="eyebrow px-3 py-2">Record types</div>
        <div className="space-y-1">{groups.map((g) => { const GIcon = g.icon; const selected = g.type === kind; return <button key={g.type} onClick={() => { setKind(g.type); setSearch(""); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-[#f8f1dc] text-[#3f361d]" : "text-[#717379] hover:bg-[#f8f7f2]"}`} data-testid={`tab-master-${g.type}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${selected ? "bg-[#f1d46f] text-[#5d4910]" : "bg-[#f1f0eb] text-[#787b81]"}`}><GIcon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{g.label}</span><span className="mt-1 block text-[9px] text-[#96979a]">{queries[g.type].data?.length ?? "—"} records</span></span></button>; })}</div>
        <div className="mt-5 rounded-xl bg-[#f7f5ef] p-3"><div className="flex items-center gap-2 text-[10px] font-bold text-[#6f6240]"><Store size={13} /> Shared reference</div><p className="mt-2 text-[10px] leading-4 text-[#898a8e]">Product, company and partner details appear in the sales and purchase forms.</p></div>
      </aside>
      <section className="panel min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7f0d9] text-[#9a7717]"><Icon size={18} /></div><div><h2 className="section-title">{current.label}</h2><p className="mt-1 text-[10px] text-[#92949a]">{current.description}</p></div></div>
          <div className="relative min-w-[190px] flex-1 sm:max-w-[260px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#96979a]" /><input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${current.label.toLowerCase()}…`} data-testid="input-search-master" /></div>
        </div>
        {active.isError && <div className="mb-4 rounded-lg bg-[#fff1ef] p-3 text-xs text-[#a35248]">Could not load {current.label.toLowerCase()}. <button className="underline" onClick={() => void active.refetch()}>Retry</button></div>}
        {active.isLoading || active.isFetching ? <LoadingLines count={6} /> : filtered.length === 0 ? <EmptyState title={search ? "No records found" : `No ${current.label.toLowerCase()} yet`} detail={search ? "Try a shorter name, company or location." : "Add your first record to build out the business catalogue."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th>{kind === "products" && <><th>Company</th><th>Category</th><th>Purchase</th><th>Selling</th></>}{(kind === "customers" || kind === "suppliers") && <><th>Contact</th><th>Phone</th><th>Area</th></>}<th>Created</th><th className="no-print">Actions</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id} data-testid={`row-master-${kind}-${r.id}`}><td><div className="font-semibold text-[#292c32]">{r.name}</div><div className="mt-1 font-mono text-[9px] text-[#9b9b9e]">JE-{kind.slice(0, 2).toUpperCase()}-{String(r.id).padStart(4, "0")}</div></td>{kind === "products" && <><td>{r.companyName || companies.data?.find((c) => c.id === r.companyId)?.name || "—"}</td><td><span className="rounded-full bg-[#f3f1eb] px-2 py-1 text-[10px] text-[#707278]">{r.category || "Uncategorised"}</span></td><td>{money(r.purchasePrice)}</td><td>{money(r.sellingPrice)}</td></>}{(kind === "customers" || kind === "suppliers") && <><td>{r.contact || "—"}</td><td>{r.phone || "—"}</td><td>{r.area || "—"}</td></>}<td className="text-[#85878c]">{localDate(r.createdAt, "dd MMM yyyy")}</td><td className="no-print"><div className="flex gap-1"><button className="icon-button h-8 w-8" aria-label={`Edit ${r.name}`} data-testid={`button-edit-master-${r.id}`} onClick={() => { setEditing(r); setDialog(true); }}><Pencil size={13} /></button><button className="icon-button h-8 w-8 hover:!border-[#ecc8c4] hover:!bg-[#fff2f0] hover:!text-[#b14f43]" aria-label={`Delete ${r.name}`} data-testid={`button-delete-master-${r.id}`} onClick={() => remove(r)}><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    {dialog && <EditForm kind={kind} row={editing} companies={companies.data || []} onSubmit={submit} busy={busy} onClose={close} />}
    {message && <Toast message={message} onDone={() => setMessage("")} />}
  </div>;
}

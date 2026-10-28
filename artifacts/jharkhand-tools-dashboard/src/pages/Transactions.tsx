import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateSale, useUpdateSale, useDeleteSale, useListSales, getListSalesQueryKey, useCreatePurchase, useUpdatePurchase, useDeletePurchase, useListPurchases, getListPurchasesQueryKey, useListMasterData, getListMasterDataQueryKey, getGetDashboardQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import type { MasterRecord, Sale, Purchase, SaleInput, PurchaseInput, MasterInput } from "@workspace/api-client-react";
import { ArrowDownToLine, CalendarDays, CirclePlus, FileDown, Pencil, Search, Trash2 } from "lucide-react";
import { EmptyState, LoadingLines, Status, downloadExcel, isoDate, localDate, money } from "../lib/utils";
import { Modal, PageHeading, Toast } from "../components/AppShell";

type Entry = Sale | Purchase;
type Props = {
  kind: "sales" | "purchases";
  addRequest?: boolean;
  onAddHandled?: () => void;
};

const fieldClass = "field";
const selectClass = "field";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function transactionValues(kind: Props["kind"], row?: Entry) {
  if (kind === "sales" && row) {
    const sale = row as Sale;
    return { date: sale.date.slice(0, 10), invoice: sale.invoice, customerId: String(sale.customerId), productId: String(sale.productId), companyId: String(sale.companyId), quantity: String(sale.quantity), purchaseRate: String(sale.purchaseRate), sellingRate: String(sale.sellingRate), paymentStatus: sale.paymentStatus };
  }
  if (kind === "purchases" && row) {
    const p = row as Purchase;
    return { date: p.date.slice(0, 10), invoice: p.invoice, supplierId: String(p.supplierId), productId: String(p.productId), companyId: String(p.companyId), quantity: String(p.quantity), purchaseRate: String(p.purchaseRate), paymentStatus: p.paymentStatus };
  }
  return kind === "sales"
    ? { date: isoDate(), invoice: "", customerId: "", productId: "", companyId: "", quantity: "1", purchaseRate: "", sellingRate: "", paymentStatus: "received" as const }
    : { date: isoDate(), invoice: "", supplierId: "", productId: "", companyId: "", quantity: "1", purchaseRate: "", paymentStatus: "received" as const };
}

export default function Transactions({ kind, addRequest = false, onAddHandled }: Props) {
  const salesView = kind === "sales";
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Entry | undefined>();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!addRequest) return;
    setEditing(undefined);
    setDialog(true);
    onAddHandled?.();
  }, [addRequest, onAddHandled]);
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(status ? { paymentStatus: status as "pending" | "received" } : {}) }), [search, from, to, status]);
  const sales = useListSales(params, { query: { enabled: salesView, queryKey: getListSalesQueryKey(params) } });
  const purchases = useListPurchases(params, { query: { enabled: !salesView, queryKey: getListPurchasesQueryKey(params) } });
  const companies = useListMasterData("companies");
  const products = useListMasterData("products");
  const customers = useListMasterData("customers", { query: { enabled: salesView, queryKey: getListMasterDataQueryKey("customers") } });
  const suppliers = useListMasterData("suppliers", { query: { enabled: !salesView, queryKey: getListMasterDataQueryKey("suppliers") } });
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const deletePurchase = useDeletePurchase();
  const qc = useQueryClient();
  const query = salesView ? sales : purchases;
  const rows = (query.data || []) as Entry[];
  const isLoading = query.isLoading || query.isFetching;
  const mastersLoading = companies.isLoading || products.isLoading || (salesView ? customers.isLoading : suppliers.isLoading);
  const mutationsPending = createSale.isPending || updateSale.isPending || deleteSale.isPending || createPurchase.isPending || updatePurchase.isPending || deletePurchase.isPending;
  const maxPage = Math.max(0, Math.ceil(rows.length / 10) - 1);
  const shown = rows.slice(page * 10, page * 10 + 10);
  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: salesView ? getListSalesQueryKey() : getListPurchasesQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() }),
  ]);
  const openDialog = (row?: Entry) => { setEditing(row); setDialog(true); };
  const notify = (text: string) => setMessage(text);

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const common = {
      date: String(fd.get("date") || isoDate()),
      invoice: String(fd.get("invoice") || "").trim(),
      productId: Number(fd.get("productId")),
      companyId: Number(fd.get("companyId")),
      quantity: Number(fd.get("quantity")),
      purchaseRate: Number(fd.get("purchaseRate")),
      paymentStatus: String(fd.get("paymentStatus") || "received") as "received" | "pending",
    };
    if (salesView) {
      const payload: SaleInput = { ...common, customerId: Number(fd.get("partyId")), sellingRate: Number(fd.get("sellingRate")) };
      if (!payload.customerId || !payload.productId || !payload.companyId || !payload.invoice || payload.quantity < 1) { notify("Complete all required fields before saving."); return; }
      const options = { onSuccess: () => { void invalidate(); setDialog(false); notify(editing ? "Sale updated." : "Sale recorded."); }, onError: () => notify("Could not save the sale. Please try again.") };
      if (editing) updateSale.mutate({ id: editing.id, data: payload }, options);
      else createSale.mutate({ data: payload }, options);
    } else {
      const payload: PurchaseInput = { ...common, supplierId: Number(fd.get("partyId")) };
      if (!payload.supplierId || !payload.productId || !payload.companyId || !payload.invoice || payload.quantity < 1) { notify("Complete all required fields before saving."); return; }
      const options = { onSuccess: () => { void invalidate(); setDialog(false); notify(editing ? "Purchase updated." : "Purchase recorded."); }, onError: () => notify("Could not save the purchase. Please try again.") };
      if (editing) updatePurchase.mutate({ id: editing.id, data: payload }, options);
      else createPurchase.mutate({ data: payload }, options);
    }
  };

  const remove = (row: Entry) => {
    if (!window.confirm(`Delete invoice ${row.invoice}? This cannot be undone.`)) return;
    if (salesView) deleteSale.mutate({ id: row.id }, { onSuccess: () => { void invalidate(); notify("Sale deleted."); }, onError: () => notify("Sale could not be deleted.") });
    else deletePurchase.mutate({ id: row.id }, { onSuccess: () => { void invalidate(); notify("Purchase deleted."); }, onError: () => notify("Purchase could not be deleted.") });
  };

  return <div className="page-content">
    <PageHeading kicker={`Operations · ${salesView ? "Revenue" : "Stock intake"}`} title={salesView ? "Sales ledger" : "Purchase ledger"} description={salesView ? "Search, reconcile and maintain every customer sale." : "Track stock intake, supplier payments and purchase cost."} actions={<div className="flex gap-2"><button className="button-secondary" onClick={() => downloadExcel(`${kind}.xlsx`, rows.map((r) => ({ date: r.date, invoice: r.invoice, party: salesView ? (r as Sale).customerName : (r as Purchase).supplierName, product: r.productName, company: r.companyName, quantity: r.quantity, rate: r.purchaseRate, amount: r.totalAmount, profit: salesView ? (r as Sale).profit : undefined, profitPercent: salesView ? (r as Sale).profitPercent : undefined, status: r.paymentStatus })), kind === "sales" ? "Sales" : "Purchases")} disabled={!rows.length}><ArrowDownToLine size={14} /> Excel</button><button className="button-primary" onClick={() => openDialog()} data-testid={`button-add-${salesView ? "sale" : "purchase"}`}><CirclePlus size={15} /> Add {salesView ? "sale" : "purchase"}</button></div>} />
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[210px] flex-1"><label className="label">Find a transaction</label><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#96979a]" /><input className={`${fieldClass} pl-9`} placeholder="Invoice, product, customer..." value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} data-testid={`input-search-${kind}`} /></div></div>
        <div><label className="label">From date</label><input type="date" className={selectClass} value={from} onChange={(e) => {setFrom(e.target.value);setPage(0);}} data-testid="filter-from-date" /></div>
        <div><label className="label">To date</label><input type="date" className={selectClass} value={to} onChange={(e) => {setTo(e.target.value);setPage(0);}} data-testid="filter-to-date" /></div>
        <div><label className="label">Payment</label><select className={selectClass} value={status} onChange={(e) => {setStatus(e.target.value);setPage(0);}} data-testid="filter-payment-status"><option value="">All statuses</option><option value="received">Received</option><option value="pending">Pending</option></select></div>
        <button className="button-secondary h-10" onClick={() => window.print()}><FileDown size={14} /> PDF</button>
      </div>
      {query.isError && <div className="mb-4 flex items-center justify-between rounded-lg bg-[#fff1ef] p-3 text-xs text-[#a35248]">Unable to load ledger records.<button className="underline" onClick={() => void query.refetch()}>Retry</button></div>}
      {isLoading ? <LoadingLines count={7} /> : rows.length === 0 ? <EmptyState title={search || status || from || to ? "No matching transactions" : `No ${kind} recorded yet`} detail={search || status || from || to ? "Adjust your filters and search again." : `Add your first ${salesView ? "sale" : "purchase"} to begin the ledger.`} /> : <>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Date / invoice</th><th>{salesView ? "Customer" : "Supplier"}</th><th>Product / company</th><th>Qty</th><th>{salesView ? "Purchase rate" : "Unit cost"}</th>{salesView && <th>Selling rate</th>}<th>Total amount</th>{salesView && <th>Gross profit</th>}<th>Payment</th><th className="no-print">Actions</th></tr></thead><tbody>
          {shown.map((row) => <tr key={row.id} data-testid={`row-${kind}-${row.id}`}><td><div className="font-semibold text-[#292c32]">{localDate(row.date, "dd MMM yyyy")}</div><div className="mt-1 font-mono text-[9px] text-[#96979a]">{row.invoice}</div></td><td>{salesView ? (row as Sale).customerName : (row as Purchase).supplierName}</td><td><div className="font-semibold">{row.productName}</div><div className="mt-1 text-[10px] text-[#92949a]">{row.companyName}</div></td><td>{row.quantity}</td><td>{money(row.purchaseRate)}</td>{salesView && <td>{money((row as Sale).sellingRate)}</td>}<td className="font-bold">{money(row.totalAmount)}</td>{salesView && <td className="font-semibold text-[#27724b]">{money((row as Sale).profit)} <span className="text-[9px] font-normal text-[#85878c]">({(row as Sale).profitPercent.toFixed(1)}%)</span></td>}<td><Status value={row.paymentStatus} /></td><td className="no-print"><div className="flex gap-1"><button className="icon-button h-8 w-8" aria-label={`Edit ${row.invoice}`} onClick={() => openDialog(row)} data-testid={`button-edit-${kind}-${row.id}`}><Pencil size={13} /></button><button className="icon-button h-8 w-8 hover:!border-[#ecc8c4] hover:!bg-[#fff2f0] hover:!text-[#b14f43]" aria-label={`Delete ${row.invoice}`} onClick={() => remove(row)} data-testid={`button-delete-${kind}-${row.id}`}><Trash2 size={13} /></button></div></td></tr>)}
        </tbody></table></div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-[#85878c]"><span>Showing {page * 10 + 1}–{Math.min((page + 1) * 10, rows.length)} of {rows.length} entries</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="button-secondary disabled:opacity-40">Previous</button><button disabled={page >= maxPage} onClick={() => setPage(page + 1)} className="button-secondary disabled:opacity-40">Next</button></div></div>
      </>}
    </section>
    {dialog && <TransactionDialog kind={kind} row={editing} loading={mastersLoading} companies={companies.data || []} products={products.data || []} parties={salesView ? customers.data || [] : suppliers.data || []} busy={mutationsPending} onClose={() => setDialog(false)} onSubmit={submit} />}
    {message && <Toast message={message} onDone={() => setMessage("")} />}
  </div>;
}

function TransactionDialog({ kind, row, loading, companies, products, parties, busy, onClose, onSubmit }: { kind: Props["kind"]; row?: Entry; loading: boolean; companies: MasterRecord[]; products: MasterRecord[]; parties: MasterRecord[]; busy: boolean; onClose: () => void; onSubmit: (form: HTMLFormElement) => void }) {
  const salesView = kind === "sales";
  const initial = transactionValues(kind, row);
  const [purchaseRate, setPurchaseRate] = useState(initial.purchaseRate);
  const [sellingRate, setSellingRate] = useState(salesView ? initial.sellingRate : "");
  const [quantity, setQuantity] = useState(initial.quantity);
  const [selectedProduct, setSelectedProduct] = useState(initial.productId);
  const [selectedCompany, setSelectedCompany] = useState(initial.companyId);
  const product = products.find((p) => String(p.id) === selectedProduct);
  const inferredCompany = product?.companyId ? String(product.companyId) : "";
  const cost = Number(purchaseRate) || 0;
  const sell = Number(sellingRate) || 0;
  const qty = Number(quantity) || 0;
  const profit = (sell - cost) * qty;
  const profitPercent = sell * qty > 0 ? (profit / (sell * qty)) * 100 : 0;
  return <Modal title={`${row ? "Edit" : "New"} ${salesView ? "sale" : "purchase"}`} subtitle="Transaction details are saved to the business ledger." onClose={onClose} footer={<><button className="button-secondary" onClick={onClose}>Cancel</button><button form="transaction-form" className="button-primary" disabled={busy || loading} data-testid="button-save-transaction">{busy ? "Saving…" : row ? "Save changes" : `Record ${salesView ? "sale" : "purchase"}`}</button></>}>
    {loading ? <LoadingLines count={4} /> : <form id="transaction-form" onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget); }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Transaction date"><input className={fieldClass} type="date" name="date" defaultValue={initial.date} required /></Field>
        <Field label="Invoice number"><input className={fieldClass} name="invoice" defaultValue={initial.invoice} placeholder="e.g. JE-INV-204" required /></Field>
        <Field label={salesView ? "Customer / dealer" : "Supplier"}><select className={fieldClass} name="partyId" defaultValue={"partyId" in initial ? String(initial.partyId ?? "") : ""} required><option value="">Select {salesView ? "customer" : "supplier"}</option>{parties.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Company / brand"><select className={fieldClass} name="companyId" value={selectedCompany || inferredCompany} onChange={(e) => setSelectedCompany(e.target.value)} required><option value="">Select company</option>{companies.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Product"><select className={fieldClass} name="productId" value={selectedProduct} onChange={(e) => { const value = e.target.value; setSelectedProduct(value); const p = products.find((x) => String(x.id) === value); if (p?.purchasePrice != null) setPurchaseRate(String(p.purchasePrice)); if (p?.sellingPrice != null) setSellingRate(String(p.sellingPrice)); if (p?.companyId) setSelectedCompany(String(p.companyId)); }} required><option value="">Select product</option>{products.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Quantity"><input className={fieldClass} type="number" min="1" name="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></Field>
        <Field label={salesView ? "Purchase rate / unit" : "Purchase rate / unit"}><input className={fieldClass} type="number" min="0" step="0.01" name="purchaseRate" value={purchaseRate} onChange={(e) => setPurchaseRate(e.target.value)} required /></Field>
        {salesView && <Field label="Selling rate / unit"><input className={fieldClass} type="number" min="0" step="0.01" name="sellingRate" value={sellingRate} onChange={(e) => setSellingRate(e.target.value)} required /></Field>}
        <Field label="Payment status"><select className={fieldClass} name="paymentStatus" defaultValue={initial.paymentStatus}><option value="received">Received</option><option value="pending">Pending</option></select></Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#eee5ce] bg-[#fcf8eb] p-4">
        <div><div className="eyebrow">Total amount</div><div className="mt-1 font-[var(--app-font-serif)] text-xl font-extrabold">{money((salesView ? sell : cost) * qty)}</div></div>
        {salesView ? <div><div className="eyebrow">Auto-calculated profit</div><div className={`mt-1 font-[var(--app-font-serif)] text-xl font-extrabold ${profit >= 0 ? "text-[#278459]" : "text-[#b24942]"}`}>{money(profit)} <span className="text-xs">({profitPercent.toFixed(1)}%)</span></div></div> : <div><div className="eyebrow">Stock value</div><div className="mt-1 font-[var(--app-font-serif)] text-xl font-extrabold text-[#7359b3]">{money(cost * qty)}</div></div>}
      </div>
      <p className="mt-3 flex items-center gap-1 text-[10px] text-[#95969a]"><CalendarDays size={11} /> Sales profit and margin are calculated from unit rates and quantity.</p>
    </form>}
  </Modal>;
}

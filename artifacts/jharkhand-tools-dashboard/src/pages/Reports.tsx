import { useMemo, useState } from "react";
import { useGetDashboard, useListPurchases, useListSales } from "@workspace/api-client-react";
import { CalendarRange, Download, FileDown, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { EmptyState, LoadingLines, downloadCsv, downloadExcel, isoDate, localDate, money } from "../lib/utils";
import { PageHeading, Toast } from "../components/AppShell";

const periods = ["daily", "weekly", "monthly", "yearly"] as const;
type Period = (typeof periods)[number];
function boundaries(period: Period, pivot: string) {
  const [year, month, day] = pivot.split("-").map(Number);
  const end = new Date(year, month - 1, day);
  let start: Date;
  if (period === "daily") start = new Date(year, month - 1, day);
  else if (period === "weekly") { start = new Date(year, month - 1, day); const weekday = (start.getDay() + 6) % 7; start.setDate(start.getDate() - weekday); end.setDate(start.getDate() + 6); }
  else if (period === "monthly") { start = new Date(year, month - 1, 1); end.setMonth(end.getMonth() + 1, 0); }
  else { start = new Date(year, 0, 1); end.setMonth(11, 31); }
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: toIso(start), to: toIso(end) };
}
export default function Reports() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [pivot, setPivot] = useState(isoDate());
  const [message, setMessage] = useState("");
  const dates = useMemo(() => boundaries(period, pivot), [period, pivot]);
  const params = useMemo(() => ({ period: "custom" as const, from: dates.from, to: dates.to, granularity: period }), [dates, period]);
  const dashboard = useGetDashboard(params);
  const sales = useListSales({ from: dates.from, to: dates.to });
  const purchases = useListPurchases({ from: dates.from, to: dates.to });
  const loading = dashboard.isLoading || dashboard.isFetching || sales.isLoading || sales.isFetching || purchases.isLoading || purchases.isFetching;
  const combined = useMemo(() => [
    ...(sales.data || []).map((s) => ({ type: "Sale", date: s.date, invoice: s.invoice, party: s.customerName, product: s.productName, company: s.companyName, quantity: s.quantity, rate: s.sellingRate, total: s.totalAmount, profit: s.profit, status: s.paymentStatus })),
    ...(purchases.data || []).map((p) => ({ type: "Purchase", date: p.date, invoice: p.invoice, party: p.supplierName, product: p.productName, company: p.companyName, quantity: p.quantity, rate: p.purchaseRate, total: p.totalAmount, profit: 0, status: p.paymentStatus })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [sales.data, purchases.data]);
  const exportReport = () => {
    const reportRows = [
      { section: "Summary", metric: "Total sales", amount: dashboard.data?.totalSales || 0 },
      { section: "Summary", metric: "Total purchases", amount: dashboard.data?.totalPurchases || 0 },
      { section: "Summary", metric: "Gross profit", amount: dashboard.data?.grossProfit || 0 },
      { section: "Summary", metric: "Profit margin", amount: `${dashboard.data?.profitMargin || 0}%` },
      { section: "Summary", metric: "Transactions", amount: dashboard.data?.transactionCount || 0 },
      ...combined.map((r) => ({ section: r.type, metric: `${r.invoice} · ${r.party} · ${r.product}`, amount: r.total })),
    ];
    downloadExcel(`jharkhand-${period}-report-${dates.from}-to-${dates.to}.xlsx`, reportRows, "Business Report");
    setMessage("Excel report downloaded.");
  };
  const error = dashboard.isError || sales.isError || purchases.isError;
  return <div className="page-content">
    <PageHeading kicker="Insights · Exports" title="Reports that travel well." description="Build a clean period snapshot for your accounts, partners or internal review." actions={<div className="flex gap-2"><button className="button-secondary" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button><button className="button-primary" onClick={exportReport} disabled={loading || !dashboard.data}><FileSpreadsheet size={15} /> Export report</button></div>} />
    <section className="panel mb-5 p-5">
      <div className="mb-4 flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f8f0d9] text-[#957318]"><CalendarRange size={17} /></div><div><h2 className="section-title">Reporting window</h2><p className="mt-1 text-[10px] text-[#8e9094]">Choose the cadence and an anchor date for the report.</p></div></div>
      <div className="flex flex-wrap items-end gap-4">
        <div><div className="label">Report cadence</div><div className="flex flex-wrap gap-1.5">{periods.map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-2 text-[11px] font-semibold capitalize ${period === p ? "bg-[#20232a] text-[#f3ca48]" : "bg-[#f7f5ef] text-[#696a6d] hover:bg-[#f3ebd5]"}`} data-testid={`report-period-${p}`}>{p}</button>)}</div></div>
        <div><label className="label">{period === "yearly" ? "Year" : "Anchor date"}</label><input type={period === "yearly" ? "number" : "date"} className="field w-[190px]" value={period === "yearly" ? pivot.slice(0, 4) : pivot} min="2000" max="2100" onChange={(e) => setPivot(period === "yearly" ? `${e.target.value || new Date().getFullYear()}-01-01` : e.target.value)} data-testid="input-report-date" /></div>
        <div className="rounded-lg border border-[#eee8d9] bg-[#fbf9f3] px-3 py-2"><div className="eyebrow">Covered dates</div><div className="mt-1 text-[11px] font-bold">{localDate(dates.from)} <span className="px-1 text-[#b0ac9f]">→</span> {localDate(dates.to)}</div></div>
        <button className="button-secondary" onClick={() => { void dashboard.refetch(); void sales.refetch(); void purchases.refetch(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh data</button>
      </div>
    </section>
    {error && <div className="mb-4 flex justify-between rounded-xl bg-[#fff2ef] p-4 text-xs text-[#a35248]">Report data could not be loaded. Please retry.<button className="underline" onClick={() => {void dashboard.refetch();void sales.refetch();void purchases.refetch();}}>Retry</button></div>}
    {loading && !dashboard.data ? <div className="panel p-4"><LoadingLines count={7} /></div> : !dashboard.data ? <section className="panel p-5"><EmptyState title="Report data is unavailable" detail="No summary was returned for this reporting window." /></section> : <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sales", value: money(dashboard.data.totalSales), accent: "#1678c9" },
          { label: "Purchases", value: money(dashboard.data.totalPurchases), accent: "#7757be" },
          { label: "Gross profit", value: money(dashboard.data.grossProfit), accent: "#258759" },
          { label: "Profit margin", value: `${dashboard.data.profitMargin.toFixed(1)}%`, accent: "#ba8a1b" },
        ].map((k) => <div className="panel p-4" key={k.label}><div className="eyebrow">{k.label}</div><div className="mt-3 font-[var(--app-font-serif)] text-2xl font-extrabold tracking-[-.04em]" style={{ color: k.accent }}>{k.value}</div></div>)}
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="panel p-5"><div className="mb-4"><h2 className="section-title">Period at a glance</h2><p className="mt-1 text-[10px] text-[#909195]">Headline measures for this report</p></div><div className="divide-y divide-[#f0eee8]">{[
          ["Transactions", dashboard.data.transactionCount.toLocaleString("en-IN")],
          ["Pending amount", money(dashboard.data.pendingAmount)],
          ["Trading movement", money(dashboard.data.totalSales + dashboard.data.totalPurchases)],
          ["Reporting cadence", `${period[0].toUpperCase()}${period.slice(1)} · ${localDate(dates.from)} – ${localDate(dates.to)}`],
        ].map(([a, b]) => <div key={a} className="flex items-center justify-between gap-4 py-3 text-xs"><span className="text-[#85878c]">{a}</span><span className="text-right font-bold text-[#33363b]">{b}</span></div>)}</div></section>
        <section className="panel p-5"><div className="mb-4 flex items-start justify-between"><div><h2 className="section-title">Transactions included</h2><p className="mt-1 text-[10px] text-[#909195]">{combined.length.toLocaleString("en-IN")} entries · sales and purchases</p></div><button className="icon-button" onClick={() => downloadCsv(`${period}-transactions.csv`, combined)} aria-label="Export transaction detail"><Download size={14} /></button></div>
          {!combined.length ? <EmptyState title="No transactions in this window" detail="There is nothing to export in the selected range." /> : <div className="max-h-[295px] overflow-auto"><table className="data-table min-w-[570px]"><thead><tr><th>Date</th><th>Type / invoice</th><th>Party / product</th><th>Total</th></tr></thead><tbody>{combined.slice(0, 12).map((r) => <tr key={`${r.type}-${r.invoice}`}><td>{localDate(r.date, "dd MMM")}</td><td><div className="font-semibold">{r.type}</div><div className="mt-1 font-mono text-[9px] text-[#999]">{r.invoice}</div></td><td><div className="font-semibold">{r.party}</div><div className="mt-1 text-[10px] text-[#92949a]">{r.product}</div></td><td className="font-bold">{money(r.total)}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
      <section className="panel flex flex-wrap items-center justify-between gap-4 border-[#e9dfc1] bg-[#fcf8ea] p-5">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3df9b] text-[#766019]"><FileDown size={18} /></div><div><h2 className="text-sm font-bold text-[#37342c]">Export a period-ready report</h2><p className="mt-1 text-[10px] text-[#848078]">Download a formatted Excel workbook with headline totals and transaction detail. Use Print / PDF for a shareable document.</p></div></div>
        <div className="flex gap-2"><button className="button-secondary" onClick={() => window.print()}><Printer size={14} /> Save as PDF</button><button className="button-primary" onClick={exportReport} disabled={loading}><Download size={14} /> Download Excel</button></div>
      </section>
    </>}
    {message && <Toast message={message} onDone={() => setMessage("")} />}
  </div>;
}

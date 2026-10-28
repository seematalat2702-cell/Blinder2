import { useMemo, useState, type CSSProperties } from "react";
import { useGetDashboard, getGetDashboardQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowUpRight, CalendarDays, ChartNoAxesCombined, CircleDollarSign, Download, RefreshCw, ShoppingCart, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, LoadingLines, money, number, downloadCsv, localDate } from "../lib/utils";
import { PageHeading } from "../components/AppShell";

const chartColors = ["#0875d1", "#8159dd", "#28a46b", "#e5a323", "#e15a66", "#17a2a8"];
const quickPeriods = [{ label: "Today", value: "today" }, { label: "This week", value: "week" }, { label: "This month", value: "month" }, { label: "This year", value: "year" }, { label: "Custom", value: "custom" }] as const;
const granularities = ["daily", "weekly", "monthly", "yearly"] as const;
const axisColor = "#92949a";
const gridColor = "#eeeae2";
const tooltipStyle = { border: "1px solid #ebe6dc", borderRadius: 10, boxShadow: "0 8px 24px #25283112", fontSize: 11, background: "#fffdf9" };
const moneyTick = (n: number) => n >= 1000000 ? `₹${(n / 1000000).toFixed(1)}m` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${n}`;

function ExportControl({ rows, filename }: { rows: Record<string, unknown>[]; filename: string }) {
  return <button className="icon-button h-8 w-8" onClick={() => downloadCsv(filename, rows)} aria-label={`Export ${filename}`} title="Export chart data"><Download size={14} /></button>;
}
function ChartHeader({ title, note, rows, filename }: { title: string; note: string; rows: Record<string, unknown>[]; filename: string }) {
  return <div className="mb-4 flex items-start justify-between gap-2"><div><h2 className="section-title">{title}</h2><p className="mt-1 text-[10px] text-[#909195]">{note}</p></div><ExportControl rows={rows} filename={filename} /></div>;
}
function MetricCard({ title, value, detail, icon: Icon, color, tint }: { title: string; value: string; detail: string; icon: typeof Activity; color: string; tint: string }) {
  return <article className="panel metric-card" style={{ "--metric-color": color, "--metric-tint": tint } as CSSProperties}>
    <div className="relative z-[1] flex items-start justify-between"><div><div className="eyebrow">{title}</div><div className="metric-value" data-testid={`metric-${title.toLowerCase().replaceAll(" ", "-")}`}>{value}</div><div className="mt-2 text-[10px] text-[#92949a]">{detail}</div></div><span className="metric-icon"><Icon size={17} /></span></div>
  </article>;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<(typeof quickPeriods)[number]["value"]>("month");
  const [granularity, setGranularity] = useState<(typeof granularities)[number]>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedRange, setAppliedRange] = useState({ from: "", to: "" });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const queryClient = useQueryClient();
  const params = useMemo(() => ({
    period,
    granularity,
    ...(period === "custom" && appliedRange.from && appliedRange.to ? appliedRange : {}),
  }), [period, granularity, appliedRange]);
  const dashboard = useGetDashboard(params, {
    query: {
      queryKey: getGetDashboardQueryKey(params),
      refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
    },
  });
  const activity = useGetRecentActivity();
  const data = dashboard.data;
  const loading = dashboard.isLoading || dashboard.isFetching;
  const trends = data?.trends || [];
  const breakdown = data?.categories || [];
  const compare = data?.comparison || [];
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey(params) }),
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() }),
  ]);
  const error = dashboard.isError || activity.isError;
  return <div className="page-content">
    <PageHeading kicker="Business intelligence · Live" title="The business, in focus." description="A clear read on trading performance, product momentum and working capital." actions={<div className="no-print flex flex-wrap items-center gap-2"><button className="button-secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button><select className="field h-9 w-[140px] py-1.5 text-xs" aria-label="Automatic refresh" value={autoRefresh ? "5min" : "off"} onChange={(event) => setAutoRefresh(event.target.value === "5min")} data-testid="select-auto-refresh"><option value="off">Auto refresh off</option><option value="5min">Every 5 minutes</option></select><button className="button-secondary" onClick={() => window.print()}><Download size={14} /> Export PDF</button></div>} />
    <div className="mb-5 rounded-xl border border-[#eadcae] bg-[#fff9e7] px-4 py-3 text-[11px] leading-5 text-[#76642f]">
      Starter sample records are included to preview the dashboard. Edit or remove them as you enter your own business data.
    </div>
    {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-[#efcfca] bg-[#fff5f2] p-4 text-xs text-[#994f45]"><span>Some overview data could not be loaded. Check your connection and try again.</span><button className="button-secondary" onClick={() => { void dashboard.refetch(); void activity.refetch(); }}>Retry</button></div>}
    <div className="panel mb-5 flex flex-wrap items-end justify-between gap-4 p-4">
      <div><div className="eyebrow mb-2 flex items-center gap-1.5"><CalendarDays size={12} /> Reporting period</div><div className="flex flex-wrap gap-1.5">{quickPeriods.map((p) => <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${period === p.value ? "bg-[#20232a] text-[#f3ca48]" : "bg-[#f7f5ef] text-[#696a6d] hover:bg-[#f3ebd5]"}`} data-testid={`filter-period-${p.value}`}>{p.label}</button>)}</div></div>
      {period === "custom" && <div className="flex flex-wrap items-end gap-2"><div><label className="label">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field w-[150px]" data-testid="input-date-from" /></div><div><label className="label">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field w-[150px]" data-testid="input-date-to" /></div><button className="button-primary h-10" onClick={() => { if (from && to) setAppliedRange({ from, to }); }}>Apply dates</button></div>}
      <div className="flex items-center gap-2"><span className="eyebrow">Trend view</span><select aria-label="Trend granularity" className="field w-auto min-w-[125px] py-2" value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)} data-testid="select-chart-granularity">{granularities.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}</select></div>
    </div>

    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard title="Total sales" value={loading ? "…" : money(data?.totalSales)} detail="Sales value in period" icon={CircleDollarSign} color="#1678c9" tint="#e5f1fb" />
      <MetricCard title="Total purchases" value={loading ? "…" : money(data?.totalPurchases)} detail="Stock investment in period" icon={ShoppingCart} color="#7d5ac7" tint="#eee8fa" />
      <MetricCard title="Gross profit" value={loading ? "…" : money(data?.grossProfit)} detail="Trading profit in period" icon={TrendingUp} color="#238b58" tint="#e4f3e9" />
      <MetricCard title="Profit margin" value={loading ? "…" : `${data?.profitMargin?.toFixed(1) ?? "0.0"}%`} detail="Gross profit / sales" icon={ChartNoAxesCombined} color="#ba8a1b" tint="#fbf1d4" />
      <MetricCard title="Transactions" value={loading ? "…" : number(data?.transactionCount)} detail="Sales and purchases in period" icon={Activity} color="#c58b14" tint="#fbf1d4" />
    </div>

    {loading && !data ? <div className="panel mb-5"><LoadingLines count={7} /></div> : !data ? <div className="panel mb-5 p-5"><EmptyState title="Overview is unavailable" detail="No dashboard data was returned for this period." /></div> : <>
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel p-5">
          <ChartHeader title="Sales & purchase pulse" note="Trade value and gross profit over time" rows={trends as unknown as Record<string, unknown>[]} filename="sales-purchase-trend.csv" />
          {trends.length ? <ResponsiveContainer width="100%" height={274}><ComposedChart data={trends} margin={{ top: 10, right: 3, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="money" tickFormatter={moneyTick} tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={55} /><YAxis yAxisId="margin" orientation="right" tickFormatter={(n) => `${n}%`} tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={36} /><Tooltip formatter={(v: number | string, name: string | number) => [String(name) === "Margin" ? `${v}%` : money(Number(v)), String(name)]} contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10, color: "#76787d" }} />
            <Area yAxisId="money" type="monotone" dataKey="sales" name="Sales" stroke={chartColors[0]} fill="#dceefe" strokeWidth={2.5} fillOpacity={.7} isAnimationActive={false} /><Area yAxisId="money" type="monotone" dataKey="purchases" name="Purchases" stroke={chartColors[1]} fill="#eee7fb" strokeWidth={2} fillOpacity={.55} isAnimationActive={false} /><Line yAxisId="money" type="monotone" dataKey="profit" name="Profit" stroke={chartColors[2]} strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line yAxisId="margin" type="monotone" dataKey="margin" name="Margin" stroke={chartColors[3]} strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
          </ComposedChart></ResponsiveContainer> : <EmptyState title="No trend to plot" detail="Try another reporting period." />}
        </section>
        <section className="panel p-5">
          <ChartHeader title="Category mix" note="Sales value by product category" rows={breakdown as unknown as Record<string, unknown>[]} filename="category-mix.csv" />
          {breakdown.length ? <><div className="relative h-[215px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdown.slice(0, 6)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={57} outerRadius={88} paddingAngle={3} cornerRadius={3} stroke="none" isAnimationActive={false}>{breakdown.slice(0, 6).map((v, i) => <Cell key={v.name} fill={chartColors[i % chartColors.length]} />)}</Pie><Tooltip formatter={(v: number | string) => money(Number(v))} contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="font-[var(--app-font-serif)] text-xl font-extrabold">{breakdown.length}</div><div className="eyebrow !text-[8px]">categories</div></div></div></div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">{breakdown.slice(0, 6).map((item, i) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-[10px]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: chartColors[i % chartColors.length] }} /><span className="truncate text-[#6f7075]">{item.name}</span><span className="ml-auto font-semibold text-[#3b3d42]">{money(item.value)}</span></div>)}</div></> : <EmptyState title="No category data" detail="Category performance appears as sales are recorded." />}
        </section>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2"><ChartHeader title="Period comparison" note="Current period against the previous one" rows={compare as unknown as Record<string, unknown>[]} filename="period-comparison.csv" />
          {compare.length ? <ResponsiveContainer width="100%" height={235}><BarChart data={compare} margin={{ left: 6, right: 8, top: 8 }}><CartesianGrid stroke={gridColor} strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={moneyTick} tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} width={53} /><Tooltip formatter={(v: number | string) => money(Number(v))} contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="current" name="Current" fill={chartColors[0]} radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} /><Bar dataKey="previous" name="Previous" fill="#e6bd55" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyState title="No comparison available" detail="Comparison data appears once you have activity across periods." />}
        </section>
        <section className="panel p-5"><ChartHeader title="Top products" note="Ranked by sales value" rows={(data.topProducts || []) as unknown as Record<string, unknown>[]} filename="top-products.csv" />
          {data.topProducts.length ? <div className="space-y-4 pt-1">{data.topProducts.slice(0, 5).map((item, i) => { const pct = Math.max(6, item.value / (data.topProducts[0]?.value || 1) * 100); return <div key={item.name}><div className="mb-1.5 flex justify-between gap-3 text-[11px]"><span className="truncate font-semibold text-[#44464c]">{String(i + 1).padStart(2, "0")} <span className="ml-1">{item.name}</span></span><span className="font-bold">{money(item.value)}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: chartColors[i % chartColors.length] }} /></div></div>; })}</div> : <EmptyState title="No products ranked" detail="Product sales will be ranked here." />}
        </section>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="panel p-5"><ChartHeader title="Company contribution" note="Business value by company" rows={(data.topCompanies || []) as unknown as Record<string, unknown>[]} filename="company-contribution.csv" />
          {data.topCompanies.length ? <div className="space-y-3">{data.topCompanies.slice(0, 5).map((c, i) => <div key={c.name} className="flex items-center gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold" style={{ background: `${chartColors[i % chartColors.length]}18`, color: chartColors[i % chartColors.length] }}>{c.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate font-semibold">{c.name}</span><span>{money(c.value)}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(5, c.value / (data.topCompanies[0]?.value || 1) * 100)}%`, background: chartColors[i % chartColors.length] }} /></div></div></div>)}</div> : <EmptyState title="No company activity" detail="Your leading companies will appear here." />}
        </section>
        <section className="panel p-5"><ChartHeader title="Profit contribution" note="Share of gross profit by category" rows={(data.profitContribution || []) as unknown as Record<string, unknown>[]} filename="profit-contribution.csv" />
          {data.profitContribution.length ? <><div className="relative h-[208px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.profitContribution.slice(0, 6)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={3} cornerRadius={3} stroke="none" isAnimationActive={false}>{data.profitContribution.slice(0, 6).map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value: number | string) => money(Number(value))} contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="font-[var(--app-font-serif)] text-xl font-extrabold">{data.profitContribution.length}</div><div className="eyebrow !text-[8px]">sources</div></div></div></div><div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">{data.profitContribution.slice(0, 6).map((item, index) => <div key={item.name} className="flex items-center gap-2 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ background: chartColors[index % chartColors.length] }} /><span className="text-[#6f7075]">{item.name}</span><span className="font-semibold">{money(item.value)}</span></div>)}</div></> : <EmptyState title="Profit mix unavailable" detail="Contribution breakdown will appear here." />}
        </section>
      </div>
    </>}
    <section className="panel mt-5 p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Recent activity</h2><p className="mt-1 text-[10px] text-[#909195]">The latest movement across your business</p></div><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f8f0d9] text-[#967418]"><Activity size={15} /></div></div>
      {activity.isLoading || activity.isFetching ? <LoadingLines count={3} /> : activity.isError ? <div className="p-4 text-xs text-[#a35248]">Activity could not be loaded. <button className="underline" onClick={() => void activity.refetch()}>Retry</button></div> : !activity.data?.length ? <EmptyState title="No recent activity" detail="New sales and purchases will appear here." /> : <div className="divide-y divide-[#f0eee8]">{activity.data.slice(0, 6).map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid={`activity-${item.id}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.kind === "sale" ? "bg-[#e7f2fb] text-[#1678c9]" : "bg-[#f0eafb] text-[#7956bd]"}`}>{item.kind === "sale" ? <CircleDollarSign size={15} /> : <ShoppingCart size={15} />}</span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold text-[#3b3d42]">{item.title}</div><div className="mt-0.5 truncate text-[10px] text-[#8c8e93]">{item.subtitle} · {localDate(item.date, "dd MMM yyyy")}</div></div><div className="text-right"><div className="text-[11px] font-bold">{money(item.amount)}</div><div className="mt-0.5 text-[9px] capitalize text-[#96979a]">{item.kind}</div></div></div>)}</div>}
    </section>
    <div className="mt-6 flex items-center justify-between text-[10px] text-[#96979a]"><span>JHARKHAND ENTERPRISES · Performance desk</span><span className="flex items-center gap-1"><ArrowUpRight size={12} /> Margin {data?.profitMargin?.toFixed(1) ?? "0.0"}%</span></div>
  </div>;
}

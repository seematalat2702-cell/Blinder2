import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (value?: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const number = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });

export const localDate = (date: string, pattern = "dd MMM yyyy") => {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return format(new Date(year, month - 1, day), pattern);
};

export const isoDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const encode = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [
    keys.map(encode).join(","),
    ...rows.map((row) => keys.map((key) => encode(row[key])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = "Report",
) {
  if (!rows.length) return;
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="chart-empty">
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f8f0d9] text-[#9c7a1e]">
          —
        </div>
        <p className="font-semibold text-[#34363b]">{title}</p>
        <p className="mt-1 text-xs text-[#888]">{detail}</p>
      </div>
    </div>
  );
}

export function LoadingLines({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-8 animate-pulse rounded-md bg-[#f0eee8]"
        />
      ))}
    </div>
  );
}

export function Status({ value }: { value: string }) {
  return (
    <span
      className={`status-pill ${value === "pending" ? "pending" : "received"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

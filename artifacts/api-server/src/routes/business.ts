import { and, asc, desc, eq, gte, ilike, lte, or, sql, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  customersTable,
  productsTable,
  purchasesTable,
  salesTable,
  suppliersTable,
} from "@workspace/db";
import {
  CreateMasterDataBody,
  CreateMasterDataParams,
  CreateMasterDataResponse,
  CreatePurchaseBody,
  CreatePurchaseResponse,
  CreateSaleBody,
  CreateSaleResponse,
  DeleteMasterDataParams,
  DeletePurchaseParams,
  DeleteSaleParams,
  GetDashboardQueryParams,
  GetDashboardResponse,
  GetRecentActivityResponse,
  ListMasterDataParams,
  ListMasterDataResponse,
  ListPurchasesQueryParams,
  ListPurchasesResponse,
  ListSalesQueryParams,
  ListSalesResponse,
  UpdateMasterDataBody,
  UpdateMasterDataParams,
  UpdateMasterDataResponse,
  UpdatePurchaseBody,
  UpdatePurchaseParams,
  UpdatePurchaseResponse,
  UpdateSaleBody,
  UpdateSaleParams,
  UpdateSaleResponse,
} from "@workspace/api-zod";
import { seedIfEmpty } from "../lib/seed";

const router: IRouter = Router();

type MasterType = "companies" | "products" | "customers" | "suppliers";

function parseId(raw: string | string[]): number {
  return Number(Array.isArray(raw) ? raw[0] : raw);
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizedDate(value?: Date): string | undefined {
  return value instanceof Date ? dateString(value) : undefined;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getDateRange(period?: string, from?: string, to?: string) {
  const today = new Date();
  const todayString = dateString(today);
  let start = new Date(`${todayString}T00:00:00.000Z`);
  let end = new Date(start);

  if (period === "custom" && from && to) {
    start = new Date(`${from}T00:00:00.000Z`);
    end = new Date(`${to}T00:00:00.000Z`);
  } else if (period === "today") {
    // The defaults already cover today.
  } else if (period === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  } else if (period === "year") {
    start = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  } else if (period === "custom" && from) {
    start = new Date(`${from}T00:00:00.000Z`);
    end = new Date(`${to ?? todayString}T00:00:00.000Z`);
  } else {
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  }

  const length = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
  );
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(length - 1));
  return {
    from: dateString(start),
    to: dateString(end),
    previousFrom: dateString(previousStart),
    previousTo: dateString(previousEnd),
  };
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function saleSummary(from: string, to: string) {
  const [row] = await db
    .select({
      total: sum(salesTable.totalAmount),
      profit: sum(salesTable.profit),
      count: sql<number>`count(${salesTable.id})::int`,
      pending: sql<number>`coalesce(sum(case when ${salesTable.paymentStatus} = 'pending' then ${salesTable.totalAmount} else 0 end), 0)`,
    })
    .from(salesTable)
    .where(and(gte(salesTable.date, from), lte(salesTable.date, to)));
  return row;
}

async function purchaseSummary(from: string, to: string) {
  const [row] = await db
    .select({
      total: sum(purchasesTable.totalAmount),
      count: sql<number>`count(${purchasesTable.id})::int`,
      pending: sql<number>`coalesce(sum(case when ${purchasesTable.paymentStatus} = 'pending' then ${purchasesTable.totalAmount} else 0 end), 0)`,
    })
    .from(purchasesTable)
    .where(and(gte(purchasesTable.date, from), lte(purchasesTable.date, to)));
  return row;
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await seedIfEmpty();
  const params = parsed.data;
  const range = getDateRange(
    params.period,
    normalizedDate(params.from),
    normalizedDate(params.to),
  );

  const [sales, purchases, previousSales, previousPurchases] = await Promise.all([
    saleSummary(range.from, range.to),
    purchaseSummary(range.from, range.to),
    saleSummary(range.previousFrom, range.previousTo),
    purchaseSummary(range.previousFrom, range.previousTo),
  ]);

  const dailySales = await db
    .select({
      date: salesTable.date,
      amount: sum(salesTable.totalAmount),
      profit: sum(salesTable.profit),
    })
    .from(salesTable)
    .where(and(gte(salesTable.date, range.from), lte(salesTable.date, range.to)))
    .groupBy(salesTable.date)
    .orderBy(asc(salesTable.date));
  const dailyPurchases = await db
    .select({
      date: purchasesTable.date,
      amount: sum(purchasesTable.totalAmount),
    })
    .from(purchasesTable)
    .where(
      and(gte(purchasesTable.date, range.from), lte(purchasesTable.date, range.to)),
    )
    .groupBy(purchasesTable.date)
    .orderBy(asc(purchasesTable.date));

  const trendMap = new Map<
    string,
    { label: string; sales: number; purchases: number; profit: number; margin: number }
  >();
  const granularity =
    params.granularity ??
    (params.period === "year" ? "monthly" : params.period === "week" ? "daily" : "monthly");
  const bucket = (date: string): string => {
    if (granularity === "yearly") return date.slice(0, 4);
    if (granularity === "monthly") return date.slice(0, 7);
    const day = new Date(`${date}T00:00:00.000Z`);
    if (granularity === "weekly") {
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      return dateString(day);
    }
    return date;
  };
  for (const row of dailySales) {
    const label = bucket(row.date);
    const point = trendMap.get(label) ?? {
      label,
      sales: 0,
      purchases: 0,
      profit: 0,
      margin: 0,
    };
    point.sales += asNumber(row.amount);
    point.profit += asNumber(row.profit);
    trendMap.set(label, point);
  }
  for (const row of dailyPurchases) {
    const label = bucket(row.date);
    const point = trendMap.get(label) ?? {
      label,
      sales: 0,
      purchases: 0,
      profit: 0,
      margin: 0,
    };
    point.purchases += asNumber(row.amount);
    trendMap.set(label, point);
  }
  const cursor = new Date(`${range.from}T00:00:00.000Z`);
  const endDate = new Date(`${range.to}T00:00:00.000Z`);
  if (granularity === "weekly") {
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  } else if (granularity === "monthly") {
    cursor.setUTCDate(1);
  } else if (granularity === "yearly") {
    cursor.setUTCMonth(0, 1);
  }
  let bucketsAdded = 0;
  while (cursor <= endDate && bucketsAdded < 500) {
    const label = bucket(dateString(cursor));
    if (!trendMap.has(label)) {
      trendMap.set(label, {
        label,
        sales: 0,
        purchases: 0,
        profit: 0,
        margin: 0,
      });
    }
    bucketsAdded += 1;
    if (granularity === "weekly") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else if (granularity === "monthly") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    } else if (granularity === "yearly") {
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  for (const point of trendMap.values()) {
    point.margin = point.sales ? (point.profit / point.sales) * 100 : 0;
  }

  const topProducts = await db
    .select({ name: productsTable.name, value: sum(salesTable.totalAmount) })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(and(gte(salesTable.date, range.from), lte(salesTable.date, range.to)))
    .groupBy(productsTable.name)
    .orderBy(desc(sum(salesTable.totalAmount)))
    .limit(6);
  const topCompanies = await db
    .select({ name: companiesTable.name, value: sum(salesTable.totalAmount) })
    .from(salesTable)
    .innerJoin(companiesTable, eq(salesTable.companyId, companiesTable.id))
    .where(and(gte(salesTable.date, range.from), lte(salesTable.date, range.to)))
    .groupBy(companiesTable.name)
    .orderBy(desc(sum(salesTable.totalAmount)))
    .limit(6);
  const categories = await db
    .select({ name: productsTable.category, value: sum(salesTable.totalAmount) })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(and(gte(salesTable.date, range.from), lte(salesTable.date, range.to)))
    .groupBy(productsTable.category)
    .orderBy(desc(sum(salesTable.totalAmount)))
    .limit(6);
  const profitContribution = await db
    .select({ name: productsTable.category, value: sum(salesTable.profit) })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(and(gte(salesTable.date, range.from), lte(salesTable.date, range.to)))
    .groupBy(productsTable.category)
    .orderBy(desc(sum(salesTable.profit)))
    .limit(6);

  const totalSales = asNumber(sales?.total);
  const totalPurchases = asNumber(purchases?.total);
  const grossProfit = asNumber(sales?.profit);
  const data = {
    totalSales,
    totalPurchases,
    grossProfit,
    profitMargin: totalSales ? (grossProfit / totalSales) * 100 : 0,
    transactionCount: asNumber(sales?.count) + asNumber(purchases?.count),
    pendingAmount: asNumber(sales?.pending) + asNumber(purchases?.pending),
    trends: [...trendMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    topProducts: topProducts.map((row) => ({ name: row.name, value: asNumber(row.value) })),
    topCompanies: topCompanies.map((row) => ({ name: row.name, value: asNumber(row.value) })),
    categories: categories.map((row) => ({ name: row.name, value: asNumber(row.value) })),
    profitContribution: profitContribution.map((row) => ({
      name: row.name,
      value: asNumber(row.value),
    })),
    comparison: [
      {
        label: "Sales",
        current: totalSales,
        previous: asNumber(previousSales?.total),
      },
      {
        label: "Purchases",
        current: totalPurchases,
        previous: asNumber(previousPurchases?.total),
      },
      {
        label: "Profit",
        current: grossProfit,
        previous: asNumber(previousSales?.profit),
      },
    ],
  };
  res.json(GetDashboardResponse.parse(data));
});

router.get("/activity", async (_req, res): Promise<void> => {
  await seedIfEmpty();
  const [sales, purchases] = await Promise.all([
    db
      .select({
        id: salesTable.id,
        date: salesTable.date,
        invoice: salesTable.invoice,
        name: customersTable.name,
        amount: salesTable.totalAmount,
      })
      .from(salesTable)
      .innerJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .orderBy(desc(salesTable.date), desc(salesTable.id))
      .limit(6),
    db
      .select({
        id: purchasesTable.id,
        date: purchasesTable.date,
        invoice: purchasesTable.invoice,
        name: suppliersTable.name,
        amount: purchasesTable.totalAmount,
      })
      .from(purchasesTable)
      .innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
      .orderBy(desc(purchasesTable.date), desc(purchasesTable.id))
      .limit(6),
  ]);
  const data = [
    ...sales.map((row) => ({
      id: `sale-${row.id}`,
      kind: "sale" as const,
      title: `Sale ${row.invoice}`,
      subtitle: `To ${row.name}`,
      date: row.date,
      amount: row.amount,
    })),
    ...purchases.map((row) => ({
      id: `purchase-${row.id}`,
      kind: "purchase" as const,
      title: `Purchase ${row.invoice}`,
      subtitle: `From ${row.name}`,
      date: row.date,
      amount: row.amount,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  res.json(GetRecentActivityResponse.parse(data));
});

router.get("/masters/:type", async (req, res): Promise<void> => {
  const params = ListMasterDataParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await seedIfEmpty();
  const type = params.data.type as MasterType;
  let records: unknown[];
  if (type === "companies") {
    records = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        contact: companiesTable.contact,
        createdAt: companiesTable.createdAt,
      })
      .from(companiesTable)
      .orderBy(asc(companiesTable.name));
  } else if (type === "products") {
    records = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        category: productsTable.category,
        companyId: productsTable.companyId,
        companyName: companiesTable.name,
        purchasePrice: productsTable.purchasePrice,
        sellingPrice: productsTable.sellingPrice,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .innerJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
      .orderBy(asc(productsTable.name));
  } else if (type === "customers") {
    records = await db
      .select()
      .from(customersTable)
      .orderBy(asc(customersTable.name));
  } else {
    records = await db
      .select()
      .from(suppliersTable)
      .orderBy(asc(suppliersTable.name));
  }
  res.json(ListMasterDataResponse.parse(records));
});

router.post("/masters/:type", async (req, res): Promise<void> => {
  const params = CreateMasterDataParams.safeParse(req.params);
  const body = CreateMasterDataBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const type = params.data.type as MasterType;
  const data = body.data;
  let record: unknown;
  if (type === "companies") {
    [record] = await db
      .insert(companiesTable)
      .values({ name: data.name, contact: data.contact ?? null })
      .returning();
  } else if (type === "products") {
    if (!data.category || !data.companyId || data.purchasePrice == null || data.sellingPrice == null) {
      res.status(400).json({ error: "Products need a category, company, purchase price, and selling price." });
      return;
    }
    const [product] = await db
      .insert(productsTable)
      .values({
        name: data.name,
        category: data.category,
        companyId: data.companyId,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
      })
      .returning();
    const [company] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, product.companyId));
    record = { ...product, companyName: company?.name ?? "" };
  } else if (type === "customers") {
    [record] = await db
      .insert(customersTable)
      .values({
        name: data.name,
        contact: data.contact ?? null,
        phone: data.phone ?? null,
        area: data.area ?? null,
      })
      .returning();
  } else {
    [record] = await db
      .insert(suppliersTable)
      .values({
        name: data.name,
        contact: data.contact ?? null,
        phone: data.phone ?? null,
        area: data.area ?? null,
      })
      .returning();
  }
  res.status(201).json(CreateMasterDataResponse.parse(record));
});

router.patch("/masters/:type/:id", async (req, res): Promise<void> => {
  const params = UpdateMasterDataParams.safeParse({
    ...req.params,
    id: parseId(req.params.id),
  });
  const body = UpdateMasterDataBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const type = params.data.type as MasterType;
  const id = params.data.id;
  const data = body.data;
  let record: unknown;
  if (type === "companies") {
    [record] = await db
      .update(companiesTable)
      .set({ name: data.name, contact: data.contact })
      .where(eq(companiesTable.id, id))
      .returning();
  } else if (type === "products") {
    const [product] = await db
      .update(productsTable)
      .set({
        name: data.name,
        category: data.category,
        companyId: data.companyId,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
      })
      .where(eq(productsTable.id, id))
      .returning();
    if (product) {
      const [company] = await db
        .select({ name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, product.companyId));
      record = { ...product, companyName: company?.name ?? "" };
    }
  } else if (type === "customers") {
    [record] = await db
      .update(customersTable)
      .set({
        name: data.name,
        contact: data.contact,
        phone: data.phone,
        area: data.area,
      })
      .where(eq(customersTable.id, id))
      .returning();
  } else {
    [record] = await db
      .update(suppliersTable)
      .set({
        name: data.name,
        contact: data.contact,
        phone: data.phone,
        area: data.area,
      })
      .where(eq(suppliersTable.id, id))
      .returning();
  }
  if (!record) {
    res.status(404).json({ error: "Master record not found." });
    return;
  }
  res.json(UpdateMasterDataResponse.parse(record));
});

router.delete("/masters/:type/:id", async (req, res): Promise<void> => {
  const params = DeleteMasterDataParams.safeParse({
    ...req.params,
    id: parseId(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { type, id } = params.data;
  let deleted: unknown;
  if (type === "companies") {
    const [productUse] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.companyId, id))
      .limit(1);
    if (productUse) {
      res.status(409).json({ error: "This company is assigned to products. Update or remove them first." });
      return;
    }
    [deleted] = await db.delete(companiesTable).where(eq(companiesTable.id, id)).returning();
  } else if (type === "products") {
    const [saleUse] = await db.select({ id: salesTable.id }).from(salesTable).where(eq(salesTable.productId, id)).limit(1);
    const [purchaseUse] = await db.select({ id: purchasesTable.id }).from(purchasesTable).where(eq(purchasesTable.productId, id)).limit(1);
    if (saleUse || purchaseUse) {
      res.status(409).json({ error: "This product has transaction history and cannot be deleted." });
      return;
    }
    [deleted] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
  } else if (type === "customers") {
    const [saleUse] = await db.select({ id: salesTable.id }).from(salesTable).where(eq(salesTable.customerId, id)).limit(1);
    if (saleUse) {
      res.status(409).json({ error: "This customer has sales history and cannot be deleted." });
      return;
    }
    [deleted] = await db.delete(customersTable).where(eq(customersTable.id, id)).returning();
  } else {
    const [purchaseUse] = await db.select({ id: purchasesTable.id }).from(purchasesTable).where(eq(purchasesTable.supplierId, id)).limit(1);
    if (purchaseUse) {
      res.status(409).json({ error: "This supplier has purchase history and cannot be deleted." });
      return;
    }
    [deleted] = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  }
  if (!deleted) {
    res.status(404).json({ error: "Master record not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/sales", async (req, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await seedIfEmpty();
  const { search, from, to, paymentStatus } = parsed.data;
  const conditions = [];
  if (from) conditions.push(gte(salesTable.date, normalizedDate(from)!));
  if (to) conditions.push(lte(salesTable.date, normalizedDate(to)!));
  if (paymentStatus) conditions.push(eq(salesTable.paymentStatus, paymentStatus));
  if (search) {
    const match = `%${search}%`;
    conditions.push(
      or(
        ilike(salesTable.invoice, match),
        ilike(customersTable.name, match),
        ilike(productsTable.name, match),
        ilike(companiesTable.name, match),
      )!,
    );
  }
  const rows = await db
    .select({
      id: salesTable.id,
      date: salesTable.date,
      invoice: salesTable.invoice,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      productId: salesTable.productId,
      productName: productsTable.name,
      companyId: salesTable.companyId,
      companyName: companiesTable.name,
      quantity: salesTable.quantity,
      purchaseRate: salesTable.purchaseRate,
      sellingRate: salesTable.sellingRate,
      totalAmount: salesTable.totalAmount,
      profit: salesTable.profit,
      profitPercent: salesTable.profitPercent,
      paymentStatus: salesTable.paymentStatus,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .innerJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(salesTable.companyId, companiesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(salesTable.date), desc(salesTable.id))
    .limit(1000);
  res.json(ListSalesResponse.parse(rows));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await seedIfEmpty();
  const input = parsed.data;
  const totalAmount = input.quantity * input.sellingRate;
  const profit = input.quantity * (input.sellingRate - input.purchaseRate);
  const [sale] = await db
    .insert(salesTable)
    .values({
      ...input,
      date: dateString(input.date),
      totalAmount,
      profit,
      profitPercent: totalAmount ? (profit / totalAmount) * 100 : 0,
    })
    .returning();
  const [row] = await db
    .select({
      id: salesTable.id,
      date: salesTable.date,
      invoice: salesTable.invoice,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      productId: salesTable.productId,
      productName: productsTable.name,
      companyId: salesTable.companyId,
      companyName: companiesTable.name,
      quantity: salesTable.quantity,
      purchaseRate: salesTable.purchaseRate,
      sellingRate: salesTable.sellingRate,
      totalAmount: salesTable.totalAmount,
      profit: salesTable.profit,
      profitPercent: salesTable.profitPercent,
      paymentStatus: salesTable.paymentStatus,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .innerJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(salesTable.companyId, companiesTable.id))
    .where(eq(salesTable.id, sale.id));
  res.status(201).json(CreateSaleResponse.parse(row));
});

router.patch("/sales/:id", async (req, res): Promise<void> => {
  const params = UpdateSaleParams.safeParse({ ...req.params, id: parseId(req.params.id) });
  const parsed = UpdateSaleBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const input = parsed.data;
  const totalAmount = input.quantity * input.sellingRate;
  const profit = input.quantity * (input.sellingRate - input.purchaseRate);
  const [sale] = await db
    .update(salesTable)
    .set({
      ...input,
      date: dateString(input.date),
      totalAmount,
      profit,
      profitPercent: totalAmount ? (profit / totalAmount) * 100 : 0,
    })
    .where(eq(salesTable.id, params.data.id))
    .returning();
  if (!sale) {
    res.status(404).json({ error: "Sale not found." });
    return;
  }
  const [row] = await db
    .select({
      id: salesTable.id,
      date: salesTable.date,
      invoice: salesTable.invoice,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      productId: salesTable.productId,
      productName: productsTable.name,
      companyId: salesTable.companyId,
      companyName: companiesTable.name,
      quantity: salesTable.quantity,
      purchaseRate: salesTable.purchaseRate,
      sellingRate: salesTable.sellingRate,
      totalAmount: salesTable.totalAmount,
      profit: salesTable.profit,
      profitPercent: salesTable.profitPercent,
      paymentStatus: salesTable.paymentStatus,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .innerJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(salesTable.companyId, companiesTable.id))
    .where(eq(salesTable.id, params.data.id));
  res.json(UpdateSaleResponse.parse(row));
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  const params = DeleteSaleParams.safeParse({ ...req.params, id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [sale] = await db.delete(salesTable).where(eq(salesTable.id, params.data.id)).returning();
  if (!sale) {
    res.status(404).json({ error: "Sale not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/purchases", async (req, res): Promise<void> => {
  const parsed = ListPurchasesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await seedIfEmpty();
  const { search, from, to, paymentStatus } = parsed.data;
  const conditions = [];
  if (from) conditions.push(gte(purchasesTable.date, normalizedDate(from)!));
  if (to) conditions.push(lte(purchasesTable.date, normalizedDate(to)!));
  if (paymentStatus) conditions.push(eq(purchasesTable.paymentStatus, paymentStatus));
  if (search) {
    const match = `%${search}%`;
    conditions.push(
      or(
        ilike(purchasesTable.invoice, match),
        ilike(suppliersTable.name, match),
        ilike(productsTable.name, match),
        ilike(companiesTable.name, match),
      )!,
    );
  }
  const rows = await db
    .select({
      id: purchasesTable.id,
      date: purchasesTable.date,
      invoice: purchasesTable.invoice,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      productId: purchasesTable.productId,
      productName: productsTable.name,
      companyId: purchasesTable.companyId,
      companyName: companiesTable.name,
      quantity: purchasesTable.quantity,
      purchaseRate: purchasesTable.purchaseRate,
      totalAmount: purchasesTable.totalAmount,
      paymentStatus: purchasesTable.paymentStatus,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .innerJoin(productsTable, eq(purchasesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(purchasesTable.companyId, companiesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(purchasesTable.date), desc(purchasesTable.id))
    .limit(1000);
  res.json(ListPurchasesResponse.parse(rows));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await seedIfEmpty();
  const input = parsed.data;
  const [purchase] = await db
    .insert(purchasesTable)
    .values({
      ...input,
      date: dateString(input.date),
      totalAmount: input.quantity * input.purchaseRate,
    })
    .returning();
  const [row] = await db
    .select({
      id: purchasesTable.id,
      date: purchasesTable.date,
      invoice: purchasesTable.invoice,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      productId: purchasesTable.productId,
      productName: productsTable.name,
      companyId: purchasesTable.companyId,
      companyName: companiesTable.name,
      quantity: purchasesTable.quantity,
      purchaseRate: purchasesTable.purchaseRate,
      totalAmount: purchasesTable.totalAmount,
      paymentStatus: purchasesTable.paymentStatus,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .innerJoin(productsTable, eq(purchasesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(purchasesTable.companyId, companiesTable.id))
    .where(eq(purchasesTable.id, purchase.id));
  res.status(201).json(CreatePurchaseResponse.parse(row));
});

router.patch("/purchases/:id", async (req, res): Promise<void> => {
  const params = UpdatePurchaseParams.safeParse({
    ...req.params,
    id: parseId(req.params.id),
  });
  const parsed = UpdatePurchaseBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const input = parsed.data;
  const [purchase] = await db
    .update(purchasesTable)
    .set({
      ...input,
      date: dateString(input.date),
      totalAmount: input.quantity * input.purchaseRate,
    })
    .where(eq(purchasesTable.id, params.data.id))
    .returning();
  if (!purchase) {
    res.status(404).json({ error: "Purchase not found." });
    return;
  }
  const [row] = await db
    .select({
      id: purchasesTable.id,
      date: purchasesTable.date,
      invoice: purchasesTable.invoice,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      productId: purchasesTable.productId,
      productName: productsTable.name,
      companyId: purchasesTable.companyId,
      companyName: companiesTable.name,
      quantity: purchasesTable.quantity,
      purchaseRate: purchasesTable.purchaseRate,
      totalAmount: purchasesTable.totalAmount,
      paymentStatus: purchasesTable.paymentStatus,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .innerJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .innerJoin(productsTable, eq(purchasesTable.productId, productsTable.id))
    .innerJoin(companiesTable, eq(purchasesTable.companyId, companiesTable.id))
    .where(eq(purchasesTable.id, params.data.id));
  res.json(UpdatePurchaseResponse.parse(row));
});

router.delete("/purchases/:id", async (req, res): Promise<void> => {
  const params = DeletePurchaseParams.safeParse({
    ...req.params,
    id: parseId(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [purchase] = await db
    .delete(purchasesTable)
    .where(eq(purchasesTable.id, params.data.id))
    .returning();
  if (!purchase) {
    res.status(404).json({ error: "Purchase not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;

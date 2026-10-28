import { db } from "@workspace/db";
import {
  companiesTable,
  customersTable,
  productsTable,
  purchasesTable,
  salesTable,
  suppliersTable,
} from "@workspace/db";

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function seedIfEmpty(): Promise<void> {
  const [existingCompany] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .limit(1);
  if (existingCompany) return;

  const companies = await db
    .insert(companiesTable)
    .values([
      { name: "HID", contact: "Ranchi sales desk" },
      { name: "KAVYA GOLD", contact: "Wholesale distribution" },
      { name: "BOSCH", contact: "Authorized dealer channel" },
      { name: "THEKEDAR", contact: "Regional supply" },
    ])
    .returning();
  const customers = await db
    .insert(customersTable)
    .values([
      { name: "Singh Hardware", phone: "+91 98765 41021", area: "Ranchi" },
      { name: "New Market Tools", phone: "+91 98765 41022", area: "Jamshedpur" },
      { name: "Shree Ganesh Traders", phone: "+91 98765 41023", area: "Dhanbad" },
      { name: "Patel Machinery", phone: "+91 98765 41024", area: "Bokaro" },
    ])
    .returning();
  const suppliers = await db
    .insert(suppliersTable)
    .values([
      { name: "Eastern Industrial Supply", phone: "+91 93344 21010", area: "Ranchi" },
      { name: "National Tool House", phone: "+91 93344 21011", area: "Kolkata" },
      { name: "Powerline Distributors", phone: "+91 93344 21012", area: "Jamshedpur" },
    ])
    .returning();
  const products = await db
    .insert(productsTable)
    .values([
      {
        name: "Professional Chainsaw 18″",
        category: "Cutting",
        companyId: companies[0].id,
        purchasePrice: 5850,
        sellingPrice: 7350,
      },
      {
        name: "Wall Cutter 5″",
        category: "Cutting",
        companyId: companies[1].id,
        purchasePrice: 2450,
        sellingPrice: 3250,
      },
      {
        name: "Impact Driller 650W",
        category: "Drilling",
        companyId: companies[2].id,
        purchasePrice: 3100,
        sellingPrice: 4100,
      },
      {
        name: "Angle Grinder 4″",
        category: "Grinding",
        companyId: companies[2].id,
        purchasePrice: 1850,
        sellingPrice: 2550,
      },
      {
        name: "Copper Armature 7″",
        category: "Spares",
        companyId: companies[3].id,
        purchasePrice: 920,
        sellingPrice: 1380,
      },
      {
        name: "Rotary Hammer 26mm",
        category: "Drilling",
        companyId: companies[0].id,
        purchasePrice: 6150,
        sellingPrice: 7950,
      },
    ])
    .returning();

  const saleRows = [
    { day: 1, product: 0, company: 0, customer: 0, quantity: 3, rate: 7350, cost: 5850, status: "received" as const },
    { day: 3, product: 2, company: 2, customer: 1, quantity: 5, rate: 4100, cost: 3100, status: "pending" as const },
    { day: 5, product: 4, company: 3, customer: 2, quantity: 12, rate: 1380, cost: 920, status: "received" as const },
    { day: 8, product: 1, company: 1, customer: 3, quantity: 4, rate: 3250, cost: 2450, status: "received" as const },
    { day: 12, product: 3, company: 2, customer: 0, quantity: 7, rate: 2550, cost: 1850, status: "pending" as const },
    { day: 17, product: 5, company: 0, customer: 2, quantity: 2, rate: 7950, cost: 6150, status: "received" as const },
    { day: 23, product: 0, company: 0, customer: 1, quantity: 6, rate: 7350, cost: 5850, status: "received" as const },
    { day: 31, product: 2, company: 2, customer: 3, quantity: 3, rate: 4100, cost: 3100, status: "received" as const },
    { day: 42, product: 4, company: 3, customer: 0, quantity: 20, rate: 1380, cost: 920, status: "received" as const },
    { day: 58, product: 1, company: 1, customer: 2, quantity: 8, rate: 3250, cost: 2450, status: "pending" as const },
    { day: 86, product: 3, company: 2, customer: 1, quantity: 10, rate: 2550, cost: 1850, status: "received" as const },
    { day: 115, product: 5, company: 0, customer: 3, quantity: 3, rate: 7950, cost: 6150, status: "received" as const },
  ];
  await db.insert(salesTable).values(
    saleRows.map((row, index) => {
      const totalAmount = row.quantity * row.rate;
      const profit = row.quantity * (row.rate - row.cost);
      return {
        date: dateDaysAgo(row.day),
        invoice: `JHE-S${String(index + 1).padStart(3, "0")}`,
        customerId: customers[row.customer].id,
        productId: products[row.product].id,
        companyId: companies[row.company].id,
        quantity: row.quantity,
        purchaseRate: row.cost,
        sellingRate: row.rate,
        totalAmount,
        profit,
        profitPercent: totalAmount ? (profit / totalAmount) * 100 : 0,
        paymentStatus: row.status,
      };
    }),
  );

  const purchaseRows = [
    { day: 2, product: 0, company: 0, supplier: 0, quantity: 10, rate: 5850, status: "received" as const },
    { day: 6, product: 2, company: 2, supplier: 1, quantity: 16, rate: 3100, status: "pending" as const },
    { day: 10, product: 4, company: 3, supplier: 2, quantity: 40, rate: 920, status: "received" as const },
    { day: 16, product: 1, company: 1, supplier: 0, quantity: 12, rate: 2450, status: "received" as const },
    { day: 27, product: 3, company: 2, supplier: 1, quantity: 18, rate: 1850, status: "received" as const },
    { day: 49, product: 5, company: 0, supplier: 2, quantity: 8, rate: 6150, status: "received" as const },
    { day: 77, product: 0, company: 0, supplier: 0, quantity: 14, rate: 5850, status: "pending" as const },
    { day: 103, product: 2, company: 2, supplier: 1, quantity: 20, rate: 3100, status: "received" as const },
  ];
  await db.insert(purchasesTable).values(
    purchaseRows.map((row, index) => ({
      date: dateDaysAgo(row.day),
      invoice: `JHE-P${String(index + 1).padStart(3, "0")}`,
      supplierId: suppliers[row.supplier].id,
      productId: products[row.product].id,
      companyId: companies[row.company].id,
      quantity: row.quantity,
      purchaseRate: row.rate,
      totalAmount: row.quantity * row.rate,
      paymentStatus: row.status,
    })),
  );
}

import {
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contact: text("contact"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "restrict" }),
  purchasePrice: real("purchase_price").notNull(),
  sellingPrice: real("selling_price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  area: text("area"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  area: text("area"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  invoice: text("invoice").notNull(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "restrict" }),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  purchaseRate: real("purchase_rate").notNull(),
  sellingRate: real("selling_rate").notNull(),
  totalAmount: real("total_amount").notNull(),
  profit: real("profit").notNull(),
  profitPercent: real("profit_percent").notNull(),
  paymentStatus: text("payment_status", {
    enum: ["received", "pending"],
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  invoice: text("invoice").notNull(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliersTable.id, { onDelete: "restrict" }),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  purchaseRate: real("purchase_rate").notNull(),
  totalAmount: real("total_amount").notNull(),
  paymentStatus: text("payment_status", {
    enum: ["received", "pending"],
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

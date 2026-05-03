import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

export const datasets = mysqlTable("datasets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  columns: json("columns").notNull(),
  rowCount: bigint("row_count", { mode: "number" }).notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyses = mysqlTable("analyses", {
  id: serial("id").primaryKey(),
  datasetId: bigint("dataset_id", { mode: "number", unsigned: true }).notNull(),
  query: text("query").notNull(),
  result: json("result"),
  chartType: varchar("chart_type", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

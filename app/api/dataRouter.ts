import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { datasets, analyses } from "@db/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

// ======== 数据分析引擎 ========

type DataRow = Record<string, string | number | null>;
type ColumnInfo = { name: string; type: "string" | "number" | "date" };

function detectColumns(data: DataRow[]): ColumnInfo[] {
  if (!data || data.length === 0) return [];
  const firstRow = data[0];
  return Object.keys(firstRow).map((key) => {
    const val = firstRow[key];
    if (typeof val === "number") return { name: key, type: "number" };
    if (typeof val === "string" && !isNaN(Date.parse(val)) && val.includes("-")) {
      return { name: key, type: "date" };
    }
    return { name: key, type: "string" };
  });
}

function parseValue(val: string | number | null, type: ColumnInfo["type"]): string | number | Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (type === "number") {
    const n = typeof val === "number" ? val : parseFloat(val);
    return isNaN(n) ? null : n;
  }
  if (type === "date") {
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  }
  return String(val);
}

interface AnalysisResult {
  type: "table" | "aggregate" | "filtered" | "sorted" | "top" | "summary";
  data: DataRow[];
  columns: string[];
  description: string;
  statistics?: Record<string, { sum?: number; avg?: number; min?: number; max?: number; count?: number }>;
}

function analyzeData(data: DataRow[], query: string, columns: ColumnInfo[]): AnalysisResult {
  const q = query.toLowerCase();
  
  // 检测分组聚合
  const groupMatch = q.match(/按(.+?)(分组|统计|汇总|聚合|计算)/);
  if (groupMatch || q.includes("分组") || q.includes("统计") || q.includes("汇总") || q.includes("各") || q.includes("每个")) {
    const groupKeyword = groupMatch ? groupMatch[1].trim() : detectGroupColumn(q, columns);
    const aggKeyword = detectAggColumn(q, columns);
    const aggType = detectAggType(q);
    
    if (groupKeyword) {
      const groupCol = findColumn(groupKeyword, columns);
      if (groupCol) {
        const result = groupBy(data, groupCol.name, aggKeyword, aggType, columns);
        return {
          type: "aggregate",
          data: result.rows,
          columns: result.columns,
          description: `按 ${groupCol.name} 分组${aggKeyword ? `，${aggType} ${aggKeyword}` : ""}，共 ${result.rows.length} 组`,
        };
      }
    }
  }

  // 检测筛选
  if (q.includes("筛选") || q.includes("过滤") || q.includes("找出") || q.includes("查询") || q.includes("where") || q.includes("大于") || q.includes("小于") || q.includes("等于") || q.includes("包含")) {
    const filtered = filterData(data, q, columns);
    return {
      type: "filtered",
      data: filtered,
      columns: Object.keys(data[0] || {}),
      description: `筛选结果：共 ${filtered.length} 条记录`,
    };
  }

  // 检测排序/Top
  if (q.includes("排序") || q.includes("前") || q.includes("top") || q.includes("最大") || q.includes("最高") || q.includes("最小") || q.includes("最低")) {
    const sortCol = detectSortColumn(q, columns);
    const isDesc = !q.includes("升序") && !q.includes("从小到大");
    const topN = detectTopN(q);
    
    let sorted = [...data];
    if (sortCol) {
      const colInfo = findColumn(sortCol, columns);
      sorted.sort((a, b) => {
        const va = parseValue(a[sortCol], colInfo?.type || "string");
        const vb = parseValue(b[sortCol], colInfo?.type || "string");
        if (va === null) return 1;
        if (vb === null) return -1;
        if (typeof va === "number" && typeof vb === "number") {
          return isDesc ? vb - va : va - vb;
        }
        return isDesc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
      });
    }
    
    const result = topN ? sorted.slice(0, topN) : sorted;
    return {
      type: topN ? "top" : "sorted",
      data: result,
      columns: Object.keys(data[0] || {}),
      description: topN 
        ? `前 ${topN} 条记录${sortCol ? `（按 ${sortCol} ${isDesc ? "降序" : "升序"}）` : ""}`
        : `按 ${sortCol || "未知列"} ${isDesc ? "降序" : "升序"}排序`,
    };
  }

  // 检测统计描述
  if (q.includes("统计") || q.includes("平均值") || q.includes("总和") || q.includes("最大") || q.includes("最小") || q.includes("多少") || q.includes("describe") || q.includes("summary")) {
    const stats = calculateStatistics(data, columns);
    const statsRows = Object.entries(stats).map(([col, s]) => ({
      字段: col,
      类型: columns.find(c => c.name === col)?.type || "unknown",
      记录数: String(s.count ?? 0),
      总和: s.sum !== undefined ? String(s.sum.toFixed(2)) : "-",
      平均值: s.avg !== undefined ? String(s.avg.toFixed(2)) : "-",
      最小值: s.min !== undefined ? String(s.min) : "-",
      最大值: s.max !== undefined ? String(s.max) : "-",
    }));
    return {
      type: "summary",
      data: statsRows,
      columns: ["字段", "类型", "记录数", "总和", "平均值", "最小值", "最大值"],
      description: `数据统计摘要：共 ${data.length} 条记录，${columns.length} 个字段`,
      statistics: stats,
    };
  }

  // 默认返回全部数据
  return {
    type: "table",
    data: data.slice(0, 100),
    columns: Object.keys(data[0] || {}),
    description: `数据预览：共 ${data.length} 条记录，显示前 100 条`,
  };
}

function detectGroupColumn(q: string, columns: ColumnInfo[]): string | null {
  for (const col of columns) {
    if (q.includes(col.name) || q.includes(col.name.toLowerCase())) return col.name;
  }
  // 常见分组词
  const groupWords = ["类别", "类型", "部门", "地区", "城市", "月份", "年份", "状态", "性别", "年级", "班级", "品类", "品牌"];
  for (const word of groupWords) {
    const col = columns.find(c => c.name.includes(word) || word.includes(c.name));
    if (col) return col.name;
  }
  return columns[0]?.name || null;
}

function detectAggColumn(q: string, columns: ColumnInfo[]): string | null {
  for (const col of columns) {
    if (col.type === "number" && (q.includes(col.name) || q.includes(col.name.toLowerCase()))) return col.name;
  }
  return columns.find(c => c.type === "number")?.name || null;
}

function detectAggType(q: string): "sum" | "avg" | "count" | "min" | "max" {
  if (q.includes("平均") || q.includes("均值")) return "avg";
  if (q.includes("计数") || q.includes("数量") || q.includes("个数") || q.includes("多少")) return "count";
  if (q.includes("最小") || q.includes("最低")) return "min";
  if (q.includes("最大") || q.includes("最高")) return "max";
  return "sum";
}

function detectSortColumn(q: string, columns: ColumnInfo[]): string | null {
  for (const col of columns) {
    if (q.includes(col.name) || q.includes(col.name.toLowerCase())) return col.name;
  }
  const numCol = columns.find(c => c.type === "number");
  return numCol?.name || columns[0]?.name || null;
}

function detectTopN(q: string): number | null {
  const match = q.match(/前(\d+)/);
  if (match) return parseInt(match[1]);
  if (q.includes("top10") || q.includes("top 10") || q.includes("前十名")) return 10;
  if (q.includes("top5") || q.includes("top 5") || q.includes("前五名")) return 5;
  return null;
}

function findColumn(name: string, columns: ColumnInfo[]): ColumnInfo | undefined {
  return columns.find(c => c.name === name || c.name.toLowerCase() === name.toLowerCase());
}

function groupBy(data: DataRow[], groupCol: string, aggCol: string | null, aggType: string, columns: ColumnInfo[]) {
  const groups = new Map<string, { rows: DataRow[]; values: number[] }>();
  
  for (const row of data) {
    const key = String(row[groupCol] ?? "未分类");
    if (!groups.has(key)) {
      groups.set(key, { rows: [], values: [] });
    }
    const g = groups.get(key)!;
    g.rows.push(row);
    if (aggCol) {
      const val = parseValue(row[aggCol], columns.find(c => c.name === aggCol)?.type || "string");
      if (typeof val === "number") g.values.push(val);
    }
  }

  const result: DataRow[] = [];
  const aggName = aggType === "sum" ? "总和" : aggType === "avg" ? "平均值" : aggType === "count" ? "计数" : aggType === "min" ? "最小值" : "最大值";
  
  for (const [key, g] of groups) {
    const row: DataRow = { [groupCol]: key, "_count": g.rows.length };
    if (aggCol && g.values.length > 0) {
      switch (aggType) {
        case "sum": row[aggName] = g.values.reduce((a, b) => a + b, 0); break;
        case "avg": row[aggName] = g.values.reduce((a, b) => a + b, 0) / g.values.length; break;
        case "count": row[aggName] = g.values.length; break;
        case "min": row[aggName] = Math.min(...g.values); break;
        case "max": row[aggName] = Math.max(...g.values); break;
      }
    }
    result.push(row);
  }

  return {
    rows: result,
    columns: aggCol ? [groupCol, aggName, "_count"] : [groupCol, "_count"],
  };
}

function filterData(data: DataRow[], q: string, columns: ColumnInfo[]): DataRow[] {
  // 简单筛选实现
  let result = [...data];
  
  for (const col of columns) {
    const colName = col.name;
    
    // 大于
    const gtMatch = q.match(new RegExp(`${colName}\s*(大于|>|超过|>\s*)\s*(\d+)`));
    if (gtMatch) {
      const threshold = parseFloat(gtMatch[2]);
      result = result.filter(r => {
        const val = parseValue(r[colName], "number");
        return typeof val === "number" && val > threshold;
      });
    }
    
    // 小于
    const ltMatch = q.match(new RegExp(`${colName}\s*(小于|<|低于|<\s*)\s*(\d+)`));
    if (ltMatch) {
      const threshold = parseFloat(ltMatch[2]);
      result = result.filter(r => {
        const val = parseValue(r[colName], "number");
        return typeof val === "number" && val < threshold;
      });
    }
    
    // 等于
    const eqPatterns = [
      new RegExp(`${colName}\s*(等于|是|为)\s*["']?([^"']+)["']?`),
      new RegExp(`${colName}\s*=\s*["']?([^"']+)["']?`),
    ];
    for (const pattern of eqPatterns) {
      const eqMatch = q.match(pattern);
      if (eqMatch) {
        const target = eqMatch[2] || eqMatch[1];
        result = result.filter(r => String(r[colName]) === target);
      }
    }
    
    // 包含
    const containsMatch = q.match(new RegExp(`${colName}\s*(包含|有)\s*["']?([^"']+)["']?`));
    if (containsMatch) {
      const target = containsMatch[2];
      result = result.filter(r => String(r[colName]).includes(target));
    }
  }
  
  return result;
}

function calculateStatistics(data: DataRow[], columns: ColumnInfo[]) {
  const stats: Record<string, { sum?: number; avg?: number; min?: number; max?: number; count?: number }> = {};
  
  for (const col of columns) {
    if (col.type !== "number") {
      stats[col.name] = { count: data.filter(r => r[col.name] !== null && r[col.name] !== "").length };
      continue;
    }
    
    const values: number[] = [];
    for (const row of data) {
      const val = parseValue(row[col.name], "number");
      if (typeof val === "number") values.push(val);
    }
    
    if (values.length > 0) {
      stats[col.name] = {
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
  }
  
  return stats;
}

function detectChartType(result: AnalysisResult): string | undefined {
  if (result.type === "aggregate" && result.data.length > 1 && result.data.length <= 20) {
    return "bar";
  }
  if (result.type === "top" || (result.type === "sorted" && result.data.length <= 20)) {
    return "bar";
  }
  if (result.type === "summary") {
    return "bar";
  }
  return undefined;
}

// ======== 文件解析 ========

function parseCSV(text: string): DataRow[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const result: DataRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: DataRow = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      const numVal = parseFloat(val);
      row[h] = !isNaN(numVal) && val !== "" ? numVal : val === "" ? null : val;
    });
    result.push(row);
  }
  
  return result;
}

function parseExcel(buffer: Buffer): DataRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number)[][];
  
  if (jsonData.length < 2) return [];
  
  const headers = jsonData[0].map(h => String(h).trim());
  const result: DataRow[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const row: DataRow = {};
    headers.forEach((h, idx) => {
      const val = jsonData[i][idx];
      row[h] = val === undefined || val === "" ? null : typeof val === "number" ? val : String(val);
    });
    result.push(row);
  }
  
  return result;
}

function generateExcel(data: DataRow[], columns: string[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "分析结果");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// ======== tRPC Router ========

export const dataRouter = createRouter({
  upload: publicQuery
    .input(z.object({
      name: z.string(),
      content: z.string(),
      fileType: z.enum(["csv", "xlsx", "json"]),
    }))
    .mutation(async ({ input }) => {
      let parsed: DataRow[];
      
      if (input.fileType === "csv") {
        parsed = parseCSV(input.content);
      } else if (input.fileType === "xlsx") {
        parsed = parseExcel(Buffer.from(input.content, "base64"));
      } else {
        parsed = JSON.parse(input.content);
      }
      
      const columns = detectColumns(parsed);
      
      const [{ id }] = await getDb().insert(datasets).values({
        name: input.name,
        originalName: input.name,
        columns: columns.map(c => c.name),
        rowCount: parsed.length,
        data: parsed.slice(0, 1000), // 只存储前1000行
      }).$returningId();
      
      const dataset = await getDb().query.datasets.findFirst({
        where: eq(datasets.id, id),
      });
      
      return { id, dataset };
    }),

  list: publicQuery.query(async () => {
    return getDb().query.datasets.findMany({
      orderBy: (datasets, { desc }) => [desc(datasets.createdAt)],
    });
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getDb().query.datasets.findFirst({
        where: eq(datasets.id, input.id),
      });
    }),

  analyze: publicQuery
    .input(z.object({
      datasetId: z.number(),
      query: z.string(),
    }))
    .mutation(async ({ input }) => {
      const dataset = await getDb().query.datasets.findFirst({
        where: eq(datasets.id, input.datasetId),
      });
      
      if (!dataset) throw new Error("数据集不存在");
      
      const data = dataset.data as DataRow[];
      const columns = detectColumns(data);
      const result = analyzeData(data, input.query, columns);
      const chartType = detectChartType(result);
      
      const [{ id }] = await getDb().insert(analyses).values({
        datasetId: input.datasetId,
        query: input.query,
        result: result as any,
        chartType: chartType || null,
        status: "completed",
      }).$returningId();
      
      return { id, result, chartType };
    }),

  getAnalyses: publicQuery
    .input(z.object({ datasetId: z.number() }))
    .query(async ({ input }) => {
      return getDb().query.analyses.findMany({
        where: eq(analyses.datasetId, input.datasetId),
        orderBy: (analyses, { desc }) => [desc(analyses.createdAt)],
      });
    }),

  generateReport: publicQuery
    .input(z.object({
      datasetId: z.number(),
      format: z.enum(["xlsx", "csv", "json"]),
      analysisId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const dataset = await getDb().query.datasets.findFirst({
        where: eq(datasets.id, input.datasetId),
      });
      
      if (!dataset) throw new Error("数据集不存在");
      
      let data = dataset.data as DataRow[];
      let columns = Object.keys(data[0] || {});
      
      if (input.analysisId) {
        const analysis = await getDb().query.analyses.findFirst({
          where: eq(analyses.id, input.analysisId),
        });
        if (analysis && analysis.result) {
          const result = analysis.result as any;
          data = result.data || data;
          columns = result.columns || columns;
        }
      }
      
      let content: string | Buffer;
      let mimeType: string;
      let extension: string;
      
      if (input.format === "xlsx") {
        content = generateExcel(data, columns);
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        extension = "xlsx";
      } else if (input.format === "csv") {
        const lines = [columns.join(",")];
        for (const row of data) {
          lines.push(columns.map(c => {
            const val = row[c];
            return val === null || val === undefined ? "" : String(val).includes(",") ? `"${val}"` : String(val);
          }).join(","));
        }
        content = lines.join("\n");
        mimeType = "text/csv";
        extension = "csv";
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
        extension = "json";
      }
      
      return {
        content: typeof content === "string" ? content : content.toString("base64"),
        isBase64: typeof content !== "string",
        mimeType,
        extension,
        filename: `${dataset.name}_分析报表.${extension}`,
      };
    }),

  deleteDataset: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(analyses).where(eq(analyses.datasetId, input.id));
      await getDb().delete(datasets).where(eq(datasets.id, input.id));
      return { success: true };
    }),
});

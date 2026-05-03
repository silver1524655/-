import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface DataTableProps {
  data: Record<string, string | number>[];
  columns: string[];
  maxRows?: number;
}

export default function DataTable({ data, columns, maxRows = 50 }: DataTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = maxRows;
  const totalPages = Math.ceil(data.length / pageSize);
  const paginated = data.slice(page * pageSize, (page + 1) * pageSize);

  if (!data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {paginated.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {row[col] === null || row[col] === undefined ? (
                    <span className="text-gray-300">-</span>
                  ) : typeof row[col] === "number" ? (
                    <span className="font-mono tabular-nums">
                      {Number.isInteger(row[col]) ? row[col] : Number(row[col]).toFixed(2)}
                    </span>
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-2">
          <span className="text-xs text-gray-500">
            共 {data.length} 条，第 {page + 1}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

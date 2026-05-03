import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";

interface ChartDisplayProps {
  data: Record<string, string | number>[];
  columns: string[];
  chartType: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function ChartDisplay({ data, columns, chartType }: ChartDisplayProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 自动检测适合作为X轴的列（字符串列）
    const stringCols = columns.filter(c => {
      const val = data[0]?.[c];
      return typeof val === "string" || typeof val === "undefined" || val === null;
    });
    const xCol = stringCols[0] || columns[0];
    
    // 自动检测数值列
    const numCols = columns.filter(c => {
      const val = data.find(r => r[c] !== null)?.[c];
      return typeof val === "number";
    });

    return data.map((row, i) => {
      const entry: Record<string, any> = {
        name: String(row[xCol] ?? `项${i + 1}`),
        _index: i,
      };
      numCols.forEach(col => {
        const val = row[col];
        entry[col] = typeof val === "number" ? val : 0;
      });
      return entry;
    });
  }, [data, columns]);

  const numColumns = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(k => k !== "name" && k !== "_index");
  }, [chartData]);

  if (chartData.length === 0) return null;

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                formatter={(value: any) => [typeof value === "number" ? value.toFixed(2) : value, ""]}
              />
              {numColumns.map((col, i) => (
                <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey={numColumns[0] || "value"}
                nameKey="name"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              />
              {numColumns.map((col, i) => (
                <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">可视化图表</h4>
      {renderChart()}
    </div>
  );
}

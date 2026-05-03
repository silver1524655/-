import { Database, Trash2, ChevronRight, BarChart3, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";

interface DatasetListProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function DatasetList({ selectedId, onSelect }: DatasetListProps) {
  const { data: datasets, isLoading, refetch } = trpc.data.list.useQuery();
  const deleteMutation = trpc.data.deleteDataset.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!datasets || datasets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无数据集</p>
        <p className="text-xs mt-1">请先上传数据文件</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">数据集列表</h3>
        <span className="text-xs text-gray-400">{datasets.length} 个</span>
      </div>
      {datasets.map((dataset) => (
        <Card
          key={dataset.id}
          onClick={() => onSelect(dataset.id)}
          className={`p-3 cursor-pointer transition-all hover:shadow-md ${
            selectedId === dataset.id
              ? "border-blue-500 bg-blue-50 shadow-sm"
              : "border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Database className={`w-4 h-4 ${selectedId === dataset.id ? "text-blue-600" : "text-gray-400"}`} />
                <p className="text-sm font-medium text-gray-900 truncate">{dataset.name}</p>
              </div>
              <div className="flex items-center gap-3 mt-1.5 ml-6">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Table2 className="w-3 h-3" />
                  {dataset.rowCount} 行
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {(dataset.columns as string[]).length} 列
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-6">
                {new Date(dataset.createdAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {selectedId === dataset.id && (
                <ChevronRight className="w-4 h-4 text-blue-500" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("确定要删除此数据集吗？相关的分析记录也将被删除。")) {
                    deleteMutation.mutate({ id: dataset.id });
                  }
                }}
                className="p-1 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                style={{ opacity: 1 }}
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

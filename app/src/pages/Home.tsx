import { useState } from "react";
import { LayoutDashboard, Database, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DataUpload from "@/components/DataUpload";
import DatasetList from "@/components/DatasetList";
import AnalysisPanel from "@/components/AnalysisPanel";
import DataTable from "@/components/DataTable";
import ReportDownload from "@/components/ReportDownload";
import { trpc } from "@/providers/trpc";

export default function Home() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const { data: selectedDataset } = trpc.data.getById.useQuery(
    { id: selectedDatasetId! },
    { enabled: !!selectedDatasetId }
  );

  const { refetch: refetchDatasets } = trpc.data.list.useQuery();

  const handleUploadSuccess = () => {
    setShowUpload(false);
    refetchDatasets();
  };

  const datasetData = selectedDataset?.data as Record<string, string | number>[] | undefined;
  const datasetColumns = selectedDataset?.columns as string[] | undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">数据分析 Agent</h1>
                <p className="text-xs text-gray-500 -mt-0.5">自然语言驱动的智能数据分析</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(!showUpload)}
                className="gap-2"
              >
                <Database className="w-4 h-4" />
                {showUpload ? "关闭上传" : "上传数据"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Upload Section */}
        {showUpload && (
          <div className="mb-6">
            <DataUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Dataset List */}
          <div className="lg:col-span-3">
            <Card className="p-4 h-fit">
              <DatasetList
                selectedId={selectedDatasetId}
                onSelect={setSelectedDatasetId}
              />
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-6">
            {/* Data Preview */}
            {selectedDataset && datasetData && datasetColumns && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-gray-500" />
                    <h2 className="text-sm font-semibold text-gray-800">
                      数据预览：{selectedDataset.name}
                    </h2>
                    <span className="text-xs text-gray-400">
                      {selectedDataset.rowCount} 行 × {datasetColumns.length} 列
                    </span>
                  </div>
                  <ReportDownload datasetId={selectedDataset.id} />
                </div>
                <DataTable
                  data={datasetData}
                  columns={datasetColumns}
                  maxRows={15}
                />
              </Card>
            )}

            {/* Analysis Panel */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-800">智能分析</h2>
              </div>
              <AnalysisPanel datasetId={selectedDatasetId} />
            </Card>

            {/* Empty State */}
            {!selectedDatasetId && (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Database className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-base font-medium text-gray-700">开始数据分析</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  上传数据文件或从左侧选择已有数据集，然后使用自然语言指令进行分析
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUpload(true)}
                  >
                    上传数据文件
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

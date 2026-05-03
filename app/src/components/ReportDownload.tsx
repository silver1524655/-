import { useState } from "react";
import { FileSpreadsheet, FileText, FileJson, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

interface ReportDownloadProps {
  datasetId: number;
  analysisId?: number;
}

export default function ReportDownload({ datasetId, analysisId }: ReportDownloadProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const generateMutation = trpc.data.generateReport.useMutation();

  const handleDownload = async (format: "xlsx" | "csv" | "json") => {
    setDownloading(format);
    setDownloaded(null);

    try {
      const result = await generateMutation.mutateAsync({
        datasetId,
        format,
        analysisId,
      });

      let blob: Blob;
      if (result.isBase64) {
        const byteString = atob(result.content);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: result.mimeType });
      } else {
        blob = new Blob([result.content], { type: result.mimeType });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloaded(format);
      setTimeout(() => setDownloaded(null), 2000);
    } catch (err: any) {
      alert("下载失败：" + (err.message || "未知错误"));
    } finally {
      setDownloading(null);
    }
  };

  const formats = [
    { key: "xlsx" as const, label: "Excel", icon: FileSpreadsheet, color: "text-green-600 hover:bg-green-50" },
    { key: "csv" as const, label: "CSV", icon: FileText, color: "text-blue-600 hover:bg-blue-50" },
    { key: "json" as const, label: "JSON", icon: FileJson, color: "text-yellow-600 hover:bg-yellow-50" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 mr-1">导出报表：</span>
      {formats.map((fmt) => {
        const Icon = fmt.icon;
        const isDownloading = downloading === fmt.key;
        const isDownloaded = downloaded === fmt.key;

        return (
          <Button
            key={fmt.key}
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(fmt.key)}
            disabled={!!downloading}
            className={`text-xs gap-1.5 h-8 ${fmt.color}`}
          >
            {isDownloading ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isDownloaded ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {isDownloaded ? "已下载" : fmt.label}
          </Button>
        );
      })}
    </div>
  );
}

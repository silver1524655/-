import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, FileJson, FileText, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";

interface DataUploadProps {
  onUploadSuccess: () => void;
}

export default function DataUpload({ onUploadSuccess }: DataUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = trpc.data.upload.useMutation();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fileList = Array.from(e.dataTransfer.files).filter(
        f => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".json")
      );
      setFiles(fileList);
      setError(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileList = Array.from(e.target.files).filter(
        f => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".json")
      );
      setFiles(fileList);
      setError(null);
    }
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".csv")) return <FileText className="w-5 h-5 text-green-500" />;
    if (filename.endsWith(".xlsx")) return <FileSpreadsheet className="w-5 h-5 text-blue-500" />;
    if (filename.endsWith(".json")) return <FileJson className="w-5 h-5 text-yellow-500" />;
    return <FileText className="w-5 h-5" />;
  };

  const getFileType = (filename: string): "csv" | "xlsx" | "json" => {
    if (filename.endsWith(".csv")) return "csv";
    if (filename.endsWith(".xlsx")) return "xlsx";
    return "json";
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const fileType = getFileType(file.name);
        let content: string;

        if (fileType === "xlsx") {
          const arrayBuffer = await file.arrayBuffer();
          content = Buffer.from(arrayBuffer).toString("base64");
        } else {
          content = await file.text();
        }

        await uploadMutation.mutateAsync({
          name: file.name.replace(/\.[^/.]+$/, ""),
          content,
          fileType,
        });
      }
      setFiles([]);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="p-6 border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
      <div
        className={`relative rounded-lg p-8 text-center transition-all ${
          dragActive ? "bg-blue-50 border-blue-400" : "bg-gray-50/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.json"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              拖拽文件到此处，或<span className="text-blue-600">点击上传</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">支持 CSV、Excel (.xlsx)、JSON 格式</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
              <div className="flex items-center gap-3">
                {getFileIcon(file.name)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                上传中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                开始上传
              </span>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}

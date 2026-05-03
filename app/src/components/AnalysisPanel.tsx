import { useState } from "react";
import { Send, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import DataTable from "./DataTable";
import ChartDisplay from "./ChartDisplay";
import ReportDownload from "./ReportDownload";

interface AnalysisPanelProps {
  datasetId: number | null;
}

interface AnalysisMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  result?: {
    type: string;
    data: Record<string, string | number>[];
    columns: string[];
    description: string;
    statistics?: Record<string, any>;
  };
  chartType?: string | null;
  analysisId?: number;
}

const SUGGESTIONS = [
  "数据统计摘要",
  "按类别分组统计总和",
  "筛选出销售额大于1000的记录",
  "按销售额降序排列，显示前10名",
  "各地区的平均值统计",
];

export default function AnalysisPanel({ datasetId }: AnalysisPanelProps) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeMutation = trpc.data.analyze.useMutation();

  const handleAnalyze = async () => {
    if (!query.trim() || !datasetId || isAnalyzing) return;

    const userQuery = query.trim();
    setQuery("");
    setIsAnalyzing(true);

    const userMessage: AnalysisMessage = {
      id: Date.now(),
      role: "user",
      content: userQuery,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await analyzeMutation.mutateAsync({
        datasetId,
        query: userQuery,
      });

      const assistantMessage: AnalysisMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: result.result.description || "分析完成",
        result: result.result as any,
        chartType: result.chartType,
        analysisId: result.id,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: AnalysisMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `分析出错：${err.message || "未知错误"}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
  };

  if (!datasetId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center text-gray-400">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">请从左侧选择一个数据集</p>
          <p className="text-xs mt-1">然后输入自然语言指令进行数据分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[500px]">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-blue-200" />
              <h3 className="text-lg font-semibold text-gray-800">数据分析助手</h3>
              <p className="text-sm text-gray-500 mt-1">输入自然语言指令，AI 将自动分析数据</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="text-left text-sm p-3 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    {s}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-gray-200"} rounded-2xl px-4 py-3`}>
              <p className="text-sm">{msg.content}</p>
              
              {msg.result && msg.result.data && msg.result.data.length > 0 && (
                <div className="mt-3 space-y-3">
                  <DataTable
                    data={msg.result.data}
                    columns={msg.result.columns}
                    maxRows={10}
                  />
                  
                  {msg.chartType && (
                    <ChartDisplay
                      data={msg.result.data}
                      columns={msg.result.columns}
                      chartType={msg.chartType}
                    />
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <ReportDownload
                      datasetId={datasetId}
                      analysisId={msg.analysisId}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isAnalyzing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">正在分析数据...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <Card className="p-3 border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="输入分析指令，例如：按地区统计销售额..."
            className="flex-1 text-sm px-3 py-2 bg-gray-50 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-400"
          />
          <Button
            onClick={handleAnalyze}
            disabled={!query.trim() || isAnalyzing}
            size="sm"
            className="shrink-0"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export interface DebugPanelProps {
  logs: string[];
  onCopy: () => void;
}

export function DebugPanel({ logs, onCopy }: DebugPanelProps) {
  return (
    <div className="bg-black border-b border-gray-700 p-2 max-h-48 overflow-y-auto font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-green-400">Debug Logs (copy and share with AI)</span>
        <button
          onClick={onCopy}
          className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
        >
          Copy All
        </button>
      </div>
      {logs.map((log, i) => (
        <div key={i} className="text-gray-300 whitespace-pre-wrap break-all">
          {log}
        </div>
      ))}
      {logs.length === 0 && (
        <div className="text-gray-500">No logs yet...</div>
      )}
    </div>
  );
}

import { useState } from "react";
import { exportBookmarks } from "../api/client";

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function ExportButtons() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: "json" | "netscape") => {
    setExporting(format);
    try {
      const blob = await exportBookmarks(format);
      const filename = format === "json" ? "lumina-bookmarks.json" : "lumina-bookmarks.html";
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => handleExport("json")}
        disabled={exporting === "json"}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {exporting === "json" ? "Exporting…" : "Export JSON"}
      </button>
      <button
        onClick={() => handleExport("netscape")}
        disabled={exporting === "netscape"}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {exporting === "netscape" ? "Exporting…" : "Export Netscape HTML"}
      </button>
    </div>
  );
}

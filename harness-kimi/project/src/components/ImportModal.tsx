import { useState, useRef, useCallback } from "react";
import { importBookmarks, fetchImportStatus } from "../api/client";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setUploading(false);
    setProgress(0);
    setStatusText("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pollStatus = useCallback(async (taskId: string) => {
    const poll = async () => {
      try {
        const data = await fetchImportStatus(taskId);
        const pct = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
        setProgress(pct);
        setStatusText(`${data.processed} / ${data.total} processed`);
        if (data.status === "done") {
          setUploading(false);
          setStatusText(`Import complete — ${data.processed} bookmarks imported`);
          setTimeout(() => {
            onImportComplete();
            handleClose();
          }, 1200);
          return;
        }
        if (data.status === "failed") {
          setUploading(false);
          setStatusText(data.error_detail || "Import failed");
          return;
        }
        setTimeout(poll, 800);
      } catch {
        setUploading(false);
        setStatusText("Failed to poll import status");
      }
    };
    poll();
  }, [onImportComplete]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setStatusText("Uploading…");
    try {
      const result = await importBookmarks(file);
      if (result.task_id) {
        setStatusText("Processing…");
        pollStatus(result.task_id);
      } else {
        const count = result.imported || 0;
        setProgress(100);
        setStatusText(`Import complete — ${count} bookmarks imported`);
        setUploading(false);
        setTimeout(() => {
          onImportComplete();
          handleClose();
        }, 800);
      }
    } catch (err: any) {
      setUploading(false);
      setStatusText(err.message || "Upload failed");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".html") || f.name.endsWith(".htm"))) {
      setFile(f);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Import Bookmarks</h3>
        <p className="mb-4 text-sm text-slate-400">
          Upload a Netscape HTML bookmark file exported from Chrome or Firefox.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragOver
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-slate-700 bg-slate-950/50 hover:border-slate-600",
          ].join(" ")}
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5 text-slate-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-300">
            {file ? file.name : "Drop a .html file or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Netscape Bookmark format</p>
          <input
            ref={inputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{statusText}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!uploading && statusText && (
          <div className="mt-4 text-center text-sm text-slate-300">{statusText}</div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            Close
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

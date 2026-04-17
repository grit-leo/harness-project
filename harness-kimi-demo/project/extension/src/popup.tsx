import { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { suggestTags, saveBookmark } from "./api";
import "./index.css";

function Popup() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [noToken, setNoToken] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("lumina_access_token", (result) => {
      if (!result.lumina_access_token) {
        setNoToken(true);
      }
    });

    chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (tab) => {
      if (tab) {
        setTitle(tab.title || "");
        setUrl(tab.url || "");
      }
    });
  }, []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const fetchTags = async () => {
      setLoadingTags(true);
      try {
        const tags = await suggestTags(url, title);
        if (!cancelled) {
          setSuggestedTags(tags);
          setSelectedTags(new Set(tags));
        }
      } catch {
        // silently fail tags
      } finally {
        if (!cancelled) setLoadingTags(false);
      }
    };
    fetchTags();
    return () => {
      cancelled = true;
    };
  }, [url, title]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const addCustomTag = useCallback(() => {
    const t = customTag.trim().toLowerCase();
    if (!t) return;
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.add(t);
      return next;
    });
    setSuggestedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomTag("");
  }, [customTag]);

  const handleSave = async () => {
    if (!url || !title) return;
    setSaving(true);
    setStatus("idle");
    try {
      await saveBookmark({
        url,
        title,
        tags: Array.from(selectedTags),
      });
      setStatus("success");
      setStatusMsg("Saved!");
      setTimeout(() => window.close(), 800);
    } catch (err: any) {
      setStatus("error");
      setStatusMsg(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 text-white shadow">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Lumina</h1>
          <p className="text-[10px] text-slate-500">Save to your library</p>
        </div>
      </div>

      {noToken && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
          Please log in to the Lumina web app first so the extension can authenticate.
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">Tags</label>
          {loadingTags && (
            <span className="text-[10px] text-slate-500">AI suggesting…</span>
          )}
        </div>

        {suggestedTags.length === 0 && !loadingTags ? (
          <p className="text-xs text-slate-600">No suggestions yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={[
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                    active
                      ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                      : "border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {active ? "✓ " : ""}
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
            placeholder="Add tag…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
          <button
            onClick={addCustomTag}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* Status */}
      {status !== "idle" && (
        <div
          className={[
            "rounded-xl px-3 py-2 text-center text-xs font-medium",
            status === "success"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border border-red-500/20 bg-red-500/10 text-red-300",
          ].join(" ")}
        >
          {statusMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => window.close()}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !url || !title}
          className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Popup />);
}

import { useState, useEffect } from "react";
import {
  fetchSuggestedTags,
  fetchSuggestedTagsForUrl,
  type Bookmark,
  type BookmarkCreate,
} from "../api/client";

interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: BookmarkCreate) => void | Promise<void>;
  onApplyTags?: (id: string, tags: string[]) => Promise<void>;
  initialData?: Bookmark | null;
}

export function BookmarkModal({
  isOpen,
  onClose,
  onSubmit,
  onApplyTags,
  initialData,
}: BookmarkModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  const isEditing = !!initialData;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setUrl(initialData.url);
        setTitle(initialData.title);
        setSummary(initialData.summary);
        setTags(initialData.tags);
        setTagsInput(initialData.tags.join(", "));
        setSuggestedTags(initialData.suggestedTags || []);
        // Fetch fresh suggested tags from the API
        setLoadingSuggested(true);
        fetchSuggestedTags(initialData.id)
          .then((tags) => setSuggestedTags(tags))
          .catch(() => {
            // silently fail; keep any tags already in initialData
          })
          .finally(() => setLoadingSuggested(false));
      } else {
        setUrl("");
        setTitle("");
        setSummary("");
        setTags([]);
        setTagsInput("");
        setSuggestedTags([]);
        setLoadingSuggested(false);
      }
      setEditingIndex(null);
    }
  }, [isOpen, initialData]);

  // Auto-suggest tags for new bookmarks when URL + title are present
  useEffect(() => {
    if (!isOpen || isEditing) return;
    if (!url.trim() || !title.trim() || !url.trim().startsWith("http")) {
      setSuggestedTags([]);
      setLoadingSuggested(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingSuggested(true);
      fetchSuggestedTagsForUrl(url, title)
        .then((tags) => {
          if (!cancelled) setSuggestedTags(tags);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingSuggested(false);
        });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, title, isOpen, isEditing]);

  if (!isOpen) return null;

  const handleTagsInputChange = (val: string) => {
    setTagsInput(val);
    setTags(
      val
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && onApplyTags && initialData) {
      await onSubmit({ url, title, summary });
      await onApplyTags(initialData.id, tags);
    } else {
      await onSubmit({ url, title, summary, tags });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-slate-100">
          {isEditing ? "Edit bookmark" : "Add bookmark"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bookmark title"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description..."
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => handleTagsInputChange(e.target.value)}
              placeholder="design, inspiration, blog"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Separate tags with commas
            </p>
          </div>

          {(suggestedTags.length > 0 || loadingSuggested) && (
            <div>
              <label className="mb-2 block text-sm font-medium text-emerald-400">
                AI Suggested Tags
              </label>
              {loadingSuggested && suggestedTags.length === 0 && (
                <p className="text-xs text-slate-500">Generating suggestions…</p>
              )}
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag, idx) => (
                  <div
                    key={`${tag}-${idx}`}
                    className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300"
                  >
                    {editingIndex === idx ? (
                      <input
                        autoFocus
                        className="w-24 bg-transparent text-slate-200 outline-none"
                        value={tag}
                        onChange={(e) => {
                          const next = [...suggestedTags];
                          next[idx] = e.target.value;
                          setSuggestedTags(next);
                        }}
                        onBlur={() => setEditingIndex(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditingIndex(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => setEditingIndex(idx)}
                        title="Click to edit"
                      >
                        {tag}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!tags.includes(tag)) {
                          const newTags = [...tags, tag];
                          setTags(newTags);
                          setTagsInput(newTags.join(", "));
                        }
                        setSuggestedTags(suggestedTags.filter((_, i) => i !== idx));
                      }}
                      className="ml-1 font-semibold text-emerald-400 hover:text-emerald-300"
                      title="Accept"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSuggestedTags(suggestedTags.filter((_, i) => i !== idx))
                      }
                      className="text-slate-500 hover:text-slate-300"
                      title="Reject"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              {isEditing ? "Save changes" : "Add bookmark"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

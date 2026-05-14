import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchSuggestedTags,
  fetchSuggestedTagsForUrl,
  fetchMetadata,
  type Bookmark,
  type BookmarkCreate,
} from "../api/client";

interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: BookmarkCreate) => void | Promise<void>;
  onApplyTags?: (id: string, tags: string[]) => Promise<void>;
  onDelete?: (bookmark: Bookmark) => void | Promise<void>;
  initialData?: Bookmark | null;
}

export function BookmarkModal({
  isOpen,
  onClose,
  onSubmit,
  onApplyTags,
  onDelete,
  initialData,
}: BookmarkModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<{ url?: string; title?: string }>({});

  // Metadata fetch state
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadata, setMetadata] = useState<{
    title: string;
    description: string;
    thumbnail_url: string | null;
  } | null>(null);

  const isEditing = !!initialData;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fetchIdRef = useRef(0);
  const lastFetchedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset metadata fetch state when modal opens
      fetchIdRef.current += 1;
      lastFetchedUrlRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setFetchingMetadata(false);

      if (initialData) {
        setUrl(initialData.url);
        setTitle(initialData.title);
        setSummary(initialData.summary);
        setTags(initialData.tags);
        setTagsInput(initialData.tags.join(", "));
        setSuggestedTags(initialData.suggestedTags || []);
        setMetadata(null);
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
        setMetadata(null);
      }
      setFetchingMetadata(false);
    }
  }, [isOpen, initialData]);



  const fetchMetadataForUrl = useCallback(async (urlValue: string) => {
    if (!urlValue.trim() || !urlValue.trim().startsWith("http")) {
      setMetadata(null);
      return;
    }
    if (lastFetchedUrlRef.current === urlValue) {
      return; // already fetched this URL
    }

    const fetchId = ++fetchIdRef.current;
    lastFetchedUrlRef.current = urlValue;
    setFetchingMetadata(true);
    try {
      const result = await fetchMetadata(urlValue);
      if (fetchId === fetchIdRef.current) {
        setMetadata(result);
        // Pre-fill title/summary only if currently empty
        setTitle((prev) => (prev.trim() ? prev : result.title));
        setSummary((prev) => (prev.trim() ? prev : result.description));
      }
    } catch {
      if (fetchId === fetchIdRef.current) {
        setMetadata(null);
      }
      if (fetchId === fetchIdRef.current) {
        lastFetchedUrlRef.current = null;
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setFetchingMetadata(false);
      }
    }
  }, []);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));

    if (!isEditing) {
      // Always clear metadata when URL changes to avoid stale previews (BUG-003)
      setMetadata(null);
      lastFetchedUrlRef.current = null;
      // Invalidate any in-flight fetch for a previous URL
      fetchIdRef.current += 1;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (value.trim().startsWith("http")) {
        debounceTimerRef.current = setTimeout(() => {
          const currentUrl = urlInputRef.current?.value || value;
          fetchMetadataForUrl(currentUrl);
        }, 800);
      }
    }
  };

  const handleUrlBlur = () => {
    if (!isEditing) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const currentUrl = urlInputRef.current?.value || url;
      if (currentUrl.trim().startsWith("http")) {
        fetchMetadataForUrl(currentUrl);
      }
    }
  };

  if (!isOpen) return null;

  const handleSuggestTags = async () => {
    if (!title.trim()) return;
    setLoadingSuggested(true);
    setSuggestError(null);
    const startTime = Date.now();
    try {
      const tags = await fetchSuggestedTagsForUrl(url, title, summary);
      // Ensure spinner is visible for at least 400 ms so users can perceive it
      const elapsed = Date.now() - startTime;
      const minDelay = 400;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      }
      setSuggestedTags(tags);
    } catch {
      setSuggestError("Failed to load suggestions. Try again.");
    } finally {
      setLoadingSuggested(false);
    }
  };

  const handleApplyAllSuggested = () => {
    const newTags = [...tags];
    for (const tag of suggestedTags) {
      if (!newTags.includes(tag)) {
        newTags.push(tag);
      }
    }
    setTags(newTags);
    setTagsInput(newTags.join(", "));
    setSuggestedTags([]);
  };

  const handleTagsInputChange = (val: string) => {
    setTagsInput(val);
    setTags(
      val
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    );
  };

  const validate = (): boolean => {
    const nextErrors: { url?: string; title?: string } = {};
    if (!url.trim()) {
      nextErrors.url = "URL is required";
    } else {
      try {
        const u = new URL(url.trim());
        if (!u.protocol.startsWith("http")) {
          nextErrors.url = "URL must start with http:// or https://";
        }
      } catch {
        nextErrors.url = "Please enter a valid URL";
      }
    }
    if (!title.trim()) {
      nextErrors.title = "Title is required";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload: BookmarkCreate = {
        url,
        title,
        summary,
        tags,
        thumbnailUrl: metadata?.thumbnail_url || undefined,
      };
      if (isEditing && onApplyTags && initialData) {
        await onSubmit({ url, title, summary, thumbnailUrl: metadata?.thumbnail_url || undefined });
        await onApplyTags(initialData.id, tags);
      } else {
        await onSubmit(payload);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData || !onDelete) return;
    if (!confirm("Are you sure you want to delete this bookmark?")) return;
    setIsDeleting(true);
    try {
      await onDelete(initialData);
    } finally {
      setIsDeleting(false);
    }
  };

  const showPreview = !!metadata || fetchingMetadata;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-slate-100">
          {isEditing ? "Edit bookmark" : "Add bookmark"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              URL
            </label>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://example.com"
              className={[
                "w-full rounded-lg border bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:ring-1",
                errors.url
                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500",
              ].join(" ")}
            />
            {errors.url && (
              <p className="mt-1 text-xs text-red-400">{errors.url}</p>
            )}
          </div>

          {showPreview && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              {fetchingMetadata ? (
                <div className="space-y-2">
                  <div className="aspect-video w-full animate-pulse rounded-lg bg-slate-800" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
                </div>
              ) : metadata ? (
                <div className="flex items-start gap-3">
                  {metadata.thumbnail_url ? (
                    <img
                      src={metadata.thumbnail_url}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-lg object-cover bg-slate-800"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-16 w-28 shrink-0 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 line-clamp-2">
                      {metadata.title || "No title found"}
                    </p>
                    {metadata.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {metadata.description}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Bookmark title"
              className={[
                "w-full rounded-lg border bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:ring-1",
                errors.title
                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500",
              ].join(" ")}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-400">{errors.title}</p>
            )}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-400">
                Tags
              </label>
              {title.trim().length > 0 && !isEditing && (
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={loadingSuggested}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingSuggested && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
                  )}
                  Suggest tags with AI
                </button>
              )}
            </div>
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

          {(suggestedTags.length > 0 || loadingSuggested || suggestError) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-emerald-400">
                  AI Suggested Tags
                </label>
                {suggestedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyAllSuggested}
                    className="text-xs font-medium text-emerald-300 hover:text-emerald-200 rounded-full border border-emerald-500/30 px-2.5 py-0.5 transition-colors hover:bg-emerald-500/10"
                  >
                    Apply all
                  </button>
                )}
              </div>
              {loadingSuggested && (
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
                  Generating suggestions…
                </div>
              )}
              {suggestError && (
                <p className="mb-2 text-xs text-red-400">{suggestError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 rounded-full border border-dashed border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                  >
                    <span>{tag}</span>
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

          <div className="flex items-center justify-between gap-3 pt-2">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeleting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                )}
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {isSubmitting
                  ? isEditing
                    ? "Saving…"
                    : "Adding…"
                  : isEditing
                  ? "Save changes"
                  : "Add bookmark"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

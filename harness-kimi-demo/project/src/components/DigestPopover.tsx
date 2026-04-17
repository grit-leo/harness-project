import { useState, useEffect, useRef } from "react";
import { fetchDigest, markDigestSeen, type DigestItem } from "../api/client";

export function DigestPopover() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDigest();
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unseenCount = items.filter((i) => !i.seen).length;

  const handleMarkSeen = async () => {
    try {
      await markDigestSeen();
      setItems((prev) => prev.map((i) => ({ ...i, seen: true })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const grouped = items.reduce<Record<string, DigestItem[]>>((acc, item) => {
    const key = item.sourceCollectionId
      ? `collection-${item.sourceCollectionId}`
      : item.sourceUserId
      ? `user-${item.sourceUserId}`
      : "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-200"
        aria-label="Digest"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unseenCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-slate-950">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">Digest</h3>
            {unseenCount > 0 && (
              <button
                onClick={handleMarkSeen}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Mark all seen
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {loading && items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-500">Loading…</p>
            ) : error ? (
              <p className="px-2 py-4 text-center text-xs text-red-400">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-500">No new items.</p>
            ) : (
              Object.entries(grouped).map(([key, groupItems]) => (
                <div key={key} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {key.startsWith("collection-") ? "Collection" : key.startsWith("user-") ? "User" : "Other"}
                  </p>
                  {groupItems.map((item) => (
                    <div
                      key={item.id}
                      className={[
                        "rounded-lg px-2 py-1.5 text-xs",
                        item.seen ? "text-slate-500" : "text-slate-300",
                      ].join(" ")}
                    >
                      <span className="font-mono text-[10px] text-slate-600">{item.bookmarkId.slice(0, 8)}</span>
                      <span className="ml-1">new bookmark</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

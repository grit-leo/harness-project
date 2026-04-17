import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookmarkCard } from "../components/BookmarkCard";
import { BookmarkModal } from "../components/BookmarkModal";
import {
  fetchCollections,
  fetchCollectionBookmarks,
  createCollection,
  deleteCollection,
  createBookmark,
  type Collection,
  type Bookmark,
  type Condition,
  type BookmarkCreate,
} from "../api/client";

export function CollectionsPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderOperator, setBuilderOperator] = useState<"AND" | "OR">("AND");
  const [builderConditions, setBuilderConditions] = useState<Condition[]>([
    { field: "tag", op: "equals", value: "" },
  ]);
  const [modalOpen, setModalOpen] = useState(false);

  const loadCollections = async () => {
    try {
      const data = await fetchCollections();
      setCollections(data);
      if (data.length && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchCollectionBookmarks(selectedId);
        if (!cancelled) setBookmarks(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load bookmarks");
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  const selectedCollection = collections.find((c) => c.id === selectedId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validConditions = builderConditions.filter(
      (c) => String(c.value).trim().length > 0
    );
    if (!builderName.trim() || validConditions.length === 0) return;
    try {
      const created = await createCollection({
        name: builderName.trim(),
        rules: {
          operator: builderOperator,
          conditions: validConditions,
        },
      });
      setCollections((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setBuilderOpen(false);
      setBuilderName("");
      setBuilderOperator("AND");
      setBuilderConditions([{ field: "tag", op: "equals", value: "" }]);
    } catch (err: any) {
      setError(err.message || "Failed to create collection");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this collection?")) return;
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete collection");
    }
  };

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    setBuilderConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  return (
    <div className="min-h-svh bg-slate-950">
      <header className="border-b border-slate-800/60 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100">
                Lumina
              </h1>
              <p className="text-xs text-slate-500">Collections</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Library
            </Link>
            <Link
              to="/settings"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Settings
            </Link>
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              Add bookmark
            </button>
            <button
              onClick={() => setBuilderOpen(true)}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
            >
              New collection
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading && collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
            <p className="text-slate-500">Loading collections…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar */}
            <aside className="w-full shrink-0 lg:w-72">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-300">
                  Your Collections
                </h2>
                <ul className="space-y-2">
                  {collections.map((c) => {
                    const active = c.id === selectedId;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className={[
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            active
                              ? "bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/30"
                              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                          ].join(" ")}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.isDefault && (
                            <span className="ml-2 shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Default
                            </span>
                          )}
                        </button>
                        {!c.isDefault && active && (
                          <div className="mt-1 flex justify-end">
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {collections.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No collections yet.
                  </p>
                )}
              </div>
            </aside>

            {/* Main content */}
            <section className="flex-1">
              {selectedCollection ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">
                        {selectedCollection.name}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {bookmarks.length} bookmark
                        {bookmarks.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  {bookmarks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
                      <p className="text-sm text-slate-500">
                        No bookmarks match this collection’s rules.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                      {bookmarks.map((bm) => (
                        <BookmarkCard
                          key={bm.id}
                          bookmark={bm}
                          onTagClick={() => navigate("/")}
                          selectedTags={[]}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
                  <p className="text-sm text-slate-500">
                    Select a collection to view its bookmarks.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <BookmarkModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload: BookmarkCreate) => {
          await createBookmark(payload);
          setModalOpen(false);
          if (selectedId) {
            const data = await fetchCollectionBookmarks(selectedId);
            setBookmarks(data);
          }
          await loadCollections();
        }}
      />

      {/* Rule Builder Modal */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">
              New Collection
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="e.g., Weekend Reads"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-400">
                  Match operator
                </label>
                <div className="flex gap-2">
                  {(["AND", "OR"] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setBuilderOperator(op)}
                      className={[
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        builderOperator === op
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
                      ].join(" ")}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400">
                  Conditions
                </label>
                {builderConditions.map((cond, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center"
                  >
                    <select
                      value={cond.field}
                      onChange={(e) =>
                        updateCondition(idx, {
                          field: e.target.value as Condition["field"],
                          op:
                            e.target.value === "date"
                              ? "last_n_days"
                              : "equals",
                          value: "",
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                    >
                      <option value="tag">Tag</option>
                      <option value="domain">Domain</option>
                      <option value="date">Date</option>
                    </select>

                    <select
                      value={cond.op}
                      disabled={cond.field === "date"}
                      onChange={(e) =>
                        updateCondition(idx, {
                          op: e.target.value as Condition["op"],
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="equals">equals</option>
                      {cond.field === "date" && (
                        <option value="last_n_days">last N days</option>
                      )}
                    </select>

                    <input
                      type={cond.field === "date" ? "number" : "text"}
                      required
                      value={cond.value}
                      onChange={(e) =>
                        updateCondition(idx, {
                          value:
                            cond.field === "date"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                      placeholder={
                        cond.field === "date"
                          ? "7"
                          : cond.field === "domain"
                          ? "github.com"
                          : "design"
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setBuilderConditions((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="self-start rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                      title="Remove condition"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setBuilderConditions((prev) => [
                      ...prev,
                      { field: "tag", op: "equals", value: "" },
                    ])
                  }
                  className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                  + Add condition
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                >
                  Save collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

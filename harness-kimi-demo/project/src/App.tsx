import { useEffect, useState } from "react";
import { BookmarkCard } from "./components/BookmarkCard";
import { FilterBar } from "./components/FilterBar";
import { BookmarkModal } from "./components/BookmarkModal";
import { useBookmarkFilter } from "./hooks/useBookmarkFilter";
import { useAuth } from "./context/AuthContext";
import { Link } from "react-router-dom";
import {
  fetchBookmarks,
  fetchTags,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  applyTags,
  type Bookmark,
  type Tag,
  type BookmarkCreate,
} from "./api/client";

function App() {
  const { logout } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    clearFilters,
    filteredBookmarks,
  } = useBookmarkFilter(bookmarks);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [bms, tgs] = await Promise.all([
        fetchBookmarks(),
        fetchTags(),
      ]);
      setBookmarks(bms);
      setTags(tgs);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refetch when search or selected tags change (server-side filter support)
  useEffect(() => {
    let cancelled = false;
    const loadFiltered = async () => {
      try {
        const bms = await fetchBookmarks(
          searchQuery || undefined,
          selectedTags.length ? selectedTags : undefined
        );
        if (!cancelled) setBookmarks(bms);
      } catch {
        // silent fail; initial load handles errors
      }
    };
    loadFiltered();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedTags.join(",")]);

  const handleAdd = () => {
    setEditingBookmark(null);
    setModalOpen(true);
  };

  const handleEdit = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setModalOpen(true);
  };

  const handleDelete = async (bookmark: Bookmark) => {
    if (!confirm("Are you sure you want to delete this bookmark?")) return;
    try {
      await deleteBookmark(bookmark.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
    } catch (err: any) {
      setError(err.message || "Failed to delete bookmark");
    }
  };

  const handleModalSubmit = async (payload: BookmarkCreate) => {
    try {
      if (editingBookmark) {
        const updated = await updateBookmark(editingBookmark.id, payload);
        setBookmarks((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b))
        );
      } else {
        const created = await createBookmark(payload);
        setBookmarks((prev) => [created, ...prev]);
      }
      // Refresh tags in case new ones were created
      const freshTags = await fetchTags();
      setTags(freshTags);
      if (!editingBookmark) {
        setModalOpen(false);
        setEditingBookmark(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save bookmark");
    }
  };

  const handleApplyTags = async (id: string, tags: string[]) => {
    try {
      const updated = await applyTags(id, tags);
      setBookmarks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      const freshTags = await fetchTags();
      setTags(freshTags);
      setModalOpen(false);
      setEditingBookmark(null);
    } catch (err: any) {
      setError(err.message || "Failed to apply tags");
    }
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
              <p className="text-xs text-slate-500">
                Intelligent Bookmark Library
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              GitHub
            </a>
            <Link
              to="/collections"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Collections
            </Link>
            <Link
              to="/settings"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Settings
            </Link>
            <button
              onClick={handleAdd}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              Add bookmark
            </button>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <FilterBar
        tags={tags.map((t) => t.name)}
        selectedTags={selectedTags}
        searchQuery={searchQuery}
        onToggleTag={toggleTag}
        onSearchChange={setSearchQuery}
        onClear={clearFilters}
        resultCount={filteredBookmarks.length}
        totalCount={bookmarks.length}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading && bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
            <p className="text-slate-500">Loading bookmarks…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-slate-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-200">
              Something went wrong
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              Retry
            </button>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-slate-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-200">
              No bookmarks found
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Try adjusting your search or clearing filters to see more results.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {filteredBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onTagClick={toggleTag}
                selectedTags={selectedTags}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-600 sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Lumina. Built for the love of bookmarks.</p>
      </footer>

      <BookmarkModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBookmark(null);
        }}
        onSubmit={handleModalSubmit}
        onApplyTags={handleApplyTags}
        initialData={editingBookmark}
      />
    </div>
  );
}

export default App;

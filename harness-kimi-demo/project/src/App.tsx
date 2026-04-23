import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookmarkCard } from "./components/BookmarkCard";
import { FilterBar } from "./components/FilterBar";
import { BookmarkModal } from "./components/BookmarkModal";
import { DigestPopover } from "./components/DigestPopover";
import { MobileNav } from "./components/MobileNav";
import { useToast } from "./components/Toast";
import { useBookmarkFilter } from "./hooks/useBookmarkFilter";
import { useAuth } from "./context/AuthContext";
import {
  fetchBookmarks,
  fetchTags,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  applyTags,
  type Bookmark,
  type BookmarkCreate,
} from "./api/client";

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const { logout } = useAuth();
  const location = useLocation();
  const { success: toastSuccess, error: toastError } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bmData, tagData] = await Promise.all([
        fetchBookmarks(),
        fetchTags(),
      ]);
      setBookmarks(bmData);
      setTags(tagData.map((t) => t.name));
    } catch (err: any) {
      setError(err.message || "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    clearFilters,
    filteredBookmarks,
  } = useBookmarkFilter(bookmarks);

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
      toastSuccess("Bookmark deleted");
      await loadData();
    } catch (err: any) {
      toastError(err.message || "Failed to delete bookmark");
      setError(err.message || "Failed to delete bookmark");
    }
  };

  const handleModalDelete = async (bookmark: Bookmark) => {
    try {
      await deleteBookmark(bookmark.id);
      toastSuccess("Bookmark deleted");
      setModalOpen(false);
      setEditingBookmark(null);
      await loadData();
    } catch (err: any) {
      toastError(err.message || "Failed to delete bookmark");
      setError(err.message || "Failed to delete bookmark");
    }
  };

  const handleModalSubmit = async (payload: BookmarkCreate) => {
    try {
      if (editingBookmark) {
        await updateBookmark(editingBookmark.id, payload);
        toastSuccess("Changes saved");
      } else {
        await createBookmark(payload);
        toastSuccess("Bookmark saved");
      }
      await loadData();
      setModalOpen(false);
      setEditingBookmark(null);
    } catch (err: any) {
      toastError(err.message || "Failed to save bookmark");
      setError(err.message || "Failed to save bookmark");
    }
  };

  const handleApplyTags = async (id: string, tags: string[]) => {
    try {
      await applyTags(id, tags);
      toastSuccess("Tags updated");
      await loadData();
    } catch (err: any) {
      toastError(err.message || "Failed to update tags");
      setError(err.message || "Failed to update tags");
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
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className={[
                "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                location.pathname === "/"
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Library
            </Link>
            <Link
              to="/collections"
              className={[
                "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                location.pathname === "/collections"
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Collections
            </Link>
            <Link
              to="/discover"
              className={[
                "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                location.pathname === "/discover"
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Discover
            </Link>
            <Link
              to="/settings"
              className={[
                "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
                location.pathname === "/settings"
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Settings
            </Link>
            <button
              onClick={handleAdd}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              Add bookmark
            </button>
            <DigestPopover />
            <button
              onClick={logout}
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 sm:block"
              title="Log out"
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
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
            </button>
            <MobileNav />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        </div>
      )}

      <FilterBar
        tags={tags}
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-200">
              Loading bookmarks…
            </h2>
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
        onApplyTags={editingBookmark ? handleApplyTags : undefined}
        onDelete={editingBookmark ? handleModalDelete : undefined}
        initialData={editingBookmark}
      />
    </div>
  );
}

export default App;

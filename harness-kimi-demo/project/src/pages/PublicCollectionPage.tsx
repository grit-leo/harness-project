import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchPublicCollection,
  fetchPublicCollectionBookmarks,
  followPublicCollection,
  getAccessToken,
  type PublicCollection,
  type Bookmark,
} from "../api/client";
import { BookmarkCard } from "../components/BookmarkCard";

export function PublicCollectionPage() {
  const { token } = useParams<{ token: string }>();
  const [collection, setCollection] = useState<PublicCollection | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followed, setFollowed] = useState(false);
  const isLoggedIn = !!getAccessToken();

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [coll, bms] = await Promise.all([
          fetchPublicCollection(token),
          fetchPublicCollectionBookmarks(token),
        ]);
        setCollection(coll);
        setBookmarks(bms);
      } catch (err: any) {
        setError(err.message || "Failed to load collection");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleFollow = async () => {
    if (!token) return;
    try {
      await followPublicCollection(token);
      setFollowed(true);
    } catch (err: any) {
      setError(err.message || "Failed to follow");
    }
  };

  const maskEmail = (email: string) => {
    const [user, domain] = email.split("@");
    if (!user || !domain) return email;
    return user.slice(0, 2) + "***@" + domain;
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
              <p className="text-xs text-slate-500">Public Collection</p>
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
              to="/discover"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Discover
            </Link>
            {!isLoggedIn && (
              <Link
                to="/login"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
            <p className="text-slate-500">Loading collection…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center text-red-400">
            {error}
          </div>
        ) : collection ? (
          <>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-100">
                  {collection.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Curated by{" "}
                  <span className="text-slate-400">
                    {maskEmail(collection.ownerEmail)}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {collection.rules.conditions.map((cond, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400"
                    >
                      {cond.field} {cond.op} {cond.value}
                    </span>
                  ))}
                </div>
              </div>
              {isLoggedIn ? (
                <button
                  onClick={handleFollow}
                  disabled={followed}
                  className={[
                    "rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                    followed
                      ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                      : "bg-indigo-500 text-white hover:bg-indigo-600",
                  ].join(" ")}
                >
                  {followed ? "Following" : "Follow this collection"}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="rounded-lg bg-indigo-500 px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                >
                  Sign in to follow
                </Link>
              )}
            </div>

            {bookmarks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
                <p className="text-sm text-slate-500">
                  No bookmarks in this collection yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                {bookmarks.map((bm) => (
                  <BookmarkCard
                    key={bm.id}
                    bookmark={bm}
                    onTagClick={() => {}}
                    selectedTags={[]}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDiscovery, followPublicCollection, type DiscoveryItem } from "../api/client";

export function DiscoveryPage() {
  const { logout } = useAuth();
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDiscovery();
        setItems(data);
      } catch (err: any) {
        setError(err.message || "Failed to load discovery");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleFollow = async (item: DiscoveryItem) => {
    try {
      await followPublicCollection(item.shareToken);
      setFollowing((prev) => new Set(prev).add(item.id));
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, followerCount: i.followerCount + 1 } : i
        )
      );
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
              <p className="text-xs text-slate-500">Discover</p>
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
              to="/collections"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Collections
            </Link>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold text-slate-100">
          Public Collections
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500" />
            <p className="text-slate-500">Loading discovery…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center text-red-400">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 py-16 text-center">
            <p className="text-sm text-slate-500">No public collections yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-slate-700"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-base font-semibold text-slate-100">
                    {item.name}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {item.followerCount} follower{item.followerCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  by {maskEmail(item.ownerEmail)}
                </p>
                {item.tagOverlap.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {item.tagOverlap.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tagOverlap.length > 5 && (
                      <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">
                        +{item.tagOverlap.length - 5}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <Link
                    to={`/c/${item.shareToken}`}
                    className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleFollow(item)}
                    disabled={following.has(item.id)}
                    className={[
                      "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                      following.has(item.id)
                        ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                        : "bg-indigo-500 text-white hover:bg-indigo-600",
                    ].join(" ")}
                  >
                    {following.has(item.id) ? "Following" : "Follow"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

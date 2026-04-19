import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ImportModal } from "../components/ImportModal";
import { ExportButtons } from "../components/ExportButtons";

export function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [importOpen, setImportOpen] = useState(false);

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
              <p className="text-xs text-slate-500">Settings</p>
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

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Import Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-2 text-base font-semibold text-slate-100">Import</h2>
            <p className="mb-4 text-sm text-slate-400">
              Migrate your existing browser bookmarks into Lumina. We support the Netscape HTML format.
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Import Bookmarks
            </button>
          </section>

          {/* Export Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-2 text-base font-semibold text-slate-100">Export</h2>
            <p className="mb-4 text-sm text-slate-400">
              Download your entire library in a portable format.
            </p>
            <ExportButtons />
          </section>
        </div>
      </main>

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={() => navigate("/")}
      />
    </div>
  );
}

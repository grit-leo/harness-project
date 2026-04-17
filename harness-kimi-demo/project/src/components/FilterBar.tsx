interface FilterBarProps {
  tags: string[];
  selectedTags: string[];
  searchQuery: string;
  onToggleTag: (tag: string) => void;
  onSearchChange: (query: string) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
}

export function FilterBar({
  tags,
  selectedTags,
  searchQuery,
  onToggleTag,
  onSearchChange,
  onClear,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const hasFilters = selectedTags.length > 0 || searchQuery.trim().length > 0;

  return (
    <div className="sticky top-0 z-20 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-slate-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search bookmarks or tags..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500/60 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                >
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-mono text-slate-500">
                {resultCount} / {totalCount}
              </span>
              <button
                type="button"
                onClick={onClear}
                disabled={!hasFilters}
                className={[
                  "rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  hasFilters
                    ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                    : "cursor-not-allowed bg-slate-900/60 text-slate-600",
                ].join(" ")}
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-950/80 to-transparent sm:hidden" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className={[
                      "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                      "border backdrop-blur-sm",
                      isActive
                        ? "border-indigo-500/70 bg-indigo-500/25 text-indigo-200 shadow-sm shadow-indigo-500/20"
                        : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

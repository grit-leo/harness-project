import type { Bookmark } from "../api/client";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onTagClick: (tag: string) => void;
  selectedTags: string[];
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "y", seconds: 31536000 },
    { label: "mo", seconds: 2592000 },
    { label: "w", seconds: 604800 },
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
    { label: "s", seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count}${interval.label} ago`;
    }
  }
  return "just now";
}

function getFaviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}

export function BookmarkCard({
  bookmark,
  onTagClick,
  selectedTags,
}: BookmarkCardProps) {
  const hostname = getHostname(bookmark.url);
  const relativeDate = getRelativeTime(bookmark.createdAt);
  const faviconUrl = getFaviconUrl(hostname);

  return (
    <article className="group flex flex-col rounded-2xl bg-slate-900 border border-slate-800/60 p-5 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/50">
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-4 flex items-start gap-4"
      >
        <img
          src={faviconUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl bg-slate-800 object-contain ring-1 ring-inset ring-white/10 transition-colors"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='1.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244'/%3E%3C/svg%3E";
          }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-200 transition-colors group-hover:text-white">
            {bookmark.title}
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-slate-500 font-mono">
            {hostname}
          </p>
        </div>
      </a>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-400">
        {bookmark.summary}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {bookmark.tags.map((tag) => {
          const isActive = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onTagClick(tag);
              }}
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
                "border backdrop-blur-sm",
                isActive
                  ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-300 shadow-sm shadow-indigo-500/20"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-700/60 hover:-translate-y-0.5",
              ].join(" ")}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
        <span className="text-xs font-mono text-slate-500">{relativeDate}</span>
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/80" aria-hidden="true" />
      </div>
    </article>
  );
}

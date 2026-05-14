import { useMemo, useState, useCallback } from "react";
import type { Bookmark } from "../api/client";

export interface UseBookmarkFilterResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  filteredBookmarks: Bookmark[];
}

export function useBookmarkFilter(
  bookmarks: Bookmark[]
): UseBookmarkFilterResult {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedTags([]);
  }, []);

  const filteredBookmarks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bookmarks.filter((bookmark) => {
      const matchesSearch =
        !query ||
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.tags.some((tag) => tag.toLowerCase().includes(query));

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => bookmark.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [bookmarks, searchQuery, selectedTags]);

  return {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    clearFilters,
    filteredBookmarks,
  };
}

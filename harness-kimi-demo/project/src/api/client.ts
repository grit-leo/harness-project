export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  tags: string[];
  summary: string;
  suggestedTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkCreate {
  url: string;
  title: string;
  summary?: string;
  tags?: string[];
}

export interface BookmarkUpdate {
  url?: string;
  title?: string;
  summary?: string;
  tags?: string[];
}

export interface Tag {
  id: string;
  name: string;
}

export interface Condition {
  field: "tag" | "domain" | "date";
  op: "equals" | "last_n_days";
  value: string | number;
}

export interface Rules {
  operator: "AND" | "OR";
  conditions: Condition[];
}

export interface Collection {
  id: string;
  name: string;
  rules: Rules;
  isDefault: boolean;
  visibility: "private" | "public_readonly" | "shared_edit";
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Collaborator {
  userId: string;
  email: string;
  role: string;
}

export interface PublicCollection {
  id: string;
  name: string;
  rules: Rules;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryItem {
  id: string;
  name: string;
  ownerEmail: string;
  followerCount: number;
  tagOverlap: string[];
  shareToken: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingUserId: string | null;
  followingCollectionId: string | null;
  createdAt: string;
}

export interface DigestItem {
  id: string;
  userId: string;
  sourceUserId: string | null;
  sourceCollectionId: string | null;
  bookmarkId: string;
  seen: boolean;
  createdAt: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

let accessToken: string | null = localStorage.getItem("accessToken");
let refreshTokenValue: string | null = localStorage.getItem("refreshToken");

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.access_token;
  refreshTokenValue = tokens.refresh_token;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshTokenValue);
  // Broadcast to extension
  window.postMessage({ type: "LUMINA_SET_TOKEN", token: tokens.access_token }, "*");
}

export function clearTokens() {
  accessToken = null;
  refreshTokenValue = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.postMessage({ type: "LUMINA_CLEAR_TOKEN" }, "*");
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshTokenValue;
}

export async function refreshAccessToken(): Promise<boolean> {
  const rt = refreshTokenValue;
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(
  input: string,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  const url = `${API_BASE_URL}${input}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(input, init, false);
    }
    clearTokens();
    window.location.href = "/login";
  }

  return res;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await apiFetch(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  setTokens(data);
  return data;
}

export async function signup(email: string, password: string): Promise<AuthTokens> {
  const res = await apiFetch(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Signup failed" }));
    throw new Error(err.detail || "Signup failed");
  }
  const data = await res.json();
  setTokens(data);
  return data;
}

export async function logout(): Promise<void> {
  const rt = getRefreshToken();
  await apiFetch(
    "/api/auth/logout",
    {
      method: "POST",
      body: rt ? JSON.stringify({ refresh_token: rt }) : undefined,
    },
    false
  ).catch(() => {});
  clearTokens();
}

export async function fetchBookmarks(
  search?: string,
  tags?: string[]
): Promise<Bookmark[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  tags?.forEach((t) => params.append("tag", t));
  const query = params.toString();
  const res = await apiFetch(`/api/bookmarks${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  return res.json();
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await apiFetch("/api/tags");
  if (!res.ok) throw new Error("Failed to fetch tags");
  return res.json();
}

export async function createBookmark(payload: BookmarkCreate): Promise<Bookmark> {
  const res = await apiFetch("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create bookmark");
  return res.json();
}

export async function updateBookmark(
  id: string,
  payload: BookmarkUpdate
): Promise<Bookmark> {
  const res = await apiFetch(`/api/bookmarks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update bookmark");
  return res.json();
}

export async function deleteBookmark(id: string): Promise<void> {
  const res = await apiFetch(`/api/bookmarks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete bookmark");
}

export async function fetchSuggestedTags(id: string): Promise<string[]> {
  const res = await apiFetch(`/api/bookmarks/${id}/suggested-tags`);
  if (!res.ok) throw new Error("Failed to fetch suggested tags");
  const data = await res.json();
  return data.suggested_tags || [];
}

export async function applyTags(id: string, tags: string[]): Promise<Bookmark> {
  const res = await apiFetch(`/api/bookmarks/${id}/apply-tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error("Failed to apply tags");
  return res.json();
}

export async function fetchCollections(): Promise<Collection[]> {
  const res = await apiFetch("/api/collections");
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json();
}

export async function createCollection(payload: {
  name: string;
  rules: Rules;
}): Promise<Collection> {
  const res = await apiFetch("/api/collections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create collection");
  return res.json();
}

export async function updateCollection(
  id: string,
  payload: { name?: string; rules?: Rules; visibility?: string }
): Promise<Collection> {
  const res = await apiFetch(`/api/collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update collection");
  return res.json();
}

export async function fetchCollectionBookmarks(id: string): Promise<Bookmark[]> {
  const res = await apiFetch(`/api/collections/${id}/bookmarks`);
  if (!res.ok) throw new Error("Failed to fetch collection bookmarks");
  return res.json();
}

export async function deleteCollection(id: string): Promise<void> {
  const res = await apiFetch(`/api/collections/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete collection");
}

export async function shareCollection(id: string): Promise<{ share_token: string; public_url: string }> {
  const res = await apiFetch(`/api/collections/${id}/share`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to share collection");
  return res.json();
}

export async function unshareCollection(id: string): Promise<void> {
  const res = await apiFetch(`/api/collections/${id}/share`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to unshare collection");
}

export async function fetchCollaborators(id: string): Promise<Collaborator[]> {
  const res = await apiFetch(`/api/collections/${id}/collaborators`);
  if (!res.ok) throw new Error("Failed to fetch collaborators");
  return res.json();
}

export async function inviteCollaborator(id: string, email: string): Promise<Collaborator> {
  const res = await apiFetch(`/api/collections/${id}/collaborators`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to invite collaborator");
  return res.json();
}

export async function removeCollaborator(id: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/collections/${id}/collaborators/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove collaborator");
}

export async function fetchPublicCollection(token: string): Promise<PublicCollection> {
  const res = await fetch(`${API_BASE_URL}/api/public/collections/${token}`);
  if (!res.ok) throw new Error("Failed to fetch public collection");
  return res.json();
}

export async function fetchPublicCollectionBookmarks(token: string): Promise<Bookmark[]> {
  const res = await fetch(`${API_BASE_URL}/api/public/collections/${token}/bookmarks`);
  if (!res.ok) throw new Error("Failed to fetch public collection bookmarks");
  return res.json();
}

export async function followPublicCollection(token: string): Promise<void> {
  const res = await apiFetch(`/api/public/collections/${token}/follow`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to follow collection");
}

export async function fetchDiscovery(): Promise<DiscoveryItem[]> {
  const res = await apiFetch("/api/discover");
  if (!res.ok) throw new Error("Failed to fetch discovery");
  return res.json();
}

export async function followUser(userId: string): Promise<void> {
  const res = await apiFetch(`/api/users/${userId}/follow`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to follow user");
}

export async function unfollowUser(userId: string): Promise<void> {
  const res = await apiFetch(`/api/users/${userId}/follow`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to unfollow user");
}

export async function fetchFollows(): Promise<Follow[]> {
  const res = await apiFetch("/api/follows");
  if (!res.ok) throw new Error("Failed to fetch follows");
  return res.json();
}

export async function fetchDigest(): Promise<DigestItem[]> {
  const res = await apiFetch("/api/digest");
  if (!res.ok) throw new Error("Failed to fetch digest");
  return res.json();
}

export async function markDigestSeen(ids?: string[]): Promise<void> {
  const res = await apiFetch("/api/digest/mark-seen", {
    method: "POST",
    body: JSON.stringify(ids ? { ids } : {}),
  });
  if (!res.ok) throw new Error("Failed to mark digest seen");
}

export interface ImportStatus {
  status: string;
  total: number;
  processed: number;
  errors: number;
  bookmark_ids: string[];
  error_detail: string | null;
}

export async function importBookmarks(file: File): Promise<{ imported?: number; bookmark_ids?: string[]; task_id?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/bookmarks/import`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) throw new Error("Import failed");
  return res.json();
}

export async function fetchImportStatus(taskId: string): Promise<ImportStatus> {
  const res = await apiFetch(`/api/bookmarks/import-status/${taskId}`);
  if (!res.ok) throw new Error("Failed to fetch import status");
  return res.json();
}

export async function exportBookmarks(format: "json" | "netscape"): Promise<Blob> {
  const res = await apiFetch(`/api/bookmarks/export?format=${format}`);
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export async function fetchSuggestedTagsForUrl(url: string, title: string): Promise<string[]> {
  const res = await apiFetch("/api/bookmarks/suggest-tags", {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });
  if (!res.ok) throw new Error("Failed to fetch suggested tags");
  const data = await res.json();
  return data.suggested_tags || [];
}

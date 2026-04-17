export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  tags: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkCreate {
  url: string;
  title: string;
  summary?: string;
  tags?: string[];
}

export interface Tag {
  id: string;
  name: string;
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
}

export function clearTokens() {
  accessToken = null;
  refreshTokenValue = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshTokenValue;
}

async function refreshAccessToken(): Promise<boolean> {
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
  const res = await apiFetch(`/api/bookmarks?${params.toString()}`);
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
  payload: BookmarkCreate
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

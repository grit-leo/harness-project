const API_BASE_URL = "http://localhost:8000";

async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get("lumina_access_token", (result) => {
      resolve(result.lumina_access_token || null);
    });
  });
}

async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${API_BASE_URL}${input}`;
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function suggestTags(url: string, title: string): Promise<string[]> {
  const res = await apiFetch("/api/bookmarks/suggest-tags", {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });
  if (!res.ok) throw new Error("Failed to fetch suggested tags");
  const data = await res.json();
  return data.suggested_tags || [];
}

export interface SavePayload {
  url: string;
  title: string;
  tags: string[];
}

export async function saveBookmark(payload: SavePayload): Promise<void> {
  const res = await apiFetch("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      url: payload.url,
      title: payload.title,
      tags: payload.tags,
      summary: "",
    }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized — please log in via the web app.");
    }
    const err = await res.json().catch(() => ({ detail: "Save failed" }));
    throw new Error(err.detail || "Save failed");
  }
}

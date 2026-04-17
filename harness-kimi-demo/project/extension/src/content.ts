window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "LUMINA_SET_TOKEN") {
    chrome.storage.local.set({ lumina_access_token: event.data.token });
  }
  if (event.data?.type === "LUMINA_CLEAR_TOKEN") {
    chrome.storage.local.remove(["lumina_access_token"]);
  }
});

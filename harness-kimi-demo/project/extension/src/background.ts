chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "GET_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        sendResponse({
          title: tab.title || "",
          url: tab.url || "",
        });
      } else {
        sendResponse({ title: "", url: "" });
      }
    });
    return true;
  }
  return false;
});

chrome.action.onClicked.addListener(() => {
  // Default popup handles the UI; this is a fallback listener
});

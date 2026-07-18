// メモ帳 PWA Content Script (詳細ログ版)

function log(...args) {
  console.log(`%c[Notepad Ext ContentScript] ${new Date().toISOString().substring(11,23)}`, "color: #008080; font-weight: bold;", ...args);
}

// Webページ (index.html) からのメッセージメッセージを受信して background.js へ送る
window.addEventListener("message", (event) => {
  if (event.data && event.data.source === "NOTEPAD_APP") {
    log("Relaying message from web page to background.js:", event.data);
    chrome.runtime.sendMessage(event.data);
  }
});

// background.js からの応答メッセージを Webページへ通知する
chrome.runtime.onMessage.addListener((message) => {
  log("Relaying message from background.js to web page:", message);
  window.postMessage({ source: "NOTEPAD_EXTENSION", ...message }, "*");
});

window.addEventListener("DOMContentLoaded", () => {
  log("DOMContentLoaded: Notifying web page that Chrome Extension ContentScript is active.");
  window.postMessage({ source: "NOTEPAD_EXTENSION", action: "EXTENSION_READY" }, "*");
});

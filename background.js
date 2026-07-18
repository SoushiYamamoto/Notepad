// メモ帳 PWA 専用 拡張機能 Background Service Worker (無点滅・ウィンドウ即時移動＆Zオーダー最適化版)

const alwaysOnTopWindows = new Set();
let isFocusingSequence = false;
let lastSourceWindowId = null;

// メモ帳ウィンドウのフォーカス履歴（最も新しいものが先頭 [0]）
let notepadWindowStack = [];

function log(...args) {
  console.log(`%c[Notepad Ext Background] ${new Date().toISOString().substring(11,23)}`, "color: #0078d7; font-weight: bold;", ...args);
}

function isNotepadWindow(win) {
  if (!win || !win.tabs) return false;
  return win.tabs.some(t => {
    const url = t.url || "";
    const title = t.title || "";
    return url.includes("index.html") || url.includes("transfer=") || title.includes("メモ帳") || title.includes("Notepad");
  });
}

function safeFocusWindow(winId) {
  if (!winId) return Promise.resolve(false);
  return chrome.windows.update(winId, { focused: true })
    .then(() => true)
    .catch((err) => {
      log(`Could not focus window ${winId} (window may be closed):`, err.message);
      notepadWindowStack = notepadWindowStack.filter(id => id !== winId);
      alwaysOnTopWindows.delete(winId);
      return false;
    });
}

chrome.windows.onFocusChanged.addListener(async (focusedWindowId) => {
  if (focusedWindowId === chrome.windows.WINDOW_ID_NONE) return;

  chrome.windows.get(focusedWindowId, { populate: true }, (win) => {
    if (chrome.runtime.lastError || !win) return;

    if (isNotepadWindow(win)) {
      notepadWindowStack = notepadWindowStack.filter(id => id !== focusedWindowId);
      notepadWindowStack.unshift(focusedWindowId);
      log("Updated Notepad Window Stack (Most recent first):", notepadWindowStack);
    }
  });

  if (!isFocusingSequence && alwaysOnTopWindows.size > 0 && !alwaysOnTopWindows.has(focusedWindowId)) {
    isFocusingSequence = true;
    for (const winId of alwaysOnTopWindows) {
      await safeFocusWindow(winId);
    }
    setTimeout(() => { isFocusingSequence = false; }, 300);
  }
});

chrome.windows.onRemoved.addListener((winId) => {
  notepadWindowStack = notepadWindowStack.filter(id => id !== winId);
  alwaysOnTopWindows.delete(winId);
  log("Window removed:", winId, "Updated stack:", notepadWindowStack);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("Message received:", message, "Sender tab:", sender.tab ? { id: sender.tab.id, windowId: sender.tab.windowId, url: sender.tab.url, title: sender.tab.title } : "No tab sender");

  if (!message || message.source !== "NOTEPAD_APP") return;

  const currentWinId = sender.tab ? sender.tab.windowId : null;

  if (currentWinId && !notepadWindowStack.includes(currentWinId)) {
    notepadWindowStack.unshift(currentWinId);
  }

  // 1. 常に手前に表示 (トグル切り替え)
  if (message.action === "TOGGLE_ALWAYS_ON_TOP") {
    if (currentWinId) {
      if (alwaysOnTopWindows.has(currentWinId)) {
        alwaysOnTopWindows.delete(currentWinId);
        log("Toggled AlwaysOnTop OFF for windowId:", currentWinId);
        chrome.windows.update(currentWinId, { alwaysOnTop: false }).catch(() => {});
        notifyState(sender.tab.id, false);
      } else {
        alwaysOnTopWindows.add(currentWinId);
        log("Toggled AlwaysOnTop ON for windowId:", currentWinId);
        chrome.windows.update(currentWinId, { alwaysOnTop: true, focused: true }).catch(() => {});
        notifyState(sender.tab.id, true);
      }
    }
  }

  // 2. ドラッグ開始／進行時またはウインドウ移動時
  else if (message.action === "BRING_ALL_TO_FRONT") {
    if (currentWinId) lastSourceWindowId = currentWinId;
    log("BRING_ALL_TO_FRONT. currentWinId:", currentWinId);
    arrangeNotepadWindows(currentWinId, null);
  }

  // 3. 新規分離ウィンドウからのロード完了通知（最優先・無フラッシュ配置）
  else if (message.action === "NEW_WINDOW_READY") {
    const newWinId = currentWinId;
    log("NEW_WINDOW_READY received. newWinId:", newWinId, "lastSourceWinId:", lastSourceWindowId);
    arrangeNotepadWindows(lastSourceWindowId, newWinId);
  }

  // 4. 状態確認
  else if (message.action === "CHECK_ALWAYS_ON_TOP") {
    if (currentWinId) {
      const isTop = alwaysOnTopWindows.has(currentWinId);
      notifyState(sender.tab.id, isTop);
    }
  }
});

async function arrangeNotepadWindows(sourceWinId, newWinId) {
  if (isFocusingSequence) return;
  isFocusingSequence = true;

  chrome.windows.getAll({ populate: true }, async (windows) => {
    const notepadWindows = windows.filter(isNotepadWindow);
    log(`Arranging ${notepadWindows.length} Notepad windows. sourceWinId: ${sourceWinId}, newWinId: ${newWinId}`);

    // チラつき（フラッシュ）を100%防ぐ最小最適化フォーカス処理：
    // 全ウィンドウを何度もループフォーカスするのではなく、移動元と新規ウィンドウのみをピンポイントで最前面化
    if (sourceWinId && sourceWinId !== newWinId && notepadWindows.some(w => w.id === sourceWinId)) {
      log("Step 1: Raising source window above background apps:", sourceWinId);
      await safeFocusWindow(sourceWinId);
    }

    if (newWinId && notepadWindows.some(w => w.id === newWinId)) {
      log("Step 2: Raising newly created window to TOPMOST position:", newWinId);
      await safeFocusWindow(newWinId);
    }

    setTimeout(() => {
      isFocusingSequence = false;
      log("ArrangeNotepadWindows completed with ZERO flicker.");
    }, 100);
  });
}

function notifyState(tabId, isAlwaysOnTop) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: "ALWAYS_ON_TOP_STATUS",
      isAlwaysOnTop: isAlwaysOnTop
    }).catch(() => {});
  }
}

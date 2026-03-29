chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Ignore unsupported states during local loading.
  })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'dreamjob:open-side-panel') {
    const tabId = sender.tab?.id ?? message.tabId

    if (!tabId) {
      sendResponse({ ok: false })
      return
    }

    chrome.sidePanel.open({ tabId }).then(() => {
      sendResponse({ ok: true })
    }).catch(() => {
      sendResponse({ ok: false })
    })

    return true
  }

  if (message?.type === 'dreamjob:cache-captured-job') {
    chrome.storage.local.set({ capturedJob: message.payload }).then(() => {
      sendResponse({ ok: true })
    }).catch(() => {
      sendResponse({ ok: false })
    })

    return true
  }
})

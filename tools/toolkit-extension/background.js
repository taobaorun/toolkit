// background.js — ToolKit Service Worker
// Handles extension icon click to open the side panel.
// @author yuanxuan

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Open side panel on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ToolKit] Extension installed');
});
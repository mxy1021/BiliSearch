"use strict";

const MENU_ID = "bilisearch-selection";
const SEARCH_URL = "https://search.bilibili.com/all?keyword=";

// 安装、更新或手动重新加载扩展时重建菜单，避免重复注册。
// 菜单由浏览器持久保存；Service Worker 每次唤醒时无需再次创建。
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error("BiliSearch：清理菜单失败", chrome.runtime.lastError.message);
      return;
    }

    chrome.contextMenus.create({
      id: MENU_ID,
      title: "在 Bilibili 搜索“%s”",
      contexts: ["selection"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("BiliSearch：创建菜单失败", chrome.runtime.lastError.message);
      }
    });
  });
});

// 在顶层同步注册监听器，确保休眠后的 Service Worker 也能响应点击。
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const selection = info.selectionText;
  if (typeof selection !== "string" || selection.trim() === "") return;

  try {
    // 仅用 trim 判断空白，不修改关键词；保留首尾空格、换行及特殊符号。
    const options = {
      url: SEARCH_URL + encodeURIComponent(selection),
      active: true,
    };
    // 在来源窗口打开新标签页，不更新或注入来源网页。
    if (Number.isInteger(tab?.windowId) && tab.windowId >= 0) {
      options.windowId = tab.windowId;
    }
    chrome.tabs.create(options, () => {
      if (chrome.runtime.lastError) {
        console.error("BiliSearch：打开搜索标签页失败", chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    // 包括极少见的非法 Unicode 编码或 API 同步异常，不输出选中文字。
    console.error("BiliSearch：无法执行搜索", error.message);
  }
});

"use strict";

// 使用 Node 内置测试运行器模拟扩展 API，无需安装第三方依赖。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
const menuId = "bilisearch-selection";

function setup(failure) {
  const listeners = {};
  const menus = [];
  const tabs = [];
  const errors = [];
  const chrome = {
    runtime: { onInstalled: { addListener: fn => { listeners.install = fn; } } },
    contextMenus: {
      removeAll(callback) {
        menus.length = 0;
        if (failure === "remove") chrome.runtime.lastError = { message: "remove failed" };
        callback();
        delete chrome.runtime.lastError;
      },
      create(options, callback) {
        menus.push(options);
        if (failure === "menu") chrome.runtime.lastError = { message: "menu failed" };
        callback();
        delete chrome.runtime.lastError;
      },
      onClicked: { addListener: fn => { listeners.click = fn; } },
    },
    tabs: { create(options, callback) {
      if (failure === "throw") throw new Error("API unavailable");
      tabs.push(options);
      if (failure === "tab") chrome.runtime.lastError = { message: "tab failed" };
      callback();
      delete chrome.runtime.lastError;
    } },
  };
  vm.runInNewContext(source, { chrome, console: { error: (...args) => errors.push(args) } });
  return { listeners, menus, tabs, errors };
}

test("Manifest V3、最小权限、资源路径及 PNG 尺寸有效", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "BiliSearch");
  assert.deepEqual(manifest.permissions, ["contextMenus"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.ok(fs.existsSync(path.join(root, manifest.background.service_worker)));
  for (const [size, file] of Object.entries(manifest.icons)) {
    const png = fs.readFileSync(path.join(root, file));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
});

test("顶层注册事件、仅安装时创建一个 selection 菜单，重复安装无重复", () => {
  const app = setup();
  assert.equal(typeof app.listeners.click, "function");
  assert.equal(app.menus.length, 0);
  app.listeners.install();
  app.listeners.install();
  assert.equal(app.menus.length, 1);
  assert.equal(app.menus[0].title, "在 Bilibili 搜索“%s”");
  assert.equal(JSON.stringify(app.menus[0].contexts), '["selection"]');
  assert.equal(app.menus[0].parentId, undefined);
});

for (const selection of ["中文教程", "JavaScript", "hello world", "C# ASP.NET Core 教程", "a&b=c?x#y+z/%", "  空格  ", "第一行\n第二行", "表情🙂 🚀", '引号“文字” "test"', "百分号%s"]) {
  test(`搜索关键词往返一致：${JSON.stringify(selection)}`, () => {
    const app = setup();
    app.listeners.click({ menuItemId: menuId, selectionText: selection }, { windowId: 7 });
    assert.equal(app.tabs.length, 1);
    const options = app.tabs[0];
    assert.equal(options.active, true);
    assert.equal(options.windowId, 7);
    assert.equal(new URL(options.url).origin, "https://search.bilibili.com");
    assert.equal(new URL(options.url).pathname, "/all");
    assert.equal(new URL(options.url).searchParams.get("keyword"), selection);
    if (selection === "C# ASP.NET Core 教程") {
      assert.equal(options.url, "https://search.bilibili.com/all?keyword=C%23%20ASP.NET%20Core%20%E6%95%99%E7%A8%8B");
    }
    assert.equal(app.errors.length, 0);
  });
}

test("空白、缺失、非字符串选区和无关菜单不会打开标签页", () => {
  const app = setup();
  for (const selectionText of [undefined, null, 123, "", " \n\t", "　"]) {
    app.listeners.click({ menuItemId: menuId, selectionText });
  }
  app.listeners.click({ menuItemId: "other", selectionText: "test" });
  assert.equal(app.tabs.length, 0);
});

test("没有来源标签信息时仍可搜索", () => {
  const app = setup();
  app.listeners.click({ menuItemId: menuId, selectionText: "test" });
  assert.equal(app.tabs.length, 1);
  assert.equal(app.tabs[0].windowId, undefined);
});

for (const failure of ["remove", "menu", "tab", "throw"]) {
  test(`API 错误被捕获：${failure}`, () => {
    const app = setup(failure);
    if (["remove", "menu"].includes(failure)) app.listeners.install();
    else app.listeners.click({ menuItemId: menuId, selectionText: "test" });
    assert.equal(app.errors.length, 1);
    if (failure === "remove") assert.equal(app.menus.length, 0);
  });
}

test("非法 Unicode 被捕获且不会打开错误 URL", () => {
  const app = setup();
  app.listeners.click({ menuItemId: menuId, selectionText: "\uD800" });
  assert.equal(app.tabs.length, 0);
  assert.equal(app.errors.length, 1);
});

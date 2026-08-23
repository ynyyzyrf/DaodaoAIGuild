// CDP 驅動 Edge：加載個人頁，等待載入後檢查徽章牆每個格子是 canvas(3D) 還是 emoji fallback
const DEBUG = "http://127.0.0.1:9222";

async function main() {
  const target = "http://localhost:3000/users/1";
  // 創建新 tab
  const create = await fetch(`${DEBUG}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
  const ws = new WebSocket(create.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    // 捕獲異常 / console error / 網絡失敗
    if (m.method === "Runtime.exceptionThrown") {
      errors.push("EXC: " + (m.params.exceptionDetails?.text || "") + " " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 200));
    }
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
      const txt = m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200);
      errors.push(`CONSOLE[${m.params.type}]: ` + txt);
    }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      errors.push("LOG: " + (m.params.entry.text || "").slice(0, 200) + " " + (m.params.entry.url || ""));
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 4800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: target });

  // 真實等待：SSR + hydrate + API fetch + 10 個 GLB + 騎士 GLB(57MB over localhost)
  await new Promise((r) => setTimeout(r, 15000));

  const expr = `(() => {
    const lis = [...document.querySelectorAll("li.group")];
    return lis.map(li => {
      const nameEl = li.querySelector(".truncate");
      const name = nameEl ? nameEl.textContent : "?";
      const hasCanvas = !!li.querySelector("canvas");
      const fallbackEmoji = li.querySelector(".text-2xl");
      return { name, hasCanvas, fallback: fallbackEmoji ? fallbackEmoji.textContent : null };
    });
  })()`;
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  const rows = res.result?.value || [];
  console.log("=== 徽章牆 (canvas=3D 正常 / fallback=降級) ===");
  rows.forEach((r) => console.log(`${r.hasCanvas ? "✅canvas" : "❌fallback:" + r.fallback}  ${r.name}`));
  console.log(`\ncanvas 數: ${rows.filter(r => r.hasCanvas).length} / ${rows.length}`);

  // 額外：WebGL renderer 信息
  const gl = await send("Runtime.evaluate", {
    expression: `(() => { const c=document.createElement('canvas'); const g=c.getContext('webgl2')||c.getContext('webgl'); return g ? g.getParameter(g.getParameter(g.RENDERER)) : 'no-webgl'; })()`,
    returnByValue: true,
  });
  console.log("\nWebGL renderer:", gl.result?.value);

  console.log("\n=== 錯誤日誌（GLB 載入 / WebGL）===");
  if (errors.length === 0) console.log("(無)");
  else errors.forEach((e) => console.log(e));

  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error("SCRIPT FAIL", e); process.exit(1); });

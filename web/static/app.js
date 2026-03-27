const state = {
  config: null,
  monitorTimer: null,
  monitorPaused: false,
  monitorSnapshot: null,
  combinedProcesses: [],
  processSortMode: "cpu_desc",
  trendHistory: {
    cpu: [],
    memory: [],
    network: [],
    process: [],
    diskio: [],
  },
  trendLastSample: null,
  activeTrendKey: "",
  activeTrendAutoFollow: true,
  activeTrendScrollLeft: 0,
  diskLastSample: null,
  lastDiskRealtime: null,
  scripts: [],
  apps: [],
  logRules: [],
  currentApp: null,
  currentRunId: null,
  logRealtimeTimer: null,
  monitorWS: null,
  monitorWSConnected: false,
  monitorWSRetryTimer: null,
  monitorWSRetryAttempt: 0,
  cleanupMeta: null,
  cleanupScan: null,
  cleanupScanAbortController: null,
  cleanupGarbageAbortController: null,
  cleanupFilteredFiles: [],
  cleanupFilteredLargeFiles: [],
  dockerStatus: null,
  dockerContainers: [],
};

const bootState = {
  total: 7,
  done: 0,
};

let bootFinished = false;
let bootRunning = false;
let bootFallbackTimer = null;
let copyToastTimer = null;
let appToastTimer = null;

const TREND_KEEP_MS = 24 * 60 * 60 * 1000;
const TREND_MINI_HOURS = 4;
const TREND_MINI_MS = TREND_MINI_HOURS * 60 * 60 * 1000;
const TREND_MAX_RENDER_POINTS = 2400;
const TREND_DETAIL_MIN_WIDTH = 980;
const TREND_DETAIL_POINT_PX = 1.8;
const MONITOR_WS_RETRY_BASE_MS = 1200;
const MONITOR_WS_RETRY_MAX_MS = 15000;
const TREND_SERIES = {
  cpu: {
    title: "CPU 使用趋势",
    miniId: "trendMiniCpu",
    infoId: "trendInfoCpu",
    color: "#0f5fd8",
    fill: "rgba(15,95,216,0.18)",
    format: (v) => `${fixed(v)}%`,
  },
  memory: {
    title: "内存使用趋势",
    miniId: "trendMiniMemory",
    infoId: "trendInfoMemory",
    color: "#1a9b75",
    fill: "rgba(26,155,117,0.18)",
    format: (v) => `${fixed(v)}%`,
  },
  network: {
    title: "网络吞吐趋势（字节/秒）",
    miniId: "trendMiniNetwork",
    infoId: "trendInfoNetwork",
    color: "#cc7a12",
    fill: "rgba(204,122,18,0.16)",
    format: (v) => `${bytes(v)}/秒`,
  },
  process: {
    title: "进程总数趋势",
    miniId: "trendMiniProcess",
    infoId: "trendInfoProcess",
    color: "#6f52d9",
    fill: "rgba(111,82,217,0.15)",
    format: (v) => num(Math.round(v)),
  },
  diskio: {
    title: "磁盘 IO 吞吐趋势（字节/秒）",
    miniId: "trendMiniDiskIO",
    infoId: "trendInfoDiskIO",
    color: "#0d7fa5",
    fill: "rgba(13,127,165,0.16)",
    format: (v) => `${bytes(v)}/秒`,
  },
};

document.addEventListener("DOMContentLoaded", () => {
  updateBoot("准备初始化界面...", 0);
  bootFallbackTimer = setTimeout(() => {
    if (bootFinished) return;
    console.error("初始化超过 180 秒，准备自动重试");
    bootState.done = 0;
    updateBoot("初始化耗时较长，正在重试...", 0);
    bootstrap();
  }, 180000);

  try {
    bindSidebarToggle();
    bindMenu();
    switchSection("monitor");
    bindMonitorActions();
    bindLogActions();
    bindRepairActions();
    bindBackupActions();
    bindCleanupActions();
    bindDockerActions();
    bindModal();
    window.addEventListener("beforeunload", stopMonitorSocket);
    bootstrap();
  } catch (err) {
    console.error("页面初始化失败", err);
    updateBoot("页面初始化失败，请刷新后重试", 0);
  }
});

function bindSidebarToggle() {
  const layout = document.getElementById("mainLayout");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const sidebarExpandBtn = document.getElementById("sidebarExpandBtn");
  if (!layout || !sidebarToggleBtn || !sidebarExpandBtn) return;
  const sidebarToggleText = sidebarToggleBtn.querySelector(".sidebar-toggle-text");
  const sidebarMedia = window.matchMedia("(max-width: 1080px)");
  const storageKey = "ops.sidebar.collapsed";

  const readCollapsed = () => {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch (_) {
      return false;
    }
  };

  const writeCollapsed = (collapsed) => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch (_) {
      // ignore storage failures
    }
  };

  const setCollapsed = (collapsed, options = {}) => {
    const isCollapsed = sidebarMedia.matches ? false : !!collapsed;
    const toggleLabel = isCollapsed ? "展开系统菜单" : "收起系统菜单";
    layout.classList.toggle("sidebar-collapsed", isCollapsed);
    sidebarToggleBtn.dataset.collapsed = String(isCollapsed);
    sidebarExpandBtn.dataset.collapsed = String(isCollapsed);
    sidebarToggleBtn.title = toggleLabel;
    sidebarToggleBtn.setAttribute("aria-label", toggleLabel);
    sidebarToggleBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    sidebarExpandBtn.title = "展开系统菜单";
    sidebarExpandBtn.setAttribute("aria-label", "展开系统菜单");
    sidebarExpandBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    if (sidebarToggleText) {
      sidebarToggleText.textContent = toggleLabel;
    }
    if (options.persist !== false) {
      writeCollapsed(isCollapsed);
    }
  };

  setCollapsed(readCollapsed(), { persist: false });

  const syncResponsiveState = () => {
    if (sidebarMedia.matches) {
      setCollapsed(false, { persist: false });
    }
  };

  if (typeof sidebarMedia.addEventListener === "function") {
    sidebarMedia.addEventListener("change", syncResponsiveState);
  } else if (typeof sidebarMedia.addListener === "function") {
    sidebarMedia.addListener(syncResponsiveState);
  }

  sidebarToggleBtn.addEventListener("click", () => {
    const collapsed = !layout.classList.contains("sidebar-collapsed");
    setCollapsed(collapsed);
  });

  sidebarExpandBtn.addEventListener("click", () => {
    setCollapsed(false);
  });
}

async function bootstrap() {
  if (bootFinished || bootRunning) return;
  bootRunning = true;
  try {
    bootState.done = 0;
    const softFailures = [];

    const runOptionalBootStep = async (text, fn, options = {}) => {
      const ok = await runBootStep(text, fn, { ...options, required: false });
      if (!ok) {
        softFailures.push(text);
      }
      return ok;
    };

    await runBootStep("加载配置", loadConfig, { required: true, retries: 1, timeout: 12000 });
    await runOptionalBootStep("采集首批监控数据", () => refreshMonitor(false), { retries: 2, timeout: 45000 });
    await runOptionalBootStep("加载趋势历史", loadTrendHistory, { retries: 1, timeout: 20000 });
    await runOptionalBootStep("加载应用和日志规则", loadApps, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("加载脚本定义", loadScripts, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("加载脚本执行历史", loadScriptRuns, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("加载备份记录", loadBackups, { retries: 1, timeout: 16000 });

    const degraded = softFailures.length > 0;
    finishBoot(degraded ? "初始化完成（部分数据稍后加载）" : "初始化完成");
    startMonitorLoop();
    startMonitorSocket();

    if (degraded) {
      const msg = `部分模块初始化延迟：${softFailures.join("、")}，已进入系统并将在后台重试`;
      showAppToast(msg, "warning");
      console.warn(msg);
    }
  } catch (err) {
    console.error("bootstrap failed", err);
    updateBoot("初始化失败，正在重试...", Math.floor((bootState.done / bootState.total) * 100));
    setTimeout(() => {
      if (!bootFinished) bootstrap();
    }, 1500);
  } finally {
    bootRunning = false;
  }
}

async function runBootStep(text, fn, options = {}) {
  const required = options.required !== false;
  const retries = Math.max(0, Number(options.retries || 0));
  const timeout = Math.max(3000, Number(options.timeout || 15000));
  let lastErr = null;

  updateBoot(`${text}...`, Math.floor((bootState.done / bootState.total) * 100));
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await withTimeout(Promise.resolve().then(() => fn()), timeout, `${text}超时`);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.error(`初始化步骤失败: ${text}（第 ${attempt + 1} 次）`, err);
      if (attempt < retries) {
        updateBoot(`${text}失败，重试中(${attempt + 1}/${retries})...`, Math.floor((bootState.done / bootState.total) * 100));
        await sleep(500);
      }
    }
  }

  bootState.done += 1;
  const percent = Math.floor((bootState.done / bootState.total) * 100);
  if (lastErr) {
    updateBoot(`${text}失败`, percent);
    if (required) throw lastErr;
    return false;
  }
  updateBoot(`${text}完成`, percent);
  return true;
}

function updateBoot(text, percent) {
  const txt = document.getElementById("bootText");
  const p = document.getElementById("bootPercent");
  const bar = document.getElementById("bootBar");
  if (txt) txt.textContent = text;
  if (p) p.textContent = `${percent}%`;
  if (bar) bar.style.width = `${percent}%`;
}

function finishBoot(doneText = "初始化完成") {
  if (bootFinished) return;
  bootFinished = true;
  if (bootFallbackTimer) {
    clearTimeout(bootFallbackTimer);
    bootFallbackTimer = null;
  }
  updateBoot(doneText, 100);
  setTimeout(() => {
    document.body.classList.remove("booting");
    const overlay = document.getElementById("bootOverlay");
    if (overlay) overlay.style.display = "none";
  }, 220);
}

function bindMenu() {
  const buttons = document.querySelectorAll(".menu");
  const activate = (targetBtn) => {
    buttons.forEach((btn) => {
      const active = btn === targetBtn;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });
  };

  const initial = Array.from(buttons).find((btn) => btn.classList.contains("active"));
  if (initial) activate(initial);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activate(btn);
      switchSection(btn.dataset.section);
    });
  });
}

function switchSection(target) {
  document.querySelectorAll(".panel").forEach((panel) => {
    const visible = panel.id === target;
    panel.classList.toggle("visible", visible);
    panel.style.display = visible ? "" : "none";
  });
  syncLogRealtimeState(target);
  if (target === "cleanup") {
    ensureCleanupMeta().catch((err) => {
      console.error("load cleanup meta failed", err);
      showAppToast("加载数据清理配置失败", "error");
    });
  }
  if (target === "docker") {
    loadDockerDashboard().catch((err) => {
      console.error("load docker dashboard failed", err);
      showAppToast("加载 Docker 数据失败", "error");
    });
  }
}

function bindMonitorActions() {
  normalizeLegacyTrendButtons();

  document.getElementById("monitorRefreshBtn").addEventListener("click", downloadRealtimeStatusTxt);

  document.getElementById("monitorToggleBtn").addEventListener("click", () => {
    state.monitorPaused = !state.monitorPaused;
    const btn = document.getElementById("monitorToggleBtn");
    btn.textContent = state.monitorPaused ? "恢复监控" : "停止监控";
    if (state.monitorPaused) {
      stopMonitorSocket();
      return;
    }
    refreshMonitor();
    startMonitorSocket();
  });

  document.getElementById("openPortModalBtn").addEventListener("click", () => {
    if (!state.monitorSnapshot) return;
    const rows = (state.monitorSnapshot.ports || []).map((x) => [
      displayPortProcessName(x),
      x.port,
      x.pid,
      localizePortStatus(x.status),
      displayPortPath(x),
    ]);
    openModal("端口详情", renderTableHTML(["进程名", "端口", "PID", "状态", "路径"], rows));
  });

  document.getElementById("openDiskMetaModalBtn").addEventListener("click", () => {
    openDiskMetaModal();
  });

  const systemInfoBtn = document.getElementById("openSystemInfoModalBtn");
  if (systemInfoBtn) {
    systemInfoBtn.addEventListener("click", () => {
      openSystemInfoModal();
    });
  }

  const systemInfoBox = document.getElementById("systemInfoQuick");
  if (systemInfoBox) {
    systemInfoBox.addEventListener("click", async (event) => {
      const card = event.target.closest(".system-info-item");
      if (!card) return;
      await copySystemInfoCard(card);
    });
    systemInfoBox.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".system-info-item");
      if (!card) return;
      event.preventDefault();
      await copySystemInfoCard(card);
    });
  }

  document.getElementById("processSearch").addEventListener("input", renderProcessTable);
  document.getElementById("portSearch").addEventListener("input", renderPortTable);

  document.querySelectorAll(".trend-open-target").forEach((target) => {
    const openByTarget = () => {
      const key = target.dataset.trendKey;
      if (key) openTrendModal(key);
    };
    target.addEventListener("click", openByTarget);
    target.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openByTarget();
    });
  });

  document.getElementById("topProcessList").addEventListener("click", async (event) => {
    const sortHead = event.target.closest("th[data-sort-key]");
    if (sortHead) {
      toggleProcessSort(sortHead.dataset.sortKey);
      return;
    }

    const detailBtn = event.target.closest(".process-detail-btn");
    if (detailBtn) {
      const pid = Number(detailBtn.dataset.pid || 0);
      if (pid > 0) await showProcessDetail(pid);
      return;
    }

    const killBtn = event.target.closest(".process-kill-btn");
    if (!killBtn) return;
    const pid = Number(killBtn.dataset.pid || 0);
    if (pid <= 0) return;
    if (!confirm(`确认关闭进程 PID=${pid} ?`)) return;
    await killProcess(pid);
  });
}

function normalizeLegacyTrendButtons() {
  document.querySelectorAll(".trend-open-btn").forEach((btn) => {
    const key = String(btn.dataset.trendKey || "").trim();
    const row = btn.closest(".trend-row");
    const mini = row ? row.querySelector(".mini-trend") : null;
    if (mini) {
      mini.classList.add("trend-open-target");
      if (key && !mini.dataset.trendKey) mini.dataset.trendKey = key;
      if (!mini.dataset.hint) mini.dataset.hint = "点击放大";
      mini.setAttribute("role", "button");
      mini.setAttribute("tabindex", "0");
      mini.setAttribute("title", "点击放大查看 24 小时趋势");
    }
    btn.remove();
  });
}

async function downloadRealtimeStatusTxt() {
  let snapshot = state.monitorSnapshot;
  try {
    const res = await fetch("/api/monitor");
    const data = await res.json();
    if (res.ok) {
      snapshot = data;
      state.monitorSnapshot = data;
    }
  } catch (err) {
    console.error("download monitor snapshot failed", err);
  }

  if (!snapshot) {
    showAppToast("当前暂无可下载的监控数据", "warning");
    return;
  }

  const txt = buildRealtimeStatusText(snapshot);
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const ts = formatFileTimestamp(snapshot.time || Date.now());
  const a = document.createElement("a");
  a.href = url;
  a.download = `ops_status_${ts}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildRealtimeStatusText(data) {
  const diskRealtime = state.lastDiskRealtime || {
    summary: { readBytesRate: 0, writeBytesRate: 0, readOpsRate: 0, writeOpsRate: 0 },
    rateByKey: {},
  };
  const summaryRate = diskRealtime.summary || {
    readBytesRate: 0,
    writeBytesRate: 0,
    readOpsRate: 0,
    writeOpsRate: 0,
  };
  const diskRateByKey = diskRealtime.rateByKey || {};
  const lines = [];
  lines.push(`采样时间 ${formatTimeValue(data.time || Date.now())}`);
  lines.push(
    [
      `主机 ${compact(data.os?.hostname)}`,
      `系统类型 ${compact(data.os?.os_type || data.os?.platform)}`,
      `系统版本 ${compact(data.os?.version)}`,
      `内核版本 ${compact(data.os?.kernel_version || "-")}`,
      `运行时长 ${formatDuration(data.os?.uptime)}`,
    ].join(" | "),
  );
  lines.push(
    [
      `设备ID ${compact(data.os?.device_id || "-", 80)}`,
      `产品ID ${compact(data.os?.product_id || "-", 80)}`,
    ].join(" | "),
  );
  lines.push(
    [
      `CPU ${fixed(data.cpu?.usage_percent)}%`,
      `核心 ${num(data.cpu?.core_count)}`,
      `型号 ${compact(data.cpu?.model)}`,
      `架构 ${compact(data.cpu?.architecture)}`,
      `频率 ${fixed(data.cpu?.frequency_mhz)}MHz`,
    ].join(" | "),
  );

  const memSummary = summarizeMemoryModules(data.memory?.modules || []);
  lines.push(
    [
      `内存 ${bytes(data.memory?.used)} / ${bytes(data.memory?.total)} (${fixed(data.memory?.used_percent)}%)`,
      `交换区 ${bytes(data.memory?.swap_used)} / ${bytes(data.memory?.swap_total)} (${fixed(data.memory?.swap_used_rate)}%)`,
      `内存条 ${compact(memSummary)}`,
    ].join(" | "),
  );

  lines.push(
    [
      `网络IP ${compact(data.network?.primary_ip || "-")}(${compact(data.network?.primary_nic || "-")})`,
      `MAC ${compact(data.network?.primary_mac || "-")}`,
      `连接数 ${num(data.network?.connection_count || 0)}`,
      `累计入 ${bytes(data.network?.bytes_recv)}`,
      `累计出 ${bytes(data.network?.bytes_sent)}`,
      `包入 ${num(data.network?.packets_in)}`,
      `包出 ${num(data.network?.packets_out)}`,
    ].join(" | "),
  );

  lines.push(
    [
      `进程总数 ${num(data.process_count)}`,
      `线程总数 ${num(data.thread_count)}`,
      `磁盘IO实时读 ${rateBytes(summaryRate.readBytesRate)}/秒(${fixed(summaryRate.readOpsRate)}次/秒)`,
      `写 ${rateBytes(summaryRate.writeBytesRate)}/秒(${fixed(summaryRate.writeOpsRate)}次/秒)`,
    ].join(" | "),
  );

  const diskHw = data.disk_hardware || [];
  if (diskHw.length) {
    const compactHw = diskHw
      .slice(0, 6)
      .map((x) => `${compact(x.model || x.name)}#${compact(x.serial || "-")}@${bytes(x.size || 0)}`)
      .join(" ; ");
    lines.push(`磁盘硬件(${diskHw.length}) ${compactHw}`);
  }

  const disks = data.disks || [];
  lines.push(`[磁盘状态] ${disks.length} 项`);
  disks.slice(0, 24).forEach((x) => {
    const rate = diskRateByKey[buildDiskKey(x)] || {
      readBytesRate: 0,
      writeBytesRate: 0,
      readOpsRate: 0,
      writeOpsRate: 0,
    };
    lines.push(
      `${compact(x.path)} | ${compact(x.device)} | ${fixed(x.used_percent)}% | ${bytes(x.used)}/${bytes(x.total)} | 读 ${rateBytes(rate.readBytesRate)}/秒(${fixed(rate.readOpsRate)}次/秒) 写 ${rateBytes(rate.writeBytesRate)}/秒(${fixed(rate.writeOpsRate)}次/秒)`,
    );
  });

  const ports = data.ports || [];
  lines.push(`[监听端口] ${ports.length} 项`);
  ports.slice(0, 40).forEach((x) => {
    lines.push(`${x.port} | PID ${x.pid} | ${compact(displayPortProcessName(x))} | ${compact(displayPortPath(x))}`);
  });

  const protocolServices = []
    .concat((data.snmp || []).map(mapSnmpResultToService))
    .concat((data.nmap || []).map(mapNmapResultToService));
  const services = []
    .concat(data.applications || [])
    .concat(data.databases || [])
    .concat(data.middleware || [])
    .concat(protocolServices);
  lines.push(`[应用数据库中间件协议状态] ${services.length} 项`);
  services.forEach((x) => {
    lines.push(
      `${compact(x.name)} | ${localizeServiceType(x.type)} | ${localizeServiceStatus(x.status)} | ${compact(localizeServiceDetail(x.detail), 140)}`,
    );
  });

  const processes = state.combinedProcesses || [];
  lines.push(`[进程排行/JVM] ${processes.length} 项`);
  processes.slice(0, 60).forEach((x) => {
    lines.push(
      `${compact(x.name)} | ${x.is_jvm ? "JVM" : "进程"} | PID ${x.pid} | CPU ${fixed(x.cpu)}% | 内存 ${fixed(x.memory)}% | 线程 ${num(x.threads)} | ${compact(x.exe_path, 120)}`,
    );
  });

  return `${lines.join("\n")}\n`;
}

function formatTimeValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "-");
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatFileTimestamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return Date.now();
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function compact(raw, max = 90) {
  return shorten(String(raw || "-").replace(/\s+/g, " ").trim(), max);
}

function bindLogActions() {
  document.getElementById("logQueryBtn").addEventListener("click", () => queryLogs(false));
  document.getElementById("logErrorBtn").addEventListener("click", () => queryLogs(true));
  document.getElementById("logExportBtn").addEventListener("click", exportLogs);
  document.getElementById("logSearchApp").addEventListener("input", renderAppCards);
  document.getElementById("logAddCardBtn").addEventListener("click", openAddLogCardModal);
}

function syncLogRealtimeState(activeSection = "") {
  const current = String(activeSection || "").trim() || String(document.querySelector(".panel.visible")?.id || "").trim();
  if (current !== "logs" || !state.currentApp) {
    stopLogRealtimeLoop();
    return;
  }
  startLogRealtimeLoop();
}

function startLogRealtimeLoop() {
  stopLogRealtimeLoop();
  const intervalMS = 2000;
  state.logRealtimeTimer = setInterval(() => {
    if (!state.currentApp) return;
    queryLogs(false, { silent: true, fromRealtime: true });
  }, intervalMS);
}

function stopLogRealtimeLoop() {
  if (!state.logRealtimeTimer) return;
  clearInterval(state.logRealtimeTimer);
  state.logRealtimeTimer = null;
}

function bindRepairActions() {
  document.getElementById("uploadScriptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const res = await fetch("/api/scripts/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "上传失败", "error");
      return;
    }
    event.target.reset();
    await loadScripts();
    showAppToast("脚本上传成功", "success");
  });

  document.getElementById("runScriptBtn").addEventListener("click", async () => {
    const name = document.getElementById("scriptName").value;
    const args = document.getElementById("scriptArgs").value;
    if (!name) {
      showAppToast("请选择脚本", "warning");
      return;
    }

    const res = await fetch("/api/scripts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, args }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "执行失败", "error");
      return;
    }
    state.currentRunId = data.run_id;
    showAppToast("脚本已开始执行", "success");
    pollRunDetail();
  });
}

function bindBackupActions() {
  document.getElementById("runBackupBtn").addEventListener("click", async () => {
    const type = document.getElementById("backupType").value;
    const name = document.getElementById("backupName").value;
    const target = document.getElementById("backupTarget").value;

    const res = await fetch("/api/backups/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, target }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "备份失败", "error");
      return;
    }
    await loadBackups();
    showAppToast("备份任务已提交", "success");
  });
}

function bindCleanupActions() {
  const scanBtn = document.getElementById("cleanupScanBtn");
  if (!scanBtn) return;

  const stopScanBtn = document.getElementById("cleanupStopScanBtn");
  const stopGarbageBtn = document.getElementById("cleanupStopGarbageBtn");
  const loadRootsBtn = document.getElementById("cleanupLoadRootsBtn");

  if (loadRootsBtn) {
    loadRootsBtn.addEventListener("click", async () => {
      await ensureCleanupMeta(true);
    });
  }

  scanBtn.addEventListener("click", runCleanupScan);
  if (stopScanBtn) {
    stopScanBtn.addEventListener("click", stopCleanupScan);
    stopScanBtn.disabled = true;
  }

  if (stopGarbageBtn) {
    stopGarbageBtn.addEventListener("click", stopCleanupGarbage);
    stopGarbageBtn.disabled = true;
  }

  document.getElementById("cleanupApplyFilterBtn").addEventListener("click", applyCleanupFilterAndRender);
  document.getElementById("cleanupSearch").addEventListener("input", applyCleanupFilterAndRender);
  document.getElementById("cleanupLargeThresholdGB").addEventListener("change", applyCleanupFilterAndRender);
  document.getElementById("cleanupPreviewBtn").addEventListener("click", () => runGarbageCleanup(true));
  document.getElementById("cleanupRunBtn").addEventListener("click", () => runGarbageCleanup(false));

  renderTable("cleanupFileList", ["序号", "类型", "修改时间", "大小", "大小占比", "完整路径"], []);
  renderTable("cleanupLargeFileList", ["序号", "类型", "修改时间", "大小", "大小占比", "完整路径"], []);
  renderTable("cleanupDirSummaryList", ["目录", "文件数", "占用", "占比"], []);
  renderTable("cleanupTypeSummaryList", ["类型", "文件数", "占用", "占比"], []);
  renderTable("cleanupGarbageResult", ["目标", "候选文件", "候选体积", "已清理文件", "已清理体积", "失败数", "目录"], []);
}

function bindDockerActions() {
  const refreshBtn = document.getElementById("dockerRefreshBtn");
  const searchInput = document.getElementById("dockerSearch");
  const scopeSelect = document.getElementById("dockerScope");
  const table = document.getElementById("dockerContainerTable");
  if (!refreshBtn || !searchInput || !scopeSelect || !table) return;

  refreshBtn.addEventListener("click", () => {
    loadDockerDashboard(true).catch((err) => {
      console.error("refresh docker dashboard failed", err);
      showAppToast("刷新 Docker 数据失败", "error");
    });
  });
  searchInput.addEventListener("input", renderDockerContainerTable);
  scopeSelect.addEventListener("change", () => {
    loadDockerContainers(true).catch((err) => {
      console.error("reload docker containers failed", err);
      showAppToast("加载容器列表失败", "error");
    });
  });
  table.addEventListener("click", handleDockerTableClick);
}

async function loadDockerDashboard(force = false) {
  await loadDockerStatus(force);
  await loadDockerContainers(force);
}

async function loadDockerStatus(force = false) {
  if (!force && state.dockerStatus) {
    renderDockerStatusSummary();
    return state.dockerStatus;
  }
  let data = null;
  try {
    const res = await fetchWithTimeout("/api/docker/status", 12000);
    data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "加载 Docker 状态失败", "error");
      return state.dockerStatus;
    }
  } catch (err) {
    console.error("load docker status failed", err);
    showAppToast("加载 Docker 状态失败", "error");
    return state.dockerStatus;
  }
  state.dockerStatus = data || null;
  renderDockerStatusSummary();
  return state.dockerStatus;
}

async function loadDockerContainers(force = false) {
  const scope = document.getElementById("dockerScope")?.value || "all";
  const all = scope !== "running";
  let data = null;

  try {
    const res = await fetchWithTimeout(`/api/docker/containers?all=${all ? "1" : "0"}`, 20000);
    data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "加载容器列表失败", "error");
      return state.dockerContainers;
    }
  } catch (err) {
    console.error("load docker containers failed", err);
    showAppToast("加载容器列表失败", "error");
    return state.dockerContainers;
  }

  if (data?.status) {
    state.dockerStatus = data.status;
  }
  renderDockerStatusSummary();
  state.dockerContainers = Array.isArray(data?.items) ? data.items : [];
  renderDockerContainerTable();
  return state.dockerContainers;
}

function renderDockerStatusSummary() {
  const el = document.getElementById("dockerStatusSummary");
  if (!el) return;
  const st = state.dockerStatus || {};
  if (!st.installed) {
    el.textContent = "Docker 未安装或不可用。安装 Docker Desktop / Docker Engine 后即可管理容器。";
    return;
  }
  if (!st.daemon_running) {
    el.textContent = "Docker 服务未就绪（可能未安装或未启动）。安装并启动后即可管理容器。";
    return;
  }
  const parts = [];
  if (st.version) parts.push(`客户端 ${st.version}`);
  if (st.server_version) parts.push(`服务端 ${st.server_version}`);
  if (st.context) parts.push(`上下文 ${st.context}`);
  if (st.platform) parts.push(`平台 ${st.platform}`);
  el.textContent = parts.length ? parts.join(" | ") : "Docker 运行正常";
}

function renderDockerContainerTable() {
  const list = Array.isArray(state.dockerContainers) ? state.dockerContainers : [];
  renderDockerKPIs(list);

  const keyword = String(document.getElementById("dockerSearch")?.value || "")
    .trim()
    .toLowerCase();

  const filtered = list.filter((item) => {
    if (!keyword) return true;
    const text = `${item.name || ""} ${item.image || ""} ${item.id || ""} ${item.status || ""}`.toLowerCase();
    return text.includes(keyword);
  });

  const rows = filtered.map((item) => {
    const running = String(item.state || "").toLowerCase() === "running" || String(item.status || "").toLowerCase().includes("up ");
    const statusHTML = `<span class="badge ${running ? "up" : "down"}">${escapeHTML(item.status || item.state || "-")}</span>`;
    const id = escapeHTML(String(item.id || ""));
    const actions = running
      ? [
          `<button class="btn sm docker-action" data-docker-cmd="restart" data-id="${id}" data-name="${escapeHTML(item.name || "")}">重启</button>`,
          `<button class="btn sm danger docker-action" data-docker-cmd="stop" data-id="${id}" data-name="${escapeHTML(item.name || "")}">停止</button>`,
        ]
      : [
          `<button class="btn sm docker-action" data-docker-cmd="start" data-id="${id}" data-name="${escapeHTML(item.name || "")}">启动</button>`,
          `<button class="btn sm danger docker-action" data-docker-cmd="remove" data-id="${id}" data-name="${escapeHTML(item.name || "")}">删除</button>`,
        ];
    actions.push(`<button class="btn sm docker-action" data-docker-cmd="logs" data-id="${id}" data-name="${escapeHTML(item.name || "")}">日志</button>`);
    actions.push(`<button class="btn sm docker-action" data-docker-cmd="inspect" data-id="${id}" data-name="${escapeHTML(item.name || "")}">详情</button>`);

    return [
      item.name || "-",
      shorten(item.id || "-", 14),
      item.image || "-",
      statusHTML,
      item.running_for || item.created_at || "-",
      shorten(item.ports || "-", 42),
      actions.join(" "),
    ];
  });

  if (!rows.length) {
    rows.push(["-", "-", "-", "<span class=\"badge unknown\">无数据</span>", "-", "-", "当前条件下没有容器"]);
  }
  renderTable("dockerContainerTable", ["容器名", "ID", "镜像", "状态", "运行时间", "端口映射", "操作"], rows, true);
}

function renderDockerKPIs(list) {
  const items = Array.isArray(list) ? list : [];
  let running = 0;
  const imageSet = new Set();

  for (const item of items) {
    const state = String(item?.state || "").toLowerCase();
    const status = String(item?.status || "").toLowerCase();
    if (state === "running" || status.includes("up ")) {
      running += 1;
    }
    const image = String(item?.image || "").trim();
    if (image) imageSet.add(image);
  }

  const stopped = Math.max(0, items.length - running);
  setText("dockerKpiTotal", num(items.length));
  setText("dockerKpiRunning", num(running));
  setText("dockerKpiStopped", num(stopped));
  setText("dockerKpiImages", num(imageSet.size));
}

async function handleDockerTableClick(event) {
  const btn = event.target.closest("button[data-docker-cmd]");
  if (!btn) return;

  const cmd = String(btn.dataset.dockerCmd || "").trim().toLowerCase();
  const id = String(btn.dataset.id || "").trim();
  const name = String(btn.dataset.name || "").trim() || id;
  if (!cmd || !id) return;

  if (cmd === "logs") {
    try {
      const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/logs?tail=400`, 20000);
      const data = await res.json();
      if (!res.ok) {
        showAppToast(data.error || "拉取容器日志失败", "error");
        return;
      }
      openModal(`容器日志 - ${name}`, `<pre class="log-view compact">${escapeHTML(data.logs || "暂无日志")}</pre>`);
    } catch (err) {
      console.error("fetch container logs failed", err);
      showAppToast("拉取容器日志失败", "error");
    }
    return;
  }

  if (cmd === "inspect") {
    try {
      const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/inspect`, 20000);
      const data = await res.json();
      if (!res.ok) {
        showAppToast(data.error || "拉取容器详情失败", "error");
        return;
      }
      const text = JSON.stringify(data.inspect || {}, null, 2);
      openModal(`容器详情 - ${name}`, `<pre class="log-view compact">${escapeHTML(text)}</pre>`);
    } catch (err) {
      console.error("fetch container inspect failed", err);
      showAppToast("拉取容器详情失败", "error");
    }
    return;
  }

  try {
    const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/action`, 30000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: cmd }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "容器操作失败", "error");
      return;
    }
    showAppToast(`容器 ${name} ${cmd} 成功`, "success");
    await loadDockerContainers(true);
  } catch (err) {
    console.error("docker action failed", err);
    showAppToast("容器操作失败", "error");
  }
}

function setCleanupScanRunning(running) {
  const scanBtn = document.getElementById("cleanupScanBtn");
  const stopScanBtn = document.getElementById("cleanupStopScanBtn");
  const active = !!running;

  if (scanBtn) {
    scanBtn.dataset.running = active ? "1" : "0";
    scanBtn.textContent = active ? "扫描中..." : "开始扫描";
    scanBtn.disabled = active;
  }
  if (stopScanBtn) {
    stopScanBtn.disabled = !active;
  }
}

function setCleanupGarbageRunning(running) {
  const previewBtn = document.getElementById("cleanupPreviewBtn");
  const runBtn = document.getElementById("cleanupRunBtn");
  const stopBtn = document.getElementById("cleanupStopGarbageBtn");
  const active = !!running;

  if (previewBtn) previewBtn.disabled = active;
  if (runBtn) runBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
}

async function ensureCleanupMeta(force = false) {
  if (!force && state.cleanupMeta) return state.cleanupMeta;

  let data = null;
  try {
    const res = await fetchWithTimeout("/api/cleanup/meta", 15000);
    data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "加载数据清理配置失败", "error");
      return state.cleanupMeta;
    }
  } catch (err) {
    console.error("ensure cleanup meta failed", err);
    showAppToast("加载数据清理配置失败", "error");
    return state.cleanupMeta;
  }

  state.cleanupMeta = data;
  renderCleanupRootOptions(data.root_options || buildCleanupRootOptions(data.default_roots || [], data.os || ""));

  const thresholdInput = document.getElementById("cleanupLargeThresholdGB");
  if (thresholdInput && !String(thresholdInput.value || "").trim()) {
    const gb = Number(data.default_large_file_size_bytes || 0) / 1024 / 1024 / 1024;
    thresholdInput.value = gb > 0 ? gb.toFixed(0) : "1";
  }

  setCleanupIndexerTag(data.fast_indexer || null);
  renderCleanupGarbageTargets(data.garbage_targets || []);
  return data;
}

function setCleanupIndexerTag(indexer) {
  const tag = document.getElementById("cleanupIndexerTag");
  if (!tag) return;

  const available = !!indexer?.available;
  const name = String(indexer?.name || "内置引擎");
  tag.classList.toggle("slow", !available);
  tag.textContent = available ? `${name} 加速索引` : "内置扫描引擎";
}

function buildCleanupRootOptions(roots, goos) {
  const list = Array.isArray(roots) ? roots.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (!list.length) return [];

  const osName = String(goos || "").trim().toLowerCase();
  let selectedKey = "";
  if (osName === "windows") {
    selectedKey = list.find((x) => x.toLowerCase() === "c:\\") || list[0];
  } else {
    selectedKey = list.includes("/") ? "/" : list[0];
  }

  return list.map((path) => {
    const isWin = osName === "windows";
    let label = path;
    if (isWin) {
      const t = path.replace(/[\\/]+$/, "");
      if (/^[a-z]:$/i.test(t)) label = `${t} Drive`;
    }
    const selected = isWin ? path.toLowerCase() === String(selectedKey).toLowerCase() : path === selectedKey;
    return { path, label, selected };
  });
}

function renderCleanupRootOptions(options) {
  const box = document.getElementById("cleanupRootOptions");
  if (!box) return;

  const list = Array.isArray(options) ? options : [];
  if (!list.length) {
    box.innerHTML = '<span class="hint">未发现可用分区目录</span>';
    return;
  }

  box.innerHTML = list
    .map((item) => {
      const path = String(item.path || "").trim();
      if (!path) return "";
      const label = String(item.label || path).trim();
      const checked = item.selected ? "checked" : "";
      return `<label title="${escapeHTML(path)}"><input type="checkbox" class="cleanup-root-item" value="${escapeHTML(path)}" ${checked}>${escapeHTML(label)}</label>`;
    })
    .join("");
}

function selectedCleanupRoots() {
  return Array.from(document.querySelectorAll(".cleanup-root-item:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
}

function cleanupThresholdBytes() {
  const input = document.getElementById("cleanupLargeThresholdGB");
  const gb = Number(String(input?.value || "").trim());
  if (!Number.isFinite(gb) || gb <= 0) return 1024 ** 3;
  return Math.round(gb * 1024 * 1024 * 1024);
}

async function runCleanupScan() {
  if (state.cleanupScanAbortController) return;

  const meta = await ensureCleanupMeta(false);
  const effectiveRoots = selectedCleanupRoots();
  if (!effectiveRoots.length) {
    showAppToast("请至少选择一个扫描目录", "warning");
    return;
  }

  const query = String(document.getElementById("cleanupSearch")?.value || "").trim();
  const controller = new AbortController();
  state.cleanupScanAbortController = controller;
  const timeoutTimer = setTimeout(() => {
    try {
      controller.abort();
    } catch (_) {
      // ignore
    }
  }, 30 * 60 * 1000);

  try {
    setCleanupScanRunning(true);
    setText("cleanupSummary", "正在扫描，请稍候...");

    const res = await fetch("/api/cleanup/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        roots: effectiveRoots,
        query,
        limit: Number(meta?.default_scan_limit || 12000),
        large_file_size_bytes: cleanupThresholdBytes(),
        large_limit: 5000,
        summary_limit: Number(meta?.default_summary_limit || 200),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "目录扫描失败", "error");
      setText("cleanupSummary", "扫描失败");
      return;
    }

    state.cleanupScan = data.scan || {};
    applyCleanupFilterAndRender();

    setCleanupIndexerTag(data.fast_indexer || meta?.fast_indexer || null);
    showAppToast("扫描完成", "success");
  } catch (err) {
    if (err && err.name === "AbortError") {
      setText("cleanupSummary", "扫描已停止");
      showAppToast("扫描已停止", "info");
      return;
    }
    console.error("cleanup scan failed", err);
    showAppToast("目录扫描失败", "error");
    setText("cleanupSummary", "扫描失败");
  } finally {
    clearTimeout(timeoutTimer);
    if (state.cleanupScanAbortController === controller) {
      state.cleanupScanAbortController = null;
    }
    setCleanupScanRunning(false);
  }
}

function stopCleanupScan() {
  const controller = state.cleanupScanAbortController;
  if (!controller) {
    showAppToast("当前没有进行中的扫描", "warning");
    return;
  }
  try {
    controller.abort();
  } catch (_) {
    // ignore
  }
}

function stopCleanupGarbage() {
  const controller = state.cleanupGarbageAbortController;
  if (!controller) {
    showAppToast("当前没有进行中的清理", "warning");
    return;
  }
  try {
    controller.abort();
  } catch (_) {
    // ignore
  }
}

function applyCleanupFilterAndRender() {
  const scan = state.cleanupScan || {};
  const source = Array.isArray(scan.files) ? scan.files : [];
  const query = String(document.getElementById("cleanupSearch")?.value || "").trim().toLowerCase();
  const threshold = cleanupThresholdBytes();

  const filtered = source
    .filter((item) => {
      if (!query) return true;
      const path = String(item.path || "").toLowerCase();
      const name = String(item.name || "").toLowerCase();
      const type = String(item.type || "").toLowerCase();
      return path.includes(query) || name.includes(query) || type.includes(query);
    })
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));

  const largeFiltered = filtered.filter((item) => Number(item.size || 0) >= threshold);

  state.cleanupFilteredFiles = filtered;
  state.cleanupFilteredLargeFiles = largeFiltered;

  const fileRows = filtered.slice(0, 3000).map((item, idx) => [
    idx + 1,
    item.type || "-",
    formatTimeValue(item.mod_time),
    bytes(item.size || 0),
    `${Number(item.size_ratio || 0).toFixed(2)}%`,
    item.path || "-",
  ]);
  const largeRows = largeFiltered.slice(0, 3000).map((item, idx) => [
    idx + 1,
    item.type || "-",
    formatTimeValue(item.mod_time),
    bytes(item.size || 0),
    `${Number(item.size_ratio || 0).toFixed(2)}%`,
    item.path || "-",
  ]);

  renderTable("cleanupFileList", ["序号", "类型", "修改时间", "大小", "大小占比", "完整路径"], fileRows);
  renderTable("cleanupLargeFileList", ["序号", "类型", "修改时间", "大小", "大小占比", "完整路径"], largeRows);
  renderCleanupTopBars(filtered, Number(scan.matched_total_bytes || scan.total_bytes || 0));
  renderCleanupSummaryTables(scan);
  updateCleanupKpi(scan, filtered, largeFiltered, threshold);

  const rootsText = (scan.roots || []).join(" , ") || "-";
  const msg = [
    `扫描目录: ${rootsText}`,
    `已扫文件: ${num(scan.scanned_files || 0)}`,
    `命中: ${num(scan.matched_files || 0)}`,
    `耗时: ${num(scan.duration_ms || 0)}ms`,
    `当前筛选: ${num(filtered.length)} 条`,
    `大文件(>=${(threshold / 1024 / 1024 / 1024).toFixed(2)}GB): ${num(largeFiltered.length)} 条`,
  ];
  if (scan.truncated) msg.push("索引已按体积截断");
  if (scan.cancelled) msg.push("扫描已停止");
  if (Array.isArray(scan.errors) && scan.errors.length) msg.push(`权限/访问异常: ${scan.errors[0]}`);
  setText("cleanupSummary", msg.join(" | "));
}

function updateCleanupKpi(scan, filtered, largeFiltered, thresholdBytes) {
  setText("cleanupKpiScanned", num(scan.scanned_files || 0));
  setText("cleanupKpiMatched", num(filtered.length));
  setText("cleanupKpiSize", bytes(scan.matched_total_bytes || scan.total_bytes || 0));
  setText("cleanupKpiLarge", num(largeFiltered.length));

  const thresholdInput = document.getElementById("cleanupLargeThresholdGB");
  if (thresholdInput) {
    const gb = thresholdBytes / 1024 / 1024 / 1024;
    thresholdInput.title = `当前大文件阈值 ${gb.toFixed(2)} GB`;
  }
}

function renderCleanupTopBars(files, totalBytes) {
  const box = document.getElementById("cleanupTopBars");
  if (!box) return;

  const list = Array.isArray(files) ? files.slice(0, 42) : [];
  const base = Number(totalBytes || 0) > 0 ? Number(totalBytes) : Number(list.reduce((sum, x) => sum + Number(x.size || 0), 0));
  if (!list.length || base <= 0) {
    box.innerHTML = '<p class="hint">扫描完成后显示体积热区</p>';
    return;
  }

  box.innerHTML = list
    .map((item) => {
      const size = Number(item.size || 0);
      const ratio = Math.max(0.2, Math.min(100, (size * 100) / base));
      const p = String(item.path || "-");
      return `
        <div class="cleanup-bar-item" title="${escapeHTML(p)}">
          <div class="cleanup-bar-fill" style="width:${ratio.toFixed(2)}%"></div>
          <div class="cleanup-bar-text">
            <span class="cleanup-bar-path">${escapeHTML(p)}</span>
            <span>${escapeHTML(bytes(size))}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCleanupSummaryTables(scan) {
  const dirRows = (Array.isArray(scan.directory_summary) ? scan.directory_summary : []).slice(0, 200).map((item) => [
    item.path || "-",
    num(item.file_count || 0),
    bytes(item.size || 0),
    `${Number(item.size_ratio || 0).toFixed(2)}%`,
  ]);
  renderTable("cleanupDirSummaryList", ["目录", "文件数", "占用", "占比"], dirRows);

  const typeRows = (Array.isArray(scan.type_summary) ? scan.type_summary : []).slice(0, 200).map((item) => [
    item.type || "none",
    num(item.file_count || 0),
    bytes(item.size || 0),
    `${Number(item.size_ratio || 0).toFixed(2)}%`,
  ]);
  renderTable("cleanupTypeSummaryList", ["类型", "文件数", "占用", "占比"], typeRows);
}

function renderCleanupGarbageTargets(targets) {
  const box = document.getElementById("cleanupGarbageTargets");
  if (!box) return;

  const list = Array.isArray(targets) ? targets : [];
  if (!list.length) {
    box.innerHTML = '<span class="hint">暂无可用清理目标</span>';
    return;
  }

  box.innerHTML = list
    .map((item) => {
      const checked = item.enabled ? "checked" : "";
      const disabled = item.exists ? "" : "disabled";
      const title = `${item.name} (${item.path})`;
      return `<label title="${escapeHTML(title)}"><input type="checkbox" class="cleanup-target-item" value="${escapeHTML(item.id)}" ${checked} ${disabled}>${escapeHTML(item.name)} [保留${num(item.keep_hours || 0)}h]</label>`;
    })
    .join("");
}

function selectedCleanupTargetIDs() {
  return Array.from(document.querySelectorAll(".cleanup-target-item:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
}

async function runGarbageCleanup(dryRun) {
  if (state.cleanupGarbageAbortController) return;

  const meta = await ensureCleanupMeta(false);
  if (!meta) return;

  const targetIDs = selectedCleanupTargetIDs();
  if (!targetIDs.length) {
    showAppToast("请至少勾选一个清理目标", "warning");
    return;
  }

  if (!dryRun) {
    const ok = confirm("将按安全策略删除目标目录中的旧缓存/临时/日志文件，是否继续？");
    if (!ok) return;
  }

  const controller = new AbortController();
  state.cleanupGarbageAbortController = controller;
  const timeoutTimer = setTimeout(() => {
    try {
      controller.abort();
    } catch (_) {
      // ignore
    }
  }, 10 * 60 * 1000);

  try {
    setCleanupGarbageRunning(true);
    setText("cleanupGarbageSummary", dryRun ? "正在预估可清理文件..." : "正在执行清理...");

    const res = await fetch("/api/cleanup/garbage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        target_ids: targetIDs,
        dry_run: dryRun,
        limit: Number(meta.default_garbage_limit || 5000),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "清理执行失败", "error");
      setText("cleanupGarbageSummary", "清理失败");
      return;
    }

    renderCleanupGarbageResult(data);
    const summary = [
      dryRun ? "预估完成" : "清理完成",
      `候选: ${num(data.total_candidate_files || 0)} 文件`,
      `候选体积: ${bytes(data.total_candidate_bytes || 0)}`,
      `已清理: ${num(data.total_deleted_files || 0)} 文件`,
      `已清理体积: ${bytes(data.total_deleted_bytes || 0)}`,
      `失败: ${num(data.total_failed_files || 0)}`,
    ];
    if (data.cancelled) summary.push("操作已停止");
    setText("cleanupGarbageSummary", summary.join(" | "));

    if (dryRun) {
      showAppToast("预估完成", "success");
      return;
    }

    showAppToast(`清理完成，已删除 ${num(data.total_deleted_files || 0)} 个文件`, "success");
    if (state.cleanupScan) {
      runCleanupScan();
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      setText("cleanupGarbageSummary", "清理已停止");
      showAppToast("清理已停止", "info");
      return;
    }
    console.error("cleanup garbage failed", err);
    showAppToast("清理执行失败", "error");
    setText("cleanupGarbageSummary", "清理失败");
  } finally {
    clearTimeout(timeoutTimer);
    if (state.cleanupGarbageAbortController === controller) {
      state.cleanupGarbageAbortController = null;
    }
    setCleanupGarbageRunning(false);
  }
}

function renderCleanupGarbageResult(data) {
  const items = Array.isArray(data?.targets) ? data.targets : [];
  const rows = items.map((item) => [
    item.name || item.id || "-",
    num(item.candidate_files || 0),
    bytes(item.candidate_bytes || 0),
    num(item.deleted_files || 0),
    bytes(item.deleted_bytes || 0),
    num(item.failed_files || 0),
    item.path || "-",
  ]);
  renderTable("cleanupGarbageResult", ["目标", "候选文件", "候选体积", "已清理文件", "已清理体积", "失败数", "目录"], rows);
}
function bindModal() {
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  document.getElementById("modalMask").addEventListener("click", (event) => {
    if (event.target.id === "modalMask") closeModal();
  });
}

async function loadConfig() {
  const res = await fetchWithTimeout("/api/config", 10000);
  state.config = await res.json();
  state.logRules = state.config?.log_analysis?.rules || [];

  const select = document.getElementById("logRule");
  select.innerHTML = "<option value=\"\">常见问题规则</option>";
  state.logRules.forEach((rule) => {
    const op = document.createElement("option");
    op.value = rule.name;
    op.textContent = `${rule.name} - ${rule.description}`;
    select.appendChild(op);
  });
}

async function loadTrendHistory() {
  const res = await fetchWithTimeout("/api/monitor/trends?hours=24", 12000);
  const data = await res.json();
  if (!res.ok) return;
  const series = data?.series || {};
  Object.keys(TREND_SERIES).forEach((key) => {
    state.trendHistory[key] = normalizeTrendPoints(series[key]);
  });
  renderTrendCards();
}

function startMonitorLoop() {
  if (state.monitorTimer) clearInterval(state.monitorTimer);
  const sec = state.config?.monitor?.refresh_seconds || 5;
  state.monitorTimer = setInterval(() => {
    if (state.monitorPaused) return;
    if (state.monitorWSConnected) return;
    refreshMonitor();
  }, sec * 1000);
}

function applyMonitorSnapshot(data) {
  if (!data || typeof data !== "object") return;
  state.monitorSnapshot = data;
  state.combinedProcesses = mergeProcessList(data.top_processes || [], data.jvm || []);
  renderMonitor(data);
}

async function refreshMonitor(strict = false) {
  try {
    const res = await fetchWithTimeout("/api/monitor", 45000);
    if (!res.ok) {
      throw new Error(`monitor status ${res.status}`);
    }
    const data = await res.json();
    applyMonitorSnapshot(data);
    return data;
  } catch (err) {
    if (strict) throw err;
    console.error("refresh monitor failed", err);
    return null;
  }
}

function monitorWSURL() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws/monitor`;
}

function startMonitorSocket() {
  if (state.monitorPaused) return;
  if (state.monitorWS) return;

  let ws;
  try {
    ws = new WebSocket(monitorWSURL());
  } catch (err) {
    console.error("create monitor websocket failed", err);
    scheduleMonitorSocketReconnect();
    return;
  }

  state.monitorWS = ws;
  ws.addEventListener("open", () => {
    state.monitorWSConnected = true;
    state.monitorWSRetryAttempt = 0;
    if (state.monitorWSRetryTimer) {
      clearTimeout(state.monitorWSRetryTimer);
      state.monitorWSRetryTimer = null;
    }
  });

  ws.addEventListener("message", (event) => {
    handleMonitorSocketMessage(event.data);
  });

  ws.addEventListener("error", (event) => {
    console.error("monitor websocket error", event);
  });

  ws.addEventListener("close", () => {
    const hadConnection = state.monitorWSConnected;
    state.monitorWSConnected = false;
    state.monitorWS = null;
    if (state.monitorPaused) return;
    if (hadConnection) {
      refreshMonitor();
    }
    scheduleMonitorSocketReconnect();
  });
}

function scheduleMonitorSocketReconnect() {
  if (state.monitorPaused) return;
  if (state.monitorWS || state.monitorWSRetryTimer) return;

  const attempt = (state.monitorWSRetryAttempt || 0) + 1;
  state.monitorWSRetryAttempt = attempt;
  const delay = Math.min(MONITOR_WS_RETRY_MAX_MS, Math.round(MONITOR_WS_RETRY_BASE_MS * 1.5 ** (attempt - 1)));
  state.monitorWSRetryTimer = setTimeout(() => {
    state.monitorWSRetryTimer = null;
    startMonitorSocket();
  }, delay);
}

function stopMonitorSocket() {
  if (state.monitorWSRetryTimer) {
    clearTimeout(state.monitorWSRetryTimer);
    state.monitorWSRetryTimer = null;
  }
  const ws = state.monitorWS;
  state.monitorWS = null;
  state.monitorWSConnected = false;
  if (!ws) return;
  if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
    try {
      ws.close(1000, "monitor paused");
    } catch (err) {
      console.error("close monitor websocket failed", err);
    }
  }
}

function handleMonitorSocketMessage(raw) {
  if (state.monitorPaused) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error("parse monitor websocket message failed", err);
    return;
  }

  if (!payload || payload.type !== "snapshot" || !payload.data) return;
  applyMonitorSnapshot(payload.data);
}

function renderMonitor(data) {
  const sampleTS = parseTrendTimestamp(data?.time, Date.now());
  const io = normalizedDiskIOSummary(data);
  const rates = updateTrendHistory(data, io);
  const diskRealtime = calculateDiskRealtime(data, sampleTS);
  const summaryRate = diskRealtime.summary || {
    readBytesRate: 0,
    writeBytesRate: 0,
    readOpsRate: 0,
    writeOpsRate: 0,
  };
  const diskRateByKey = diskRealtime.rateByKey || {};

  const cpuUsageVal = Number(data.cpu?.usage_percent || 0);
  const cpuPressure = resolvePressureLevel(cpuUsageVal);
  const cpuPressureText = pressureLevelText(cpuPressure);
  setText("cpuUsage", `${fixed(cpuUsageVal)}%`);
  setText(
    "cpuCore",
    `核心 ${num(data.cpu?.core_count)} | ${shorten(data.cpu?.model || "型号未知", 48)} | 架构 ${data.cpu?.architecture || "-"} | ${fixed(data.cpu?.frequency_mhz)} MHz${cpuPressureText ? ` | ${cpuPressureText}` : ""}`,
  );

  const memUsageVal = Number(data.memory?.used_percent || 0);
  const memPressure = resolvePressureLevel(memUsageVal);
  const memPressureText = pressureLevelText(memPressure);
  setText("memUsage", `${fixed(memUsageVal)}%`);
  setText(
    "memDetail",
    `${bytes(data.memory?.used)} / ${bytes(data.memory?.total)} | ${summarizeMemoryModules(data.memory?.modules || [])}${memPressureText ? ` | ${memPressureText}` : ""}`,
  );

  const netTrafficEl = document.getElementById("netTraffic");
  if (netTrafficEl) {
    netTrafficEl.innerHTML = `入 ${bytes(rates.netInRate)}/秒<br/>出 ${bytes(rates.netOutRate)}/秒`;
  }
  setText(
    "netPackets",
    `当前网卡 ${data.network?.primary_nic || "-"}${data.network?.primary_mac ? ` | MAC ${data.network?.primary_mac}` : ""} | 连接数 ${num(data.network?.connection_count || 0)} | 实时总吞吐 ${bytes(rates.netRate)}/秒`,
  );

  setText("processCount", `${num(data.process_count)}`);
  renderSystemInfo(data);
  setText("osInfo", `${data.os?.hostname || "-"} / ${data.os?.platform || "-"} / 运行时长 ${formatDuration(data.os?.uptime)}`);

  const diskIoFlowEl = document.getElementById("diskIoFlow");
  if (diskIoFlowEl) {
    diskIoFlowEl.innerHTML = `读 ${rateBytes(summaryRate.readBytesRate)}/秒<br/>写 ${rateBytes(summaryRate.writeBytesRate)}/秒`;
  }
  const diskCount = Number((data.disk_hardware || []).length || (data.disks || []).length || 0);
  setText(
    "diskIoOps",
    `读 IOPS ${fixed(summaryRate.readOpsRate)}次/秒 | 写 IOPS ${fixed(summaryRate.writeOpsRate)}次/秒 | 磁盘数 ${num(diskCount)} | ${summarizeDiskHardware(data.disk_hardware || [])}`,
  );
  setText("diskIoSummary", summarizeDiskHardwareDetail(data.disk_hardware || []));

  setBar("cpuBar", cpuUsageVal);
  setBar("memBar", memUsageVal);
  applyPressureStyle("cpu", cpuUsageVal);
  applyPressureStyle("memory", memUsageVal);

  renderTable(
    "diskList",
    ["挂载点", "设备", "文件系统", "使用率", "健康状态", "容量", "实时读速率", "实时写速率", "实时读IOPS", "实时写IOPS"],
    (data.disks || []).map((x) => {
      const usage = Number(x.used_percent || 0);
      const usageClass = diskUsageClass(usage);
      const usageText = diskUsageText(usage);
      const rate = diskRateByKey[buildDiskKey(x)] || {
        readBytesRate: 0,
        writeBytesRate: 0,
        readOpsRate: 0,
        writeOpsRate: 0,
      };
      return {
        rowClass: `disk-row ${usageClass}`,
        cells: [
          x.path,
          x.device || "-",
          x.fs_type || "-",
          `<span class="disk-usage-tag ${usageClass}">${fixed(usage)}%</span>`,
          `<span class="disk-health-tag ${usageClass}">${usageText}</span>`,
          `${bytes(x.used)} / ${bytes(x.total)}`,
          `${rateBytes(rate.readBytesRate)}/秒`,
          `${rateBytes(rate.writeBytesRate)}/秒`,
          `${fixed(rate.readOpsRate)}次/秒`,
          `${fixed(rate.writeOpsRate)}次/秒`,
        ],
      };
    }),
    true,
  );

  renderPortTable();

  const protocolServices = []
    .concat((data.snmp || []).map(mapSnmpResultToService))
    .concat((data.nmap || []).map(mapNmapResultToService));

  const services = []
    .concat(data.applications || [])
    .concat(data.databases || [])
    .concat(data.middleware || [])
    .concat(protocolServices);

  const serviceRows = services.map((x) => [
    escapeHTML(x.name || "-"),
    escapeHTML(localizeServiceType(x.type)),
    `<span class="badge ${statusClass(x.status)}">${escapeHTML(localizeServiceStatus(x.status))}</span>`,
    escapeHTML(localizeServiceDetail(x.detail)),
  ]);
  renderTable("serviceList", ["名称", "类型", "状态", "匹配详情"], serviceRows, true);

  renderTrendCards();
  refreshTrendModalIfOpen();

  renderProcessTable();
}

function updateTrendHistory(data, io) {
  const now = Date.now();
  const sampleTS = parseTrendTimestamp(data?.time, now);
  const netInTotal = Number(data.network?.bytes_recv || 0);
  const netOutTotal = Number(data.network?.bytes_sent || 0);
  const netTotal = netInTotal + netOutTotal;
  const diskTotal = Number(io.readBytes || 0) + Number(io.writeBytes || 0);

  let netInRate = 0;
  let netOutRate = 0;
  let netRate = 0;
  let diskRate = 0;
  if (state.trendLastSample) {
    const dt = Math.max(1, (now - state.trendLastSample.ts) / 1000);
    netInRate = Math.max(0, (netInTotal - Number(state.trendLastSample.netInTotal || 0)) / dt);
    netOutRate = Math.max(0, (netOutTotal - Number(state.trendLastSample.netOutTotal || 0)) / dt);
    netRate = netInRate + netOutRate;
    diskRate = Math.max(0, (diskTotal - Number(state.trendLastSample.diskTotal || 0)) / dt);
  }
  state.trendLastSample = { ts: now, netInTotal, netOutTotal, netTotal, diskTotal };

  pushTrendPoint("cpu", Number(data.cpu?.usage_percent || 0), sampleTS);
  pushTrendPoint("memory", Number(data.memory?.used_percent || 0), sampleTS);
  pushTrendPoint("network", netRate, sampleTS);
  pushTrendPoint("process", Number(data.process_count || 0), sampleTS);
  pushTrendPoint("diskio", diskRate, sampleTS);

  return { netInRate, netOutRate, netRate, diskRate };
}

function pushTrendPoint(key, value, ts = Date.now()) {
  if (!Number.isFinite(value)) return;
  if (!state.trendHistory[key]) state.trendHistory[key] = [];
  const list = state.trendHistory[key];
  const pointTS = parseTrendTimestamp(ts, Date.now());
  if (list.length && Number(list[list.length - 1]?.ts || 0) === pointTS) {
    list[list.length - 1] = { ts: pointTS, value };
  } else {
    list.push({ ts: pointTS, value });
  }
  const keepAfter = pointTS - TREND_KEEP_MS;
  while (list.length && Number(list[0]?.ts || 0) < keepAfter) {
    list.shift();
  }
}

function normalizeTrendPoints(raw) {
  const now = Date.now();
  const keepAfter = now - TREND_KEEP_MS;
  const list = Array.isArray(raw)
    ? raw
        .map((p) => ({
          ts: parseTrendTimestamp(p?.ts, 0),
          value: Number(p?.value),
        }))
        .filter((p) => p.ts > 0 && Number.isFinite(p.value) && p.ts >= keepAfter)
    : [];
  list.sort((a, b) => a.ts - b.ts);
  return list;
}

function parseTrendTimestamp(raw, fallback) {
  const n = Number(raw || 0);
  if (Number.isFinite(n) && n > 0) return n;
  return Number(fallback || Date.now());
}

function selectTrendWindow(points, windowMS) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return [];
  const lastTS = Number(list[list.length - 1]?.ts || Date.now());
  const startTS = lastTS - Number(windowMS || TREND_KEEP_MS);
  return list.filter((p) => Number(p?.ts || 0) >= startTS);
}

function downsampleTrendPoints(points, maxPoints) {
  const list = Array.isArray(points) ? points : [];
  const max = Math.max(2, Number(maxPoints || 0));
  if (list.length <= max) return list;
  const step = (list.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    out.push(list[Math.min(list.length - 1, idx)]);
  }
  return out;
}

function renderTrendCards() {
  Object.entries(TREND_SERIES).forEach(([key, cfg]) => {
    const allPoints = state.trendHistory[key] || [];
    const points = selectTrendWindow(allPoints, TREND_MINI_MS);
    const mini = document.getElementById(cfg.miniId);
    if (mini) {
      mini.innerHTML = renderTrendSVG(points, {
        width: 320,
        height: 54,
        stroke: cfg.color,
        fill: cfg.fill,
      });
    }

    const info = document.getElementById(cfg.infoId);
    if (!info) return;
    if (!points.length) {
      info.textContent = "-";
      return;
    }
    const latest = points[points.length - 1].value;
    const highest = Math.max(...points.map((p) => Number(p.value || 0)));
    info.textContent = `近${TREND_MINI_HOURS}小时 最新 ${cfg.format(latest)} | 最高 ${cfg.format(highest)}`;
  });
}

function openTrendModal(key) {
  state.activeTrendKey = String(key || "");
  state.activeTrendAutoFollow = true;
  state.activeTrendScrollLeft = 0;
  renderTrendModal(state.activeTrendKey, { open: true });
}

function refreshTrendModalIfOpen() {
  if (!state.activeTrendKey) return;
  const mask = document.getElementById("modalMask");
  if (!mask || mask.classList.contains("hidden")) {
    clearActiveTrendModalState();
    return;
  }
  renderTrendModal(state.activeTrendKey, { open: false });
}

function renderTrendModal(key, options = {}) {
  const cfg = TREND_SERIES[key];
  if (!cfg) return;
  const open = !!options.open;
  const points = selectTrendWindow(state.trendHistory[key] || [], TREND_KEEP_MS);
  if (!points.length) {
    if (open) {
      openModal(cfg.title, `<div class="trend-empty">暂无趋势数据</div>`, { keepTrend: true });
    } else {
      setModalContent(cfg.title, `<div class="trend-empty">暂无趋势数据</div>`);
    }
    return;
  }
  const renderPoints = downsampleTrendPoints(points, TREND_MAX_RENDER_POINTS);
  const chartWidth = Math.max(TREND_DETAIL_MIN_WIDTH, Math.round(renderPoints.length * TREND_DETAIL_POINT_PX));

  const latestPoint = points[points.length - 1];
  const latest = latestPoint.value;
  const highest = Math.max(...points.map((p) => Number(p.value || 0)));
  const lowest = Math.min(...points.map((p) => Number(p.value || 0)));
  const latestTimeText = formatTimeValue(latestPoint.ts);
  const refreshSec = Math.max(1, Number(state.config?.monitor?.refresh_seconds || 5));
  const html = `
    <div class="trend-modal-wrap">
      <div class="trend-live-bar">
        <span class="trend-live-item trend-live-now"><span class="trend-live-dot"></span>当前最新值 <strong>${escapeHTML(cfg.format(latest))}</strong></span>
        <span class="trend-live-item">采样时间 ${escapeHTML(latestTimeText)}</span>
        <span class="trend-live-item">实时刷新 ${refreshSec} 秒</span>
      </div>
      <div class="trend-modal-meta">近24小时采样点 ${points.length}，最新值 ${escapeHTML(cfg.format(latest))}，最高值 ${escapeHTML(cfg.format(highest))}，最低值 ${escapeHTML(cfg.format(lowest))}</div>
      <div class="trend-modal-chart">
        <div class="trend-modal-scroll">
          <div class="trend-modal-canvas" style="width:${chartWidth}px">
            ${renderTrendSVG(renderPoints, { width: chartWidth, height: 300, stroke: cfg.color, fill: cfg.fill, showTimeAxis: true })}
          </div>
        </div>
      </div>
    </div>
  `;
  if (open) {
    openModal(cfg.title, html, { keepTrend: true });
  } else {
    setModalContent(cfg.title, html);
  }

  requestAnimationFrame(() => {
    const scrollBox = document.querySelector("#modalBody .trend-modal-scroll");
    if (!scrollBox) return;
    const maxLeft = Math.max(0, scrollBox.scrollWidth - scrollBox.clientWidth);
    if (state.activeTrendAutoFollow) {
      scrollBox.scrollLeft = maxLeft;
    } else {
      const remember = Number(state.activeTrendScrollLeft || 0);
      scrollBox.scrollLeft = Math.max(0, Math.min(maxLeft, remember));
    }
  });

  bindTrendModalHover(renderPoints, cfg);
}

function renderTrendSVG(points, options = {}) {
  const width = Number(options.width || 640);
  const height = Number(options.height || 220);
  const stroke = options.stroke || "#0f5fd8";
  const fill = options.fill || "rgba(15,95,216,0.16)";
  const showTimeAxis = !!options.showTimeAxis;
  const geo = getTrendGeometry(points, width, height, showTimeAxis);
  if (!geo) {
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"></svg>`;
  }
  const linePoints = geo.coords.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPoints = `${geo.padX},${geo.baseY.toFixed(2)} ${linePoints} ${geo.coords[geo.coords.length - 1].x.toFixed(2)},${geo.baseY.toFixed(2)}`;
  const last = geo.coords[geo.coords.length - 1];
  const midY = (geo.topPad + geo.chartHeight / 2).toFixed(2);
  let axisHTML = "";
  if (showTimeAxis) {
    axisHTML = buildTrendTimeAxis(geo.points, geo.padX, width - geo.padX, geo.baseY, height);
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line x1="${geo.padX}" y1="${midY}" x2="${width - geo.padX}" y2="${midY}" stroke="rgba(88,109,130,0.25)" stroke-dasharray="3 3"></line>
      <polygon points="${areaPoints}" fill="${fill}"></polygon>
      <polyline points="${linePoints}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="3.2" fill="${stroke}" stroke="#fff" stroke-width="1"></circle>
      ${axisHTML}
    </svg>
  `;
}

function getTrendGeometry(points, width, height, showTimeAxis) {
  const list = (points || [])
    .map((p) => ({ ts: Number(p?.ts || 0), value: Number(p?.value) }))
    .filter((p) => Number.isFinite(p.value));
  if (!list.length) return null;

  const padX = 10;
  const topPad = 8;
  const bottomPad = showTimeAxis ? 28 : 8;
  const min = Math.min(...list.map((x) => x.value));
  const max = Math.max(...list.map((x) => x.value));
  const range = max - min || 1;
  const step = list.length > 1 ? (width - padX * 2) / (list.length - 1) : 0;
  const chartHeight = Math.max(1, height - topPad - bottomPad);
  const baseY = topPad + chartHeight;
  const coords = list.map((p, i) => ({
    ...p,
    x: padX + i * step,
    y: topPad + (1 - (p.value - min) / range) * chartHeight,
  }));
  return { points: list, coords, padX, topPad, bottomPad, min, max, range, step, chartHeight, baseY };
}

function buildTrendTimeAxis(points, xStart, xEnd, axisY, height) {
  if (!points?.length) return "";
  const count = points.length;
  const indexes = [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
  const tickItems = indexes.map((idx) => {
    const ratio = count > 1 ? idx / (count - 1) : 0;
    const x = xStart + (xEnd - xStart) * ratio;
    const label = formatTrendTimeLabel(points[idx]?.ts);
    const anchor = idx === 0 ? "start" : idx === count - 1 ? "end" : "middle";
    return `
      <line x1="${x.toFixed(2)}" y1="${axisY.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(axisY + 5).toFixed(2)}" stroke="rgba(97,113,132,0.7)"></line>
      <text x="${x.toFixed(2)}" y="${Math.min(height - 2, axisY + 16).toFixed(2)}" text-anchor="${anchor}" fill="#5a6b82" font-size="11">${label}</text>
    `;
  });

  return `
    <line x1="${xStart.toFixed(2)}" y1="${axisY.toFixed(2)}" x2="${xEnd.toFixed(2)}" y2="${axisY.toFixed(2)}" stroke="rgba(97,113,132,0.5)"></line>
    ${tickItems.join("")}
  `;
}

function formatTrendTimeLabel(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return "--:--:--";
  const d = new Date(n);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function bindTrendModalHover(points, cfg) {
  const chart = document.querySelector("#modalBody .trend-modal-canvas");
  if (!chart) return;
  const svg = chart.querySelector("svg");
  if (!svg) return;

  const vb = (svg.getAttribute("viewBox") || "0 0 980 300")
    .trim()
    .split(/\s+/)
    .map((x) => Number(x));
  const width = vb[2] || 980;
  const height = vb[3] || 300;
  const geo = getTrendGeometry(points, width, height, true);
  if (!geo) return;

  chart.style.position = "relative";
  const scrollBox = chart.closest(".trend-modal-scroll");

  const cross = document.createElement("div");
  cross.className = "trend-crosshair hidden";
  chart.appendChild(cross);

  const dot = document.createElement("div");
  dot.className = "trend-hover-dot hidden";
  chart.appendChild(dot);

  const tip = document.createElement("div");
  tip.className = "trend-hover-tip hidden";
  chart.appendChild(tip);

  const hide = () => {
    cross.classList.add("hidden");
    dot.classList.add("hidden");
    tip.classList.add("hidden");
  };

  const renderAt = (idx, rect) => {
    const i = Math.max(0, Math.min(geo.coords.length - 1, idx));
    const point = geo.coords[i];
    const xPx = (point.x / width) * rect.width;
    const yPx = (point.y / height) * rect.height;
    const yStart = (geo.topPad / height) * rect.height;
    const yEnd = (geo.baseY / height) * rect.height;

    cross.classList.remove("hidden");
    cross.style.left = `${xPx}px`;
    cross.style.top = `${yStart}px`;
    cross.style.height = `${Math.max(8, yEnd - yStart)}px`;
    cross.style.background = `${cfg.color}66`;

    dot.classList.remove("hidden");
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;
    dot.style.borderColor = cfg.color;

    tip.classList.remove("hidden");
    tip.textContent = `${formatTrendTimeLabel(point.ts)} | ${cfg.format(point.value)}`;

    let tx = xPx + 12;
    let ty = yPx - 36;
    const tipW = tip.offsetWidth || 120;
    const visibleLeft = scrollBox ? Number(scrollBox.scrollLeft || 0) : 0;
    const visibleRight = scrollBox ? visibleLeft + Number(scrollBox.clientWidth || rect.width) : rect.width;
    if (tx + tipW > visibleRight - 6) tx = xPx - tipW - 12;
    if (tx < visibleLeft + 6) tx = visibleLeft + 6;
    if (ty < 6) ty = yPx + 12;
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
  };

  const onMove = (clientX) => {
    const rect = chart.getBoundingClientRect();
    if (!rect.width) return;
    const x = clientX - rect.left;
    const xSvg = (Math.max(0, Math.min(rect.width, x)) / rect.width) * width;
    let idx = 0;
    if (geo.step > 0) {
      idx = Math.round((xSvg - geo.padX) / geo.step);
    }
    renderAt(idx, rect);
  };

  const showLatest = () => {
    const rect = chart.getBoundingClientRect();
    if (!rect.width) return;
    renderAt(Math.max(0, geo.coords.length - 1), rect);
  };

  chart.addEventListener("mouseenter", (e) => onMove(e.clientX));
  chart.addEventListener("mousemove", (e) => onMove(e.clientX));
  chart.addEventListener("mouseleave", hide);

  if (scrollBox) {
    const syncFollowState = () => {
      const maxLeft = Math.max(0, scrollBox.scrollWidth - scrollBox.clientWidth);
      state.activeTrendScrollLeft = Number(scrollBox.scrollLeft || 0);
      state.activeTrendAutoFollow = maxLeft <= 0 || state.activeTrendScrollLeft >= maxLeft - 16;
    };
    scrollBox.addEventListener("scroll", syncFollowState);
  }

  requestAnimationFrame(() => {
    const sb = chart.closest(".trend-modal-scroll");
    if (sb) {
      const maxLeft = Math.max(0, sb.scrollWidth - sb.clientWidth);
      if (state.activeTrendAutoFollow) {
        sb.scrollLeft = maxLeft;
      } else {
        const remember = Number(state.activeTrendScrollLeft || 0);
        sb.scrollLeft = Math.max(0, Math.min(maxLeft, remember));
      }
    }
    requestAnimationFrame(showLatest);
  });
}

function mapSnmpResultToService(item) {
  const detailParts = [];
  if (item.target) detailParts.push(item.target);
  if (item.detail) detailParts.push(item.detail);
  if (typeof item.latency_ms === "number" && item.latency_ms > 0) detailParts.push(`延迟=${item.latency_ms}ms`);
  return {
    name: item.name || item.target || "SNMP",
    type: "snmp",
    status: item.status || "unknown",
    detail: detailParts.join(" | "),
  };
}

function mapNmapResultToService(item) {
  const detailParts = [];
  if (item.address) detailParts.push(`地址=${item.address}`);
  if (item.detail) detailParts.push(item.detail);
  if (typeof item.open_ports === "number") detailParts.push(`开放端口数=${item.open_ports}`);
  if (typeof item.latency_ms === "number" && item.latency_ms > 0) detailParts.push(`延迟=${item.latency_ms}ms`);
  return {
    name: item.hostname || item.target || "Nmap",
    type: "nmap",
    status: item.status || "unknown",
    detail: detailParts.join(" | "),
  };
}

function renderPortTable() {
  const ports = state.monitorSnapshot?.ports || [];
  const keyword = (document.getElementById("portSearch")?.value || "").trim().toLowerCase();
  const filtered = ports.filter((x) => {
    if (!keyword) return true;
    const searchable = [
      displayPortProcessName(x),
      x.port,
      x.pid,
      localizePortStatus(x.status),
      displayPortPath(x),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(keyword);
  });

  const limit = keyword ? 120 : 10;
  const rows = filtered.slice(0, limit).map((x) => [
    displayPortProcessName(x),
    x.port,
    x.pid,
    localizePortStatus(x.status),
    displayPortPath(x),
  ]);
  renderTable("portList", ["进程名", "端口", "PID", "状态", "路径"], rows);
}

function renderProcessTable() {
  const keyword = (document.getElementById("processSearch")?.value || "").trim().toLowerCase();
  const sortMode = state.processSortMode || "cpu_desc";

  const rows = state.combinedProcesses
    .filter((x) => {
      if (!keyword) return true;
      const searchable = `${x.name || ""} ${x.exe_path || ""} ${x.cmdline || ""} ${x.pid || ""}`.toLowerCase();
      return searchable.includes(keyword);
    })
    .sort((a, b) => compareProcess(a, b, sortMode))
    .map((x) => [
      x.name || "-",
      x.is_jvm ? "JVM" : "进程",
      x.pid,
      `${fixed(x.cpu)}%`,
      `${fixed(x.memory)}%`,
      x.threads ?? "-",
      x.exe_path || "-",
      `<button class="btn sm process-detail-btn" data-pid="${x.pid}">资源详情</button>
       <button class="btn sm danger process-kill-btn" data-pid="${x.pid}">关闭进程</button>`,
    ]);

  renderTable(
    "topProcessList",
    [
      processSortHeader("进程", "name"),
      processSortHeader("类型", "type"),
      processSortHeader("PID", "pid"),
      processSortHeader("CPU%", "cpu"),
      processSortHeader("内存%", "mem"),
      processSortHeader("线程", "threads"),
      "路径",
      "操作",
    ],
    rows,
    true,
  );
  bindTopProcessSortHeaders();
}

function bindTopProcessSortHeaders() {
  const table = document.querySelector("#topProcessList table");
  if (!table) return;
  const headers = table.querySelectorAll("thead th");
  if (headers.length < 8) return;
  const sortableDefs = [
    { index: 0, key: "name", title: "点击切换进程名排序" },
    { index: 1, key: "type", title: "点击切换类型排序" },
    { index: 2, key: "pid", title: "点击切换 PID 排序" },
    { index: 3, key: "cpu", title: "点击切换 CPU 排序" },
    { index: 4, key: "mem", title: "点击切换内存排序" },
    { index: 5, key: "threads", title: "点击切换线程排序" },
  ];
  sortableDefs.forEach((item) => {
    const head = headers[item.index];
    if (!head) return;
    head.dataset.sortKey = item.key;
    head.classList.add("sortable");
    head.title = item.title;
  });
}

function processSortHeader(label, key) {
  const mode = String(state.processSortMode || "cpu_desc");
  const [activeKey, activeDir] = mode.split("_");
  if (activeKey !== key) return label;
  if (activeDir === "desc") return `${label} ↓`;
  if (activeDir === "asc") return `${label} ↑`;
  return label;
}

function toggleProcessSort(key) {
  const mode = String(state.processSortMode || "cpu_desc");
  const [activeKey, activeDir] = mode.split("_");
  const nextDir = activeKey === key ? (activeDir === "desc" ? "asc" : "desc") : defaultSortDirection(key);
  state.processSortMode = `${key}_${nextDir}`;
  renderProcessTable();
}

function defaultSortDirection(key) {
  if (["cpu", "mem", "pid", "threads"].includes(key)) return "desc";
  return "asc";
}

function compareProcess(a, b, mode) {
  const [key, dir] = String(mode || "cpu_desc").split("_");
  const factor = dir === "asc" ? 1 : -1;

  const aName = String(a?.name || "");
  const bName = String(b?.name || "");
  const aType = a?.is_jvm ? "jvm" : "process";
  const bType = b?.is_jvm ? "jvm" : "process";

  let result = 0;
  switch (key) {
    case "name":
      result = aName.localeCompare(bName, "zh-Hans-CN", { sensitivity: "base", numeric: true });
      break;
    case "type":
      result = aType.localeCompare(bType, "en", { sensitivity: "base" });
      break;
    case "pid":
      result = Number(a?.pid || 0) - Number(b?.pid || 0);
      break;
    case "mem":
      result = Number(a?.memory || 0) - Number(b?.memory || 0);
      break;
    case "threads":
      result = Number(a?.threads || 0) - Number(b?.threads || 0);
      break;
    case "cpu":
    default:
      result = Number(a?.cpu || 0) - Number(b?.cpu || 0);
      break;
  }
  if (result !== 0) return result * factor;

  const cpuDiff = Number(b?.cpu || 0) - Number(a?.cpu || 0);
  if (cpuDiff !== 0) return cpuDiff;
  return Number(a?.pid || 0) - Number(b?.pid || 0);
}

function mergeProcessList(top, jvm) {
  const out = [];
  const seen = new Set();
  top.forEach((x) => {
    const row = normalizeProcessItem(x, !!x?.is_jvm);
    if (seen.has(row.pid)) return;
    out.push(row);
    seen.add(row.pid);
  });
  jvm.forEach((x) => {
    const row = normalizeProcessItem(x, true);
    if (seen.has(row.pid)) return;
    out.push(row);
    seen.add(row.pid);
  });
  return out;
}

function normalizeProcessItem(raw, forceJVM = false) {
  const row = raw && typeof raw === "object" ? raw : {};
  const pid = Number(row.pid || 0);
  const cpu = pickNumber(row.cpu, row.cpu_percent, row.cpuPercent);
  const memory = pickNumber(row.memory, row.memory_percent, row.mem_percent, row.mem, row.memoryRate);
  const threads = pickInteger(row.threads, row.thread_count, row.threadCount, row.num_threads);
  const name = String(row.name || "").trim();
  const exePath = String(row.exe_path || row.path || "").trim();
  const cmdline = String(row.cmdline || row.command || "").trim();
  return {
    ...row,
    pid,
    name: name || (pid > 0 ? `PID-${pid}` : "-"),
    cpu,
    memory,
    threads,
    exe_path: exePath || "-",
    cmdline,
    is_jvm: !!(forceJVM || row.is_jvm),
  };
}

function pickNumber(...values) {
  for (const raw of values) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickInteger(...values) {
  for (const raw of values) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

async function showProcessDetail(pid) {
  const res = await fetch(`/api/processes/${pid}/detail`);
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "获取进程详情失败", "error");
    return;
  }
  openModal("进程资源详情", renderProcessDetailHTML(data));
}

async function killProcess(pid) {
  const res = await fetch(`/api/processes/${pid}/kill`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "关闭进程失败", "error");
    return;
  }
  showAppToast(`已发送关闭指令，PID=${pid}`, "success");
  await refreshMonitor();
}

async function loadApps() {
  const res = await fetchWithTimeout("/api/logs/apps", 10000);
  const data = await res.json();
  if (!res.ok) return;
  state.apps = data.apps || [];
  state.logRules = data.rules || state.logRules;
  ensureCurrentLogCard(true);
}

function renderAppCards() {
  const box = document.getElementById("appCards");
  const keyword = (document.getElementById("logSearchApp").value || "").toLowerCase();
  const apps = state.apps.filter((x) => `${x.name || ""} ${x.description || ""}`.toLowerCase().includes(keyword));
  box.innerHTML = "";

  apps.forEach((app) => {
    const div = document.createElement("div");
    div.className = "app-card" + (state.currentApp?.name === app.name ? " active" : "");
    div.innerHTML = `
      <div class="app-card-top">
        <h4>${escapeHTML(app.name)}</h4>
        <button class="btn sm danger log-card-delete-btn" data-name="${escapeHTML(app.name)}">删除</button>
      </div>
      <p>${escapeHTML(localizeLogSourceType(app.type))}</p>
      <p>日志源: ${num(app.log_files?.length || 0)}</p>
      <p>${escapeHTML(app.description || "-")}</p>
    `;
    div.querySelector(".log-card-delete-btn")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteLogCard(app.name);
    });
    div.addEventListener("click", () => {
      state.currentApp = app;
      setText("logCurrentApp", `当前应用：${app.name}`);
      renderLogFileSelector();
      renderAppCards();
      queryLogs(false);
      syncLogRealtimeState("logs");
    });
    box.appendChild(div);
  });
}

function localizeLogSourceType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "windows-eventlog") return "Windows 事件日志";
  if (t === "system-log") return "系统日志";
  if (t === "app-log") return "应用日志";
  if (t === "custom-log") return "自定义日志";
  return t || "-";
}

function resolveDefaultLogCard() {
  if (!Array.isArray(state.apps) || !state.apps.length) return null;
  const system = state.apps.find((x) => {
    const name = String(x?.name || "").toLowerCase();
    const type = String(x?.type || "").toLowerCase();
    return name.includes("系统日志") || name.includes("system log") || type.includes("system") || type.includes("eventlog");
  });
  return system || state.apps[0] || null;
}

function ensureCurrentLogCard(triggerQuery = false) {
  if (!Array.isArray(state.apps) || !state.apps.length) {
    state.currentApp = null;
    stopLogRealtimeLoop();
    renderAppCards();
    setText("logCurrentApp", "当前应用：无");
    renderLogFileSelector();
    const result = document.getElementById("logResult");
    if (result) result.textContent = "";
    return;
  }

  const current = state.currentApp?.name;
  const matched = state.apps.find((x) => x.name === current);
  state.currentApp = matched || resolveDefaultLogCard();

  renderAppCards();
  if (state.currentApp) {
    setText("logCurrentApp", `当前应用：${state.currentApp.name}`);
    renderLogFileSelector();
    if (triggerQuery) queryLogs(false);
    syncLogRealtimeState();
  }
}

function openAddLogCardModal() {
  const html = `
    <div class="system-detail-grid">
      <section class="system-detail-block">
        <h4>新增日志卡片</h4>
        <div class="row">
          <input id="newLogName" class="input" placeholder="卡片名称，例如：系统日志 / nginx日志" />
          <select id="newLogType" class="input">
            <option value="custom-log">自定义日志文件</option>
            <option value="system-log">系统日志文件</option>
            <option value="windows-eventlog">Windows 事件日志</option>
          </select>
        </div>
        <div class="row">
          <input id="newLogDesc" class="input" placeholder="描述（可选）" />
        </div>
        <div class="row">
          <textarea id="newLogFiles" class="input" rows="5" style="width:100%;" placeholder="每行一个日志源。文件日志写绝对/相对路径；Windows 事件日志写频道名，如 System / Application / Security"></textarea>
        </div>
        <div class="row">
          <button id="saveNewLogCardBtn" class="btn">保存卡片</button>
        </div>
      </section>
    </div>
  `;
  openModal("添加日志卡片", html);
  const saveBtn = document.getElementById("saveNewLogCardBtn");
  if (!saveBtn) return;
  saveBtn.addEventListener("click", async () => {
    const name = (document.getElementById("newLogName")?.value || "").trim();
    const type = (document.getElementById("newLogType")?.value || "").trim() || "custom-log";
    const description = (document.getElementById("newLogDesc")?.value || "").trim();
    const filesRaw = (document.getElementById("newLogFiles")?.value || "").trim();
    const logFiles = filesRaw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    if (!name) {
      showAppToast("请填写卡片名称", "warning");
      return;
    }
    if (!logFiles.length) {
      showAppToast("请至少填写一个日志源", "warning");
      return;
    }
    await createLogCard({ name, type, description, log_files: logFiles });
  });
}

async function createLogCard(payload) {
  const res = await fetch("/api/logs/apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "新增日志卡片失败", "error");
    return;
  }
  closeModal();
  await loadApps();
  showAppToast("日志卡片新增成功", "success");
}

async function deleteLogCard(name) {
  const appName = String(name || "").trim();
  if (!appName) return;
  if (!confirm(`确认删除日志卡片「${appName}」？`)) return;
  const res = await fetch(`/api/logs/apps/${encodeURIComponent(appName)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "删除日志卡片失败", "error");
    return;
  }
  if (state.currentApp?.name === appName) {
    state.currentApp = null;
    stopLogRealtimeLoop();
  }
  await loadApps();
  showAppToast(`已删除日志卡片：${appName}`, "success");
}

function renderLogFileSelector() {
  const box = document.getElementById("logFileSelector");
  box.innerHTML = "";
  if (!state.currentApp) return;

  (state.currentApp.log_files || []).forEach((filePath, index) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.value = filePath;
    input.id = `lf_${index}`;
    label.appendChild(input);
    label.append(` ${filePath}`);
    box.appendChild(label);
  });
}

async function queryLogs(errorOnly, options = {}) {
  const silent = !!options.silent;
  const fromRealtime = !!options.fromRealtime;

  if (!state.currentApp) {
    if (!silent) showAppToast("请先选择应用", "warning");
    return;
  }

  const keyword = document.getElementById("logKeyword").value;
  const level = errorOnly ? "error" : document.getElementById("logLevel").value;
  const rule = document.getElementById("logRule").value;
  const limit = document.getElementById("logLimit").value || "300";
  const q = new URLSearchParams({ keyword, level, rule, limit });

  let data = null;
  try {
    const res = await fetchWithTimeout(`/api/logs/${encodeURIComponent(state.currentApp.name)}?${q.toString()}`, 10000);
    data = await res.json();
    if (!res.ok) {
      if (!silent) showAppToast(data.error || "日志查询失败", "error");
      return;
    }
  } catch (err) {
    if (!silent) showAppToast("日志查询失败", "error");
    console.error("query logs failed", err);
    return;
  }

  const items = Array.isArray(data?.items) ? [...data.items] : [];
  items.sort((a, b) => parseLogTimeValue(a?.time) - parseLogTimeValue(b?.time));
  const lines = items.map((x) => `[${x.time}] [${x.level}] [${x.file}] ${x.message}`);

  const box = document.getElementById("logResult");
  if (!box) return;
  box.textContent = lines.join("\n");
  if (fromRealtime || !silent) {
    box.scrollTop = box.scrollHeight;
  }
}

function parseLogTimeValue(raw) {
  const text = String(raw || "").trim();
  if (!text) return 0;
  const ts = Date.parse(text.replace(" ", "T"));
  if (Number.isFinite(ts)) return ts;
  return 0;
}

async function exportLogs() {
  if (!state.currentApp) {
    showAppToast("请先选择应用", "warning");
    return;
  }

  const checked = [...document.querySelectorAll("#logFileSelector input:checked")].map((x) => x.value);
  const res = await fetch(`/api/logs/${encodeURIComponent(state.currentApp.name)}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: checked }),
  });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "导出失败", "error");
    return;
  }
  showAppToast("日志导出任务已生成", "success");
  window.open(data.download_url, "_blank");
}

async function loadScripts() {
  const res = await fetchWithTimeout("/api/scripts", 10000);
  const data = await res.json();
  if (!res.ok) return;
  state.scripts = data.scripts || [];
  const select = document.getElementById("scriptName");
  select.innerHTML = "";
  state.scripts.forEach((s) => {
    const op = document.createElement("option");
    op.value = s.name;
    op.textContent = `${s.name} (${s.shell || "auto"})`;
    select.appendChild(op);
  });
  renderScriptLibrary();
}

function renderScriptLibrary() {
  const box = document.getElementById("scriptLibrary");
  if (!box) return;
  box.innerHTML = "";

  if (!state.scripts.length) {
    box.innerHTML = "<div class=\"script-item\"><div class=\"meta\">暂无脚本，请先上传。</div></div>";
    return;
  }

  state.scripts.forEach((s) => {
    const el = document.createElement("div");
    const params = Array.isArray(s.parameters) && s.parameters.length ? s.parameters.join(", ") : "-";
    el.className = "script-item";
    el.innerHTML = `
      <div class="title">${escapeHTML(s.name || "-")}</div>
      <div class="meta">执行器: ${escapeHTML(s.shell || "自动")} | 参数模板: ${escapeHTML(params)}</div>
      <div class="meta">${escapeHTML(s.description || "无描述")}</div>
      <div class="path">${escapeHTML(s.path || "-")}</div>
    `;
    box.appendChild(el);
  });
}

async function loadScriptRuns() {
  const res = await fetchWithTimeout("/api/scripts/runs?limit=100", 10000);
  const data = await res.json();
  if (!res.ok) return;
  const rows = (data.items || []).map((x) => [
    x.id,
    x.script_name,
    x.args || "-",
    `<span class="badge ${statusClass(x.status)}">${escapeHTML(localizeTaskStatus(x.status))}</span>`,
    x.started_at || "-",
    x.ended_at || "-",
  ]);
  renderTable("scriptRunHistory", ["ID", "脚本", "参数", "状态", "开始时间", "结束时间"], rows, true);
}

async function pollRunDetail() {
  if (!state.currentRunId) return;
  const output = document.getElementById("scriptOutput");
  let running = true;
  while (running) {
    const res = await fetch(`/api/scripts/runs/${state.currentRunId}`);
    const data = await res.json();
    if (res.ok) {
      output.textContent = data.output || "";
      output.scrollTop = output.scrollHeight;
      running = data.status === "running";
    } else {
      running = false;
    }
    await loadScriptRuns();
    if (running) await sleep(1500);
  }
}

async function loadBackups() {
  const res = await fetchWithTimeout("/api/backups", 10000);
  const data = await res.json();
  if (!res.ok) return;
  const rows = (data.items || []).map((x) => [
    x.id,
    x.type,
    x.name,
    `<span class="badge ${statusClass(x.status)}">${escapeHTML(localizeTaskStatus(x.status))}</span>`,
    x.path,
    x.message || "-",
    `<a href="/api/backups/download?path=${encodeURIComponent(x.path)}" target="_blank">下载</a>`,
  ]);
  renderTable("backupList", ["ID", "类型", "名称", "状态", "路径", "信息", "操作"], rows, true);
}

function setModalContent(title, html) {
  setText("modalTitle", title);
  const body = document.getElementById("modalBody");
  if (body) body.innerHTML = html;
}

function clearActiveTrendModalState() {
  state.activeTrendKey = "";
  state.activeTrendAutoFollow = true;
  state.activeTrendScrollLeft = 0;
}

function openModal(title, html, options = {}) {
  if (!options.keepTrend) clearActiveTrendModalState();
  setModalContent(title, html);
  document.getElementById("modalMask").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  clearActiveTrendModalState();
  document.getElementById("modalMask").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function renderTable(id, headers, rows, allowHTML = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = renderTableHTML(headers, rows, allowHTML);
}

function renderTableHTML(headers, rows, allowHTML = false) {
  const head = headers.map((x) => `<th>${escapeHTML(String(x))}</th>`).join("");
  const body = rows
    .map((row) => {
      const rowClass = Array.isArray(row) ? "" : escapeHTML(String(row?.rowClass || "").trim());
      const cells = Array.isArray(row) ? row : row?.cells || [];
      const cols = cells
        .map((col) => {
          if (allowHTML) return `<td>${col ?? ""}</td>`;
          return `<td>${escapeHTML(String(col ?? ""))}</td>`;
        })
        .join("");
      return rowClass ? `<tr class="${rowClass}">${cols}</tr>` : `<tr>${cols}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBar(id, percent) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = Number(percent || 0);
  const width = Math.max(0, Math.min(100, v));
  el.style.width = `${width}%`;
}

function resolvePressureLevel(percent) {
  const v = Number(percent || 0);
  if (v >= 85) return "tight";
  if (v >= 70) return "high";
  return "ok";
}

function pressureLevelText(level) {
  if (level === "tight") return "资源紧张";
  if (level === "high") return "负载偏高";
  return "";
}

function applyPressureStyle(metricType, percent) {
  const card = document.querySelector(`.metric-card.${metricType}`);
  if (!card) return;
  const level = resolvePressureLevel(percent);
  card.classList.remove("pressure-ok", "pressure-high", "pressure-tight");
  card.classList.add(`pressure-${level}`);

  const tag = card.querySelector(".kpi-tag");
  if (!tag) return;
  if (level === "tight") {
    tag.textContent = "资源紧张";
  } else if (level === "high") {
    tag.textContent = "负载偏高";
  } else {
    tag.textContent = "实时";
  }
}

function normalizedDiskIOSummary(data) {
  let readBytes = Number(data.disk_io?.read_bytes || 0);
  let writeBytes = Number(data.disk_io?.write_bytes || 0);
  let readCount = Number(data.disk_io?.read_count || 0);
  let writeCount = Number(data.disk_io?.write_count || 0);

  if (readBytes || writeBytes || readCount || writeCount) {
    return { readBytes, writeBytes, readCount, writeCount };
  }

  (data.disks || []).forEach((disk) => {
    readBytes += Number(disk.read_bytes || 0);
    writeBytes += Number(disk.write_bytes || 0);
    readCount += Number(disk.read_count || 0);
    writeCount += Number(disk.write_count || 0);
  });

  return { readBytes, writeBytes, readCount, writeCount };
}

function buildDiskKey(item) {
  const path = String(item?.path || "").trim().toLowerCase();
  const device = String(item?.device || "").trim().toLowerCase();
  const fs = String(item?.fs_type || "").trim().toLowerCase();
  return `${path}|${device}|${fs}`;
}

function calculateDiskRealtime(data, sampleTS = Date.now()) {
  const ts = parseTrendTimestamp(sampleTS, Date.now());
  const totals = normalizedDiskIOSummary(data);
  const disks = Array.isArray(data?.disks) ? data.disks : [];

  const prev = state.diskLastSample;
  let dt = 0;
  if (prev && Number(prev.ts || 0) > 0 && ts > Number(prev.ts || 0)) {
    dt = Math.max(0.001, (ts - Number(prev.ts || 0)) / 1000);
  }

  const currentByKey = {};
  const rateByKey = {};
  disks.forEach((item) => {
    const key = buildDiskKey(item);
    const current = {
      readBytes: Number(item.read_bytes || 0),
      writeBytes: Number(item.write_bytes || 0),
      readCount: Number(item.read_count || 0),
      writeCount: Number(item.write_count || 0),
    };
    currentByKey[key] = current;

    const prevItem = prev?.byKey?.[key];
    let readBytesRate = 0;
    let writeBytesRate = 0;
    let readOpsRate = 0;
    let writeOpsRate = 0;
    if (prevItem && dt > 0) {
      readBytesRate = Math.max(0, (current.readBytes - Number(prevItem.readBytes || 0)) / dt);
      writeBytesRate = Math.max(0, (current.writeBytes - Number(prevItem.writeBytes || 0)) / dt);
      readOpsRate = Math.max(0, (current.readCount - Number(prevItem.readCount || 0)) / dt);
      writeOpsRate = Math.max(0, (current.writeCount - Number(prevItem.writeCount || 0)) / dt);
    }
    rateByKey[key] = { readBytesRate, writeBytesRate, readOpsRate, writeOpsRate };
  });

  let readBytesRate = 0;
  let writeBytesRate = 0;
  let readOpsRate = 0;
  let writeOpsRate = 0;
  if (prev?.totals && dt > 0) {
    readBytesRate = Math.max(0, (totals.readBytes - Number(prev.totals.readBytes || 0)) / dt);
    writeBytesRate = Math.max(0, (totals.writeBytes - Number(prev.totals.writeBytes || 0)) / dt);
    readOpsRate = Math.max(0, (totals.readCount - Number(prev.totals.readCount || 0)) / dt);
    writeOpsRate = Math.max(0, (totals.writeCount - Number(prev.totals.writeCount || 0)) / dt);
  }

  const realtime = {
    ts,
    summary: { readBytesRate, writeBytesRate, readOpsRate, writeOpsRate },
    rateByKey,
  };

  state.diskLastSample = { ts, totals, byKey: currentByKey };
  state.lastDiskRealtime = realtime;
  return realtime;
}

function displayPortProcessName(item) {
  const name = String(item?.process_name || "").trim();
  if (name) return name;

  const exePath = String(item?.exe_path || "").trim();
  if (exePath) {
    const normalized = exePath.replaceAll("\\", "/");
    const base = normalized.split("/").pop() || "";
    const readable = base.replace(/\.(exe|bat|cmd|ps1|sh)$/i, "");
    if (readable) return readable;
  }

  const pid = Number(item?.pid || 0);
  if (pid <= 0) return "系统进程";
  return `PID-${pid}`;
}

function displayPortPath(item) {
  const path = String(item?.exe_path || "").trim();
  if (path) return path;
  const name = String(item?.process_name || "").trim();
  if (name) return `${name}（路径受限）`;
  const pid = Number(item?.pid || 0);
  if (pid <= 0) return "系统进程（路径受限）";
  return `PID-${pid}（路径受限）`;
}

function localizePortStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "未知";
  if (["listen", "listening"].includes(v)) return "监听中";
  if (["established"].includes(v)) return "已建立";
  if (["close_wait"].includes(v)) return "等待关闭";
  if (["time_wait"].includes(v)) return "等待回收";
  if (["syn_sent"].includes(v)) return "发起连接";
  if (["syn_recv"].includes(v)) return "接收连接";
  if (["fin_wait_1", "fin_wait_2", "closing", "last_ack", "close"].includes(v)) return "关闭中";
  return String(raw);
}

function renderSystemInfo(snapshot) {
  const box = document.getElementById("systemInfoQuick");
  if (!box) return;
  const data = snapshot || {};
  const info = data.os || {};
  const network = data.network || {};
  const disks = Array.isArray(data.disks) ? data.disks : [];
  const diskHardware = Array.isArray(data.disk_hardware) ? data.disk_hardware : [];
  const cpu = data.cpu || {};
  const memory = data.memory || {};

  const osName = String(info.os_type || info.platform || "-").trim() || "-";
  const osVersion = String(info.version || "-").trim() || "-";
  const osDisplay = `${osName}\n${osVersion}`;
  const architecture = String(cpu.architecture || "-").trim() || "-";
  const diskSerial = resolvePrimaryDiskSerial(diskHardware);
  const resource = resolveResourceSummary(cpu, memory, disks, diskHardware);
  const items = [
    {
      label: "操作系统",
      value: osDisplay,
      full: osDisplay,
      multiline: true,
    },
    {
      label: "系统架构",
      value: architecture,
      full: architecture,
    },
    {
      label: "网络IP",
      value: String(network.primary_ip || "-"),
      full: String(network.primary_ip || "-"),
    },
    {
      label: "硬盘序列号",
      value: shortId(diskSerial),
      full: diskSerial,
    },
    {
      label: "资源概览",
      value: resource,
      full: resource,
    },
  ];

  box.innerHTML = items
    .map((x) => {
      const valueClass = x.multiline ? "system-info-value multiline" : "system-info-value";
      const fullText = `${x.label}：${String(x.full || "-").replace(/\n/g, " / ")}`;
      return `
      <div
        class="system-info-item"
        role="button"
        tabindex="0"
        data-copy="${escapeHTML(x.full)}"
        data-full="${escapeHTML(fullText)}"
        title="${escapeHTML(fullText)}"
      >
        <span class="system-info-label">${escapeHTML(x.label)}</span>
        <span class="${valueClass}" title="${escapeHTML(x.full)}">${escapeHTML(x.value)}</span>
      </div>
    `;
    })
    .join("");
}

function resolvePrimaryDiskSerial(items) {
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const serial = String(item?.serial || "").trim();
    const normalized = serial.toLowerCase();
    if (!serial) continue;
    if (["-", "unknown", "none", "null", "(null)", "n/a"].includes(normalized)) continue;
    return serial;
  }
  return "-";
}

function resolveResourceSummary(cpu, memory, disks, diskHardware) {
  const parts = [];
  const core = Number(cpu?.core_count || 0);
  if (core > 0) {
    parts.push(`${num(core)}核心`);
  }

  const memoryGB = toRoundedGB(memory?.total || 0);
  if (memoryGB > 0) {
    parts.push(`${num(memoryGB)}GB内存`);
  }

  const totalStorageBytes = resolveTotalStorageBytes(disks, diskHardware);
  const storageGB = toRoundedGB(totalStorageBytes);
  if (storageGB > 0) {
    parts.push(`${num(storageGB)}GB存储`);
  }

  return parts.length ? parts.join(" ") : "-";
}

function resolveTotalStorageBytes(disks, diskHardware) {
  const hardwareList = Array.isArray(diskHardware) ? diskHardware : [];
  if (hardwareList.length) {
    const seen = new Set();
    let total = 0;
    for (const item of hardwareList) {
      const size = Number(item?.size || 0);
      if (!Number.isFinite(size) || size <= 0) continue;
      const key = `${String(item?.name || "").trim()}|${size}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total += size;
    }
    if (total > 0) return total;
  }

  const diskList = Array.isArray(disks) ? disks : [];
  const seen = new Set();
  let total = 0;
  for (const item of diskList) {
    const size = Number(item?.total || 0);
    if (!Number.isFinite(size) || size <= 0) continue;
    const key = `${String(item?.device || item?.path || "").trim()}|${size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total += size;
  }
  return total;
}

function toRoundedGB(bytesValue) {
  const n = Number(bytesValue || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n / 1024 / 1024 / 1024));
}

async function copySystemInfoCard(card) {
  const text = String(card?.dataset?.copy || "").trim();
  if (!text || text === "-") {
    showCopyToast("当前字段暂无可复制内容");
    return;
  }
  const ok = await copyText(text);
  if (ok) {
    showCopyToast(`已复制：${shorten(text, 36)}`);
    return;
  }
  showCopyToast("复制失败，请手动复制");
}

function openSystemInfoModal() {
  const snapshot = state.monitorSnapshot || {};
  openModal("系统信息详情", renderSystemDetailHTML(snapshot));
}

function renderSystemDetailHTML(snapshot) {
  const os = snapshot.os || {};
  const cpu = snapshot.cpu || {};
  const memory = snapshot.memory || {};
  const network = snapshot.network || {};
  const disks = Array.isArray(snapshot.disks) ? snapshot.disks : [];
  const diskHardware = Array.isArray(snapshot.disk_hardware) ? snapshot.disk_hardware : [];
  const gpuCards = Array.isArray(snapshot.gpu_cards) ? snapshot.gpu_cards : [];
  const networkCards = Array.isArray(snapshot.network_cards) ? snapshot.network_cards : [];
  const memoryModules = Array.isArray(memory.modules) ? memory.modules : [];

  const sections = [];

  const osRows = [
    ["主机名", os.hostname || "-"],
    ["操作系统类型", os.os_type || os.platform || "-"],
    ["系统版本", os.version || "-"],
    ["内核版本", os.kernel_version || "-"],
    ["设备 ID", os.device_id || "-"],
    ["产品 ID", os.product_id || "-"],
    ["平台/架构", os.platform || "-"],
    ["运行时长", formatDuration(os.uptime)],
    ["负载(1分钟)", formatLoad(os.load1)],
    ["负载(5分钟)", formatLoad(os.load5)],
    ["负载(15分钟)", formatLoad(os.load15)],
  ];
  sections.push(renderSystemDetailSection("系统与运行信息", renderTableHTML(["字段", "值"], osRows)));

  const cpuRows = [
    ["CPU 型号", cpu.model || "-"],
    ["CPU 架构", cpu.architecture || "-"],
    ["核心数", num(cpu.core_count)],
    ["主频", `${fixed(cpu.frequency_mhz)} MHz`],
    ["当前使用率", `${fixed(cpu.usage_percent)}%`],
  ];
  sections.push(renderSystemDetailSection("CPU 信息", renderTableHTML(["字段", "值"], cpuRows)));

  const memoryRows = [
    ["总内存", bytes(memory.total)],
    ["已用内存", bytes(memory.used)],
    ["内存使用率", `${fixed(memory.used_percent)}%`],
    ["交换分区总量", bytes(memory.swap_total)],
    ["交换分区已用", bytes(memory.swap_used)],
    ["交换分区使用率", `${fixed(memory.swap_used_rate)}%`],
  ];
  sections.push(renderSystemDetailSection("内存信息", renderTableHTML(["字段", "值"], memoryRows)));

  if (memoryModules.length) {
    const rows = memoryModules.map((x, idx) => [
      idx + 1,
      x.manufacturer || "-",
      x.model || "-",
      Number(x.frequency_mhz || 0) > 0 ? `${num(x.frequency_mhz)} MHz` : "-",
      bytes(x.capacity || 0),
      x.serial || "-",
    ]);
    sections.push(
      renderSystemDetailSection("内存条明细", renderTableHTML(["序号", "品牌", "型号", "频率", "容量", "序列号"], rows)),
    );
  }

  const networkRows = [
    ["当前活跃网卡", network.primary_nic || "-"],
    ["当前 IP", network.primary_ip || "-"],
    ["当前 MAC", network.primary_mac || "-"],
    ["当前连接数", num(network.connection_count || 0)],
    ["累计入流量", bytes(network.bytes_recv || 0)],
    ["累计出流量", bytes(network.bytes_sent || 0)],
    ["累计入包数", num(network.packets_in || 0)],
    ["累计出包数", num(network.packets_out || 0)],
  ];
  sections.push(renderSystemDetailSection("网络信息", renderTableHTML(["字段", "值"], networkRows)));

  if (networkCards.length) {
    const rows = networkCards.map((x, idx) => [
      idx + 1,
      x.name || "-",
      x.description || "-",
      x.mac_address || "-",
      Number(x.speed_mbps || 0) > 0 ? `${num(x.speed_mbps)} Mbps` : "-",
      x.adapter_type || "-",
      x.status || "-",
    ]);
    sections.push(
      renderSystemDetailSection("网卡明细", renderTableHTML(["序号", "名称", "描述", "MAC", "速率", "类型", "状态"], rows)),
    );
  }

  if (disks.length) {
    const rows = disks.map((x) => [
      x.path || "-",
      x.device || "-",
      x.fs_type || "-",
      `${fixed(x.used_percent)}%`,
      `${bytes(x.used)} / ${bytes(x.total)}`,
    ]);
    sections.push(renderSystemDetailSection("磁盘分区状态", renderTableHTML(["挂载点", "设备", "文件系统", "使用率", "容量"], rows)));
  }

  if (diskHardware.length) {
    const rows = diskHardware.map((x, idx) => [
      idx + 1,
      x.name || "-",
      x.model || "-",
      x.serial || "-",
      x.interface || "-",
      x.media_type || "-",
      bytes(x.size || 0),
    ]);
    sections.push(
      renderSystemDetailSection("磁盘硬件信息", renderTableHTML(["序号", "设备", "型号", "序列号", "接口", "介质", "容量"], rows)),
    );
  }

  if (gpuCards.length) {
    const rows = gpuCards.map((x, idx) => [
      idx + 1,
      x.name || "-",
      x.vendor || "-",
      Number(x.memory_mb || 0) > 0 ? `${num(x.memory_mb)} MB` : "-",
      x.driver_version || "-",
      x.device_id || "-",
    ]);
    sections.push(
      renderSystemDetailSection("显卡信息", renderTableHTML(["序号", "名称", "厂商", "显存", "驱动版本", "设备 ID"], rows)),
    );
  } else {
    sections.push(renderSystemDetailSection("显卡信息", `<div class="trend-empty">暂未获取到显卡信息</div>`));
  }

  return `<div class="system-detail-grid">${sections.join("")}</div>`;
}

function renderSystemDetailSection(title, content) {
  return `
    <section class="system-detail-block">
      <h4>${escapeHTML(title)}</h4>
      ${content}
    </section>
  `;
}

function shortId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "-";
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatLoad(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "-";
  return fixed(n);
}

function openDiskMetaModal() {
  const data = state.monitorSnapshot || {};
  const items = data.disk_hardware || [];
  if (!items.length) {
    openModal("磁盘硬件汇总", `<div class="trend-empty">暂未获取到磁盘硬件信息</div>`);
    return;
  }
  const rows = items.map((x, idx) => [
    idx + 1,
    x.name || "-",
    x.model || "-",
    x.serial || "-",
    x.interface || "-",
    x.media_type || "-",
    bytes(x.size || 0),
  ]);
  openModal("磁盘硬件汇总", renderTableHTML(["序号", "设备", "型号", "序列号", "接口", "介质", "容量"], rows));
}

function summarizeMemoryModules(modules) {
  const list = Array.isArray(modules) ? modules : [];
  if (!list.length) return "内存条信息未获取";
  const first = list[0] || {};
  const brand = shorten(String(first.manufacturer || "").trim() || "品牌未知", 14);
  const model = shorten(String(first.model || "").trim() || "型号未知", 22);
  const freq = Number(first.frequency_mhz || 0) > 0 ? `${num(first.frequency_mhz)}MHz` : "频率未知";
  if (list.length === 1) return `${brand} ${model} ${freq}`;
  return `${brand} ${model} ${freq} 等 ${list.length} 条`;
}

function summarizeDiskHardware(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "硬件信息未获取";
  const first = list[0] || {};
  const model = String(first.model || "").trim() || String(first.name || "").trim() || "型号未知";
  const serial = String(first.serial || "").trim() || "序列号未知";
  if (list.length === 1) return `${shorten(model, 26)} | 序列号 ${shorten(serial, 20)}`;
  return `${shorten(model, 22)} 等 ${list.length} 块`;
}

function summarizeDiskHardwareDetail(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "硬件信息未获取";
  const parts = list.slice(0, 2).map((x) => {
    const model = String(x.model || x.name || "型号未知").trim();
    const serial = String(x.serial || "序列号未知").trim();
    return `${shorten(model, 20)} / ${shorten(serial, 16)}`;
  });
  const suffix = list.length > 2 ? ` 等 ${list.length} 块` : "";
  return `磁盘硬件 ${parts.join("；")}${suffix}`;
}

function renderProcessDetailHTML(data) {
  const statusText = localizeProcessRuntimeStatus(data.status);
  const statusCls = processRuntimeStatusClass(data.status);
  const ioTotal = Number(data.read_bytes || 0) + Number(data.write_bytes || 0);
  const created = formatProcessCreatedAt(data.created_at);
  return `
    <div class="process-detail-wrap">
      <div class="process-detail-kpi-grid">
        <div class="process-kpi-card cpu">
          <div class="kpi-title">CPU 占用</div>
          <div class="kpi-value">${fixed(data.cpu_percent)}%</div>
        </div>
        <div class="process-kpi-card mem">
          <div class="kpi-title">内存占用</div>
          <div class="kpi-value">${fixed(data.memory_percent)}%</div>
        </div>
        <div class="process-kpi-card thread">
          <div class="kpi-title">线程数</div>
          <div class="kpi-value">${num(data.threads)}</div>
        </div>
        <div class="process-kpi-card io">
          <div class="kpi-title">IO 总量</div>
          <div class="kpi-value">${bytes(ioTotal)}</div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">基础信息</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">PID</span>
            <span class="process-kv-value">${num(data.pid)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">进程名</span>
            <span class="process-kv-value">${escapeHTML(data.name || "-")}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">运行状态</span>
            <span class="process-kv-value"><span class="process-status-badge ${statusCls}">${statusText}</span></span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">启动时间</span>
            <span class="process-kv-value">${escapeHTML(created)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">内存详情</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">常驻内存 RSS</span>
            <span class="process-kv-value">${bytes(data.rss)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">虚拟内存 VMS</span>
            <span class="process-kv-value">${bytes(data.vms)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">IO 详情</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">读取字节</span>
            <span class="process-kv-value">${bytes(data.read_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">写入字节</span>
            <span class="process-kv-value">${bytes(data.write_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">读取次数</span>
            <span class="process-kv-value">${num(data.read_count)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">写入次数</span>
            <span class="process-kv-value">${num(data.write_count)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">执行路径</div>
        <div class="process-code-block">${escapeHTML(data.exe_path || "-")}</div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">启动命令</div>
        <div class="process-code-block">${escapeHTML(data.cmdline || "-")}</div>
      </div>
    </div>
  `;
}

function processRuntimeStatusClass(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (["running", "run", "r"].includes(v)) return "running";
  if (["sleep", "sleeping", "idle", "wait", "wchan", "disk-sleep", "iowait"].includes(v)) return "waiting";
  if (["stopped", "stop", "t", "dead", "zombie", "z"].includes(v)) return "stopped";
  return "unknown";
}

function localizeProcessRuntimeStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (["running", "run", "r"].includes(v)) return "运行中";
  if (["sleep", "sleeping", "idle", "wait", "wchan", "disk-sleep", "iowait"].includes(v)) return "等待中";
  if (["stopped", "stop", "t"].includes(v)) return "已停止";
  if (["dead"].includes(v)) return "已结束";
  if (["zombie", "z"].includes(v)) return "僵尸进程";
  if (!v) return "未知";
  return `未知(${escapeHTML(String(raw))})`;
}

function formatProcessCreatedAt(raw) {
  const text = String(raw || "").trim();
  if (!text) return "-";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function diskUsageClass(usage) {
  const v = Number.isFinite(usage) ? usage : 0;
  if (v >= 90) return "disk-high";
  if (v >= 75) return "disk-warn";
  return "disk-ok";
}

function diskUsageText(usage) {
  const cls = diskUsageClass(usage);
  if (cls === "disk-high") return "高占用";
  if (cls === "disk-warn") return "需关注";
  return "健康";
}

function localizeServiceType(raw) {
  const v = String(raw || "").trim().toLowerCase();
  const m = {
    application: "应用",
    database: "数据库",
    middleware: "中间件",
    snmp: "SNMP",
    nmap: "Nmap 扫描",
    http: "HTTP",
    port: "端口",
  };
  return m[v] || (raw || "-");
}

function localizeServiceStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (["up", "running", "active", "healthy", "ok", "success", "listen", "listening"].includes(v)) return "正常";
  return "未启动";
}

function localizeServiceDetail(raw) {
  let s = String(raw || "").trim();
  if (!s) return "-";
  const rules = [
    [/process not found/gi, "未找到进程"],
    [/host up,\s*no open port/gi, "主机在线，无开放端口"],
    [/host not found in nmap result/gi, "nmap 结果中未发现主机"],
    [/no response/gi, "无响应"],
    [/nmap unavailable/gi, "nmap 不可用"],
    [/open ports/gi, "开放端口"],
    [/open[_\s-]?ports/gi, "开放端口"],
    [/connection refused/gi, "连接被拒绝"],
    [/no such host/gi, "主机不存在"],
    [/i\/o timeout/gi, "I/O 超时"],
    [/timed out/gi, "连接超时"],
    [/dial tcp/gi, "TCP 连接"],
    [/connectex/gi, "连接异常"],
    [/host is down/gi, "主机离线"],
    [/timeout/gi, "超时"],
    [/unknown/gi, "未知"],
    [/latency=/gi, "延迟="],
    [/addr=/gi, "地址="],
  ];
  rules.forEach(([pattern, to]) => {
    s = s.replace(pattern, to);
  });
  return s;
}

function localizeTaskStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "未知";
  if (["running", "run", "processing"].includes(v)) return "执行中";
  if (["success", "ok", "completed", "done", "finished", "up"].includes(v)) return "成功";
  if (["failed", "error", "down"].includes(v)) return "失败";
  if (["pending", "queued", "waiting"].includes(v)) return "等待中";
  if (["canceled", "cancelled"].includes(v)) return "已取消";
  if (["stopped", "stop"].includes(v)) return "已停止";
  if (["unknown"].includes(v)) return "未知";
  return String(raw || "未知");
}

function statusClass(raw) {
  const v = String(raw || "").toLowerCase();
  if (["up", "running", "active", "healthy", "ok", "success"].includes(v)) return "up";
  if (["down", "failed", "error", "inactive", "stopped"].includes(v)) return "down";
  return "unknown";
}

function formatDuration(seconds) {
  const n = Number(seconds || 0);
  if (n <= 0) return "-";
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function bytes(v) {
  const n = Number(v || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  return `${(n / 1024 ** 4).toFixed(1)} TB`;
}

function rateBytes(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return "0.00 B";
  if (n < 1024) return `${n.toFixed(2)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

function num(v) {
  return Number(v || 0).toLocaleString();
}

function fixed(v) {
  return Number(v || 0).toFixed(1);
}

function shorten(raw, max) {
  const text = String(raw || "").trim();
  const limit = Number(max || 0);
  if (limit <= 0 || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (err) {
    console.error("clipboard write failed", err);
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch (err) {
    console.error("fallback copy failed", err);
    return false;
  }
}

function showCopyToast(message) {
  let toast = document.getElementById("copyToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "copyToast";
    toast.className = "copy-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = String(message || "");
  toast.classList.add("show");

  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1600);
}

function showAppToast(message, level = "info", duration = 2200) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }

  const lv = String(level || "info").toLowerCase();
  toast.className = `app-toast ${lv}`;
  toast.textContent = String(message || "");
  toast.classList.add("show");

  if (appToastTimer) clearTimeout(appToastTimer);
  appToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, Math.max(1200, Number(duration || 2200)));
}

async function fetchWithTimeout(url, timeoutMS, options = {}) {
  const controller = new AbortController();
  const timeout = Number(timeoutMS || 0);
  const timer = setTimeout(() => controller.abort(), timeout > 0 ? timeout : 12000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout(promise, ms, reason) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason || "timeout")), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function escapeHTML(raw) {
  return String(raw)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


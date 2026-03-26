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
  diskLastSample: null,
  lastDiskRealtime: null,
  scripts: [],
  apps: [],
  logRules: [],
  currentApp: null,
  currentRunId: null,
};

const bootState = {
  total: 7,
  done: 0,
};

const TREND_KEEP_MS = 24 * 60 * 60 * 1000;
const TREND_MINI_MS = 60 * 60 * 1000;
const TREND_MAX_RENDER_POINTS = 2400;
const TREND_DETAIL_MIN_WIDTH = 980;
const TREND_DETAIL_POINT_PX = 1.8;
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
  bindMenu();
  switchSection("monitor");
  bindMonitorActions();
  bindLogActions();
  bindRepairActions();
  bindBackupActions();
  bindModal();
  bootstrap();
});

async function bootstrap() {
  await runBootStep("加载配置", loadConfig);
  await runBootStep("采集监控数据", refreshMonitor);
  await runBootStep("加载趋势历史", loadTrendHistory);
  await runBootStep("加载应用和日志规则", loadApps);
  await runBootStep("加载脚本定义", loadScripts);
  await runBootStep("加载脚本执行历史", loadScriptRuns);
  await runBootStep("加载备份记录", loadBackups);
  startMonitorLoop();
  finishBoot();
}

async function runBootStep(text, fn) {
  updateBoot(`${text}...`, Math.floor((bootState.done / bootState.total) * 100));
  try {
    await withTimeout(fn(), 15000, `${text}超时`);
  } catch (err) {
    console.error(`初始化步骤失败: ${text}`, err);
  } finally {
    bootState.done += 1;
    const percent = Math.floor((bootState.done / bootState.total) * 100);
    updateBoot(`${text}完成`, percent);
  }
}

function updateBoot(text, percent) {
  const txt = document.getElementById("bootText");
  const p = document.getElementById("bootPercent");
  const bar = document.getElementById("bootBar");
  if (txt) txt.textContent = text;
  if (p) p.textContent = `${percent}%`;
  if (bar) bar.style.width = `${percent}%`;
}

function finishBoot() {
  updateBoot("初始化完成", 100);
  setTimeout(() => {
    document.body.classList.remove("booting");
    const overlay = document.getElementById("bootOverlay");
    if (overlay) overlay.style.display = "none";
  }, 220);
}

function bindMenu() {
  const buttons = document.querySelectorAll(".menu");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
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
}

function bindMonitorActions() {
  normalizeLegacyTrendButtons();

  document.getElementById("monitorRefreshBtn").addEventListener("click", downloadRealtimeStatusTxt);

  document.getElementById("monitorToggleBtn").addEventListener("click", () => {
    state.monitorPaused = !state.monitorPaused;
    const btn = document.getElementById("monitorToggleBtn");
    btn.textContent = state.monitorPaused ? "恢复监控" : "停止监控";
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

  document.getElementById("processSearch").addEventListener("input", renderProcessTable);

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
    alert("当前暂无可下载的监控数据");
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
      `系统 ${compact(data.os?.platform)}`,
      `版本 ${compact(data.os?.version)}`,
      `运行时长 ${formatDuration(data.os?.uptime)}`,
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
      `磁盘IO实时读 ${bytes(summaryRate.readBytesRate)}/秒(${fixed(summaryRate.readOpsRate)}次/秒)`,
      `写 ${bytes(summaryRate.writeBytesRate)}/秒(${fixed(summaryRate.writeOpsRate)}次/秒)`,
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
      `${compact(x.path)} | ${compact(x.device)} | ${fixed(x.used_percent)}% | ${bytes(x.used)}/${bytes(x.total)} | 读 ${bytes(rate.readBytesRate)}/秒(${fixed(rate.readOpsRate)}次/秒) 写 ${bytes(rate.writeBytesRate)}/秒(${fixed(rate.writeOpsRate)}次/秒)`,
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
}

function bindRepairActions() {
  document.getElementById("uploadScriptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const res = await fetch("/api/scripts/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "上传失败");
      return;
    }
    event.target.reset();
    await loadScripts();
  });

  document.getElementById("runScriptBtn").addEventListener("click", async () => {
    const name = document.getElementById("scriptName").value;
    const args = document.getElementById("scriptArgs").value;
    if (!name) {
      alert("请选择脚本");
      return;
    }

    const res = await fetch("/api/scripts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, args }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "执行失败");
      return;
    }
    state.currentRunId = data.run_id;
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
      alert(data.error || "备份失败");
      return;
    }
    await loadBackups();
  });
}

function bindModal() {
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  document.getElementById("modalMask").addEventListener("click", (event) => {
    if (event.target.id === "modalMask") closeModal();
  });
}

async function loadConfig() {
  const res = await fetch("/api/config");
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
  const res = await fetch("/api/monitor/trends?hours=24");
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
    if (!state.monitorPaused) refreshMonitor();
  }, sec * 1000);
}

async function refreshMonitor() {
  const res = await fetch("/api/monitor");
  const data = await res.json();
  if (!res.ok) return;
  state.monitorSnapshot = data;
  state.combinedProcesses = mergeProcessList(data.top_processes || [], data.jvm || []);
  renderMonitor(data);
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
    `当前 IP ${data.network?.primary_ip || "-"} (${data.network?.primary_nic || "-"}) | 实时总吞吐 ${bytes(rates.netRate)}/秒`,
  );

  setText("processCount", `${num(data.process_count)}`);
  setText("osInfo", `${data.os?.hostname || "-"} / ${data.os?.platform || "-"} / 运行时长 ${formatDuration(data.os?.uptime)}`);

  const diskIoFlowEl = document.getElementById("diskIoFlow");
  if (diskIoFlowEl) {
    diskIoFlowEl.innerHTML = `读 ${bytes(summaryRate.readBytesRate)}/秒<br/>写 ${bytes(summaryRate.writeBytesRate)}/秒`;
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
          `${bytes(rate.readBytesRate)}/秒`,
          `${bytes(rate.writeBytesRate)}/秒`,
          `${fixed(rate.readOpsRate)}次/秒`,
          `${fixed(rate.writeOpsRate)}次/秒`,
        ],
      };
    }),
    true,
  );

  renderTable(
    "portList",
    ["进程名", "端口", "PID", "状态", "路径"],
    (data.ports || []).slice(0, 10).map((x) => [
      displayPortProcessName(x),
      x.port,
      x.pid,
      localizePortStatus(x.status),
      displayPortPath(x),
    ]),
  );

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
    const first = points[0].value;
    const highest = Math.max(...points.map((p) => Number(p.value || 0)));
    const highestDelta = highest - first;
    const sign = highestDelta >= 0 ? "+" : "";
    info.textContent = `最新 ${cfg.format(latest)} | 最高 ${sign}${cfg.format(highestDelta)}`;
  });
}

function openTrendModal(key) {
  const cfg = TREND_SERIES[key];
  if (!cfg) return;
  const points = selectTrendWindow(state.trendHistory[key] || [], TREND_KEEP_MS);
  if (!points.length) {
    openModal(cfg.title, `<div class="trend-empty">暂无趋势数据</div>`);
    return;
  }
  const renderPoints = downsampleTrendPoints(points, TREND_MAX_RENDER_POINTS);
  const chartWidth = Math.max(TREND_DETAIL_MIN_WIDTH, Math.round(renderPoints.length * TREND_DETAIL_POINT_PX));

  const latest = points[points.length - 1].value;
  const oldest = points[0].value;
  const html = `
    <div class="trend-modal-wrap">
      <div class="trend-modal-meta">近24小时采样点 ${points.length}，最新值 ${escapeHTML(cfg.format(latest))}，起点 ${escapeHTML(cfg.format(oldest))}</div>
      <div class="trend-modal-chart">
        <div class="trend-modal-scroll">
          <div class="trend-modal-canvas" style="width:${chartWidth}px">
            ${renderTrendSVG(renderPoints, { width: chartWidth, height: 300, stroke: cfg.color, fill: cfg.fill, showTimeAxis: true })}
          </div>
        </div>
      </div>
    </div>
  `;
  openModal(cfg.title, html);
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

  chart.addEventListener("mouseenter", (e) => onMove(e.clientX));
  chart.addEventListener("mousemove", (e) => onMove(e.clientX));
  chart.addEventListener("mouseleave", hide);
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
    ["进程", "类型", "PID", processSortHeader("CPU%", "cpu"), processSortHeader("内存%", "mem"), "线程", "路径", "操作"],
    rows,
    true,
  );
  bindTopProcessSortHeaders();
}

function bindTopProcessSortHeaders() {
  const table = document.querySelector("#topProcessList table");
  if (!table) return;
  const headers = table.querySelectorAll("thead th");
  if (headers.length < 5) return;
  const cpu = headers[3];
  const mem = headers[4];
  if (cpu) {
    cpu.dataset.sortKey = "cpu";
    cpu.classList.add("sortable");
    cpu.title = "点击切换 CPU 排序";
  }
  if (mem) {
    mem.dataset.sortKey = "mem";
    mem.classList.add("sortable");
    mem.title = "点击切换内存排序";
  }
}

function processSortHeader(label, key) {
  const mode = state.processSortMode || "cpu_desc";
  if (key === "cpu") {
    if (mode === "cpu_desc") return `${label} ↓`;
    if (mode === "cpu_asc") return `${label} ↑`;
    return label;
  }
  if (key === "mem") {
    if (mode === "mem_desc") return `${label} ↓`;
    if (mode === "mem_asc") return `${label} ↑`;
    return label;
  }
  return label;
}

function toggleProcessSort(key) {
  const mode = state.processSortMode || "cpu_desc";
  if (key === "cpu") {
    state.processSortMode = mode === "cpu_desc" ? "cpu_asc" : "cpu_desc";
    renderProcessTable();
    return;
  }
  if (key === "mem") {
    state.processSortMode = mode === "mem_desc" ? "mem_asc" : "mem_desc";
    renderProcessTable();
  }
}

function compareProcess(a, b, mode) {
  switch (mode) {
    case "cpu_asc":
      return Number(a.cpu || 0) - Number(b.cpu || 0);
    case "mem_desc":
      return Number(b.memory || 0) - Number(a.memory || 0);
    case "mem_asc":
      return Number(a.memory || 0) - Number(b.memory || 0);
    case "cpu_desc":
    default:
      return Number(b.cpu || 0) - Number(a.cpu || 0);
  }
}

function mergeProcessList(top, jvm) {
  const out = [];
  const seen = new Set();
  top.forEach((x) => {
    out.push({ ...x, is_jvm: !!x.is_jvm });
    seen.add(x.pid);
  });
  jvm.forEach((x) => {
    if (seen.has(x.pid)) return;
    out.push({ ...x, is_jvm: true });
    seen.add(x.pid);
  });
  return out;
}

async function showProcessDetail(pid) {
  const res = await fetch(`/api/processes/${pid}/detail`);
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "获取进程详情失败");
    return;
  }
  openModal("进程资源详情", renderProcessDetailHTML(data));
}

async function killProcess(pid) {
  const res = await fetch(`/api/processes/${pid}/kill`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "关闭进程失败");
    return;
  }
  alert(`已发送关闭指令，PID=${pid}`);
  await refreshMonitor();
}

async function loadApps() {
  const res = await fetch("/api/logs/apps");
  const data = await res.json();
  if (!res.ok) return;
  state.apps = data.apps || [];
  state.logRules = data.rules || state.logRules;
  renderAppCards();
}

function renderAppCards() {
  const box = document.getElementById("appCards");
  const keyword = (document.getElementById("logSearchApp").value || "").toLowerCase();
  const apps = state.apps.filter((x) => x.name.toLowerCase().includes(keyword));
  box.innerHTML = "";

  apps.forEach((app) => {
    const div = document.createElement("div");
    div.className = "app-card" + (state.currentApp?.name === app.name ? " active" : "");
    div.innerHTML = `<h4>${escapeHTML(app.name)}</h4><p>${escapeHTML(app.type)}</p><p>日志文件: ${num(app.log_files.length)}</p>`;
    div.addEventListener("click", () => {
      state.currentApp = app;
      setText("logCurrentApp", `当前应用：${app.name}`);
      renderLogFileSelector();
      renderAppCards();
      queryLogs(false);
    });
    box.appendChild(div);
  });
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

async function queryLogs(errorOnly) {
  if (!state.currentApp) {
    alert("请先选择应用");
    return;
  }

  const keyword = document.getElementById("logKeyword").value;
  const level = errorOnly ? "error" : document.getElementById("logLevel").value;
  const rule = document.getElementById("logRule").value;
  const limit = document.getElementById("logLimit").value || "300";
  const q = new URLSearchParams({ keyword, level, rule, limit });

  const res = await fetch(`/api/logs/${encodeURIComponent(state.currentApp.name)}?${q.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "日志查询失败");
    return;
  }

  const lines = (data.items || []).map((x) => `[${x.time}] [${x.level}] [${x.file}] ${x.message}`);
  document.getElementById("logResult").textContent = lines.join("\n");
}

async function exportLogs() {
  if (!state.currentApp) {
    alert("请先选择应用");
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
    alert(data.error || "导出失败");
    return;
  }
  window.open(data.download_url, "_blank");
}

async function loadScripts() {
  const res = await fetch("/api/scripts");
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
  const res = await fetch("/api/scripts/runs?limit=100");
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
  const res = await fetch("/api/backups");
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

function openModal(title, html) {
  setText("modalTitle", title);
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalMask").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
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
  if (["down", "failed", "error", "inactive", "stopped", "dead", "unreachable"].includes(v)) return "异常";
  if (["unknown", ""].includes(v)) return "未知";
  return raw || "未知";
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


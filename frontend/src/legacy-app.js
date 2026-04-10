import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

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
  scriptRuns: [],
  backups: [],
  trafficSnapshot: null,
  trafficPollTimer: null,
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
  cleanupScanJobId: "",
  cleanupScanPollTimer: null,
  cleanupScanProgress: null,
  cleanupScanAbortController: null,
  cleanupGarbageAbortController: null,
  cleanupFilteredFiles: [],
  cleanupFilteredLargeFiles: [],
  cleanupCustomRoots: [],
  dockerStatus: null,
  dockerContainers: [],
  dockerImages: [],
  dockerTab: "containers",
  dockerSelectedContainerIDs: [],
  dockerSelectedImageIDs: [],
  dockerPage: 1,
  dockerPageSize: 20,
  dockerTotal: 0,
  dockerTotalPages: 0,
  dockerLogTimer: null,
  dockerLogContainerID: "",
  dockerLogContainerName: "",
  remoteMeta: null,
  remoteConnected: false,
  remoteAutoConnectTried: false,
  systemRuntimeLogs: [],
  fsTreeCache: {},
  fsModalMode: "",
  fsModalSelected: [],
  backupSelectedSources: [],
  cicdPipelines: [],
  cicdRuns: [],
  cicdCurrentRunId: 0,
  cicdRunTimer: null,
  flowMonitorItems: [],
  flowMonitorRawItems: [],
  flowMonitorStatus: null,
  flowMonitorLastLoadedAt: 0,
  flowMonitorUpdatedAt: 0,
  flowMonitorLoading: false,
  flowMonitorKeyword: "",
  flowMonitorProtocol: "all",
  flowMonitorStatusFilter: "all",
  flowMonitorSort: "time_desc",
  managedApps: [],
  appManagerFilterKeyword: "",
  appManagerFilterStatus: "all",
  appManagerFilterEnabled: "all",
  appManagerSelectedName: "",
  appManagerDetail: null,
  appManagerDetailLoading: false,
  sshConnected: false,
  sshConnecting: false,
  authAuthenticated: false,
};

const bootState = {
  total: 12,
  done: 0,
};

let bootFinished = false;
let bootRunning = false;
let bootFallbackTimer = null;
let copyToastTimer = null;
let appToastTimer = null;
let dockerSearchDebounceTimer = null;
let runtimeLogDebounceTimer = null;
let fsModalConfirmHandler = null;
let fsModalMulti = false;
let fsModalAllowCreate = false;
let fsModalTitle = "";
let fsModalExpanded = new Set();
let fsModalRoots = [];
let remoteWS = null;
let remoteResizeObserver = null;
let remoteManualClose = false;
let remoteReconnectTimer = null;
let remoteReconnectAttempt = 0;
let remoteCanvas = null;
let remoteCtx = null;
let remoteInputBound = false;
let remoteLastMoveSentAt = 0;
let remoteMouseDown = false;
let remoteLastPointerX = 0;
let remoteLastPointerY = 0;
let activeModalClass = "";
let sshWS = null;
let sshFitAddon = null;
let sshTerminal = null;
let sshResizeObserver = null;
let sshTerminalInitialized = false;
let sshManualClose = false;

const TREND_KEEP_MS = 24 * 60 * 60 * 1000;
const TREND_MINI_HOURS = 4;
const TREND_MINI_MS = TREND_MINI_HOURS * 60 * 60 * 1000;
const TREND_MAX_RENDER_POINTS = 2400;
const TREND_DETAIL_MIN_WIDTH = 980;
const TREND_DETAIL_POINT_PX = 1.8;
const MONITOR_WS_RETRY_BASE_MS = 1200;
const MONITOR_WS_RETRY_MAX_MS = 15000;
const FLOW_MONITOR_REFRESH_MS = 15000;
const FLOW_MONITOR_MAX_ROWS = 100;
const REMOTE_WS_RETRY_BASE_MS = 1000;
const REMOTE_WS_RETRY_MAX_MS = 10000;
const SSH_WS_CONNECT_TIMEOUT_MS = 15000;
let domBootstrapped = false;
const TREND_SERIES = {
  cpu: {
    title: "CPU 濞达綀娉曢弫銈囨惥鐎ｎ亜鈼?,
    miniId: "trendMiniCpu",
    infoId: "trendInfoCpu",
    color: "#0f5fd8",
    fill: "rgba(15,95,216,0.18)",
    format: (v) => `${fixed(v)}%`,
  },
  memory: {
    title: "闁告劕鎳庨悺銊︽媴鐠恒劍鏆忛悺鎺戭儏婵?,
    miniId: "trendMiniMemory",
    infoId: "trendInfoMemory",
    color: "#1a9b75",
    fill: "rgba(26,155,117,0.18)",
    format: (v) => `${fixed(v)}%`,
  },
  network: {
    title: "缂傚啯鍨圭划鍫曞触閻愬弶鍊烽悺鎺戭儏婵炲秹鏁嶉崼婵堟憻闁?缂佸甯槐?,
    miniId: "trendMiniNetwork",
    infoId: "trendInfoNetwork",
    color: "#cc7a12",
    fill: "rgba(204,122,18,0.16)",
    format: (v) => `${bytes(v)}/缂佸濡?
  },
  process: {
    title: "閺夆晜绋撻埢濂稿箑缂佹ɑ娈堕悺鎺戭儏婵?,
    miniId: "trendMiniProcess",
    infoId: "trendInfoProcess",
    color: "#6f52d9",
    fill: "rgba(111,82,217,0.15)",
    format: (v) => num(Math.round(v)),
  },
  diskio: {
    title: "缁惧彞鑳跺ú?IO 闁告氨鍋涢幃娆戞惥鐎ｎ亜鈼㈤柨娑樼墕閻⊙囨嚍?缂佸甯槐?,
    miniId: "trendMiniDiskIO",
    infoId: "trendInfoDiskIO",
    color: "#0d7fa5",
    fill: "rgba(13,127,165,0.16)",
    format: (v) => `${bytes(v)}/缂佸濡?
  },
};

document.addEventListener("DOMContentLoaded", () => {
  if (domBootstrapped) return;
  domBootstrapped = true;

  updateBoot("闁告垵妫楅ˇ顒勫礆濠靛棭娼楅柛鏍ㄧ墱閺咁偊妫?..", 0);
  bootFallbackTimer = setTimeout(() => {
    if (bootFinished) return;
    console.error("闁告帗绻傞～鎰板礌閺嶎剛孝閺?180 缂佸甯槐婵嬪礄閸℃妲甸柤濂変簻婵晠鏌屽鍫㈡Ц");
    bootState.done = 0;
    updateBoot("闁告帗绻傞～鎰板礌閺嶎兘鍋撳Δ浣诡槯閺夊牆鍟撮弳閬嶆晬鐏炵虎鍔€闁革负鍔戦崳鍝ユ嫚?..", 0);
    bootstrap();
  }, 180000);

  try {
    bindAuthActions();
    bindSidebarToggle();
    bindMenu();
    switchSection("monitor");
    bindMonitorActions();
    bindLogActions();
    bindTrafficActions();
    bindRepairActions();
    bindBackupActions();
    bindCleanupActions();
    bindDockerActions();
    bindRemoteActions();
    bindAppManagerActions();
    bindSSHRemoteActions();
    bindSystemActions();
    bindModal();
    window.addEventListener("beforeunload", () => {
      stopMonitorSocket();
      stopDockerLogStream();
      stopCleanupScanPolling();
      stopTrafficPolling();
      disconnectRemoteTerminal(false);
      disconnectSSHSession(false);
    });
    initializeApp();
  } catch (err) {
    console.error("濡炪倗鏁诲浼村礆濠靛棭娼楅柛鏍ㄧ墪閵囨垹鎷?, err);
    updateBoot("濡炪倗鏁诲浼村礆濠靛棭娼楅柛鏍ㄧ墪閵囨垹鎷归妷顖滅閻犲洤鍢查崺娑㈠棘閺夋寧鍊甸梺鎻掔Х閻?, 0);
  }
});

async function initializeApp() {
  const authenticated = await checkAuthStatus();
  if (!authenticated) {
    dismissBootOverlay();
    showAuthOverlay("閻犲洤鍢查崢娑㈡儌鐠囪尙绉块柛姘凹婵炲洭鎮介妸褔鍏囩紓?);
    return;
  }
  hideAuthOverlay();
  bootstrap();
}

function bindAuthActions() {
  const form = document.getElementById("authLoginForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = String(document.getElementById("authUsername")?.value || "").trim();
    const password = String(document.getElementById("authPassword")?.value || "").trim();
    if (!username || !password) {
      setAuthMessage("閻犲洤鍢查敐鐐哄礃濞嗘垶鏆忛柟鏉戝槻閹洟宕仦鐣屾闁?, "error");
      return;
    }
    setAuthMessage("闁谎嗩嚙缂嶅秵绋?..", "info");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        data = {};
      }
      if (!res.ok) {
        setAuthMessage(data.error || "闁谎嗩嚙缂嶅秵寰勬潏顐バ?, "error");
        return;
      }
      state.authAuthenticated = true;
      setAuthMessage("闁谎嗩嚙缂嶅秹骞嬮幇顒€顫犻柨娑樻湰椤掓粓宕烽妸銊х闁稿繈鍎抽柈瀵哥磼?..", "success");
      window.location.reload();
    } catch (err) {
      console.error("auth login failed", err);
      setAuthMessage("闁谎嗩嚙缂嶅秵寰勬潏顐バ曢柨娑樼焷椤曨剙螞閳ь剟寮婚妷褏绉圭紓浣圭矋閸ㄣ劑寮靛鍛潳闁绘鍩栭埀?, "error");
    }
  });
}

async function checkAuthStatus() {
  try {
    const res = await fetchWithTimeout("/api/auth/status", 8000);
    if (!res.ok) {
      state.authAuthenticated = false;
      return false;
    }
    const data = await res.json();
    state.authAuthenticated = !!data?.authenticated;
    return state.authAuthenticated;
  } catch (err) {
    console.error("check auth status failed", err);
    state.authAuthenticated = false;
    return false;
  }
}

function handleAuthRequired(message = "闁谎嗩嚙缂嶅秴顔忛懠鍓佺畺闁哄牏鍣︾槐婵堟嫚閻戣棄娅㈤柡鍌涘濞呫儴銇?) {
  state.authAuthenticated = false;
  if (state.monitorTimer) {
    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
  }
  stopMonitorSocket();
  stopLogRealtimeLoop();
  stopDockerLogStream();
  dismissBootOverlay();
  showAuthOverlay(message);
}

function showAuthOverlay(message = "") {
  const overlay = document.getElementById("authOverlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  const usernameInput = document.getElementById("authUsername");
  if (usernameInput && !String(usernameInput.value || "").trim()) {
    usernameInput.value = "admin";
  }
  setAuthMessage(message || "閻犲洨鏌夌欢顓㈠礂閵夈劌顦╅柛娆忓槻閻︽垿鎯嶆担鐑橆仮鐟?, message ? "warning" : "info");
}

function hideAuthOverlay() {
  const overlay = document.getElementById("authOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

function setAuthMessage(message, type = "info") {
  const el = document.getElementById("authMessage");
  if (!el) return;
  const text = String(message || "").trim();
  el.textContent = text || "閻犲洨鏌夌欢顓㈠礂閵夈劌顦╅柛娆忓槻閻︽垿鎯嶆担鐑橆仮鐟?;
  el.classList.remove("error", "success", "warning", "info");
  el.classList.add(type || "info");
}

function dismissBootOverlay() {
  document.body.classList.remove("booting");
  const overlay = document.getElementById("bootOverlay");
  if (overlay) overlay.style.display = "none";
}

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
    const force = !!options.force;
    const isCollapsed = force ? !!collapsed : sidebarMedia.matches ? false : !!collapsed;
    const toggleLabel = isCollapsed ? "閻忕偞娲栫槐鎴犲寲閼姐倗鍩犻柤鎸庣矊瀹? : "闁衡偓閹増宕崇紒顖濆吹缁椽鎳ｅ鍐ㄧ";
    layout.classList.toggle("sidebar-collapsed", isCollapsed);
    sidebarToggleBtn.dataset.collapsed = String(isCollapsed);
    sidebarExpandBtn.dataset.collapsed = String(isCollapsed);
    sidebarToggleBtn.title = toggleLabel;
    sidebarToggleBtn.setAttribute("aria-label", toggleLabel);
    sidebarToggleBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    sidebarExpandBtn.title = "閻忕偞娲栫槐鎴犲寲閼姐倗鍩犻柤鎸庣矊瀹?;
    sidebarExpandBtn.setAttribute("aria-label", "閻忕偞娲栫槐鎴犲寲閼姐倗鍩犻柤鎸庣矊瀹?);
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
    setCollapsed(collapsed, { force: true });
  });

  sidebarExpandBtn.addEventListener("click", () => {
    setCollapsed(false, { force: true });
  });
}

async function bootstrap() {
  if (!state.authAuthenticated) return;
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

    await runBootStep("闁告梻濮惧ù鍥煀瀹ュ洨鏋?, loadConfig, { required: true, retries: 1, timeout: 12000 });
    await runOptionalBootStep("闂佹彃娲▔锔斤純閺嶃劌顥楅柣鈺傚灦鐢爼寮悧鍫濈ウ", () => refreshMonitor(false), { retries: 2, timeout: 45000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥╂惥鐎ｎ亜鈼㈤柛妯烘瑜?, loadTrendHistory, { retries: 1, timeout: 20000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忛柛婊冩湰濡晞绠涘Δ鍕垫綈闁?, loadApps, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忕紒鐙呯磿閹﹪宕氬Δ鍕┾偓?, loadManagedApps, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥规笟鈧崳娲礆閸℃鈧粙宕洪搹璇℃敤濞ｅ洠鍓濇导?, loadTrafficData, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥嚇濮橆厽鎷遍悗瑙勭煯缁?, loadScripts, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥嚇濮橆厽鎷遍柟绗涘棭鏀介柛妯烘瑜?, loadScriptRuns, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥ㄥ緞閸ワ箑鏁滈悹浣规緲缂?, loadBackups, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥规笟鈧崳娲儎閹寸偛浠?, () => refreshFlowMonitor(true), { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告梻濮惧ù鍥╁寲閼姐倗鍩犻弶鈺傚姌椤㈡垿寮妷銉х", loadRuntimeLogs, { retries: 1, timeout: 16000 });
    await runOptionalBootStep("闁告艾鏈鐐靛寲閼姐倗鍩犵紒鐙呯磿閹﹦鎮伴妸銉ョ", applySystemConfigForm, { retries: 0, timeout: 6000 });

    const degraded = softFailures.length > 0;
    finishBoot(degraded ? "闁告帗绻傞～鎰板礌閺嵮呮殮闁瑰瓨鍔х槐娆撴焾閵娿儱鐎婚柡浣哄瀹撲胶绮欏鍛€甸柛鏃傚Ь濞村洭鏁? : "闁告帗绻傞～鎰板礌閺嵮呮殮闁?);
    startMonitorLoop();
    startMonitorSocket();

    if (degraded) {
      const msg = `闂侇喓鍔岄崹搴∥熼垾铏仴闁告帗绻傞～鎰板礌閺嵮勵偨閺夆晝鍣︾槐?{softFailures.join("闁?)}闁挎稑鑻崙鈩冩交濞戞ê寮崇紒顖濆吹缁椽鐛捄铏规闁革负鍔岄幃妤呭矗娴兼潙娅㈤悹鍥ㄦЙ;
      showAppToast(msg, "warning");
      console.warn(msg);
    }
  } catch (err) {
    console.error("bootstrap failed", err);
    if (err && String(err.message || "").toLowerCase().includes("unauthorized")) {
      updateBoot("闁哄牜浜炲▍銉ㄣ亹閺囶亞绀夌紒娑橆槸缁剁喓鎷嬮妶鍫㈡...", Math.floor((bootState.done / bootState.total) * 100));
      return;
    }
    updateBoot("闁告帗绻傞～鎰板礌閺嵮佷杭閻犳劑鍎荤槐婵嗩潰閿濆懏韬梺鎻掔Х閻?..", Math.floor((bootState.done / bootState.total) * 100));
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
      await withTimeout(Promise.resolve().then(() => fn()), timeout, `${text}閻℃帒鎳忓淇?;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.error(`闁告帗绻傞～鎰板礌閺嶎煈鍔勫Δ鐘€曢妵鎴犳嫻? ${text}闁挎稑鐗忛?${attempt + 1} 婵炲棌妲勭槐姝? err);
      if (attempt < retries) {
        updateBoot(`${text}濠㈡儼绮剧憴锕傛晬瀹€鍕閻犲洦娲戦懙?${attempt + 1}/${retries})...`, Math.floor((bootState.done / bootState.total) * 100));
        await sleep(500);
      }
    }
  }

  bootState.done += 1;
  const percent = Math.floor((bootState.done / bootState.total) * 100);
  if (lastErr) {
    updateBoot(`${text}濠㈡儼绮剧憴顩? percent);
    if (required) throw lastErr;
    return false;
  }
  updateBoot(`${text}閻庣懓鏈崹姝? percent);
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

function finishBoot(doneText = "闁告帗绻傞～鎰板礌閺嵮呮殮闁?) {
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
      if (btn.classList.contains("hidden")) return;
      const active = btn === targetBtn;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });
  };

  const initial = Array.from(buttons).find((btn) => btn.classList.contains("active"));
  if (initial) activate(initial);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("hidden")) return;
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
      showAppToast("闁告梻濮惧ù鍥极閻楀牆绁︽繛鎾虫噽閹﹪鏌婂鍥╂瀭濠㈡儼绮剧憴?, "error");
    });
  }
  if (target === "docker") {
    loadDockerDashboard().catch((err) => {
      console.error("load docker dashboard failed", err);
      showAppToast("闁告梻濮惧ù?Docker 闁轰胶澧楀畵浣瑰緞鏉堫偉袝", "error");
    });
  }
  if (target === "app-manager") {
    loadManagedApps(true).catch((err) => {
      console.error("load app manager data failed", err);
      showAppToast("闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忕紒鐙呯磿閹﹪寮悧鍫濈ウ濠㈡儼绮剧憴?, "error");
    });
  }
  if (target === "remote-control") {
    ensureRemoteTerminalReady().catch((err) => {
      console.error("prepare remote terminal failed", err);
      showAppToast("閺夆晜绮庨埢鐓庮浖瀹€鍕〃闁哄牜浜滃銊х磼椤忓海绀夐悹鍥у槻閸樻盯鎯傜拠鑼Э闁哄牆绉存慨鐔煎闯閵娿儲绂堢憸鑸灪椤㈡垿妫?, "warning");
    });
  }
  if (target === "ssh-remote") {
    ensureSSHTerminalReady().catch((err) => {
      console.error("prepare ssh terminal failed", err);
      showAppToast("SSH 缂備礁鐗忛顒勫礆濠靛棭娼楅柛鏍ㄧ墪閵囨垹鎷?, "error");
    });
  }
  if (target === "traffic") {
    loadTrafficData(true).catch((err) => {
      console.error("load traffic data failed", err);
      showAppToast("闁告梻濮惧ù鍥规笟鈧崳娲礆閸℃鈧姤寰勬潏顐バ?, "error");
    });
    startTrafficPolling();
  } else {
    stopTrafficPolling();
  }
  if (target === "system") {
    applySystemConfigForm().catch((err) => {
      console.error("apply system config form failed", err);
      showAppToast("闁告梻濮惧ù鍥╁寲閼姐倗鍩犻梺鏉跨Ф閻ゅ棙寰勬潏顐バ?, "error");
    });
    loadRuntimeLogs().catch((err) => {
      console.error("load runtime logs failed", err);
      showAppToast("闁告梻濮惧ù鍥ㄦ交閹邦垼鏀介柡鍐﹀劚缁绘梹寰勬潏顐バ?, "error");
    });
  }
}

function bindMonitorActions() {
  normalizeLegacyTrendButtons();

  document.getElementById("monitorRefreshBtn").addEventListener("click", downloadRealtimeStatusTxt);
  document.getElementById("flowMonitorViewAllBtn")?.addEventListener("click", () => {
    openFlowMonitorAllModal();
  });
  document.getElementById("flowMonitorList")?.addEventListener("click", (event) => {
    const detailBtn = event.target.closest("[data-flow-detail]");
    if (!detailBtn) return;
    const key = String(detailBtn.dataset.flowDetail || "").trim();
    if (!key) return;
    openFlowMonitorDetailModalByKey(key);
  });
  resetFlowMonitorFilters();

  document.getElementById("monitorToggleBtn").addEventListener("click", () => {
    state.monitorPaused = !state.monitorPaused;
    const btn = document.getElementById("monitorToggleBtn");
    btn.textContent = state.monitorPaused ? "闁诡厹鍨归ˇ鏌ユ儎閹寸偛浠? : "闁稿绮嶉娑㈡儎閹寸偛浠?;
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
    openModal("缂佹棏鍨拌ぐ娑氭嫚閿旇棄鍓?, renderTableHTML(["閺夆晜绋撻埢濂稿触?, "缂佹棏鍨拌ぐ?, "PID", "闁绘鍩栭埀?, "閻犱警鍨扮欢?], rows));
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
    if (!confirm(`缁绢収鍠涢濠氬礂閹惰姤锛旈弶鈺傜〒閳?PID=${pid} ?`)) return;
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
      if (!mini.dataset.hint) mini.dataset.hint = "闁绘劗鎳撻崵顕€寮ㄩ幆褋浜?;
      mini.setAttribute("role", "button");
      mini.setAttribute("tabindex", "0");
      mini.setAttribute("title", "闁绘劗鎳撻崵顕€寮ㄩ幆褋浜ｉ柡灞诲劤濠€?24 閻忓繐绻戝鍌滄惥鐎ｎ亜鈼?);
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
    showAppToast("鐟滅増鎸告晶鐘诲汲閸屾稒锟ラ柛娆樺灟缁楀懏娼悾灞剧暠闁烩晜鍨剁敮鍫曞极閻楀牆绁?, "warning");
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
  lines.push(`闂佹彃娲﹂悧閬嶅籍閸洘锛?${formatTimeValue(data.time || Date.now())}`);
  lines.push(
    [
      `濞戞挾绮┃鈧?${compact(data.os?.hostname)}`,
      `缂侇垵宕电划铏圭尵鐠囪尙鈧?${compact(data.os?.os_type || data.os?.platform)}`,
      `缂侇垵宕电划娲偋閸喐鎷?${compact(data.os?.version)}`,
      `闁告劕鎳忛悧鎶芥偋閸喐鎷?${compact(data.os?.kernel_version || "-")}`,
      `閺夆晜鍔橀、鎴﹀籍閸洘姣?${formatDuration(data.os?.uptime)}`,
    ].join(" | "),
  );
  lines.push(
    [
      `閻犱焦鍎抽ˇ鐞丏 ${compact(data.os?.device_id || "-", 80)}`,
      `濞存籂鍐╂儌ID ${compact(data.os?.product_id || "-", 80)}`,
    ].join(" | "),
  );
  lines.push(
    [
      `CPU ${fixed(data.cpu?.usage_percent)}%`,
      `闁哄秶顭堢缓?${num(data.cpu?.core_count)}`,
      `闁搞劌顑呰ぐ?${compact(data.cpu?.model)}`,
      `闁哄鍩栭悗?${compact(data.cpu?.architecture)}`,
      `濡増鍨瑰?${fixed(data.cpu?.frequency_mhz)}MHz`,
    ].join(" | "),
  );

  const memSummary = summarizeMemoryModules(data.memory?.modules || []);
  lines.push(
    [
      `闁告劕鎳庨悺?${bytes(data.memory?.used)} / ${bytes(data.memory?.total)} (${fixed(data.memory?.used_percent)}%)`,
      `濞存嚎鍊栧畷鏌ュ礌?${bytes(data.memory?.swap_used)} / ${bytes(data.memory?.swap_total)} (${fixed(data.memory?.swap_used_rate)}%)`,
      `闁告劕鎳庨悺銊╁级?${compact(memSummary)}`,
    ].join(" | "),
  );

  lines.push(
    [
      `缂傚啯鍨圭划绂漃 ${compact(data.network?.primary_ip || "-")}(${compact(data.network?.primary_nic || "-")})`,
      `MAC ${compact(data.network?.primary_mac || "-")}`,
      `閺夆晝鍋炵敮鎾极?${num(data.network?.connection_count || 0)}`,
      `缂侀硸鍨甸鎼佸礂?${bytes(data.network?.bytes_recv)}`,
      `缂侀硸鍨甸鎼佸礄?${bytes(data.network?.bytes_sent)}`,
      `闁告牕鎳庨崣?${num(data.network?.packets_in)}`,
      `闁告牕鎳庨崵?${num(data.network?.packets_out)}`,
    ].join(" | "),
  );

  lines.push(
    [
      `閺夆晜绋撻埢濂稿箑缂佹ɑ娈?${num(data.process_count)}`,
      `缂佹崘娉曢埢濂稿箑缂佹ɑ娈?${num(data.thread_count)}`,
      `缁惧彞鑳跺ú寤擮閻庡湱鍋炲鍌滄嫚?${rateBytes(summaryRate.readBytesRate)}/缂?${fixed(summaryRate.readOpsRate)}婵?缂?`,
      `闁?${rateBytes(summaryRate.writeBytesRate)}/缂?${fixed(summaryRate.writeOpsRate)}婵?缂?`,
    ].join(" | "),
  );

  const diskHw = data.disk_hardware || [];
  if (diskHw.length) {
    const compactHw = diskHw
      .slice(0, 6)
      .map((x) => `${compact(x.model || x.name)}#${compact(x.serial || "-")}@${bytes(x.size || 0)}`)
      .join(" ; ");
    lines.push(`缁惧彞鑳跺ú蹇曟兜椤戞寧顐?${diskHw.length}) ${compactHw}`);
  }

  const disks = data.disks || [];
  lines.push(`[缁惧彞鑳跺ú蹇涙偐閼哥鍋撴稊?${disks.length} 濡炪倗顒?;
  disks.slice(0, 24).forEach((x) => {
    const rate = diskRateByKey[buildDiskKey(x)] || {
      readBytesRate: 0,
      writeBytesRate: 0,
      readOpsRate: 0,
      writeOpsRate: 0,
    };
    lines.push(
      `${compact(x.path)} | ${compact(x.device)} | ${fixed(x.used_percent)}% | ${bytes(x.used)}/${bytes(x.total)} | 閻?${rateBytes(rate.readBytesRate)}/缂?${fixed(rate.readOpsRate)}婵?缂? 闁?${rateBytes(rate.writeBytesRate)}/缂?${fixed(rate.writeOpsRate)}婵?缂?`,
    );
  });

  const ports = data.ports || [];
  lines.push(`[闁烩晜鍨甸幆澶岀博椤栨艾缍揮 ${ports.length} 濡炪倗顒?;
  ports.slice(0, 40).forEach((x) => {
    lines.push(`${x.port} | PID ${x.pid} | ${compact(displayPortProcessName(x))} | ${compact(displayPortPath(x))}`);
  });

  const flowItems = Array.isArray(state.flowMonitorItems) ? state.flowMonitorItems : [];
  lines.push(`[婵炵繝绶氶崳娲儎閹寸偛浠榏 ${flowItems.length} 濡炪倗顒?;
  flowItems.slice(0, 50).forEach((x) => {
    lines.push(
      `${compact(x.name)} | ${compact(x.flow_type)} | ${localizeTaskStatus(x.status)} | ${compact(x.detail || "-", 140)}`,
    );
  });

  const processes = state.combinedProcesses || [];
  lines.push(`[閺夆晜绋撻埢濂稿箳閹烘洦鏀?JVM] ${processes.length} 濡炪倗顒?;
  processes.slice(0, 60).forEach((x) => {
    lines.push(
      `${compact(x.name)} | ${x.is_jvm ? "JVM" : "閺夆晜绋撻埢?} | PID ${x.pid} | CPU ${fixed(x.cpu)}% | 闁告劕鎳庨悺?${fixed(x.memory)}% | 缂佹崘娉曢埢?${num(x.threads)} | ${compact(x.exe_path, 120)}`,
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
  document.getElementById("logSourceSelect").addEventListener("change", handleLogSourceChange);
  document.getElementById("logStats")?.addEventListener("click", handleLogStatsFilterClick);
  document.getElementById("logResult")?.addEventListener("click", handleLogRowCopyClick);
  document.getElementById("logDeleteCardBtn").addEventListener("click", async () => {
    const name = String(state.currentApp?.name || "").trim();
    if (!name) {
      showAppToast("閻犲洤鍢查崢娑㈡焻婢跺顏ラ柡鍐﹀劚缁绘柨鈹?, "warning");
      return;
    }
    await deleteLogCard(name);
  });
  document.getElementById("logAddCardBtn").addEventListener("click", openAddLogCardModal);
}

function normalizeLogLevelFilter(raw) {
  const level = String(raw || "").trim().toLowerCase();
  if (!level || level === "all") return "all";
  if (level === "error") return "error";
  if (level === "warn" || level === "warning") return "warn";
  if (level === "info") return "info";
  if (level === "debug") return "debug";
  return "all";
}

function renderLogStats(levelCount, total, activeLevel = "all") {
  const picked = normalizeLogLevelFilter(activeLevel);
  const count = (key) => num(Number(levelCount?.[key] || 0));
  const cardClass = (key) => {
    const classes = ["log-stat-card", "clickable"];
    if (key === "error" || key === "warn" || key === "info" || key === "debug") classes.push(key);
    if (picked === key) classes.push("active");
    return classes.join(" ");
  };

  return `
    <button class="${cardClass("all")}" type="button" data-log-level="all" title="缂佹稒鐩埀顒€顦崣蹇涙焾閵婏附锛夐煫?>
      <strong>${num(total)}</strong><span>闁告稒鍨濋懙鎴﹀籍閵夈儳绠?/span>
    </button>
    <button class="${cardClass("error")}" type="button" data-log-level="error" title="缂佹稒鐩埀顒€顦甸弫濠勬嫚椤栨稒锛夐煫?>
      <strong>${count("error")}</strong><span>闂佹寧鐟ㄩ?/span>
    </button>
    <button class="${cardClass("warn")}" type="button" data-log-level="warn" title="缂佹稒鐩埀顒€顦幉锛勬媰閿旇姤锛夐煫?>
      <strong>${count("warn")}</strong><span>闁告稑锕ㄩ?/span>
    </button>
    <button class="${cardClass("info")}" type="button" data-log-level="info" title="缂佹稒鐩埀顒€顦穱濠囧箒椤栨稒锛夐煫?>
      <strong>${count("info")}</strong><span>濞ｅ洠鍓濇导?/span>
    </button>
    <button class="${cardClass("debug")}" type="button" data-log-level="debug" title="缂佹稒鐩埀顒€顦抽惃鐔烘嫚閺囩喐锛夐煫?>
      <strong>${count("debug")}</strong><span>閻犲鍟抽惁?/span>
    </button>
  `;
}

function handleLogStatsFilterClick(event) {
  const card = event.target.closest("[data-log-level]");
  if (!card) return;
  const level = normalizeLogLevelFilter(card.dataset.logLevel || "all");
  const levelSelect = document.getElementById("logLevel");
  if (levelSelect) levelSelect.value = level;
  queryLogs(false, { levelOverride: level });
}

async function handleLogRowCopyClick(event) {
  const row = event.target.closest("[data-log-copy]");
  if (!row) return;
  const text = String(row.dataset.logCopy || "").trim();
  if (!text) return;
  const ok = await copyText(text);
  if (ok) {
    showCopyToast(`鐎瑰憡褰冮ˇ鏌ュ礆閼稿灚锛夐煫鍥殣缁?{shorten(text, 52)}`);
  } else {
    showCopyToast("濠㈣泛绉撮崺妤佸緞鏉堫偉袝闁挎稑鐭侀顒勫箥鐎ｎ亜袟濠㈣泛绉撮崺?);
  }
}

function buildLogEntryCopyText(item) {
  const time = formatTimeValue(item?.time || "-");
  const level = String(item?.level || "info").toUpperCase();
  const file = String(item?.file || "-");
  const message = String(item?.message || item?.raw || "-").replace(/\s+/g, " ").trim();
  return `[${time}] [${level}] ${file} ${message}`.trim();
}

function buildLogEntryTitle(item) {
  const time = formatTimeValue(item?.time || "-");
  const level = String(item?.level || "info").toUpperCase();
  const file = String(item?.file || "-");
  const message = String(item?.message || item?.raw || "-");
  return `闁哄啫鐖煎Λ鍧楁晬?{time}\n缂佺嫏鍐ㄧ劶闁?{level}\n闁哄倸娲ｅ▎銏ゆ晬?{file}\n闁告劕鎳庨鎰版晬?{message}`;
}

function bindTrafficActions() {
  document.getElementById("trafficRefreshBtn")?.addEventListener("click", () => loadTrafficData(true));
  document.getElementById("trafficConnectionSearch")?.addEventListener("input", renderTrafficConnectionTable);
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
      showAppToast(data.error || "濞戞挸锕ｇ槐鑸靛緞鏉堫偉袝", "error");
      return;
    }
    event.target.reset();
    await loadScripts();
    showAppToast("闁煎瓨纰嶅﹢鐗堢▔婵犱胶鐐婇柟瀛樺姇婵?, "success");
  });

  document.getElementById("runScriptBtn").addEventListener("click", async () => {
    const name = document.getElementById("scriptName").value;
    const args = document.getElementById("scriptArgs").value;
    if (!name) {
      showAppToast("閻犲洨鍏橀埀顒€顦扮€氥劑鎳樺顓熸嫳", "warning");
      return;
    }

    const res = await fetch("/api/scripts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, args }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "闁圭瑳鍡╂斀濠㈡儼绮剧憴?, "error");
      return;
    }
    state.currentRunId = data.run_id;
    showAppToast("闁煎瓨纰嶅﹢鏉款啅閹绘帞纾诲┑顔碱儐婢х晫鎮?, "success");
    pollRunDetail();
  });
}

function bindBackupActions() {
  document.getElementById("backupSelectSourceBtn")?.addEventListener("click", () => {
    openDirectoryPicker({
      mode: "backup-source",
      title: "闂侇偄顦扮€氥劍寰勯崶锕€鏁滄繝褎鍔楀ú鎷屻亹?,
      multi: true,
      selected: state.backupSelectedSources,
      onConfirm: (paths) => {
        state.backupSelectedSources = [...paths];
        renderBackupSources();
      },
    });
  });
  document.getElementById("backupSelectTargetBtn")?.addEventListener("click", () => {
    openDirectoryPicker({
      mode: "backup-target",
      title: "闂侇偄顦扮€氥劍寰勯崶锕€鏁滈柣鈺婂枟閻栵綁鎯勯鑲╃Э",
      multi: false,
      selected: [String(document.getElementById("backupTarget")?.value || "").trim()].filter(Boolean),
      allowCreate: true,
      onConfirm: (paths) => {
        document.getElementById("backupTarget").value = paths[0] || "";
      },
    });
  });
  document.getElementById("backupCreateTargetBtn")?.addEventListener("click", async () => {
    const current = String(document.getElementById("backupTarget")?.value || "").trim();
    const next = prompt("閻犲洨鏌夌欢顓㈠礂閵夘煈娲ｉ柛鎺撶☉缂傛捇鎯冮崟顓熺獥鐟滅増娲滅划椋庘偓鐢殿攰閻儳顕?, current || "");
    if (!next) return;
    const path = await createDirectory(next);
    document.getElementById("backupTarget").value = path;
    showAppToast(`闁烩晩鍠栫紞宥咁啅閹绘帒鐏＄€? ${path}`, "success");
  });
  document.getElementById("runBackupBtn").addEventListener("click", async () => {
    const type = document.getElementById("backupType").value;
    const name = document.getElementById("backupName").value;
    const target = document.getElementById("backupTarget").value;

    const res = await fetch("/api/backups/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, target, paths: state.backupSelectedSources }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "濠㈣泛娲ｉ崬銈嗗緞鏉堫偉袝", "error");
      return;
    }
    await loadBackups();
    showAppToast("濠㈣泛娲ｉ崬銈嗙鐠囨彃顫ょ€圭寮惰ぐ浣圭?, "success");
  });
  renderBackupSources();
}

function bindCleanupActions() {
  const scanBtn = document.getElementById("cleanupScanBtn");
  if (!scanBtn) return;

  const stopScanBtn = document.getElementById("cleanupStopScanBtn");
  const stopGarbageBtn = document.getElementById("cleanupStopGarbageBtn");
  const loadRootsBtn = document.getElementById("cleanupLoadRootsBtn");
  const openTreeBtn = document.getElementById("cleanupOpenTreeBtn");
  const addRootBtn = document.getElementById("cleanupAddRootBtn");
  const customRootInput = document.getElementById("cleanupCustomRoot");
  const customRootList = document.getElementById("cleanupCustomRootList");

  if (loadRootsBtn) {
    loadRootsBtn.addEventListener("click", async () => {
      await ensureCleanupMeta(true);
    });
  }
  if (openTreeBtn) {
    openTreeBtn.addEventListener("click", () => {
      openDirectoryPicker({
        mode: "cleanup-root",
        title: "闂侇偄顦扮€氥劑骞嶉锝呬紟闁烩晩鍠栫紞?,
        multi: true,
        selected: state.cleanupCustomRoots,
        onConfirm: (paths) => {
          state.cleanupCustomRoots = [...paths];
          renderCleanupCustomRoots();
        },
      });
    });
  }
  if (addRootBtn) {
    addRootBtn.addEventListener("click", () => {
      addCleanupCustomRoot();
    });
  }
  if (customRootInput) {
    customRootInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addCleanupCustomRoot();
    });
  }
  if (customRootList) {
    customRootList.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-path]");
      if (!btn) return;
      removeCleanupCustomRoot(String(btn.dataset.path || ""));
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

  renderTable("cleanupFileList", ["閹兼潙绻愯ぐ?, "缂侇偉顕ч悗?, "濞ｅ浂鍠楅弫濂稿籍閸洘锛?, "濠㈠爢鍐瘓", "濠㈠爢鍐瘓闁告濮甸惁?, "閻庣懓鏈弳锝囨崉椤栨氨绐?], []);
  renderTable("cleanupLargeFileList", ["閹兼潙绻愯ぐ?, "缂侇偉顕ч悗?, "濞ｅ浂鍠楅弫濂稿籍閸洘锛?, "濠㈠爢鍐瘓", "濠㈠爢鍐瘓闁告濮甸惁?, "閻庣懓鏈弳锝囨崉椤栨氨绐?], []);
  renderTable("cleanupDirSummaryList", ["闁烩晩鍠栫紞?, "闁哄倸娲ｅ▎銏ゅ极?, "闁告濮烽弫?, "闁告濮甸惁?], []);
  renderTable("cleanupTypeSummaryList", ["缂侇偉顕ч悗?, "闁哄倸娲ｅ▎銏ゅ极?, "闁告濮烽弫?, "闁告濮甸惁?], []);
  renderTable("cleanupGarbageResult", ["闁烩晩鍠楅悥?, "闁稿﹥鐟╅埀顒€顦伴弸鍐╃?, "闁稿﹥鐟╅埀顒€顦紞瀣矓?, "鐎圭寮剁粩濠氭偠閸℃ɑ鐎ù?, "鐎圭寮剁粩濠氭偠閸℃洜绉肩紒?, "濠㈡儼绮剧憴锕傚极?, "闁烩晩鍠栫紞?], []);
  renderCleanupCustomRoots();
}

function bindDockerActions() {
  const refreshBtn = document.getElementById("dockerRefreshBtn");
  const searchInput = document.getElementById("dockerSearch");
  const scopeSelect = document.getElementById("dockerScope");
  const pageSizeSelect = document.getElementById("dockerPageSize");
  const batchActionSelect = document.getElementById("dockerBatchActionType");
  const batchApplyBtn = document.getElementById("dockerBatchApplyBtn");
  const prevBtn = document.getElementById("dockerPrevBtn");
  const nextBtn = document.getElementById("dockerNextBtn");
  const table = document.getElementById("dockerContainerTable");
  const imageTable = document.getElementById("dockerImageTable");
  if (!refreshBtn || !searchInput || !scopeSelect || !table) return;

  refreshBtn.addEventListener("click", () => {
    state.dockerPage = 1;
    loadDockerDashboard(true).catch((err) => {
      console.error("refresh docker dashboard failed", err);
      showAppToast("闁告帡鏀遍弻?Docker 闁轰胶澧楀畵浣瑰緞鏉堫偉袝", "error");
    });
  });

  searchInput.addEventListener("input", () => {
    if (dockerSearchDebounceTimer) clearTimeout(dockerSearchDebounceTimer);
    dockerSearchDebounceTimer = setTimeout(() => {
      state.dockerPage = 1;
      loadDockerContainers(true).catch((err) => {
        console.error("search docker containers failed", err);
        showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
      });
    }, 260);
  });

  scopeSelect.addEventListener("change", () => {
    state.dockerPage = 1;
    loadDockerContainers(true).catch((err) => {
      console.error("reload docker containers failed", err);
      showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
    });
  });

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      const nextSize = Number(pageSizeSelect.value || 20);
      state.dockerPageSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 20;
      state.dockerPage = 1;
      loadDockerContainers(true).catch((err) => {
        console.error("change docker page size failed", err);
        showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
      });
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (state.dockerPage <= 1) return;
      state.dockerPage -= 1;
      loadDockerContainers(true).catch((err) => {
        console.error("docker prev page failed", err);
        showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
      });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (state.dockerTotalPages <= 0 || state.dockerPage >= state.dockerTotalPages) return;
      state.dockerPage += 1;
      loadDockerContainers(true).catch((err) => {
        console.error("docker next page failed", err);
        showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
      });
    });
  }

  table.addEventListener("click", handleDockerTableClick);
  imageTable?.addEventListener("click", handleDockerImageTableClick);
  document.getElementById("dockerTabContainers")?.addEventListener("click", () => switchDockerTab("containers"));
  document.getElementById("dockerTabImages")?.addEventListener("click", () => switchDockerTab("images"));
  if (batchApplyBtn) {
    batchApplyBtn.addEventListener("click", async () => {
      const action = String(batchActionSelect?.value || "").trim();
      if (!action) return;
      if (action === "remove-image") {
        await runDockerImageBatchAction("remove");
      } else {
        await runDockerBatchAction(action);
      }
    });
  }
  refreshDockerBatchActionUI();
}

function bindRemoteActions() {
  document.getElementById("remoteConnectBtn")?.addEventListener("click", () => {
    connectRemoteTerminal(true).catch((err) => {
      console.error("connect remote desktop failed", err);
      showAppToast(err.message || "閺夆晝鍋炵敮瀛樻交濠婂應鏌ゆ俊妤€鐭傚鐗堝緞鏉堫偉袝", "error");
    });
  });
  document.getElementById("remoteDisconnectBtn")?.addEventListener("click", () => disconnectRemoteTerminal(true));
  document.getElementById("remoteFullscreenBtn")?.addEventListener("click", () => toggleRemoteFullscreen());
  document.getElementById("remoteFps")?.addEventListener("change", () => reconnectRemoteDesktop());
  document.getElementById("remoteQuality")?.addEventListener("change", () => reconnectRemoteDesktop());
  document.getElementById("remoteScale")?.addEventListener("change", () => reconnectRemoteDesktop());
  document.addEventListener("keydown", handleRemoteHotkeys);
  document.addEventListener("keyup", handleRemoteHotkeys);
}

async function ensureRemoteTerminalReady() {
  if (!remoteCanvas) {
    initRemoteDesktopCanvas();
  }
  if (!state.remoteMeta) {
    await loadRemoteMeta();
  } else {
    applyRemoteMetaToUI();
  }
}

function initRemoteDesktopCanvas() {
  const canvas = document.getElementById("remoteDesktopCanvas");
  const wrap = document.getElementById("remoteDesktopWrap");
  if (!canvas || !wrap || remoteCanvas) return;
  remoteCanvas = canvas;
  remoteCtx = canvas.getContext("2d");
  if (!remoteCtx) {
    throw new Error("婵炴潙绻楅～宥夊闯閵娿倗鐟濋柡鈧娑樼槷闁汇垼顕х粩宄般€掗崣澶屽帬");
  }
  remoteCtx.fillStyle = "#0d1628";
  remoteCtx.fillRect(0, 0, canvas.width, canvas.height);

  if (!remoteInputBound) {
    bindRemoteDesktopInput(canvas);
    remoteInputBound = true;
  }
  if (wrap && typeof ResizeObserver === "function") {
    remoteResizeObserver = new ResizeObserver(() => fitRemoteTerminal());
    remoteResizeObserver.observe(wrap);
  }
  window.addEventListener("resize", fitRemoteTerminal);
}

async function loadRemoteMeta() {
  const res = await fetchWithTimeout("/api/remote/meta", 12000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "闁告梻濮惧ù鍥ㄦ交濠婂應鏌ら柟璨夊啫鐓戦梺鏉跨Ф閻ゅ棙寰勬潏顐バ?);
  }
  state.remoteMeta = data || null;
  if (data && data.available === false) {
    const message = String(data.error || "闁哄牆绉存慨鐔煎闯閵婏附寮撴俊顐熷亾婵炴潙顑呴崺宀勫矗椤栨粍鏆忔俊妤€鐭傚浼存晬瀹€鍐惧殲闁稿繐鐗嗙槐鎴﹀嫉閸濆嫯瀚欓柣褑顕х紞宥夊炊閹嗗煂婵℃鐭傚?);
    setRemoteConnectionStatus("down", message);
    setRemoteOverlay("闁哄牜浜濋ˉ鍛圭€ｎ亜鐓傞柛娆樺灣閺併倕顩煎畝鍕〃闁挎稑鐭侀顒勫礂閸繃韬柡鍫濈Т婵喖宕抽妸銈囩憪闁谎嗩嚙缂嶅秹宕堕幆褑鍩屾俊妤€鐭傚浼村触鎼粹€虫櫃閺夆晝鍋炵敮?);
    updateRemoteControlButtons(false);
    return state.remoteMeta;
  }
  applyRemoteMetaToUI();
  return state.remoteMeta;
}

function applyRemoteMetaToUI() {
  const fps = document.getElementById("remoteFps");
  const quality = document.getElementById("remoteQuality");
  const scale = document.getElementById("remoteScale");
  if (fps && state.remoteMeta?.default_fps) fps.value = String(state.remoteMeta.default_fps);
  if (quality && state.remoteMeta?.default_quality) quality.value = String(state.remoteMeta.default_quality);
  if (scale && state.remoteMeta?.default_scale) scale.value = String(state.remoteMeta.default_scale);
  if (state.remoteMeta && Number(state.remoteMeta.can_input) === 0) {
    setRemoteConnectionStatus("unknown", "濞寸姴鎳忛弫顕€骞愭担璇℃斀闂傚牄鍨洪悡锟犳儑鐎ｅ墎绀夌憸鐗堟尭婢х姷鍖栭懡銈囧煚濞戞挸绉甸弫顕€骞愭担铏圭Ч濡炪倓绲荤欢顓㈠礂閵夛箑浠橀柛?);
  } else {
    const w = Number(state.remoteMeta?.width || 0);
    const h = Number(state.remoteMeta?.height || 0);
    if (w > 0 && h > 0) {
      setRemoteOverlay(`缂佹稑顦欢鐔告交閻愭潙澶嶆俊妤€鐭傚?(${w}x${h})`);
    }
  }
}

async function connectRemoteTerminal(showToast = true) {
  await ensureRemoteTerminalReady();
  if (state.remoteMeta && state.remoteMeta.available === false) {
    throw new Error(state.remoteMeta.error || "闁哄牆绉存慨鐔煎闯閵婏附寮撴俊顐熷亾婵炴潙顑呴崺宀勫矗椤栨粍鏆忔俊妤€鐭傚浼存晬瀹€鍐惧殲闁稿繐鐗嗙槐鎴﹀嫉閸濆嫯瀚欓柣褑顕х紞宥夊炊閹嗗煂婵℃鐭傚?);
  }
  if (remoteWS && (remoteWS.readyState === WebSocket.OPEN || remoteWS.readyState === WebSocket.CONNECTING)) {
    remoteCanvas?.focus();
    return;
  }
  clearRemoteReconnectTimer();

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const fps = Number(getInputValue("remoteFps") || state.remoteMeta?.default_fps || 8);
  const quality = Number(getInputValue("remoteQuality") || state.remoteMeta?.default_quality || 60);
  const scale = Number(getInputValue("remoteScale") || state.remoteMeta?.default_scale || 0.75);
  const query = new URLSearchParams({
    fps: String(Number.isFinite(fps) ? fps : 8),
    quality: String(Number.isFinite(quality) ? quality : 60),
    scale: String(Number.isFinite(scale) ? scale : 0.75),
  });
  remoteManualClose = false;
  state.remoteConnected = false;
  setRemoteConnectionStatus("unknown", "婵繐绲藉﹢顏呮交閻愭潙澶嶉弶鈺傜矌閳荤厧顩煎畝鍕〃...");
  updateRemoteControlButtons(false);
  setRemoteOverlay("婵繐绲藉﹢顏呮交閻愭潙澶嶉弶鈺傜矌閳荤厧顩煎畝鍕〃...");

  const ws = new WebSocket(`${protocol}://${location.host}/ws/remote/desktop?${query.toString()}`);
  ws.binaryType = "arraybuffer";
  remoteWS = ws;

  ws.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      drawRemoteDesktopFrame(event.data);
      return;
    }
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const type = String(msg?.type || "").trim();
    if (type === "meta") {
      state.remoteConnected = true;
      const fw = Number(msg.width || 0);
      const fh = Number(msg.height || 0);
      if (remoteCanvas && fw > 0 && fh > 0 && (remoteCanvas.width !== fw || remoteCanvas.height !== fh)) {
        remoteCanvas.width = fw;
        remoteCanvas.height = fh;
      }
      setRemoteConnectionStatus("up", `鐎规瓕灏换娑㈠箳?${fw || "-"}x${fh || "-"} 鐠?${msg.fps || fps} FPS`);
      remoteReconnectAttempt = 0;
      clearRemoteReconnectTimer();
      updateRemoteControlButtons(true);
      setRemoteOverlay("");
      fitRemoteTerminal();
      remoteCanvas?.focus();
      if (showToast) showAppToast("閺夆晜绮庨埢鐓庮浖瀹€鍕〃閺夆晝鍋炵敮鎾箣閹邦剙顫?, "success");
      return;
    }
    if (type === "error") {
      const text = String(msg.error || "閺夆晜绮庨埢鐓庮浖瀹€鍕〃鐎殿喖鍊搁悥?);
      setRemoteConnectionStatus("down", text);
      setRemoteOverlay(text);
      if (showToast) showAppToast(text, "error");
      return;
    }
  });

  ws.addEventListener("close", () => {
    if (remoteWS !== ws) return;
    remoteWS = null;
    state.remoteConnected = false;
    updateRemoteControlButtons(false);
    if (!remoteManualClose) {
      setRemoteConnectionStatus("down", "閺夆晝鍋炵敮鏉戭啅閸欏鐒界€殿喒鍋?);
      setRemoteOverlay("閺夆晝鍋炵敮鏉戭啅閸欏鐒界€殿喒鍋撻柨娑樼灱閸嬶綁宕欓悜鈹惧亾濠婂棛绠鹃柟鎭掑劜椤㈡垿妫冮埗鈹惧亾濠靛娅㈤悹?);
    } else {
      setRemoteConnectionStatus("unknown", "閺夆晝鍋炵敮鏉戭啅閸欏鐒界€殿喒鍋?);
      setRemoteOverlay("鐎圭寮堕弻鍥ь嚕閳ь剚娼婚悙鏉戝");
    }
    if (!remoteManualClose) {
      scheduleRemoteReconnect();
    }
  });

  ws.addEventListener("error", () => {
    if (remoteWS !== ws) return;
    setRemoteConnectionStatus("down", "閺夆晝鍋炵敮瀛樺緞鏉堫偉袝闁挎稑鐭侀顒€螞閳ь剟寮婚妷锔界疀闁告柡鈧櫕鐝ら柛銉﹀劤閼镐即鎮抽姘兼殧");
    setRemoteOverlay("閺夆晝鍋炵敮瀛樺緞鏉堫偉袝");
  });
}

function disconnectRemoteTerminal(showToast = false) {
  remoteManualClose = true;
  clearRemoteReconnectTimer();
  remoteReconnectAttempt = 0;
  if (remoteWS && (remoteWS.readyState === WebSocket.OPEN || remoteWS.readyState === WebSocket.CONNECTING)) {
    remoteWS.close();
  }
  remoteWS = null;
  state.remoteConnected = false;
  updateRemoteControlButtons(false);
  setRemoteConnectionStatus("unknown", "闁哄牜浜ｇ换娑㈠箳?);
  setRemoteOverlay("鐎圭寮堕弻鍥ь嚕閳ь剚娼婚悙鏉戝");
  if (showToast) showAppToast("閺夆晜绮庨埢鐓庮浖瀹€鍕〃鐎圭寮堕弻鍥ь嚕閳?, "success");
}

function clearRemoteReconnectTimer() {
  if (remoteReconnectTimer) {
    clearTimeout(remoteReconnectTimer);
    remoteReconnectTimer = null;
  }
}

function scheduleRemoteReconnect() {
  if (remoteReconnectTimer) return;
  const attempt = remoteReconnectAttempt + 1;
  remoteReconnectAttempt = attempt;
  const delay = Math.min(REMOTE_WS_RETRY_MAX_MS, REMOTE_WS_RETRY_BASE_MS * Math.pow(2, Math.min(5, attempt - 1)));
  setRemoteConnectionStatus("down", `閺夆晝鍋炵敮鎾棘椤撶偟纾婚柨?{Math.round(delay / 1000)} 缂佸甯掗幃妤呮嚊椤忓嫬袟闂佹彃绉风换?..`);
  remoteReconnectTimer = setTimeout(() => {
    remoteReconnectTimer = null;
    if (remoteManualClose) return;
    connectRemoteTerminal(false).catch((err) => {
      console.error("remote auto reconnect failed", err);
      scheduleRemoteReconnect();
    });
  }, delay);
}

function drawRemoteDesktopFrame(buffer) {
  if (!remoteCtx || !remoteCanvas || !buffer) return;
  const blob = new Blob([buffer], { type: "image/jpeg" });
  createImageBitmap(blob).then((bitmap) => {
    if (!remoteCtx || !remoteCanvas) {
      bitmap.close();
      return;
    }
    remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
    remoteCtx.drawImage(bitmap, 0, 0, remoteCanvas.width, remoteCanvas.height);
    bitmap.close();
  }).catch(() => {});
}

function fitRemoteTerminal() {
  const wrap = document.getElementById("remoteDesktopWrap");
  const canvas = remoteCanvas;
  if (!wrap || !canvas) return;
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function setRemoteOverlay(text) {
  const el = document.getElementById("remoteDesktopOverlay");
  if (!el) return;
  const t = String(text || "").trim();
  el.textContent = t;
  el.style.display = t ? "" : "none";
}

function bindRemoteDesktopInput(canvas) {
  canvas.addEventListener("mousedown", (event) => {
    remoteMouseDown = true;
    canvas.focus();
    const point = normalizeRemotePointer(event, canvas);
    sendRemoteDesktopInput({ type: "down", x: point.x, y: point.y, button: mapMouseButton(event.button) });
  });
  canvas.addEventListener("mouseup", (event) => {
    remoteMouseDown = false;
    const point = normalizeRemotePointer(event, canvas);
    sendRemoteDesktopInput({ type: "up", x: point.x, y: point.y, button: mapMouseButton(event.button) });
  });
  canvas.addEventListener("mousemove", (event) => {
    const now = Date.now();
    if (!remoteMouseDown && now - remoteLastMoveSentAt < 26) return;
    remoteLastMoveSentAt = now;
    const point = normalizeRemotePointer(event, canvas);
    sendRemoteDesktopInput({ type: "move", x: point.x, y: point.y });
  });
  canvas.addEventListener("mouseleave", () => {
    if (remoteMouseDown) {
      remoteMouseDown = false;
      sendRemoteDesktopInput({ type: "up", x: remoteLastPointerX, y: remoteLastPointerY, button: "left" });
    }
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -1 : 1;
    sendRemoteDesktopInput({ type: "wheel", delta });
  }, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function normalizeRemotePointer(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(1, rect.width);
  const y = (event.clientY - rect.top) / Math.max(1, rect.height);
  const point = {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
  remoteLastPointerX = point.x;
  remoteLastPointerY = point.y;
  return point;
}

function mapMouseButton(button) {
  if (button === 2) return "right";
  if (button === 1) return "middle";
  return "left";
}

async function sendRemoteDesktopInput(payload) {
  if (!state.remoteConnected) return;
  if (state.remoteMeta && Number(state.remoteMeta.can_input) === 0) return;

  if (remoteWS && remoteWS.readyState === WebSocket.OPEN) {
    try {
      remoteWS.send(JSON.stringify({ type: "input", input: payload }));
      return;
    } catch (_) {
      // fallback to HTTP below
    }
  }

  try {
    const res = await fetch("/api/remote/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 400) {
      const data = await res.json().catch(() => ({}));
      if (data?.error) {
        setRemoteConnectionStatus("down", data.error);
      }
    }
  } catch (_) {
    // ignore transient input failures
  }
}

function reconnectRemoteDesktop() {
  if (!state.remoteConnected) return;
  disconnectRemoteTerminal(false);
  connectRemoteTerminal(false).catch((err) => {
    console.error("reconnect remote desktop failed", err);
    setRemoteConnectionStatus("down", err.message || "闂佹彃绉风换娑欏緞鏉堫偉袝");
  });
}

function setRemoteConnectionStatus(level, text) {
  const badge = document.getElementById("remoteStatusBadge");
  const desc = document.getElementById("remoteStatusText");
  if (badge) {
    badge.classList.remove("up", "down", "unknown");
    const next = level === "up" || level === "down" ? level : "unknown";
    badge.classList.add(next);
    badge.textContent = next === "up" ? "鐎规瓕灏换娑㈠箳? : next === "down" ? "鐎殿喖鍊搁悥? : "闁哄牜浜ｇ换娑㈠箳?;
  }
  if (desc) desc.textContent = text || "-";
}

function updateRemoteControlButtons(connected) {
  const connectBtn = document.getElementById("remoteConnectBtn");
  const disconnectBtn = document.getElementById("remoteDisconnectBtn");
  if (connectBtn) connectBtn.disabled = !!connected;
  if (disconnectBtn) disconnectBtn.disabled = !connected;
}

function toggleRemoteFullscreen(force = null) {
  const wrap = document.getElementById("remoteDesktopWrap");
  const btn = document.getElementById("remoteFullscreenBtn");
  if (!wrap) return;
  const next = typeof force === "boolean" ? force : !wrap.classList.contains("fullscreen");
  wrap.classList.toggle("fullscreen", next);
  document.body.classList.toggle("remote-desktop-fullscreen", next);
  if (btn) btn.textContent = next ? "闂侇偀鍋撻柛鎴濇惈閸欏繒浠? : "闁稿繈鍔岄惈?;
  fitRemoteTerminal();
}

function handleRemoteHotkeys(event) {
  const visible = document.getElementById("remote-control")?.classList.contains("visible");
  if (!visible) return;
  const key = String(event.key || "").toLowerCase();
  const isKeyDown = event.type === "keydown";

  if (event.key === "Escape" && document.getElementById("remoteDesktopWrap")?.classList.contains("fullscreen")) {
    toggleRemoteFullscreen(false);
    return;
  }
  if (event.ctrlKey && event.shiftKey && key === "f") {
    event.preventDefault();
    toggleRemoteFullscreen();
    return;
  }
  if (!state.remoteConnected) return;

  const tag = String(event.target?.tagName || "").toLowerCase();
  const editable = tag === "input" || tag === "textarea" || tag === "select" || event.target?.isContentEditable;
  const canvasFocused = document.activeElement === remoteCanvas;
  const fullscreen = document.getElementById("remoteDesktopWrap")?.classList.contains("fullscreen");
  if (!canvasFocused && !fullscreen) return;
  if (editable) return;

  if (event.key === "Meta" || event.key === "Unidentified") return;
  event.preventDefault();
  sendRemoteDesktopInput({
    type: isKeyDown ? "key_down" : "key_up",
    key: String(event.key || ""),
    code: String(event.code || ""),
  });
}

function bindSSHRemoteActions() {
  document.getElementById("sshStartBtn")?.addEventListener("click", () => {
    connectSSHSession().catch((err) => {
      console.error("connect ssh session failed", err);
      showAppToast(err.message || "SSH 閺夆晝鍋炵敮瀛樺緞鏉堫偉袝", "error");
    });
  });
  document.getElementById("sshDisconnectBtn")?.addEventListener("click", () => disconnectSSHSession(true));
  document.getElementById("sshClearBtn")?.addEventListener("click", () => {
    sshTerminal?.clear();
    sshTerminal?.writeln("鐎圭寮剁粩鑽ょ矚閾忓湱鐭掔紒鏃戝灥缁额參宕欓幁鎺嗗亾?);
  });
}

async function ensureSSHTerminalReady() {
  if (sshTerminalInitialized && sshTerminal) {
    fitSSHTerminal();
    return;
  }
  const mount = document.getElementById("sshTerminal");
  const wrap = document.getElementById("sshTerminalWrap");
  if (!mount || !wrap) {
    throw new Error("SSH 缂備礁鐗忛顒傗偓鍦嚀濞呮帡寮甸鍛棟闁?);
  }

  sshTerminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.24,
    fontFamily: 'Consolas, "Liberation Mono", Menlo, monospace',
    convertEol: false,
    scrollback: 8000,
    theme: {
      background: "#071325",
      foreground: "#d9e8ff",
      cursor: "#8bd6ff",
      black: "#0b1a32",
      red: "#f67575",
      green: "#66d998",
      yellow: "#e7c178",
      blue: "#71b0ff",
      magenta: "#ba95ff",
      cyan: "#76d7e5",
      white: "#d9e8ff",
      brightBlack: "#355276",
      brightRed: "#ff8f8f",
      brightGreen: "#8de5b1",
      brightYellow: "#f0d59f",
      brightBlue: "#92c5ff",
      brightMagenta: "#d4bcff",
      brightCyan: "#a4ebf5",
      brightWhite: "#f2f7ff",
    },
  });
  sshFitAddon = new FitAddon();
  sshTerminal.loadAddon(sshFitAddon);
  sshTerminal.open(mount);
  sshTerminalInitialized = true;

  sshTerminal.onData((data) => {
    if (!data) return;
    if (!sshWS || sshWS.readyState !== WebSocket.OPEN || !state.sshConnected) return;
    sendSSHMessage({ type: "input", data });
  });
  sshTerminal.onResize(({ cols, rows }) => {
    if (!sshWS || sshWS.readyState !== WebSocket.OPEN || !state.sshConnected) return;
    sendSSHMessage({ type: "resize", cols, rows });
  });

  if (typeof ResizeObserver === "function") {
    sshResizeObserver = new ResizeObserver(() => fitSSHTerminal());
    sshResizeObserver.observe(wrap);
  }
  window.addEventListener("resize", fitSSHTerminal);

  fitSSHTerminal();
  sshTerminal.writeln("婵炲棎鍨肩换瀣媴鐠恒劍鏆?SSH 閺夆晜绮庨埢鑲╃磼閸埄浼傞柕鍡楀€搁敐鐐哄礃濞嗘帞绠鹃柟鎭掑劙娣囧﹪骞侀姘€甸柣鎰嚀閸ゎ噣鍨惧鍐；濠?SSH闁炽儲绺块埀?);
  updateSSHControlButtons();
}

function fitSSHTerminal() {
  try {
    sshFitAddon?.fit();
  } catch (_) {
    // ignore fit timing issues
  }
}

async function connectSSHSession() {
  await ensureSSHTerminalReady();
  if (state.sshConnecting || state.sshConnected) return;

  const host = getInputValue("sshHost");
  const username = getInputValue("sshUsername");
  const port = Number(getInputValue("sshPort") || 22);
  const password = String(document.getElementById("sshPassword")?.value || "");
  const privateKey = String(document.getElementById("sshPrivateKey")?.value || "");
  const passphrase = String(document.getElementById("sshPassphrase")?.value || "");

  if (!host) {
    showAppToast("閻犲洤鍢查敐鐐哄礃?SSH 濞戞挾绮┃鈧柛锔芥緲濞?, "warning");
    return;
  }
  if (!username) {
    showAppToast("閻犲洤鍢查敐鐐哄礃?SSH 闁活潿鍔嶉崺娑㈠触?, "warning");
    return;
  }
  if (!password.trim() && !privateKey.trim()) {
    showAppToast("閻犲洤鍢查敐鐐哄礃?SSH 閻庨潧妫涢悥婊堝箣閺嶎偒娼岄梺?, "warning");
    return;
  }

  sshManualClose = false;
  state.sshConnecting = true;
  state.sshConnected = false;
  setSSHConnectionStatus("unknown", "婵繐绲藉﹢顏勵嚈閾忓湱褰?SSH 閺夆晝鍋炵敮?..");
  updateSSHControlButtons();
  sshTerminal?.writeln(`\r\n[缂侇垵宕电划绡?婵繐绲藉﹢顏呮交閻愭潙澶?${username}@${host}:${Number.isFinite(port) ? port : 22} ...`);

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${location.host}/ws/remote/ssh`);
  sshWS = ws;

  let connectTimer = null;
  connectTimer = setTimeout(() => {
    if (sshWS !== ws) return;
    sshTerminal?.writeln("\r\n[缂侇垵宕电划绡?SSH 閺夆晝鍋炵敮瀵告惥閸涱喗顦ч柨娑樼焷椤曨剙螞閳ь剟寮婚妷褏绉圭紓浣圭矋閸ㄣ劎鎷嬮妶鍫㈡濞ｅ洠鍓濇导鍛村Υ?);
    ws.close();
  }, SSH_WS_CONNECT_TIMEOUT_MS);

  ws.addEventListener("open", () => {
    if (sshWS !== ws) return;
    sendSSHMessage({
      type: "connect",
      host,
      port: Number.isFinite(port) ? port : 22,
      username,
      password,
      private_key: privateKey,
      passphrase,
      cols: sshTerminal?.cols || 120,
      rows: sshTerminal?.rows || 36,
    });
  });

  ws.addEventListener("message", (event) => {
    if (sshWS !== ws) return;
    handleSSHMessage(event.data);
  });

  ws.addEventListener("close", () => {
    if (sshWS !== ws) return;
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    sshWS = null;
    const wasManual = sshManualClose;
    const hadConnection = state.sshConnected || state.sshConnecting;
    state.sshConnected = false;
    state.sshConnecting = false;
    updateSSHControlButtons();
    if (hadConnection) {
      setSSHConnectionStatus(wasManual ? "unknown" : "down", wasManual ? "鐎规瓕寮撶€靛矂宕濋妸锔界劷鐎殿喒鍋?SSH 濞村吋淇洪惁? : "SSH 濞村吋淇洪惁钘夘啅閸欏鐒界€殿喒鍋?);
      if (!wasManual) {
        sshTerminal?.writeln("\r\n[缂侇垵宕电划绡?SSH 濞村吋淇洪惁钘夘啅閸欏鐒界€殿喒鍋撻柕?);
      }
    }
  });

  ws.addEventListener("error", () => {
    if (sshWS !== ws) return;
    state.sshConnecting = false;
    state.sshConnected = false;
    updateSSHControlButtons();
    setSSHConnectionStatus("down", "SSH 閺夆晝鍋炵敮鏉戭嚕閸屾氨鍩楅柨娑樼焷椤曨剙螞閳ь剟寮婚妷褏绉圭紓浣圭矆缁楀瞼鎷嬮妶鍫㈡濞ｅ洠鍓濇导?);
  });
}

function disconnectSSHSession(showToast = false) {
  sshManualClose = true;
  const ws = sshWS;
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSSHMessage({ type: "disconnect" });
  }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close();
  }
  if (!ws) {
    state.sshConnected = false;
    state.sshConnecting = false;
    updateSSHControlButtons();
    setSSHConnectionStatus("unknown", "闁哄牜浜ｇ换娑㈠箳?);
  }
  if (showToast) showAppToast("SSH 濞村吋淇洪惁钘夘啅閸欏鐒界€殿喒鍋?, "success");
}

function handleSSHMessage(raw) {
  if (!sshTerminal) return;
  let payload = null;
  try {
    payload = JSON.parse(String(raw || ""));
  } catch (_) {
    sshTerminal.write(String(raw || ""));
    return;
  }
  const type = String(payload?.type || "").trim().toLowerCase();
  if (type === "output") {
    sshTerminal.write(String(payload?.data || ""));
    return;
  }
  if (type === "ready") {
    state.sshConnecting = false;
    state.sshConnected = true;
    updateSSHControlButtons();
    setSSHConnectionStatus("up", String(payload?.message || "SSH 閺夆晝鍋炵敮鎾箣閹邦剙顫?));
    sshTerminal.writeln(`\r\n[缂侇垵宕电划绡?${String(payload?.message || "SSH 閺夆晝鍋炵敮鎾箣閹邦剙顫?)}`);
    fitSSHTerminal();
    return;
  }
  if (type === "error") {
    state.sshConnecting = false;
    state.sshConnected = false;
    updateSSHControlButtons();
    const message = String(payload?.message || "SSH 鐎殿喖鍊搁悥?);
    setSSHConnectionStatus("down", message);
    sshTerminal.writeln(`\r\n[闂佹寧鐟ㄩ顦?${message}`);
    return;
  }
  if (type === "closed") {
    state.sshConnecting = false;
    state.sshConnected = false;
    updateSSHControlButtons();
    const message = String(payload?.message || "SSH 濞村吋淇洪惁钘夘啅閼碱剛娉㈤柡?);
    setSSHConnectionStatus("unknown", message);
    sshTerminal.writeln(`\r\n[缂侇垵宕电划绡?${message}`);
  }
}

function sendSSHMessage(payload) {
  if (!sshWS || sshWS.readyState !== WebSocket.OPEN) return;
  try {
    sshWS.send(JSON.stringify(payload));
  } catch (err) {
    console.error("send ssh websocket message failed", err);
  }
}

function setSSHConnectionStatus(level, text) {
  const badge = document.getElementById("sshStatusBadge");
  const desc = document.getElementById("sshStatusText");
  if (badge) {
    badge.classList.remove("up", "down", "unknown");
    const next = level === "up" || level === "down" ? level : "unknown";
    badge.classList.add(next);
    badge.textContent = next === "up" ? "鐎规瓕灏换娑㈠箳? : next === "down" ? "鐎殿喖鍊搁悥? : "闁哄牜浜ｇ换娑㈠箳?;
  }
  if (desc) desc.textContent = text || "-";
}

function updateSSHControlButtons() {
  const startBtn = document.getElementById("sshStartBtn");
  const disconnectBtn = document.getElementById("sshDisconnectBtn");
  if (startBtn) startBtn.disabled = state.sshConnecting || state.sshConnected;
  if (disconnectBtn) disconnectBtn.disabled = !state.sshConnecting && !state.sshConnected;
}

function bindSystemActions() {
  document.getElementById("runtimeLogRefreshBtn")?.addEventListener("click", () => loadRuntimeLogs(true));
  document.getElementById("runtimeLogKeyword")?.addEventListener("input", debounceRuntimeLogReload);
  document.getElementById("runtimeLogLevel")?.addEventListener("change", () => loadRuntimeLogs(true));
  document.getElementById("systemSaveBtn")?.addEventListener("click", saveSystemConfig);
}

async function loadDockerDashboard(force = false) {
  await loadDockerStatus(force);
  await loadDockerContainers(force);
  if (state.dockerTab === "images") {
    await loadDockerImages(force);
  }
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
      showAppToast(data.error || "闁告梻濮惧ù?Docker 闁绘鍩栭埀顑跨閵囨垹鎷?, "error");
      return state.dockerStatus;
    }
  } catch (err) {
    console.error("load docker status failed", err);
    showAppToast("闁告梻濮惧ù?Docker 闁绘鍩栭埀顑跨閵囨垹鎷?, "error");
    return state.dockerStatus;
  }
  state.dockerStatus = data || null;
  renderDockerStatusSummary();
  return state.dockerStatus;
}

async function loadDockerContainers(force = false) {
  const scope = document.getElementById("dockerScope")?.value || "all";
  const keyword = String(document.getElementById("dockerSearch")?.value || "").trim();
  const all = scope !== "running";
  let data = null;

  try {
    const query = new URLSearchParams({
      all: all ? "1" : "0",
      page: String(Math.max(1, Number(state.dockerPage || 1))),
      page_size: String(Math.max(1, Number(state.dockerPageSize || 20))),
      keyword,
    });
    const res = await fetchWithTimeout(`/api/docker/containers?${query.toString()}`, 20000);
    data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
      return state.dockerContainers;
    }
  } catch (err) {
    console.error("load docker containers failed", err);
    showAppToast("闁告梻濮惧ù鍥┾偓鍦嚀濞呮帡宕氬Δ鍕┾偓鍐╁緞鏉堫偉袝", "error");
    return state.dockerContainers;
  }

  if (data?.status) {
    state.dockerStatus = data.status;
  }
  renderDockerStatusSummary();

  state.dockerContainers = Array.isArray(data?.items) ? data.items : [];
  state.dockerTotal = Number(data?.total || 0);
  state.dockerPageSize = Number(data?.page_size || state.dockerPageSize || 20);
  state.dockerPage = Number(data?.page || state.dockerPage || 1);
  state.dockerTotalPages = Number(data?.total_pages || 0);
  renderDockerContainerTable();
  renderDockerPagination();
  return state.dockerContainers;
}

function renderDockerStatusSummary() {
  const el = document.getElementById("dockerStatusSummary");
  if (!el) return;
  const st = state.dockerStatus || {};
  if (!st.installed) {
    el.textContent = "Docker 闁哄牜浜滈悾銊ф啑閸涱喖鐏楀☉鎾崇Т瑜版煡鎮介妸锝傚亾閸屾氨鏆旈悷?Docker Desktop / Docker Engine 闁告艾楠稿畵鍡涘矗椤栨粠鍚€闁荤偛妫楅鎰板闯閵婏絺鍋?;
    return;
  }
  if (!st.daemon_running) {
    const context = st.context ? `鐟滅増鎸告晶鐘崇▔婵犱胶鐟撻柡?${st.context}` : "";
    el.textContent = ["Docker 闁哄牆绉存慨鐔煎嫉椤忓嫭鍎欓柛鏂诲妽閸ㄣ劑寮甸鍥╃闁规亽鍎埀?, context].filter(Boolean).join(" ");
    return;
  }
  const parts = [];
  if (st.version) parts.push(`閻庡箍鍨洪崺娑氱博?${st.version}`);
  if (st.server_version) parts.push(`闁哄牆绉存慨鐔虹博?${st.server_version}`);
  if (st.context) parts.push(`濞戞挸锕ｇ粭鍛村棘?${st.context}`);
  if (st.platform) parts.push(`妤犵偛鍟胯ぐ?${st.platform}`);
  el.textContent = parts.length ? parts.join(" | ") : "Docker 閺夆晜鍔橀、鎴濐潰閿濆懐鍩?;
}

function renderDockerContainerTable() {
  const list = Array.isArray(state.dockerContainers) ? state.dockerContainers : [];
  renderDockerKPIs(list);

  const rows = list.map((item) => {
    const running = String(item.state || "").toLowerCase() === "running" || String(item.status || "").toLowerCase().includes("up ");
    const statusHTML = `<span class="badge ${running ? "up" : "down"}">${escapeHTML(item.status || item.state || "-")}</span>`;
    const id = escapeHTML(String(item.id || ""));
    const actions = running
      ? [
          `<button class="btn sm docker-action" data-docker-cmd="restart" data-id="${id}" data-name="${escapeHTML(item.name || "")}">闂佹彃绉撮幆?/button>`,
          `<button class="btn sm danger docker-action" data-docker-cmd="stop" data-id="${id}" data-name="${escapeHTML(item.name || "")}">闁稿绮嶉?/button>`,
        ]
      : [
          `<button class="btn sm docker-action" data-docker-cmd="start" data-id="${id}" data-name="${escapeHTML(item.name || "")}">闁告凹鍨版慨?/button>`,
          `<button class="btn sm danger docker-action" data-docker-cmd="remove" data-id="${id}" data-name="${escapeHTML(item.name || "")}">闁告帞濞€濞?/button>`,
        ];
    actions.push(`<button class="btn sm docker-action" data-docker-cmd="logs" data-id="${id}" data-name="${escapeHTML(item.name || "")}">闁哄啨鍎辩换?/button>`);
    actions.push(`<button class="btn sm docker-action" data-docker-cmd="inspect" data-id="${id}" data-name="${escapeHTML(item.name || "")}">閻犲浄闄勯崕?/button>`);

    return [
      `<input type="checkbox" class="docker-container-select" value="${id}" ${state.dockerSelectedContainerIDs.includes(String(item.id || "")) ? "checked" : ""}>`,
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
    rows.push(["-", "-", "-", "-", "<span class=\"badge unknown\">闁哄啰濮甸弳鐔煎箲?/span>", "-", "-", "鐟滅増鎸告晶鐘诲级閳ュ弶顐藉☉鎾愁儐閻ュ懘寮垫径濠庡晣闁?]);
  }
  renderTable("dockerContainerTable", ["闂侇偄顦扮€?, "閻庡湱鎳撳▍鎺楀触?, "ID", "闂傗偓濠婂啫鍓?, "闁绘鍩栭埀?, "閺夆晜鍔橀、鎴﹀籍閸洘锛?, "缂佹棏鍨拌ぐ娑㈠及閻樿尙娈?, "闁瑰灝绉崇紞?], rows, true);
  syncDockerSelections();
}

function renderDockerPagination() {
  const infoEl = document.getElementById("dockerPageInfo");
  const totalEl = document.getElementById("dockerTotalInfo");
  const prevBtn = document.getElementById("dockerPrevBtn");
  const nextBtn = document.getElementById("dockerNextBtn");
  const pageSizeSelect = document.getElementById("dockerPageSize");

  if (pageSizeSelect) {
    pageSizeSelect.value = String(state.dockerPageSize || 20);
  }
  if (infoEl) {
    const page = Number(state.dockerPage || 1);
    const totalPages = Number(state.dockerTotalPages || 0);
    infoEl.textContent = totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0";
  }
  if (totalEl) {
    totalEl.textContent = `闁?${num(state.dockerTotal || 0)} 濞戞搩浜滈鎰板闯閳?
  }
  if (prevBtn) prevBtn.disabled = Number(state.dockerPage || 1) <= 1;
  if (nextBtn) nextBtn.disabled = Number(state.dockerTotalPages || 0) <= 0 || Number(state.dockerPage || 1) >= Number(state.dockerTotalPages || 0);
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
  if (event.target.closest(".docker-container-select")) {
    syncDockerSelections();
    return;
  }
  const btn = event.target.closest("button[data-docker-cmd]");
  if (!btn) return;

  const cmd = String(btn.dataset.dockerCmd || "").trim().toLowerCase();
  const id = String(btn.dataset.id || "").trim();
  const name = String(btn.dataset.name || "").trim() || id;
  if (!cmd || !id) return;

  if (cmd === "logs") {
    openDockerLogStream(id, name);
    return;
  }

  if (cmd === "inspect") {
    try {
      const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/inspect`, 20000);
      const data = await res.json();
      if (!res.ok) {
        showAppToast(data.error || "闁瑰嘲顦ぐ鍥┾偓鍦嚀濞呮帞鎷犻敂钘夊壈濠㈡儼绮剧憴?, "error");
        return;
      }
      const text = JSON.stringify(data.inspect || {}, null, 2);
      openModal(`閻庡湱鎳撳▍鎺旀嫚閿旇棄鍓?- ${name}`, `<pre class="log-view compact">${escapeHTML(text)}</pre>`);
    } catch (err) {
      console.error("fetch container inspect failed", err);
      showAppToast("闁瑰嘲顦ぐ鍥┾偓鍦嚀濞呮帞鎷犻敂钘夊壈濠㈡儼绮剧憴?, "error");
    }
    return;
  }

  if (cmd === "remove") {
    const choice = await promptDockerRemoveOptions(name);
    if (!choice?.confirmed) return;
    await executeDockerAction(id, name, cmd, { removeVolumes: !!choice.removeVolumes });
    return;
  }

  await executeDockerAction(id, name, cmd, {});
}

async function executeDockerAction(id, name, cmd, options = {}) {
  try {
    const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/action`, 30000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: cmd, remove_volumes: !!options.removeVolumes }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "閻庡湱鎳撳▍鎺楀箼瀹ュ嫮绋婂鎯扮簿鐟?, "error");
      return;
    }
    if (cmd === "remove") {
      showAppToast(`閻庡湱鎳撳▍?${name} 闁告帞濞€濞呭酣骞嬮幇顒€顫?{options.removeVolumes ? "闁挎稑鐗嗛崙锟犲礆閻樼粯鐝熼柡浣哄瀹撲線宕￠崙銈囩" : ""}`, "success");
    } else {
      showAppToast(`閻庡湱鎳撳▍?${name} ${cmd} 闁瑰瓨鍔曟慨娌? "success");
    }
    await loadDockerContainers(true);
  } catch (err) {
    console.error("docker action failed", err);
    showAppToast("閻庡湱鎳撳▍鎺楀箼瀹ュ嫮绋婂鎯扮簿鐟?, "error");
  }
}

function promptDockerRemoveOptions(name) {
  return new Promise((resolve) => {
    let settled = false;
    const html = `
      <section class="docker-remove-dialog">
        <p class="docker-remove-title">缁绢収鍠涢濠氬礆閻樼粯鐝熼悗鍦嚀濞呮帡濡?{escapeHTML(name)}闁靛棗绋勭槐?/p>
        <label class="docker-remove-volume">
          <input id="dockerRemoveVolumes" type="checkbox" />
          <span>闁告艾鏈鍌炲礆閻樼粯鐝熼柡浣哄瀹撲線宕￠崙銈囩閻犲鍔嶉崢褔骞欏鍕▕闁?/span>
        </label>
        <div class="docker-remove-actions">
          <button id="dockerCancelRemoveBtn" class="btn sm" type="button">闁告瑦鐗楃粔?/button>
          <button id="dockerConfirmRemoveBtn" class="btn sm danger" type="button">缁绢収鍠涢濠氬礆閻樼粯鐝?/button>
        </div>
      </section>
    `;
    openModal("闁告帞濞€濞呭海鈧湱鎳撳▍鎺旀兜椤旀鍚?, html);

    const confirmBtn = document.getElementById("dockerConfirmRemoveBtn");
    const cancelBtn = document.getElementById("dockerCancelRemoveBtn");
    const removeVolumesInput = document.getElementById("dockerRemoveVolumes");
    const closeBtn = document.getElementById("modalCloseBtn");
    const mask = document.getElementById("modalMask");

    const cleanup = () => {
      confirmBtn?.removeEventListener("click", onConfirm);
      cancelBtn?.removeEventListener("click", onCancel);
      closeBtn?.removeEventListener("click", onClose);
      mask?.removeEventListener("click", onMask);
    };

    const finish = (confirmed, removeVolumes) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ confirmed: !!confirmed, removeVolumes: !!removeVolumes });
    };

    const onConfirm = () => {
      const removeVolumes = !!removeVolumesInput?.checked;
      closeModal();
      finish(true, removeVolumes);
    };
    const onCancel = () => {
      closeModal();
      finish(false, false);
    };
    const onClose = () => {
      finish(false, false);
    };
    const onMask = (event) => {
      if (event.target?.id === "modalMask") {
        finish(false, false);
      }
    };

    confirmBtn?.addEventListener("click", onConfirm);
    cancelBtn?.addEventListener("click", onCancel);
    closeBtn?.addEventListener("click", onClose);
    mask?.addEventListener("click", onMask);
  });
}

function openDockerLogStream(containerID, containerName) {
  stopDockerLogStream();
  state.dockerLogContainerID = String(containerID || "").trim();
  state.dockerLogContainerName = String(containerName || "").trim() || state.dockerLogContainerID;
  if (!state.dockerLogContainerID) return;

  const html = `
    <section class="docker-log-modal">
      <div class="docker-log-toolbar">
        <span class="hint">閻庡湱鍋炲鍌炲籍閵夈儳绠舵繝濠冭壘婵晜绋夐銊х婵?2 缂佸甯掗崺娑㈠棘鐢喚绀?/span>
        <button id="dockerLogStopBtn" class="btn sm danger" type="button">闁稿绮嶉娑氣偓鍦仦濡?/button>
      </div>
      <pre id="dockerLogViewer" class="log-view compact docker-log-viewer">婵繐绲藉﹢顏堝礉閻樼儤绁伴柡鍐﹀劚缁?..</pre>
    </section>
  `;
  openModal(`閻庡湱鎳撳▍鎺楀籍閵夈儳绠?- ${state.dockerLogContainerName}`, html);
  document.getElementById("dockerLogStopBtn")?.addEventListener("click", () => {
    stopDockerLogStream();
    showAppToast("鐎瑰憡褰冩禒鐘差潰閵忕姷鏉介柡鍐煐濡晞绠涘Δ浣烘硦闁?, "info");
  });

  const poll = async () => {
    const id = state.dockerLogContainerID;
    if (!id) return;
    try {
      const res = await fetchWithTimeout(`/api/docker/containers/${encodeURIComponent(id)}/logs?tail=500`, 25000);
      const data = await res.json();
      if (!res.ok) {
        showAppToast(data.error || "闁瑰嘲顦ぐ鍥┾偓鍦嚀濞呮帡寮妷銉х濠㈡儼绮剧憴?, "error");
        return;
      }
      const viewer = document.getElementById("dockerLogViewer");
      if (!viewer) return;
      viewer.textContent = data.logs || "闁哄棗鍊瑰Λ銈夊籍閵夈儳绠?;
      viewer.scrollTop = viewer.scrollHeight;
    } catch (err) {
      if (err && String(err.message || "").toLowerCase().includes("unauthorized")) return;
      console.error("poll docker logs failed", err);
    }
  };

  poll();
  state.dockerLogTimer = setInterval(poll, 2000);
}

function stopDockerLogStream() {
  if (state.dockerLogTimer) {
    clearInterval(state.dockerLogTimer);
    state.dockerLogTimer = null;
  }
  state.dockerLogContainerID = "";
  state.dockerLogContainerName = "";
}

function setCleanupScanRunning(running) {
  const scanBtn = document.getElementById("cleanupScanBtn");
  const stopScanBtn = document.getElementById("cleanupStopScanBtn");
  const active = !!running;

  if (scanBtn) {
    scanBtn.dataset.running = active ? "1" : "0";
    scanBtn.textContent = active ? "闁规鍋呭鎸庣▔?.." : "鐎殿喒鍋撳┑顔碱儐婢瑰倿骞?;
    scanBtn.disabled = active;
  }
  if (stopScanBtn) {
    stopScanBtn.disabled = !active;
  }
  if (!active) {
    updateCleanupScanProgress({ finished: true, scanned_files: state.cleanupScan?.scanned_files || 0, matched_files: state.cleanupScan?.matched_files || 0 });
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
      showAppToast(data.error || "闁告梻濮惧ù鍥极閻楀牆绁︽繛鎾虫噽閹﹪鏌婂鍥╂瀭濠㈡儼绮剧憴?, "error");
      return state.cleanupMeta;
    }
  } catch (err) {
    console.error("ensure cleanup meta failed", err);
    showAppToast("闁告梻濮惧ù鍥极閻楀牆绁︽繛鎾虫噽閹﹪鏌婂鍥╂瀭濠㈡儼绮剧憴?, "error");
    return state.cleanupMeta;
  }

  state.cleanupMeta = data;
  renderCleanupRootOptions(data.root_options || buildCleanupRootOptions(data.default_roots || [], data.os || ""));
  renderCleanupCustomRoots();

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
  const name = String(indexer?.name || "闁告劕鎳愰悿鍡楊嚕閺囩喐鎯?);
  tag.classList.toggle("slow", !available);
  tag.textContent = available ? `${name} 闁告梻濞€閳ь剛鍠撻崒銊ヮ嚕閺?: "闁告劕鎳愰悿鍡涘箥椤愶絽浼庣€殿喗娲橀幖?;
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
    box.innerHTML = '<span class="hint">闁哄牜浜滆ぐ鍌炴偝閺夊灝璁查柣顫妼閸ㄥ酣宕犻搹瑙勭獥鐟?/span>';
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

function renderCleanupCustomRoots() {
  const box = document.getElementById("cleanupCustomRootList");
  if (!box) return;
  const roots = Array.isArray(state.cleanupCustomRoots) ? state.cleanupCustomRoots : [];
  if (!roots.length) {
    box.innerHTML = '<span class="hint">闁告瑯鍨辨晶婊堝礉閵婏箑娼戦柛鏃傚С閹广垽骞囪箛鏇熺獥鐟滅増娲栧顒佺▔鎼淬垹顥囬柟?/span>';
    return;
  }
  box.innerHTML = roots
    .map((path) => {
      const p = String(path || "").trim();
      if (!p) return "";
      return `
        <label class="cleanup-custom-root-item" title="${escapeHTML(p)}">
          <span>${escapeHTML(p)}</span>
          <button class="btn sm danger cleanup-remove-root-btn" type="button" data-path="${escapeHTML(p)}">缂佸顭峰▍?/button>
        </label>
      `;
    })
    .join("");
}

function addCleanupCustomRoot() {
  const input = document.getElementById("cleanupCustomRoot");
  const raw = String(input?.value || "").trim();
  const path = normalizeCleanupPath(raw);
  if (!path) {
    showAppToast("閻犲洨鏌夌欢顓㈠礂閵夛附绠掗柡浣哥墢濞叉媽銇愰弴锛勭唴鐎?, "warning");
    return;
  }
  const roots = selectedCleanupRoots(true);
  const key = cleanupPathKey(path);
  const exists = roots.some((item) => cleanupPathKey(item) === key);
  if (exists) {
    showAppToast("閻犲洢鍎冲ú鎷屻亹閺囩偛鍤掗柛锔哄妽婢瑰倿骞撹箛鎾崇仚閻炴稏鍔嬮懙?, "info");
    if (input) input.value = "";
    return;
  }
  state.cleanupCustomRoots.push(path);
  renderCleanupCustomRoots();
  if (input) input.value = "";
  showAppToast(`鐎圭寮堕崸濠囧礉閻樺灚绐楃憸鐗堟穿缁?{path}`, "success");
}

function removeCleanupCustomRoot(path) {
  const key = cleanupPathKey(path);
  const before = Array.isArray(state.cleanupCustomRoots) ? state.cleanupCustomRoots : [];
  state.cleanupCustomRoots = before.filter((item) => cleanupPathKey(item) !== key);
  renderCleanupCustomRoots();
}

function normalizeCleanupPath(raw) {
  let text = String(raw || "").trim();
  if (!text) return "";
  text = text.replace(/^["']+|["']+$/g, "");
  if (/^[a-zA-Z]:$/.test(text)) {
    text += "\\";
  }
  text = text.replace(/[\\/]+$/, (m) => (m.includes("\\") ? "\\" : "/"));
  return text.trim();
}

function cleanupPathKey(path) {
  const p = String(path || "").trim();
  if (!p) return "";
  if (/^[a-zA-Z]:/.test(p) || p.includes("\\")) {
    return p.toLowerCase();
  }
  return p;
}

function selectedCleanupRoots(includeCustom = true) {
  const roots = Array.from(document.querySelectorAll(".cleanup-root-item:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
  if (!includeCustom) {
    return roots;
  }
  const custom = Array.isArray(state.cleanupCustomRoots) ? state.cleanupCustomRoots : [];
  const merged = roots.concat(custom);
  const out = [];
  const seen = new Set();
  merged.forEach((item) => {
    const p = String(item || "").trim();
    if (!p) return;
    const key = cleanupPathKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  });
  return out;
}

function cleanupThresholdBytes() {
  const input = document.getElementById("cleanupLargeThresholdGB");
  const gb = Number(String(input?.value || "").trim());
  if (!Number.isFinite(gb) || gb <= 0) return 1024 ** 3;
  return Math.round(gb * 1024 * 1024 * 1024);
}

async function runCleanupScan() {
  if (state.cleanupScanJobId) return;

  const meta = await ensureCleanupMeta(false);
  const effectiveRoots = selectedCleanupRoots();
  if (!effectiveRoots.length) {
    showAppToast("閻犲洨鏌夐崵锔句焊閹达腹鍋撴径瀣仴濞戞挴鍋撳☉鎿冧簼婢瑰倿骞撹箛鏇熺獥鐟?, "warning");
    return;
  }

  const query = String(document.getElementById("cleanupSearch")?.value || "").trim();

  try {
    setCleanupScanRunning(true);
    updateCleanupScanProgress({ running: true, scanned_files: 0, matched_files: 0 });
    setText("cleanupSummary", "婵繐绲藉﹢顏堝箥椤愶絽浼庨柨娑樼焷椤曨剛绮欏鍛亾?..");

    const res = await fetch("/api/cleanup/scan-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      showAppToast(data.error || "闁烩晩鍠栫紞宥夊箥椤愶絽浼庡鎯扮簿鐟?, "error");
      setText("cleanupSummary", "闁规鍋呭鎸庡緞鏉堫偉袝");
      return;
    }
    state.cleanupScanJobId = String(data.job_id || "");
    startCleanupScanPolling(meta);
  } catch (err) {
    console.error("cleanup scan failed", err);
    showAppToast("闁烩晩鍠栫紞宥夊箥椤愶絽浼庡鎯扮簿鐟?, "error");
    setText("cleanupSummary", "闁规鍋呭鎸庡緞鏉堫偉袝");
  } finally {
  }
}

function stopCleanupScan() {
  const jobID = String(state.cleanupScanJobId || "").trim();
  if (!jobID) {
    showAppToast("鐟滅増鎸告晶鐘测柦閳╁啯绠掗弶鈺傜椤㈡垶绋夐鐘崇暠闁规鍋呭?, "warning");
    return;
  }
  fetch(`/api/cleanup/scan-jobs/${encodeURIComponent(jobID)}/cancel`, { method: "POST" }).catch((err) => {
    console.error("cancel cleanup scan failed", err);
  });
  stopCleanupScanPolling();
  state.cleanupScanJobId = "";
  setCleanupScanRunning(false);
  setText("cleanupSummary", "闁规鍋呭鍧楀磻濠婂嫷鍓惧☉?..");
}

function startCleanupScanPolling(meta) {
  stopCleanupScanPolling();
  const poll = async () => {
    const jobID = String(state.cleanupScanJobId || "").trim();
    if (!jobID) return;
    try {
      const res = await fetchWithTimeout(`/api/cleanup/scan-jobs/${encodeURIComponent(jobID)}`, 12000);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "load scan progress failed");
      }
      state.cleanupScanProgress = data.progress || null;
      updateCleanupScanProgress(data.progress || {});
      if (data.result) {
        state.cleanupScan = data.result || {};
        applyCleanupFilterAndRender();
      }
      if (data.status === "done" || data.status === "cancelled") {
        stopCleanupScanPolling();
        state.cleanupScanJobId = "";
        setCleanupScanRunning(false);
        setCleanupIndexerTag(meta?.fast_indexer || state.cleanupMeta?.fast_indexer || null);
        showAppToast(data.status === "done" ? "闁规鍋呭璺ㄢ偓鐟版湰閸? : "闁规鍋呭鍨啅閹绘帊绮绘慨?, data.status === "done" ? "success" : "info");
      }
    } catch (err) {
      console.error("poll cleanup scan failed", err);
      stopCleanupScanPolling();
      setCleanupScanRunning(false);
      showAppToast("闁规鍋呭鎸庢交濞戞ê顔婇柤鎯у槻瑜板洦寰勬潏顐バ?, "error");
    }
  };
  poll();
  state.cleanupScanPollTimer = setInterval(poll, 900);
}

function stopCleanupScanPolling() {
  if (!state.cleanupScanPollTimer) return;
  clearInterval(state.cleanupScanPollTimer);
  state.cleanupScanPollTimer = null;
}

function updateCleanupScanProgress(progress = {}) {
  const bar = document.getElementById("cleanupScanProgressBar");
  const text = document.getElementById("cleanupScanProgressText");
  if (!bar || !text) return;
  const running = !!progress.running || !!state.cleanupScanJobId;
  const finished = !!progress.finished || (!running && !state.cleanupScanJobId);
  const scanned = Number(progress.scanned_files || 0);
  const matched = Number(progress.matched_files || 0);
  const ratioBase = Math.max(1, scanned + matched + Number(progress.large_files || 0));
  const width = finished ? 100 : Math.min(92, 8 + (ratioBase % 84));
  bar.style.width = `${width}%`;
  bar.classList.toggle("done", finished);
  text.textContent = finished
    ? `闁规鍋呭璺ㄢ偓鐟版湰閸?| 鐎圭寮舵竟鍌炲棘閸ワ附顐?${num(scanned)} | 闁告稒鍨濋懙?${num(matched)}`
    : `闁规鍋呭鎸庣▔?| 鐟滅増鎸告晶鐘绘儎椤旇偐绉?${progress.current_root || "-"} | 鐎圭寮舵竟鍌炲棘閸ワ附顐?${num(scanned)} | 闁告稒鍨濋懙?${num(matched)}`;
}

function stopCleanupGarbage() {
  const controller = state.cleanupGarbageAbortController;
  if (!controller) {
    showAppToast("鐟滅増鎸告晶鐘测柦閳╁啯绠掗弶鈺傜椤㈡垶绋夐鐘崇暠婵炴挸鎳愰幃?, "warning");
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

  renderTable("cleanupFileList", ["閹兼潙绻愯ぐ?, "缂侇偉顕ч悗?, "濞ｅ浂鍠楅弫濂稿籍閸洘锛?, "濠㈠爢鍐瘓", "濠㈠爢鍐瘓闁告濮甸惁?, "閻庣懓鏈弳锝囨崉椤栨氨绐?], fileRows);
  renderTable("cleanupLargeFileList", ["閹兼潙绻愯ぐ?, "缂侇偉顕ч悗?, "濞ｅ浂鍠楅弫濂稿籍閸洘锛?, "濠㈠爢鍐瘓", "濠㈠爢鍐瘓闁告濮甸惁?, "閻庣懓鏈弳锝囨崉椤栨氨绐?], largeRows);
  renderCleanupTopBars(filtered, Number(scan.matched_total_bytes || scan.total_bytes || 0));
  renderCleanupSummaryTables(scan);
  renderCleanupCharts(scan);
  updateCleanupKpi(scan, filtered, largeFiltered, threshold);

  const rootsText = (scan.roots || []).join(" , ") || "-";
  const msg = [
    `闁规鍋呭鍧楁儎椤旇偐绉? ${rootsText}`,
    `鐎圭寮舵竟鍌炲棘閸ワ附顐? ${num(scan.scanned_files || 0)}`,
    `闁告稒鍨濋懙? ${num(scan.matched_files || 0)}`,
    `闁肩増顨嗗? ${num(scan.duration_ms || 0)}ms`,
    `鐟滅増鎸告晶鐘电驳濞戔懇鍋? ${num(filtered.length)} 闁哄鎽?
    `濠㈠爢鍕€ù?>=${(threshold / 1024 / 1024 / 1024).toFixed(2)}GB): ${num(largeFiltered.length)} 闁哄鎽?
  ];
  if (scan.truncated) msg.push("缂佷究鍨圭槐鈺侇啅閸欏鐦诲ù锝嗘尵琚ч柟鎼簼閺?);
  if (scan.cancelled) msg.push("闁规鍋呭鍨啅閹绘帊绮绘慨?);
  if (Array.isArray(scan.errors) && scan.errors.length) msg.push(`闁哄鍟村?閻犱礁娼″Λ璺侯嚕閸屾氨鍩? ${scan.errors[0]}`);
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
    thresholdInput.title = `鐟滅増鎸告晶鐘冲緞瑜庨弸鍐╃閸洘顫岄柛?${gb.toFixed(2)} GB`;
  }
}

function renderCleanupTopBars(files, totalBytes) {
  const box = document.getElementById("cleanupTopBars");
  if (!box) return;

  const list = Array.isArray(files) ? files.slice(0, 42) : [];
  const base = Number(totalBytes || 0) > 0 ? Number(totalBytes) : Number(list.reduce((sum, x) => sum + Number(x.size || 0), 0));
  if (!list.length || base <= 0) {
    box.innerHTML = '<p class="hint">闁规鍋呭璺ㄢ偓鐟版湰閸ㄦ岸宕ユ惔銏♀枖缂佲偓鏉炴壆绉肩紒澶樺灣閸庡綊宕?/p>';
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
  renderTable("cleanupDirSummaryList", ["闁烩晩鍠栫紞?, "闁哄倸娲ｅ▎銏ゅ极?, "闁告濮烽弫?, "闁告濮甸惁?], dirRows);

  const typeRows = (Array.isArray(scan.type_summary) ? scan.type_summary : []).slice(0, 200).map((item) => [
    item.type || "none",
    num(item.file_count || 0),
    bytes(item.size || 0),
    `${Number(item.size_ratio || 0).toFixed(2)}%`,
  ]);
  renderTable("cleanupTypeSummaryList", ["缂侇偉顕ч悗?, "闁哄倸娲ｅ▎銏ゅ极?, "闁告濮烽弫?, "闁告濮甸惁?], typeRows);
}

function renderCleanupCharts(scan) {
  renderSimpleRatioChart("cleanupDirChart", Array.isArray(scan.directory_summary) ? scan.directory_summary.slice(0, 8).map((item) => ({
    label: item.path || "-",
    ratio: Number(item.size_ratio || 0),
  })) : []);
  renderSimpleRatioChart("cleanupTypeChart", Array.isArray(scan.type_summary) ? scan.type_summary.slice(0, 8).map((item) => ({
    label: item.type || "none",
    ratio: Number(item.size_ratio || 0),
  })) : []);
}

function renderSimpleRatioChart(id, items) {
  const box = document.getElementById(id);
  if (!box) return;
  const list = (items || []).filter((item) => Number(item.ratio || 0) > 0);
  if (!list.length) {
    box.innerHTML = '<div class="hint">闁哄棗鍊瑰Λ銈夊础閻樺磭妲烽柛銉﹀礃閵?/div>';
    return;
  }
  box.innerHTML = list
    .map((item, idx) => {
      const hue = (idx * 41) % 360;
      return `
        <div class="ratio-chart-item">
          <span class="ratio-chart-label">${escapeHTML(shorten(item.label || "-", 28))}</span>
          <span class="ratio-chart-bar"><i style="width:${Math.max(6, Number(item.ratio || 0)).toFixed(2)}%;background:hsl(${hue} 68% 52%)"></i></span>
          <span class="ratio-chart-value">${Number(item.ratio || 0).toFixed(2)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderCleanupGarbageTargets(targets) {
  const box = document.getElementById("cleanupGarbageTargets");
  if (!box) return;

  const list = Array.isArray(targets) ? targets : [];
  if (!list.length) {
    box.innerHTML = '<span class="hint">闁哄棗鍊瑰Λ銈夊矗椤栨粍鏆忔繛鎾虫噽閹﹪鎯勯鐣屽灱</span>';
    return;
  }

  box.innerHTML = list
    .map((item) => {
      const checked = item.enabled ? "checked" : "";
      const disabled = item.exists ? "" : "disabled";
      const title = `${item.name} (${item.path})`;
      return `<label title="${escapeHTML(title)}"><input type="checkbox" class="cleanup-target-item" value="${escapeHTML(item.id)}" ${checked} ${disabled}>${escapeHTML(item.name)} [濞ｅ洦绻勯弳鈧?{num(item.keep_hours || 0)}h]</label>`;
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
    showAppToast("閻犲洨鏌夐崵锔句焊閹存繂鐟庨梺顐㈩槷缁斿瓨绋夐鍛伕闁荤偛妫涘ú浼村冀?, "warning");
    return;
  }

  if (!dryRun) {
    const ok = confirm("閻忓繐妫欑€垫粎鈧懓顦崣蹇曠驳閺嶎偅娈ｉ柛鎺斿█濞呭酣鎯勯鐣屽灱闁烩晩鍠栫紞宥嗙▔椤撶姵鐣遍柡鍐勫懐澶勯悗?濞戞挸鐡ㄥ?闁哄啨鍎辩换鏃堝棘閸ワ附顐介柨娑樻湰濡叉悂宕ラ敂鐐煕缂備緡鍙忕槐?);
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
    setText("cleanupGarbageSummary", dryRun ? "婵繐绲藉﹢顏咃紣閸曨亜寮烽柛娆樺灡缁斿鎮堕崱妯荤€ù?.." : "婵繐绲藉﹢顏堝箥瑜戦、鎴濄€掗崨顖涘€?..");

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
      showAppToast(data.error || "婵炴挸鎳愰幃濠囧箥瑜戦、鎴炲緞鏉堫偉袝", "error");
      setText("cleanupGarbageSummary", "婵炴挸鎳愰幃濠冨緞鏉堫偉袝");
      return;
    }

    renderCleanupGarbageResult(data);
    const summary = [
      dryRun ? "濡澘瀚崣濠勨偓鐟版湰閸? : "婵炴挸鎳愰幃濠勨偓鐟版湰閸?,
      `闁稿﹥鐟╅埀? ${num(data.total_candidate_files || 0)} 闁哄倸娲ｅ▎顣?
      `闁稿﹥鐟╅埀顒€顦紞瀣矓? ${bytes(data.total_candidate_bytes || 0)}`,
      `鐎圭寮剁粩濠氭偠? ${num(data.total_deleted_files || 0)} 闁哄倸娲ｅ▎顣?
      `鐎圭寮剁粩濠氭偠閸℃洜绉肩紒? ${bytes(data.total_deleted_bytes || 0)}`,
      `濠㈡儼绮剧憴? ${num(data.total_failed_files || 0)}`,
    ];
    if (data.cancelled) summary.push("闁瑰灝绉崇紞鏂款啅閹绘帊绮绘慨?);
    setText("cleanupGarbageSummary", summary.join(" | "));

    if (dryRun) {
      showAppToast("濡澘瀚崣濠勨偓鐟版湰閸?, "success");
      return;
    }

    showAppToast(`婵炴挸鎳愰幃濠勨偓鐟版湰閸ㄦ岸鏁嶇仦钘夊殥闁告帞濞€濞?${num(data.total_deleted_files || 0)} 濞戞搩浜濋弸鍐╃缁? "success");
    if (state.cleanupScan) {
      runCleanupScan();
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      setText("cleanupGarbageSummary", "婵炴挸鎳愰幃濠傤啅閹绘帊绮绘慨?);
      showAppToast("婵炴挸鎳愰幃濠傤啅閹绘帊绮绘慨?, "info");
      return;
    }
    console.error("cleanup garbage failed", err);
    showAppToast("婵炴挸鎳愰幃濠囧箥瑜戦、鎴炲緞鏉堫偉袝", "error");
    setText("cleanupGarbageSummary", "婵炴挸鎳愰幃濠冨緞鏉堫偉袝");
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
  renderTable("cleanupGarbageResult", ["闁烩晩鍠楅悥?, "闁稿﹥鐟╅埀顒€顦伴弸鍐╃?, "闁稿﹥鐟╅埀顒€顦紞瀣矓?, "鐎圭寮剁粩濠氭偠閸℃ɑ鐎ù?, "鐎圭寮剁粩濠氭偠閸℃洜绉肩紒?, "濠㈡儼绮剧憴锕傚极?, "闁烩晩鍠栫紞?], rows);
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
  state.dockerPageSize = Number(state.config?.system?.performance?.docker_default_page_size || state.dockerPageSize || 20);

  if (state.config?.system?.site_title) {
    document.title = state.config.system.site_title;
  }
  applySystemMenuVisibility();

  const select = document.getElementById("logRule");
  select.innerHTML = "<option value=\"\">閻㈩垱鐡曢～鍡涙⒒椤曗偓椤ｇ晫鎲撮崟顐㈢仧</option>";
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
  if (!state.authAuthenticated) return;
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
    if (!state.authAuthenticated) return;
    if (state.monitorPaused) return;
    if (hadConnection) {
      refreshMonitor();
    }
    scheduleMonitorSocketReconnect();
  });
}

function scheduleMonitorSocketReconnect() {
  if (!state.authAuthenticated) return;
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
    `闁哄秶顭堢缓?${num(data.cpu?.core_count)} | ${shorten(data.cpu?.model || "闁搞劌顑呰ぐ鍧楀嫉椤忓棛鍙€", 48)} | 闁哄鍩栭悗?${data.cpu?.architecture || "-"} | ${fixed(data.cpu?.frequency_mhz)} MHz${cpuPressureText ? ` | ${cpuPressureText}` : ""}`,
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
    netTrafficEl.innerHTML = `闁?${bytes(rates.netInRate)}/缂?br/>闁?${bytes(rates.netOutRate)}/缂佸濡?
  }
  setText(
    "netPackets",
    `鐟滅増鎸告晶鐘电磾閹存繂骞?${data.network?.primary_nic || "-"}${data.network?.primary_mac ? ` | MAC ${data.network?.primary_mac}` : ""} | 閺夆晝鍋炵敮鎾极?${num(data.network?.connection_count || 0)} | 閻庡湱鍋炲鍌炲箑鐠囧弶鍋犻柛?${bytes(rates.netRate)}/缂佸濡?
  );

  setText("processCount", `${num(data.process_count)}`);
  renderSystemInfo(data);
  setText("osInfo", `${data.os?.hostname || "-"} / ${data.os?.platform || "-"} / 閺夆晜鍔橀、鎴﹀籍閸洘姣?${formatDuration(data.os?.uptime)}`);

  const diskIoFlowEl = document.getElementById("diskIoFlow");
  if (diskIoFlowEl) {
    diskIoFlowEl.innerHTML = `閻?${rateBytes(summaryRate.readBytesRate)}/缂?br/>闁?${rateBytes(summaryRate.writeBytesRate)}/缂佸濡?
  }
  const diskCount = Number((data.disk_hardware || []).length || (data.disks || []).length || 0);
  setText(
    "diskIoOps",
    `閻?IOPS ${fixed(summaryRate.readOpsRate)}婵?缂?| 闁?IOPS ${fixed(summaryRate.writeOpsRate)}婵?缂?| 缁惧彞鑳跺ú蹇涘极?${num(diskCount)} | ${summarizeDiskHardware(data.disk_hardware || [])}`,
  );
  setText("diskIoSummary", summarizeDiskHardwareDetail(data.disk_hardware || []));

  setBar("cpuBar", cpuUsageVal);
  setBar("memBar", memUsageVal);
  applyPressureStyle("cpu", cpuUsageVal);
  applyPressureStyle("memory", memUsageVal);

  renderTable(
    "diskList",
    ["闁圭鍊藉ù鍥倷?, "閻犱焦鍎抽ˇ?, "闁哄倸娲ｅ▎銏㈠寲閼姐倗鍩?, "濞达綀娉曢弫銈夋偝?, "闁稿鍎遍幃宥夋偐閼哥鍋?, "閻庣懓缍婇崳?, "閻庡湱鍋炲鍌滄嫚婵犳埃鍋撻悢鍝勮姵", "閻庡湱鍋炲鍌炲礃濞嗘挴鍋撻悢鍝勮姵", "閻庡湱鍋炲鍌滄嫚缁PS", "閻庡湱鍋炲鍌炲礃濮楊湑PS"],
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
          compactMountLabel(x.path),
          x.device || "-",
          x.fs_type || "-",
          `<span class="disk-usage-tag ${usageClass}">${fixed(usage)}%</span>`,
          `<span class="disk-health-tag ${usageClass}">${usageText}</span>`,
          `${bytes(x.used)} / ${bytes(x.total)}`,
          `${rateBytes(rate.readBytesRate)}/缂佸濡?
          `${rateBytes(rate.writeBytesRate)}/缂佸濡?
          `${fixed(rate.readOpsRate)}婵?缂佸濡?
          `${fixed(rate.writeOpsRate)}婵?缂佸濡?
        ],
      };
    }),
    true,
  );
  renderDiskVolumeChart(data.disks || []);

  renderPortTable();

  renderFlowMonitorTable();
  refreshFlowMonitor(false);

  renderTrendCards();
  refreshTrendModalIfOpen();

  renderProcessTable();
}

function renderFlowMonitorTable() {
  const allItems = Array.isArray(state.flowMonitorRawItems) ? state.flowMonitorRawItems : [];
  const filtered = applyFlowMonitorFilters(allItems, {
    keyword: state.flowMonitorKeyword,
    protocol: state.flowMonitorProtocol,
    status: state.flowMonitorStatusFilter,
    sort: state.flowMonitorSort,
  });
  const limited = filtered.slice(0, FLOW_MONITOR_MAX_ROWS);
  state.flowMonitorItems = limited;

  const rows = limited.map((item) => ({
    cells: [
      escapeHTML(item.name || "-"),
      escapeHTML(item.flow_type || "-"),
      `<span class="badge ${item.statusBadge || "unknown"}">${escapeHTML(item.statusText || "-")}</span>`,
      escapeHTML(item.started_at || "-"),
      escapeHTML(item.finished_at || "-"),
      escapeHTML(item.detail || "-"),
      `<button class="btn sm" type="button" data-flow-detail="${escapeHTML(item.key)}">閻犲浄闄勯崕?/button>`,
    ],
  }));
  renderTable("flowMonitorList", ["閺夆晜绋撻埢濂稿触瀹ュ泦?, "闁告绻楅?閺夆晝鍋炵敮?, "闁绘鍩栭埀?, "闁哄牃鍋撻柛姘濡炶法鎹?, "PID", "婵炵繝绶氶崳娲箺濡娲?, "闁瑰灝绉崇紞?], rows, true);

}

async function refreshFlowMonitor(force = false) {
  const now = Date.now();
  if (!force && state.flowMonitorLoading) return state.flowMonitorItems;
  if (!force && now - state.flowMonitorLastLoadedAt < FLOW_MONITOR_REFRESH_MS) return state.flowMonitorItems;

  state.flowMonitorLoading = true;
  try {
    const res = await fetchWithTimeout("/api/traffic", 12000);
    let payload = {};
    try {
      payload = await res.json();
    } catch (_) {
      payload = {};
    }
    if (!res.ok) {
      throw new Error(payload.error || `traffic status ${res.status}`);
    }

    const connections = Array.isArray(payload?.connections) ? payload.connections : [];
    const unsupported = payload?.status?.supported === false;
    const modeText = unsupported ? "閺夆晝鍋炵敮鎾箑娓氬﹦绀勯柡鍐У婵嫰宕犻崪鍐" : "闁硅埖鎸哥€垫﹢骞€?;
    const items = connections.map((item) => {
      const protocol = String(item.protocol || "-").toUpperCase();
      const local = `${item.local_ip || "-"}:${item.local_port || 0}`;
      const remote = item.remote_ip ? `${item.remote_ip}:${item.remote_port || 0}` : "-";
      const statusRaw = normalizeFlowConnectionStatus(item.status);
      const statusText = localizeFlowConnectionStatus(statusRaw);
      const bytesIn = Number(item.bytes_in || 0);
      const bytesOut = Number(item.bytes_out || 0);
      const packetsIn = Number(item.packets_in || 0);
      const packetsOut = Number(item.packets_out || 0);
      return {
        key: item.connection_key || `${item.pid || 0}-${local}-${remote}-${protocol}`,
        name: item.process_name || "-",
        flow_type: `${protocol} ${local} -> ${remote}`,
        status: statusRaw,
        statusRaw,
        statusText,
        statusBadge: flowConnectionBadgeClass(statusRaw),
        started_at: item.last_seen ? formatTimeValue(item.last_seen) : "-",
        started_at_raw: item.last_seen || "",
        lastSeenValue: flowTimeValue(item.last_seen),
        finished_at: item.pid ? String(item.pid) : "-",
        pidValue: Number(item.pid || 0),
        protocolValue: String(item.protocol || "").toLowerCase(),
        localAddress: local,
        remoteAddress: remote,
        bytesIn,
        bytesOut,
        packetsIn,
        packetsOut,
        bytesTotal: bytesIn + bytesOut,
        packetsTotal: packetsIn + packetsOut,
        captureMode: modeText,
        unsupported,
        connectionKey: item.connection_key || "",
        exePath: item.exe_path || "-",
        raw: item,
        detail: unsupported
          ? `${modeText} | 閻庢稒顨夋俊?闁告牕鎳愮划铏规媼閳ヨ尙鐟濋柛娆樺灣閺併倝鏁嶉崼銉︿粯闁告凹鍨抽弫?CGO + Npcap闁挎稑藝
          : `${modeText} | 闁?闁告垹鍎ょ粊锕傛煂?${bytes(bytesIn)} / ${bytes(bytesOut)} | 闁?闁告垵鎼€?${num(packetsIn)} / ${num(packetsOut)}`,
      };
    });

    items.sort((a, b) => b.lastSeenValue - a.lastSeenValue);
    state.flowMonitorRawItems = items;
    state.flowMonitorStatus = payload?.status || null;
    state.flowMonitorUpdatedAt = Date.now();
    syncFlowMonitorFiltersFromUI();
    state.flowMonitorItems = items.slice(0, FLOW_MONITOR_MAX_ROWS);
    state.flowMonitorLastLoadedAt = Date.now();
    renderFlowMonitorTable();
    return state.flowMonitorItems;
  } catch (err) {
    console.error("refresh flow monitor failed", err);
    return state.flowMonitorItems;
  } finally {
    state.flowMonitorLoading = false;
  }
}

function syncFlowMonitorFiltersFromUI() {
  const searchInput = document.getElementById("flowMonitorSearch");
  const protocolSelect = document.getElementById("flowMonitorProtocol");
  const statusSelect = document.getElementById("flowMonitorStatus");
  const sortSelect = document.getElementById("flowMonitorSort");
  if (searchInput) state.flowMonitorKeyword = String(searchInput.value || "").trim();
  if (protocolSelect) state.flowMonitorProtocol = String(protocolSelect.value || "all").trim().toLowerCase();
  if (statusSelect) state.flowMonitorStatusFilter = String(statusSelect.value || "all").trim().toLowerCase();
  if (sortSelect) state.flowMonitorSort = String(sortSelect.value || "time_desc").trim().toLowerCase();
}

function resetFlowMonitorFilters() {
  state.flowMonitorKeyword = "";
  state.flowMonitorProtocol = "all";
  state.flowMonitorStatusFilter = "all";
  state.flowMonitorSort = "time_desc";
  const searchInput = document.getElementById("flowMonitorSearch");
  const protocolSelect = document.getElementById("flowMonitorProtocol");
  const statusSelect = document.getElementById("flowMonitorStatus");
  const sortSelect = document.getElementById("flowMonitorSort");
  if (searchInput) searchInput.value = "";
  if (protocolSelect) protocolSelect.value = "all";
  if (statusSelect) statusSelect.value = "all";
  if (sortSelect) sortSelect.value = "time_desc";
}

function normalizeFlowConnectionStatus(raw) {
  const value = String(raw || "").trim().toUpperCase();
  return value || "UNKNOWN";
}

function localizeFlowConnectionStatus(raw) {
  const value = normalizeFlowConnectionStatus(raw);
  if (value === "ESTABLISHED") return "鐎瑰憡褰冪紓鎾剁博?;
  if (value === "LISTEN") return "闁烩晜鍨甸幆澶嬬▔?;
  if (value === "SYN_SENT" || value === "SYN_RECV") return "闁圭儵鍓濇晶婊勭▔?;
  if (["FIN_WAIT1", "FIN_WAIT2", "CLOSE_WAIT", "CLOSING", "LAST_ACK", "TIME_WAIT"].includes(value)) return "闁稿繑濞婂Λ瀛樼▔?;
  if (value === "CLOSED" || value === "CLOSE") return "鐎瑰憡褰冮崣褔姊?;
  if (value === "UNKNOWN" || value === "NONE") return "闁哄牜浜為悡?;
  return value;
}

function flowConnectionBadgeClass(raw) {
  const value = normalizeFlowConnectionStatus(raw);
  if (value === "ESTABLISHED" || value === "LISTEN" || value === "SYN_SENT" || value === "SYN_RECV") return "up";
  if (["FIN_WAIT1", "FIN_WAIT2", "CLOSE_WAIT", "CLOSING", "LAST_ACK", "TIME_WAIT", "CLOSED", "CLOSE"].includes(value)) return "unknown";
  if (value === "ERROR" || value === "FAILED" || value === "DOWN") return "down";
  return "unknown";
}

function flowStatusGroupMatch(rawStatus, filterStatus) {
  const value = normalizeFlowConnectionStatus(rawStatus);
  const filter = String(filterStatus || "all").trim().toLowerCase();
  if (filter === "all") return true;
  if (filter === "established") return value === "ESTABLISHED";
  if (filter === "listen") return value === "LISTEN";
  if (filter === "closing") return value.includes("WAIT") || value.includes("CLOSE") || value === "CLOSING" || value === "LAST_ACK";
  if (filter === "unknown") return value === "UNKNOWN" || value === "NONE" || !value;
  return true;
}

function applyFlowMonitorFilters(items, options = {}) {
  const list = Array.isArray(items) ? [...items] : [];
  const keyword = String(options.keyword || "").trim().toLowerCase();
  const protocol = String(options.protocol || "all").trim().toLowerCase();
  const status = String(options.status || "all").trim().toLowerCase();
  const sort = String(options.sort || "time_desc").trim().toLowerCase();

  const filtered = list.filter((item) => {
    const protocolOK = protocol === "all" || String(item.protocolValue || "").toLowerCase() === protocol;
    if (!protocolOK) return false;
    if (!flowStatusGroupMatch(item.statusRaw, status)) return false;
    if (!keyword) return true;
    const searchable = [
      item.name,
      item.finished_at,
      item.protocolValue,
      item.statusRaw,
      item.statusText,
      item.localAddress,
      item.remoteAddress,
      item.flow_type,
      item.connectionKey,
      item.exePath,
      item.detail,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(keyword);
  });

  filtered.sort((a, b) => {
    if (sort === "bytes_desc") {
      if (b.bytesTotal !== a.bytesTotal) return b.bytesTotal - a.bytesTotal;
      return b.lastSeenValue - a.lastSeenValue;
    }
    if (sort === "packets_desc") {
      if (b.packetsTotal !== a.packetsTotal) return b.packetsTotal - a.packetsTotal;
      return b.lastSeenValue - a.lastSeenValue;
    }
    if (sort === "pid_asc") {
      if (a.pidValue !== b.pidValue) return a.pidValue - b.pidValue;
      return b.lastSeenValue - a.lastSeenValue;
    }
    if (sort === "name_asc") {
      const nameDiff = String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN");
      if (nameDiff !== 0) return nameDiff;
      return b.lastSeenValue - a.lastSeenValue;
    }
    return b.lastSeenValue - a.lastSeenValue;
  });
  return filtered;
}

function buildFlowMonitorSummary(items) {
  const list = Array.isArray(items) ? items : [];
  let tcp = 0;
  let udp = 0;
  let established = 0;
  let listen = 0;
  for (const item of list) {
    const protocol = String(item.protocolValue || "").toLowerCase();
    if (protocol === "tcp") tcp += 1;
    if (protocol === "udp") udp += 1;
    const status = normalizeFlowConnectionStatus(item.statusRaw);
    if (status === "ESTABLISHED") established += 1;
    if (status === "LISTEN") listen += 1;
  }
  return `TCP ${num(tcp)} | UDP ${num(udp)} | 鐎瑰憡褰冪紓鎾剁博?${num(established)} | 闁烩晜鍨甸幆?${num(listen)}`;
}

function openFlowMonitorDetailModalByKey(key) {
  const target = String(key || "").trim();
  if (!target) return;
  const all = Array.isArray(state.flowMonitorRawItems) ? state.flowMonitorRawItems : [];
  const item = all.find((x) => String(x.key || "").trim() === target);
  if (!item) {
    showAppToast("闁哄牜浜濇竟姗€宕氶幏宀婂殙閺夆晝鍋炵敮瀵告嫚閿旇棄鍓伴柨娑樿嫰瑜版煡鎳楅挊澶婂殥閺夆晛娲﹀﹢?, "warning");
    return;
  }
  openFlowMonitorSingleDetailModal(item, "婵炵繝绶氶崳鐑樻交閻愭潙澶嶉悹鍥烽檮閸?);
}

function openFlowMonitorSingleDetailModal(item, title = "婵炵繝绶氶崳鐑樻交閻愭潙澶嶉悹鍥烽檮閸?) {
  const target = item && typeof item === "object" ? item : null;
  if (!target) {
    showAppToast("闁哄牜浜濇竟姗€宕氶幏宀婂殙閺夆晝鍋炵敮瀵告嫚閿旇棄鍓伴柨娑樿嫰瑜版煡鎳楅挊澶婂殥閺夆晛娲﹀﹢?, "warning");
    return;
  }

  const statusRaw = normalizeFlowConnectionStatus(target.statusRaw || target.status);
  const statusText = target.statusText || localizeFlowConnectionStatus(statusRaw);
  const statusBadge = flowConnectionBadgeClass(statusRaw);
  const protocol = String(target.protocolValue || target.raw?.protocol || "-").toUpperCase();
  const localAddress = String(target.localAddress || "-");
  const remoteAddress = String(target.remoteAddress || "-");
  const connectionKey = String(target.connectionKey || target.key || "-");
  const processName = String(target.name || "-");
  const pidText = String(target.finished_at || target.pidValue || "-");
  const exePath = String(target.exePath || "-");
  const activeAt = String(target.started_at || "-");
  const modeText = String(target.captureMode || "-");
  const summaryText = String(target.detail || "-");
  const rawJSON = escapeHTML(JSON.stringify(target.raw || {}, null, 2));

  const html = `
    <section class="flow-detail-modern">
      <article class="flow-detail-hero">
        <div class="flow-detail-hero-main">
          <h4>${escapeHTML(processName)}</h4>
          <p>${escapeHTML(`${protocol} ${localAddress} -> ${remoteAddress}`)}</p>
        </div>
        <span class="badge ${statusBadge}">${escapeHTML(statusText)}</span>
      </article>

      <div class="flow-detail-kpi-grid">
        <div class="flow-detail-kpi-card">
          <span>闁稿繈鍎茬粊锕傛煂?/span>
          <strong>${escapeHTML(bytes(target.bytesIn || 0))}</strong>
        </div>
        <div class="flow-detail-kpi-card">
          <span>闁告垹鍎ょ粊锕傛煂?/span>
          <strong>${escapeHTML(bytes(target.bytesOut || 0))}</strong>
        </div>
        <div class="flow-detail-kpi-card">
          <span>闁稿繈鍎辩€垫﹢寮?/span>
          <strong>${escapeHTML(num(target.packetsIn || 0))}</strong>
        </div>
        <div class="flow-detail-kpi-card">
          <span>闁告垵鎼€垫﹢寮?/span>
          <strong>${escapeHTML(num(target.packetsOut || 0))}</strong>
        </div>
      </div>

      <div class="flow-detail-grid">
        <article class="flow-detail-block">
          <h5>閺夆晝鍋炵敮瀛樼┍閳╁啩绱?/h5>
          <div class="flow-detail-pairs">
            <div><label>闁告绻楅?/label><span>${escapeHTML(protocol)}</span></div>
            <div><label>闁哄牜鍓欏﹢鎾捶閺夋寧绲?/label><span>${escapeHTML(localAddress)}</span></div>
            <div><label>閺夆晜绮庨顒勫捶閺夋寧绲?/label><span>${escapeHTML(remoteAddress)}</span></div>
            <div><label>闁哄牃鍋撻柛姘濡炶法鎹?/label><span>${escapeHTML(activeAt)}</span></div>
            <div><label>闂佹彃娲▔锕€螣閳ュ磭纭€</label><span>${escapeHTML(modeText)}</span></div>
            <div><label>闁绘鍩栭埀?/label><span>${escapeHTML(statusText)}</span></div>
          </div>
        </article>
        <article class="flow-detail-block">
          <h5>閺夆晜绋撻埢鍏肩┍閳╁啩绱?/h5>
          <div class="flow-detail-pairs">
            <div><label>閺夆晜绋撻埢濂稿触?/label><span>${escapeHTML(processName)}</span></div>
            <div><label>PID</label><span>${escapeHTML(pidText)}</span></div>
            <div><label>閺夆晝鍋炵敮鎾煥?/label><code>${escapeHTML(connectionKey)}</code></div>
            <div><label>閺夆晜绋撻埢鑲╂崉椤栨氨绐?/label><span title="${escapeHTML(exePath)}">${escapeHTML(exePath)}</span></div>
            <div><label>闁硅姤顭堥々?/label><span title="${escapeHTML(summaryText)}">${escapeHTML(summaryText)}</span></div>
          </div>
        </article>
      </div>

      <div class="flow-detail-actions">
        <button id="flowDetailCopyKeyBtn" class="btn sm" type="button">濠㈣泛绉撮崺妤佹交閻愭潙澶嶉梺?/button>
        <button id="flowDetailCopyJsonBtn" class="btn sm" type="button">濠㈣泛绉撮崺?JSON</button>
      </div>

      <details class="flow-detail-raw">
        <summary>闁哄被鍎冲﹢鍛村储閻斿娼楅弶鈺冨仦鐢挳寮悧鍫濈ウ</summary>
        <pre class="log-view compact flow-monitor-json">${rawJSON}</pre>
      </details>
    </section>
  `;

  openModal(title, html, { modalClass: "flow-monitor-detail-modal" });

  document.getElementById("flowDetailCopyKeyBtn")?.addEventListener("click", async () => {
    const ok = await copyText(connectionKey);
    showAppToast(ok ? "閺夆晝鍋炵敮鎾煥椤旂厧鍤掑璺虹Т閸? : "濠㈣泛绉撮崺妤佹交閻愭潙澶嶉梺娆惧枛閵囨垹鎷?, ok ? "success" : "error");
  });
  document.getElementById("flowDetailCopyJsonBtn")?.addEventListener("click", async () => {
    const text = JSON.stringify(target.raw || {}, null, 2);
    const ok = await copyText(text);
    showAppToast(ok ? "閺夆晝鍋炵敮?JSON 鐎瑰憡褰冮ˇ鏌ュ礆? : "濠㈣泛绉撮崺妤佹交閻愭潙澶?JSON 濠㈡儼绮剧憴?, ok ? "success" : "error");
  });
}

function buildFlowMonitorDetailRows(item) {
  return [
    ["閺夆晜绋撻埢濂稿触瀹ュ泦?, escapeHTML(item.name || "-")],
    ["PID", escapeHTML(item.finished_at || "-")],
    ["閺夆晜绋撻埢鑲╂崉椤栨氨绐?, escapeHTML(item.exePath || "-")],
    ["闁告绻楅?, escapeHTML(String(item.protocolValue || "-").toUpperCase())],
    ["闁绘鍩栭埀?, escapeHTML(item.statusText || item.statusRaw || "-")],
    ["闁哄牜鍓欏﹢鎾捶閺夋寧绲?, escapeHTML(item.localAddress || "-")],
    ["閺夆晜绮庨顒勫捶閺夋寧绲?, escapeHTML(item.remoteAddress || "-")],
    ["闁哄牃鍋撻柛姘濡炶法鎹?, escapeHTML(item.started_at || "-")],
    ["閺夆晝鍋炵敮鎾煥?, `<code>${escapeHTML(item.connectionKey || "-")}</code>`],
    ["闁稿繈鍎茬粊锕傛煂?, escapeHTML(bytes(item.bytesIn || 0))],
    ["闁告垹鍎ょ粊锕傛煂?, escapeHTML(bytes(item.bytesOut || 0))],
    ["闁稿繈鍎辩€垫﹢寮?, escapeHTML(num(item.packetsIn || 0))],
    ["闁告垵鎼€垫﹢寮?, escapeHTML(num(item.packetsOut || 0))],
    ["闂佹彃娲▔锕€螣閳ュ磭纭€", escapeHTML(item.captureMode || "-")],
    ["闁硅姤顭堥々?, escapeHTML(item.detail || "-")],
  ];
}

function openFlowMonitorExplorerModal(initialKey = "", title = "婵炵繝绶氶崳鐑樻交閻愭潙澶嶉悹鍥烽檮閸庡繘鏁嶉崼鐔告殰闁归晲鐒﹂幃宕囨閵忥絿绠栨繝濞垮€х槐?, options = {}) {
  const protocol = String(options.protocol || state.flowMonitorProtocol || "all").trim().toLowerCase();
  const status = String(options.status || state.flowMonitorStatusFilter || "all").trim().toLowerCase();
  const sort = String(options.sort || state.flowMonitorSort || "time_desc").trim().toLowerCase();
  const keyword = String(options.keyword || state.flowMonitorKeyword || "").trim();
  const seedItem = options.seedItem && typeof options.seedItem === "object" ? options.seedItem : null;
  let selectedKey = String(initialKey || "").trim();

  const html = `
    <section class="flow-monitor-explorer">
      <div class="row">
        <input id="flowMonitorDetailSearch" class="input" placeholder="闁瑰吋绮庨崒銊︽交濞戞埃鏌?/ PID / 闁革附婢樺?/ 闁告绻楅?/ 闁绘鍩栭埀?/ 閻犱警鍨扮欢? value="${escapeHTML(keyword)}" />
        <select id="flowMonitorDetailProtocol" class="input sm">
          <option value="all" ${protocol === "all" ? "selected" : ""}>闁稿繈鍔戦崕鎾础韫囨凹鍞?/option>
          <option value="tcp" ${protocol === "tcp" ? "selected" : ""}>TCP</option>
          <option value="udp" ${protocol === "udp" ? "selected" : ""}>UDP</option>
        </select>
        <select id="flowMonitorDetailStatus" class="input sm">
          <option value="all" ${status === "all" ? "selected" : ""}>闁稿繈鍔戦崕鎾偐閼哥鍋?/option>
          <option value="established" ${status === "established" ? "selected" : ""}>鐎瑰憡褰冪紓鎾剁博?/option>
          <option value="listen" ${status === "listen" ? "selected" : ""}>闁烩晜鍨甸幆澶嬬▔?/option>
          <option value="closing" ${status === "closing" ? "selected" : ""}>闁稿繑濞婂Λ瀛樼▔?/option>
          <option value="unknown" ${status === "unknown" ? "selected" : ""}>闁哄牜浜為悡?/option>
        </select>
        <select id="flowMonitorDetailSort" class="input sm">
          <option value="time_desc" ${sort === "time_desc" ? "selected" : ""}>闁哄牃鍋撻柡鍌烆暒缁鳖參宕?/option>
          <option value="bytes_desc" ${sort === "bytes_desc" ? "selected" : ""}>婵炵繝绶氶崳鐑樺濡搫甯?/option>
          <option value="packets_desc" ${sort === "packets_desc" ? "selected" : ""}>闁告牕鎳忛弳鐔稿濡搫甯?/option>
          <option value="pid_asc" ${sort === "pid_asc" ? "selected" : ""}>PID 闁告娲ょ花?/option>
          <option value="name_asc" ${sort === "name_asc" ? "selected" : ""}>閺夆晜绋撻埢濂稿触?A-Z</option>
        </select>
        <button id="flowMonitorDetailResetBtn" class="btn sm" type="button">闂佹彃绉堕悿?/button>
      </div>
      <p id="flowMonitorDetailMeta" class="hint">-</p>
      <div id="flowMonitorDetailTable" class="table"></div>
      <div class="row" style="margin-top:10px;">
        <button id="flowMonitorDetailCopyKeyBtn" class="btn sm" type="button">濠㈣泛绉撮崺妤佹交閻愭潙澶嶉梺?/button>
        <button id="flowMonitorDetailCopyJsonBtn" class="btn sm" type="button">濠㈣泛绉撮崺?JSON</button>
      </div>
      <div id="flowMonitorDetailPanel"></div>
    </section>
  `;
  openModal(title, html, { modalClass: "flow-monitor-modal-xl" });

  let filteredItems = [];
  const getSelectedItem = () => filteredItems.find((x) => String(x.key || "").trim() === selectedKey) || null;

  const renderDetailPanel = () => {
    const panel = document.getElementById("flowMonitorDetailPanel");
    if (!panel) return;
    const item = getSelectedItem();
    if (!item) {
      panel.innerHTML = '<div class="hint">鐟滅増鎸告晶鐘电驳濞戔懇鍋撴径宀€娉㈤柡瀣矆鐠愮喓绮氶悮瀵哥闁哄啰濮电涵鍫曞及閸撗佷粵閺夆晝鍋炵敮瀵告嫚閿旇棄鍓?/div>';
      return;
    }
    const rows = buildFlowMonitorDetailRows(item);
    panel.innerHTML = `
      <div class="table flow-monitor-detail-kv">${renderTableHTML(["閻庢稒顨嗛?, "闁?], rows, true)}</div>
      <details style="margin-top:10px;">
        <summary>闁告鍠庨～鎰交閻愭潙澶嶉柡浣哄瀹?/summary>
        <pre class="log-view compact flow-monitor-json">${escapeHTML(JSON.stringify(item.raw || {}, null, 2))}</pre>
      </details>
    `;
  };

  const renderExplorer = () => {
    const keywordVal = String(document.getElementById("flowMonitorDetailSearch")?.value || "").trim();
    const protocolVal = String(document.getElementById("flowMonitorDetailProtocol")?.value || "all").trim().toLowerCase();
    const statusVal = String(document.getElementById("flowMonitorDetailStatus")?.value || "all").trim().toLowerCase();
    const sortVal = String(document.getElementById("flowMonitorDetailSort")?.value || "time_desc").trim().toLowerCase();
    const all = Array.isArray(state.flowMonitorRawItems) ? state.flowMonitorRawItems : [];
    filteredItems = applyFlowMonitorFilters(all, {
      keyword: keywordVal,
      protocol: protocolVal,
      status: statusVal,
      sort: sortVal,
    });

    if (!filteredItems.some((x) => String(x.key || "").trim() === selectedKey) && seedItem) {
      const seedKey = String(seedItem.key || "").trim();
      if (seedKey && selectedKey === seedKey) {
        filteredItems = [seedItem, ...filteredItems.filter((x) => String(x.key || "").trim() !== seedKey)];
      }
    }

    if (!filteredItems.some((x) => String(x.key || "").trim() === selectedKey)) {
      selectedKey = String(filteredItems[0]?.key || "");
    }

    const rows = filteredItems.map((item) => ({
      rowClass: String(item.key || "") === selectedKey ? "flow-monitor-row-selected" : "",
      attrs: { "data-flow-select": String(item.key || "") },
      cells: [
        escapeHTML(item.name || "-"),
        escapeHTML(item.finished_at || "-"),
        escapeHTML(String(item.protocolValue || "-").toUpperCase()),
        escapeHTML(item.statusText || "-"),
        escapeHTML(item.localAddress || "-"),
        escapeHTML(item.remoteAddress || "-"),
        escapeHTML(item.started_at || "-"),
        escapeHTML(bytes(item.bytesIn || 0)),
        escapeHTML(bytes(item.bytesOut || 0)),
        escapeHTML(num(item.packetsIn || 0)),
        escapeHTML(num(item.packetsOut || 0)),
        `<button class="btn sm" type="button" data-flow-select="${escapeHTML(item.key)}">闁哄被鍎冲﹢?/button>`,
      ],
    }));
    const table = document.getElementById("flowMonitorDetailTable");
    if (table) {
      table.innerHTML = renderTableHTML(
        ["閺夆晜绋撻埢?, "PID", "闁告绻楅?, "闁绘鍩栭埀?, "闁哄牜鍓欏﹢鎾捶閺夋寧绲?, "閺夆晜绮庨顒勫捶閺夋寧绲?, "闁哄牃鍋撻柛姘濡炶法鎹?, "闁稿繈鍎茬粊锕傛煂?, "闁告垹鍎ょ粊锕傛煂?, "闁稿繈鍎辩€?, "闁告垵鎼€?, "闁瑰灝绉崇紞?],
        rows,
        true,
      );
    }
    setText(
      "flowMonitorDetailMeta",
      `闁诡剚妲掔换娑㈠箳?${num(all.length)} 闁?| 閺夆晛娲﹂幎銈夊触?${num(filteredItems.length)} 闁?| ${buildFlowMonitorSummary(filteredItems)}`,
    );
    renderDetailPanel();
  };

  document.getElementById("flowMonitorDetailSearch")?.addEventListener("input", renderExplorer);
  document.getElementById("flowMonitorDetailProtocol")?.addEventListener("change", renderExplorer);
  document.getElementById("flowMonitorDetailStatus")?.addEventListener("change", renderExplorer);
  document.getElementById("flowMonitorDetailSort")?.addEventListener("change", renderExplorer);
  document.getElementById("flowMonitorDetailResetBtn")?.addEventListener("click", () => {
    const search = document.getElementById("flowMonitorDetailSearch");
    const protocolBox = document.getElementById("flowMonitorDetailProtocol");
    const statusBox = document.getElementById("flowMonitorDetailStatus");
    const sortBox = document.getElementById("flowMonitorDetailSort");
    if (search) search.value = "";
    if (protocolBox) protocolBox.value = "all";
    if (statusBox) statusBox.value = "all";
    if (sortBox) sortBox.value = "time_desc";
    renderExplorer();
  });
  document.getElementById("flowMonitorDetailTable")?.addEventListener("click", (event) => {
    const selectBtn = event.target.closest("[data-flow-select]");
    if (!selectBtn) return;
    selectedKey = String(selectBtn.dataset.flowSelect || "").trim();
    if (!selectedKey) return;
    renderExplorer();
  });
  document.getElementById("flowMonitorDetailCopyKeyBtn")?.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) {
      showAppToast("鐟滅増鎸告晶鐘诲籍閻樻彃璁插璺虹Т閸╂娼婚悙鏉戝", "warning");
      return;
    }
    const ok = await copyText(item.connectionKey || "");
    showAppToast(ok ? "閺夆晝鍋炵敮鎾煥椤旂厧鍤掑璺虹Т閸? : "濠㈣泛绉撮崺妤佹交閻愭潙澶嶉梺娆惧枛閵囨垹鎷?, ok ? "success" : "error");
  });
  document.getElementById("flowMonitorDetailCopyJsonBtn")?.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) {
      showAppToast("鐟滅増鎸告晶鐘诲籍閻樻彃璁插璺虹Т閸╂娼婚悙鏉戝", "warning");
      return;
    }
    const text = JSON.stringify(item.raw || {}, null, 2);
    const ok = await copyText(text);
    showAppToast(ok ? "閺夆晝鍋炵敮?JSON 鐎瑰憡褰冮ˇ鏌ュ礆? : "濠㈣泛绉撮崺妤佹交閻愭潙澶?JSON 濠㈡儼绮剧憴?, ok ? "success" : "error");
  });

  renderExplorer();
}

function openFlowMonitorAllModal() {
  const protocol = state.flowMonitorProtocol || "all";
  const status = state.flowMonitorStatusFilter || "all";
  const sort = state.flowMonitorSort || "time_desc";
  const keyword = state.flowMonitorKeyword || "";
  const html = `
    <section class="flow-monitor-modal">
      <div class="row">
        <input id="flowMonitorModalSearch" class="input" placeholder="闁瑰吋绮庨崒銊︽交濞戞埃鏌?/ PID / 闁革附婢樺?/ 闁告绻楅?/ 闁绘鍩栭埀?/ 閻犱警鍨扮欢? value="${escapeHTML(keyword)}" />
        <select id="flowMonitorModalProtocol" class="input sm">
          <option value="all" ${protocol === "all" ? "selected" : ""}>闁稿繈鍔戦崕鎾础韫囨凹鍞?/option>
          <option value="tcp" ${protocol === "tcp" ? "selected" : ""}>TCP</option>
          <option value="udp" ${protocol === "udp" ? "selected" : ""}>UDP</option>
        </select>
        <select id="flowMonitorModalStatus" class="input sm">
          <option value="all" ${status === "all" ? "selected" : ""}>闁稿繈鍔戦崕鎾偐閼哥鍋?/option>
          <option value="established" ${status === "established" ? "selected" : ""}>鐎瑰憡褰冪紓鎾剁博?/option>
          <option value="listen" ${status === "listen" ? "selected" : ""}>闁烩晜鍨甸幆澶嬬▔?/option>
          <option value="closing" ${status === "closing" ? "selected" : ""}>闁稿繑濞婂Λ瀛樼▔?/option>
          <option value="unknown" ${status === "unknown" ? "selected" : ""}>闁哄牜浜為悡?/option>
        </select>
        <select id="flowMonitorModalSort" class="input sm">
          <option value="time_desc" ${sort === "time_desc" ? "selected" : ""}>闁哄牃鍋撻柡鍌烆暒缁鳖參宕?/option>
          <option value="bytes_desc" ${sort === "bytes_desc" ? "selected" : ""}>婵炵繝绶氶崳鐑樺濡搫甯?/option>
          <option value="packets_desc" ${sort === "packets_desc" ? "selected" : ""}>闁告牕鎳忛弳鐔稿濡搫甯?/option>
          <option value="pid_asc" ${sort === "pid_asc" ? "selected" : ""}>PID 闁告娲ょ花?/option>
          <option value="name_asc" ${sort === "name_asc" ? "selected" : ""}>閺夆晜绋撻埢濂稿触?A-Z</option>
        </select>
        <button id="flowMonitorModalResetBtn" class="btn sm" type="button">闂佹彃绉堕悿?/button>
      </div>
      <p id="flowMonitorModalMeta" class="hint">-</p>
      <div id="flowMonitorModalTable" class="table"></div>
    </section>
  `;
  openModal("婵炵繝绶氶崳娲儎閹寸偛浠橀柛蹇嬪姂閸ｈ櫣鎲撮崱妤佺", html, { modalClass: "flow-monitor-modal-full" });

  let filteredItems = [];

  const renderInModal = () => {
    const keywordVal = String(document.getElementById("flowMonitorModalSearch")?.value || "").trim();
    const protocolVal = String(document.getElementById("flowMonitorModalProtocol")?.value || "all").trim().toLowerCase();
    const statusVal = String(document.getElementById("flowMonitorModalStatus")?.value || "all").trim().toLowerCase();
    const sortVal = String(document.getElementById("flowMonitorModalSort")?.value || "time_desc").trim().toLowerCase();
    const all = Array.isArray(state.flowMonitorRawItems) ? state.flowMonitorRawItems : [];
    filteredItems = applyFlowMonitorFilters(all, {
      keyword: keywordVal,
      protocol: protocolVal,
      status: statusVal,
      sort: sortVal,
    });
    const rows = filteredItems.map((item) => ({
      cells: [
        escapeHTML(item.name || "-"),
        escapeHTML(item.finished_at || "-"),
        escapeHTML(String(item.protocolValue || "-").toUpperCase()),
        escapeHTML(item.statusText || "-"),
        escapeHTML(item.localAddress || "-"),
        escapeHTML(item.remoteAddress || "-"),
        escapeHTML(item.started_at || "-"),
        escapeHTML(bytes(item.bytesIn || 0)),
        escapeHTML(bytes(item.bytesOut || 0)),
        escapeHTML(num(item.packetsIn || 0)),
        escapeHTML(num(item.packetsOut || 0)),
        `<button class="btn sm" type="button" data-flow-detail="${escapeHTML(item.key)}">閻犲浄闄勯崕?/button>`,
      ],
    }));
    const table = document.getElementById("flowMonitorModalTable");
    if (table) {
      table.innerHTML = renderTableHTML(
        ["閺夆晜绋撻埢?, "PID", "闁告绻楅?, "闁绘鍩栭埀?, "闁哄牜鍓欏﹢鎾捶閺夋寧绲?, "閺夆晜绮庨顒勫捶閺夋寧绲?, "闁哄牃鍋撻柛姘濡炶法鎹?, "闁稿繈鍎茬粊锕傛煂?, "闁告垹鍎ょ粊锕傛煂?, "闁稿繈鍎辩€?, "闁告垵鎼€?, "闁瑰灝绉崇紞?],
        rows,
        true,
      );
    }
    setText(
      "flowMonitorModalMeta",
      `闁诡剚妲掔换娑㈠箳?${num(all.length)} 闁?| 閺夆晛娲﹂幎銈夊触?${num(filteredItems.length)} 闁?| ${buildFlowMonitorSummary(filteredItems)}`,
    );
  };

  document.getElementById("flowMonitorModalSearch")?.addEventListener("input", renderInModal);
  document.getElementById("flowMonitorModalProtocol")?.addEventListener("change", renderInModal);
  document.getElementById("flowMonitorModalStatus")?.addEventListener("change", renderInModal);
  document.getElementById("flowMonitorModalSort")?.addEventListener("change", renderInModal);
  document.getElementById("flowMonitorModalResetBtn")?.addEventListener("click", () => {
    const search = document.getElementById("flowMonitorModalSearch");
    const protocolBox = document.getElementById("flowMonitorModalProtocol");
    const statusBox = document.getElementById("flowMonitorModalStatus");
    const sortBox = document.getElementById("flowMonitorModalSort");
    if (search) search.value = "";
    if (protocolBox) protocolBox.value = "all";
    if (statusBox) statusBox.value = "all";
    if (sortBox) sortBox.value = "time_desc";
    renderInModal();
  });
  document.getElementById("flowMonitorModalTable")?.addEventListener("click", (event) => {
    const detailBtn = event.target.closest("[data-flow-detail]");
    if (!detailBtn) return;
    const key = String(detailBtn.dataset.flowDetail || "").trim();
    if (!key) return;
    const selected = filteredItems.find((x) => String(x.key || "").trim() === key) || null;
    if (!selected) {
      showAppToast("闁哄牜浜濇竟姗€宕氶幏宀婂殙閺夆晝鍋炵敮瀵告嫚閿旇棄鍓伴柨娑樿嫰瑜版煡鎳楅挊澶婂殥閺夆晛娲﹀﹢?, "warning");
      return;
    }
    openFlowMonitorSingleDetailModal(selected, "婵炵繝绶氶崳鐑樻交閻愭潙澶嶉悹鍥烽檮閸?);
  });
  renderInModal();
}

function flowTimeValue(raw) {
  const text = String(raw || "").trim();
  if (!text) return 0;
  const ts = new Date(text).getTime();
  return Number.isFinite(ts) ? ts : 0;
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
    info.textContent = `閺?{TREND_MINI_HOURS}閻忓繐绻戝?闁哄牃鍋撻柡?${cfg.format(latest)} | 闁哄牃鍋撳Δ?${cfg.format(highest)}`;
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
      openModal(cfg.title, `<div class="trend-empty">闁哄棗鍊瑰Λ銈囨惥鐎ｎ亜鈼㈤柡浣哄瀹?/div>`, { keepTrend: true });
    } else {
      setModalContent(cfg.title, `<div class="trend-empty">闁哄棗鍊瑰Λ銈囨惥鐎ｎ亜鈼㈤柡浣哄瀹?/div>`);
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
        <span class="trend-live-item trend-live-now"><span class="trend-live-dot"></span>鐟滅増鎸告晶鐘诲嫉閳ь剟寮弶搴撳亾?<strong>${escapeHTML(cfg.format(latest))}</strong></span>
        <span class="trend-live-item">闂佹彃娲﹂悧閬嶅籍閸洘锛?${escapeHTML(latestTimeText)}</span>
        <span class="trend-live-item">閻庡湱鍋炲鍌炲礆闁垮鐓€ ${refreshSec} 缂?/span>
      </div>
      <div class="trend-modal-meta">閺?4閻忓繐绻戝鍌炴煂閸ャ劎澹夐柣?${points.length}闁挎稑鏈〒鍫曞棘閺夊簱鍋?${escapeHTML(cfg.format(latest))}闁挎稑鏈〒鑸殿殗濡　鍋?${escapeHTML(cfg.format(highest))}闁挎稑鏈〒鑸垫媴鎼粹檧鍋?${escapeHTML(cfg.format(lowest))}</div>
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
  if (typeof item.latency_ms === "number" && item.latency_ms > 0) detailParts.push(`鐎点倖鍎肩换?${item.latency_ms}ms`);
  return {
    name: item.name || item.target || "SNMP",
    type: "snmp",
    status: item.status || "unknown",
    detail: detailParts.join(" | "),
  };
}

function mapNmapResultToService(item) {
  const detailParts = [];
  if (item.address) detailParts.push(`闁革附婢樺?${item.address}`);
  if (item.detail) detailParts.push(item.detail);
  if (typeof item.open_ports === "number") detailParts.push(`鐎殿喒鍋撻柡鈧崜褜浼傞柛娆欑稻閺?${item.open_ports}`);
  if (typeof item.latency_ms === "number" && item.latency_ms > 0) detailParts.push(`鐎点倖鍎肩换?${item.latency_ms}ms`);
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
  renderTable("portList", ["閺夆晜绋撻埢濂稿触?, "缂佹棏鍨拌ぐ?, "PID", "闁绘鍩栭埀?, "閻犱警鍨扮欢?], rows);
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
      x.is_jvm ? "JVM" : "閺夆晜绋撻埢?,
      x.pid,
      `${fixed(x.cpu)}%`,
      `${fixed(x.memory)}%`,
      x.threads ?? "-",
      x.exe_path || "-",
      `<button class="btn sm process-detail-btn" data-pid="${x.pid}">閻犙冨缁喚鎷犻敂钘夊壈</button>
       <button class="btn sm danger process-kill-btn" data-pid="${x.pid}">闁稿繑濞婂Λ瀛樻交濞戞埃鏌?/button>`,
    ]);

  renderTable(
    "topProcessList",
    [
      processSortHeader("閺夆晜绋撻埢?, "name"),
      processSortHeader("缂侇偉顕ч悗?, "type"),
      processSortHeader("PID", "pid"),
      processSortHeader("CPU%", "cpu"),
      processSortHeader("闁告劕鎳庨悺?", "mem"),
      processSortHeader("缂佹崘娉曢埢?, "threads"),
      "閻犱警鍨扮欢?,
      "闁瑰灝绉崇紞?,
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
    { index: 0, key: "name", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥閺夆晜绋撻埢濂稿触瀹ュ棗绗撻幖? },
    { index: 1, key: "type", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥缂侇偉顕ч悗鐑藉箳閹烘垹纰? },
    { index: 2, key: "pid", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥 PID 闁圭儤甯掔花? },
    { index: 3, key: "cpu", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥 CPU 闁圭儤甯掔花? },
    { index: 4, key: "mem", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥闁告劕鎳庨悺銊╁箳閹烘垹纰? },
    { index: 5, key: "threads", title: "闁绘劗鎳撻崵顕€宕氶崶銊ュ簥缂佹崘娉曢埢濂稿箳閹烘垹纰? },
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
  if (activeDir === "desc") return `${label} 闁愁偅褰?
  if (activeDir === "asc") return `${label} 闁愁偅鍙?
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
    showAppToast(data.error || "闁兼儳鍢茶ぐ鍥ㄦ交濞戞埃鏌ら悹鍥烽檮閸庡繑寰勬潏顐バ?, "error");
    return;
  }
  openModal("閺夆晜绋撻埢鑲╂導閸曨剛鐖遍悹鍥烽檮閸?, renderProcessDetailHTML(data));
}

async function killProcess(pid) {
  const res = await fetch(`/api/processes/${pid}/kill`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁稿繑濞婂Λ瀛樻交濞戞埃鏌ゅ鎯扮簿鐟?, "error");
    return;
  }
  showAppToast(`鐎瑰憡褰冭ぐ鍌炴焻娴ｇ褰犻梻鍌ゅ幗鐎垫碍绂掗妶蹇曠PID=${pid}`, "success");
  await refreshMonitor();
}

function bindAppManagerActions() {
  const table = document.getElementById("appManagerTable");
  if (!table) return;

  document.getElementById("appManagerRefreshBtn")?.addEventListener("click", () => {
    loadManagedApps(true).catch((err) => {
      console.error("refresh managed apps failed", err);
      showAppToast("闁告帡鏀遍弻濠冩償閺冨倹鏆忛柛鎺擃殙閵嗗啯寰勬潏顐バ?, "error");
    });
  });
  document.getElementById("appManagerCreateBtn")?.addEventListener("click", () => openManagedAppEditorModal(null));
  document.getElementById("appManagerStartBtn")?.addEventListener("click", () => {
    const name = String(state.appManagerSelectedName || "").trim();
    if (!name) return;
    startManagedApp(name).catch((err) => {
      console.error("start managed app failed", err);
      showAppToast(err.message || "闁告凹鍨版慨鈺傛償閺冨倹鏆忓鎯扮簿鐟?, "error");
    });
  });
  document.getElementById("appManagerEditBtn")?.addEventListener("click", () => {
    const name = String(state.appManagerSelectedName || "").trim();
    if (!name) return;
    const app = (state.managedApps || []).find((x) => String(x?.name || "").trim() === name);
    if (!app) return;
    openManagedAppEditorModal(app);
  });
  document.getElementById("appManagerDeleteBtn")?.addEventListener("click", () => {
    const name = String(state.appManagerSelectedName || "").trim();
    if (!name) return;
    deleteManagedApp(name).catch((err) => {
      console.error("delete managed app failed", err);
      showAppToast(err.message || "闁告帞濞€濞呭孩鎯旈弮鍌涙殢濠㈡儼绮剧憴?, "error");
    });
  });

  document.getElementById("appManagerSearch")?.addEventListener("input", (event) => {
    state.appManagerFilterKeyword = String(event.target?.value || "").trim();
    renderManagedAppsTable();
  });
  document.getElementById("appManagerStatusFilter")?.addEventListener("change", (event) => {
    state.appManagerFilterStatus = String(event.target?.value || "all").trim().toLowerCase();
    renderManagedAppsTable();
  });
  document.getElementById("appManagerEnabledFilter")?.addEventListener("change", (event) => {
    state.appManagerFilterEnabled = String(event.target?.value || "all").trim().toLowerCase();
    renderManagedAppsTable();
  });

  table.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-app-action]");
    if (actionBtn) {
      const action = String(actionBtn.dataset.appAction || "").trim();
      const name = String(actionBtn.dataset.appName || "").trim();
      if (!name) return;
      if (action === "detail") {
        selectManagedApp(name, { forceDetail: true }).catch((err) => {
          console.error("load managed app detail failed", err);
          showAppToast("闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忛悹鍥烽檮閸庡繑寰勬潏顐バ?, "error");
        });
      } else if (action === "start") {
        startManagedApp(name).catch((err) => {
          console.error("start managed app failed", err);
          showAppToast(err.message || "闁告凹鍨版慨鈺傛償閺冨倹鏆忓鎯扮簿鐟?, "error");
        });
      } else if (action === "edit") {
        const app = (state.managedApps || []).find((x) => String(x?.name || "").trim() === name);
        if (app) openManagedAppEditorModal(app);
      } else if (action === "delete") {
        deleteManagedApp(name).catch((err) => {
          console.error("delete managed app failed", err);
          showAppToast(err.message || "闁告帞濞€濞呭孩鎯旈弮鍌涙殢濠㈡儼绮剧憴?, "error");
        });
      }
      return;
    }

    const row = event.target.closest("tr[data-app-name]");
    if (!row) return;
    const name = String(row.dataset.appName || "").trim();
    if (!name) return;
    selectManagedApp(name).catch((err) => {
      console.error("select managed app failed", err);
      showAppToast("闁告帒娲﹀畷鍙夋償閺冨倹鏆忓鎯扮簿鐟?, "error");
    });
  });
}

async function loadManagedApps(force = false) {
  if (!force && Array.isArray(state.managedApps) && state.managedApps.length > 0) {
    renderManagedAppsSummary();
    renderManagedAppsTable();
    return state.managedApps;
  }

  const res = await fetchWithTimeout("/api/apps", 12000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忕紒鐙呯磿閹﹪寮悧鍫濈ウ濠㈡儼绮剧憴?);
  }
  state.managedApps = Array.isArray(data?.items) ? data.items : [];
  renderManagedAppsSummary();
  renderManagedAppsTable();

  const selected = String(state.appManagerSelectedName || "").trim();
  const hasSelected = state.managedApps.some((item) => String(item?.name || "").trim() === selected);
  const fallback = String(state.managedApps[0]?.name || "").trim();
  const next = hasSelected ? selected : fallback;

  if (!next) {
    state.appManagerSelectedName = "";
    state.appManagerDetail = null;
    state.appManagerDetailLoading = false;
    renderManagedAppDetail();
    updateAppManagerActionButtons();
    return state.managedApps;
  }

  await selectManagedApp(next, { forceDetail: true });
  return state.managedApps;
}

function renderManagedAppsSummary() {
  const items = Array.isArray(state.managedApps) ? state.managedApps : [];
  let up = 0;
  let down = 0;
  let disabled = 0;
  items.forEach((item) => {
    const enabled = !!item?.enabled;
    if (!enabled) {
      disabled += 1;
      return;
    }
    if (String(item?.status || "").trim().toLowerCase() === "up") {
      up += 1;
    } else {
      down += 1;
    }
  });
  setText("appManagerKpiTotal", num(items.length));
  setText("appManagerKpiUp", num(up));
  setText("appManagerKpiDown", num(down));
  setText("appManagerKpiDisabled", num(disabled));
  setText(
    "appManagerSummaryText",
    items.length
      ? `闁?${num(items.length)} 濞戞搩浜滅花鏌ユ偨椤帞绀夐弶鈺傚姌椤㈡垶绋?${num(up)} 濞戞搩浜风槐婵嬪嫉椤忓洨绠ラ悶?${num(down)} 濞戞搩浜风槐婵堢矉娴ｇ儤鏆?${num(disabled)} 濞戞挾瀵?      : "鐟滅増鎸告晶鐘测柦閳╁啯绠掗幖瀛樻⒒閺併倝鏁嶅畝鍐惧殲闁绘劗鎳撻崵顕€鍨惧鍕厐濠⒀呭仜缁ㄦ煡鎮介妸鈶╁亾濠靛棛纾诲┑顔碱儔閸樸倗绱?,
  );
}

function filteredManagedApps() {
  const items = Array.isArray(state.managedApps) ? state.managedApps : [];
  const keyword = String(state.appManagerFilterKeyword || "").trim().toLowerCase();
  const statusFilter = String(state.appManagerFilterStatus || "all").trim().toLowerCase();
  const enabledFilter = String(state.appManagerFilterEnabled || "all").trim().toLowerCase();

  return items.filter((item) => {
    const status = String(item?.status || "").trim().toLowerCase() || "down";
    const enabled = !!item?.enabled;

    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (enabledFilter === "enabled" && !enabled) return false;
    if (enabledFilter === "disabled" && enabled) return false;

    if (!keyword) return true;
    const searchable = [
      item?.name,
      item?.type,
      item?.owner,
      item?.work_dir,
      item?.start_command,
      ...(Array.isArray(item?.process_names) ? item.process_names : []),
      ...(Array.isArray(item?.ports) ? item.ports.map((port) => String(port || "")) : []),
    ]
      .map((x) => String(x || "").toLowerCase())
      .join(" ");
    return searchable.includes(keyword);
  });
}

function renderManagedAppsTable() {
  const table = document.getElementById("appManagerTable");
  if (!table) return;

  const items = filteredManagedApps();
  const selectedName = String(state.appManagerSelectedName || "").trim();
  const rows = items.map((item) => {
    const name = String(item?.name || "").trim();
    const enabled = !!item?.enabled;
    const statusRaw = String(item?.status || "").trim().toLowerCase();
    const statusText = !enabled ? "缂佸倷鑳堕弫? : statusRaw === "up" ? "閺夆晜鍔橀、鎴炵▔? : "闁哄牜浜ｇ换宥囨偘?;
    const badgeClass = !enabled ? "unknown" : statusRaw === "up" ? "up" : "down";
    return {
      rowClass: name === selectedName ? "app-manager-row-selected" : "",
      attrs: { "data-app-name": name },
      cells: [
        `<strong>${escapeHTML(name || "-")}</strong>`,
        escapeHTML(item?.type || "application"),
        `<span class="badge ${badgeClass}">${escapeHTML(statusText)}</span>`,
        escapeHTML(item?.owner || "-"),
        escapeHTML(num(item?.process_count || 0)),
        `${escapeHTML(bytes(item?.bytes_in || 0))} / ${escapeHTML(bytes(item?.bytes_out || 0))}`,
        escapeHTML(item?.last_start_status || "-"),
        `<div class="app-manager-row-ops">
          <button class="btn sm" type="button" data-app-action="detail" data-app-name="${escapeHTML(name)}">閻犲浄闄勯崕?/button>
          <button class="btn sm" type="button" data-app-action="start" data-app-name="${escapeHTML(name)}" ${enabled ? "" : "disabled"}>闁告凹鍨版慨?/button>
        </div>`,
      ],
    };
  });

  table.innerHTML = renderTableHTML(["閹煎瓨姊婚弫?, "缂侇偉顕ч悗?, "闁绘鍩栭埀?, "閻犳劗鍠曢惌妤佺?, "閺夆晜绋撻埢濂稿极?, "闁?闁告垹鍎ょ粊锕傛煂?, "闁哄牃鍋撻弶鈺傚灥閹酣宕?, "闁瑰灝绉崇紞?], rows, true);
  updateAppManagerActionButtons();
}

function updateAppManagerActionButtons() {
  const name = String(state.appManagerSelectedName || "").trim();
  const selected = (state.managedApps || []).find((item) => String(item?.name || "").trim() === name) || null;
  const hasSelected = !!selected;
  const canStart = hasSelected && !!selected.enabled;
  const startBtn = document.getElementById("appManagerStartBtn");
  const editBtn = document.getElementById("appManagerEditBtn");
  const deleteBtn = document.getElementById("appManagerDeleteBtn");
  if (startBtn) startBtn.disabled = !canStart;
  if (editBtn) editBtn.disabled = !hasSelected;
  if (deleteBtn) deleteBtn.disabled = !hasSelected;
}

async function selectManagedApp(name, options = {}) {
  const appName = String(name || "").trim();
  if (!appName) return;
  state.appManagerSelectedName = appName;
  renderManagedAppsTable();
  updateAppManagerActionButtons();
  await loadManagedAppDetail(appName, !!options.forceDetail);
}

async function loadManagedAppDetail(name, force = false) {
  const appName = String(name || "").trim();
  if (!appName) {
    state.appManagerDetail = null;
    state.appManagerDetailLoading = false;
    renderManagedAppDetail();
    return null;
  }
  if (!force && state.appManagerDetail?.item?.name === appName) {
    renderManagedAppDetail();
    return state.appManagerDetail;
  }

  state.appManagerDetailLoading = true;
  renderManagedAppDetail();
  const res = await fetchWithTimeout(`/api/apps/${encodeURIComponent(appName)}/detail`, 12000);
  const data = await res.json();
  if (!res.ok) {
    state.appManagerDetailLoading = false;
    renderManagedAppDetail();
    throw new Error(data.error || "闁告梻濮惧ù鍥ㄦ償閺冨倹鏆忛悹鍥烽檮閸庡繑寰勬潏顐バ?);
  }
  if (String(state.appManagerSelectedName || "").trim() !== appName) {
    return data;
  }
  state.appManagerDetail = data || null;
  state.appManagerDetailLoading = false;
  renderManagedAppDetail();
  return state.appManagerDetail;
}

function renderManagedAppDetail() {
  const box = document.getElementById("appManagerDetailBody");
  if (!box) return;
  const selectedName = String(state.appManagerSelectedName || "").trim();
  if (!selectedName) {
    box.innerHTML = '<div class="hint">閻犲洨鍏橀埀顒€顦扮€氥劌顔忛敂鎸庢珷閹煎瓨姊婚弫銈夊蓟閵壯勭畽閻犲浄闄勯崕?/div>';
    return;
  }
  if (state.appManagerDetailLoading) {
    box.innerHTML = `<div class="hint">婵繐绲藉﹢顏堝礉閻樼儤绁?${escapeHTML(selectedName)} 閻犲浄闄勯崕?..</div>`;
    return;
  }
  const detail = state.appManagerDetail || {};
  const item = detail.item || {};
  if (String(item.name || "").trim() !== selectedName) {
    box.innerHTML = `<div class="hint">閻忓繑纰嶅﹢顓㈠礉閻樼儤绁伴柛?${escapeHTML(selectedName)} 闁汇劌瀚娑㈠箚閸滃啰绀夐悹鍥棑閳笺垽宕ユ惔銊ユ閻?/div>`;
    return;
  }

  const processRows = (Array.isArray(detail.process_details) ? detail.process_details : []).slice(0, 24).map((proc) => [
    escapeHTML(proc?.name || "-"),
    escapeHTML(proc?.pid || "-"),
    `${escapeHTML(fixed(proc?.cpu_percent || 0))}% / ${escapeHTML(fixed(proc?.memory_percent || 0))}%`,
    `${escapeHTML(bytes(proc?.read_bytes || 0))} / ${escapeHTML(bytes(proc?.write_bytes || 0))}`,
    escapeHTML(proc?.status || "-"),
  ]);
  const trafficRows = (Array.isArray(detail.traffic_connections) ? detail.traffic_connections : []).slice(0, 24).map((conn) => [
    escapeHTML(conn?.process_name || "-"),
    escapeHTML(conn?.pid || "-"),
    escapeHTML(String(conn?.protocol || "-").toUpperCase()),
    escapeHTML(conn?.status || "-"),
    escapeHTML(`${conn?.local_ip || "-"}:${conn?.local_port || 0}`),
    escapeHTML(`${conn?.remote_ip || "-"}:${conn?.remote_port || 0}`),
    `${escapeHTML(bytes(conn?.bytes_in || 0))} / ${escapeHTML(bytes(conn?.bytes_out || 0))}`,
  ]);
  const envRows = Object.entries(item?.env || {}).map(([key, value]) => [
    escapeHTML(key),
    escapeHTML(value),
  ]);
  const portText = Array.isArray(item?.ports) && item.ports.length ? item.ports.join(", ") : "-";
  const processText = Array.isArray(item?.process_names) && item.process_names.length ? item.process_names.join(", ") : "-";
  const logText = Array.isArray(item?.log_files) && item.log_files.length ? item.log_files.join(", ") : "-";

  box.innerHTML = `
    <div class="app-manager-detail-summary">
      <div><label>閹煎瓨姊婚弫銈夊触瀹ュ泦?/label><strong>${escapeHTML(item?.name || "-")}</strong></div>
      <div><label>缂侇偉顕ч悗?/label><span>${escapeHTML(item?.type || "application")}</span></div>
      <div><label>闁绘鍩栭埀?/label><span>${escapeHTML(item?.enabled ? (String(item?.status || "").toLowerCase() === "up" ? "閺夆晜鍔橀、鎴炵▔? : "闁哄牜浜ｇ换宥囨偘?) : "缂佸倷鑳堕弫?)}</span></div>
      <div><label>閻犳劗鍠曢惌妤佺?/label><span>${escapeHTML(item?.owner || "-")}</span></div>
      <div><label>闁告凹鍨版慨鈺呭川閹存帗濮?/label><code>${escapeHTML(item?.start_command || "-")}</code></div>
      <div><label>Shell/闁烩晩鍠栫紞?/label><span>${escapeHTML(item?.shell || "-")} / ${escapeHTML(item?.work_dir || "-")}</span></div>
      <div><label>閺夆晜绋撻埢濂稿礌瑜版帒甯?/label><span>${escapeHTML(processText)}</span></div>
      <div><label>缂佹棏鍨拌ぐ?/label><span>${escapeHTML(portText)}</span></div>
      <div><label>闁哄啨鍎辩换鏃堝棘閸ワ附顐?/label><span>${escapeHTML(logText)}</span></div>
      <div><label>闁稿鍎遍幃宥呂涢埀顒勫蓟?/label><span>${escapeHTML(item?.health_url || item?.health_cmd || "-")}</span></div>
      <div><label>濠㈣泛娲﹂弫?/label><span>${escapeHTML(item?.notes || "-")}</span></div>
      <div><label>闁哄牃鍋撻弶鈺傚灥閹酣宕?/label><span>${escapeHTML(item?.last_start_at ? formatTimeValue(item.last_start_at) : "-")} / ${escapeHTML(item?.last_start_message || "-")}</span></div>
    </div>
    <div class="app-manager-detail-grid">
      <article class="app-manager-detail-block">
        <h4>閺夆晜绋撻埢濂稿及鎼达絿鐭庨柨娑樼墕婢?24 闁哄妲勭槐?/h4>
        <div class="table app-manager-detail-table">${renderTableHTML(["閺夆晜绋撻埢?, "PID", "CPU/闁告劕鎳庨悺?, "閻?闁告劖鐟ラ悺褔鎳?, "闁绘鍩栭埀?], processRows, true)}</div>
      </article>
      <article class="app-manager-detail-block">
        <h4>閺夆晝鍋炵敮鏉懨规笟鈧崳娲晬閸繂顤?24 闁哄妲勭槐?/h4>
        <div class="table app-manager-detail-table">${renderTableHTML(["閺夆晜绋撻埢?, "PID", "闁告绻楅?, "閺夆晝鍋炵敮鎾偐閼哥鍋?, "闁哄牜鍓欏﹢鎾捶閺夋寧绲?, "閺夆晜绮庨顒勫捶閺夋寧绲?, "闁?闁告垹鍎ょ粊锕傛煂?], trafficRows, true)}</div>
      </article>
    </div>
    <article class="app-manager-detail-block">
      <h4>闁绘粠鍨伴。銊╁矗濮椻偓閸?/h4>
      <div class="table app-manager-detail-table">${renderTableHTML(["闁告瑦锕㈤崳娲触?, "闁告瑦锕㈤崳娲磹?], envRows, true)}</div>
    </article>
  `;
}

function openManagedAppEditorModal(app) {
  const current = app || {};
  const isEdit = !!app;
  const processNames = Array.isArray(current.process_names) ? current.process_names.join("\n") : "";
  const ports = Array.isArray(current.ports) ? current.ports.join(",") : "";
  const logFiles = Array.isArray(current.log_files) ? current.log_files.join("\n") : "";
  const envText = Object.entries(current.env || {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const html = `
    <section class="app-editor-modal">
      <div class="row">
        <input id="appEditorName" class="input" placeholder="閹煎瓨姊婚弫銈夊触瀹ュ泦鐐烘晬閸繃鏆滃☉鎾亾闁? value="${escapeHTML(current.name || "")}" />
        <select id="appEditorType" class="input sm">
          <option value="application" ${(current.type || "application") === "application" ? "selected" : ""}>application</option>
          <option value="service" ${current.type === "service" ? "selected" : ""}>service</option>
          <option value="batch" ${current.type === "batch" ? "selected" : ""}>batch</option>
        </select>
        <label class="app-editor-enable-toggle">
          <input id="appEditorEnabled" type="checkbox" ${current.enabled !== false ? "checked" : ""} />
          闁告凹鍨抽弫?        </label>
      </div>
      <div class="row">
        <input id="appEditorOwner" class="input sm" placeholder="閻犳劗鍠曢惌妤佺閻氬绀勯柛娆樺灦閳ь剙顧€缁? value="${escapeHTML(current.owner || "")}" />
        <input id="appEditorShell" class="input sm" placeholder="閺夆晜鍔橀、?Shell闁挎稑鑻々?powershell/sh/bash" value="${escapeHTML(current.shell || "")}" />
        <input id="appEditorWorkDir" class="input" placeholder="鐎规悶鍎扮紞鏃堟儎椤旇偐绉块柨娑樼墕瑜版煡鏌呮径娑氱" value="${escapeHTML(current.work_dir || "")}" />
      </div>
      <div class="row">
        <input id="appEditorStartCommand" class="input" placeholder="闁告凹鍨版慨鈺呭川閹存帗濮㈤柨娑樼墔缁躲儲淇婇崒锔剧獥java -jar app.jar闁? value="${escapeHTML(current.start_command || "")}" />
      </div>
      <div class="row">
        <input id="appEditorHealthURL" class="input" placeholder="闁稿鍎遍幃宥呂涢埀顒勫蓟?URL闁挎稑鐗嗚ぐ鏌ユ焻婢舵稓绀? value="${escapeHTML(current.health_url || "")}" />
        <input id="appEditorHealthCmd" class="input" placeholder="闁稿鍎遍幃宥呂涢埀顒勫蓟閵夈儲鍤掑ù鐘€х槐娆撳矗椤栫偐鍋撴径娑氱" value="${escapeHTML(current.health_cmd || "")}" />
      </div>
      <div class="row app-editor-grid-row">
        <label class="field app-editor-field">
          <span>閺夆晜绋撻埢濂稿礌瑜版帒甯抽柨娑樼墛閻︼紕鎮扮仦鑲╊伇濞戞搩浜风槐?/span>
          <textarea id="appEditorProcessNames" class="input" rows="5" placeholder="java\\nnginx\\npython">${escapeHTML(processNames)}</textarea>
        </label>
        <label class="field app-editor-field">
          <span>缂佹棏鍨拌ぐ娑㈠礆濡ゅ嫨鈧啴鏁嶉崼锝咁伆闁哄倸娲埀顒侇殔瑜板潡宕氶崱娑欘吘闁?/span>
          <textarea id="appEditorPorts" class="input" rows="5" placeholder="8080,8081,3306">${escapeHTML(ports)}</textarea>
        </label>
      </div>
      <div class="row app-editor-grid-row">
        <label class="field app-editor-field">
          <span>闁哄啨鍎辩换鏃堝棘閸ワ附顐介柨娑樼墛閻︼紕鎮扮仦鑲╊伇濞戞搩浜风槐?/span>
          <textarea id="appEditorLogFiles" class="input" rows="5" placeholder="/var/log/app.log">${escapeHTML(logFiles)}</textarea>
        </label>
        <label class="field app-editor-field">
          <span>闁绘粠鍨伴。銊╁矗濮椻偓閸ｆ椽鏁嶉崼鐔烘Ж閻?KEY=VALUE闁?/span>
          <textarea id="appEditorEnv" class="input" rows="5" placeholder="JAVA_HOME=/usr/lib/jvm\\nAPP_ENV=prod">${escapeHTML(envText)}</textarea>
        </label>
      </div>
      <div class="row">
        <input id="appEditorDescription" class="input" placeholder="閹煎瓨姊婚弫銈夊箵韫囨艾鐗氶柨娑樼墕瑜版煡鏌呮径娑氱" value="${escapeHTML(current.description || "")}" />
      </div>
      <div class="row">
        <textarea id="appEditorNotes" class="input" rows="3" placeholder="濠㈣泛娲﹂弫鐐烘晬閸繂璁查梺顐㈩檧缁?>${escapeHTML(current.notes || "")}</textarea>
      </div>
      <div class="row app-editor-actions">
        <button id="appEditorSaveBtn" class="btn" type="button">${isEdit ? "濞ｅ洦绻傞悺銊︾┍椤旇姤鏆? : "闁告帗绋戠紓鎾存償閺冨倹鏆?}</button>
      </div>
    </section>
  `;
  openModal(isEdit ? `缂傚倹鐗炵欢顐ｆ償閺冨倹鏆忛柨?{current.name || ""}` : "闁哄倹婢橀·鍐╂償閺冨倹鏆?, html, { modalClass: "app-editor-modal-wrap" });

  document.getElementById("appEditorSaveBtn")?.addEventListener("click", async () => {
    const originalName = String(current.name || "").trim();
    const name = getInputValue("appEditorName");
    if (!name) {
      showAppToast("閹煎瓨姊婚弫銈夊触瀹ュ泦鐐寸▔瀹ュ牆鍘村☉鎾规閳?, "warning");
      return;
    }
    const payload = {
      name,
      type: getInputValue("appEditorType") || "application",
      enabled: document.getElementById("appEditorEnabled")?.checked ?? true,
      start_command: getInputValue("appEditorStartCommand"),
      shell: getInputValue("appEditorShell"),
      work_dir: getInputValue("appEditorWorkDir"),
      process_names: splitLineValues(document.getElementById("appEditorProcessNames")?.value || ""),
      ports: parsePortValues(document.getElementById("appEditorPorts")?.value || ""),
      health_url: getInputValue("appEditorHealthURL"),
      health_cmd: getInputValue("appEditorHealthCmd"),
      log_files: splitLineValues(document.getElementById("appEditorLogFiles")?.value || ""),
      description: getInputValue("appEditorDescription"),
      owner: getInputValue("appEditorOwner"),
      notes: String(document.getElementById("appEditorNotes")?.value || "").trim(),
      env: parseEnvValues(document.getElementById("appEditorEnv")?.value || ""),
    };

    const url = isEdit ? `/api/apps/${encodeURIComponent(originalName)}` : "/api/apps";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showAppToast(data.error || `${isEdit ? "闁哄洤鐡ㄩ弻? : "闁告帗绋戠紓?}閹煎瓨姊婚弫銈嗗緞鏉堫偉袝`, "error");
      return;
    }
    closeModal();
    showAppToast(isEdit ? "閹煎瓨姊婚弫銈夋煀瀹ュ洨鏋傜€圭寮跺ú鍧楀棘? : "閹煎瓨姊婚弫銈夊礆濞戞绱﹂柟瀛樺姇婵?, "success");
    await loadManagedApps(true);
    await selectManagedApp(name, { forceDetail: true });
  });
}

async function deleteManagedApp(name) {
  const appName = String(name || "").trim();
  if (!appName) return;
  if (!confirm(`缁绢収鍠涢濠氬礆閻樼粯鐝熼幖瀛樻⒒閺併倝濡?{appName}闁靛棗绋勭槐鐢垫嫚閵夛附鎯欏ù锝嗙矆缁变即寮寸€涙ɑ鐓€闂佹澘绉堕悿鍡涘棘閸ワ附顐介柕鍡曠箹)) return;
  const res = await fetch(`/api/apps/${encodeURIComponent(appName)}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "闁告帞濞€濞呭孩鎯旈弮鍌涙殢濠㈡儼绮剧憴?);
  }
  showAppToast(`鐎瑰憡褰冮崹褰掓⒔閵堝懐瀹夐柣銏╃厜缁?{appName}`, "success");
  if (String(state.appManagerSelectedName || "").trim() === appName) {
    state.appManagerSelectedName = "";
    state.appManagerDetail = null;
  }
  await loadManagedApps(true);
}

async function startManagedApp(name) {
  const appName = String(name || "").trim();
  if (!appName) return;
  const res = await fetch(`/api/apps/${encodeURIComponent(appName)}/start`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "闁告凹鍨版慨鈺傛償閺冨倹鏆忓鎯扮簿鐟?);
  }
  const pid = Number(data?.pid || 0);
  showAppToast(pid > 0 ? `閹煎瓨姊婚弫銈咁啅閹绘帗鍎欓柛鏃戠厜缁辨純ID=${pid}` : "閹煎瓨姊婚弫銈夊触椤栨艾袟闁告稒鍨濋幎銈咁啅閸欏鈷旈悶?, "success");
  await loadManagedApps(true);
  await selectManagedApp(appName, { forceDetail: true });
}

function splitLineValues(raw) {
  return String(raw || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePortValues(raw) {
  const values = String(raw || "")
    .split(/[\s,;\r\n]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0 && item <= 65535);
  return Array.from(new Set(values)).map((item) => Math.round(item));
}

function parseEnvValues(raw) {
  const out = {};
  String(raw || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) return;
      out[key] = value;
    });
  return out;
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
  const select = document.getElementById("logSourceSelect");
  const deleteBtn = document.getElementById("logDeleteCardBtn");
  if (!select) return;

  const apps = Array.isArray(state.apps) ? state.apps : [];
  const currentName = String(state.currentApp?.name || "").trim();
  const hasCurrent = apps.some((x) => String(x?.name || "").trim() === currentName);

  const options = [];
  if (!apps.length) {
    options.push('<option value="">闁哄棗鍊瑰Λ銈夊籍閵夈儳绠舵繝?/option>');
  } else {
    options.push('<option value="">閻犲洨鍏橀埀顒€顦扮€氥劑寮妷銉х婵?/option>');
    apps.forEach((app) => {
      const name = String(app?.name || "").trim();
      if (!name) return;
      const typeText = localizeLogSourceType(app?.type);
      const fileCount = Number(app?.log_files?.length || 0);
      options.push(`<option value="${escapeHTML(name)}">${escapeHTML(`${name} [${typeText}] (${fileCount} 濞戞搩浜濆Λ鈺勭疀濡や胶鐖?`)}</option>`);
    });
  }

  select.innerHTML = options.join("");
  select.value = hasCurrent ? currentName : "";
  if (deleteBtn) deleteBtn.disabled = !hasCurrent;
}

function handleLogSourceChange() {
  const select = document.getElementById("logSourceSelect");
  if (!select) return;
  const nextName = String(select.value || "").trim();
  if (!nextName) {
    state.currentApp = null;
    setText("logCurrentApp", "鐟滅増鎸告晶鐘诲籍閵夈儳绠舵繝褎鍔х槐浼村籍?);
    renderLogFileSelector();
    const result = document.getElementById("logResult");
    if (result) result.innerHTML = '<div class="hint">閻犲洨鍏橀埀顒€顦扮€氥劑寮妷銉х婵犙勫姇閹宕樺鍡欏弨閻?/div>';
    const stats = document.getElementById("logStats");
    if (stats) stats.innerHTML = "";
    renderAppCards();
    stopLogRealtimeLoop();
    return;
  }
  const app = (state.apps || []).find((x) => String(x?.name || "").trim() === nextName);
  if (!app) return;

  state.currentApp = app;
  setText("logCurrentApp", `鐟滅増鎸告晶鐘诲籍閵夈儳绠舵繝褎鍔х槐?{app.name}`);
  renderLogFileSelector();
  renderAppCards();
  queryLogs(false);
  syncLogRealtimeState("logs");
}

function localizeLogSourceType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "windows-eventlog") return "Windows 濞存粌顑勫▎銏ゅ籍閵夈儳绠?;
  if (t === "system-log") return "缂侇垵宕电划娲籍閵夈儳绠?;
  if (t === "app-log") return "閹煎瓨姊婚弫銈夊籍閵夈儳绠?;
  if (t === "custom-log") return "闁煎浜滈悾鐐▕婢跺锛夐煫?;
  return t || "-";
}

function resolveDefaultLogCard() {
  if (!Array.isArray(state.apps) || !state.apps.length) return null;
  const system = state.apps.find((x) => {
    const name = String(x?.name || "").toLowerCase();
    const type = String(x?.type || "").toLowerCase();
    return name.includes("缂侇垵宕电划娲籍閵夈儳绠?) || name.includes("system log") || type.includes("system") || type.includes("eventlog");
  });
  return system || state.apps[0] || null;
}

function ensureCurrentLogCard(triggerQuery = false) {
  if (!Array.isArray(state.apps) || !state.apps.length) {
    state.currentApp = null;
    stopLogRealtimeLoop();
    renderAppCards();
    setText("logCurrentApp", "鐟滅増鎸告晶鐘诲籍閵夈儳绠舵繝褎鍔х槐浼村籍?);
    renderLogFileSelector();
    const result = document.getElementById("logResult");
    if (result) result.innerHTML = '<div class="hint">闁哄棗鍊瑰Λ銈夊籍閵夈儳绠舵繝褎鍔х槐婵堟嫚瀹勬澘甯ユ繛锝堫嚙婵?/div>';
    return;
  }

  const current = state.currentApp?.name;
  const matched = state.apps.find((x) => x.name === current);
  state.currentApp = matched || resolveDefaultLogCard();

  renderAppCards();
  if (state.currentApp) {
    setText("logCurrentApp", `鐟滅増鎸告晶鐘诲籍閵夈儳绠舵繝褎鍔х槐?{state.currentApp.name}`);
    renderLogFileSelector();
    if (triggerQuery) queryLogs(false);
    syncLogRealtimeState();
  }
}

function openAddLogCardModal() {
  const html = `
    <div class="system-detail-grid">
      <section class="system-detail-block">
        <h4>闁哄倹婢橀·鍐籍閵夈儳绠舵繝?/h4>
        <div class="row">
          <input id="newLogName" class="input" placeholder="闁哄啨鍎辩换鏂库攦閹邦剚鍊崇紒澶婂簻缁辨繃绗熺€ｎ亶娲ら柨娑欐皑闁绱掗悢鍛婏級闊?/ nginx闁哄啨鍎辩换? />
          <select id="newLogType" class="input">
            <option value="custom-log">闁煎浜滈悾鐐▕婢跺锛夐煫鍥殕閺嬪啯绂?/option>
            <option value="system-log">缂侇垵宕电划娲籍閵夈儳绠堕柡鍌氭矗濞?/option>
            <option value="windows-eventlog">Windows 濞存粌顑勫▎銏ゅ籍閵夈儳绠?/option>
          </select>
        </div>
        <div class="row">
          <input id="newLogDesc" class="input" placeholder="闁硅绻楅崼顏堟晬閸繂璁查梺顐㈩檧缁? />
        </div>
        <div class="row">
          <textarea id="newLogFiles" class="input" rows="5" style="width:100%;" placeholder="婵絽绻楅、鎴炵▔閳ь剚绋夐鍛級闊洦顨嗙花顕€濡撮崒娑欑€ù鐘哄煐濡晞绠涘Δ鈧崯鎾剁磼濠靛棭鍤?闁烩晝顭堥顔炬崉椤栨氨绐為柨娑欑焻indows 濞存粌顑勫▎銏ゅ籍閵夈儳绠堕柛鎰懇椤ｅ爼鏌嗛幘铏€抽柨娑樿嫰椤?System / Application / Security"></textarea>
        </div>
        <div class="row">
          <button id="saveNewLogCardBtn" class="btn">濞ｅ洦绻傞悺銊╁籍閵夈儳绠舵繝?/button>
        </div>
      </section>
    </div>
  `;
  openModal("婵烇綀顕ф慨鐐哄籍閵夈儳绠舵繝?, html);
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
      showAppToast("閻犲洤鍢查敐鐐哄礃濞嗘劖锛夐煫鍥殕缁噣宕ュ鍥?, "warning");
      return;
    }
    if (!logFiles.length) {
      showAppToast("閻犲洨鏌夐崵锔句焊閹存繐缍栭柛鎰懁缁斿瓨绋夐鍛級闊洦顨嗙花?, "warning");
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
    showAppToast(data.error || "闁哄倹婢橀·鍐籍閵夈儳绠舵繝褎鍔曢妵鎴犳嫻?, "error");
    return;
  }
  closeModal();
  await loadApps();
  showAppToast("闁哄啨鍎辩换鏂库攦閹邦厽鐓€濠⒀呭仦閸ㄦ岸宕?, "success");
}

async function deleteLogCard(name) {
  const appName = String(name || "").trim();
  if (!appName) return;
  if (!confirm(`缁绢収鍠涢濠氬礆閻樼粯鐝熼柡鍐﹀劚缁绘柨鈹冮幇鈹惧亾?{appName}闁靛棗绋勭槐绀?) return;
  const res = await fetch(`/api/logs/apps/${encodeURIComponent(appName)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁告帞濞€濞呭酣寮妷銉х婵犙勫姇閵囨垹鎷?, "error");
    return;
  }
  if (state.currentApp?.name === appName) {
    state.currentApp = null;
    stopLogRealtimeLoop();
  }
  await loadApps();
  showAppToast(`鐎瑰憡褰冮崹褰掓⒔閵堝棙锛夐煫鍥殕缁噣鏁?{appName}`, "success");
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
    if (!silent) showAppToast("閻犲洤鍢查崢娑㈡焻婢跺顏ラ柡鍐﹀劚缁绘柨鈹?, "warning");
    return;
  }

  const keyword = document.getElementById("logKeyword").value;
  const levelSelect = document.getElementById("logLevel");
  const level = normalizeLogLevelFilter(options.levelOverride || (errorOnly ? "error" : levelSelect?.value));
  if (levelSelect && levelSelect.value !== level) levelSelect.value = level;
  const rule = document.getElementById("logRule").value;
  const limit = document.getElementById("logLimit").value || "300";
  const q = new URLSearchParams({ keyword, level, rule, limit });

  let data = null;
  try {
    const res = await fetchWithTimeout(`/api/logs/${encodeURIComponent(state.currentApp.name)}?${q.toString()}`, 10000);
    data = await res.json();
    if (!res.ok) {
      if (!silent) showAppToast(data.error || "闁哄啨鍎辩换鏃堝蓟閵夘煈鍤勫鎯扮簿鐟?, "error");
      return;
    }
  } catch (err) {
    if (!silent) showAppToast("闁哄啨鍎辩换鏃堝蓟閵夘煈鍤勫鎯扮簿鐟?, "error");
    console.error("query logs failed", err);
    return;
  }

  const items = Array.isArray(data?.items) ? [...data.items] : [];
  items.sort((a, b) => parseLogTimeValue(a?.time) - parseLogTimeValue(b?.time));
  const levelCount = items.reduce((acc, item) => {
    const key = String(item.level || "info").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const stats = document.getElementById("logStats");
  if (stats) {
    stats.innerHTML = renderLogStats(levelCount, items.length, level);
  }

  const box = document.getElementById("logResult");
  if (!box) return;
  if (!items.length) {
    const stats = document.getElementById("logStats");
    if (stats) {
      stats.innerHTML = renderLogStats({}, 0, level);
    }
    box.innerHTML = '<div class="hint">鐟滅増鎸告晶鐘诲级閳ュ弶顐藉☉鎾愁儐閻ュ懘寮垫径濠冨殥濞戞搩鍘藉Λ鈺勭疀?/div>';
    return;
  }
  box.innerHTML = items
    .slice()
    .reverse()
    .map((item) => {
      const rowLevel = String(item.level || "info").toLowerCase();
      const rowCopy = buildLogEntryCopyText(item);
      const rowTitle = buildLogEntryTitle(item);
      return `
      <article class="log-entry-card ${escapeHTML(rowLevel)}" data-log-copy="${escapeHTML(rowCopy)}" title="${escapeHTML(rowTitle)}">
        <span class="log-entry-time">${escapeHTML(formatTimeValue(item.time))}</span>
        <span class="log-entry-level">${escapeHTML(String(item.level || "info").toUpperCase())}</span>
        <span class="log-entry-file" title="${escapeHTML(item.file || "-")}">${escapeHTML(shorten(item.file || "-", 64))}</span>
        <span class="log-entry-message" title="${escapeHTML(item.message || item.raw || "-")}">${escapeHTML(item.message || item.raw || "-")}</span>
      </article>
    `;
    })
    .join("");
  if (fromRealtime || !silent) box.scrollTop = box.scrollHeight;
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
    showAppToast("閻犲洤鍢查崢娑㈡焻婢跺顏ラ柡鍐﹀劚缁绘柨鈹?, "warning");
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
    showAppToast(data.error || "閻庣數鍘ч崵顓熷緞鏉堫偉袝", "error");
    return;
  }
  showAppToast("闁哄啨鍎辩换鏃傗偓鐢靛帶閸ゎ厽绂掔拠鎻掝潳鐎规瓕灏欓弫鎾诲箣?, "success");
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
    box.innerHTML = "<div class=\"script-item\"><div class=\"meta\">闁哄棗鍊瑰Λ銈夋嚇濮橆厽鎷遍柨娑樼焷椤曨剟宕楅崼婊呯憪濞磋偐濮伴埀?/div></div>";
    return;
  }

  state.scripts.forEach((s) => {
    const el = document.createElement("div");
    const params = Array.isArray(s.parameters) && s.parameters.length ? s.parameters.join(", ") : "-";
    el.className = "script-item";
    el.innerHTML = `
      <div class="title">${escapeHTML(s.name || "-")}</div>
      <div class="meta">闁圭瑳鍡╂斀闁? ${escapeHTML(s.shell || "闁煎浜滄慨?)} | 闁告瑥鍊归弳鐔肺熼埄鍐╃凡: ${escapeHTML(params)}</div>
      <div class="meta">${escapeHTML(s.description || "闁哄啰濮靛鎸庢交?)}</div>
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
  renderTable("scriptRunHistory", ["ID", "闁煎瓨纰嶅﹢?, "闁告瑥鍊归弳?, "闁绘鍩栭埀?, "鐎殿喒鍋撳┑顔碱儐濡炲倿姊?, "缂備焦鎸诲顐﹀籍閸洘锛?], rows, true);
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
  if (!state.backupSelectedSources.length && Array.isArray(data?.config?.files)) {
    state.backupSelectedSources = [...data.config.files];
  }
  if (!document.getElementById("backupTarget")?.value && data?.config?.storage_path) {
    document.getElementById("backupTarget").value = data.config.storage_path;
  }
  renderBackupSources();
  const rows = (data.items || []).map((x) => [
    x.id,
    x.type,
    x.name,
    `<span class="badge ${statusClass(x.status)}">${escapeHTML(localizeTaskStatus(x.status))}</span>`,
    x.path,
    x.message || "-",
    `<a href="/api/backups/download?path=${encodeURIComponent(x.path)}" target="_blank">濞戞挸顑堝ù?/a>`,
  ]);
  renderTable("backupList", ["ID", "缂侇偉顕ч悗?, "闁告艾绉惰ⅷ", "闁绘鍩栭埀?, "閻犱警鍨扮欢?, "濞ｅ洠鍓濇导?, "闁瑰灝绉崇紞?], rows, true);
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
  const modal = document.querySelector("#modalMask .modal");
  if (modal && activeModalClass) {
    modal.classList.remove(activeModalClass);
    activeModalClass = "";
  }
  const modalClass = String(options.modalClass || "").trim();
  if (modal && modalClass) {
    modal.classList.add(modalClass);
    activeModalClass = modalClass;
  }
  setModalContent(title, html);
  document.getElementById("modalMask").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  stopDockerLogStream();
  clearActiveTrendModalState();
  const modal = document.querySelector("#modalMask .modal");
  if (modal && activeModalClass) {
    modal.classList.remove(activeModalClass);
    activeModalClass = "";
  }
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
      const attrText = Array.isArray(row)
        ? ""
        : Object.entries(row?.attrs || {})
            .map(([k, v]) => {
              const key = escapeHTML(String(k || "").trim());
              const val = escapeHTML(String(v ?? ""));
              if (!key) return "";
              return ` ${key}="${val}"`;
            })
            .join("");
      const cells = Array.isArray(row) ? row : row?.cells || [];
      const cols = cells
        .map((col) => {
          if (allowHTML) return `<td>${col ?? ""}</td>`;
          return `<td>${escapeHTML(String(col ?? ""))}</td>`;
        })
        .join("");
      return rowClass ? `<tr class="${rowClass}"${attrText}>${cols}</tr>` : `<tr${attrText}>${cols}</tr>`;
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
  if (level === "tight") return "閻犙冨缁喚妲愯缁?;
  if (level === "high") return "閻犳劗鍠曞ù鍥磻韫囨稓褰?;
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
    tag.textContent = "閻犙冨缁喚妲愯缁?;
  } else if (level === "high") {
    tag.textContent = "閻犳劗鍠曞ù鍥磻韫囨稓褰?;
  } else {
    tag.textContent = "閻庡湱鍋炲?;
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
  if (pid <= 0) return "缂侇垵宕电划鐑樻交濞戞埃鏌?;
  return `PID-${pid}`;
}

function displayPortPath(item) {
  const path = String(item?.exe_path || "").trim();
  if (path) return path;
  const name = String(item?.process_name || "").trim();
  if (name) return `${name}闁挎稑鐗愰惌鎯ь嚗閸曨偄缍€闂傚嫭鍔х槐姝?
  const pid = Number(item?.pid || 0);
  if (pid <= 0) return "缂侇垵宕电划鐑樻交濞戞埃鏌ら柨娑樼墣閻儳顕ラ崟顐㈢秬闂傚嫭鍔х槐?;
  return `PID-${pid}闁挎稑鐗愰惌鎯ь嚗閸曨偄缍€闂傚嫭鍔х槐姝?
}

function localizePortStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "闁哄牜浜為悡?;
  if (["listen", "listening"].includes(v)) return "闁烩晜鍨甸幆澶嬬▔?;
  if (["established"].includes(v)) return "鐎瑰憡褰冪紓鎾剁博?;
  if (["close_wait"].includes(v)) return "缂佹稑顦欢鐔煎礂閹惰姤锛?;
  if (["time_wait"].includes(v)) return "缂佹稑顦欢鐔煎炊閻愬瓨鏆?;
  if (["syn_sent"].includes(v)) return "闁告瑦鍨奸幑锝嗘交閻愭潙澶?;
  if (["syn_recv"].includes(v)) return "闁规亽鍎查弫瑙勬交閻愭潙澶?;
  if (["fin_wait_1", "fin_wait_2", "closing", "last_ack", "close"].includes(v)) return "闁稿繑濞婂Λ瀛樼▔?;
  return String(raw);
}

function resolveOSIcon(info) {
  const raw = [info?.os_type, info?.platform, info?.version]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (!raw) return "妫ｅ啯宕?;
  if (/(windows|win32|win64|microsoft)/.test(raw)) return "妫ｅ啰宓?;
  if (/(darwin|macos|mac os|os x|apple)/.test(raw)) return "妫ｅ啫纾?;
  if (/(linux|ubuntu|debian|centos|fedora|rhel|redhat|suse|arch|alpine|kylin|uos|濡よ甯＄花绶楃紓浣哄枍娣?/.test(raw)) return "妫ｅ啯鍎?;
  return "妫ｅ啯宕?;
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
      label: "闁瑰灝绉崇紞鏃傚寲閼姐倗鍩?,
      value: osDisplay,
      full: osDisplay,
      multiline: true,
      itemClass: "os-highlight",
    },
    {
      label: "缂侇垵宕电划娲几閼哥數鈧?,
      value: architecture,
      full: architecture,
    },
    {
      label: "缂傚啯鍨圭划绂漃",
      value: String(network.primary_ip || "-"),
      full: String(network.primary_ip || "-"),
    },
    {
      label: "缁绢収鍓涘ú蹇旀償韫囨挸鐏欓柛?,
      value: shortId(diskSerial),
      full: diskSerial,
    },
    {
      label: "閻犙冨缁喖顫楅崒婵愭綌",
      value: resource,
      full: resource,
    },
  ];

  box.innerHTML = items
    .map((x) => {
      const baseClass = x.multiline ? "system-info-value multiline" : "system-info-value";
      const valueClass = x.itemClass ? `${baseClass} ${x.itemClass}-value` : baseClass;
      const itemClass = x.itemClass ? `system-info-item ${x.itemClass}` : "system-info-item";
      const fullText = `${x.label}闁?{String(x.full || "-").replace(/\n/g, " / ")}`;
      return `
      <div
        class="${itemClass}"
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
    parts.push(`${num(core)}闁哄秶顭堢缓缍?;
  }

  const memoryGB = toRoundedGB(memory?.total || 0);
  if (memoryGB > 0) {
    parts.push(`${num(memoryGB)}GB闁告劕鎳庨悺鈺?;
  }

  const totalStorageBytes = resolveTotalStorageBytes(disks, diskHardware);
  const storageGB = toRoundedGB(totalStorageBytes);
  if (storageGB > 0) {
    parts.push(`${num(storageGB)}GB閻庢稒锚閸嬪硺);
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
    showCopyToast("鐟滅増鎸告晶鐘碘偓娑欘殕椤斿矂寮抽崒娑欙骏闁告瑯鍨伴ˇ鏌ュ礆鐠哄搫鏁堕悗?);
    return;
  }
  const ok = await copyText(text);
  if (ok) {
    showCopyToast(`鐎瑰憡褰冮ˇ鏌ュ礆鐠佸湱绐?{shorten(text, 36)}`);
    return;
  }
  showCopyToast("濠㈣泛绉撮崺妤佸緞鏉堫偉袝闁挎稑鐭侀顒勫箥鐎ｎ亜袟濠㈣泛绉撮崺?);
}

function openSystemInfoModal() {
  const snapshot = state.monitorSnapshot || {};
  openModal("缂侇垵宕电划鐑樼┍閳╁啩绱栭悹鍥烽檮閸?, renderSystemDetailHTML(snapshot));
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
    ["濞戞挾绮┃鈧柛?, os.hostname || "-"],
    ["闁瑰灝绉崇紞鏃傚寲閼姐倗鍩犵紒顐ヮ嚙閻?, `${os.os_type || os.platform || "-"}`],
    ["缂侇垵宕电划娲偋閸喐鎷?, os.version || "-"],
    ["闁告劕鎳忛悧鎶芥偋閸喐鎷?, os.kernel_version || "-"],
    ["閻犱焦鍎抽ˇ?ID", os.device_id || "-"],
    ["濞存籂鍐╂儌 ID", os.product_id || "-"],
    ["妤犵偛鍟胯ぐ?闁哄鍩栭悗?, os.platform || "-"],
    ["閺夆晜鍔橀、鎴﹀籍閸洘姣?, formatDuration(os.uptime)],
    ["閻犳劗鍠曞ù?1闁告帒妫濋幐?", formatLoad(os.load1)],
    ["閻犳劗鍠曞ù?5闁告帒妫濋幐?", formatLoad(os.load5)],
    ["閻犳劗鍠曞ù?15闁告帒妫濋幐?", formatLoad(os.load15)],
  ];
  sections.push(renderSystemDetailSection("缂侇垵宕电划鐑樼▔鎼淬倗绠ラ悶娑樺娣囧﹪骞?, renderTableHTML(["閻庢稒顨嗛?, "闁?], osRows)));

  const cpuRows = [
    ["CPU 闁搞劌顑呰ぐ?, cpu.model || "-"],
    ["CPU 闁哄鍩栭悗?, cpu.architecture || "-"],
    ["闁哄秶顭堢缓楣冨极?, num(cpu.core_count)],
    ["濞戞挸顭烽。?, `${fixed(cpu.frequency_mhz)} MHz`],
    ["鐟滅増鎸告晶鐘虫媴鐠恒劍鏆忛柣?, `${fixed(cpu.usage_percent)}%`],
  ];
  sections.push(renderSystemDetailSection("CPU 濞ｅ洠鍓濇导?, renderTableHTML(["閻庢稒顨嗛?, "闁?], cpuRows)));

  const memoryRows = [
    ["闁诡剝顕ч崬瀵糕偓?, bytes(memory.total)],
    ["鐎规瓕灏欓弫銈夊礃閸涱厾鎽?, bytes(memory.used)],
    ["闁告劕鎳庨悺銊︽媴鐠恒劍鏆忛柣?, `${fixed(memory.used_percent)}%`],
    ["濞存嚎鍊栧畷鏌ュ礆閸℃闅橀柟顒€顭烽崳?, bytes(memory.swap_total)],
    ["濞存嚎鍊栧畷鏌ュ礆閸℃闅樼€规瓕灏欓弫?, bytes(memory.swap_used)],
    ["濞存嚎鍊栧畷鏌ュ礆閸℃闅樺ù锝堟硶閺併倝鎮?, `${fixed(memory.swap_used_rate)}%`],
  ];
  sections.push(renderSystemDetailSection("闁告劕鎳庨悺銊︾┍閳╁啩绱?, renderTableHTML(["閻庢稒顨嗛?, "闁?], memoryRows)));

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
      renderSystemDetailSection("闁告劕鎳庨悺銊╁级閳╁啯顫栫紓?, renderTableHTML(["閹兼潙绻愯ぐ?, "闁告繀鑳舵晶?, "闁搞劌顑呰ぐ?, "濡増鍨瑰?, "閻庣懓缍婇崳?, "閹兼潙绻愰崹顏堝矗?], rows)),
    );
  }

  const networkRows = [
    ["鐟滅増鎸告晶鐘裁洪弰蹇曗攬缂傚啯鍨靛畷?, network.primary_nic || "-"],
    ["鐟滅増鎸告晶?IP", network.primary_ip || "-"],
    ["鐟滅増鎸告晶?MAC", network.primary_mac || "-"],
    ["鐟滅増鎸告晶鐘虫交閻愭潙澶嶉柡?, num(network.connection_count || 0)],
    ["缂侀硸鍨甸鎼佸礂閵夛妇銈﹂梺?, bytes(network.bytes_recv || 0)],
    ["缂侀硸鍨甸鎼佸礄閻戞銈﹂梺?, bytes(network.bytes_sent || 0)],
    ["缂侀硸鍨甸鎼佸礂閵夈儱鐦堕柡?, num(network.packets_in || 0)],
    ["缂侀硸鍨甸鎼佸礄閸濆嫬鐦堕柡?, num(network.packets_out || 0)],
  ];
  sections.push(renderSystemDetailSection("缂傚啯鍨圭划鑸电┍閳╁啩绱?, renderTableHTML(["閻庢稒顨嗛?, "闁?], networkRows)));

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
      renderSystemDetailSection("缂傚啯鍨靛畷閬嶅及鎼达絿鐭?, renderTableHTML(["閹兼潙绻愯ぐ?, "闁告艾绉惰ⅷ", "闁硅绻楅崼?, "MAC", "闂侇偆鍠撳?, "缂侇偉顕ч悗?, "闁绘鍩栭埀?], rows)),
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
    sections.push(renderSystemDetailSection("缁惧彞鑳跺ú蹇涘礆閸℃闅橀柣妯垮煐閳?, renderTableHTML(["闁圭鍊藉ù鍥倷?, "閻犱焦鍎抽ˇ?, "闁哄倸娲ｅ▎銏㈠寲閼姐倗鍩?, "濞达綀娉曢弫銈夋偝?, "閻庣懓缍婇崳?], rows)));
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
      renderSystemDetailSection("缁惧彞鑳跺ú蹇曟兜椤戞寧顐藉ǎ鍥ｅ墲娴?, renderTableHTML(["閹兼潙绻愯ぐ?, "閻犱焦鍎抽ˇ?, "闁搞劌顑呰ぐ?, "閹兼潙绻愰崹顏堝矗?, "闁规亽鍎辫ぐ?, "濞寸姴顑堝?, "閻庣懓缍婇崳?], rows)),
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
      renderSystemDetailSection("闁哄嫭鍎冲畷杈ㄧ┍閳╁啩绱?, renderTableHTML(["閹兼潙绻愯ぐ?, "闁告艾绉惰ⅷ", "闁告ê鍊搁弲?, "闁哄嫭鍎抽悺?, "濡炵懓宕慨鈺呮偋閸喐鎷?, "閻犱焦鍎抽ˇ?ID"], rows)),
    );
  } else {
    sections.push(renderSystemDetailSection("闁哄嫭鍎冲畷杈ㄧ┍閳╁啩绱?, `<div class="trend-empty">闁哄棗鍊瑰﹢顓㈡嚔瀹勬澘绲块柛鎺斿濡宕￠垾韫箚闁?/div>`));
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
    openModal("缁惧彞鑳跺ú蹇曟兜椤戞寧顐芥慨鐟版处閳?, `<div class="trend-empty">闁哄棗鍊瑰﹢顓㈡嚔瀹勬澘绲块柛鎺撳椤ュ棝鎯勫Ο灏栤偓鏍ㄧ閺堝吀绻嗛柟?/div>`);
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
  openModal("缁惧彞鑳跺ú蹇曟兜椤戞寧顐芥慨鐟版处閳?, renderTableHTML(["閹兼潙绻愯ぐ?, "閻犱焦鍎抽ˇ?, "闁搞劌顑呰ぐ?, "閹兼潙绻愰崹顏堝矗?, "闁规亽鍎辫ぐ?, "濞寸姴顑堝?, "閻庣懓缍婇崳?], rows));
}

function summarizeMemoryModules(modules) {
  const list = Array.isArray(modules) ? modules : [];
  if (!list.length) return "闁告劕鎳庨悺銊╁级閳ヨ弓绻嗛柟顓у灡濠€顓㈡嚔瀹勬澘绲?;
  const first = list[0] || {};
  const brand = shorten(String(first.manufacturer || "").trim() || "闁告繀鑳舵晶婵嬪嫉椤忓棛鍙€", 14);
  const model = shorten(String(first.model || "").trim() || "闁搞劌顑呰ぐ鍧楀嫉椤忓棛鍙€", 22);
  const freq = Number(first.frequency_mhz || 0) > 0 ? `${num(first.frequency_mhz)}MHz` : "濡増鍨瑰濂稿嫉椤忓棛鍙€";
  if (list.length === 1) return `${brand} ${model} ${freq}`;
  return `${brand} ${model} ${freq} 缂?${list.length} 闁哄鎽?
}

function summarizeDiskHardware(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "缁绢収鍏涘▎銏＄┍閳╁啩绱栭柡鍫海楠炲繘宕?;
  const first = list[0] || {};
  const model = String(first.model || "").trim() || String(first.name || "").trim() || "闁搞劌顑呰ぐ鍧楀嫉椤忓棛鍙€";
  const serial = String(first.serial || "").trim() || "閹兼潙绻愰崹顏堝矗闁垮寮撻柣?;
  if (list.length === 1) return `${shorten(model, 26)} | 閹兼潙绻愰崹顏堝矗?${shorten(serial, 20)}`;
  return `${shorten(model, 22)} 缂?${list.length} 闁秆勵暢;
}

function summarizeDiskHardwareDetail(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "缁绢収鍏涘▎銏＄┍閳╁啩绱栭柡鍫海楠炲繘宕?;
  const parts = list.slice(0, 2).map((x) => {
    const model = String(x.model || x.name || "闁搞劌顑呰ぐ鍧楀嫉椤忓棛鍙€").trim();
    const serial = String(x.serial || "閹兼潙绻愰崹顏堝矗闁垮寮撻柣?).trim();
    return `${shorten(model, 20)} / ${shorten(serial, 16)}`;
  });
  const suffix = list.length > 2 ? ` 缂?${list.length} 闁秆勵暢 : "";
  return `缁惧彞鑳跺ú蹇曟兜椤戞寧顐?${parts.join("闁?)}${suffix}`;
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
          <div class="kpi-title">CPU 闁告濮烽弫?/div>
          <div class="kpi-value">${fixed(data.cpu_percent)}%</div>
        </div>
        <div class="process-kpi-card mem">
          <div class="kpi-title">闁告劕鎳庨悺銊╁础閻樺灚鏆?/div>
          <div class="kpi-value">${fixed(data.memory_percent)}%</div>
        </div>
        <div class="process-kpi-card thread">
          <div class="kpi-title">缂佹崘娉曢埢濂稿极?/div>
          <div class="kpi-value">${num(data.threads)}</div>
        </div>
        <div class="process-kpi-card io">
          <div class="kpi-title">IO 闁诡剙顭烽崳?/div>
          <div class="kpi-value">${bytes(ioTotal)}</div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">闁糕晞娅ｉ、鍛┍閳╁啩绱?/div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">PID</span>
            <span class="process-kv-value">${num(data.pid)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">閺夆晜绋撻埢濂稿触?/span>
            <span class="process-kv-value">${escapeHTML(data.name || "-")}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">閺夆晜鍔橀、鎴︽偐閼哥鍋?/span>
            <span class="process-kv-value"><span class="process-status-badge ${statusCls}">${statusText}</span></span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">闁告凹鍨版慨鈺呭籍閸洘锛?/span>
            <span class="process-kv-value">${escapeHTML(created)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">闁告劕鎳庨悺銊ф嫚閿旇棄鍓?/div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">閻㈩垱鎮傞埞妤呭礃閸涱厾鎽?RSS</span>
            <span class="process-kv-value">${bytes(data.rss)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">闁惧繑纰嶇€氭瑩宕橀崨顓犳憼 VMS</span>
            <span class="process-kv-value">${bytes(data.vms)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">IO 閻犲浄闄勯崕?/div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">閻犲洩顕цぐ鍥┾偓娑欘殙婵?/span>
            <span class="process-kv-value">${bytes(data.read_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">闁告劖鐟ラ崣鍡欌偓娑欘殙婵?/span>
            <span class="process-kv-value">${bytes(data.write_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">閻犲洩顕цぐ鍥р枎閳╁啯娈?/span>
            <span class="process-kv-value">${num(data.read_count)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">闁告劖鐟ラ崣鍡椻枎閳╁啯娈?/span>
            <span class="process-kv-value">${num(data.write_count)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">闁圭瑳鍡╂斀閻犱警鍨扮欢?/div>
        <div class="process-code-block">${escapeHTML(data.exe_path || "-")}</div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">闁告凹鍨版慨鈺呭川閹存帗濮?/div>
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
  if (["running", "run", "r"].includes(v)) return "閺夆晜鍔橀、鎴炵▔?;
  if (["sleep", "sleeping", "idle", "wait", "wchan", "disk-sleep", "iowait"].includes(v)) return "缂佹稑顦欢鐔哥▔?;
  if (["stopped", "stop", "t"].includes(v)) return "鐎瑰憡褰冩禒鐘差潰?;
  if (["dead"].includes(v)) return "鐎规瓕灏欑划銊╁级?;
  if (["zombie", "z"].includes(v)) return "闁稿秹娼у鍫熸交濞戞埃鏌?;
  if (!v) return "闁哄牜浜為悡?;
  return `闁哄牜浜為悡?${escapeHTML(String(raw))})`;
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
  if (cls === "disk-high") return "濡ゅ倹锚瀹曚即鎮?;
  if (cls === "disk-warn") return "闂傚洠鍋撻柛蹇氭珪閺?;
  return "闁稿鍎遍幃?;
}

function localizeServiceType(raw) {
  const v = String(raw || "").trim().toLowerCase();
  const m = {
    application: "閹煎瓨姊婚弫?,
    database: "闁轰胶澧楀畵浣规償?,
    middleware: "濞戞搩鍙冨Λ鎸庣?,
    snmp: "SNMP",
    nmap: "Nmap 闁规鍋呭?,
    http: "HTTP",
    port: "缂佹棏鍨拌ぐ?,
  };
  return m[v] || (raw || "-");
}

function localizeServiceStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (["up", "running", "active", "healthy", "ok", "success", "listen", "listening"].includes(v)) return "婵繐绲介悥?;
  return "闁哄牜浜滈幆搴ㄥ礉?;
}

function localizeServiceDetail(raw) {
  let s = String(raw || "").trim();
  if (!s) return "-";
  const rules = [
    [/process not found/gi, "闁哄牜浜濇竟姗€宕氶幏宀€绠荤紒?],
    [/host up,\s*no open port/gi, "濞戞挾绮┃鈧柛锔哄妿閸ゅ酣鏁嶇仦鐐骏鐎殿喒鍋撻柡鈧崜褜浼傞柛?],
    [/host not found in nmap result/gi, "nmap 缂備焦鎸婚悘澶嬬▔椤撶喐寮撻柛娆愬灩楠炲洦绋夌紒妯荤皻"],
    [/no response/gi, "闁哄啰濮撮幖閿嬫償?],
    [/nmap unavailable/gi, "nmap 濞戞挸绉磋ぐ鏌ユ偨?],
    [/open ports/gi, "鐎殿喒鍋撻柡鈧崜褜浼傞柛?],
    [/open[_\s-]?ports/gi, "鐎殿喒鍋撻柡鈧崜褜浼傞柛?],
    [/connection refused/gi, "閺夆晝鍋炵敮瀵告偖椤愶絽鐝曠紓?],
    [/no such host/gi, "濞戞挾绮┃鈧☉鎾崇Т閻°劑宕?],
    [/i\/o timeout/gi, "I/O 閻℃帒鎳忓?],
    [/timed out/gi, "閺夆晝鍋炵敮瀵告惥閸涱喗顦?],
    [/dial tcp/gi, "TCP 閺夆晝鍋炵敮?],
    [/connectex/gi, "閺夆晝鍋炵敮鏉戭嚕閸屾氨鍩?],
    [/host is down/gi, "濞戞挾绮┃鈧紒鍌濆吹閸?],
    [/timeout/gi, "閻℃帒鎳忓?],
    [/unknown/gi, "闁哄牜浜為悡?],
    [/latency=/gi, "鐎点倖鍎肩换?"],
    [/addr=/gi, "闁革附婢樺?"],
  ];
  rules.forEach(([pattern, to]) => {
    s = s.replace(pattern, to);
  });
  return s;
}

function localizeTaskStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "闁哄牜浜為悡?;
  if (["running", "run", "processing"].includes(v)) return "闁圭瑳鍡╂斀濞?;
  if (["success", "ok", "completed", "done", "finished", "up"].includes(v)) return "闁瑰瓨鍔曟慨?;
  if (["failed", "error", "down"].includes(v)) return "濠㈡儼绮剧憴?;
  if (["pending", "queued", "waiting"].includes(v)) return "缂佹稑顦欢鐔哥▔?;
  if (["canceled", "cancelled"].includes(v)) return "鐎瑰憡褰冭ぐ鍥р槈?;
  if (["stopped", "stop"].includes(v)) return "鐎瑰憡褰冩禒鐘差潰?;
  if (["unknown"].includes(v)) return "闁哄牜浜為悡?;
  return String(raw || "闁哄牜浜為悡?);
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
  if (n < 1024) return `${formatUpTo2(n)} B`;
  if (n < 1024 ** 2) return `${formatUpTo2(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${formatUpTo2(n / 1024 ** 2)} MB`;
  if (n < 1024 ** 4) return `${formatUpTo2(n / 1024 ** 3)} GB`;
  return `${formatUpTo2(n / 1024 ** 4)} TB`;
}

function rateBytes(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${formatUpTo2(n)} B`;
  if (n < 1024 ** 2) return `${formatUpTo2(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${formatUpTo2(n / 1024 ** 2)} MB`;
  if (n < 1024 ** 4) return `${formatUpTo2(n / 1024 ** 3)} GB`;
  return `${formatUpTo2(n / 1024 ** 4)} TB`;
}

function num(v) {
  return Number(v || 0).toLocaleString();
}

function fixed(v) {
  return Number(v || 0).toFixed(1);
}

function formatUpTo2(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2).replace(/\.?0+$/, "");
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
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (res.status === 401) {
      handleAuthRequired("闁哄牜浜炲▍銉ㄣ亹閺囩喎鐏楅柣褑顕х紞宥咁啅閼煎墎绠栭柡鍫㈠櫐缁辨繄鎷犻悜钘夋闁哄倹澹嗗▍銉ㄣ亹?);
      throw new Error("unauthorized");
    }
    return res;
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

function debounceRuntimeLogReload() {
  if (runtimeLogDebounceTimer) clearTimeout(runtimeLogDebounceTimer);
  runtimeLogDebounceTimer = setTimeout(() => loadRuntimeLogs(true), 280);
}

function applySystemMenuVisibility() {
  const visibility = state.config?.system?.menu_visibility || {};
  document.querySelectorAll(".menu[data-section]").forEach((btn) => {
    const section = String(btn.dataset.section || "").trim();
    const enabled = section === "system" ? true : visibility[section] !== false;
    btn.classList.toggle("hidden", !enabled);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    const enabled = panel.id === "system" ? true : visibility[panel.id] !== false;
    panel.classList.toggle("hidden-by-config", !enabled);
    if (!enabled) panel.style.display = "none";
  });
  const activeBtn = document.querySelector(".menu.active:not(.hidden)");
  if (!activeBtn) {
    const fallbackBtn = document.querySelector(".menu[data-section]:not(.hidden)");
    if (fallbackBtn) {
      fallbackBtn.classList.add("active");
      switchSection(fallbackBtn.dataset.section);
    }
  }
}

async function applySystemConfigForm() {
  if (!state.config) return;
  setInputValue("systemSiteTitle", state.config?.system?.site_title || "");
  setInputValue("systemEnvironment", state.config?.system?.environment || "");
  setInputValue("systemOwner", state.config?.system?.owner || "");
  setInputValue("systemListen", state.config?.core?.web?.listen || "");
  setInputValue("systemDefaultShell", state.config?.system?.default_shell || "");
  setInputValue("systemDefaultWorkDir", state.config?.system?.default_work_dir || "");
  setInputValue("systemRefreshSeconds", state.config?.monitor?.refresh_seconds || 5);
  setInputValue("systemRuntimeLogPath", state.config?.system?.runtime_logs?.file_path || "");
  setInputValue("systemRuntimeLogMaxEntries", state.config?.system?.runtime_logs?.max_entries || 3000);
  setInputValue("systemMaxConcurrentTasks", state.config?.system?.performance?.max_concurrent_tasks || 4);
  setInputValue("systemCleanupProgressInterval", state.config?.system?.performance?.cleanup_progress_interval_ms || 300);
  setInputValue("systemDockerPageSize", state.config?.system?.performance?.docker_default_page_size || 20);
  renderSystemMenuVisibility();
}

function renderSystemMenuVisibility() {
  const box = document.getElementById("systemMenuVisibility");
  if (!box) return;
  const visibility = state.config?.system?.menu_visibility || {};
  const labels = {
    monitor: "缂侇垵宕电划娲儎閹寸偛浠?,
    logs: "闁哄啨鍎辩换鏃堝礆閸℃鈧?,
    "app-manager": "閹煎瓨姊婚弫銈囩不閿涘嫭鍊?,
    traffic: "閺夆晜绋撻埢鐓幟规笟鈧崳?,
    repair: "濞ｅ浂鍠栭ˇ鎻掝啅閵夈儱寰?,
    backup: "闁轰胶澧楀畵浣瑰緞閸ワ箑鏁?,
    cleanup: "闁轰胶澧楀畵浣搞€掗崨顖涘€?,
    docker: "Docker缂佺媴绱曢幃?,
    "remote-control": "閺夆晜绮庨埢濂稿箳瑜嶉崺?,
    "ssh-remote": "SSH閺夆晜绮庨埢?,
    system: "缂侇垵宕电划铏圭不閿涘嫭鍊?,
  };
  box.innerHTML = Object.entries(labels)
    .map(([key, label]) => {
      const checked = visibility[key] !== false ? "checked" : "";
      const disabled = key === "system" ? "disabled" : "";
      const title = key === "system" ? 'title="缂侇垵宕电划铏圭不閿涘嫭鍊炲☉鎾规〃缁绘碍鎯旈弴鐐插汲闁告瑱缍囩槐婵嬪炊閸濆嫮鏆伴柡鍕⒔閵?' : "";
      return `<label ${title}><input type="checkbox" class="system-menu-toggle" value="${key}" ${checked} ${disabled}>${label}</label>`;
    })
    .join("");
}

async function saveSystemConfig() {
  if (!state.config) return;
  const next = JSON.parse(JSON.stringify(state.config));
  next.system = next.system || {};
  next.system.runtime_logs = next.system.runtime_logs || {};
  next.system.performance = next.system.performance || {};
  next.core = next.core || {};
  next.core.web = next.core.web || {};
  next.monitor = next.monitor || {};

  next.system.site_title = getInputValue("systemSiteTitle");
  next.system.environment = getInputValue("systemEnvironment");
  next.system.owner = getInputValue("systemOwner");
  next.core.web.listen = getInputValue("systemListen");
  next.system.default_shell = getInputValue("systemDefaultShell");
  next.system.default_work_dir = getInputValue("systemDefaultWorkDir");
  next.monitor.refresh_seconds = Number(getInputValue("systemRefreshSeconds")) || 5;
  next.system.runtime_logs.file_path = getInputValue("systemRuntimeLogPath");
  next.system.runtime_logs.max_entries = Number(getInputValue("systemRuntimeLogMaxEntries")) || 3000;
  next.system.performance.max_concurrent_tasks = Number(getInputValue("systemMaxConcurrentTasks")) || 4;
  next.system.performance.cleanup_progress_interval_ms = Number(getInputValue("systemCleanupProgressInterval")) || 300;
  next.system.performance.docker_default_page_size = Number(getInputValue("systemDockerPageSize")) || 20;

  const visibility = {};
  document.querySelectorAll(".system-menu-toggle").forEach((input) => {
    visibility[String(input.value || "")] = !!input.checked;
  });
  visibility.system = true;
  next.system.menu_visibility = visibility;

  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "濞ｅ洦绻傞悺銊у寲閼姐倗鍩犻梺鏉跨Ф閻ゅ棙寰勬潏顐バ?, "error");
    return;
  }
  state.config = next;
  applySystemMenuVisibility();
  await applySystemConfigForm();
  showAppToast("缂侇垵宕电划娲煀瀹ュ洨鏋傜€规瓕寮撶换姘扁偓娑櫭懟鐔煎触鐏炵虎鍔勯柛鎺嶅嵆閸樸倗绱旈鑺ョ€ù?, "success");
}

async function loadRuntimeLogs(silent = false) {
  const keyword = getInputValue("runtimeLogKeyword");
  const level = getInputValue("runtimeLogLevel") || "all";
  const query = new URLSearchParams({ limit: "400", keyword, level });
  try {
    const res = await fetchWithTimeout(`/api/system/runtime-logs?${query.toString()}`, 12000);
    const data = await res.json();
    if (!res.ok) {
      if (!silent) showAppToast(data.error || "闁告梻濮惧ù鍥ㄦ交閹邦垼鏀介柡鍐﹀劚缁绘梹寰勬潏顐バ?, "error");
      return;
    }
    state.systemRuntimeLogs = Array.isArray(data.items) ? data.items : [];
    renderRuntimeLogs(data.config || {});
  } catch (err) {
    console.error("load runtime logs failed", err);
    if (!silent) showAppToast("闁告梻濮惧ù鍥ㄦ交閹邦垼鏀介柡鍐﹀劚缁绘梹寰勬潏顐バ?, "error");
  }
}

function renderRuntimeLogs(config = {}) {
  const meta = document.getElementById("runtimeLogMeta");
  if (meta) {
    meta.textContent = `闁哄啨鍎辩换鏃堝棘閸ワ附顐? ${config.file_path || "-"} | 缂傚倹鎸搁悺銊╁级閳╁啯娈? ${num(config.max_entries || state.systemRuntimeLogs.length || 0)} | 鐟滅増鎸告晶鐘诲及閸撗佷粵: ${num(state.systemRuntimeLogs.length)}`;
  }
  const box = document.getElementById("runtimeLogList");
  if (!box) return;
  if (!state.systemRuntimeLogs.length) {
    box.innerHTML = '<div class="hint">闁哄棗鍊瑰Λ銈嗘交閹邦垼鏀介柡鍐﹀劚缁?/div>';
    return;
  }
  box.innerHTML = state.systemRuntimeLogs
    .map((item) => `
      <article class="runtime-log-item ${escapeHTML(String(item.level || "info").toLowerCase())}">
        <header>
          <span>${escapeHTML(formatTimeValue(item.time))}</span>
          <span>${escapeHTML(String(item.level || "info").toUpperCase())}</span>
          <span>${escapeHTML(item.source || "runtime")}</span>
        </header>
        <div>${escapeHTML(item.text || "-")}</div>
      </article>
    `)
    .join("");
}

function renderBackupSources() {
  const box = document.getElementById("backupSourceList");
  const summary = document.getElementById("backupSourceSummary");
  const list = Array.isArray(state.backupSelectedSources) ? state.backupSelectedSources : [];
  if (summary) {
    summary.textContent = list.length ? `鐎瑰憡鐓￠埀顒€顦扮€?${list.length} 濞戞搩浜滈ˇ顒佺閼恒儳鐖遍柣鈺婂枛缂嶅硺 : "闁哄牜浜埀顒€顦扮€氥劍寰勯崶锕€鏁滄繝褎鍔х槐婵囶渶濡鍚囧ù锝堟硶閺併倝鏌婂鍥╂瀭闁哄倸娲ｅ▎銏＄▔椤撶姵鐣辨繝褎鍔楀ú鎷屻亹?;
  }
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<span class="hint">鐟滅増鎸告晶鐘诲嫉椤忓懎鐦归悗瑙勪亢閸ゆ粎鈧鐭粻鐔稿緞閸ワ箑鏁滄繝?/span>';
    return;
  }
  box.innerHTML = list
    .map((path) => `<label><span>${escapeHTML(path)}</span><button class="btn sm danger" type="button" data-backup-remove="${encodeURIComponent(path)}">缂佸顭峰▍?/button></label>`)
    .join("");
  box.querySelectorAll("button[data-backup-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = decodeURIComponent(String(btn.dataset.backupRemove || ""));
      state.backupSelectedSources = state.backupSelectedSources.filter((item) => item !== path);
      renderBackupSources();
    });
  });
}

async function createDirectory(path) {
  const res = await fetch("/api/fs/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "create directory failed");
  }
  return data.path;
}

async function loadFSRoots(force = false) {
  if (!force && fsModalRoots.length) return fsModalRoots;
  const res = await fetchWithTimeout("/api/fs/roots", 12000);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "load fs roots failed");
  fsModalRoots = Array.isArray(data.items) ? data.items : [];
  return fsModalRoots;
}

async function ensureFSTree(path) {
  const key = String(path || "").trim();
  if (state.fsTreeCache[key]) return state.fsTreeCache[key];
  const res = await fetchWithTimeout(`/api/fs/tree?path=${encodeURIComponent(key)}`, 15000);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "load fs tree failed");
  state.fsTreeCache[key] = Array.isArray(data.items) ? data.items.filter((item) => item.type === "directory") : [];
  return state.fsTreeCache[key];
}

async function openDirectoryPicker(options = {}) {
  fsModalConfirmHandler = typeof options.onConfirm === "function" ? options.onConfirm : null;
  fsModalMulti = options.multi !== false;
  fsModalAllowCreate = !!options.allowCreate;
  fsModalTitle = options.title || "闂侇偄顦扮€氥劑鎯勯鑲╃Э";
  state.fsModalMode = options.mode || "";
  state.fsModalSelected = Array.isArray(options.selected) ? [...options.selected] : [];
  fsModalExpanded = new Set();

  const roots = await loadFSRoots();
  roots.forEach((root) => fsModalExpanded.add(root.path));
  await Promise.all(roots.slice(0, 4).map((root) => ensureFSTree(root.path)));
  renderDirectoryPickerModal();
}

function renderDirectoryPickerModal() {
  const treeHTML = (nodes, depth = 0) =>
    `<ul class="fs-tree-level depth-${depth}">${nodes
      .map((node) => {
        const path = String(node.path || "");
        const encoded = encodeURIComponent(path);
        const expanded = fsModalExpanded.has(path);
        const isChecked = state.fsModalSelected.includes(path);
        const checked = isChecked ? "checked" : "";
        const children = expanded ? state.fsTreeCache[path] || [] : [];
        const toggleClass = node.has_children ? "has-children" : "is-leaf";
        const toggleDisabled = node.has_children ? "" : "disabled aria-disabled=\"true\"";
        return `
          <li class="fs-tree-node">
            <div class="fs-tree-row${isChecked ? " selected" : ""}" data-depth="${depth}">
              <button class="btn sm fs-tree-toggle ${toggleClass}" type="button" data-fs-expand="${encoded}" ${toggleDisabled}>${node.has_children ? (expanded ? "闁? : "+") : "鐠?}</button>
              <label class="fs-tree-label">
                <input type="${fsModalMulti ? "checkbox" : "radio"}" name="fs-picker" data-fs-select="${encoded}" ${checked} />
                <span title="${escapeHTML(path)}">${escapeHTML(node.name || path)}</span>
              </label>
            </div>
            ${expanded && children.length ? treeHTML(children, depth + 1) : ""}
          </li>
        `;
      })
      .join("")}</ul>`;

  const html = `
    <section class="fs-picker">
      <div class="fs-picker-toolbar">
        <div class="hint">闁烩晩鍠栫紞宥夊冀閹寸偞鏆滈柟闀愮椤﹀潡鏌呮径濠傜憥闂侇偄顧€缁辨繈宕ｉ婊勬殢濞存粌楠搁ˇ顒佺閼恒儳鐖遍柕鍡曠椤︻剚绂掗悾灞剧獥闁哄秴娲ら幏鏉裤€掗崨顖涘€為柟娈垮亝瀵潡鎯勯鑲╃Э闁?/div>
        ${fsModalAllowCreate ? '<button id="fsPickerCreateBtn" class="btn sm" type="button">闁哄倹婢樼紓鎾绘儎椤旇偐绉?/button>' : ""}
      </div>
      <div class="fs-picker-tree">${treeHTML(fsModalRoots)}</div>
      <div class="fs-picker-selected">
        <h4>鐎瑰憡鐓￠埀顒€顦卞ú鎷屻亹?/h4>
        <div class="selector">${(state.fsModalSelected || []).map((path) => `<label>${escapeHTML(path)}</label>`).join("") || '<span class="hint">閻忓繑纰嶅﹢顓㈡焻婢跺顏ラ柣鈺婂枛缂?/span>'}</div>
      </div>
      <div class="fs-picker-actions">
        <button id="fsPickerCancelBtn" class="btn sm" type="button">闁告瑦鐗楃粔?/button>
        <button id="fsPickerConfirmBtn" class="btn sm" type="button">缁绢収鍠涢濠氭焻婢跺顏?/button>
      </div>
    </section>
  `;
  openModal(fsModalTitle, html);
  document.querySelectorAll("[data-fs-expand]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const path = decodeURIComponent(String(btn.dataset.fsExpand || ""));
      if (!path) return;
      if (fsModalExpanded.has(path)) {
        fsModalExpanded.delete(path);
      } else {
        fsModalExpanded.add(path);
        await ensureFSTree(path);
      }
      renderDirectoryPickerModal();
    });
  });
  document.querySelectorAll("[data-fs-select]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const path = decodeURIComponent(String(event.target.dataset.fsSelect || ""));
      if (!path) return;
      if (fsModalMulti) {
        if (event.target.checked) {
          if (!state.fsModalSelected.includes(path)) state.fsModalSelected.push(path);
        } else {
          state.fsModalSelected = state.fsModalSelected.filter((item) => item !== path);
        }
      } else {
        state.fsModalSelected = event.target.checked ? [path] : [];
      }
      renderDirectoryPickerModal();
    });
  });
  document.getElementById("fsPickerCancelBtn")?.addEventListener("click", closeModal);
  document.getElementById("fsPickerConfirmBtn")?.addEventListener("click", () => {
    if (fsModalConfirmHandler) fsModalConfirmHandler([...state.fsModalSelected]);
    closeModal();
  });
  document.getElementById("fsPickerCreateBtn")?.addEventListener("click", async () => {
    const seed = state.fsModalSelected[0] || fsModalRoots[0]?.path || "";
    const raw = prompt("閻犲洨鏌夌欢顓㈠礂閵夘煈娲ｉ柛鎺撶☉缂傛捇鎯冮崟顓熺獥鐟滅増娲濋惌鎯ь嚗?, seed);
    if (!raw) return;
    try {
      const created = await createDirectory(raw);
      const parent = created.includes("/") || created.includes("\\") ? created.replace(/[\\/][^\\/]+$/, "") : "";
      if (parent) {
        delete state.fsTreeCache[parent];
        fsModalExpanded.add(parent);
        await ensureFSTree(parent);
      }
      if (!state.fsModalSelected.includes(created)) {
        state.fsModalSelected = fsModalMulti ? [...state.fsModalSelected, created] : [created];
      }
      renderDirectoryPickerModal();
      showAppToast(`闁烩晩鍠栫紞宥咁啅閹绘帒鐏＄€? ${created}`, "success");
    } catch (err) {
      showAppToast(err.message || "闁告帗绋戠紓鎾绘儎椤旇偐绉垮鎯扮簿鐟?, "error");
    }
  });
}

async function loadCICDData(silent = false) {
  try {
    const [pipelineRes, runsRes] = await Promise.all([
      fetchWithTimeout("/api/cicd/pipelines", 12000),
      fetchWithTimeout("/api/cicd/runs?limit=80", 12000),
    ]);
    const pipelineData = await pipelineRes.json();
    const runsData = await runsRes.json();
    if (!pipelineRes.ok) throw new Error(pipelineData.error || "load pipelines failed");
    if (!runsRes.ok) throw new Error(runsData.error || "load runs failed");
    state.cicdPipelines = Array.isArray(pipelineData.pipelines) ? pipelineData.pipelines : [];
    state.cicdRuns = Array.isArray(runsData.items) ? runsData.items : [];
    renderCICDPipelineCards();
    renderCICDRunTable();
    if (state.cicdCurrentRunId) {
      loadCICDRunDetail(state.cicdCurrentRunId, true);
    }
  } catch (err) {
    console.error("load cicd data failed", err);
    if (!silent) showAppToast("闁告梻濮惧ù?CI/CD 闁轰胶澧楀畵浣瑰緞鏉堫偉袝", "error");
  }
}

function renderCICDPipelineCards() {
  const box = document.getElementById("cicdPipelineCards");
  if (!box) return;
  if (!state.cicdPipelines.length) {
    box.innerHTML = '<div class="hint">闁哄棗鍊瑰Λ銈吤规担瑙勫瘻缂佹儳灏呯槐婵堟嫚瀹勬澘甯ラ柛鎺撶☉缂傛捇濡?/div>';
    return;
  }
  box.innerHTML = state.cicdPipelines
    .map((item) => `
      <article class="cicd-pipeline-card">
        <header>
          <div>
            <h4>${escapeHTML(item.name || item.id || "-")}</h4>
            <p>${escapeHTML(item.description || "闁哄啰濮靛鎸庢交?)}</p>
          </div>
          <span class="badge ${item.enabled === false ? "down" : "up"}">${item.enabled === false ? "闁稿绮庨弫? : "闁告凹鍨抽弫?}</span>
        </header>
        <div class="meta">鐎规悶鍎扮紞鏃堟儎椤旇偐绉? ${escapeHTML(item.work_dir || ".")} | Shell: ${escapeHTML(item.shell || "-")} | 闂傚啳鍩栭宀勫极? ${num((item.stages || []).length)}</div>
        <div class="ops">
          <button class="btn sm" type="button" data-cicd-run="${item.id}">閺夆晜鍔橀、?/button>
          <button class="btn sm" type="button" data-cicd-edit="${item.id}">缂傚倹鐗炵欢?/button>
          <button class="btn sm danger" type="button" data-cicd-delete="${item.id}">闁告帞濞€濞?/button>
        </div>
      </article>
    `)
    .join("");
  box.querySelectorAll("[data-cicd-run]").forEach((btn) => btn.addEventListener("click", () => runPipeline(btn.dataset.cicdRun)));
  box.querySelectorAll("[data-cicd-edit]").forEach((btn) => btn.addEventListener("click", () => {
    const pipeline = state.cicdPipelines.find((item) => item.id === btn.dataset.cicdEdit);
    openCICDPipelineEditor(pipeline || null);
  }));
  box.querySelectorAll("[data-cicd-delete]").forEach((btn) => btn.addEventListener("click", () => deletePipeline(btn.dataset.cicdDelete)));
}

function renderCICDRunTable() {
  const rows = state.cicdRuns.map((item) => [
    item.id,
    item.name || item.pipeline_id || "-",
    item.branch || "-",
    `<span class="badge ${statusClass(item.status)}">${escapeHTML(localizeTaskStatus(item.status || "-"))}</span>`,
    item.started_at || "-",
    item.finished_at || "-",
    `<button class="btn sm" type="button" data-cicd-log="${item.id}">闁哄被鍎冲﹢鍛村籍閵夈儳绠?/button>`,
  ]);
  renderTable("cicdRunTable", ["ID", "婵炵繝鐒﹂幐澶岀棯?, "闁告帒妫欓弫?, "闁绘鍩栭埀?, "鐎殿喒鍋撳┑顔碱儐濡炲倿姊?, "缂備焦鎸诲顐﹀籍閸洘锛?, "闁瑰灝绉崇紞?], rows, true);
  document.querySelectorAll("[data-cicd-log]").forEach((btn) => btn.addEventListener("click", () => loadCICDRunDetail(Number(btn.dataset.cicdLog || 0))));
}

function openCICDPipelineEditor(pipeline = null) {
  const envText = Object.entries(pipeline?.env || {}).map(([k, v]) => `${k}=${v}`).join("\n");
  const stagesText = (pipeline?.stages || []).map((stage) => `${stage.name || ""}::${stage.command || ""}${stage.continue_on_error ? "::continue" : ""}`).join("\n");
  const html = `
    <section class="cicd-editor">
      <div class="row">
        <input id="cicdEditName" class="input" placeholder="婵炵繝鐒﹂幐澶岀棯閸喗鍊崇紒? value="${escapeHTML(pipeline?.name || "")}" />
        <input id="cicdEditID" class="input" placeholder="婵炵繝鐒﹂幐澶岀棯缁哄嚍" value="${escapeHTML(pipeline?.id || "")}" ${pipeline ? "disabled" : ""} />
      </div>
      <div class="row">
        <input id="cicdEditDescription" class="input" placeholder="闁硅绻楅崼? value="${escapeHTML(pipeline?.description || "")}" />
        <input id="cicdEditBranch" class="input" placeholder="闁告帒妫欓弫顕€鏁嶇仦鑲╀紣濠?master / main" value="${escapeHTML(pipeline?.branch || "")}" />
      </div>
      <div class="row">
        <input id="cicdEditShell" class="input" placeholder="sh / bash / powershell" value="${escapeHTML(pipeline?.shell || state.config?.system?.default_shell || "")}" />
        <input id="cicdEditWorkDir" class="input" placeholder="鐎规悶鍎扮紞鏃堟儎椤旇偐绉? value="${escapeHTML(pipeline?.work_dir || ".")}" />
        <input id="cicdEditTimeout" class="input" placeholder="閻℃帒鎳忓鍌炲礆閸℃稒瀵? value="${escapeHTML(String(pipeline?.timeout_minutes || 30))}" />
      </div>
      <div class="row">
        <textarea id="cicdEditEnv" class="input" rows="5" style="width:100%;" placeholder="闁绘粠鍨伴。銊╁矗濮椻偓閸ｆ椽鏁嶇仦鍓фЖ閻?KEY=VALUE">${escapeHTML(envText)}</textarea>
      </div>
      <div class="row">
        <textarea id="cicdEditStages" class="input" rows="8" style="width:100%;" placeholder="闂傚啳鍩栭宀€鈧鐭粻鐔兼晬鐏炲墽妲ㄩ悶娑樼焿缁变即姊奸懜娈垮斀闁?:闁告稒鍨濋幎?:continue">${escapeHTML(stagesText)}</textarea>
      </div>
      <div class="row">
        <label><input id="cicdEditEnabled" type="checkbox" ${pipeline?.enabled === false ? "" : "checked"} /> 闁告凹鍨抽弫?/label>
        <button id="cicdSavePipelineBtn" class="btn" type="button">濞ｅ洦绻傞悺銊ッ规担瑙勫瘻缂?/button>
      </div>
    </section>
  `;
  openModal(pipeline ? "缂傚倹鐗炵欢顐⒚规担瑙勫瘻缂? : "闁哄倹婢樼紓鎾趁规担瑙勫瘻缂?, html);
  document.getElementById("cicdSavePipelineBtn")?.addEventListener("click", async () => {
    const payload = buildPipelinePayloadFromEditor(pipeline);
    if (!payload) return;
    const url = pipeline ? `/api/cicd/pipelines/${encodeURIComponent(pipeline.id)}` : "/api/cicd/pipelines";
    const method = pipeline ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "濞ｅ洦绻傞悺銊ッ规担瑙勫瘻缂佹儳鐏濋妵鎴犳嫻?, "error");
      return;
    }
    closeModal();
    await loadCICDData(true);
    showAppToast("婵炵繝鐒﹂幐澶岀棯閸喖鍤掑ǎ鍥ㄧ箓閻?, "success");
  });
}

function buildPipelinePayloadFromEditor(existing) {
  const name = getInputValue("cicdEditName");
  const id = existing?.id || getInputValue("cicdEditID");
  if (!name) {
    showAppToast("閻犲洤鍢查敐鐐哄礃濞嗘劗銈︽慨妯侯嚟閸ゅ酣宕ュ鍥?, "warning");
    return null;
  }
  const env = {};
  getInputValue("cicdEditEnv")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx <= 0) return;
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
  const stages = getInputValue("cicdEditStages")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [stageName, command, flag] = line.split("::");
      return {
        name: (stageName || "").trim(),
        command: (command || "").trim(),
        continue_on_error: (flag || "").trim().toLowerCase() === "continue",
      };
    })
    .filter((item) => item.command);
  return {
    id,
    name,
    description: getInputValue("cicdEditDescription"),
    branch: getInputValue("cicdEditBranch"),
    shell: getInputValue("cicdEditShell"),
    work_dir: getInputValue("cicdEditWorkDir"),
    timeout_minutes: Number(getInputValue("cicdEditTimeout")) || 30,
    env,
    stages,
    enabled: !!document.getElementById("cicdEditEnabled")?.checked,
  };
}

async function runPipeline(id) {
  if (!id) return;
  const res = await fetch(`/api/cicd/pipelines/${encodeURIComponent(id)}/run`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "閺夆晜鍔橀、鎴澝规担瑙勫瘻缂佹儳鐏濋妵鎴犳嫻?, "error");
    return;
  }
  state.cicdCurrentRunId = Number(data.run_id || 0);
  await loadCICDData(true);
  startCICDRunPolling(state.cicdCurrentRunId);
  showAppToast("婵炵繝鐒﹂幐澶岀棯閸喖鍤掗柛姘煎灠婵?, "success");
}

async function deletePipeline(id) {
  if (!id || !confirm(`缁绢収鍠涢濠氬礆閻樼粯鐝熸繛缈犵劍閹稿鐥?${id} ?`)) return;
  const res = await fetch(`/api/cicd/pipelines/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁告帞濞€濞呭骸霉娴ｈ瀵滅紒鎯х仢閵囨垹鎷?, "error");
    return;
  }
  await loadCICDData(true);
  showAppToast("婵炵繝鐒﹂幐澶岀棯閸喖鍤掗柛鎺斿█濞?, "success");
}

async function loadCICDRunDetail(runID, silent = false) {
  if (!runID) return;
  const res = await fetchWithTimeout(`/api/cicd/runs/${encodeURIComponent(runID)}`, 12000);
  const data = await res.json();
  if (!res.ok) {
    if (!silent) showAppToast(data.error || "闁告梻濮惧ù鍥规担瑙勫瘻缂佺偓瀵уΛ鈺勭疀濡も偓閵囨垹鎷?, "error");
    return;
  }
  state.cicdCurrentRunId = Number(runID);
  const viewer = document.getElementById("cicdRunOutput");
  if (viewer) viewer.textContent = data.output || "闁哄棗鍊瑰Λ銈嗘綇閹惧啿姣?;
  if (String(data.status || "").toLowerCase() === "running") {
    startCICDRunPolling(runID);
  } else {
    stopCICDRunPolling();
  }
}

function startCICDRunPolling(runID) {
  stopCICDRunPolling();
  if (!runID) return;
  state.cicdRunTimer = setInterval(async () => {
    await loadCICDRunDetail(runID, true);
    await loadCICDData(true);
  }, 2000);
}

function stopCICDRunPolling() {
  if (!state.cicdRunTimer) return;
  clearInterval(state.cicdRunTimer);
  state.cicdRunTimer = null;
}

async function stopCurrentCICDRun() {
  if (!state.cicdCurrentRunId) {
    showAppToast("鐟滅増鎸告晶鐘测柦閳╁啯绠掗弶鈺傚姌椤㈡垶绋夐鐘崇暠婵炵繝鐒﹂幐澶岀棯?, "warning");
    return;
  }
  const res = await fetch(`/api/cicd/runs/${encodeURIComponent(state.cicdCurrentRunId)}/stop`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁稿绮嶉娑樏规担瑙勫瘻缂佹儳鐏濋妵鎴犳嫻?, "error");
    return;
  }
  showAppToast("鐎瑰憡褰冭ぐ鍌炴焻娴ｉ晲绮绘慨婵勫灪鐎垫碍绂?, "success");
}

function switchDockerTab(tab) {
  state.dockerTab = tab === "images" ? "images" : "containers";
  document.getElementById("dockerContainerTable")?.classList.toggle("hidden", state.dockerTab !== "containers");
  document.getElementById("dockerImageTable")?.classList.toggle("hidden", state.dockerTab !== "images");
  document.getElementById("dockerTabContainers")?.classList.toggle("active", state.dockerTab === "containers");
  document.getElementById("dockerTabImages")?.classList.toggle("active", state.dockerTab === "images");
  refreshDockerBatchActionUI();
  if (state.dockerTab === "images") {
    loadDockerImages(true);
  }
}

function refreshDockerBatchActionUI() {
  const select = document.getElementById("dockerBatchActionType");
  const applyBtn = document.getElementById("dockerBatchApplyBtn");
  if (!select) return;
  const isImages = state.dockerTab === "images";
  const prev = String(select.value || "").trim();
  const options = isImages
    ? [{ value: "remove-image", label: "闁归潧缍婇崳娲礆閻樼粯鐝熼梻鈧鍐ㄥ壖" }]
    : [
        { value: "start", label: "闁归潧缍婇崳娲触椤栨艾袟閻庡湱鎳撳▍? },
        { value: "stop", label: "闁归潧缍婇崳娲磻濠婂嫷鍓鹃悗鍦嚀濞? },
        { value: "restart", label: "闁归潧缍婇崳娲煂瀹ュ懏鍎欓悗鍦嚀濞? },
        { value: "remove", label: "闁归潧缍婇崳娲礆閻樼粯鐝熼悗鍦嚀濞? },
      ];
  select.innerHTML = options.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
  const hit = options.some((item) => item.value === prev);
  select.value = hit ? prev : options[0].value;
  if (applyBtn) {
    applyBtn.textContent = isImages ? "闁告帞濞€濞呭酣骞嶉埀顒勬焻婢舵劖娈旈柛? : "闁圭瑳鍡╂斀閻庡湱鎳撳▍鎺楀箥瑜版帒娅ら柟鍨С缂?;
    applyBtn.classList.toggle("danger", isImages || select.value === "remove" || select.value === "stop");
  }
  select.onchange = () => {
    if (!applyBtn) return;
    const action = String(select.value || "").trim();
    applyBtn.classList.toggle("danger", action === "remove-image" || action === "remove" || action === "stop");
  };
}

async function loadDockerImages(force = false) {
  if (!force && state.dockerImages.length) {
    renderDockerImageTable();
    return state.dockerImages;
  }
  const keyword = String(document.getElementById("dockerSearch")?.value || "").trim();
  const res = await fetchWithTimeout(`/api/docker/images?keyword=${encodeURIComponent(keyword)}`, 20000);
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁告梻濮惧ù?Docker 闂傗偓濠婂啫鍓煎鎯扮簿鐟?, "error");
    return state.dockerImages;
  }
  state.dockerImages = Array.isArray(data.items) ? data.items : [];
  renderDockerImageTable();
  return state.dockerImages;
}

function renderDockerImageTable() {
  const rows = state.dockerImages.map((item) => [
    `<input type="checkbox" class="docker-image-select" value="${escapeHTML(item.id || "")}" ${state.dockerSelectedImageIDs.includes(item.id) ? "checked" : ""}>`,
    item.display_name || item.repository || item.id || "-",
    item.id || "-",
    item.digest || "-",
    item.created_at || "-",
    item.size || "-",
    `<button class="btn sm" type="button" data-docker-image-inspect="${escapeHTML(item.id || "")}">閻犲浄闄勯崕?/button>`,
  ]);
  renderTable("dockerImageTable", ["闂侇偄顦扮€?, "闂傗偓濠婂啫鍓?, "ID", "Digest", "闁告帗绋戠紓鎾诲籍閸洘锛?, "濠㈠爢鍐瘓", "闁瑰灝绉崇紞?], rows, true);
  syncDockerSelections();
}

async function runDockerBatchAction(action) {
  if (!state.dockerSelectedContainerIDs.length) {
    showAppToast("閻犲洤鍢查崢娑㈠礋妤ｅ啠鍋撴径濠庡晣闁?, "warning");
    return;
  }
  const payload = {
    ids: state.dockerSelectedContainerIDs,
    action,
    remove_volumes: false,
  };
  const res = await fetch("/api/docker/containers/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁归潧缍婇崳铏光偓鍦嚀濞呮帡骞欏鍕▕濠㈡儼绮剧憴?, "error");
    return;
  }
  await loadDockerDashboard(true);
  showAppToast(`闁归潧缍婇崳铏光偓鍦嚀濞呮帡骞欏鍕▕鐎瑰憡褰冮悾顒勫箣? ${action}`, "success");
}

async function runDockerImageBatchAction(action) {
  if (!state.dockerSelectedImageIDs.length) {
    showAppToast("閻犲洤鍢查崢娑㈠礋妤ｅ啠鍋撴径鎰當闁?, "warning");
    return;
  }
  const res = await fetch("/api/docker/images/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: state.dockerSelectedImageIDs, action, force: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    showAppToast(data.error || "闁归潧缍婇崳娲⒐濠婂啫鍓奸柟鍨С缂嶆梹寰勬潏顐バ?, "error");
    return;
  }
  await loadDockerImages(true);
  showAppToast(`闁归潧缍婇崳娲⒐濠婂啫鍓奸柟鍨С缂嶆柨顔忛幓鎺旀殮闁? ${action}`, "success");
}

async function handleDockerImageTableClick(event) {
  const inspectBtn = event.target.closest("[data-docker-image-inspect]");
  if (inspectBtn) {
    const id = String(inspectBtn.dataset.dockerImageInspect || "").trim();
    if (!id) return;
    const res = await fetchWithTimeout(`/api/docker/images/${encodeURIComponent(id)}/inspect`, 20000);
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "闁告梻濮惧ù鍥⒐濠婂啫鍓奸悹鍥烽檮閸庡繑寰勬潏顐バ?, "error");
      return;
    }
    openModal(`闂傗偓濠婂啫鍓奸悹鍥烽檮閸?- ${id}`, `<pre class="log-view compact">${escapeHTML(JSON.stringify(data.inspect, null, 2))}</pre>`);
    return;
  }
  const checkbox = event.target.closest(".docker-image-select");
  if (checkbox) {
    syncDockerSelections();
  }
}

function syncDockerSelections() {
  state.dockerSelectedContainerIDs = Array.from(document.querySelectorAll(".docker-container-select:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
  state.dockerSelectedImageIDs = Array.from(document.querySelectorAll(".docker-image-select:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
}

async function loadTrafficData(force = false) {
  let data = null;
  try {
    const res = await fetchWithTimeout("/api/traffic", 20000);
    data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || "闁告梻濮惧ù鍥规笟鈧崳娲礆閸℃鈧姤寰勬潏顐バ?, "error");
      return state.trafficSnapshot;
    }
  } catch (err) {
    console.error("load traffic data failed", err);
    if (force) showAppToast("闁告梻濮惧ù鍥规笟鈧崳娲礆閸℃鈧姤寰勬潏顐バ?, "error");
    return state.trafficSnapshot;
  }
  state.trafficSnapshot = data || null;
  renderTrafficStatusSummary();
  renderTrafficConnectionTable();
  return state.trafficSnapshot;
}

function startTrafficPolling() {
  stopTrafficPolling();
  state.trafficPollTimer = setInterval(() => {
    loadTrafficData(false);
  }, 2000);
}

function stopTrafficPolling() {
  if (!state.trafficPollTimer) return;
  clearInterval(state.trafficPollTimer);
  state.trafficPollTimer = null;
}

function renderTrafficStatusSummary() {
  const status = state.trafficSnapshot?.status || {};
  const totalConnections = num(status.connections || state.trafficSnapshot?.connections?.length || 0);
  document.querySelectorAll("[data-traffic-status-summary]").forEach((el) => {
    const hasError = !!status.error;
    el.textContent = hasError ? `濞翠線鍣洪惄鎴炲付瀵倸鐖堕敍?{String(status.error)}` : "";
    el.classList.toggle("hidden", !hasError);
  });
  setTrafficKPI("connections", totalConnections);
}

function renderTrafficConnectionTable() {
  const keyword = String(document.getElementById("trafficConnectionSearch")?.value || "").trim().toLowerCase();
  const list = Array.isArray(state.trafficSnapshot?.connections) ? state.trafficSnapshot.connections : [];
  const filtered = list.filter((item) => {
    if (!keyword) return true;
    const searchable = [
      item.process_name,
      item.pid,
      item.local_ip,
      item.local_port,
      item.remote_ip,
      item.remote_port,
      item.protocol,
      item.status,
    ].join(" ").toLowerCase();
    return searchable.includes(keyword);
  });

  const rows = filtered
    .slice(0, 200)
    .map((item) => [
      item.process_name || "-",
      item.pid || "-",
      item.protocol || "-",
      `${item.local_ip || "-"}:${item.local_port || 0}`,
      item.remote_ip ? `${item.remote_ip}:${item.remote_port || 0}` : "-",
      item.status || "-",
      `${bytes(item.bytes_in || 0)} / ${bytes(item.bytes_out || 0)}`,
      `${num(item.packets_in || 0)} / ${num(item.packets_out || 0)}`,
      item.last_seen ? formatTimeValue(item.last_seen) : "-",
    ]);

  const countText = keyword && filtered.length !== list.length
    ? `杩炴帴鏁?${num(filtered.length)} / ${num(list.length)}`
    : `杩炴帴鏁?${num(filtered.length)}`;
  setText("trafficConnectionCountInTitle", countText);

  renderTable("trafficConnectionTable", ["杩涚▼", "PID", "鍗忚", "鏈湴鍦板潃", "杩滅鍦板潃", "鐘舵€?, "鍏?鍑烘祦閲?, "鍏?鍑哄寘鏁?, "鏈€鍚庢椿璺?], rows);
}

function setTrafficKPI(key, value) {
  document.querySelectorAll(`[data-traffic-kpi="${key}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function compactMountLabel(path) {
  const raw = String(path || "-").trim();
  if (!raw) return "-";
  if (/docker[\\/](volumes|overlay2|containers)/i.test(raw)) {
    const match = raw.match(/docker[\\/](?:volumes|overlay2|containers)[\\/]+([^\\/]+)/i);
    const token = match?.[1] ? shorten(match[1], 28) : "docker-volume";
    return `<span class="mount-badge docker" title="${escapeHTML(raw)}">Docker 闁?鐠?${escapeHTML(token)}</span>`;
  }
  return `<span title="${escapeHTML(raw)}">${escapeHTML(shorten(raw, 42))}</span>`;
}

function renderDiskVolumeChart(disks) {
  const box = document.getElementById("diskVolumeChart");
  if (!box) return;
  const dockerDisks = (Array.isArray(disks) ? disks : []).filter((item) => /docker[\\/]/i.test(String(item.path || "")));
  if (!dockerDisks.length) {
    box.innerHTML = '<div class="hint">闁哄牜浜濋ˉ鍛圭€ｎ亜鐓?Docker 闁圭鍊藉ù鍥础?/div>';
    return;
  }
  const total = dockerDisks.reduce((sum, item) => sum + Number(item.used || 0), 0) || 1;
  box.innerHTML = dockerDisks
    .slice(0, 8)
    .map((item) => {
      const ratio = Math.max(8, (Number(item.used || 0) * 100) / total);
      const label = String(item.path || "").split(/[\\/]/).slice(-2).join("/");
      return `
        <div class="disk-volume-item" title="${escapeHTML(item.path || "-")}">
          <span class="disk-volume-label">${escapeHTML(shorten(label || item.path || "-", 28))}</span>
          <span class="disk-volume-bar"><i style="width:${ratio.toFixed(2)}%"></i></span>
          <span class="disk-volume-size">${escapeHTML(bytes(item.used || 0))}</span>
        </div>
      `;
    })
    .join("");
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function getInputValue(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

let __legacyBootTriggered = false;

export function initLegacyApp() {
  if (__legacyBootTriggered) return;
  __legacyBootTriggered = true;
  document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
}

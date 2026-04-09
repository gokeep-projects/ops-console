var Ir=Object.defineProperty;var Br=(e,t,n)=>t in e?Ir(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var ae=(e,t,n)=>Br(e,typeof t!="symbol"?t+"":t,n);function Ie(){}function Mn(e){return e()}function en(){return Object.create(null)}function ot(e){e.forEach(Mn)}function Cn(e){return typeof e=="function"}function _r(e,t){return e!=e?t==t:e!==t||e&&typeof e=="object"||typeof e=="function"}function Er(e){return Object.keys(e).length===0}function An(e,t,n){e.insertBefore(t,n||null)}function Ct(e){e.parentNode&&e.parentNode.removeChild(e)}function Tr(e){return document.createElement(e)}function Lr(e){return document.createElementNS("http://www.w3.org/2000/svg",e)}function Mr(e){return document.createTextNode(e)}function Cr(){return Mr("")}function Ar(e){return Array.from(e.childNodes)}class Nr{constructor(t=!1){ae(this,"is_svg",!1);ae(this,"e");ae(this,"n");ae(this,"t");ae(this,"a");this.is_svg=t,this.e=this.n=null}c(t){this.h(t)}m(t,n,r=null){this.e||(this.is_svg?this.e=Lr(n.nodeName):this.e=Tr(n.nodeType===11?"TEMPLATE":n.nodeName),this.t=n.tagName!=="TEMPLATE"?n:n.content,this.c(t)),this.i(r)}h(t){this.e.innerHTML=t,this.n=Array.from(this.e.nodeName==="TEMPLATE"?this.e.content.childNodes:this.e.childNodes)}i(t){for(let n=0;n<this.n.length;n+=1)An(this.t,this.n[n],t)}p(t){this.d(),this.h(t),this.i(this.a)}d(){this.n.forEach(Ct)}}let Ne;function Me(e){Ne=e}function Pr(){if(!Ne)throw new Error("Function called outside component initialization");return Ne}function Rr(e){Pr().$$.on_mount.push(e)}const ke=[],tn=[];let Be=[];const nn=[],Dr=Promise.resolve();let bt=!1;function xr(){bt||(bt=!0,Dr.then(Nn))}function kt(e){Be.push(e)}const lt=new Set;let ve=0;function Nn(){if(ve!==0)return;const e=Ne;do{try{for(;ve<ke.length;){const t=ke[ve];ve++,Me(t),Or(t.$$)}}catch(t){throw ke.length=0,ve=0,t}for(Me(null),ke.length=0,ve=0;tn.length;)tn.pop()();for(let t=0;t<Be.length;t+=1){const n=Be[t];lt.has(n)||(lt.add(n),n())}Be.length=0}while(ke.length);for(;nn.length;)nn.pop()();bt=!1,lt.clear(),Me(e)}function Or(e){if(e.fragment!==null){e.update(),ot(e.before_update);const t=e.dirty;e.dirty=[-1],e.fragment&&e.fragment.p(e.ctx,t),e.after_update.forEach(kt)}}function Fr(e){const t=[],n=[];Be.forEach(r=>e.indexOf(r)===-1?t.push(r):n.push(r)),n.forEach(r=>r()),Be=t}const jr=new Set;function Hr(e,t){e&&e.i&&(jr.delete(e),e.i(t))}function zr(e,t,n){const{fragment:r,after_update:o}=e.$$;r&&r.m(t,n),kt(()=>{const s=e.$$.on_mount.map(Mn).filter(Cn);e.$$.on_destroy?e.$$.on_destroy.push(...s):ot(s),e.$$.on_mount=[]}),o.forEach(kt)}function Wr(e,t){const n=e.$$;n.fragment!==null&&(Fr(n.after_update),ot(n.on_destroy),n.fragment&&n.fragment.d(t),n.on_destroy=n.fragment=null,n.ctx=[])}function Kr(e,t){e.$$.dirty[0]===-1&&(ke.push(e),xr(),e.$$.dirty.fill(0)),e.$$.dirty[t/31|0]|=1<<t%31}function Vr(e,t,n,r,o,s,i=null,c=[-1]){const l=Ne;Me(e);const d=e.$$={fragment:null,ctx:[],props:s,update:Ie,not_equal:o,bound:en(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(t.context||(l?l.$$.context:[])),callbacks:en(),dirty:c,skip_bound:!1,root:t.target||l.$$.root};i&&i(d.root);let u=!1;if(d.ctx=n?n(e,t.props||{},(m,g,...y)=>{const v=y.length?y[0]:g;return d.ctx&&o(d.ctx[m],d.ctx[m]=v)&&(!d.skip_bound&&d.bound[m]&&d.bound[m](v),u&&Kr(e,m)),g}):[],d.update(),u=!0,ot(d.before_update),d.fragment=r?r(d.ctx):!1,t.target){if(t.hydrate){const m=Ar(t.target);d.fragment&&d.fragment.l(m),m.forEach(Ct)}else d.fragment&&d.fragment.c();t.intro&&Hr(e.$$.fragment),zr(e,t.target,t.anchor),Nn()}Me(l)}class Ur{constructor(){ae(this,"$$");ae(this,"$$set")}$destroy(){Wr(this,1),this.$destroy=Ie}$on(t,n){if(!Cn(n))return Ie;const r=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return r.push(n),()=>{const o=r.indexOf(n);o!==-1&&r.splice(o,1)}}$set(t){this.$$set&&!Er(t)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}const qr="4";typeof window<"u"&&(window.__svelte||(window.__svelte={v:new Set})).v.add(qr);const Gr=`\uFEFF<div id="bootOverlay" class="boot-overlay">\r
    <div class="boot-card">\r
      <h2>运维工具初始化中</h2>\r
      <p id="bootText">准备加载...</p>\r
      <div class="boot-progress">\r
        <div id="bootBar" class="boot-bar"></div>\r
      </div>\r
      <p id="bootPercent" class="boot-percent">0%</p>\r
    </div>\r
  </div>\r
\r
  <div id="authOverlay" class="auth-overlay hidden">\r
    <div class="auth-card">\r
      <h2>登录 OPS 运维平台</h2>\r
      <p>请输入配置文件中的账号密码</p>\r
      <form id="authLoginForm" class="auth-form" autocomplete="off">\r
        <label>\r
          <span>用户名</span>\r
          <input id="authUsername" class="input" type="text" name="username" autocomplete="username" placeholder="请输入用户名" />\r
        </label>\r
        <label>\r
          <span>密码</span>\r
          <input id="authPassword" class="input" type="password" name="password" autocomplete="current-password" placeholder="请输入密码" />\r
        </label>\r
        <button class="btn" type="submit">登 录</button>\r
      </form>\r
      <p id="authMessage" class="auth-message info">请输入账号密码登录</p>\r
    </div>\r
  </div>\r
\r
  <div class="app-bg"></div>\r
  <div id="mainLayout" class="layout">\r
    <aside class="sidebar">\r
      <div class="sidebar-top">\r
        <button\r
          id="sidebarToggleBtn"\r
          class="btn sm sidebar-toggle-btn"\r
          type="button"\r
          title="收起系统菜单"\r
          aria-label="收起系统菜单"\r
          aria-expanded="true"\r
          data-collapsed="false"\r
        >\r
          <span class="sidebar-toggle-icon" aria-hidden="true"></span>\r
          <span class="sr-only sidebar-toggle-text">收起系统菜单</span>\r
        </button>\r
        <button\r
          id="sidebarExpandBtn"\r
          class="btn sm sidebar-expand-btn"\r
          type="button"\r
          title="展开系统菜单"\r
          aria-label="展开系统菜单"\r
          aria-expanded="false"\r
          data-collapsed="true"\r
        >\r
          <span class="sidebar-toggle-icon" aria-hidden="true"></span>\r
          <span class="sr-only sidebar-expand-text">展开</span>\r
        </button>\r
      </div>\r
      <button class="menu active" type="button" data-section="monitor" title="系统监控" aria-label="系统监控">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="M3 12.5h10" />\r
            <path d="M4.5 10 6.8 7.7l2 1.8L12 5.8" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">系统监控</span>\r
      </button>\r
      <button class="menu" type="button" data-section="logs" title="日志分析" aria-label="日志分析">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="M4 3.5h8a1 1 0 0 1 1 1v7.5l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V4.5a1 1 0 0 1 1-1Z" />\r
            <path d="M5.5 6.25h5" />\r
            <path d="M5.5 8.25h4" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">日志分析</span>\r
      </button>\r
      <button class="menu" type="button" data-section="traffic" title="进程流量" aria-label="进程流量">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="M2.5 12.5h2.2l1.4-3.1 2.1 1.9 2.4-5.3 1.4 2h1.5" />\r
            <path d="M2.5 4.5h3" />\r
            <path d="M10.5 4.5h3" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">进程流量</span>\r
      </button>\r
      <button class="menu" type="button" data-section="traffic-capture" title="数据包抓包" aria-label="数据包抓包">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <rect x="2.5" y="3" width="11" height="8.5" rx="1.5" />\r
            <path d="M5 6h6" />\r
            <path d="M5 8.5h4.5" />\r
            <path d="M6.5 13h3" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">数据包抓包</span>\r
      </button>\r
      <button class="menu" type="button" data-section="repair" title="修复工具" aria-label="修复工具">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="m9.2 3.5 3.3 3.3" />\r
            <path d="M10.1 2.6a2.2 2.2 0 0 1 2.8 2.8l-5.7 5.7-2.9.5.5-2.9 5.3-5.3Z" />\r
            <path d="m8.3 4.4 3.3 3.3" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">修复工具</span>\r
      </button>\r
      <button class="menu" type="button" data-section="backup" title="数据备份" aria-label="数据备份">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="M3.5 4.5h9v7h-9z" />\r
            <path d="M5 4.5V3.8a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8v.7" />\r
            <path d="M5.5 8h5" />\r
            <path d="M8 8v2.5" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">数据备份</span>\r
      </button>\r
      <button class="menu" type="button" data-section="cleanup" title="数据清理" aria-label="数据清理">\r
        <span class="menu-icon" aria-hidden="true">\r
          <svg viewBox="0 0 16 16" fill="none">\r
            <path d="M3.5 4h9" />\r
            <path d="M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />\r
            <path d="M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />\r
            <path d="M6.7 7v4.2" />\r
            <path d="M9.3 7v4.2" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">数据清理</span>\r
      </button>\r
      <button class="menu" type="button" data-section="docker" title="Docker管理" aria-label="Docker管理">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="6.5" width="3" height="3" />
            <rect x="6.5" y="6.5" width="3" height="3" />\r
            <rect x="10.5" y="6.5" width="3" height="3" />\r
            <rect x="4.5" y="2.5" width="3" height="3" />\r
            <path d="M2.2 10.5h11.6c0 1.7-1.3 3-3 3H5.2c-1.7 0-3-1.3-3-3Z" />\r
          </svg>\r
        </span>
        <span class="menu-label">Docker管理</span>
      </button>
      <button class="menu" type="button" data-section="remote-control" title="远程控制" aria-label="远程控制">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="3.2" width="11" height="7.8" rx="1.2" />
            <path d="M5.5 12.8h5" />
            <path d="m6.2 6.3-1.6 1.6 1.6 1.6" />
            <path d="m9.8 6.3 1.6 1.6-1.6 1.6" />
          </svg>
        </span>
        <span class="menu-label">远程控制</span>
      </button>
      <button class="menu" type="button" data-section="system" title="系统管理" aria-label="系统管理">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.2" />\r
            <path d="M8 1.8v2" />\r
            <path d="M8 12.2v2" />\r
            <path d="m13 3 1.4 1.4" />\r
            <path d="m1.6 11.6 1.4 1.4" />\r
            <path d="M14.2 8h-2" />\r
            <path d="M3.8 8h-2" />\r
            <path d="m13 13-1.4-1.4" />\r
            <path d="M3 3 4.4 4.4" />\r
          </svg>\r
        </span>\r
        <span class="menu-label">系统管理</span>\r
      </button>\r
    </aside>\r
\r
    <main class="content">\r
      <section id="monitor" class="panel visible">\r
        <article class="card system-info-card">\r
          <div class="card-head">\r
            <h3>系统信息</h3>\r
            <div class="ops">\r
              <button id="openSystemInfoModalBtn" class="btn sm" type="button">查看系统详情</button>\r
              <button id="monitorRefreshBtn" class="btn sm">实时状态下载</button>\r
              <button id="monitorToggleBtn" class="btn sm danger">停止监控</button>\r
            </div>\r
          </div>\r
          <div id="systemInfoQuick" class="system-info-quick">-</div>\r
        </article>\r
\r
        <div class="grid cards-5 monitor-kpi-grid">\r
          <article class="card metric-card cpu">\r
            <div class="kpi-head">\r
              <h3>CPU</h3>\r
              <span class="kpi-tag">实时</span>\r
            </div>\r
            <p id="cpuUsage" class="metric">-</p>\r
            <small id="cpuCore" class="metric-sub">-</small>\r
            <div class="meter"><span id="cpuBar"></span></div>\r
            <div class="trend-row">\r
              <div\r
                id="trendMiniCpu"\r
                class="mini-trend trend-open-target"\r
                data-trend-key="cpu"\r
                data-hint="点击放大"\r
                role="button"\r
                tabindex="0"\r
                title="点击放大查看 24 小时趋势"\r
              ></div>\r
            </div>\r
            <small id="trendInfoCpu" class="trend-meta">-</small>\r
          </article>\r
\r
          <article class="card metric-card memory">\r
            <div class="kpi-head">\r
              <h3>内存</h3>\r
              <span class="kpi-tag">实时</span>\r
            </div>\r
            <p id="memUsage" class="metric">-</p>\r
            <small id="memDetail" class="metric-sub">-</small>\r
            <div class="meter"><span id="memBar"></span></div>\r
            <div class="trend-row">\r
              <div\r
                id="trendMiniMemory"\r
                class="mini-trend trend-open-target"\r
                data-trend-key="memory"\r
                data-hint="点击放大"\r
                role="button"\r
                tabindex="0"\r
                title="点击放大查看 24 小时趋势"\r
              ></div>\r
            </div>\r
            <small id="trendInfoMemory" class="trend-meta">-</small>\r
          </article>\r
\r
          <article class="card metric-card network">\r
            <div class="kpi-head">\r
              <h3>网络流量</h3>\r
              <span class="kpi-tag">实时</span>\r
            </div>\r
            <p id="netTraffic" class="metric">-</p>\r
            <small id="netPackets" class="metric-sub">-</small>\r
            <div class="trend-row">\r
              <div\r
                id="trendMiniNetwork"\r
                class="mini-trend trend-open-target"\r
                data-trend-key="network"\r
                data-hint="点击放大"\r
                role="button"\r
                tabindex="0"\r
                title="点击放大查看 24 小时趋势"\r
              ></div>\r
            </div>\r
            <small id="trendInfoNetwork" class="trend-meta">-</small>\r
          </article>\r
\r
          <article class="card metric-card process">\r
            <div class="kpi-head">\r
              <h3>总进程数</h3>\r
              <span class="kpi-tag">全局</span>\r
            </div>\r
            <p id="processCount" class="metric">-</p>\r
            <small id="osInfo" class="metric-sub">-</small>\r
            <div class="trend-row">\r
              <div\r
                id="trendMiniProcess"\r
                class="mini-trend trend-open-target"\r
                data-trend-key="process"\r
                data-hint="点击放大"\r
                role="button"\r
                tabindex="0"\r
                title="点击放大查看 24 小时趋势"\r
              ></div>\r
            </div>\r
            <small id="trendInfoProcess" class="trend-meta">-</small>\r
          </article>\r
\r
          <article class="card metric-card diskio">\r
            <div class="kpi-head">\r
              <h3>磁盘 IO</h3>\r
              <span class="kpi-tag">实时</span>\r
            </div>\r
            <p id="diskIoFlow" class="metric">-</p>\r
            <small id="diskIoOps" class="metric-sub">-</small>\r
            <div class="trend-row">\r
              <div\r
                id="trendMiniDiskIO"\r
                class="mini-trend trend-open-target"\r
                data-trend-key="diskio"\r
                data-hint="点击放大"\r
                role="button"\r
                tabindex="0"\r
                title="点击放大查看 24 小时趋势"\r
              ></div>\r
            </div>\r
            <small id="trendInfoDiskIO" class="trend-meta">-</small>\r
          </article>\r
        </div>\r
\r
        <div class="grid cards-2">\r
          <article class="card">\r
          <div class="card-head">\r
            <h3>磁盘状态</h3>\r
            <div class="ops">\r
                <small id="diskIoSummary">-</small>\r
                <button id="openDiskMetaModalBtn" class="btn sm" type="button">硬件汇总</button>\r
              </div>\r
            </div>\r
            <div id="diskVolumeChart" class="disk-volume-chart"></div>\r
            <div id="diskList" class="table"></div>\r
          </article>\r
\r
          <article class="card">\r
            <div class="card-head">\r
              <h3>监听端口</h3>\r
              <div class="ops">\r
                <input id="portSearch" class="input" placeholder="搜索进程名 / 端口 / PID / 路径" />\r
                <button id="openPortModalBtn" class="btn sm">查看详情</button>\r
              </div>\r
            </div>\r
            <div id="portList" class="table"></div>\r
          </article>\r
        </div>\r
\r
        <div class="grid cards-2">\r
          <article class="card service-status-card">
            <div class="card-head">
              <h3>流量监控</h3>
              <div class="ops flow-monitor-ops">
                <button id="flowMonitorViewAllBtn" class="btn sm" type="button">详情</button>
              </div>
            </div>
            <div id="flowMonitorList" class="table"></div>
          </article>
\r
          <article class="card process-top-card">\r
            <div class="card-head">\r
              <h3>进程排行 / JVM</h3>\r
              <div class="ops">\r
                <input id="processSearch" class="input" placeholder="搜索进程名 / 路径 / PID" />\r
              </div>\r
            </div>\r
            <div id="topProcessList" class="table"></div>\r
          </article>\r
        </div>\r
      </section>\r
\r
      <section id="logs" class="panel">
        <div class="panel-head panel-head-right">
          <div class="ops log-source-ops">
            <button id="logAddCardBtn" class="btn sm">添加日志源</button>
            <select id="logSourceSelect" class="input"></select>
            <button id="logDeleteCardBtn" class="btn sm danger" type="button">删除当前</button>
          </div>
        </div>

        <div class="card">
          <div class="row">\r
            <input id="logKeyword" class="input" placeholder="关键字（全文检索）" />\r
            <select id="logLevel" class="input">\r
              <option value="all">全部</option>\r
              <option value="info">信息</option>\r
              <option value="error">错误</option>\r
            </select>\r
            <select id="logRule" class="input">\r
              <option value="">常见问题规则</option>\r
            </select>\r
            <input id="logLimit" class="input sm" value="300" />\r
            <button id="logQueryBtn" class="btn">查询</button>\r
            <button id="logErrorBtn" class="btn">仅错误</button>\r
            <button id="logExportBtn" class="btn">导出</button>\r
          </div>\r
          <p id="logCurrentApp" class="hint">当前日志源：</p>
          <div id="logFileSelector" class="selector"></div>\r
          <div id="logStats" class="log-stats-grid"></div>\r
          <div id="logResult" class="log-view"></div>\r
        </div>\r
      </section>\r
\r
      <section id="traffic" class="panel traffic-panel">\r
        <article class="card traffic-hero-card">\r
          <div class="card-head">\r
            <h3>进程 / 连接流量</h3>\r
            <div class="ops">\r
              <button id="trafficRefreshBtn" class="btn sm" type="button">刷新</button>\r
            </div>\r
          </div>\r
          <p data-traffic-status-summary class="hint">正在加载流量分析状态...</p>\r
          <div class="traffic-kpi-grid">\r
            <div class="traffic-kpi-card">\r
              <span>连接数</span>\r
              <strong data-traffic-kpi="connections">0</strong>\r
            </div>\r
            <div class="traffic-kpi-card">\r
              <span>已捕获数据包</span>\r
              <strong data-traffic-kpi="packets">0</strong>\r
            </div>\r
            <div class="traffic-kpi-card">\r
              <span>HTTP 明文</span>\r
              <strong data-traffic-kpi="http">0</strong>\r
            </div>\r
            <div class="traffic-kpi-card">\r
              <span>抓包接口</span>\r
              <strong data-traffic-kpi="interface">-</strong>\r
            </div>\r
          </div>\r
        </article>\r
\r
        <article class="card">\r
          <div class="card-head">\r
            <h3>进程 / 连接流量排行</h3>\r
            <div class="ops">\r
              <input id="trafficConnectionSearch" class="input sm" placeholder="搜索进程 / PID / 端口 / IP" />\r
            </div>\r
          </div>\r
          <div id="trafficConnectionTable" class="table"></div>\r
        </article>\r
      </section>\r
\r
      <section id="traffic-capture" class="panel traffic-panel">
        <article class="card traffic-hero-card">
          <div class="card-head">
            <h3>数据包抓包（Wireshark 风格）</h3>
            <div class="ops traffic-capture-ops">
              <select id="trafficInterface" class="input"></select>
              <select id="trafficBuiltinFilter" class="input sm">
                <option value="ip or ip6 or arp">全部流量</option>
                <option value="tcp">仅 TCP</option>
                <option value="udp">仅 UDP</option>
                <option value="tcp port 80 or tcp port 8080 or tcp port 8000 or tcp port 8888">HTTP 常见端口</option>
                <option value="tcp port 443">HTTPS/TLS</option>
                <option value="udp port 53 or tcp port 53">DNS</option>
              </select>
              <input id="trafficCustomFilter" class="input" placeholder="自定义抓包过滤（BPF），例如 tcp and port 443" />
              <button id="trafficStartBtn" class="btn sm" type="button">开始抓包</button>
              <button id="trafficStopBtn" class="btn sm danger" type="button">停止抓包</button>
              <button id="trafficCaptureRefreshBtn" class="btn sm" type="button">刷新</button>
            </div>
          </div>
          <p data-traffic-status-summary class="hint">正在加载抓包状态...</p>
          <div class="traffic-kpi-grid">
            <div class="traffic-kpi-card">
              <span>连接数</span>
              <strong data-traffic-kpi="connections">0</strong>
            </div>
            <div class="traffic-kpi-card">
              <span>已捕获数据包</span>
              <strong data-traffic-kpi="packets">0</strong>
            </div>
            <div class="traffic-kpi-card">
              <span>HTTP 明文</span>
              <strong data-traffic-kpi="http">0</strong>
            </div>
            <div class="traffic-kpi-card">
              <span>抓包接口</span>
              <strong data-traffic-kpi="interface">-</strong>
            </div>
          </div>
          <p class="hint">默认展示数据包列表；支持内置过滤和自定义过滤。右键数据包可切换解码方式。</p>
        </article>

        <article class="card traffic-filter-card">
          <div class="row">
            <select id="trafficDisplayPreset" class="input sm">
              <option value="all">显示全部</option>
              <option value="tcp">显示 TCP</option>
              <option value="udp">显示 UDP</option>
              <option value="http">显示 HTTP</option>
              <option value="https">显示 HTTPS/TLS</option>
              <option value="dns">显示 DNS</option>
            </select>
            <input id="trafficDisplayFilter" class="input" placeholder="自定义显示过滤：proto:tcp src:10.0.0.8 dst:1.1.1.1 port:443 len>200 contains:login" />
            <button id="trafficApplyFilterBtn" class="btn sm" type="button">应用过滤</button>
            <button id="trafficClearFilterBtn" class="btn sm" type="button">清空过滤</button>
          </div>
        </article>

        <article class="card traffic-packet-card">
          <div class="card-head">
            <h3>数据包列表</h3>
            <div class="ops">
              <span id="trafficPacketHint" class="hint">右键任意行可切换解码</span>
            </div>
          </div>
          <div id="trafficPacketTable" class="table traffic-packet-table"></div>
        </article>

        <article class="card traffic-detail-card">
          <div class="card-head">
            <h3>数据包详情</h3>
            <div class="ops">
              <span id="trafficPacketDetailTitle" class="hint">未选择数据包</span>
            </div>
          </div>
          <div id="trafficPacketDetailMeta" class="table"></div>
          <pre id="trafficPacketDetailBody" class="log-view compact">请选择上方数据包查看详情</pre>
        </article>

        <div id="trafficPacketContextMenu" class="traffic-context-menu hidden">
          <button type="button" data-decode-mode="auto">自动解码</button>
          <button type="button" data-decode-mode="http">按 HTTP 尝试解码</button>
          <button type="button" data-decode-mode="ascii">按 ASCII 文本</button>
          <button type="button" data-decode-mode="hex">按 HEX 视图</button>
        </div>
      </section>
\r
      <section id="repair" class="panel repair-panel">\r
        <div class="repair-hero">\r
          <div>\r
            <p>上传脚本、定义参数并执行，执行日志与历史记录集中展示。</p>\r
          </div>\r
          <span class="repair-badge">脚本执行</span>\r
        </div>\r
\r
        <div class="repair-grid">\r
          <article class="card repair-card upload-card">\r
            <div class="repair-card-head">\r
              <h3>上传脚本</h3>\r
              <small>支持 ps1 / sh / bat / cmd</small>\r
            </div>\r
            <form id="uploadScriptForm" class="repair-form">\r
              <label class="field">\r
                <span>脚本文件</span>\r
                <input type="file" name="file" class="input" required />\r
              </label>\r
              <label class="field">\r
                <span>脚本名称</span>\r
                <input name="name" class="input" placeholder="例如：修复 nginx 配置" />\r
              </label>\r
              <label class="field">\r
                <span>运行 Shell</span>\r
                <input name="shell" class="input" placeholder="powershell / sh / cmd" />\r
              </label>\r
              <label class="field">\r
                <span>默认参数</span>\r
                <input name="parameters" class="input" placeholder="例如：-env prod,-force true" />\r
              </label>\r
              <label class="field field-full">\r
                <span>脚本描述</span>\r
                <input name="description" class="input" placeholder="记录用途、风险和适用场景" />\r
              </label>\r
              <button class="btn repair-submit" type="submit">上传脚本</button>\r
            </form>\r
          </article>\r
\r
          <article class="card repair-card run-card">\r
            <div class="repair-card-head">\r
              <h3>执行脚本</h3>\r
              <small>实时输出 / 可追溯</small>\r
            </div>\r
            <div class="run-toolbar">\r
              <select id="scriptName" class="input"></select>\r
              <input id="scriptArgs" class="input" placeholder="执行参数，例如：-host 127.0.0.1 -mode safe" />\r
              <button id="runScriptBtn" class="btn">执行</button>\r
            </div>\r
            <pre id="scriptOutput" class="log-view compact repair-output"></pre>\r
          </article>\r
        </div>\r
\r
        <div class="repair-bottom-grid">\r
          <article class="card repair-card library-card">\r
            <div class="repair-card-head">\r
              <h3>脚本库</h3>\r
              <small>已注册脚本</small>\r
            </div>\r
            <div id="scriptLibrary" class="script-library"></div>\r
          </article>\r
\r
          <article class="card repair-card">\r
            <div class="repair-card-head">\r
              <h3>执行历史</h3>\r
              <small>最近运行记录</small>\r
            </div>\r
            <div id="scriptRunHistory" class="table"></div>\r
          </article>\r
        </div>\r
      </section>\r
\r
      <section id="backup" class="panel">\r
        <article class="card">\r
          <div class="row">\r
            <select id="backupType" class="input">\r
              <option value="files">重要文件备份</option>\r
              <option value="database">数据库备份</option>\r
              <option value="es">ES 备份</option>\r
            </select>\r
            <input id="backupName" class="input" placeholder="备份名称（可选）" />\r
            <button id="runBackupBtn" class="btn">开始备份</button>\r
          </div>\r
          <div class="row">\r
            <input id="backupTarget" class="input" placeholder="备份目录（可选，支持修改存储路径）" />\r
            <button id="backupSelectTargetBtn" class="btn sm" type="button">选择备份目标</button>\r
            <button id="backupCreateTargetBtn" class="btn sm" type="button">新建目录</button>\r
          </div>\r
          <div class="row">\r
            <div id="backupSourceSummary" class="backup-source-summary">未选择备份源，默认使用配置文件中的源目录</div>\r
            <button id="backupSelectSourceBtn" class="btn sm" type="button">选择备份源目录</button>\r
          </div>\r
          <div id="backupSourceList" class="selector backup-source-list"></div>\r
          <p class="hint">数据库和 ES 备份命令来源于配置文件 \`backup.databases / backup.es\`。</p>\r
        </article>\r
        <article class="card">\r
          <h3>备份文件列表</h3>\r
          <div id="backupList" class="table"></div>\r
        </article>\r
      </section>\r
\r
      <section id="cleanup" class="panel cleanup-panel">\r
        <article class="card cleanup-toolbar-card">\r
          <div class="cleanup-toolbar">\r
            <div class="cleanup-toolbar-title">\r
              <h3>数据清理 / 空间分析</h3>\r
              <span id="cleanupIndexerTag" class="cleanup-indexer-tag">内置扫描引擎</span>\r
            </div>\r
            <div class="cleanup-toolbar-ops">\r
              <button id="cleanupLoadRootsBtn" class="btn sm" type="button">刷新分区</button>\r
              <button id="cleanupOpenTreeBtn" class="btn sm" type="button">从目录树选择</button>\r
              <button id="cleanupScanBtn" class="btn sm" type="button">开始扫描</button>\r
              <button id="cleanupStopScanBtn" class="btn sm danger" type="button" disabled>停止扫描</button>\r
            </div>\r
          </div>\r
          <div class="cleanup-filter-row">\r
            <div id="cleanupRootOptions" class="selector cleanup-root-options"></div>\r
          </div>\r
          <div class="cleanup-filter-row">\r
            <input id="cleanupCustomRoot" class="input" placeholder="自定义扫描目录（绝对路径），例如 D:\\data 或 /data/logs" />\r
            <button id="cleanupAddRootBtn" class="btn sm" type="button">添加目录</button>\r
          </div>\r
          <div id="cleanupCustomRootList" class="selector cleanup-custom-roots"></div>\r
          <div class="cleanup-filter-row compact">\r
            <input id="cleanupSearch" class="input" placeholder="模糊搜索：文件名 / 路径 / 文件类型" />\r
            <input id="cleanupLargeThresholdGB" class="input sm" value="1" />\r
            <button id="cleanupApplyFilterBtn" class="btn sm" type="button">应用筛选</button>\r
          </div>\r
          <div class="scan-progress-card">\r
            <div class="scan-progress-track">\r
              <span id="cleanupScanProgressBar" class="scan-progress-bar"></span>\r
            </div>\r
            <div id="cleanupScanProgressText" class="scan-progress-text">等待开始</div>\r
          </div>\r
          <div class="cleanup-kpi-grid">\r
            <div class="cleanup-kpi-card">\r
              <div class="cleanup-kpi-label">已扫描文件</div>\r
              <div id="cleanupKpiScanned" class="cleanup-kpi-value">0</div>\r
            </div>\r
            <div class="cleanup-kpi-card">\r
              <div class="cleanup-kpi-label">当前命中</div>\r
              <div id="cleanupKpiMatched" class="cleanup-kpi-value">0</div>\r
            </div>\r
            <div class="cleanup-kpi-card">\r
              <div class="cleanup-kpi-label">命中总大小</div>\r
              <div id="cleanupKpiSize" class="cleanup-kpi-value">0 B</div>\r
            </div>\r
            <div class="cleanup-kpi-card">\r
              <div class="cleanup-kpi-label">大文件数量</div>\r
              <div id="cleanupKpiLarge" class="cleanup-kpi-value">0</div>\r
            </div>\r
          </div>\r
          <p id="cleanupSummary" class="hint">未开始扫描</p>\r
        </article>\r
\r
        <div class="cleanup-main-grid">\r
          <article class="card cleanup-card-main">\r
            <div class="card-head">\r
              <h3>体积热区（WizTree 风格）</h3>\r
            </div>\r
            <div id="cleanupTopBars" class="cleanup-bars-view"></div>\r
            <div id="cleanupFileList" class="table"></div>\r
          </article>\r
          <div class="cleanup-side-column">\r
            <article class="card">\r
              <div class="card-head">\r
                <h3>大文件（按大小降序）</h3>\r
              </div>\r
              <div id="cleanupLargeFileList" class="table"></div>\r
            </article>\r
            <article class="card">\r
              <div class="card-head">\r
                <h3>目录占用排行</h3>\r
              </div>\r
              <div id="cleanupDirChart" class="cleanup-mini-chart"></div>\r
              <div id="cleanupDirSummaryList" class="table"></div>\r
            </article>\r
            <article class="card">\r
              <div class="card-head">\r
                <h3>文件类型分布</h3>\r
              </div>\r
              <div id="cleanupTypeChart" class="cleanup-mini-chart"></div>\r
              <div id="cleanupTypeSummaryList" class="table"></div>\r
            </article>\r
          </div>\r
        </div>\r
\r
        <article class="card cleanup-garbage-card">\r
          <div class="card-head">\r
            <h3>垃圾清理（安全模式）</h3>\r
            <div class="ops">\r
              <button id="cleanupPreviewBtn" class="btn sm" type="button">预估可清理</button>\r
              <button id="cleanupRunBtn" class="btn sm danger" type="button">执行清理</button>\r
              <button id="cleanupStopGarbageBtn" class="btn sm" type="button" disabled>停止清理</button>\r
            </div>\r
          </div>\r
          <p class="hint">仅清理缓存 / 临时 / 日志类旧文件，并保留近期文件，避免影响系统运行。</p>\r
          <div id="cleanupGarbageTargets" class="selector"></div>\r
          <p id="cleanupGarbageSummary" class="hint">未开始清理</p>\r
          <div id="cleanupGarbageResult" class="table"></div>\r
        </article>\r
      </section>\r
\r
      <section id="docker" class="panel docker-panel">\r
        <article class="card docker-hero-card">\r
          <div class="docker-hero-head">\r
            <div>\r
              <h3>Docker 管理中心</h3>\r
              <p id="dockerStatusSummary" class="hint docker-status-summary">未加载 Docker 状态</p>\r
            </div>\r
            <div class="docker-hero-badge">Container Ops</div>\r
          </div>\r
          <div class="docker-kpi-grid">\r
            <div class="docker-kpi-card total">\r
              <span>容器总数</span>\r
              <strong id="dockerKpiTotal">0</strong>\r
            </div>\r
            <div class="docker-kpi-card running">\r
              <span>运行中</span>\r
              <strong id="dockerKpiRunning">0</strong>\r
            </div>\r
            <div class="docker-kpi-card stopped">\r
              <span>已停止</span>\r
              <strong id="dockerKpiStopped">0</strong>\r
            </div>\r
            <div class="docker-kpi-card image">\r
              <span>镜像数量</span>\r
              <strong id="dockerKpiImages">0</strong>\r
            </div>\r
          </div>\r
        </article>\r
\r
        <article class="card docker-table-card">\r
          <div class="card-head">\r
            <h3>Docker 资产管理</h3>\r
            <div class="ops">\r
              <input id="dockerSearch" class="input" placeholder="搜索容器名 / 镜像 / ID / 状态" />\r
              <select id="dockerScope" class="input sm">\r
                <option value="all">全部容器</option>\r
                <option value="running">仅运行中</option>\r
              </select>\r
              <button id="dockerRefreshBtn" class="btn sm" type="button">刷新容器</button>\r
            </div>\r
          </div>\r
          <div class="docker-tabs">
            <button id="dockerTabContainers" class="btn sm active" type="button">容器</button>
            <button id="dockerTabImages" class="btn sm" type="button">镜像</button>
          </div>
          <div id="dockerBatchActions" class="docker-batch-actions">
            <select id="dockerBatchActionType" class="input sm" aria-label="批量操作类型"></select>
            <button id="dockerBatchApplyBtn" class="btn sm" type="button">执行批量操作</button>
            <span class="hint">先勾选要操作的行，再执行</span>
          </div>
          <div class="docker-pagination">\r
            <div class="docker-pagination-left">\r
              <button id="dockerPrevBtn" class="btn sm" type="button">上一页</button>\r
              <button id="dockerNextBtn" class="btn sm" type="button">下一页</button>\r
              <span id="dockerPageInfo" class="docker-pagination-info">0 / 0</span>\r
              <span id="dockerTotalInfo" class="docker-pagination-total">共 0 个容器</span>\r
            </div>\r
            <div class="docker-pagination-right">\r
              <label for="dockerPageSize">每页</label>\r
              <select id="dockerPageSize" class="input sm">\r
                <option value="10">10</option>\r
                <option value="20" selected>20</option>\r
                <option value="50">50</option>\r
                <option value="100">100</option>\r
              </select>\r
            </div>\r
          </div>\r
          <div id="dockerContainerTable" class="table"></div>\r
          <div id="dockerImageTable" class="table hidden"></div>\r
        </article>\r
      </section>

      <section id="remote-control" class="panel remote-panel">
        <article class="card remote-card">
          <div class="card-head">
            <h3>远程桌面控制</h3>
            <div class="ops remote-ops">
              <select id="remoteFps" class="input sm">
                <option value="5">5 FPS</option>
                <option value="8" selected>8 FPS</option>
                <option value="12">12 FPS</option>
                <option value="15">15 FPS</option>
              </select>
              <select id="remoteQuality" class="input sm">
                <option value="45">清晰度 45%</option>
                <option value="60" selected>清晰度 60%</option>
                <option value="75">清晰度 75%</option>
                <option value="85">清晰度 85%</option>
              </select>
              <select id="remoteScale" class="input sm">
                <option value="0.5">分辨率 50%</option>
                <option value="0.75" selected>分辨率 75%</option>
                <option value="1">分辨率 100%</option>
              </select>
              <button id="remoteConnectBtn" class="btn sm" type="button">连接桌面</button>
              <button id="remoteDisconnectBtn" class="btn sm danger" type="button" disabled>断开</button>
              <button id="remoteFullscreenBtn" class="btn sm" type="button">全屏</button>
            </div>
          </div>
          <div class="remote-status-row">
            <span id="remoteStatusBadge" class="badge unknown">未连接</span>
            <span id="remoteStatusText" class="hint">等待连接</span>
            <span class="hint">鼠标点击/拖动/滚轮和键盘按键会直接控制服务器桌面。</span>
          </div>
          <div id="remoteDesktopWrap" class="remote-desktop-wrap">
            <canvas id="remoteDesktopCanvas" class="remote-desktop-canvas" width="1280" height="720" tabindex="0"></canvas>
            <div id="remoteDesktopOverlay" class="remote-desktop-overlay">点击“连接桌面”开始远程控制</div>
          </div>
        </article>
      </section>

      <section id="system" class="panel system-panel">
        <div class="grid cards-2">
          <article class="card">\r
            <div class="card-head">
              <h3>系统管理 / 全局配置</h3>
              <div class="ops">
                <button id="systemSaveBtn" class="btn sm" type="button">保存配置</button>
              </div>
            </div>
            <div class="system-simple-note">只保留常用核心配置，其他参数收纳到高级设置。</div>
            <div class="system-form-grid system-core-grid">
              <label class="field">
                <span>系统标题</span>
                <input id="systemSiteTitle" class="input" placeholder="OPS 运维控制台" />
              </label>
              <label class="field">
                <span>环境</span>\r
                <input id="systemEnvironment" class="input" placeholder="production / staging" />\r
              </label>\r
              <label class="field">\r
                <span>负责人</span>\r
                <input id="systemOwner" class="input" placeholder="platform-team" />\r
              </label>\r
              <label class="field">
                <span>监听地址</span>
                <input id="systemListen" class="input" placeholder="0.0.0.0:18082" />
              </label>
            </div>
            <details class="system-advanced">
              <summary>高级设置（非必要可忽略）</summary>
              <div class="system-form-grid">
                <label class="field">
                  <span>默认Shell</span>
                  <input id="systemDefaultShell" class="input" placeholder="sh / powershell / bash" />
                </label>
                <label class="field">
                  <span>默认工作目录</span>
                  <input id="systemDefaultWorkDir" class="input" placeholder="." />
                </label>
                <label class="field">
                  <span>监控刷新秒数</span>
                  <input id="systemRefreshSeconds" class="input" placeholder="5" />
                </label>
                <label class="field">
                  <span>运行日志路径</span>
                  <input id="systemRuntimeLogPath" class="input" placeholder="logs/ops-console/runtime.log" />
                </label>
                <label class="field">
                  <span>运行日志缓存条数</span>
                  <input id="systemRuntimeLogMaxEntries" class="input" placeholder="3000" />
                </label>
                <label class="field">
                  <span>并发任务数</span>
                  <input id="systemMaxConcurrentTasks" class="input" placeholder="4" />
                </label>
                <label class="field">
                  <span>清理进度刷新(ms)</span>
                  <input id="systemCleanupProgressInterval" class="input" placeholder="300" />
                </label>
                <label class="field">
                  <span>Docker 默认分页</span>
                  <input id="systemDockerPageSize" class="input" placeholder="20" />
                </label>
              </div>
              <div class="system-menu-visibility">
                <h4>菜单显示控制</h4>
                <div id="systemMenuVisibility" class="selector"></div>
              </div>
            </details>
          </article>
          <article class="card">\r
            <div class="card-head">\r
              <h3>系统运行日志</h3>\r
              <div class="ops">\r
                <input id="runtimeLogKeyword" class="input sm" placeholder="关键字筛选" />\r
                <select id="runtimeLogLevel" class="input sm">\r
                  <option value="all">全部级别</option>\r
                  <option value="info">INFO</option>\r
                  <option value="warn">WARN</option>\r
                  <option value="error">ERROR</option>\r
                  <option value="debug">DEBUG</option>\r
                </select>\r
                <button id="runtimeLogRefreshBtn" class="btn sm" type="button">刷新</button>\r
              </div>\r
            </div>\r
            <div id="runtimeLogMeta" class="hint">-</div>\r
            <div id="runtimeLogList" class="runtime-log-list"></div>\r
          </article>\r
        </div>\r
      </section>\r
    </main>\r
  </div>\r
\r
  <div id="modalMask" class="modal-mask hidden">\r
    <div class="modal">\r
      <div class="modal-head">\r
        <h3 id="modalTitle">详情</h3>\r
        <button id="modalCloseBtn" class="btn sm">关闭</button>\r
      </div>\r
      <div id="modalBody" class="modal-body"></div>\r
    </div>\r
  </div>\r
`,a={config:null,monitorTimer:null,monitorPaused:!1,monitorSnapshot:null,combinedProcesses:[],processSortMode:"cpu_desc",trendHistory:{cpu:[],memory:[],network:[],process:[],diskio:[]},trendLastSample:null,activeTrendKey:"",activeTrendAutoFollow:!0,activeTrendScrollLeft:0,diskLastSample:null,lastDiskRealtime:null,scripts:[],scriptRuns:[],backups:[],trafficSnapshot:null,trafficInterfaces:[],trafficPollTimer:null,trafficAutoStartTried:!1,trafficSelectedPacketID:"",trafficContextPacketID:"",trafficDecodeMode:"auto",apps:[],logRules:[],currentApp:null,currentRunId:null,logRealtimeTimer:null,monitorWS:null,monitorWSConnected:!1,monitorWSRetryTimer:null,monitorWSRetryAttempt:0,cleanupMeta:null,cleanupScan:null,cleanupScanJobId:"",cleanupScanPollTimer:null,cleanupScanProgress:null,cleanupScanAbortController:null,cleanupGarbageAbortController:null,cleanupFilteredFiles:[],cleanupFilteredLargeFiles:[],cleanupCustomRoots:[],dockerStatus:null,dockerContainers:[],dockerImages:[],dockerTab:"containers",dockerSelectedContainerIDs:[],dockerSelectedImageIDs:[],dockerPage:1,dockerPageSize:20,dockerTotal:0,dockerTotalPages:0,dockerLogTimer:null,dockerLogContainerID:"",dockerLogContainerName:"",remoteMeta:null,remoteConnected:!1,remoteAutoConnectTried:!1,systemRuntimeLogs:[],fsTreeCache:{},fsModalMode:"",fsModalSelected:[],backupSelectedSources:[],cicdPipelines:[],cicdRuns:[],cicdCurrentRunId:0,cicdRunTimer:null,flowMonitorItems:[],flowMonitorRawItems:[],flowMonitorStatus:null,flowMonitorLastLoadedAt:0,flowMonitorUpdatedAt:0,flowMonitorLoading:!1,flowMonitorKeyword:"",flowMonitorProtocol:"all",flowMonitorStatusFilter:"all",flowMonitorSort:"time_desc",authAuthenticated:!1},G={total:11,done:0};let Pe=!1,dt=!1,Ke=null,ut=null,pt=null,mt=null,ft=null,wt=null,Ve=!1,Pn=!1,Rn="",pe=new Set,$e=[],W=null,rn=null,Ce=!1,_e=null,Je=0,D=null,ce=null,on=!1,sn=0,Te=!1,Dn=0,xn=0,fe="";const st=24*60*60*1e3,On=4,Jr=On*60*60*1e3,Xr=2400,Yr=980,Qr=1.8,Zr=1200,eo=15e3,to=15e3,Fn=100,no=1e3,ro=1e4,At={cpu:{title:"CPU 使用趋势",miniId:"trendMiniCpu",infoId:"trendInfoCpu",color:"#0f5fd8",fill:"rgba(15,95,216,0.18)",format:e=>`${M(e)}%`},memory:{title:"内存使用趋势",miniId:"trendMiniMemory",infoId:"trendInfoMemory",color:"#1a9b75",fill:"rgba(26,155,117,0.18)",format:e=>`${M(e)}%`},network:{title:"网络吞吐趋势（字节/秒）",miniId:"trendMiniNetwork",infoId:"trendInfoNetwork",color:"#cc7a12",fill:"rgba(204,122,18,0.16)",format:e=>`${S(e)}/秒`},process:{title:"进程总数趋势",miniId:"trendMiniProcess",infoId:"trendInfoProcess",color:"#6f52d9",fill:"rgba(111,82,217,0.15)",format:e=>b(Math.round(e))},diskio:{title:"磁盘 IO 吞吐趋势（字节/秒）",miniId:"trendMiniDiskIO",infoId:"trendInfoDiskIO",color:"#0d7fa5",fill:"rgba(13,127,165,0.16)",format:e=>`${S(e)}/秒`}};document.addEventListener("DOMContentLoaded",()=>{te("准备初始化界面...",0),Ke=setTimeout(()=>{Pe||(console.error("初始化超过 180 秒，准备自动重试"),G.done=0,te("初始化耗时较长，正在重试...",0),Nt())},18e4);try{so(),lo(),po(),Pt("monitor"),mo(),vo(),bo(),wo(),So(),$o(),Io(),Bo(),Mo(),Qo(),window.addEventListener("beforeunload",()=>{jt(),Re(),Ae(),Xt(),Dt(!1)}),oo()}catch(e){console.error("页面初始化失败",e),te("页面初始化失败，请刷新后重试",0)}});async function oo(){if(!await ao()){Hn(),jn("请先登录后使用系统");return}co(),Nt()}function so(){const e=document.getElementById("authLoginForm");e&&e.addEventListener("submit",async t=>{var o,s;t.preventDefault();const n=String(((o=document.getElementById("authUsername"))==null?void 0:o.value)||"").trim(),r=String(((s=document.getElementById("authPassword"))==null?void 0:s.value)||"").trim();if(!n||!r){we("请填写用户名和密码","error");return}we("登录中...","info");try{const i=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:n,password:r})});let c={};try{c=await i.json()}catch{c={}}if(!i.ok){we(c.error||"登录失败","error");return}a.authAuthenticated=!0,we("登录成功，正在进入系统...","success"),window.location.reload()}catch(i){console.error("auth login failed",i),we("登录失败，请检查网络或服务状态","error")}})}async function ao(){try{const e=await P("/api/auth/status",8e3);if(!e.ok)return a.authAuthenticated=!1,!1;const t=await e.json();return a.authAuthenticated=!!(t!=null&&t.authenticated),a.authAuthenticated}catch(e){return console.error("check auth status failed",e),a.authAuthenticated=!1,!1}}function io(e="登录已过期，请重新登录"){a.authAuthenticated=!1,a.monitorTimer&&(clearInterval(a.monitorTimer),a.monitorTimer=null),jt(),Ee(),Re(),Hn(),jn(e)}function jn(e=""){const t=document.getElementById("authOverlay");if(!t)return;t.classList.remove("hidden");const n=document.getElementById("authUsername");n&&!String(n.value||"").trim()&&(n.value="admin"),we(e||"请输入账号密码登录",e?"warning":"info")}function co(){const e=document.getElementById("authOverlay");e&&e.classList.add("hidden")}function we(e,t="info"){const n=document.getElementById("authMessage");if(!n)return;const r=String(e||"").trim();n.textContent=r||"请输入账号密码登录",n.classList.remove("error","success","warning","info"),n.classList.add(t||"info")}function Hn(){document.body.classList.remove("booting");const e=document.getElementById("bootOverlay");e&&(e.style.display="none")}function lo(){const e=document.getElementById("mainLayout"),t=document.getElementById("sidebarToggleBtn"),n=document.getElementById("sidebarExpandBtn");if(!e||!t||!n)return;const r=t.querySelector(".sidebar-toggle-text"),o=window.matchMedia("(max-width: 1080px)"),s="ops.sidebar.collapsed",i=()=>{try{return window.localStorage.getItem(s)==="1"}catch{return!1}},c=u=>{try{window.localStorage.setItem(s,u?"1":"0")}catch{}},l=(u,m={})=>{const g=o.matches?!1:!!u,y=g?"展开系统菜单":"收起系统菜单";e.classList.toggle("sidebar-collapsed",g),t.dataset.collapsed=String(g),n.dataset.collapsed=String(g),t.title=y,t.setAttribute("aria-label",y),t.setAttribute("aria-expanded",g?"false":"true"),n.title="展开系统菜单",n.setAttribute("aria-label","展开系统菜单"),n.setAttribute("aria-expanded",g?"false":"true"),r&&(r.textContent=y),m.persist!==!1&&c(g)};l(i(),{persist:!1});const d=()=>{o.matches&&l(!1,{persist:!1})};typeof o.addEventListener=="function"?o.addEventListener("change",d):typeof o.addListener=="function"&&o.addListener(d),t.addEventListener("click",()=>{const u=!e.classList.contains("sidebar-collapsed");l(u)}),n.addEventListener("click",()=>{l(!1)})}async function Nt(){if(a.authAuthenticated&&!(Pe||dt)){dt=!0;try{G.done=0;const e=[],t=async(r,o,s={})=>{const i=await an(r,o,{...s,required:!1});return i||e.push(r),i};await an("加载配置",Zo,{required:!0,retries:1,timeout:12e3}),await t("采集首批监控数据",()=>je(!1),{retries:2,timeout:45e3}),await t("加载趋势历史",es,{retries:1,timeout:2e4}),await t("加载应用和日志规则",Wt,{retries:1,timeout:16e3}),await t("加载流量分析基础信息",ye,{retries:1,timeout:16e3}),await t("加载脚本定义",ir,{retries:1,timeout:16e3}),await t("加载脚本执行历史",cr,{retries:1,timeout:16e3}),await t("加载备份记录",lr,{retries:1,timeout:16e3}),await t("加载流量监控",()=>Yn(!0),{retries:1,timeout:16e3}),await t("加载系统运行日志",Fe,{retries:1,timeout:16e3}),await t("同步系统管理表单",Gt,{retries:0,timeout:6e3});const n=e.length>0;if(uo(n?"初始化完成（部分数据稍后加载）":"初始化完成"),ts(),Ft(),n){const r=`部分模块初始化延迟：${e.join("、")}，已进入系统并将在后台重试`;h(r,"warning"),console.warn(r)}}catch(e){if(console.error("bootstrap failed",e),e&&String(e.message||"").toLowerCase().includes("unauthorized")){te("未登录，等待认证...",Math.floor(G.done/G.total*100));return}te("初始化失败，正在重试...",Math.floor(G.done/G.total*100)),setTimeout(()=>{Pe||Nt()},1500)}finally{dt=!1}}}async function an(e,t,n={}){const r=n.required!==!1,o=Math.max(0,Number(n.retries||0)),s=Math.max(3e3,Number(n.timeout||15e3));let i=null;te(`${e}...`,Math.floor(G.done/G.total*100));for(let l=0;l<=o;l++)try{await ta(Promise.resolve().then(()=>t()),s,`${e}超时`),i=null;break}catch(d){i=d,console.error(`初始化步骤失败: ${e}（第 ${l+1} 次）`,d),l<o&&(te(`${e}失败，重试中(${l+1}/${o})...`,Math.floor(G.done/G.total*100)),await fr(500))}G.done+=1;const c=Math.floor(G.done/G.total*100);if(i){if(te(`${e}失败`,c),r)throw i;return!1}return te(`${e}完成`,c),!0}function te(e,t){const n=document.getElementById("bootText"),r=document.getElementById("bootPercent"),o=document.getElementById("bootBar");n&&(n.textContent=e),r&&(r.textContent=`${t}%`),o&&(o.style.width=`${t}%`)}function uo(e="初始化完成"){Pe||(Pe=!0,Ke&&(clearTimeout(Ke),Ke=null),te(e,100),setTimeout(()=>{document.body.classList.remove("booting");const t=document.getElementById("bootOverlay");t&&(t.style.display="none")},220))}function po(){const e=document.querySelectorAll(".menu"),t=r=>{e.forEach(o=>{if(o.classList.contains("hidden"))return;const s=o===r;o.classList.toggle("active",s),o.setAttribute("aria-current",s?"page":"false")})},n=Array.from(e).find(r=>r.classList.contains("active"));n&&t(n),e.forEach(r=>{r.addEventListener("click",()=>{r.classList.contains("hidden")||(t(r),Pt(r.dataset.section))})})}function Pt(e){document.querySelectorAll(".panel").forEach(t=>{const n=t.id===e;t.classList.toggle("visible",n),t.style.display=n?"":"none"}),Rt(e),e==="cleanup"&&it().catch(t=>{console.error("load cleanup meta failed",t),h("加载数据清理配置失败","error")}),e==="docker"&&xt().catch(t=>{console.error("load docker dashboard failed",t),h("加载 Docker 数据失败","error")}),e==="remote-control"&&zn().catch(t=>{console.error("prepare remote terminal failed",t),h("初始化远程控制失败","error")}),e==="traffic"||e==="traffic-capture"?(ye(!0).catch(t=>{console.error("load traffic data failed",t),h("加载流量分析失败","error")}),vr()):Xt(),e==="system"&&(Gt().catch(t=>{console.error("apply system config form failed",t),h("加载系统配置失败","error")}),Fe().catch(t=>{console.error("load runtime logs failed",t),h("加载运行日志失败","error")}))}function mo(){var n,r;fo(),document.getElementById("monitorRefreshBtn").addEventListener("click",go),(n=document.getElementById("flowMonitorViewAllBtn"))==null||n.addEventListener("click",()=>{ps()}),(r=document.getElementById("flowMonitorList"))==null||r.addEventListener("click",o=>{const s=o.target.closest("[data-flow-detail]");if(!s)return;const i=String(s.dataset.flowDetail||"").trim();i&&ds(i)}),as(),document.getElementById("monitorToggleBtn").addEventListener("click",()=>{a.monitorPaused=!a.monitorPaused;const o=document.getElementById("monitorToggleBtn");if(o.textContent=a.monitorPaused?"恢复监控":"停止监控",a.monitorPaused){jt();return}je(),Ft()}),document.getElementById("openPortModalBtn").addEventListener("click",()=>{if(!a.monitorSnapshot)return;const o=(a.monitorSnapshot.ports||[]).map(s=>[tt(s),s.port,s.pid,Et(s.status),nt(s)]);z("端口详情",O(["进程名","端口","PID","状态","路径"],o))}),document.getElementById("openDiskMetaModalBtn").addEventListener("click",()=>{qs()});const e=document.getElementById("openSystemInfoModalBtn");e&&e.addEventListener("click",()=>{Ks()});const t=document.getElementById("systemInfoQuick");t&&(t.addEventListener("click",async o=>{const s=o.target.closest(".system-info-item");s&&await Sn(s)}),t.addEventListener("keydown",async o=>{if(o.key!=="Enter"&&o.key!==" ")return;const s=o.target.closest(".system-info-item");s&&(o.preventDefault(),await Sn(s))})),document.getElementById("processSearch").addEventListener("input",zt),document.getElementById("portSearch").addEventListener("input",ar),document.querySelectorAll(".trend-open-target").forEach(o=>{const s=()=>{const i=o.dataset.trendKey;i&&hs(i)};o.addEventListener("click",s),o.addEventListener("keydown",i=>{i.key!=="Enter"&&i.key!==" "||(i.preventDefault(),s())})}),document.getElementById("topProcessList").addEventListener("click",async o=>{const s=o.target.closest("th[data-sort-key]");if(s){Ss(s.dataset.sortKey);return}const i=o.target.closest(".process-detail-btn");if(i){const d=Number(i.dataset.pid||0);d>0&&await Es(d);return}const c=o.target.closest(".process-kill-btn");if(!c)return;const l=Number(c.dataset.pid||0);l<=0||confirm(`确认关闭进程 PID=${l} ?`)&&await Ts(l)})}function fo(){document.querySelectorAll(".trend-open-btn").forEach(e=>{const t=String(e.dataset.trendKey||"").trim(),n=e.closest(".trend-row"),r=n?n.querySelector(".mini-trend"):null;r&&(r.classList.add("trend-open-target"),t&&!r.dataset.trendKey&&(r.dataset.trendKey=t),r.dataset.hint||(r.dataset.hint="点击放大"),r.setAttribute("role","button"),r.setAttribute("tabindex","0"),r.setAttribute("title","点击放大查看 24 小时趋势")),e.remove()})}async function go(){let e=a.monitorSnapshot;try{const i=await fetch("/api/monitor"),c=await i.json();i.ok&&(e=c,a.monitorSnapshot=c)}catch(i){console.error("download monitor snapshot failed",i)}if(!e){h("当前暂无可下载的监控数据","warning");return}const t=yo(e),n=new Blob([t],{type:"text/plain;charset=utf-8"}),r=URL.createObjectURL(n),o=ho(e.time||Date.now()),s=document.createElement("a");s.href=r,s.download=`ops_status_${o}.txt`,document.body.appendChild(s),s.click(),s.remove(),setTimeout(()=>URL.revokeObjectURL(r),0)}function yo(e){var m,g,y,v,k,p,w,$,I,T,N,B,L,_,j,K,V,U,Y,oe,se,q,ne,C,he,ue,Qt,Zt;const t=a.lastDiskRealtime||{summary:{readBytesRate:0,writeBytesRate:0,readOpsRate:0,writeOpsRate:0},rateByKey:{}},n=t.summary||{readBytesRate:0,writeBytesRate:0,readOpsRate:0,writeOpsRate:0},r=t.rateByKey||{},o=[];o.push(`采样时间 ${J(e.time||Date.now())}`),o.push([`主机 ${R((m=e.os)==null?void 0:m.hostname)}`,`系统类型 ${R(((g=e.os)==null?void 0:g.os_type)||((y=e.os)==null?void 0:y.platform))}`,`系统版本 ${R((v=e.os)==null?void 0:v.version)}`,`内核版本 ${R(((k=e.os)==null?void 0:k.kernel_version)||"-")}`,`运行时长 ${qt((p=e.os)==null?void 0:p.uptime)}`].join(" | ")),o.push([`设备ID ${R(((w=e.os)==null?void 0:w.device_id)||"-",80)}`,`产品ID ${R((($=e.os)==null?void 0:$.product_id)||"-",80)}`].join(" | ")),o.push([`CPU ${M((I=e.cpu)==null?void 0:I.usage_percent)}%`,`核心 ${b((T=e.cpu)==null?void 0:T.core_count)}`,`型号 ${R((N=e.cpu)==null?void 0:N.model)}`,`架构 ${R((B=e.cpu)==null?void 0:B.architecture)}`,`频率 ${M((L=e.cpu)==null?void 0:L.frequency_mhz)}MHz`].join(" | "));const s=ur(((_=e.memory)==null?void 0:_.modules)||[]);o.push([`内存 ${S((j=e.memory)==null?void 0:j.used)} / ${S((K=e.memory)==null?void 0:K.total)} (${M((V=e.memory)==null?void 0:V.used_percent)}%)`,`交换区 ${S((U=e.memory)==null?void 0:U.swap_used)} / ${S((Y=e.memory)==null?void 0:Y.swap_total)} (${M((oe=e.memory)==null?void 0:oe.swap_used_rate)}%)`,`内存条 ${R(s)}`].join(" | ")),o.push([`网络IP ${R(((se=e.network)==null?void 0:se.primary_ip)||"-")}(${R(((q=e.network)==null?void 0:q.primary_nic)||"-")})`,`MAC ${R(((ne=e.network)==null?void 0:ne.primary_mac)||"-")}`,`连接数 ${b(((C=e.network)==null?void 0:C.connection_count)||0)}`,`累计入 ${S((he=e.network)==null?void 0:he.bytes_recv)}`,`累计出 ${S((ue=e.network)==null?void 0:ue.bytes_sent)}`,`包入 ${b((Qt=e.network)==null?void 0:Qt.packets_in)}`,`包出 ${b((Zt=e.network)==null?void 0:Zt.packets_out)}`].join(" | ")),o.push([`进程总数 ${b(e.process_count)}`,`线程总数 ${b(e.thread_count)}`,`磁盘IO实时读 ${le(n.readBytesRate)}/秒(${M(n.readOpsRate)}次/秒)`,`写 ${le(n.writeBytesRate)}/秒(${M(n.writeOpsRate)}次/秒)`].join(" | "));const i=e.disk_hardware||[];if(i.length){const A=i.slice(0,6).map(re=>`${R(re.model||re.name)}#${R(re.serial||"-")}@${S(re.size||0)}`).join(" ; ");o.push(`磁盘硬件(${i.length}) ${A}`)}const c=e.disks||[];o.push(`[磁盘状态] ${c.length} 项`),c.slice(0,24).forEach(A=>{const re=r[Vt(A)]||{readBytesRate:0,writeBytesRate:0,readOpsRate:0,writeOpsRate:0};o.push(`${R(A.path)} | ${R(A.device)} | ${M(A.used_percent)}% | ${S(A.used)}/${S(A.total)} | 读 ${le(re.readBytesRate)}/秒(${M(re.readOpsRate)}次/秒) 写 ${le(re.writeBytesRate)}/秒(${M(re.writeOpsRate)}次/秒)`)});const l=e.ports||[];o.push(`[监听端口] ${l.length} 项`),l.slice(0,40).forEach(A=>{o.push(`${A.port} | PID ${A.pid} | ${R(tt(A))} | ${R(nt(A))}`)});const d=Array.isArray(a.flowMonitorItems)?a.flowMonitorItems:[];o.push(`[流量监控] ${d.length} 项`),d.slice(0,50).forEach(A=>{o.push(`${R(A.name)} | ${R(A.flow_type)} | ${Ut(A.status)} | ${R(A.detail||"-",140)}`)});const u=a.combinedProcesses||[];return o.push(`[进程排行/JVM] ${u.length} 项`),u.slice(0,60).forEach(A=>{o.push(`${R(A.name)} | ${A.is_jvm?"JVM":"进程"} | PID ${A.pid} | CPU ${M(A.cpu)}% | 内存 ${M(A.memory)}% | 线程 ${b(A.threads)} | ${R(A.exe_path,120)}`)}),`${o.join(`
`)}
`}function J(e){const t=new Date(e);if(Number.isNaN(t.getTime()))return String(e||"-");const n=t.getFullYear(),r=String(t.getMonth()+1).padStart(2,"0"),o=String(t.getDate()).padStart(2,"0"),s=String(t.getHours()).padStart(2,"0"),i=String(t.getMinutes()).padStart(2,"0"),c=String(t.getSeconds()).padStart(2,"0");return`${n}-${r}-${o} ${s}:${i}:${c}`}function ho(e){const t=new Date(e);if(Number.isNaN(t.getTime()))return Date.now();const n=t.getFullYear(),r=String(t.getMonth()+1).padStart(2,"0"),o=String(t.getDate()).padStart(2,"0"),s=String(t.getHours()).padStart(2,"0"),i=String(t.getMinutes()).padStart(2,"0"),c=String(t.getSeconds()).padStart(2,"0");return`${n}${r}${o}_${s}${i}${c}`}function R(e,t=90){return F(String(e||"-").replace(/\s+/g," ").trim(),t)}function vo(){document.getElementById("logQueryBtn").addEventListener("click",()=>Oe(!1)),document.getElementById("logErrorBtn").addEventListener("click",()=>Oe(!0)),document.getElementById("logExportBtn").addEventListener("click",Ds),document.getElementById("logSourceSelect").addEventListener("change",Ls),document.getElementById("logDeleteCardBtn").addEventListener("click",async()=>{var t;const e=String(((t=a.currentApp)==null?void 0:t.name)||"").trim();if(!e){h("请先选择日志源","warning");return}await Rs(e)}),document.getElementById("logAddCardBtn").addEventListener("click",Ns)}function bo(){var e,t,n,r,o,s,i,c,l,d,u,m,g;(e=document.getElementById("trafficRefreshBtn"))==null||e.addEventListener("click",()=>ye(!0)),(t=document.getElementById("trafficCaptureRefreshBtn"))==null||t.addEventListener("click",()=>ye(!0)),(n=document.getElementById("trafficStartBtn"))==null||n.addEventListener("click",kr),(r=document.getElementById("trafficStopBtn"))==null||r.addEventListener("click",ya),(o=document.getElementById("trafficConnectionSearch"))==null||o.addEventListener("input",br),(s=document.getElementById("trafficApplyFilterBtn"))==null||s.addEventListener("click",de),(i=document.getElementById("trafficClearFilterBtn"))==null||i.addEventListener("click",()=>{const y=document.getElementById("trafficDisplayPreset"),v=document.getElementById("trafficDisplayFilter");y&&(y.value="all"),v&&(v.value=""),de()}),(c=document.getElementById("trafficDisplayPreset"))==null||c.addEventListener("change",de),(l=document.getElementById("trafficDisplayFilter"))==null||l.addEventListener("keydown",y=>{y.key==="Enter"&&(y.preventDefault(),de())}),(d=document.getElementById("trafficPacketTable"))==null||d.addEventListener("click",Sa),(u=document.getElementById("trafficPacketTable"))==null||u.addEventListener("contextmenu",$a),(m=document.getElementById("trafficPacketContextMenu"))==null||m.addEventListener("click",Ba),document.addEventListener("click",Yt),(g=document.getElementById("trafficHTTPTable"))==null||g.addEventListener("click",_a)}function Rt(e=""){var n;if((String(e||"").trim()||String(((n=document.querySelector(".panel.visible"))==null?void 0:n.id)||"").trim())!=="logs"||!a.currentApp){Ee();return}ko()}function ko(){Ee();const e=2e3;a.logRealtimeTimer=setInterval(()=>{a.currentApp&&Oe(!1,{silent:!0,fromRealtime:!0})},e)}function Ee(){a.logRealtimeTimer&&(clearInterval(a.logRealtimeTimer),a.logRealtimeTimer=null)}function wo(){document.getElementById("uploadScriptForm").addEventListener("submit",async e=>{e.preventDefault();const t=new FormData(e.target),n=await fetch("/api/scripts/upload",{method:"POST",body:t}),r=await n.json();if(!n.ok){h(r.error||"上传失败","error");return}e.target.reset(),await ir(),h("脚本上传成功","success")}),document.getElementById("runScriptBtn").addEventListener("click",async()=>{const e=document.getElementById("scriptName").value,t=document.getElementById("scriptArgs").value;if(!e){h("请选择脚本","warning");return}const n=await fetch("/api/scripts/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:e,args:t})}),r=await n.json();if(!n.ok){h(r.error||"执行失败","error");return}a.currentRunId=r.run_id,h("脚本已开始执行","success"),Os()})}function So(){var e,t,n;(e=document.getElementById("backupSelectSourceBtn"))==null||e.addEventListener("click",()=>{Mt({mode:"backup-source",title:"选择备份源目录",multi:!0,selected:a.backupSelectedSources,onConfirm:r=>{a.backupSelectedSources=[...r],rt()}})}),(t=document.getElementById("backupSelectTargetBtn"))==null||t.addEventListener("click",()=>{var r;Mt({mode:"backup-target",title:"选择备份目标目录",multi:!1,selected:[String(((r=document.getElementById("backupTarget"))==null?void 0:r.value)||"").trim()].filter(Boolean),allowCreate:!0,onConfirm:o=>{document.getElementById("backupTarget").value=o[0]||""}})}),(n=document.getElementById("backupCreateTargetBtn"))==null||n.addEventListener("click",async()=>{var i;const r=String(((i=document.getElementById("backupTarget"))==null?void 0:i.value)||"").trim(),o=prompt("请输入要创建的目录绝对路径",r||"");if(!o)return;const s=await yr(o);document.getElementById("backupTarget").value=s,h(`目录已创建: ${s}`,"success")}),document.getElementById("runBackupBtn").addEventListener("click",async()=>{const r=document.getElementById("backupType").value,o=document.getElementById("backupName").value,s=document.getElementById("backupTarget").value,i=await fetch("/api/backups/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:r,name:o,target:s,paths:a.backupSelectedSources})}),c=await i.json();if(!i.ok){h(c.error||"备份失败","error");return}await lr(),h("备份任务已提交","success")}),rt()}function $o(){const e=document.getElementById("cleanupScanBtn");if(!e)return;const t=document.getElementById("cleanupStopScanBtn"),n=document.getElementById("cleanupStopGarbageBtn"),r=document.getElementById("cleanupLoadRootsBtn"),o=document.getElementById("cleanupOpenTreeBtn"),s=document.getElementById("cleanupAddRootBtn"),i=document.getElementById("cleanupCustomRoot"),c=document.getElementById("cleanupCustomRootList");r&&r.addEventListener("click",async()=>{await it(!0)}),o&&o.addEventListener("click",()=>{Mt({mode:"cleanup-root",title:"选择扫描目录",multi:!0,selected:a.cleanupCustomRoots,onConfirm:l=>{a.cleanupCustomRoots=[...l],De()}})}),s&&s.addEventListener("click",()=>{pn()}),i&&i.addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),pn())}),c&&c.addEventListener("click",l=>{const d=l.target.closest("button[data-path]");d&&jo(String(d.dataset.path||""))}),e.addEventListener("click",Gn),t&&(t.addEventListener("click",zo),t.disabled=!0),n&&(n.addEventListener("click",Ko),n.disabled=!0),document.getElementById("cleanupApplyFilterBtn").addEventListener("click",qe),document.getElementById("cleanupSearch").addEventListener("input",qe),document.getElementById("cleanupLargeThresholdGB").addEventListener("change",qe),document.getElementById("cleanupPreviewBtn").addEventListener("click",()=>fn(!0)),document.getElementById("cleanupRunBtn").addEventListener("click",()=>fn(!1)),x("cleanupFileList",["序号","类型","修改时间","大小","大小占比","完整路径"],[]),x("cleanupLargeFileList",["序号","类型","修改时间","大小","大小占比","完整路径"],[]),x("cleanupDirSummaryList",["目录","文件数","占用","占比"],[]),x("cleanupTypeSummaryList",["类型","文件数","占用","占比"],[]),x("cleanupGarbageResult",["目标","候选文件","候选体积","已清理文件","已清理体积","失败数","目录"],[]),De()}function Io(){var u,m;const e=document.getElementById("dockerRefreshBtn"),t=document.getElementById("dockerSearch"),n=document.getElementById("dockerScope"),r=document.getElementById("dockerPageSize"),o=document.getElementById("dockerBatchActionType"),s=document.getElementById("dockerBatchApplyBtn"),i=document.getElementById("dockerPrevBtn"),c=document.getElementById("dockerNextBtn"),l=document.getElementById("dockerContainerTable"),d=document.getElementById("dockerImageTable");!e||!t||!n||!l||(e.addEventListener("click",()=>{a.dockerPage=1,xt(!0).catch(g=>{console.error("refresh docker dashboard failed",g),h("刷新 Docker 数据失败","error")})}),t.addEventListener("input",()=>{mt&&clearTimeout(mt),mt=setTimeout(()=>{a.dockerPage=1,me(!0).catch(g=>{console.error("search docker containers failed",g),h("加载容器列表失败","error")})},260)}),n.addEventListener("change",()=>{a.dockerPage=1,me(!0).catch(g=>{console.error("reload docker containers failed",g),h("加载容器列表失败","error")})}),r&&r.addEventListener("change",()=>{const g=Number(r.value||20);a.dockerPageSize=Number.isFinite(g)&&g>0?g:20,a.dockerPage=1,me(!0).catch(y=>{console.error("change docker page size failed",y),h("加载容器列表失败","error")})}),i&&i.addEventListener("click",()=>{a.dockerPage<=1||(a.dockerPage-=1,me(!0).catch(g=>{console.error("docker prev page failed",g),h("加载容器列表失败","error")}))}),c&&c.addEventListener("click",()=>{a.dockerTotalPages<=0||a.dockerPage>=a.dockerTotalPages||(a.dockerPage+=1,me(!0).catch(g=>{console.error("docker next page failed",g),h("加载容器列表失败","error")}))}),l.addEventListener("click",Ro),d==null||d.addEventListener("click",la),(u=document.getElementById("dockerTabContainers"))==null||u.addEventListener("click",()=>$n("containers")),(m=document.getElementById("dockerTabImages"))==null||m.addEventListener("click",()=>$n("images")),s&&s.addEventListener("click",async()=>{const g=String((o==null?void 0:o.value)||"").trim();g&&(g==="remove-image"?await ca("remove"):await ia(g))}),hr())}function Bo(){var e,t,n,r,o,s;(e=document.getElementById("remoteConnectBtn"))==null||e.addEventListener("click",()=>{at(!0).catch(i=>{console.error("connect remote desktop failed",i),h(i.message||"连接远程桌面失败","error")})}),(t=document.getElementById("remoteDisconnectBtn"))==null||t.addEventListener("click",()=>Dt(!0)),(n=document.getElementById("remoteFullscreenBtn"))==null||n.addEventListener("click",()=>$t()),(r=document.getElementById("remoteFps"))==null||r.addEventListener("change",()=>yt()),(o=document.getElementById("remoteQuality"))==null||o.addEventListener("change",()=>yt()),(s=document.getElementById("remoteScale"))==null||s.addEventListener("change",()=>yt()),document.addEventListener("keydown",ln),document.addEventListener("keyup",ln)}async function zn(){D||_o(),a.remoteMeta?Wn():await Eo(),a.remoteAutoConnectTried||(a.remoteAutoConnectTried=!0,await at(!1))}function _o(){const e=document.getElementById("remoteDesktopCanvas"),t=document.getElementById("remoteDesktopWrap");if(!(!e||!t||D)){if(D=e,ce=e.getContext("2d"),!ce)throw new Error("浏览器不支持画布渲染");ce.fillStyle="#0d1628",ce.fillRect(0,0,e.width,e.height),on||(Lo(e),on=!0),t&&typeof ResizeObserver=="function"&&(rn=new ResizeObserver(()=>Xe()),rn.observe(t)),window.addEventListener("resize",Xe)}}async function Eo(){const e=await P("/api/remote/meta",12e3),t=await e.json();if(!e.ok)throw new Error(t.error||"加载远程控制配置失败");if(t&&t.available===!1)throw new Error(t.error||"服务器未检测到可用桌面");return a.remoteMeta=t||null,Wn(),a.remoteMeta}function Wn(){var r,o,s,i,c;const e=document.getElementById("remoteFps"),t=document.getElementById("remoteQuality"),n=document.getElementById("remoteScale");if(e&&((r=a.remoteMeta)!=null&&r.default_fps)&&(e.value=String(a.remoteMeta.default_fps)),t&&((o=a.remoteMeta)!=null&&o.default_quality)&&(t.value=String(a.remoteMeta.default_quality)),n&&((s=a.remoteMeta)!=null&&s.default_scale)&&(n.value=String(a.remoteMeta.default_scale)),a.remoteMeta&&Number(a.remoteMeta.can_input)===0)Q("unknown","仅支持桌面查看，当前系统不支持网页输入控制");else{const l=Number(((i=a.remoteMeta)==null?void 0:i.width)||0),d=Number(((c=a.remoteMeta)==null?void 0:c.height)||0);l>0&&d>0&&ie(`等待连接桌面 (${l}x${d})`)}}async function at(e=!0){var c,l,d;if(await zn(),W&&(W.readyState===WebSocket.OPEN||W.readyState===WebSocket.CONNECTING)){D==null||D.focus();return}St();const t=location.protocol==="https:"?"wss":"ws",n=Number(H("remoteFps")||((c=a.remoteMeta)==null?void 0:c.default_fps)||8),r=Number(H("remoteQuality")||((l=a.remoteMeta)==null?void 0:l.default_quality)||60),o=Number(H("remoteScale")||((d=a.remoteMeta)==null?void 0:d.default_scale)||.75),s=new URLSearchParams({fps:String(Number.isFinite(n)?n:8),quality:String(Number.isFinite(r)?r:60),scale:String(Number.isFinite(o)?o:.75)});Ce=!1,a.remoteConnected=!1,Q("unknown","正在连接远程桌面..."),Ue(!1),ie("正在连接远程桌面...");const i=new WebSocket(`${t}://${location.host}/ws/remote/desktop?${s.toString()}`);i.binaryType="arraybuffer",W=i,i.addEventListener("message",u=>{if(typeof u.data!="string"){To(u.data);return}let m=null;try{m=JSON.parse(u.data)}catch{return}const g=String((m==null?void 0:m.type)||"").trim();if(g==="meta"){a.remoteConnected=!0;const y=Number(m.width||0),v=Number(m.height||0);D&&y>0&&v>0&&(D.width!==y||D.height!==v)&&(D.width=y,D.height=v),Q("up",`已连接 ${y||"-"}x${v||"-"} · ${m.fps||n} FPS`),Je=0,St(),Ue(!0),ie(""),Xe(),D==null||D.focus(),e&&h("远程桌面连接成功","success");return}if(g==="error"){const y=String(m.error||"远程桌面异常");Q("down",y),ie(y),e&&h(y,"error");return}}),i.addEventListener("close",()=>{W===i&&(W=null,a.remoteConnected=!1,Ue(!1),Ce?(Q("unknown","连接已断开"),ie("已断开连接")):(Q("down","连接已断开"),ie("连接已断开，点击“连接桌面”重试")),Ce||Kn())}),i.addEventListener("error",()=>{W===i&&(Q("down","连接失败，请检查服务器图形环境"),ie("连接失败"))})}function Dt(e=!1){Ce=!0,St(),Je=0,W&&(W.readyState===WebSocket.OPEN||W.readyState===WebSocket.CONNECTING)&&W.close(),W=null,a.remoteConnected=!1,Ue(!1),Q("unknown","未连接"),ie("已断开连接"),e&&h("远程桌面已断开","success")}function St(){_e&&(clearTimeout(_e),_e=null)}function Kn(){if(_e)return;const e=Je+1;Je=e;const t=Math.min(ro,no*Math.pow(2,Math.min(5,e-1)));Q("down",`连接断开，${Math.round(t/1e3)} 秒后自动重连...`),_e=setTimeout(()=>{_e=null,!Ce&&at(!1).catch(n=>{console.error("remote auto reconnect failed",n),Kn()})},t)}function To(e){if(!ce||!D||!e)return;const t=new Blob([e],{type:"image/jpeg"});createImageBitmap(t).then(n=>{if(!ce||!D){n.close();return}ce.clearRect(0,0,D.width,D.height),ce.drawImage(n,0,0,D.width,D.height),n.close()}).catch(()=>{})}function Xe(){const e=document.getElementById("remoteDesktopWrap"),t=D;if(!e||!t)return;const n=Math.max(1,e.clientWidth),r=Math.max(1,e.clientHeight);t.style.width=`${n}px`,t.style.height=`${r}px`}function ie(e){const t=document.getElementById("remoteDesktopOverlay");if(!t)return;const n=String(e||"").trim();t.textContent=n,t.style.display=n?"":"none"}function Lo(e){e.addEventListener("mousedown",t=>{Te=!0,e.focus();const n=gt(t,e);Se({type:"down",x:n.x,y:n.y,button:cn(t.button)})}),e.addEventListener("mouseup",t=>{Te=!1;const n=gt(t,e);Se({type:"up",x:n.x,y:n.y,button:cn(t.button)})}),e.addEventListener("mousemove",t=>{const n=Date.now();if(!Te&&n-sn<26)return;sn=n;const r=gt(t,e);Se({type:"move",x:r.x,y:r.y})}),e.addEventListener("mouseleave",()=>{Te&&(Te=!1,Se({type:"up",x:Dn,y:xn,button:"left"}))}),e.addEventListener("wheel",t=>{t.preventDefault();const n=t.deltaY>0?-1:1;Se({type:"wheel",delta:n})},{passive:!1}),e.addEventListener("contextmenu",t=>t.preventDefault())}function gt(e,t){const n=t.getBoundingClientRect(),r=(e.clientX-n.left)/Math.max(1,n.width),o=(e.clientY-n.top)/Math.max(1,n.height),s={x:Math.max(0,Math.min(1,r)),y:Math.max(0,Math.min(1,o))};return Dn=s.x,xn=s.y,s}function cn(e){return e===2?"right":e===1?"middle":"left"}async function Se(e){if(a.remoteConnected&&!(a.remoteMeta&&Number(a.remoteMeta.can_input)===0)){if(W&&W.readyState===WebSocket.OPEN)try{W.send(JSON.stringify({type:"input",input:e}));return}catch{}try{const t=await fetch("/api/remote/input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok&&t.status!==400){const n=await t.json().catch(()=>({}));n!=null&&n.error&&Q("down",n.error)}}catch{}}}function yt(){a.remoteConnected&&(Dt(!1),at(!1).catch(e=>{console.error("reconnect remote desktop failed",e),Q("down",e.message||"重连失败")}))}function Q(e,t){const n=document.getElementById("remoteStatusBadge"),r=document.getElementById("remoteStatusText");if(n){n.classList.remove("up","down","unknown");const o=e==="up"||e==="down"?e:"unknown";n.classList.add(o),n.textContent=o==="up"?"已连接":o==="down"?"异常":"未连接"}r&&(r.textContent=t||"-")}function Ue(e){const t=document.getElementById("remoteConnectBtn"),n=document.getElementById("remoteDisconnectBtn");t&&(t.disabled=!!e),n&&(n.disabled=!e)}function $t(e=null){const t=document.getElementById("remoteDesktopWrap"),n=document.getElementById("remoteFullscreenBtn");if(!t)return;const r=typeof e=="boolean"?e:!t.classList.contains("fullscreen");t.classList.toggle("fullscreen",r),document.body.classList.toggle("remote-desktop-fullscreen",r),n&&(n.textContent=r?"退出全屏":"全屏"),Xe()}function ln(e){var l,d,u,m,g;if(!((l=document.getElementById("remote-control"))==null?void 0:l.classList.contains("visible")))return;const n=String(e.key||"").toLowerCase(),r=e.type==="keydown";if(e.key==="Escape"&&((d=document.getElementById("remoteDesktopWrap"))!=null&&d.classList.contains("fullscreen"))){$t(!1);return}if(e.ctrlKey&&e.shiftKey&&n==="f"){e.preventDefault(),$t();return}if(!a.remoteConnected)return;const o=String(((u=e.target)==null?void 0:u.tagName)||"").toLowerCase(),s=o==="input"||o==="textarea"||o==="select"||((m=e.target)==null?void 0:m.isContentEditable),i=document.activeElement===D,c=(g=document.getElementById("remoteDesktopWrap"))==null?void 0:g.classList.contains("fullscreen");!i&&!c||s||e.key==="Meta"||e.key==="Unidentified"||(e.preventDefault(),Se({type:r?"key_down":"key_up",key:String(e.key||""),code:String(e.code||"")}))}function Mo(){var e,t,n,r;(e=document.getElementById("runtimeLogRefreshBtn"))==null||e.addEventListener("click",()=>Fe(!0)),(t=document.getElementById("runtimeLogKeyword"))==null||t.addEventListener("input",na),(n=document.getElementById("runtimeLogLevel"))==null||n.addEventListener("change",()=>Fe(!0)),(r=document.getElementById("systemSaveBtn"))==null||r.addEventListener("click",oa)}async function xt(e=!1){await Co(e),await me(e),a.dockerTab==="images"&&await Jt(e)}async function Co(e=!1){if(!e&&a.dockerStatus)return It(),a.dockerStatus;let t=null;try{const n=await P("/api/docker/status",12e3);if(t=await n.json(),!n.ok)return h(t.error||"加载 Docker 状态失败","error"),a.dockerStatus}catch(n){return console.error("load docker status failed",n),h("加载 Docker 状态失败","error"),a.dockerStatus}return a.dockerStatus=t||null,It(),a.dockerStatus}async function me(e=!1){var s,i;const t=((s=document.getElementById("dockerScope"))==null?void 0:s.value)||"all",n=String(((i=document.getElementById("dockerSearch"))==null?void 0:i.value)||"").trim(),r=t!=="running";let o=null;try{const c=new URLSearchParams({all:r?"1":"0",page:String(Math.max(1,Number(a.dockerPage||1))),page_size:String(Math.max(1,Number(a.dockerPageSize||20))),keyword:n}),l=await P(`/api/docker/containers?${c.toString()}`,2e4);if(o=await l.json(),!l.ok)return h(o.error||"加载容器列表失败","error"),a.dockerContainers}catch(c){return console.error("load docker containers failed",c),h("加载容器列表失败","error"),a.dockerContainers}return o!=null&&o.status&&(a.dockerStatus=o.status),It(),a.dockerContainers=Array.isArray(o==null?void 0:o.items)?o.items:[],a.dockerTotal=Number((o==null?void 0:o.total)||0),a.dockerPageSize=Number((o==null?void 0:o.page_size)||a.dockerPageSize||20),a.dockerPage=Number((o==null?void 0:o.page)||a.dockerPage||1),a.dockerTotalPages=Number((o==null?void 0:o.total_pages)||0),Ao(),No(),a.dockerContainers}function It(){const e=document.getElementById("dockerStatusSummary");if(!e)return;const t=a.dockerStatus||{};if(!t.installed){e.textContent="Docker 未安装或不可用。安装 Docker Desktop / Docker Engine 后即可管理容器。";return}if(!t.daemon_running){const r=t.context?`当前上下文 ${t.context}`:"";e.textContent=["Docker 服务未启动或未连接。",r].filter(Boolean).join(" ");return}const n=[];t.version&&n.push(`客户端 ${t.version}`),t.server_version&&n.push(`服务端 ${t.server_version}`),t.context&&n.push(`上下文 ${t.context}`),t.platform&&n.push(`平台 ${t.platform}`),e.textContent=n.length?n.join(" | "):"Docker 运行正常"}function Ao(){const e=Array.isArray(a.dockerContainers)?a.dockerContainers:[];Po(e);const t=e.map(n=>{const r=String(n.state||"").toLowerCase()==="running"||String(n.status||"").toLowerCase().includes("up "),o=`<span class="badge ${r?"up":"down"}">${f(n.status||n.state||"-")}</span>`,s=f(String(n.id||"")),i=r?[`<button class="btn sm docker-action" data-docker-cmd="restart" data-id="${s}" data-name="${f(n.name||"")}">重启</button>`,`<button class="btn sm danger docker-action" data-docker-cmd="stop" data-id="${s}" data-name="${f(n.name||"")}">停止</button>`]:[`<button class="btn sm docker-action" data-docker-cmd="start" data-id="${s}" data-name="${f(n.name||"")}">启动</button>`,`<button class="btn sm danger docker-action" data-docker-cmd="remove" data-id="${s}" data-name="${f(n.name||"")}">删除</button>`];return i.push(`<button class="btn sm docker-action" data-docker-cmd="logs" data-id="${s}" data-name="${f(n.name||"")}">日志</button>`),i.push(`<button class="btn sm docker-action" data-docker-cmd="inspect" data-id="${s}" data-name="${f(n.name||"")}">详情</button>`),[`<input type="checkbox" class="docker-container-select" value="${s}" ${a.dockerSelectedContainerIDs.includes(String(n.id||""))?"checked":""}>`,n.name||"-",F(n.id||"-",14),n.image||"-",o,n.running_for||n.created_at||"-",F(n.ports||"-",42),i.join(" ")]});t.length||t.push(["-","-","-","-",'<span class="badge unknown">无数据</span>',"-","-","当前条件下没有容器"]),x("dockerContainerTable",["选择","容器名","ID","镜像","状态","运行时间","端口映射","操作"],t,!0),ct()}function No(){const e=document.getElementById("dockerPageInfo"),t=document.getElementById("dockerTotalInfo"),n=document.getElementById("dockerPrevBtn"),r=document.getElementById("dockerNextBtn"),o=document.getElementById("dockerPageSize");if(o&&(o.value=String(a.dockerPageSize||20)),e){const s=Number(a.dockerPage||1),i=Number(a.dockerTotalPages||0);e.textContent=i>0?`${s} / ${i}`:"0 / 0"}t&&(t.textContent=`共 ${b(a.dockerTotal||0)} 个容器`),n&&(n.disabled=Number(a.dockerPage||1)<=1),r&&(r.disabled=Number(a.dockerTotalPages||0)<=0||Number(a.dockerPage||1)>=Number(a.dockerTotalPages||0))}function Po(e){const t=Array.isArray(e)?e:[];let n=0;const r=new Set;for(const s of t){const i=String((s==null?void 0:s.state)||"").toLowerCase(),c=String((s==null?void 0:s.status)||"").toLowerCase();(i==="running"||c.includes("up "))&&(n+=1);const l=String((s==null?void 0:s.image)||"").trim();l&&r.add(l)}const o=Math.max(0,t.length-n);E("dockerKpiTotal",b(t.length)),E("dockerKpiRunning",b(n)),E("dockerKpiStopped",b(o)),E("dockerKpiImages",b(r.size))}async function Ro(e){if(e.target.closest(".docker-container-select")){ct();return}const t=e.target.closest("button[data-docker-cmd]");if(!t)return;const n=String(t.dataset.dockerCmd||"").trim().toLowerCase(),r=String(t.dataset.id||"").trim(),o=String(t.dataset.name||"").trim()||r;if(!(!n||!r)){if(n==="logs"){xo(r,o);return}if(n==="inspect"){try{const s=await P(`/api/docker/containers/${encodeURIComponent(r)}/inspect`,2e4),i=await s.json();if(!s.ok){h(i.error||"拉取容器详情失败","error");return}const c=JSON.stringify(i.inspect||{},null,2);z(`容器详情 - ${o}`,`<pre class="log-view compact">${f(c)}</pre>`)}catch(s){console.error("fetch container inspect failed",s),h("拉取容器详情失败","error")}return}if(n==="remove"){const s=await Do(o);if(!(s!=null&&s.confirmed))return;await dn(r,o,n,{removeVolumes:!!s.removeVolumes});return}await dn(r,o,n,{})}}async function dn(e,t,n,r={}){try{const o=await P(`/api/docker/containers/${encodeURIComponent(e)}/action`,3e4,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:n,remove_volumes:!!r.removeVolumes})}),s=await o.json();if(!o.ok){h(s.error||"容器操作失败","error");return}h(n==="remove"?`容器 ${t} 删除成功${r.removeVolumes?"（已删除数据卷）":""}`:`容器 ${t} ${n} 成功`,"success"),await me(!0)}catch(o){console.error("docker action failed",o),h("容器操作失败","error")}}function Do(e){return new Promise(t=>{let n=!1;const r=`
      <section class="docker-remove-dialog">
        <p class="docker-remove-title">确认删除容器「${f(e)}」？</p>
        <label class="docker-remove-volume">
          <input id="dockerRemoveVolumes" type="checkbox" />
          <span>同时删除数据卷（谨慎操作）</span>
        </label>
        <div class="docker-remove-actions">
          <button id="dockerCancelRemoveBtn" class="btn sm" type="button">取消</button>
          <button id="dockerConfirmRemoveBtn" class="btn sm danger" type="button">确认删除</button>
        </div>
      </section>
    `;z("删除容器确认",r);const o=document.getElementById("dockerConfirmRemoveBtn"),s=document.getElementById("dockerCancelRemoveBtn"),i=document.getElementById("dockerRemoveVolumes"),c=document.getElementById("modalCloseBtn"),l=document.getElementById("modalMask"),d=()=>{o==null||o.removeEventListener("click",m),s==null||s.removeEventListener("click",g),c==null||c.removeEventListener("click",y),l==null||l.removeEventListener("click",v)},u=(k,p)=>{n||(n=!0,d(),t({confirmed:!!k,removeVolumes:!!p}))},m=()=>{const k=!!(i!=null&&i.checked);ge(),u(!0,k)},g=()=>{ge(),u(!1,!1)},y=()=>{u(!1,!1)},v=k=>{var p;((p=k.target)==null?void 0:p.id)==="modalMask"&&u(!1,!1)};o==null||o.addEventListener("click",m),s==null||s.addEventListener("click",g),c==null||c.addEventListener("click",y),l==null||l.addEventListener("click",v)})}function xo(e,t){var o;if(Re(),a.dockerLogContainerID=String(e||"").trim(),a.dockerLogContainerName=String(t||"").trim()||a.dockerLogContainerID,!a.dockerLogContainerID)return;z(`容器日志 - ${a.dockerLogContainerName}`,`
    <section class="docker-log-modal">
      <div class="docker-log-toolbar">
        <span class="hint">实时日志滚动中（每 2 秒刷新）</span>
        <button id="dockerLogStopBtn" class="btn sm danger" type="button">停止实时</button>
      </div>
      <pre id="dockerLogViewer" class="log-view compact docker-log-viewer">正在加载日志...</pre>
    </section>
  `),(o=document.getElementById("dockerLogStopBtn"))==null||o.addEventListener("click",()=>{Re(),h("已停止实时日志滚动","info")});const r=async()=>{const s=a.dockerLogContainerID;if(s)try{const i=await P(`/api/docker/containers/${encodeURIComponent(s)}/logs?tail=500`,25e3),c=await i.json();if(!i.ok){h(c.error||"拉取容器日志失败","error");return}const l=document.getElementById("dockerLogViewer");if(!l)return;l.textContent=c.logs||"暂无日志",l.scrollTop=l.scrollHeight}catch(i){if(i&&String(i.message||"").toLowerCase().includes("unauthorized"))return;console.error("poll docker logs failed",i)}};r(),a.dockerLogTimer=setInterval(r,2e3)}function Re(){a.dockerLogTimer&&(clearInterval(a.dockerLogTimer),a.dockerLogTimer=null),a.dockerLogContainerID="",a.dockerLogContainerName=""}function Ye(e){var o,s;const t=document.getElementById("cleanupScanBtn"),n=document.getElementById("cleanupStopScanBtn"),r=!!e;t&&(t.dataset.running=r?"1":"0",t.textContent=r?"扫描中...":"开始扫描",t.disabled=r),n&&(n.disabled=!r),r||Ot({finished:!0,scanned_files:((o=a.cleanupScan)==null?void 0:o.scanned_files)||0,matched_files:((s=a.cleanupScan)==null?void 0:s.matched_files)||0})}function un(e){const t=document.getElementById("cleanupPreviewBtn"),n=document.getElementById("cleanupRunBtn"),r=document.getElementById("cleanupStopGarbageBtn"),o=!!e;t&&(t.disabled=o),n&&(n.disabled=o),r&&(r.disabled=!o)}async function it(e=!1){if(!e&&a.cleanupMeta)return a.cleanupMeta;let t=null;try{const r=await P("/api/cleanup/meta",15e3);if(t=await r.json(),!r.ok)return h(t.error||"加载数据清理配置失败","error"),a.cleanupMeta}catch(r){return console.error("ensure cleanup meta failed",r),h("加载数据清理配置失败","error"),a.cleanupMeta}a.cleanupMeta=t,Fo(t.root_options||Oo(t.default_roots||[],t.os||"")),De();const n=document.getElementById("cleanupLargeThresholdGB");if(n&&!String(n.value||"").trim()){const r=Number(t.default_large_file_size_bytes||0)/1024/1024/1024;n.value=r>0?r.toFixed(0):"1"}return Vn(t.fast_indexer||null),Jo(t.garbage_targets||[]),t}function Vn(e){const t=document.getElementById("cleanupIndexerTag");if(!t)return;const n=!!(e!=null&&e.available),r=String((e==null?void 0:e.name)||"内置引擎");t.classList.toggle("slow",!n),t.textContent=n?`${r} 加速索引`:"内置扫描引擎"}function Oo(e,t){const n=Array.isArray(e)?e.map(s=>String(s||"").trim()).filter(Boolean):[];if(!n.length)return[];const r=String(t||"").trim().toLowerCase();let o="";return r==="windows"?o=n.find(s=>s.toLowerCase()==="c:\\")||n[0]:o=n.includes("/")?"/":n[0],n.map(s=>{const i=r==="windows";let c=s;if(i){const d=s.replace(/[\\/]+$/,"");/^[a-z]:$/i.test(d)&&(c=`${d} Drive`)}const l=i?s.toLowerCase()===String(o).toLowerCase():s===o;return{path:s,label:c,selected:l}})}function Fo(e){const t=document.getElementById("cleanupRootOptions");if(!t)return;const n=Array.isArray(e)?e:[];if(!n.length){t.innerHTML='<span class="hint">未发现可用分区目录</span>';return}t.innerHTML=n.map(r=>{const o=String(r.path||"").trim();if(!o)return"";const s=String(r.label||o).trim(),i=r.selected?"checked":"";return`<label title="${f(o)}"><input type="checkbox" class="cleanup-root-item" value="${f(o)}" ${i}>${f(s)}</label>`}).join("")}function De(){const e=document.getElementById("cleanupCustomRootList");if(!e)return;const t=Array.isArray(a.cleanupCustomRoots)?a.cleanupCustomRoots:[];if(!t.length){e.innerHTML='<span class="hint">可手动添加任意目录参与扫描</span>';return}e.innerHTML=t.map(n=>{const r=String(n||"").trim();return r?`
        <label class="cleanup-custom-root-item" title="${f(r)}">
          <span>${f(r)}</span>
          <button class="btn sm danger cleanup-remove-root-btn" type="button" data-path="${f(r)}">移除</button>
        </label>
      `:""}).join("")}function pn(){const e=document.getElementById("cleanupCustomRoot"),t=String((e==null?void 0:e.value)||"").trim(),n=Ho(t);if(!n){h("请输入有效目录路径","warning");return}const r=Un(!0),o=xe(n);if(r.some(i=>xe(i)===o)){h("该目录已在扫描列表中","info"),e&&(e.value="");return}a.cleanupCustomRoots.push(n),De(),e&&(e.value=""),h(`已添加目录：${n}`,"success")}function jo(e){const t=xe(e),n=Array.isArray(a.cleanupCustomRoots)?a.cleanupCustomRoots:[];a.cleanupCustomRoots=n.filter(r=>xe(r)!==t),De()}function Ho(e){let t=String(e||"").trim();return t?(t=t.replace(/^["']+|["']+$/g,""),/^[a-zA-Z]:$/.test(t)&&(t+="\\"),t=t.replace(/[\\/]+$/,n=>n.includes("\\")?"\\":"/"),t.trim()):""}function xe(e){const t=String(e||"").trim();return t?/^[a-zA-Z]:/.test(t)||t.includes("\\")?t.toLowerCase():t:""}function Un(e=!0){const t=Array.from(document.querySelectorAll(".cleanup-root-item:checked")).map(i=>String(i.value||"").trim()).filter(Boolean);if(!e)return t;const n=Array.isArray(a.cleanupCustomRoots)?a.cleanupCustomRoots:[],r=t.concat(n),o=[],s=new Set;return r.forEach(i=>{const c=String(i||"").trim();if(!c)return;const l=xe(c);s.has(l)||(s.add(l),o.push(c))}),o}function qn(){const e=document.getElementById("cleanupLargeThresholdGB"),t=Number(String((e==null?void 0:e.value)||"").trim());return!Number.isFinite(t)||t<=0?1024**3:Math.round(t*1024*1024*1024)}async function Gn(){var r;if(a.cleanupScanJobId)return;const e=await it(!1),t=Un();if(!t.length){h("请至少选择一个扫描目录","warning");return}const n=String(((r=document.getElementById("cleanupSearch"))==null?void 0:r.value)||"").trim();try{Ye(!0),Ot({running:!0,scanned_files:0,matched_files:0}),E("cleanupSummary","正在扫描，请稍候...");const o=await fetch("/api/cleanup/scan-jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roots:t,query:n,limit:Number((e==null?void 0:e.default_scan_limit)||12e3),large_file_size_bytes:qn(),large_limit:5e3,summary_limit:Number((e==null?void 0:e.default_summary_limit)||200)})}),s=await o.json();if(!o.ok){h(s.error||"目录扫描失败","error"),E("cleanupSummary","扫描失败");return}a.cleanupScanJobId=String(s.job_id||""),Wo(e)}catch(o){console.error("cleanup scan failed",o),h("目录扫描失败","error"),E("cleanupSummary","扫描失败")}finally{}}function zo(){const e=String(a.cleanupScanJobId||"").trim();if(!e){h("当前没有进行中的扫描","warning");return}fetch(`/api/cleanup/scan-jobs/${encodeURIComponent(e)}/cancel`,{method:"POST"}).catch(t=>{console.error("cancel cleanup scan failed",t)}),Ae(),a.cleanupScanJobId="",Ye(!1),E("cleanupSummary","扫描停止中...")}function Wo(e){Ae();const t=async()=>{var r;const n=String(a.cleanupScanJobId||"").trim();if(n)try{const o=await P(`/api/cleanup/scan-jobs/${encodeURIComponent(n)}`,12e3),s=await o.json();if(!o.ok)throw new Error(s.error||"load scan progress failed");a.cleanupScanProgress=s.progress||null,Ot(s.progress||{}),s.result&&(a.cleanupScan=s.result||{},qe()),(s.status==="done"||s.status==="cancelled")&&(Ae(),a.cleanupScanJobId="",Ye(!1),Vn((e==null?void 0:e.fast_indexer)||((r=a.cleanupMeta)==null?void 0:r.fast_indexer)||null),h(s.status==="done"?"扫描完成":"扫描已停止",s.status==="done"?"success":"info"))}catch(o){console.error("poll cleanup scan failed",o),Ae(),Ye(!1),h("扫描进度获取失败","error")}};t(),a.cleanupScanPollTimer=setInterval(t,900)}function Ae(){a.cleanupScanPollTimer&&(clearInterval(a.cleanupScanPollTimer),a.cleanupScanPollTimer=null)}function Ot(e={}){const t=document.getElementById("cleanupScanProgressBar"),n=document.getElementById("cleanupScanProgressText");if(!t||!n)return;const r=!!e.running||!!a.cleanupScanJobId,o=!!e.finished||!r&&!a.cleanupScanJobId,s=Number(e.scanned_files||0),i=Number(e.matched_files||0),c=Math.max(1,s+i+Number(e.large_files||0)),l=o?100:Math.min(92,8+c%84);t.style.width=`${l}%`,t.classList.toggle("done",o),n.textContent=o?`扫描完成 | 已扫文件 ${b(s)} | 命中 ${b(i)}`:`扫描中 | 当前目录 ${e.current_root||"-"} | 已扫文件 ${b(s)} | 命中 ${b(i)}`}function Ko(){const e=a.cleanupGarbageAbortController;if(!e){h("当前没有进行中的清理","warning");return}try{e.abort()}catch{}}function qe(){var u;const e=a.cleanupScan||{},t=Array.isArray(e.files)?e.files:[],n=String(((u=document.getElementById("cleanupSearch"))==null?void 0:u.value)||"").trim().toLowerCase(),r=qn(),o=t.filter(m=>{if(!n)return!0;const g=String(m.path||"").toLowerCase(),y=String(m.name||"").toLowerCase(),v=String(m.type||"").toLowerCase();return g.includes(n)||y.includes(n)||v.includes(n)}).sort((m,g)=>Number(g.size||0)-Number(m.size||0)),s=o.filter(m=>Number(m.size||0)>=r);a.cleanupFilteredFiles=o,a.cleanupFilteredLargeFiles=s;const i=o.slice(0,3e3).map((m,g)=>[g+1,m.type||"-",J(m.mod_time),S(m.size||0),`${Number(m.size_ratio||0).toFixed(2)}%`,m.path||"-"]),c=s.slice(0,3e3).map((m,g)=>[g+1,m.type||"-",J(m.mod_time),S(m.size||0),`${Number(m.size_ratio||0).toFixed(2)}%`,m.path||"-"]);x("cleanupFileList",["序号","类型","修改时间","大小","大小占比","完整路径"],i),x("cleanupLargeFileList",["序号","类型","修改时间","大小","大小占比","完整路径"],c),Uo(o,Number(e.matched_total_bytes||e.total_bytes||0)),qo(e),Go(e),Vo(e,o,s,r);const d=[`扫描目录: ${(e.roots||[]).join(" , ")||"-"}`,`已扫文件: ${b(e.scanned_files||0)}`,`命中: ${b(e.matched_files||0)}`,`耗时: ${b(e.duration_ms||0)}ms`,`当前筛选: ${b(o.length)} 条`,`大文件(>=${(r/1024/1024/1024).toFixed(2)}GB): ${b(s.length)} 条`];e.truncated&&d.push("索引已按体积截断"),e.cancelled&&d.push("扫描已停止"),Array.isArray(e.errors)&&e.errors.length&&d.push(`权限/访问异常: ${e.errors[0]}`),E("cleanupSummary",d.join(" | "))}function Vo(e,t,n,r){E("cleanupKpiScanned",b(e.scanned_files||0)),E("cleanupKpiMatched",b(t.length)),E("cleanupKpiSize",S(e.matched_total_bytes||e.total_bytes||0)),E("cleanupKpiLarge",b(n.length));const o=document.getElementById("cleanupLargeThresholdGB");if(o){const s=r/1024/1024/1024;o.title=`当前大文件阈值 ${s.toFixed(2)} GB`}}function Uo(e,t){const n=document.getElementById("cleanupTopBars");if(!n)return;const r=Array.isArray(e)?e.slice(0,42):[],o=Number(t||0)>0?Number(t):Number(r.reduce((s,i)=>s+Number(i.size||0),0));if(!r.length||o<=0){n.innerHTML='<p class="hint">扫描完成后显示体积热区</p>';return}n.innerHTML=r.map(s=>{const i=Number(s.size||0),c=Math.max(.2,Math.min(100,i*100/o)),l=String(s.path||"-");return`
        <div class="cleanup-bar-item" title="${f(l)}">
          <div class="cleanup-bar-fill" style="width:${c.toFixed(2)}%"></div>
          <div class="cleanup-bar-text">
            <span class="cleanup-bar-path">${f(l)}</span>
            <span>${f(S(i))}</span>
          </div>
        </div>
      `}).join("")}function qo(e){const t=(Array.isArray(e.directory_summary)?e.directory_summary:[]).slice(0,200).map(r=>[r.path||"-",b(r.file_count||0),S(r.size||0),`${Number(r.size_ratio||0).toFixed(2)}%`]);x("cleanupDirSummaryList",["目录","文件数","占用","占比"],t);const n=(Array.isArray(e.type_summary)?e.type_summary:[]).slice(0,200).map(r=>[r.type||"none",b(r.file_count||0),S(r.size||0),`${Number(r.size_ratio||0).toFixed(2)}%`]);x("cleanupTypeSummaryList",["类型","文件数","占用","占比"],n)}function Go(e){mn("cleanupDirChart",Array.isArray(e.directory_summary)?e.directory_summary.slice(0,8).map(t=>({label:t.path||"-",ratio:Number(t.size_ratio||0)})):[]),mn("cleanupTypeChart",Array.isArray(e.type_summary)?e.type_summary.slice(0,8).map(t=>({label:t.type||"none",ratio:Number(t.size_ratio||0)})):[])}function mn(e,t){const n=document.getElementById(e);if(!n)return;const r=(t||[]).filter(o=>Number(o.ratio||0)>0);if(!r.length){n.innerHTML='<div class="hint">暂无占比图表</div>';return}n.innerHTML=r.map((o,s)=>{const i=s*41%360;return`
        <div class="ratio-chart-item">
          <span class="ratio-chart-label">${f(F(o.label||"-",28))}</span>
          <span class="ratio-chart-bar"><i style="width:${Math.max(6,Number(o.ratio||0)).toFixed(2)}%;background:hsl(${i} 68% 52%)"></i></span>
          <span class="ratio-chart-value">${Number(o.ratio||0).toFixed(2)}%</span>
        </div>
      `}).join("")}function Jo(e){const t=document.getElementById("cleanupGarbageTargets");if(!t)return;const n=Array.isArray(e)?e:[];if(!n.length){t.innerHTML='<span class="hint">暂无可用清理目标</span>';return}t.innerHTML=n.map(r=>{const o=r.enabled?"checked":"",s=r.exists?"":"disabled",i=`${r.name} (${r.path})`;return`<label title="${f(i)}"><input type="checkbox" class="cleanup-target-item" value="${f(r.id)}" ${o} ${s}>${f(r.name)} [保留${b(r.keep_hours||0)}h]</label>`}).join("")}function Xo(){return Array.from(document.querySelectorAll(".cleanup-target-item:checked")).map(e=>String(e.value||"").trim()).filter(Boolean)}async function fn(e){if(a.cleanupGarbageAbortController)return;const t=await it(!1);if(!t)return;const n=Xo();if(!n.length){h("请至少勾选一个清理目标","warning");return}if(!e&&!confirm("将按安全策略删除目标目录中的旧缓存/临时/日志文件，是否继续？"))return;const r=new AbortController;a.cleanupGarbageAbortController=r;const o=setTimeout(()=>{try{r.abort()}catch{}},10*60*1e3);try{un(!0),E("cleanupGarbageSummary",e?"正在预估可清理文件...":"正在执行清理...");const s=await fetch("/api/cleanup/garbage",{method:"POST",headers:{"Content-Type":"application/json"},signal:r.signal,body:JSON.stringify({target_ids:n,dry_run:e,limit:Number(t.default_garbage_limit||5e3)})}),i=await s.json();if(!s.ok){h(i.error||"清理执行失败","error"),E("cleanupGarbageSummary","清理失败");return}Yo(i);const c=[e?"预估完成":"清理完成",`候选: ${b(i.total_candidate_files||0)} 文件`,`候选体积: ${S(i.total_candidate_bytes||0)}`,`已清理: ${b(i.total_deleted_files||0)} 文件`,`已清理体积: ${S(i.total_deleted_bytes||0)}`,`失败: ${b(i.total_failed_files||0)}`];if(i.cancelled&&c.push("操作已停止"),E("cleanupGarbageSummary",c.join(" | ")),e){h("预估完成","success");return}h(`清理完成，已删除 ${b(i.total_deleted_files||0)} 个文件`,"success"),a.cleanupScan&&Gn()}catch(s){if(s&&s.name==="AbortError"){E("cleanupGarbageSummary","清理已停止"),h("清理已停止","info");return}console.error("cleanup garbage failed",s),h("清理执行失败","error"),E("cleanupGarbageSummary","清理失败")}finally{clearTimeout(o),a.cleanupGarbageAbortController===r&&(a.cleanupGarbageAbortController=null),un(!1)}}function Yo(e){const n=(Array.isArray(e==null?void 0:e.targets)?e.targets:[]).map(r=>[r.name||r.id||"-",b(r.candidate_files||0),S(r.candidate_bytes||0),b(r.deleted_files||0),S(r.deleted_bytes||0),b(r.failed_files||0),r.path||"-"]);x("cleanupGarbageResult",["目标","候选文件","候选体积","已清理文件","已清理体积","失败数","目录"],n)}function Qo(){document.getElementById("modalCloseBtn").addEventListener("click",ge),document.getElementById("modalMask").addEventListener("click",e=>{e.target.id==="modalMask"&&ge()})}async function Zo(){var n,r,o,s,i,c,l;const e=await P("/api/config",1e4);a.config=await e.json(),a.logRules=((r=(n=a.config)==null?void 0:n.log_analysis)==null?void 0:r.rules)||[],a.dockerPageSize=Number(((i=(s=(o=a.config)==null?void 0:o.system)==null?void 0:s.performance)==null?void 0:i.docker_default_page_size)||a.dockerPageSize||20),(l=(c=a.config)==null?void 0:c.system)!=null&&l.site_title&&(document.title=a.config.system.site_title),gr();const t=document.getElementById("logRule");t.innerHTML='<option value="">常见问题规则</option>',a.logRules.forEach(d=>{const u=document.createElement("option");u.value=d.name,u.textContent=`${d.name} - ${d.description}`,t.appendChild(u)})}async function es(){const e=await P("/api/monitor/trends?hours=24",12e3),t=await e.json();if(!e.ok)return;const n=(t==null?void 0:t.series)||{};Object.keys(At).forEach(r=>{a.trendHistory[r]=gs(n[r])}),tr()}function ts(){var t,n;a.monitorTimer&&clearInterval(a.monitorTimer);const e=((n=(t=a.config)==null?void 0:t.monitor)==null?void 0:n.refresh_seconds)||5;a.monitorTimer=setInterval(()=>{a.monitorPaused||a.monitorWSConnected||je()},e*1e3)}function Jn(e){!e||typeof e!="object"||(a.monitorSnapshot=e,a.combinedProcesses=Bs(e.top_processes||[],e.jvm||[]),os(e))}async function je(e=!1){try{const t=await P("/api/monitor",45e3);if(!t.ok)throw new Error(`monitor status ${t.status}`);const n=await t.json();return Jn(n),n}catch(t){if(e)throw t;return console.error("refresh monitor failed",t),null}}function ns(){return`${window.location.protocol==="https:"?"wss":"ws"}://${window.location.host}/ws/monitor`}function Ft(){if(!a.authAuthenticated||a.monitorPaused||a.monitorWS)return;let e;try{e=new WebSocket(ns())}catch(t){console.error("create monitor websocket failed",t),gn();return}a.monitorWS=e,e.addEventListener("open",()=>{a.monitorWSConnected=!0,a.monitorWSRetryAttempt=0,a.monitorWSRetryTimer&&(clearTimeout(a.monitorWSRetryTimer),a.monitorWSRetryTimer=null)}),e.addEventListener("message",t=>{rs(t.data)}),e.addEventListener("error",t=>{console.error("monitor websocket error",t)}),e.addEventListener("close",()=>{const t=a.monitorWSConnected;a.monitorWSConnected=!1,a.monitorWS=null,a.authAuthenticated&&(a.monitorPaused||(t&&je(),gn()))})}function gn(){if(!a.authAuthenticated||a.monitorPaused||a.monitorWS||a.monitorWSRetryTimer)return;const e=(a.monitorWSRetryAttempt||0)+1;a.monitorWSRetryAttempt=e;const t=Math.min(eo,Math.round(Zr*1.5**(e-1)));a.monitorWSRetryTimer=setTimeout(()=>{a.monitorWSRetryTimer=null,Ft()},t)}function jt(){a.monitorWSRetryTimer&&(clearTimeout(a.monitorWSRetryTimer),a.monitorWSRetryTimer=null);const e=a.monitorWS;if(a.monitorWS=null,a.monitorWSConnected=!1,!!e&&(e.readyState===WebSocket.CONNECTING||e.readyState===WebSocket.OPEN))try{e.close(1e3,"monitor paused")}catch(t){console.error("close monitor websocket failed",t)}}function rs(e){if(a.monitorPaused)return;let t;try{t=JSON.parse(e)}catch(n){console.error("parse monitor websocket message failed",n);return}!t||t.type!=="snapshot"||!t.data||Jn(t.data)}function os(e){var p,w,$,I,T,N,B,L,_,j,K,V,U,Y,oe,se;const t=ze(e==null?void 0:e.time,Date.now()),n=dr(e),r=fs(e,n),o=Fs(e,t),s=o.summary||{readBytesRate:0,writeBytesRate:0,readOpsRate:0,writeOpsRate:0},i=o.rateByKey||{},c=Number(((p=e.cpu)==null?void 0:p.usage_percent)||0),l=_t(c),d=bn(l);E("cpuUsage",`${M(c)}%`),E("cpuCore",`核心 ${b((w=e.cpu)==null?void 0:w.core_count)} | ${F((($=e.cpu)==null?void 0:$.model)||"型号未知",48)} | 架构 ${((I=e.cpu)==null?void 0:I.architecture)||"-"} | ${M((T=e.cpu)==null?void 0:T.frequency_mhz)} MHz${d?` | ${d}`:""}`);const u=Number(((N=e.memory)==null?void 0:N.used_percent)||0),m=_t(u),g=bn(m);E("memUsage",`${M(u)}%`),E("memDetail",`${S((B=e.memory)==null?void 0:B.used)} / ${S((L=e.memory)==null?void 0:L.total)} | ${ur(((_=e.memory)==null?void 0:_.modules)||[])}${g?` | ${g}`:""}`);const y=document.getElementById("netTraffic");y&&(y.innerHTML=`入 ${S(r.netInRate)}/秒<br/>出 ${S(r.netOutRate)}/秒`),E("netPackets",`当前网卡 ${((j=e.network)==null?void 0:j.primary_nic)||"-"}${(K=e.network)!=null&&K.primary_mac?` | MAC ${(V=e.network)==null?void 0:V.primary_mac}`:""} | 连接数 ${b(((U=e.network)==null?void 0:U.connection_count)||0)} | 实时总吞吐 ${S(r.netRate)}/秒`),E("processCount",`${b(e.process_count)}`),js(e),E("osInfo",`${((Y=e.os)==null?void 0:Y.hostname)||"-"} / ${((oe=e.os)==null?void 0:oe.platform)||"-"} / 运行时长 ${qt((se=e.os)==null?void 0:se.uptime)}`);const v=document.getElementById("diskIoFlow");v&&(v.innerHTML=`读 ${le(s.readBytesRate)}/秒<br/>写 ${le(s.writeBytesRate)}/秒`);const k=Number((e.disk_hardware||[]).length||(e.disks||[]).length||0);E("diskIoOps",`读 IOPS ${M(s.readOpsRate)}次/秒 | 写 IOPS ${M(s.writeOpsRate)}次/秒 | 磁盘数 ${b(k)} | ${Gs(e.disk_hardware||[])}`),E("diskIoSummary",Js(e.disk_hardware||[])),vn("cpuBar",c),vn("memBar",u),kn("cpu",c),kn("memory",u),x("diskList",["挂载点","设备","文件系统","使用率","健康状态","容量","实时读速率","实时写速率","实时读IOPS","实时写IOPS"],(e.disks||[]).map(q=>{const ne=Number(q.used_percent||0),C=pr(ne),he=ea(ne),ue=i[Vt(q)]||{readBytesRate:0,writeBytesRate:0,readOpsRate:0,writeOpsRate:0};return{rowClass:`disk-row ${C}`,cells:[Ea(q.path),q.device||"-",q.fs_type||"-",`<span class="disk-usage-tag ${C}">${M(ne)}%</span>`,`<span class="disk-health-tag ${C}">${he}</span>`,`${S(q.used)} / ${S(q.total)}`,`${le(ue.readBytesRate)}/秒`,`${le(ue.writeBytesRate)}/秒`,`${M(ue.readOpsRate)}次/秒`,`${M(ue.writeOpsRate)}次/秒`]}}),!0),Ta(e.disks||[]),ar(),Xn(),Yn(!1),tr(),vs(),zt()}function Xn(){const e=Array.isArray(a.flowMonitorRawItems)?a.flowMonitorRawItems:[],n=Ht(e,{keyword:a.flowMonitorKeyword,protocol:a.flowMonitorProtocol,status:a.flowMonitorStatusFilter,sort:a.flowMonitorSort}).slice(0,Fn);a.flowMonitorItems=n;const r=n.map(o=>({cells:[f(o.name||"-"),f(o.flow_type||"-"),`<span class="badge ${o.statusBadge||"unknown"}">${f(o.statusText||"-")}</span>`,f(o.started_at||"-"),f(o.finished_at||"-"),f(o.detail||"-"),`<button class="btn sm" type="button" data-flow-detail="${f(o.key)}">详情</button>`]}));x("flowMonitorList",["进程名称","协议/连接","状态","最后活跃","PID","流量摘要","操作"],r,!0)}async function Yn(e=!1){var n;const t=Date.now();if(!e&&a.flowMonitorLoading||!e&&t-a.flowMonitorLastLoadedAt<to)return a.flowMonitorItems;a.flowMonitorLoading=!0;try{const r=await P("/api/traffic?packet_limit=1&http_limit=1",12e3);let o={};try{o=await r.json()}catch{o={}}if(!r.ok)throw new Error(o.error||`traffic status ${r.status}`);const s=Array.isArray(o==null?void 0:o.connections)?o.connections:[],i=((n=o==null?void 0:o.status)==null?void 0:n.supported)===!1,c=i?"连接态（无抓包）":"抓包态",l=s.map(d=>{const u=String(d.protocol||"-").toUpperCase(),m=`${d.local_ip||"-"}:${d.local_port||0}`,g=d.remote_ip?`${d.remote_ip}:${d.remote_port||0}`:"-",y=He(d.status),v=is(y),k=Number(d.bytes_in||0),p=Number(d.bytes_out||0),w=Number(d.packets_in||0),$=Number(d.packets_out||0);return{key:d.connection_key||`${d.pid||0}-${m}-${g}-${u}`,name:d.process_name||"-",flow_type:`${u} ${m} -> ${g}`,status:y,statusRaw:y,statusText:v,statusBadge:cs(y),started_at:d.last_seen?J(d.last_seen):"-",started_at_raw:d.last_seen||"",lastSeenValue:ms(d.last_seen),finished_at:d.pid?String(d.pid):"-",pidValue:Number(d.pid||0),protocolValue:String(d.protocol||"").toLowerCase(),localAddress:m,remoteAddress:g,bytesIn:k,bytesOut:p,packetsIn:w,packetsOut:$,bytesTotal:k+p,packetsTotal:w+$,captureMode:c,unsupported:i,connectionKey:d.connection_key||"",exePath:d.exe_path||"-",raw:d,detail:i?`${c} | 字节/包统计不可用（需启用 CGO + Npcap）`:`${c} | 入/出流量 ${S(k)} / ${S(p)} | 入/出包 ${b(w)} / ${b($)}`}});return l.sort((d,u)=>u.lastSeenValue-d.lastSeenValue),a.flowMonitorRawItems=l,a.flowMonitorStatus=(o==null?void 0:o.status)||null,a.flowMonitorUpdatedAt=Date.now(),ss(),a.flowMonitorItems=l.slice(0,Fn),a.flowMonitorLastLoadedAt=Date.now(),Xn(),a.flowMonitorItems}catch(r){return console.error("refresh flow monitor failed",r),a.flowMonitorItems}finally{a.flowMonitorLoading=!1}}function ss(){const e=document.getElementById("flowMonitorSearch"),t=document.getElementById("flowMonitorProtocol"),n=document.getElementById("flowMonitorStatus"),r=document.getElementById("flowMonitorSort");e&&(a.flowMonitorKeyword=String(e.value||"").trim()),t&&(a.flowMonitorProtocol=String(t.value||"all").trim().toLowerCase()),n&&(a.flowMonitorStatusFilter=String(n.value||"all").trim().toLowerCase()),r&&(a.flowMonitorSort=String(r.value||"time_desc").trim().toLowerCase())}function as(){a.flowMonitorKeyword="",a.flowMonitorProtocol="all",a.flowMonitorStatusFilter="all",a.flowMonitorSort="time_desc";const e=document.getElementById("flowMonitorSearch"),t=document.getElementById("flowMonitorProtocol"),n=document.getElementById("flowMonitorStatus"),r=document.getElementById("flowMonitorSort");e&&(e.value=""),t&&(t.value="all"),n&&(n.value="all"),r&&(r.value="time_desc")}function He(e){return String(e||"").trim().toUpperCase()||"UNKNOWN"}function is(e){const t=He(e);return t==="ESTABLISHED"?"已建立":t==="LISTEN"?"监听中":t==="SYN_SENT"||t==="SYN_RECV"?"握手中":["FIN_WAIT1","FIN_WAIT2","CLOSE_WAIT","CLOSING","LAST_ACK","TIME_WAIT"].includes(t)?"关闭中":t==="CLOSED"||t==="CLOSE"?"已关闭":t==="UNKNOWN"||t==="NONE"?"未知":t}function cs(e){const t=He(e);return t==="ESTABLISHED"||t==="LISTEN"||t==="SYN_SENT"||t==="SYN_RECV"?"up":["FIN_WAIT1","FIN_WAIT2","CLOSE_WAIT","CLOSING","LAST_ACK","TIME_WAIT","CLOSED","CLOSE"].includes(t)?"unknown":t==="ERROR"||t==="FAILED"||t==="DOWN"?"down":"unknown"}function ls(e,t){const n=He(e),r=String(t||"all").trim().toLowerCase();return r==="all"?!0:r==="established"?n==="ESTABLISHED":r==="listen"?n==="LISTEN":r==="closing"?n.includes("WAIT")||n.includes("CLOSE")||n==="CLOSING"||n==="LAST_ACK":r==="unknown"?n==="UNKNOWN"||n==="NONE"||!n:!0}function Ht(e,t={}){const n=Array.isArray(e)?[...e]:[],r=String(t.keyword||"").trim().toLowerCase(),o=String(t.protocol||"all").trim().toLowerCase(),s=String(t.status||"all").trim().toLowerCase(),i=String(t.sort||"time_desc").trim().toLowerCase(),c=n.filter(l=>!(o==="all"||String(l.protocolValue||"").toLowerCase()===o)||!ls(l.statusRaw,s)?!1:r?[l.name,l.finished_at,l.protocolValue,l.statusRaw,l.statusText,l.localAddress,l.remoteAddress,l.flow_type,l.connectionKey,l.exePath,l.detail].join(" ").toLowerCase().includes(r):!0);return c.sort((l,d)=>{if(i==="bytes_desc")return d.bytesTotal!==l.bytesTotal?d.bytesTotal-l.bytesTotal:d.lastSeenValue-l.lastSeenValue;if(i==="packets_desc")return d.packetsTotal!==l.packetsTotal?d.packetsTotal-l.packetsTotal:d.lastSeenValue-l.lastSeenValue;if(i==="pid_asc")return l.pidValue!==d.pidValue?l.pidValue-d.pidValue:d.lastSeenValue-l.lastSeenValue;if(i==="name_asc"){const u=String(l.name||"").localeCompare(String(d.name||""),"zh-Hans-CN");return u!==0?u:d.lastSeenValue-l.lastSeenValue}return d.lastSeenValue-l.lastSeenValue}),c}function Qn(e){const t=Array.isArray(e)?e:[];let n=0,r=0,o=0,s=0;for(const i of t){const c=String(i.protocolValue||"").toLowerCase();c==="tcp"&&(n+=1),c==="udp"&&(r+=1);const l=He(i.statusRaw);l==="ESTABLISHED"&&(o+=1),l==="LISTEN"&&(s+=1)}return`TCP ${b(n)} | UDP ${b(r)} | 已建立 ${b(o)} | 监听 ${b(s)}`}function ds(e){const t=String(e||"").trim();if(!t)return;const r=(Array.isArray(a.flowMonitorRawItems)?a.flowMonitorRawItems:[]).find(o=>String(o.key||"").trim()===t);if(!r){h("未找到该连接详情，可能已过期","warning");return}Zn(t,"流量连接详情（支持搜索过滤）",{seedItem:r})}function us(e){return[["进程名称",f(e.name||"-")],["PID",f(e.finished_at||"-")],["进程路径",f(e.exePath||"-")],["协议",f(String(e.protocolValue||"-").toUpperCase())],["状态",f(e.statusText||e.statusRaw||"-")],["本地地址",f(e.localAddress||"-")],["远端地址",f(e.remoteAddress||"-")],["最后活跃",f(e.started_at||"-")],["连接键",`<code>${f(e.connectionKey||"-")}</code>`],["入流量",f(S(e.bytesIn||0))],["出流量",f(S(e.bytesOut||0))],["入包数",f(b(e.packetsIn||0))],["出包数",f(b(e.packetsOut||0))],["采集模式",f(e.captureMode||"-")],["摘要",f(e.detail||"-")]]}function Zn(e="",t="流量连接详情（支持搜索过滤）",n={}){var v,k,p,w,$,I,T,N;const r=String(n.protocol||a.flowMonitorProtocol||"all").trim().toLowerCase(),o=String(n.status||a.flowMonitorStatusFilter||"all").trim().toLowerCase(),s=String(n.sort||a.flowMonitorSort||"time_desc").trim().toLowerCase(),i=String(n.keyword||a.flowMonitorKeyword||"").trim(),c=n.seedItem&&typeof n.seedItem=="object"?n.seedItem:null;let l=String(e||"").trim();const d=`
    <section class="flow-monitor-explorer">
      <div class="row">
        <input id="flowMonitorDetailSearch" class="input" placeholder="搜索进程 / PID / 地址 / 协议 / 状态 / 路径" value="${f(i)}" />
        <select id="flowMonitorDetailProtocol" class="input sm">
          <option value="all" ${r==="all"?"selected":""}>全部协议</option>
          <option value="tcp" ${r==="tcp"?"selected":""}>TCP</option>
          <option value="udp" ${r==="udp"?"selected":""}>UDP</option>
        </select>
        <select id="flowMonitorDetailStatus" class="input sm">
          <option value="all" ${o==="all"?"selected":""}>全部状态</option>
          <option value="established" ${o==="established"?"selected":""}>已建立</option>
          <option value="listen" ${o==="listen"?"selected":""}>监听中</option>
          <option value="closing" ${o==="closing"?"selected":""}>关闭中</option>
          <option value="unknown" ${o==="unknown"?"selected":""}>未知</option>
        </select>
        <select id="flowMonitorDetailSort" class="input sm">
          <option value="time_desc" ${s==="time_desc"?"selected":""}>最新优先</option>
          <option value="bytes_desc" ${s==="bytes_desc"?"selected":""}>流量优先</option>
          <option value="packets_desc" ${s==="packets_desc"?"selected":""}>包数优先</option>
          <option value="pid_asc" ${s==="pid_asc"?"selected":""}>PID 升序</option>
          <option value="name_asc" ${s==="name_asc"?"selected":""}>进程名 A-Z</option>
        </select>
        <button id="flowMonitorDetailResetBtn" class="btn sm" type="button">重置</button>
      </div>
      <p id="flowMonitorDetailMeta" class="hint">-</p>
      <div id="flowMonitorDetailTable" class="table"></div>
      <div class="row" style="margin-top:10px;">
        <button id="flowMonitorDetailCopyKeyBtn" class="btn sm" type="button">复制连接键</button>
        <button id="flowMonitorDetailCopyJsonBtn" class="btn sm" type="button">复制 JSON</button>
      </div>
      <div id="flowMonitorDetailPanel"></div>
    </section>
  `;z(t,d,{modalClass:"flow-monitor-modal-xl"});let u=[];const m=()=>u.find(B=>String(B.key||"").trim()===l)||null,g=()=>{const B=document.getElementById("flowMonitorDetailPanel");if(!B)return;const L=m();if(!L){B.innerHTML='<div class="hint">当前筛选结果为空，无法显示连接详情</div>';return}const _=us(L);B.innerHTML=`
      <div class="table flow-monitor-detail-kv">${O(["字段","值"],_,!0)}</div>
      <details style="margin-top:10px;">
        <summary>原始连接数据</summary>
        <pre class="log-view compact flow-monitor-json">${f(JSON.stringify(L.raw||{},null,2))}</pre>
      </details>
    `},y=()=>{var Y,oe,se,q,ne;const B=String(((Y=document.getElementById("flowMonitorDetailSearch"))==null?void 0:Y.value)||"").trim(),L=String(((oe=document.getElementById("flowMonitorDetailProtocol"))==null?void 0:oe.value)||"all").trim().toLowerCase(),_=String(((se=document.getElementById("flowMonitorDetailStatus"))==null?void 0:se.value)||"all").trim().toLowerCase(),j=String(((q=document.getElementById("flowMonitorDetailSort"))==null?void 0:q.value)||"time_desc").trim().toLowerCase(),K=Array.isArray(a.flowMonitorRawItems)?a.flowMonitorRawItems:[];if(u=Ht(K,{keyword:B,protocol:L,status:_,sort:j}),!u.some(C=>String(C.key||"").trim()===l)&&c){const C=String(c.key||"").trim();C&&l===C&&(u=[c,...u.filter(he=>String(he.key||"").trim()!==C)])}u.some(C=>String(C.key||"").trim()===l)||(l=String(((ne=u[0])==null?void 0:ne.key)||""));const V=u.map(C=>({rowClass:String(C.key||"")===l?"flow-monitor-row-selected":"",attrs:{"data-flow-select":String(C.key||"")},cells:[f(C.name||"-"),f(C.finished_at||"-"),f(String(C.protocolValue||"-").toUpperCase()),f(C.statusText||"-"),f(C.localAddress||"-"),f(C.remoteAddress||"-"),f(C.started_at||"-"),f(S(C.bytesIn||0)),f(S(C.bytesOut||0)),f(b(C.packetsIn||0)),f(b(C.packetsOut||0)),`<button class="btn sm" type="button" data-flow-select="${f(C.key)}">查看</button>`]})),U=document.getElementById("flowMonitorDetailTable");U&&(U.innerHTML=O(["进程","PID","协议","状态","本地地址","远端地址","最后活跃","入流量","出流量","入包","出包","操作"],V,!0)),E("flowMonitorDetailMeta",`总连接 ${b(K.length)} 条 | 过滤后 ${b(u.length)} 条 | ${Qn(u)}`),g()};(v=document.getElementById("flowMonitorDetailSearch"))==null||v.addEventListener("input",y),(k=document.getElementById("flowMonitorDetailProtocol"))==null||k.addEventListener("change",y),(p=document.getElementById("flowMonitorDetailStatus"))==null||p.addEventListener("change",y),(w=document.getElementById("flowMonitorDetailSort"))==null||w.addEventListener("change",y),($=document.getElementById("flowMonitorDetailResetBtn"))==null||$.addEventListener("click",()=>{const B=document.getElementById("flowMonitorDetailSearch"),L=document.getElementById("flowMonitorDetailProtocol"),_=document.getElementById("flowMonitorDetailStatus"),j=document.getElementById("flowMonitorDetailSort");B&&(B.value=""),L&&(L.value="all"),_&&(_.value="all"),j&&(j.value="time_desc"),y()}),(I=document.getElementById("flowMonitorDetailTable"))==null||I.addEventListener("click",B=>{const L=B.target.closest("[data-flow-select]");L&&(l=String(L.dataset.flowSelect||"").trim(),l&&y())}),(T=document.getElementById("flowMonitorDetailCopyKeyBtn"))==null||T.addEventListener("click",async()=>{const B=m();if(!B){h("当前无可复制连接","warning");return}const L=await Tt(B.connectionKey||"");h(L?"连接键已复制":"复制连接键失败",L?"success":"error")}),(N=document.getElementById("flowMonitorDetailCopyJsonBtn"))==null||N.addEventListener("click",async()=>{const B=m();if(!B){h("当前无可复制连接","warning");return}const L=JSON.stringify(B.raw||{},null,2),_=await Tt(L);h(_?"连接 JSON 已复制":"复制连接 JSON 失败",_?"success":"error")}),y()}function ps(){var i,c,l,d,u,m;const e=a.flowMonitorProtocol||"all",t=a.flowMonitorStatusFilter||"all",n=a.flowMonitorSort||"time_desc",r=a.flowMonitorKeyword||"",o=`
    <section class="flow-monitor-modal">
      <div class="row">
        <input id="flowMonitorModalSearch" class="input" placeholder="搜索进程 / PID / 地址 / 协议 / 状态 / 路径" value="${f(r)}" />
        <select id="flowMonitorModalProtocol" class="input sm">
          <option value="all" ${e==="all"?"selected":""}>全部协议</option>
          <option value="tcp" ${e==="tcp"?"selected":""}>TCP</option>
          <option value="udp" ${e==="udp"?"selected":""}>UDP</option>
        </select>
        <select id="flowMonitorModalStatus" class="input sm">
          <option value="all" ${t==="all"?"selected":""}>全部状态</option>
          <option value="established" ${t==="established"?"selected":""}>已建立</option>
          <option value="listen" ${t==="listen"?"selected":""}>监听中</option>
          <option value="closing" ${t==="closing"?"selected":""}>关闭中</option>
          <option value="unknown" ${t==="unknown"?"selected":""}>未知</option>
        </select>
        <select id="flowMonitorModalSort" class="input sm">
          <option value="time_desc" ${n==="time_desc"?"selected":""}>最新优先</option>
          <option value="bytes_desc" ${n==="bytes_desc"?"selected":""}>流量优先</option>
          <option value="packets_desc" ${n==="packets_desc"?"selected":""}>包数优先</option>
          <option value="pid_asc" ${n==="pid_asc"?"selected":""}>PID 升序</option>
          <option value="name_asc" ${n==="name_asc"?"selected":""}>进程名 A-Z</option>
        </select>
        <button id="flowMonitorModalResetBtn" class="btn sm" type="button">重置</button>
      </div>
      <p id="flowMonitorModalMeta" class="hint">-</p>
      <div id="flowMonitorModalTable" class="table"></div>
    </section>
  `;z("流量监控全量视图",o,{modalClass:"flow-monitor-modal-full"});const s=()=>{var T,N,B,L;const g=String(((T=document.getElementById("flowMonitorModalSearch"))==null?void 0:T.value)||"").trim(),y=String(((N=document.getElementById("flowMonitorModalProtocol"))==null?void 0:N.value)||"all").trim().toLowerCase(),v=String(((B=document.getElementById("flowMonitorModalStatus"))==null?void 0:B.value)||"all").trim().toLowerCase(),k=String(((L=document.getElementById("flowMonitorModalSort"))==null?void 0:L.value)||"time_desc").trim().toLowerCase(),p=Array.isArray(a.flowMonitorRawItems)?a.flowMonitorRawItems:[],w=Ht(p,{keyword:g,protocol:y,status:v,sort:k}),$=w.map(_=>({cells:[f(_.name||"-"),f(_.finished_at||"-"),f(String(_.protocolValue||"-").toUpperCase()),f(_.statusText||"-"),f(_.localAddress||"-"),f(_.remoteAddress||"-"),f(_.started_at||"-"),f(S(_.bytesIn||0)),f(S(_.bytesOut||0)),f(b(_.packetsIn||0)),f(b(_.packetsOut||0)),`<button class="btn sm" type="button" data-flow-detail="${f(_.key)}">详情</button>`]})),I=document.getElementById("flowMonitorModalTable");I&&(I.innerHTML=O(["进程","PID","协议","状态","本地地址","远端地址","最后活跃","入流量","出流量","入包","出包","操作"],$,!0)),E("flowMonitorModalMeta",`总连接 ${b(p.length)} 条 | 过滤后 ${b(w.length)} 条 | ${Qn(w)}`)};(i=document.getElementById("flowMonitorModalSearch"))==null||i.addEventListener("input",s),(c=document.getElementById("flowMonitorModalProtocol"))==null||c.addEventListener("change",s),(l=document.getElementById("flowMonitorModalStatus"))==null||l.addEventListener("change",s),(d=document.getElementById("flowMonitorModalSort"))==null||d.addEventListener("change",s),(u=document.getElementById("flowMonitorModalResetBtn"))==null||u.addEventListener("click",()=>{const g=document.getElementById("flowMonitorModalSearch"),y=document.getElementById("flowMonitorModalProtocol"),v=document.getElementById("flowMonitorModalStatus"),k=document.getElementById("flowMonitorModalSort");g&&(g.value=""),y&&(y.value="all"),v&&(v.value="all"),k&&(k.value="time_desc"),s()}),(m=document.getElementById("flowMonitorModalTable"))==null||m.addEventListener("click",g=>{var T,N,B,L;const y=g.target.closest("[data-flow-detail]");if(!y)return;const v=String(y.dataset.flowDetail||"").trim();if(!v)return;const k=filteredItems.find(_=>String(_.key||"").trim()===v)||null,p=String(((T=document.getElementById("flowMonitorModalSearch"))==null?void 0:T.value)||"").trim(),w=String(((N=document.getElementById("flowMonitorModalProtocol"))==null?void 0:N.value)||"all").trim().toLowerCase(),$=String(((B=document.getElementById("flowMonitorModalStatus"))==null?void 0:B.value)||"all").trim().toLowerCase(),I=String(((L=document.getElementById("flowMonitorModalSort"))==null?void 0:L.value)||"time_desc").trim().toLowerCase();Zn(v,"流量连接详情（支持搜索过滤）",{keyword:p,protocol:w,status:$,sort:I,seedItem:k})}),s()}function ms(e){const t=String(e||"").trim();if(!t)return 0;const n=new Date(t).getTime();return Number.isFinite(n)?n:0}function fs(e,t){var g,y,v,k;const n=Date.now(),r=ze(e==null?void 0:e.time,n),o=Number(((g=e.network)==null?void 0:g.bytes_recv)||0),s=Number(((y=e.network)==null?void 0:y.bytes_sent)||0),i=o+s,c=Number(t.readBytes||0)+Number(t.writeBytes||0);let l=0,d=0,u=0,m=0;if(a.trendLastSample){const p=Math.max(1,(n-a.trendLastSample.ts)/1e3);l=Math.max(0,(o-Number(a.trendLastSample.netInTotal||0))/p),d=Math.max(0,(s-Number(a.trendLastSample.netOutTotal||0))/p),u=l+d,m=Math.max(0,(c-Number(a.trendLastSample.diskTotal||0))/p)}return a.trendLastSample={ts:n,netInTotal:o,netOutTotal:s,netTotal:i,diskTotal:c},Le("cpu",Number(((v=e.cpu)==null?void 0:v.usage_percent)||0),r),Le("memory",Number(((k=e.memory)==null?void 0:k.used_percent)||0),r),Le("network",u,r),Le("process",Number(e.process_count||0),r),Le("diskio",m,r),{netInRate:l,netOutRate:d,netRate:u,diskRate:m}}function Le(e,t,n=Date.now()){var i,c;if(!Number.isFinite(t))return;a.trendHistory[e]||(a.trendHistory[e]=[]);const r=a.trendHistory[e],o=ze(n,Date.now());r.length&&Number(((i=r[r.length-1])==null?void 0:i.ts)||0)===o?r[r.length-1]={ts:o,value:t}:r.push({ts:o,value:t});const s=o-st;for(;r.length&&Number(((c=r[0])==null?void 0:c.ts)||0)<s;)r.shift()}function gs(e){const n=Date.now()-st,r=Array.isArray(e)?e.map(o=>({ts:ze(o==null?void 0:o.ts,0),value:Number(o==null?void 0:o.value)})).filter(o=>o.ts>0&&Number.isFinite(o.value)&&o.ts>=n):[];return r.sort((o,s)=>o.ts-s.ts),r}function ze(e,t){const n=Number(e||0);return Number.isFinite(n)&&n>0?n:Number(t||Date.now())}function er(e,t){var s;const n=Array.isArray(e)?e:[];if(!n.length)return[];const o=Number(((s=n[n.length-1])==null?void 0:s.ts)||Date.now())-Number(t||st);return n.filter(i=>Number((i==null?void 0:i.ts)||0)>=o)}function ys(e,t){const n=Array.isArray(e)?e:[],r=Math.max(2,Number(t));if(n.length<=r)return n;const o=(n.length-1)/(r-1),s=[];for(let i=0;i<r;i++){const c=Math.round(i*o);s.push(n[Math.min(n.length-1,c)])}return s}function tr(){Object.entries(At).forEach(([e,t])=>{const n=a.trendHistory[e]||[],r=er(n,Jr),o=document.getElementById(t.miniId);o&&(o.innerHTML=rr(r,{width:320,height:54,stroke:t.color,fill:t.fill}));const s=document.getElementById(t.infoId);if(!s)return;if(!r.length){s.textContent="-";return}const i=r[r.length-1].value,c=Math.max(...r.map(l=>Number(l.value||0)));s.textContent=`近${On}小时 最新 ${t.format(i)} | 最高 ${t.format(c)}`})}function hs(e){a.activeTrendKey=String(e||""),a.activeTrendAutoFollow=!0,a.activeTrendScrollLeft=0,nr(a.activeTrendKey,{open:!0})}function vs(){if(!a.activeTrendKey)return;const e=document.getElementById("modalMask");if(!e||e.classList.contains("hidden")){Kt();return}nr(a.activeTrendKey,{open:!1})}function nr(e,t={}){var v,k;const n=At[e];if(!n)return;const r=!!t.open,o=er(a.trendHistory[e]||[],st);if(!o.length){r?z(n.title,'<div class="trend-empty">暂无趋势数据</div>',{keepTrend:!0}):Bt(n.title,'<div class="trend-empty">暂无趋势数据</div>');return}const s=ys(o,Xr),i=Math.max(Yr,Math.round(s.length*Qr)),c=o[o.length-1],l=c.value,d=Math.max(...o.map(p=>Number(p.value||0))),u=Math.min(...o.map(p=>Number(p.value||0))),m=J(c.ts),g=Math.max(1,Number(((k=(v=a.config)==null?void 0:v.monitor)==null?void 0:k.refresh_seconds)||5)),y=`
    <div class="trend-modal-wrap">
      <div class="trend-live-bar">
        <span class="trend-live-item trend-live-now"><span class="trend-live-dot"></span>当前最新值 <strong>${f(n.format(l))}</strong></span>
        <span class="trend-live-item">采样时间 ${f(m)}</span>
        <span class="trend-live-item">实时刷新 ${g} 秒</span>
      </div>
      <div class="trend-modal-meta">近24小时采样点 ${o.length}，最新值 ${f(n.format(l))}，最高值 ${f(n.format(d))}，最低值 ${f(n.format(u))}</div>
      <div class="trend-modal-chart">
        <div class="trend-modal-scroll">
          <div class="trend-modal-canvas" style="width:${i}px">
            ${rr(s,{width:i,height:300,stroke:n.color,fill:n.fill,showTimeAxis:!0})}
          </div>
        </div>
      </div>
    </div>
  `;r?z(n.title,y,{keepTrend:!0}):Bt(n.title,y),requestAnimationFrame(()=>{const p=document.querySelector("#modalBody .trend-modal-scroll");if(!p)return;const w=Math.max(0,p.scrollWidth-p.clientWidth);if(a.activeTrendAutoFollow)p.scrollLeft=w;else{const $=Number(a.activeTrendScrollLeft||0);p.scrollLeft=Math.max(0,Math.min(w,$))}}),ks(s,n)}function rr(e,t={}){const n=Number(t.width||640),r=Number(t.height||220),o=t.stroke||"#0f5fd8",s=t.fill||"rgba(15,95,216,0.16)",i=!!t.showTimeAxis,c=or(e,n,r,i);if(!c)return`<svg viewBox="0 0 ${n} ${r}" preserveAspectRatio="none"></svg>`;const l=c.coords.map(y=>`${y.x.toFixed(2)},${y.y.toFixed(2)}`).join(" "),d=`${c.padX},${c.baseY.toFixed(2)} ${l} ${c.coords[c.coords.length-1].x.toFixed(2)},${c.baseY.toFixed(2)}`,u=c.coords[c.coords.length-1],m=(c.topPad+c.chartHeight/2).toFixed(2);let g="";return i&&(g=bs(c.points,c.padX,n-c.padX,c.baseY,r)),`
    <svg viewBox="0 0 ${n} ${r}" preserveAspectRatio="none">
      <line x1="${c.padX}" y1="${m}" x2="${n-c.padX}" y2="${m}" stroke="rgba(88,109,130,0.25)" stroke-dasharray="3 3"></line>
      <polygon points="${d}" fill="${s}"></polygon>
      <polyline points="${l}" fill="none" stroke="${o}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <circle cx="${u.x.toFixed(2)}" cy="${u.y.toFixed(2)}" r="3.2" fill="${o}" stroke="#fff" stroke-width="1"></circle>
      ${g}
    </svg>
  `}function or(e,t,n,r){const o=(e||[]).map(k=>({ts:Number((k==null?void 0:k.ts)||0),value:Number(k==null?void 0:k.value)})).filter(k=>Number.isFinite(k.value));if(!o.length)return null;const s=10,i=8,c=r?28:8,l=Math.min(...o.map(k=>k.value)),d=Math.max(...o.map(k=>k.value)),u=d-l||1,m=o.length>1?(t-s*2)/(o.length-1):0,g=Math.max(1,n-i-c),y=i+g,v=o.map((k,p)=>({...k,x:s+p*m,y:i+(1-(k.value-l)/u)*g}));return{points:o,coords:v,padX:s,topPad:i,bottomPad:c,min:l,max:d,range:u,step:m,chartHeight:g,baseY:y}}function bs(e,t,n,r,o){if(!(e!=null&&e.length))return"";const s=e.length,c=[...new Set([0,Math.floor((s-1)/2),s-1])].map(l=>{var y;const d=s>1?l/(s-1):0,u=t+(n-t)*d,m=sr((y=e[l])==null?void 0:y.ts),g=l===0?"start":l===s-1?"end":"middle";return`
      <line x1="${u.toFixed(2)}" y1="${r.toFixed(2)}" x2="${u.toFixed(2)}" y2="${(r+5).toFixed(2)}" stroke="rgba(97,113,132,0.7)"></line>
      <text x="${u.toFixed(2)}" y="${Math.min(o-2,r+16).toFixed(2)}" text-anchor="${g}" fill="#5a6b82" font-size="11">${m}</text>
    `});return`
    <line x1="${t.toFixed(2)}" y1="${r.toFixed(2)}" x2="${n.toFixed(2)}" y2="${r.toFixed(2)}" stroke="rgba(97,113,132,0.5)"></line>
    ${c.join("")}
  `}function sr(e){const t=Number(e||0);if(!Number.isFinite(t)||t<=0)return"--:--:--";const n=new Date(t),r=String(n.getHours()).padStart(2,"0"),o=String(n.getMinutes()).padStart(2,"0"),s=String(n.getSeconds()).padStart(2,"0");return`${r}:${o}:${s}`}function ks(e,t){const n=document.querySelector("#modalBody .trend-modal-canvas");if(!n)return;const r=n.querySelector("svg");if(!r)return;const o=(r.getAttribute("viewBox")||"0 0 980 300").trim().split(/\s+/).map(p=>Number(p)),s=o[2]||980,i=o[3]||300,c=or(e,s,i,!0);if(!c)return;n.style.position="relative";const l=n.closest(".trend-modal-scroll"),d=document.createElement("div");d.className="trend-crosshair hidden",n.appendChild(d);const u=document.createElement("div");u.className="trend-hover-dot hidden",n.appendChild(u);const m=document.createElement("div");m.className="trend-hover-tip hidden",n.appendChild(m);const g=()=>{d.classList.add("hidden"),u.classList.add("hidden"),m.classList.add("hidden")},y=(p,w)=>{const $=Math.max(0,Math.min(c.coords.length-1,p)),I=c.coords[$],T=I.x/s*w.width,N=I.y/i*w.height,B=c.topPad/i*w.height,L=c.baseY/i*w.height;d.classList.remove("hidden"),d.style.left=`${T}px`,d.style.top=`${B}px`,d.style.height=`${Math.max(8,L-B)}px`,d.style.background=`${t.color}66`,u.classList.remove("hidden"),u.style.left=`${T}px`,u.style.top=`${N}px`,u.style.borderColor=t.color,m.classList.remove("hidden"),m.textContent=`${sr(I.ts)} | ${t.format(I.value)}`;let _=T+12,j=N-36;const K=m.offsetWidth||120,V=l?Number(l.scrollLeft||0):0,U=l?V+Number(l.clientWidth||w.width):w.width;_+K>U-6&&(_=T-K-12),_<V+6&&(_=V+6),j<6&&(j=N+12),m.style.left=`${_}px`,m.style.top=`${j}px`},v=p=>{const w=n.getBoundingClientRect();if(!w.width)return;const $=p-w.left,I=Math.max(0,Math.min(w.width,$))/w.width*s;let T=0;c.step>0&&(T=Math.round((I-c.padX)/c.step)),y(T,w)},k=()=>{const p=n.getBoundingClientRect();p.width&&y(Math.max(0,c.coords.length-1),p)};if(n.addEventListener("mouseenter",p=>v(p.clientX)),n.addEventListener("mousemove",p=>v(p.clientX)),n.addEventListener("mouseleave",g),l){const p=()=>{const w=Math.max(0,l.scrollWidth-l.clientWidth);a.activeTrendScrollLeft=Number(l.scrollLeft||0),a.activeTrendAutoFollow=w<=0||a.activeTrendScrollLeft>=w-16};l.addEventListener("scroll",p)}requestAnimationFrame(()=>{const p=n.closest(".trend-modal-scroll");if(p){const w=Math.max(0,p.scrollWidth-p.clientWidth);if(a.activeTrendAutoFollow)p.scrollLeft=w;else{const $=Number(a.activeTrendScrollLeft||0);p.scrollLeft=Math.max(0,Math.min(w,$))}}requestAnimationFrame(k)})}function ar(){var s,i;const e=((s=a.monitorSnapshot)==null?void 0:s.ports)||[],t=(((i=document.getElementById("portSearch"))==null?void 0:i.value)||"").trim().toLowerCase(),n=e.filter(c=>t?[tt(c),c.port,c.pid,Et(c.status),nt(c)].join(" ").toLowerCase().includes(t):!0),r=t?120:10,o=n.slice(0,r).map(c=>[tt(c),c.port,c.pid,Et(c.status),nt(c)]);x("portList",["进程名","端口","PID","状态","路径"],o)}function zt(){var r;const e=(((r=document.getElementById("processSearch"))==null?void 0:r.value)||"").trim().toLowerCase(),t=a.processSortMode||"cpu_desc",n=a.combinedProcesses.filter(o=>e?`${o.name||""} ${o.exe_path||""} ${o.cmdline||""} ${o.pid||""}`.toLowerCase().includes(e):!0).sort((o,s)=>Is(o,s,t)).map(o=>[o.name||"-",o.is_jvm?"JVM":"进程",o.pid,`${M(o.cpu)}%`,`${M(o.memory)}%`,o.threads??"-",o.exe_path||"-",`<button class="btn sm process-detail-btn" data-pid="${o.pid}">资源详情</button>
       <button class="btn sm danger process-kill-btn" data-pid="${o.pid}">关闭进程</button>`]);x("topProcessList",[be("进程","name"),be("类型","type"),be("PID","pid"),be("CPU%","cpu"),be("内存%","mem"),be("线程","threads"),"路径","操作"],n,!0),ws()}function ws(){const e=document.querySelector("#topProcessList table");if(!e)return;const t=e.querySelectorAll("thead th");if(t.length<8)return;[{index:0,key:"name",title:"点击切换进程名排序"},{index:1,key:"type",title:"点击切换类型排序"},{index:2,key:"pid",title:"点击切换 PID 排序"},{index:3,key:"cpu",title:"点击切换 CPU 排序"},{index:4,key:"mem",title:"点击切换内存排序"},{index:5,key:"threads",title:"点击切换线程排序"}].forEach(r=>{const o=t[r.index];o&&(o.dataset.sortKey=r.key,o.classList.add("sortable"),o.title=r.title)})}function be(e,t){const n=String(a.processSortMode||"cpu_desc"),[r,o]=n.split("_");return r!==t?e:o==="desc"?`${e} ↓`:o==="asc"?`${e} ↑`:e}function Ss(e){const t=String(a.processSortMode||"cpu_desc"),[n,r]=t.split("_"),o=n===e?r==="desc"?"asc":"desc":$s(e);a.processSortMode=`${e}_${o}`,zt()}function $s(e){return["cpu","mem","pid","threads"].includes(e)?"desc":"asc"}function Is(e,t,n){const[r,o]=String(n||"cpu_desc").split("_"),s=o==="asc"?1:-1,i=String((e==null?void 0:e.name)||""),c=String((t==null?void 0:t.name)||""),l=e!=null&&e.is_jvm?"jvm":"process",d=t!=null&&t.is_jvm?"jvm":"process";let u=0;switch(r){case"name":u=i.localeCompare(c,"zh-Hans-CN",{sensitivity:"base",numeric:!0});break;case"type":u=l.localeCompare(d,"en",{sensitivity:"base"});break;case"pid":u=Number((e==null?void 0:e.pid)||0)-Number((t==null?void 0:t.pid)||0);break;case"mem":u=Number((e==null?void 0:e.memory)||0)-Number((t==null?void 0:t.memory)||0);break;case"threads":u=Number((e==null?void 0:e.threads)||0)-Number((t==null?void 0:t.threads)||0);break;case"cpu":default:u=Number((e==null?void 0:e.cpu)||0)-Number((t==null?void 0:t.cpu)||0);break}if(u!==0)return u*s;const m=Number((t==null?void 0:t.cpu)||0)-Number((e==null?void 0:e.cpu)||0);return m!==0?m:Number((e==null?void 0:e.pid)||0)-Number((t==null?void 0:t.pid)||0)}function Bs(e,t){const n=[],r=new Set;return e.forEach(o=>{const s=yn(o,!!(o!=null&&o.is_jvm));r.has(s.pid)||(n.push(s),r.add(s.pid))}),t.forEach(o=>{const s=yn(o,!0);r.has(s.pid)||(n.push(s),r.add(s.pid))}),n}function yn(e,t=!1){const n=e&&typeof e=="object"?e:{},r=Number(n.pid||0),o=hn(n.cpu,n.cpu_percent,n.cpuPercent),s=hn(n.memory,n.memory_percent,n.mem_percent,n.mem,n.memoryRate),i=_s(n.threads,n.thread_count,n.threadCount,n.num_threads),c=String(n.name||"").trim(),l=String(n.exe_path||n.path||"").trim(),d=String(n.cmdline||n.command||"").trim();return{...n,pid:r,name:c||(r>0?`PID-${r}`:"-"),cpu:o,memory:s,threads:i,exe_path:l||"-",cmdline:d,is_jvm:!!(t||n.is_jvm)}}function hn(...e){for(const t of e){const n=Number(t);if(Number.isFinite(n))return n}return 0}function _s(...e){for(const t of e){const n=Number(t);if(Number.isFinite(n))return Math.round(n)}return 0}async function Es(e){const t=await fetch(`/api/processes/${e}/detail`),n=await t.json();if(!t.ok){h(n.error||"获取进程详情失败","error");return}z("进程资源详情",Xs(n))}async function Ts(e){const t=await fetch(`/api/processes/${e}/kill`,{method:"POST"}),n=await t.json();if(!t.ok){h(n.error||"关闭进程失败","error");return}h(`已发送关闭指令，PID=${e}`,"success"),await je()}async function Wt(){const e=await P("/api/logs/apps",1e4),t=await e.json();e.ok&&(a.apps=t.apps||[],a.logRules=t.rules||a.logRules,As(!0))}function Qe(){var i;const e=document.getElementById("logSourceSelect"),t=document.getElementById("logDeleteCardBtn");if(!e)return;const n=Array.isArray(a.apps)?a.apps:[],r=String(((i=a.currentApp)==null?void 0:i.name)||"").trim(),o=n.some(c=>String((c==null?void 0:c.name)||"").trim()===r),s=[];n.length?(s.push('<option value="">请选择日志源</option>'),n.forEach(c=>{var m;const l=String((c==null?void 0:c.name)||"").trim();if(!l)return;const d=Ms(c==null?void 0:c.type),u=Number(((m=c==null?void 0:c.log_files)==null?void 0:m.length)||0);s.push(`<option value="${f(l)}">${f(`${l} [${d}] (${u} 个日志源)`)}</option>`)})):s.push('<option value="">暂无日志源</option>'),e.innerHTML=s.join(""),e.value=o?r:"",t&&(t.disabled=!o)}function Ls(){const e=document.getElementById("logSourceSelect");if(!e)return;const t=String(e.value||"").trim();if(!t){a.currentApp=null,E("logCurrentApp","当前日志源：无"),Ze();const r=document.getElementById("logResult");r&&(r.innerHTML='<div class="hint">请选择日志源后再查询</div>');const o=document.getElementById("logStats");o&&(o.innerHTML=""),Qe(),Ee();return}const n=(a.apps||[]).find(r=>String((r==null?void 0:r.name)||"").trim()===t);n&&(a.currentApp=n,E("logCurrentApp",`当前日志源：${n.name}`),Ze(),Qe(),Oe(!1),Rt("logs"))}function Ms(e){const t=String(e||"").trim().toLowerCase();return t==="windows-eventlog"?"Windows 事件日志":t==="system-log"?"系统日志":t==="app-log"?"应用日志":t==="custom-log"?"自定义日志":t||"-"}function Cs(){return!Array.isArray(a.apps)||!a.apps.length?null:a.apps.find(t=>{const n=String((t==null?void 0:t.name)||"").toLowerCase(),r=String((t==null?void 0:t.type)||"").toLowerCase();return n.includes("系统日志")||n.includes("system log")||r.includes("system")||r.includes("eventlog")})||a.apps[0]||null}function As(e=!1){var r;if(!Array.isArray(a.apps)||!a.apps.length){a.currentApp=null,Ee(),Qe(),E("logCurrentApp","当前日志源：无"),Ze();const o=document.getElementById("logResult");o&&(o.innerHTML='<div class="hint">暂无日志源，请先添加</div>');return}const t=(r=a.currentApp)==null?void 0:r.name,n=a.apps.find(o=>o.name===t);a.currentApp=n||Cs(),Qe(),a.currentApp&&(E("logCurrentApp",`当前日志源：${a.currentApp.name}`),Ze(),e&&Oe(!1),Rt())}function Ns(){z("添加日志源",`
    <div class="system-detail-grid">
      <section class="system-detail-block">
        <h4>新增日志源</h4>
        <div class="row">
          <input id="newLogName" class="input" placeholder="日志源名称，例如：系统日志 / nginx日志" />
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
          <button id="saveNewLogCardBtn" class="btn">保存日志源</button>
        </div>
      </section>
    </div>
  `);const t=document.getElementById("saveNewLogCardBtn");t&&t.addEventListener("click",async()=>{var c,l,d,u;const n=(((c=document.getElementById("newLogName"))==null?void 0:c.value)||"").trim(),r=(((l=document.getElementById("newLogType"))==null?void 0:l.value)||"").trim()||"custom-log",o=(((d=document.getElementById("newLogDesc"))==null?void 0:d.value)||"").trim(),i=(((u=document.getElementById("newLogFiles"))==null?void 0:u.value)||"").trim().split(/\r?\n/).map(m=>m.trim()).filter(m=>m.length>0);if(!n){h("请填写日志源名称","warning");return}if(!i.length){h("请至少填写一个日志源","warning");return}await Ps({name:n,type:r,description:o,log_files:i})})}async function Ps(e){const t=await fetch("/api/logs/apps",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}),n=await t.json();if(!t.ok){h(n.error||"新增日志源失败","error");return}ge(),await Wt(),h("日志源新增成功","success")}async function Rs(e){var o;const t=String(e||"").trim();if(!t||!confirm(`确认删除日志源「${t}」？`))return;const n=await fetch(`/api/logs/apps/${encodeURIComponent(t)}`,{method:"DELETE"}),r=await n.json();if(!n.ok){h(r.error||"删除日志源失败","error");return}((o=a.currentApp)==null?void 0:o.name)===t&&(a.currentApp=null,Ee()),await Wt(),h(`已删除日志源：${t}`,"success")}function Ze(){const e=document.getElementById("logFileSelector");e.innerHTML="",a.currentApp&&(a.currentApp.log_files||[]).forEach((t,n)=>{const r=document.createElement("label"),o=document.createElement("input");o.type="checkbox",o.checked=!0,o.value=t,o.id=`lf_${n}`,r.appendChild(o),r.append(` ${t}`),e.appendChild(r)})}async function Oe(e,t={}){const n=!!t.silent,r=!!t.fromRealtime;if(!a.currentApp){n||h("请先选择日志源","warning");return}const o=document.getElementById("logKeyword").value,s=e?"error":document.getElementById("logLevel").value,i=document.getElementById("logRule").value,c=document.getElementById("logLimit").value||"300",l=new URLSearchParams({keyword:o,level:s,rule:i,limit:c});let d=null;try{const v=await P(`/api/logs/${encodeURIComponent(a.currentApp.name)}?${l.toString()}`,1e4);if(d=await v.json(),!v.ok){n||h(d.error||"日志查询失败","error");return}}catch(v){n||h("日志查询失败","error"),console.error("query logs failed",v);return}const u=Array.isArray(d==null?void 0:d.items)?[...d.items]:[];u.sort((v,k)=>et(v==null?void 0:v.time)-et(k==null?void 0:k.time));const m=u.reduce((v,k)=>{const p=String(k.level||"info").toLowerCase();return v[p]=(v[p]||0)+1,v},{}),g=document.getElementById("logStats");g&&(g.innerHTML=`
      <div class="log-stat-card"><strong>${b(u.length)}</strong><span>命中日志</span></div>
      <div class="log-stat-card error"><strong>${b(m.error||0)}</strong><span>错误</span></div>
      <div class="log-stat-card warn"><strong>${b(m.warn||0)}</strong><span>告警</span></div>
      <div class="log-stat-card info"><strong>${b((m.info||0)+(m.debug||0))}</strong><span>信息/调试</span></div>
    `);const y=document.getElementById("logResult");if(y){if(!u.length){const v=document.getElementById("logStats");v&&(v.innerHTML=`
        <div class="log-stat-card"><strong>0</strong><span>命中日志</span></div>
        <div class="log-stat-card error"><strong>0</strong><span>错误</span></div>
        <div class="log-stat-card warn"><strong>0</strong><span>告警</span></div>
        <div class="log-stat-card info"><strong>0</strong><span>信息/调试</span></div>
      `),y.innerHTML='<div class="hint">当前条件下没有命中日志</div>';return}y.innerHTML=u.slice().reverse().map(v=>`
      <article class="log-entry-card ${f(String(v.level||"info").toLowerCase())}">
        <header>
          <span>${f(J(v.time))}</span>
          <span>${f(String(v.level||"info").toUpperCase())}</span>
          <span title="${f(v.file||"-")}">${f(F(v.file||"-",64))}</span>
        </header>
        <div class="log-entry-message">${f(v.message||v.raw||"-")}</div>
      </article>
    `).join(""),(r||!n)&&(y.scrollTop=y.scrollHeight)}}function et(e){const t=String(e||"").trim();if(!t)return 0;const n=Date.parse(t.replace(" ","T"));return Number.isFinite(n)?n:0}async function Ds(){if(!a.currentApp){h("请先选择日志源","warning");return}const e=[...document.querySelectorAll("#logFileSelector input:checked")].map(r=>r.value),t=await fetch(`/api/logs/${encodeURIComponent(a.currentApp.name)}/export`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({files:e})}),n=await t.json();if(!t.ok){h(n.error||"导出失败","error");return}h("日志导出任务已生成","success"),window.open(n.download_url,"_blank")}async function ir(){const e=await P("/api/scripts",1e4),t=await e.json();if(!e.ok)return;a.scripts=t.scripts||[];const n=document.getElementById("scriptName");n.innerHTML="",a.scripts.forEach(r=>{const o=document.createElement("option");o.value=r.name,o.textContent=`${r.name} (${r.shell||"auto"})`,n.appendChild(o)}),xs()}function xs(){const e=document.getElementById("scriptLibrary");if(e){if(e.innerHTML="",!a.scripts.length){e.innerHTML='<div class="script-item"><div class="meta">暂无脚本，请先上传。</div></div>';return}a.scripts.forEach(t=>{const n=document.createElement("div"),r=Array.isArray(t.parameters)&&t.parameters.length?t.parameters.join(", "):"-";n.className="script-item",n.innerHTML=`
      <div class="title">${f(t.name||"-")}</div>
      <div class="meta">执行器: ${f(t.shell||"自动")} | 参数模板: ${f(r)}</div>
      <div class="meta">${f(t.description||"无描述")}</div>
      <div class="path">${f(t.path||"-")}</div>
    `,e.appendChild(n)})}}async function cr(){const e=await P("/api/scripts/runs?limit=100",1e4),t=await e.json();if(!e.ok)return;const n=(t.items||[]).map(r=>[r.id,r.script_name,r.args||"-",`<span class="badge ${mr(r.status)}">${f(Ut(r.status))}</span>`,r.started_at||"-",r.ended_at||"-"]);x("scriptRunHistory",["ID","脚本","参数","状态","开始时间","结束时间"],n,!0)}async function Os(){if(!a.currentRunId)return;const e=document.getElementById("scriptOutput");let t=!0;for(;t;){const n=await fetch(`/api/scripts/runs/${a.currentRunId}`),r=await n.json();n.ok?(e.textContent=r.output||"",e.scrollTop=e.scrollHeight,t=r.status==="running"):t=!1,await cr(),t&&await fr(1500)}}async function lr(){var r,o,s;const e=await P("/api/backups",1e4),t=await e.json();if(!e.ok)return;!a.backupSelectedSources.length&&Array.isArray((r=t==null?void 0:t.config)==null?void 0:r.files)&&(a.backupSelectedSources=[...t.config.files]),!((o=document.getElementById("backupTarget"))!=null&&o.value)&&((s=t==null?void 0:t.config)!=null&&s.storage_path)&&(document.getElementById("backupTarget").value=t.config.storage_path),rt();const n=(t.items||[]).map(i=>[i.id,i.type,i.name,`<span class="badge ${mr(i.status)}">${f(Ut(i.status))}</span>`,i.path,i.message||"-",`<a href="/api/backups/download?path=${encodeURIComponent(i.path)}" target="_blank">下载</a>`]);x("backupList",["ID","类型","名称","状态","路径","信息","操作"],n,!0)}function Bt(e,t){E("modalTitle",e);const n=document.getElementById("modalBody");n&&(n.innerHTML=t)}function Kt(){a.activeTrendKey="",a.activeTrendAutoFollow=!0,a.activeTrendScrollLeft=0}function z(e,t,n={}){n.keepTrend||Kt();const r=document.querySelector("#modalMask .modal");r&&fe&&(r.classList.remove(fe),fe="");const o=String(n.modalClass||"").trim();r&&o&&(r.classList.add(o),fe=o),Bt(e,t),document.getElementById("modalMask").classList.remove("hidden"),document.body.classList.add("modal-open")}function ge(){Re(),Kt();const e=document.querySelector("#modalMask .modal");e&&fe&&(e.classList.remove(fe),fe=""),document.getElementById("modalMask").classList.add("hidden"),document.body.classList.remove("modal-open")}function x(e,t,n,r=!1){const o=document.getElementById(e);o&&(o.innerHTML=O(t,n,r))}function O(e,t,n=!1){const r=e.map(s=>`<th>${f(String(s))}</th>`).join(""),o=t.map(s=>{const i=Array.isArray(s)?"":f(String((s==null?void 0:s.rowClass)||"").trim()),c=Array.isArray(s)?"":Object.entries((s==null?void 0:s.attrs)||{}).map(([u,m])=>{const g=f(String(u||"").trim()),y=f(String(m??""));return g?` ${g}="${y}"`:""}).join(""),d=(Array.isArray(s)?s:(s==null?void 0:s.cells)||[]).map(u=>n?`<td>${u??""}</td>`:`<td>${f(String(u??""))}</td>`).join("");return i?`<tr class="${i}"${c}>${d}</tr>`:`<tr${c}>${d}</tr>`}).join("");return`<table><thead><tr>${r}</tr></thead><tbody>${o}</tbody></table>`}function E(e,t){const n=document.getElementById(e);n&&(n.textContent=t)}function vn(e,t){const n=document.getElementById(e);if(!n)return;const r=Number(t||0),o=Math.max(0,Math.min(100,r));n.style.width=`${o}%`}function _t(e){const t=Number(e||0);return t>=85?"tight":t>=70?"high":"ok"}function bn(e){return e==="tight"?"资源紧张":e==="high"?"负载偏高":""}function kn(e,t){const n=document.querySelector(`.metric-card.${e}`);if(!n)return;const r=_t(t);n.classList.remove("pressure-ok","pressure-high","pressure-tight"),n.classList.add(`pressure-${r}`);const o=n.querySelector(".kpi-tag");o&&(r==="tight"?o.textContent="资源紧张":r==="high"?o.textContent="负载偏高":o.textContent="实时")}function dr(e){var s,i,c,l;let t=Number(((s=e.disk_io)==null?void 0:s.read_bytes)||0),n=Number(((i=e.disk_io)==null?void 0:i.write_bytes)||0),r=Number(((c=e.disk_io)==null?void 0:c.read_count)||0),o=Number(((l=e.disk_io)==null?void 0:l.write_count)||0);return t||n||r||o?{readBytes:t,writeBytes:n,readCount:r,writeCount:o}:((e.disks||[]).forEach(d=>{t+=Number(d.read_bytes||0),n+=Number(d.write_bytes||0),r+=Number(d.read_count||0),o+=Number(d.write_count||0)}),{readBytes:t,writeBytes:n,readCount:r,writeCount:o})}function Vt(e){const t=String((e==null?void 0:e.path)||"").trim().toLowerCase(),n=String((e==null?void 0:e.device)||"").trim().toLowerCase(),r=String((e==null?void 0:e.fs_type)||"").trim().toLowerCase();return`${t}|${n}|${r}`}function Fs(e,t=Date.now()){const n=ze(t,Date.now()),r=dr(e),o=Array.isArray(e==null?void 0:e.disks)?e.disks:[],s=a.diskLastSample;let i=0;s&&Number(s.ts||0)>0&&n>Number(s.ts||0)&&(i=Math.max(.001,(n-Number(s.ts||0))/1e3));const c={},l={};o.forEach(v=>{var B;const k=Vt(v),p={readBytes:Number(v.read_bytes||0),writeBytes:Number(v.write_bytes||0),readCount:Number(v.read_count||0),writeCount:Number(v.write_count||0)};c[k]=p;const w=(B=s==null?void 0:s.byKey)==null?void 0:B[k];let $=0,I=0,T=0,N=0;w&&i>0&&($=Math.max(0,(p.readBytes-Number(w.readBytes||0))/i),I=Math.max(0,(p.writeBytes-Number(w.writeBytes||0))/i),T=Math.max(0,(p.readCount-Number(w.readCount||0))/i),N=Math.max(0,(p.writeCount-Number(w.writeCount||0))/i)),l[k]={readBytesRate:$,writeBytesRate:I,readOpsRate:T,writeOpsRate:N}});let d=0,u=0,m=0,g=0;s!=null&&s.totals&&i>0&&(d=Math.max(0,(r.readBytes-Number(s.totals.readBytes||0))/i),u=Math.max(0,(r.writeBytes-Number(s.totals.writeBytes||0))/i),m=Math.max(0,(r.readCount-Number(s.totals.readCount||0))/i),g=Math.max(0,(r.writeCount-Number(s.totals.writeCount||0))/i));const y={ts:n,summary:{readBytesRate:d,writeBytesRate:u,readOpsRate:m,writeOpsRate:g},rateByKey:l};return a.diskLastSample={ts:n,totals:r,byKey:c},a.lastDiskRealtime=y,y}function tt(e){const t=String((e==null?void 0:e.process_name)||"").trim();if(t)return t;const n=String((e==null?void 0:e.exe_path)||"").trim();if(n){const i=(n.replaceAll("\\","/").split("/").pop()||"").replace(/\.(exe|bat|cmd|ps1|sh)$/i,"");if(i)return i}const r=Number((e==null?void 0:e.pid)||0);return r<=0?"系统进程":`PID-${r}`}function nt(e){const t=String((e==null?void 0:e.exe_path)||"").trim();if(t)return t;const n=String((e==null?void 0:e.process_name)||"").trim();if(n)return`${n}（路径受限）`;const r=Number((e==null?void 0:e.pid)||0);return r<=0?"系统进程（路径受限）":`PID-${r}（路径受限）`}function Et(e){const t=String(e||"").trim().toLowerCase();return t?["listen","listening"].includes(t)?"监听中":["established"].includes(t)?"已建立":["close_wait"].includes(t)?"等待关闭":["time_wait"].includes(t)?"等待回收":["syn_sent"].includes(t)?"发起连接":["syn_recv"].includes(t)?"接收连接":["fin_wait_1","fin_wait_2","closing","last_ack","close"].includes(t)?"关闭中":String(e):"未知"}function js(e){const t=document.getElementById("systemInfoQuick");if(!t)return;const n=e||{},r=n.os||{},o=n.network||{},s=Array.isArray(n.disks)?n.disks:[],i=Array.isArray(n.disk_hardware)?n.disk_hardware:[],c=n.cpu||{},l=n.memory||{},d=String(r.os_type||r.platform||"-").trim()||"-",u=String(r.version||"-").trim()||"-",m=`${d}
${u}`,g=String(c.architecture||"-").trim()||"-",y=Hs(i),v=zs(c,l,s,i),k=[{label:"操作系统",value:m,full:m,multiline:!0},{label:"系统架构",value:g,full:g},{label:"网络IP",value:String(o.primary_ip||"-"),full:String(o.primary_ip||"-")},{label:"硬盘序列号",value:Us(y),full:y},{label:"资源概览",value:v,full:v}];t.innerHTML=k.map(p=>{const w=p.multiline?"system-info-value multiline":"system-info-value",$=`${p.label}：${String(p.full||"-").replace(/\n/g," / ")}`;return`
      <div
        class="system-info-item"
        role="button"
        tabindex="0"
        data-copy="${f(p.full)}"
        data-full="${f($)}"
        title="${f($)}"
      >
        <span class="system-info-label">${f(p.label)}</span>
        <span class="${w}" title="${f(p.full)}">${f(p.value)}</span>
      </div>
    `}).join("")}function Hs(e){const t=Array.isArray(e)?e:[];for(const n of t){const r=String((n==null?void 0:n.serial)||"").trim(),o=r.toLowerCase();if(r&&!["-","unknown","none","null","(null)","n/a"].includes(o))return r}return"-"}function zs(e,t,n,r){const o=[],s=Number((e==null?void 0:e.core_count)||0);s>0&&o.push(`${b(s)}核心`);const i=wn((t==null?void 0:t.total)||0);i>0&&o.push(`${b(i)}GB内存`);const c=Ws(n,r),l=wn(c);return l>0&&o.push(`${b(l)}GB存储`),o.length?o.join(" "):"-"}function Ws(e,t){const n=Array.isArray(t)?t:[];if(n.length){const i=new Set;let c=0;for(const l of n){const d=Number((l==null?void 0:l.size)||0);if(!Number.isFinite(d)||d<=0)continue;const u=`${String((l==null?void 0:l.name)||"").trim()}|${d}`;i.has(u)||(i.add(u),c+=d)}if(c>0)return c}const r=Array.isArray(e)?e:[],o=new Set;let s=0;for(const i of r){const c=Number((i==null?void 0:i.total)||0);if(!Number.isFinite(c)||c<=0)continue;const l=`${String((i==null?void 0:i.device)||(i==null?void 0:i.path)||"").trim()}|${c}`;o.has(l)||(o.add(l),s+=c)}return s}function wn(e){const t=Number(e||0);return!Number.isFinite(t)||t<=0?0:Math.max(1,Math.round(t/1024/1024/1024))}async function Sn(e){var r;const t=String(((r=e==null?void 0:e.dataset)==null?void 0:r.copy)||"").trim();if(!t||t==="-"){vt("当前字段暂无可复制内容");return}if(await Tt(t)){vt(`已复制：${F(t,36)}`);return}vt("复制失败，请手动复制")}function Ks(){const e=a.monitorSnapshot||{};z("系统信息详情",Vs(e))}function Vs(e){const t=e.os||{},n=e.cpu||{},r=e.memory||{},o=e.network||{},s=Array.isArray(e.disks)?e.disks:[],i=Array.isArray(e.disk_hardware)?e.disk_hardware:[],c=Array.isArray(e.gpu_cards)?e.gpu_cards:[],l=Array.isArray(e.network_cards)?e.network_cards:[],d=Array.isArray(r.modules)?r.modules:[],u=[],m=[["主机名",t.hostname||"-"],["操作系统类型",t.os_type||t.platform||"-"],["系统版本",t.version||"-"],["内核版本",t.kernel_version||"-"],["设备 ID",t.device_id||"-"],["产品 ID",t.product_id||"-"],["平台/架构",t.platform||"-"],["运行时长",qt(t.uptime)],["负载(1分钟)",ht(t.load1)],["负载(5分钟)",ht(t.load5)],["负载(15分钟)",ht(t.load15)]];u.push(Z("系统与运行信息",O(["字段","值"],m)));const g=[["CPU 型号",n.model||"-"],["CPU 架构",n.architecture||"-"],["核心数",b(n.core_count)],["主频",`${M(n.frequency_mhz)} MHz`],["当前使用率",`${M(n.usage_percent)}%`]];u.push(Z("CPU 信息",O(["字段","值"],g)));const y=[["总内存",S(r.total)],["已用内存",S(r.used)],["内存使用率",`${M(r.used_percent)}%`],["交换分区总量",S(r.swap_total)],["交换分区已用",S(r.swap_used)],["交换分区使用率",`${M(r.swap_used_rate)}%`]];if(u.push(Z("内存信息",O(["字段","值"],y))),d.length){const k=d.map((p,w)=>[w+1,p.manufacturer||"-",p.model||"-",Number(p.frequency_mhz||0)>0?`${b(p.frequency_mhz)} MHz`:"-",S(p.capacity||0),p.serial||"-"]);u.push(Z("内存条明细",O(["序号","品牌","型号","频率","容量","序列号"],k)))}const v=[["当前活跃网卡",o.primary_nic||"-"],["当前 IP",o.primary_ip||"-"],["当前 MAC",o.primary_mac||"-"],["当前连接数",b(o.connection_count||0)],["累计入流量",S(o.bytes_recv||0)],["累计出流量",S(o.bytes_sent||0)],["累计入包数",b(o.packets_in||0)],["累计出包数",b(o.packets_out||0)]];if(u.push(Z("网络信息",O(["字段","值"],v))),l.length){const k=l.map((p,w)=>[w+1,p.name||"-",p.description||"-",p.mac_address||"-",Number(p.speed_mbps||0)>0?`${b(p.speed_mbps)} Mbps`:"-",p.adapter_type||"-",p.status||"-"]);u.push(Z("网卡明细",O(["序号","名称","描述","MAC","速率","类型","状态"],k)))}if(s.length){const k=s.map(p=>[p.path||"-",p.device||"-",p.fs_type||"-",`${M(p.used_percent)}%`,`${S(p.used)} / ${S(p.total)}`]);u.push(Z("磁盘分区状态",O(["挂载点","设备","文件系统","使用率","容量"],k)))}if(i.length){const k=i.map((p,w)=>[w+1,p.name||"-",p.model||"-",p.serial||"-",p.interface||"-",p.media_type||"-",S(p.size||0)]);u.push(Z("磁盘硬件信息",O(["序号","设备","型号","序列号","接口","介质","容量"],k)))}if(c.length){const k=c.map((p,w)=>[w+1,p.name||"-",p.vendor||"-",Number(p.memory_mb||0)>0?`${b(p.memory_mb)} MB`:"-",p.driver_version||"-",p.device_id||"-"]);u.push(Z("显卡信息",O(["序号","名称","厂商","显存","驱动版本","设备 ID"],k)))}else u.push(Z("显卡信息",'<div class="trend-empty">暂未获取到显卡信息</div>'));return`<div class="system-detail-grid">${u.join("")}</div>`}function Z(e,t){return`
    <section class="system-detail-block">
      <h4>${f(e)}</h4>
      ${t}
    </section>
  `}function Us(e){const t=String(e||"").trim();return t?t.length<=16?t:`${t.slice(0,6)}...${t.slice(-4)}`:"-"}function ht(e){const t=Number(e);return Number.isFinite(t)?M(t):"-"}function qs(){const t=(a.monitorSnapshot||{}).disk_hardware||[];if(!t.length){z("磁盘硬件汇总",'<div class="trend-empty">暂未获取到磁盘硬件信息</div>');return}const n=t.map((r,o)=>[o+1,r.name||"-",r.model||"-",r.serial||"-",r.interface||"-",r.media_type||"-",S(r.size||0)]);z("磁盘硬件汇总",O(["序号","设备","型号","序列号","接口","介质","容量"],n))}function ur(e){const t=Array.isArray(e)?e:[];if(!t.length)return"内存条信息未获取";const n=t[0]||{},r=F(String(n.manufacturer||"").trim()||"品牌未知",14),o=F(String(n.model||"").trim()||"型号未知",22),s=Number(n.frequency_mhz||0)>0?`${b(n.frequency_mhz)}MHz`:"频率未知";return t.length===1?`${r} ${o} ${s}`:`${r} ${o} ${s} 等 ${t.length} 条`}function Gs(e){const t=Array.isArray(e)?e:[];if(!t.length)return"硬件信息未获取";const n=t[0]||{},r=String(n.model||"").trim()||String(n.name||"").trim()||"型号未知",o=String(n.serial||"").trim()||"序列号未知";return t.length===1?`${F(r,26)} | 序列号 ${F(o,20)}`:`${F(r,22)} 等 ${t.length} 块`}function Js(e){const t=Array.isArray(e)?e:[];if(!t.length)return"硬件信息未获取";const n=t.slice(0,2).map(o=>{const s=String(o.model||o.name||"型号未知").trim(),i=String(o.serial||"序列号未知").trim();return`${F(s,20)} / ${F(i,16)}`}),r=t.length>2?` 等 ${t.length} 块`:"";return`磁盘硬件 ${n.join("；")}${r}`}function Xs(e){const t=Qs(e.status),n=Ys(e.status),r=Number(e.read_bytes||0)+Number(e.write_bytes||0),o=Zs(e.created_at);return`
    <div class="process-detail-wrap">
      <div class="process-detail-kpi-grid">
        <div class="process-kpi-card cpu">
          <div class="kpi-title">CPU 占用</div>
          <div class="kpi-value">${M(e.cpu_percent)}%</div>
        </div>
        <div class="process-kpi-card mem">
          <div class="kpi-title">内存占用</div>
          <div class="kpi-value">${M(e.memory_percent)}%</div>
        </div>
        <div class="process-kpi-card thread">
          <div class="kpi-title">线程数</div>
          <div class="kpi-value">${b(e.threads)}</div>
        </div>
        <div class="process-kpi-card io">
          <div class="kpi-title">IO 总量</div>
          <div class="kpi-value">${S(r)}</div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">基础信息</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">PID</span>
            <span class="process-kv-value">${b(e.pid)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">进程名</span>
            <span class="process-kv-value">${f(e.name||"-")}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">运行状态</span>
            <span class="process-kv-value"><span class="process-status-badge ${n}">${t}</span></span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">启动时间</span>
            <span class="process-kv-value">${f(o)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">内存详情</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">常驻内存 RSS</span>
            <span class="process-kv-value">${S(e.rss)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">虚拟内存 VMS</span>
            <span class="process-kv-value">${S(e.vms)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">IO 详情</div>
        <div class="process-kv-grid">
          <div class="process-kv-item">
            <span class="process-kv-label">读取字节</span>
            <span class="process-kv-value">${S(e.read_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">写入字节</span>
            <span class="process-kv-value">${S(e.write_bytes)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">读取次数</span>
            <span class="process-kv-value">${b(e.read_count)}</span>
          </div>
          <div class="process-kv-item">
            <span class="process-kv-label">写入次数</span>
            <span class="process-kv-value">${b(e.write_count)}</span>
          </div>
        </div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">执行路径</div>
        <div class="process-code-block">${f(e.exe_path||"-")}</div>
      </div>

      <div class="process-detail-card">
        <div class="process-detail-title">启动命令</div>
        <div class="process-code-block">${f(e.cmdline||"-")}</div>
      </div>
    </div>
  `}function Ys(e){const t=String(e||"").trim().toLowerCase();return["running","run","r"].includes(t)?"running":["sleep","sleeping","idle","wait","wchan","disk-sleep","iowait"].includes(t)?"waiting":["stopped","stop","t","dead","zombie","z"].includes(t)?"stopped":"unknown"}function Qs(e){const t=String(e||"").trim().toLowerCase();return["running","run","r"].includes(t)?"运行中":["sleep","sleeping","idle","wait","wchan","disk-sleep","iowait"].includes(t)?"等待中":["stopped","stop","t"].includes(t)?"已停止":["dead"].includes(t)?"已结束":["zombie","z"].includes(t)?"僵尸进程":t?`未知(${f(String(e))})`:"未知"}function Zs(e){const t=String(e||"").trim();if(!t)return"-";const n=new Date(t);if(Number.isNaN(n.getTime()))return t;const r=n.getFullYear(),o=String(n.getMonth()+1).padStart(2,"0"),s=String(n.getDate()).padStart(2,"0"),i=String(n.getHours()).padStart(2,"0"),c=String(n.getMinutes()).padStart(2,"0"),l=String(n.getSeconds()).padStart(2,"0");return`${r}-${o}-${s} ${i}:${c}:${l}`}function pr(e){const t=Number.isFinite(e)?e:0;return t>=90?"disk-high":t>=75?"disk-warn":"disk-ok"}function ea(e){const t=pr(e);return t==="disk-high"?"高占用":t==="disk-warn"?"需关注":"健康"}function Ut(e){const t=String(e||"").trim().toLowerCase();return t?["running","run","processing"].includes(t)?"执行中":["success","ok","completed","done","finished","up"].includes(t)?"成功":["failed","error","down"].includes(t)?"失败":["pending","queued","waiting"].includes(t)?"等待中":["canceled","cancelled"].includes(t)?"已取消":["stopped","stop"].includes(t)?"已停止":["unknown"].includes(t)?"未知":String(e||"未知"):"未知"}function mr(e){const t=String(e||"").toLowerCase();return["up","running","active","healthy","ok","success"].includes(t)?"up":["down","failed","error","inactive","stopped"].includes(t)?"down":"unknown"}function qt(e){const t=Number(e||0);if(t<=0)return"-";const n=Math.floor(t/86400),r=Math.floor(t%86400/3600),o=Math.floor(t%3600/60);return n>0?`${n}d ${r}h ${o}m`:r>0?`${r}h ${o}m`:`${o}m`}function S(e){const t=Number(e||0);return t<1024?`${ee(t)} B`:t<1024**2?`${ee(t/1024)} KB`:t<1024**3?`${ee(t/1024**2)} MB`:t<1024**4?`${ee(t/1024**3)} GB`:`${ee(t/1024**4)} TB`}function le(e){const t=Number(e||0);return!Number.isFinite(t)||t<=0?"0 B":t<1024?`${ee(t)} B`:t<1024**2?`${ee(t/1024)} KB`:t<1024**3?`${ee(t/1024**2)} MB`:t<1024**4?`${ee(t/1024**3)} GB`:`${ee(t/1024**4)} TB`}function b(e){return Number(e||0).toLocaleString()}function M(e){return Number(e||0).toFixed(1)}function ee(e){const t=Number(e||0);return Number.isFinite(t)?t.toFixed(2).replace(/\.?0+$/,""):"0"}function F(e,t){const n=String(e||"").trim(),r=Number(t||0);return r<=0||n.length<=r?n:`${n.slice(0,Math.max(0,r-3))}...`}function fr(e){return new Promise(t=>setTimeout(t,e))}async function Tt(e){const t=String(e??"");if(!t)return!1;try{if(navigator.clipboard&&window.isSecureContext)return await navigator.clipboard.writeText(t),!0}catch(n){console.error("clipboard write failed",n)}try{const n=document.createElement("textarea");n.value=t,n.setAttribute("readonly",""),n.style.position="fixed",n.style.left="-9999px",n.style.top="-9999px",document.body.appendChild(n),n.focus(),n.select();const r=document.execCommand("copy");return n.remove(),!!r}catch(n){return console.error("fallback copy failed",n),!1}}function vt(e){let t=document.getElementById("copyToast");t||(t=document.createElement("div"),t.id="copyToast",t.className="copy-toast",document.body.appendChild(t)),t.textContent=String(e||""),t.classList.add("show"),ut&&clearTimeout(ut),ut=setTimeout(()=>{t.classList.remove("show")},1600)}function h(e,t="info",n=2200){let r=document.getElementById("appToast");r||(r=document.createElement("div"),r.id="appToast",r.className="app-toast",document.body.appendChild(r));const o=String(t||"info").toLowerCase();r.className=`app-toast ${o}`,r.textContent=String(e||""),r.classList.add("show"),pt&&clearTimeout(pt),pt=setTimeout(()=>{r.classList.remove("show")},Math.max(1200,Number(n||2200)))}async function P(e,t,n={}){const r=new AbortController,o=Number(t||0),s=setTimeout(()=>r.abort(),o>0?o:12e3);try{const i=await fetch(e,{...n,signal:r.signal});if(i.status===401)throw io("未登录或登录已过期，请重新登录"),new Error("unauthorized");return i}finally{clearTimeout(s)}}function ta(e,t,n){return new Promise((r,o)=>{const s=setTimeout(()=>o(new Error(n||"timeout")),t);e.then(i=>{clearTimeout(s),r(i)}).catch(i=>{clearTimeout(s),o(i)})})}function f(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function na(){ft&&clearTimeout(ft),ft=setTimeout(()=>Fe(!0),280)}function gr(){var n,r;const e=((r=(n=a.config)==null?void 0:n.system)==null?void 0:r.menu_visibility)||{};if(document.querySelectorAll(".menu[data-section]").forEach(o=>{const s=String(o.dataset.section||"").trim(),i=s==="system"?!0:e[s]!==!1;o.classList.toggle("hidden",!i)}),document.querySelectorAll(".panel").forEach(o=>{const s=o.id==="system"?!0:e[o.id]!==!1;o.classList.toggle("hidden-by-config",!s),s||(o.style.display="none")}),!document.querySelector(".menu.active:not(.hidden)")){const o=document.querySelector(".menu[data-section]:not(.hidden)");o&&(o.classList.add("active"),Pt(o.dataset.section))}}async function Gt(){var e,t,n,r,o,s,i,c,l,d,u,m,g,y,v,k,p,w,$,I,T,N,B,L,_,j,K,V,U,Y;a.config&&(X("systemSiteTitle",((t=(e=a.config)==null?void 0:e.system)==null?void 0:t.site_title)||""),X("systemEnvironment",((r=(n=a.config)==null?void 0:n.system)==null?void 0:r.environment)||""),X("systemOwner",((s=(o=a.config)==null?void 0:o.system)==null?void 0:s.owner)||""),X("systemListen",((l=(c=(i=a.config)==null?void 0:i.core)==null?void 0:c.web)==null?void 0:l.listen)||""),X("systemDefaultShell",((u=(d=a.config)==null?void 0:d.system)==null?void 0:u.default_shell)||""),X("systemDefaultWorkDir",((g=(m=a.config)==null?void 0:m.system)==null?void 0:g.default_work_dir)||""),X("systemRefreshSeconds",((v=(y=a.config)==null?void 0:y.monitor)==null?void 0:v.refresh_seconds)||5),X("systemRuntimeLogPath",((w=(p=(k=a.config)==null?void 0:k.system)==null?void 0:p.runtime_logs)==null?void 0:w.file_path)||""),X("systemRuntimeLogMaxEntries",((T=(I=($=a.config)==null?void 0:$.system)==null?void 0:I.runtime_logs)==null?void 0:T.max_entries)||3e3),X("systemMaxConcurrentTasks",((L=(B=(N=a.config)==null?void 0:N.system)==null?void 0:B.performance)==null?void 0:L.max_concurrent_tasks)||4),X("systemCleanupProgressInterval",((K=(j=(_=a.config)==null?void 0:_.system)==null?void 0:j.performance)==null?void 0:K.cleanup_progress_interval_ms)||300),X("systemDockerPageSize",((Y=(U=(V=a.config)==null?void 0:V.system)==null?void 0:U.performance)==null?void 0:Y.docker_default_page_size)||20),ra())}function ra(){var r,o;const e=document.getElementById("systemMenuVisibility");if(!e)return;const t=((o=(r=a.config)==null?void 0:r.system)==null?void 0:o.menu_visibility)||{},n={monitor:"系统监控",logs:"日志分析",traffic:"进程流量","traffic-capture":"数据包抓包",repair:"修复工具",backup:"数据备份",cleanup:"数据清理",docker:"Docker管理","remote-control":"远程控制",system:"系统管理"};e.innerHTML=Object.entries(n).map(([s,i])=>{const c=t[s]!==!1?"checked":"";return`<label ${s==="system"?'title="系统管理为保底入口，固定显示"':""}><input type="checkbox" class="system-menu-toggle" value="${s}" ${c} ${s==="system"?"disabled":""}>${i}</label>`}).join("")}async function oa(){if(!a.config)return;const e=JSON.parse(JSON.stringify(a.config));e.system=e.system||{},e.system.runtime_logs=e.system.runtime_logs||{},e.system.performance=e.system.performance||{},e.core=e.core||{},e.core.web=e.core.web||{},e.monitor=e.monitor||{},e.system.site_title=H("systemSiteTitle"),e.system.environment=H("systemEnvironment"),e.system.owner=H("systemOwner"),e.core.web.listen=H("systemListen"),e.system.default_shell=H("systemDefaultShell"),e.system.default_work_dir=H("systemDefaultWorkDir"),e.monitor.refresh_seconds=Number(H("systemRefreshSeconds"))||5,e.system.runtime_logs.file_path=H("systemRuntimeLogPath"),e.system.runtime_logs.max_entries=Number(H("systemRuntimeLogMaxEntries"))||3e3,e.system.performance.max_concurrent_tasks=Number(H("systemMaxConcurrentTasks"))||4,e.system.performance.cleanup_progress_interval_ms=Number(H("systemCleanupProgressInterval"))||300,e.system.performance.docker_default_page_size=Number(H("systemDockerPageSize"))||20;const t={};document.querySelectorAll(".system-menu-toggle").forEach(o=>{t[String(o.value||"")]=!!o.checked}),t.system=!0,e.system.menu_visibility=t;const n=await fetch("/api/config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}),r=await n.json();if(!n.ok){h(r.error||"保存系统配置失败","error");return}a.config=e,gr(),await Gt(),h("系统配置已保存并同步到配置文件","success")}async function Fe(e=!1){const t=H("runtimeLogKeyword"),n=H("runtimeLogLevel")||"all",r=new URLSearchParams({limit:"400",keyword:t,level:n});try{const o=await P(`/api/system/runtime-logs?${r.toString()}`,12e3),s=await o.json();if(!o.ok){e||h(s.error||"加载运行日志失败","error");return}a.systemRuntimeLogs=Array.isArray(s.items)?s.items:[],sa(s.config||{})}catch(o){console.error("load runtime logs failed",o),e||h("加载运行日志失败","error")}}function sa(e={}){const t=document.getElementById("runtimeLogMeta");t&&(t.textContent=`日志文件: ${e.file_path||"-"} | 缓存条数: ${b(e.max_entries||a.systemRuntimeLogs.length||0)} | 当前显示: ${b(a.systemRuntimeLogs.length)}`);const n=document.getElementById("runtimeLogList");if(n){if(!a.systemRuntimeLogs.length){n.innerHTML='<div class="hint">暂无运行日志</div>';return}n.innerHTML=a.systemRuntimeLogs.map(r=>`
      <article class="runtime-log-item ${f(String(r.level||"info").toLowerCase())}">
        <header>
          <span>${f(J(r.time))}</span>
          <span>${f(String(r.level||"info").toUpperCase())}</span>
          <span>${f(r.source||"runtime")}</span>
        </header>
        <div>${f(r.text||"-")}</div>
      </article>
    `).join("")}}function rt(){const e=document.getElementById("backupSourceList"),t=document.getElementById("backupSourceSummary"),n=Array.isArray(a.backupSelectedSources)?a.backupSelectedSources:[];if(t&&(t.textContent=n.length?`已选择 ${n.length} 个备份源目录`:"未选择备份源，默认使用配置文件中的源目录"),!!e){if(!n.length){e.innerHTML='<span class="hint">当前未指定自定义备份源</span>';return}e.innerHTML=n.map(r=>`<label><span>${f(r)}</span><button class="btn sm danger" type="button" data-backup-remove="${encodeURIComponent(r)}">移除</button></label>`).join(""),e.querySelectorAll("button[data-backup-remove]").forEach(r=>{r.addEventListener("click",()=>{const o=decodeURIComponent(String(r.dataset.backupRemove||""));a.backupSelectedSources=a.backupSelectedSources.filter(s=>s!==o),rt()})})}}async function yr(e){const t=await fetch("/api/fs/mkdir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:e})}),n=await t.json();if(!t.ok)throw new Error(n.error||"create directory failed");return n.path}async function aa(e=!1){if(!e&&$e.length)return $e;const t=await P("/api/fs/roots",12e3),n=await t.json();if(!t.ok)throw new Error(n.error||"load fs roots failed");return $e=Array.isArray(n.items)?n.items:[],$e}async function Lt(e){const t=String(e||"").trim();if(a.fsTreeCache[t])return a.fsTreeCache[t];const n=await P(`/api/fs/tree?path=${encodeURIComponent(t)}`,15e3),r=await n.json();if(!n.ok)throw new Error(r.error||"load fs tree failed");return a.fsTreeCache[t]=Array.isArray(r.items)?r.items.filter(o=>o.type==="directory"):[],a.fsTreeCache[t]}async function Mt(e={}){wt=typeof e.onConfirm=="function"?e.onConfirm:null,Ve=e.multi!==!1,Pn=!!e.allowCreate,Rn=e.title||"选择目录",a.fsModalMode=e.mode||"",a.fsModalSelected=Array.isArray(e.selected)?[...e.selected]:[],pe=new Set;const t=await aa();t.forEach(n=>pe.add(n.path)),await Promise.all(t.slice(0,4).map(n=>Lt(n.path))),Ge()}function Ge(){var n,r,o;const e=(s,i=0)=>`<ul class="fs-tree-level depth-${i}">${s.map(c=>{const l=String(c.path||""),d=encodeURIComponent(l),u=pe.has(l),m=a.fsModalSelected.includes(l),g=m?"checked":"",y=u?a.fsTreeCache[l]||[]:[],v=c.has_children?"has-children":"is-leaf",k=c.has_children?"":'disabled aria-disabled="true"';return`
          <li class="fs-tree-node">
            <div class="fs-tree-row${m?" selected":""}" data-depth="${i}">
              <button class="btn sm fs-tree-toggle ${v}" type="button" data-fs-expand="${d}" ${k}>${c.has_children?u?"−":"+":"·"}</button>
              <label class="fs-tree-label">
                <input type="${Ve?"checkbox":"radio"}" name="fs-picker" data-fs-select="${d}" ${g} />
                <span title="${f(l)}">${f(c.name||l)}</span>
              </label>
            </div>
            ${u&&y.length?e(y,i+1):""}
          </li>
        `}).join("")}</ul>`,t=`
    <section class="fs-picker">
      <div class="fs-picker-toolbar">
        <div class="hint">目录树支持多选勾选，可用于备份源、备份目标和清理扫描目录。</div>
        ${Pn?'<button id="fsPickerCreateBtn" class="btn sm" type="button">新建目录</button>':""}
      </div>
      <div class="fs-picker-tree">${e($e)}</div>
      <div class="fs-picker-selected">
        <h4>已选目录</h4>
        <div class="selector">${(a.fsModalSelected||[]).map(s=>`<label>${f(s)}</label>`).join("")||'<span class="hint">尚未选择目录</span>'}</div>
      </div>
      <div class="fs-picker-actions">
        <button id="fsPickerCancelBtn" class="btn sm" type="button">取消</button>
        <button id="fsPickerConfirmBtn" class="btn sm" type="button">确认选择</button>
      </div>
    </section>
  `;z(Rn,t),document.querySelectorAll("[data-fs-expand]").forEach(s=>{s.addEventListener("click",async()=>{const i=decodeURIComponent(String(s.dataset.fsExpand||""));i&&(pe.has(i)?pe.delete(i):(pe.add(i),await Lt(i)),Ge())})}),document.querySelectorAll("[data-fs-select]").forEach(s=>{s.addEventListener("change",i=>{const c=decodeURIComponent(String(i.target.dataset.fsSelect||""));c&&(Ve?i.target.checked?a.fsModalSelected.includes(c)||a.fsModalSelected.push(c):a.fsModalSelected=a.fsModalSelected.filter(l=>l!==c):a.fsModalSelected=i.target.checked?[c]:[],Ge())})}),(n=document.getElementById("fsPickerCancelBtn"))==null||n.addEventListener("click",ge),(r=document.getElementById("fsPickerConfirmBtn"))==null||r.addEventListener("click",()=>{wt&&wt([...a.fsModalSelected]),ge()}),(o=document.getElementById("fsPickerCreateBtn"))==null||o.addEventListener("click",async()=>{var c;const s=a.fsModalSelected[0]||((c=$e[0])==null?void 0:c.path)||"",i=prompt("请输入要创建的目录路径",s);if(i)try{const l=await yr(i),d=l.includes("/")||l.includes("\\")?l.replace(/[\\/][^\\/]+$/,""):"";d&&(delete a.fsTreeCache[d],pe.add(d),await Lt(d)),a.fsModalSelected.includes(l)||(a.fsModalSelected=Ve?[...a.fsModalSelected,l]:[l]),Ge(),h(`目录已创建: ${l}`,"success")}catch(l){h(l.message||"创建目录失败","error")}})}function $n(e){var t,n,r,o;a.dockerTab=e==="images"?"images":"containers",(t=document.getElementById("dockerContainerTable"))==null||t.classList.toggle("hidden",a.dockerTab!=="containers"),(n=document.getElementById("dockerImageTable"))==null||n.classList.toggle("hidden",a.dockerTab!=="images"),(r=document.getElementById("dockerTabContainers"))==null||r.classList.toggle("active",a.dockerTab==="containers"),(o=document.getElementById("dockerTabImages"))==null||o.classList.toggle("active",a.dockerTab==="images"),hr(),a.dockerTab==="images"&&Jt(!0)}function hr(){const e=document.getElementById("dockerBatchActionType"),t=document.getElementById("dockerBatchApplyBtn");if(!e)return;const n=a.dockerTab==="images",r=String(e.value||"").trim(),o=n?[{value:"remove-image",label:"批量删除镜像"}]:[{value:"start",label:"批量启动容器"},{value:"stop",label:"批量停止容器"},{value:"restart",label:"批量重启容器"},{value:"remove",label:"批量删除容器"}];e.innerHTML=o.map(i=>`<option value="${i.value}">${i.label}</option>`).join("");const s=o.some(i=>i.value===r);e.value=s?r:o[0].value,t&&(t.textContent=n?"删除所选镜像":"执行容器批量操作",t.classList.toggle("danger",n||e.value==="remove"||e.value==="stop")),e.onchange=()=>{if(!t)return;const i=String(e.value||"").trim();t.classList.toggle("danger",i==="remove-image"||i==="remove"||i==="stop")}}async function Jt(e=!1){var o;if(!e&&a.dockerImages.length)return In(),a.dockerImages;const t=String(((o=document.getElementById("dockerSearch"))==null?void 0:o.value)||"").trim(),n=await P(`/api/docker/images?keyword=${encodeURIComponent(t)}`,2e4),r=await n.json();return n.ok?(a.dockerImages=Array.isArray(r.items)?r.items:[],In(),a.dockerImages):(h(r.error||"加载 Docker 镜像失败","error"),a.dockerImages)}function In(){const e=a.dockerImages.map(t=>[`<input type="checkbox" class="docker-image-select" value="${f(t.id||"")}" ${a.dockerSelectedImageIDs.includes(t.id)?"checked":""}>`,t.display_name||t.repository||t.id||"-",t.id||"-",t.digest||"-",t.created_at||"-",t.size||"-",`<button class="btn sm" type="button" data-docker-image-inspect="${f(t.id||"")}">详情</button>`]);x("dockerImageTable",["选择","镜像","ID","Digest","创建时间","大小","操作"],e,!0),ct()}async function ia(e){if(!a.dockerSelectedContainerIDs.length){h("请先勾选容器","warning");return}const t={ids:a.dockerSelectedContainerIDs,action:e,remove_volumes:!1},n=await fetch("/api/docker/containers/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),r=await n.json();if(!n.ok){h(r.error||"批量容器操作失败","error");return}await xt(!0),h(`批量容器操作已完成: ${e}`,"success")}async function ca(e){if(!a.dockerSelectedImageIDs.length){h("请先勾选镜像","warning");return}const t=await fetch("/api/docker/images/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:a.dockerSelectedImageIDs,action:e,force:!0})}),n=await t.json();if(!t.ok){h(n.error||"批量镜像操作失败","error");return}await Jt(!0),h(`批量镜像操作已完成: ${e}`,"success")}async function la(e){const t=e.target.closest("[data-docker-image-inspect]");if(t){const r=String(t.dataset.dockerImageInspect||"").trim();if(!r)return;const o=await P(`/api/docker/images/${encodeURIComponent(r)}/inspect`,2e4),s=await o.json();if(!o.ok){h(s.error||"加载镜像详情失败","error");return}z(`镜像详情 - ${r}`,`<pre class="log-view compact">${f(JSON.stringify(s.inspect,null,2))}</pre>`);return}e.target.closest(".docker-image-select")&&ct()}function ct(){a.dockerSelectedContainerIDs=Array.from(document.querySelectorAll(".docker-container-select:checked")).map(e=>String(e.value||"").trim()).filter(Boolean),a.dockerSelectedImageIDs=Array.from(document.querySelectorAll(".docker-image-select:checked")).map(e=>String(e.value||"").trim()).filter(Boolean)}async function ye(e=!1){var n,r,o;let t=null;try{const s=await P("/api/traffic?packet_limit=1200&http_limit=200",2e4);if(t=await s.json(),!s.ok)return h(t.error||"加载流量分析失败","error"),a.trafficSnapshot}catch(s){return console.error("load traffic data failed",s),e&&h("加载流量分析失败","error"),a.trafficSnapshot}return a.trafficSnapshot=t||null,a.trafficInterfaces=Array.isArray(t==null?void 0:t.interfaces)?t.interfaces:[],da(),ua(),br(),de(),ga(),!((r=(n=a.trafficSnapshot)==null?void 0:n.status)!=null&&r.active)&&!a.trafficAutoStartTried&&String(((o=document.querySelector(".panel.visible"))==null?void 0:o.id)||"").trim()==="traffic-capture"&&(a.trafficAutoStartTried=!0,await kr({silent:!0,auto:!0})),a.trafficSnapshot}function vr(){Xt(),a.trafficPollTimer=setInterval(()=>{ye(!1)},2e3)}function Xt(){a.trafficPollTimer&&(clearInterval(a.trafficPollTimer),a.trafficPollTimer=null)}function da(){var l,d,u,m,g;const e=document.getElementById("trafficInterface");if(!e)return;const t=wr(Array.isArray(a.trafficInterfaces)?a.trafficInterfaces:[]),n=String(((d=(l=a.trafficSnapshot)==null?void 0:l.status)==null?void 0:d.interface_name)||"").trim(),r=String(e.value||"").trim(),o=n||r||((u=t[0])==null?void 0:u.name)||"";e.innerHTML="",t.forEach(y=>{const v=document.createElement("option");v.value=y.name||"",v.textContent=va(y),v.disabled=!y.up,((y.name||"")===n||!n&&(y.name||"")===o)&&(v.selected=!0),e.appendChild(v)});const s=document.getElementById("trafficBuiltinFilter"),i=document.getElementById("trafficCustomFilter"),c=String(((g=(m=a.trafficSnapshot)==null?void 0:m.status)==null?void 0:g.capture_filter)||"").trim();s&&c&&(Array.from(s.options||[]).some(v=>String(v.value||"").trim()===c)?(s.value=c,i&&(i.value="")):i&&(i.value=c))}function ua(){var t,n,r,o,s,i,c;const e=((t=a.trafficSnapshot)==null?void 0:t.status)||{};document.querySelectorAll("[data-traffic-status-summary]").forEach(l=>{if(!e.active)l.textContent="抓包未启动。选择网卡后可开始实时流量采集与 HTTP 明文解码。";else{const d=[`抓包接口 ${e.interface_name||"-"}`,`抓包过滤 ${e.capture_filter||"-"}`,`启动时间 ${J(e.started_at||Date.now())}`,`本机地址 ${Array.isArray(e.local_addresses)?e.local_addresses.join(", "):"-"}`];l.textContent=d.join(" | ")}e.error&&(l.textContent+=` | ${e.error}`)}),We("connections",b(e.connections||((r=(n=a.trafficSnapshot)==null?void 0:n.connections)==null?void 0:r.length)||0)),We("packets",b(e.packet_count||((s=(o=a.trafficSnapshot)==null?void 0:o.packets)==null?void 0:s.length)||0)),We("http",b(e.http_message_count||((c=(i=a.trafficSnapshot)==null?void 0:i.http)==null?void 0:c.length)||0)),We("interface",e.interface_name||"-")}function br(){var r,o;const e=String(((r=document.getElementById("trafficConnectionSearch"))==null?void 0:r.value)||"").trim().toLowerCase(),n=(Array.isArray((o=a.trafficSnapshot)==null?void 0:o.connections)?a.trafficSnapshot.connections:[]).filter(s=>e?[s.process_name,s.pid,s.local_ip,s.local_port,s.remote_ip,s.remote_port,s.protocol,s.status].join(" ").toLowerCase().includes(e):!0).slice(0,200).map(s=>[s.process_name||"-",s.pid||"-",s.protocol||"-",`${s.local_ip||"-"}:${s.local_port||0}`,s.remote_ip?`${s.remote_ip}:${s.remote_port||0}`:"-",s.status||"-",`${S(s.bytes_in||0)} / ${S(s.bytes_out||0)}`,`${b(s.packets_in||0)} / ${b(s.packets_out||0)}`,s.last_seen?J(s.last_seen):"-"]);x("trafficConnectionTable",["进程","PID","协议","本地地址","远端地址","状态","入/出流量","入/出包数","最后活跃"],n)}function de(){var u,m,g,y,v,k;const e=String(((u=document.getElementById("trafficDisplayPreset"))==null?void 0:u.value)||"all").trim().toLowerCase(),t=String(((m=document.getElementById("trafficDisplayFilter"))==null?void 0:m.value)||"").trim(),r=[...Array.isArray((g=a.trafficSnapshot)==null?void 0:g.packets)?a.trafficSnapshot.packets:[]].sort((p,w)=>et(p==null?void 0:p.timestamp)-et(w==null?void 0:w.timestamp)),o=r.filter(p=>pa(p,e,t)),s=Number(((v=(y=a.trafficSnapshot)==null?void 0:y.status)==null?void 0:v.packet_count)||r.length||0),i=Math.max(1,s-o.length+1),c=o.slice(-1e3).map((p,w)=>{const $=i+w;return{rowClass:String(a.trafficSelectedPacketID||"")===String(p.id||"")?"traffic-packet-selected":"",attrs:{"data-traffic-packet-id":String(p.id||"")},cells:[$,J(p.timestamp),`${p.src_ip||"-"}:${p.src_port||0}`,`${p.dst_ip||"-"}:${p.dst_port||0}`,`${p.protocol||"-"}${p.app_protocol?`/${p.app_protocol}`:""}`,b(p.length||0),p.info||"-"]}});if(x("trafficPacketTable",["编号","时间","源地址","目的地址","协议","长度","信息"],c),!o.length){a.trafficSelectedPacketID="",Bn(null),E("trafficPacketHint","当前过滤条件下无数据包");return}o.some(p=>String(p.id||"")===String(a.trafficSelectedPacketID||""))||(a.trafficSelectedPacketID=String(((k=o[o.length-1])==null?void 0:k.id)||""));const d=o.find(p=>String(p.id||"")===String(a.trafficSelectedPacketID||""))||o[o.length-1];Bn(d),E("trafficPacketHint",`显示 ${b(o.length)} / ${b(r.length)} 个数据包`)}function pa(e,t,n){const r=String((e==null?void 0:e.protocol)||"").trim().toLowerCase(),o=String((e==null?void 0:e.app_protocol)||"").trim().toLowerCase(),s=Number((e==null?void 0:e.src_port)||0),i=Number((e==null?void 0:e.dst_port)||0),c=String((e==null?void 0:e.info)||"").trim().toLowerCase(),l=String((e==null?void 0:e.payload_preview)||"").trim().toLowerCase(),d=String((e==null?void 0:e.process_name)||"").trim().toLowerCase(),u=`${String((e==null?void 0:e.src_ip)||"").trim().toLowerCase()}:${s}`,m=`${String((e==null?void 0:e.dst_ip)||"").trim().toLowerCase()}:${i}`,g=[d,r,o,u,m,c,l].join(" ");switch(t){case"tcp":if(r!=="tcp")return!1;break;case"udp":if(r!=="udp")return!1;break;case"http":if(!(o==="http"||c.includes("http")))return!1;break;case"https":if(!(o==="https"||s===443||i===443||c.includes("tls")||c.includes("https")))return!1;break;case"dns":if(!(s===53||i===53||c.includes("dns")))return!1;break}const y=String(n||"").trim().toLowerCase();if(!y)return!0;const v=y.split(/\s+/).filter(Boolean);return v.length?v.every(k=>{const p=k.match(/^len(>=|<=|>|<|=)(\d+)$/);if(p){const $=p[1],I=Number(p[2]),T=Number((e==null?void 0:e.length)||0);return $===">"?T>I:$==="<"?T<I:$===">="?T>=I:$==="<="?T<=I:T===I}const w=k.match(/^([a-z_]+):(.*)$/);if(w){const $=w[1],I=String(w[2]||"").trim().toLowerCase();return I?$==="proto"||$==="protocol"?r.includes(I)||o.includes(I):$==="src"?u.includes(I)||String((e==null?void 0:e.src_ip)||"").toLowerCase().includes(I):$==="dst"?m.includes(I)||String((e==null?void 0:e.dst_ip)||"").toLowerCase().includes(I):$==="port"?String(s).includes(I)||String(i).includes(I):$==="pid"?String((e==null?void 0:e.pid)||"").includes(I):$==="proc"||$==="process"?d.includes(I):$==="info"?c.includes(I):$==="contains"||$==="payload"?l.includes(I)||String((e==null?void 0:e.decoded_text)||"").toLowerCase().includes(I):g.includes(I):!0}return g.includes(k)}):!0}function Bn(e){const t=document.getElementById("trafficPacketDetailTitle"),n=document.getElementById("trafficPacketDetailMeta"),r=document.getElementById("trafficPacketDetailBody");if(!n||!r)return;if(!e){t&&(t.textContent="未选择数据包"),n.innerHTML=O(["字段","值"],[["状态","请选择上方数据包"]]),r.textContent="请选择上方数据包查看详情";return}const o=String(a.trafficDecodeMode||"auto").toLowerCase(),s=o==="ascii"?"ASCII":o==="hex"?"HEX":o==="http"?"HTTP":"自动";t&&(t.textContent=`数据包 ${F(String(e.id||"-"),24)} | 解码模式 ${s}`);const i=[["时间",J(e.timestamp)],["进程",`${e.process_name||"-"} (PID ${e.pid||"-"})`],["方向",e.direction||"-"],["协议",`${e.protocol||"-"} / ${e.app_protocol||"-"}`],["源地址",`${e.src_ip||"-"}:${e.src_port||0}`],["目的地址",`${e.dst_ip||"-"}:${e.dst_port||0}`],["长度",`${b(e.length||0)} bytes`],["信息",e.info||"-"]];n.innerHTML=O(["字段","值"],i,!0),r.textContent=ma(e,o)}function ma(e,t){const n=String((e==null?void 0:e.payload_preview)||""),r=String((e==null?void 0:e.decoded_text)||""),o=String((e==null?void 0:e.app_protocol)||"").toLowerCase(),s=r||n||"";return s?t==="http"?o==="http"||/^([A-Z]+ \/|HTTP\/)/i.test(s)||/^HTTP\/\d/.test(s)?s:`当前包不是 HTTP 明文流量，无法按 HTTP 解码。

`+s:t==="ascii"?fa(s):t==="hex"?_n(s):e!=null&&e.https||o==="https"?`HTTPS/TLS 流量，暂不支持明文解码。

`+_n(s):s:"无可解码内容"}function fa(e){const t=String(e||"");return t?t.split("").map(n=>{const r=n.charCodeAt(0);return r===10||r===13||r===9||r>=32&&r<=126?n:"."}).join(""):""}function _n(e){const n=new TextEncoder().encode(String(e||""));if(!n.length)return"";const r=[];for(let o=0;o<n.length;o+=16){const s=n.slice(o,o+16),i=Array.from(s).map(l=>l.toString(16).padStart(2,"0")).join(" "),c=Array.from(s).map(l=>l>=32&&l<=126?String.fromCharCode(l):".").join("");r.push(`${o.toString(16).padStart(4,"0")}  ${i.padEnd(16*3-1," ")}  ${c}`)}return r.join(`
`)}function ga(){var n;const t=(Array.isArray((n=a.trafficSnapshot)==null?void 0:n.http)?a.trafficSnapshot.http:[]).slice(0,160).map(r=>[J(r.timestamp),r.process_name||"-",r.pid||"-",r.method||r.status||"-",r.host||"-",r.url||"-",r.content_type||"-",`<button class="btn sm" type="button" data-traffic-http="${f(r.id||"")}">查看明文</button>`]);x("trafficHTTPTable",["时间","进程","PID","请求/状态","Host","URL","内容类型","操作"],t,!0)}async function kr(e={}){var r,o,s;const t=!!e.silent,n=!!e.auto;try{const i=document.getElementById("trafficInterface"),c=wr(Array.isArray(a.trafficInterfaces)?a.trafficInterfaces:[]);let l=String((i==null?void 0:i.value)||"").trim();if(l||(l=((r=c[0])==null?void 0:r.name)||""),!l){t||h("未发现可用抓包网卡","error");return}const d=ha();let u=await En(l,d);if(!u.ok){const m=((o=c.find(g=>g.name&&g.name!==l&&g.up))==null?void 0:o.name)||"";m&&(u=await En(m,d),u.ok&&i&&(i.value=m,t||h(`所选网卡不可用，已切换到 ${m}`,"warning")))}if(!u.ok){t||h(((s=u.data)==null?void 0:s.error)||"启动抓包失败","error");return}await ye(!0),vr(),t||h(`流量抓包已启动${n?"（自动）":""}`,"success")}catch(i){console.error("start traffic capture failed",i),t||h("启动抓包失败","error")}}async function ya(){try{const e=await fetch("/api/traffic/capture/stop",{method:"POST"}),t=await e.json();if(!e.ok){h(t.error||"停止抓包失败","error");return}await ye(!0),h("流量抓包已停止","success")}catch(e){console.error("stop traffic capture failed",e),h("停止抓包失败","error")}}function ha(){var n,r;const e=String(((n=document.getElementById("trafficBuiltinFilter"))==null?void 0:n.value)||"").trim(),t=String(((r=document.getElementById("trafficCustomFilter"))==null?void 0:r.value)||"").trim();return t||e||"tcp or udp"}async function En(e,t){const n=await fetch("/api/traffic/capture/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({interface:e,filter:t})}),r=await n.json();return{ok:n.ok,data:r}}function We(e,t){document.querySelectorAll(`[data-traffic-kpi="${e}"]`).forEach(n=>{n.textContent=t})}function va(e){const t=(e==null?void 0:e.name)||"-",n=[];Sr(t)&&n.push("推荐"),e!=null&&e.loopback&&n.push("loopback"),e!=null&&e.up||n.push("down");const r=n.length?` [${n.join(" / ")}]`:"",o=Array.isArray(e==null?void 0:e.addresses)&&e.addresses.length?` - ${e.addresses.join(", ")}`:"";return`${t}${r}${o}`}function wr(e){return[...e].sort((t,n)=>{const r=Tn(n)-Tn(t);return r!==0?r:String((t==null?void 0:t.name)||"").localeCompare(String((n==null?void 0:n.name)||""))})}function Tn(e){const t=String((e==null?void 0:e.name)||"").trim().toLowerCase(),n=Array.isArray(e==null?void 0:e.addresses)?e.addresses:[];let r=0;return Sr(t)&&(r+=1e3),e!=null&&e.up&&(r+=300),ka(n)?r+=200:wa(n,!!(e!=null&&e.loopback))&&(r+=80),e!=null&&e.loopback&&(r+=120),ba(t)&&(r-=200),r}function Sr(e){return/^(en\d+|eth\d+|eno\d+|ens\d+|enp\d+|wlan\d+|wlp\d+|wl[a-z0-9]+)$/i.test(String(e||"").trim())}function ba(e){return/^(lo\d*|bridge\d*|docker\d*|br-|veth|utun\d*|awdl\d*|llw\d*|gif\d*|stf\d*|p2p\d*|tap\d*|tun\d*|vmnet\d*|xhc\d*)/i.test(String(e||"").trim())}function ka(e){return e.some(t=>{const n=String(t||"").trim().toLowerCase();return n?!n.startsWith("127.")&&n!=="::1"&&!n.startsWith("fe80:"):!1})}function wa(e,t){return t?e.length>0:e.some(n=>{const r=String(n||"").trim().toLowerCase();return!!r&&!r.startsWith("fe80:")})}function Sa(e){const t=e.target.closest("[data-traffic-packet-id]");if(!t)return;const n=String(t.getAttribute("data-traffic-packet-id")||"").trim();n&&(a.trafficSelectedPacketID=n,Yt(),de())}function $a(e){const t=e.target.closest("[data-traffic-packet-id]");if(!t)return;const n=String(t.getAttribute("data-traffic-packet-id")||"").trim();n&&(e.preventDefault(),a.trafficContextPacketID=n,a.trafficSelectedPacketID=n,de(),Ia(e.clientX,e.clientY))}function Ia(e,t){const n=document.getElementById("trafficPacketContextMenu");if(!n)return;n.classList.remove("hidden");const r=Number(n.offsetWidth||180),o=Number(n.offsetHeight||140),s=Number(window.innerWidth||1280),i=Number(window.innerHeight||720),c=Math.max(8,Math.min(Number(e||0),s-r-8)),l=Math.max(8,Math.min(Number(t||0),i-o-8));n.style.left=`${c}px`,n.style.top=`${l}px`}function Yt(){const e=document.getElementById("trafficPacketContextMenu");e&&e.classList.add("hidden")}function Ba(e){const t=e.target.closest("[data-decode-mode]");if(!t)return;const n=String(t.dataset.decodeMode||"auto").trim().toLowerCase();a.trafficDecodeMode=n||"auto";const r=String(a.trafficContextPacketID||a.trafficSelectedPacketID||"").trim();r&&(a.trafficSelectedPacketID=r),Yt(),de()}function _a(e){var i;const t=e.target.closest("[data-traffic-http]");if(!t)return;const n=String(t.dataset.trafficHttp||"").trim(),r=(((i=a.trafficSnapshot)==null?void 0:i.http)||[]).find(c=>String(c.id||"")===n);if(!r)return;if(r.unsupported_reason){h(r.unsupported_reason,"warning");return}const o=Object.entries(r.headers||{}).map(([c,l])=>[c,l]),s=`
    <section class="traffic-http-detail">
      <div class="system-detail-grid">
        <section class="system-detail-block">
          <h4>HTTP 元信息</h4>
          ${O(["字段","值"],[["时间",J(r.timestamp)],["进程",r.process_name||"-"],["PID",r.pid||"-"],["方向",r.direction||"-"],["Method",r.method||"-"],["Status",r.status||"-"],["URL",r.url||"-"],["Host",r.host||"-"],["协议",r.protocol||"-"],["内容类型",r.content_type||"-"]],!0)}
        </section>
        <section class="system-detail-block">
          <h4>请求头/响应头</h4>
          ${O(["Header","Value"],o.length?o:[["-","-"]],!0)}
        </section>
      </div>
      <pre class="log-view compact">${f(r.raw||r.body||"无可解码内容")}</pre>
    </section>
  `;z("HTTP 明文详情",s)}function Ea(e){const t=String(e||"-").trim();if(!t)return"-";if(/docker[\\/](volumes|overlay2|containers)/i.test(t)){const n=t.match(/docker[\\/](?:volumes|overlay2|containers)[\\/]+([^\\/]+)/i),r=n!=null&&n[1]?F(n[1],28):"docker-volume";return`<span class="mount-badge docker" title="${f(t)}">Docker 卷 · ${f(r)}</span>`}return`<span title="${f(t)}">${f(F(t,42))}</span>`}function Ta(e){const t=document.getElementById("diskVolumeChart");if(!t)return;const n=(Array.isArray(e)?e:[]).filter(o=>/docker[\\/]/i.test(String(o.path||"")));if(!n.length){t.innerHTML='<div class="hint">未检测到 Docker 挂载卷</div>';return}const r=n.reduce((o,s)=>o+Number(s.used||0),0)||1;t.innerHTML=n.slice(0,8).map(o=>{const s=Math.max(8,Number(o.used||0)*100/r),i=String(o.path||"").split(/[\\/]/).slice(-2).join("/");return`
        <div class="disk-volume-item" title="${f(o.path||"-")}">
          <span class="disk-volume-label">${f(F(i||o.path||"-",28))}</span>
          <span class="disk-volume-bar"><i style="width:${s.toFixed(2)}%"></i></span>
          <span class="disk-volume-size">${f(S(o.used||0))}</span>
        </div>
      `}).join("")}function X(e,t){const n=document.getElementById(e);n&&(n.value=t??"")}function H(e){var t;return String(((t=document.getElementById(e))==null?void 0:t.value)||"").trim()}let Ln=!1;function La(){Ln||(Ln=!0,document.dispatchEvent(new Event("DOMContentLoaded",{bubbles:!0,cancelable:!0})))}function Ma(e){let t,n;return{c(){t=new Nr(!1),n=Cr(),t.a=n},m(r,o){t.m(Gr,r,o),An(r,n,o)},p:Ie,i:Ie,o:Ie,d(r){r&&(Ct(n),t.d())}}}function Ca(e){return Rr(()=>{La()}),[]}class Aa extends Ur{constructor(t){super(),Vr(this,t,Ca,Ma,_r,{})}}const $r=document.getElementById("app");if(!$r)throw new Error("mount target #app not found");new Aa({target:$r});

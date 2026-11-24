/* UI 组件库：只产出 HTML 字符串，不直接操作 DOM（便于 Node 测试） */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var ui = {};

  var ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    chev: '<path d="M9 18l6-6-6-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cam: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    drop: '<path d="M12 2.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    warn: '<path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    down: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',
    up: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 3h16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    clip: '<path d="M9 5h6M9 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M9 5V3h6v2"/><path d="M9 12h6M9 16h4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 4-6"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',
    upload: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 3h16"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'
  };

  ui.icon = function (name, size) {
    var p = ICONS[name];
    if (!p) return '';
    var s = size || 18;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  };

  ui.chip = function (text, cls, icon) {
    return '<span class="chip ' + (cls || '') + '">' + (icon ? ui.icon(icon, 11) : '') + text + '</span>';
  };

  ui.money = function (cents) {
    return '<span class="money">¥' + App.util.fmtMoney(cents) + '</span>';
  };

  ui.ring = function (pct, size) {
    var s = size || 96;
    var r = (s - 28) / 2;
    var c = 2 * Math.PI * r;
    var off = c * (1 - Math.min(1, Math.max(0, pct / 100)));
    return '<div class="ring" style="width:' + s + 'px;height:' + s + 'px">' +
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke="#eef1f6" stroke-width="9" fill="none"/>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke="#2f6bff" stroke-width="9" fill="none" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg><div class="ring-ctr"><b class="num">' + pct + '%</b><i>已完成</i></div></div>';
  };

  ui.pbar = function (pct, color) {
    return '<div class="pbar"><i style="width:' + pct + '%;' + (color ? 'background:' + color : '') + '"></i></div>';
  };

  // 拟真表盘（用于"照片"缩略图）
  ui.meter = function (type, val, wm) {
    var digits = String(val == null ? '' : val).replace(/\./g, '');
    digits = digits.replace(/\D/g, '');
    while (digits.length < 5) digits = '0' + digits;
    digits = digits.slice(-5);
    var html = digits.split('').map(function (c, i) {
      return '<span class="' + (i === digits.length - 1 ? 'red' : '') + '">' + c + '</span>';
    }).join('');
    return '<span class="meter"><span class="mh"><span>' + (type === 'w' ? '水表' : '电能表') + '</span>' +
      '<span>' + (type === 'w' ? 'W' : 'E') + '</span></span>' +
      '<span class="digits">' + html + '</span>' +
      '<span class="wm">' + (wm || '11-25 14:32 · 抄表员 李强') + '</span></span>';
  };

  // 折线图（纯 SVG，无依赖）
  ui.lineChart = function (points, opts) {
    opts = opts || {};
    var w = opts.w || 310, h = opts.h || 120;
    var pl = 8, pr = 8, pt = 12, pb = 22;
    var color = opts.color || '#2f6bff';
    if (!points || !points.length) return '';
    var vals = points.map(function (p) { return Number(p.value) || 0; });
    var max = Math.max.apply(null, vals) * 1.2 || 1;
    var n = points.length;
    var pts = points.map(function (p, i) {
      var x = n === 1 ? (w / 2) : (pl + i * (w - pl - pr) / (n - 1));
      var y = h - pb - ((Number(p.value) || 0) / max) * (h - pt - pb);
      return [x, y];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[n - 1][0].toFixed(1) + ',' + (h - pb) + ' L' + pts[0][0].toFixed(1) + ',' + (h - pb) + ' Z';
    var dots = pts.map(function (p, i) {
      var last = i === n - 1;
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (last ? 4 : 2.2) + '" fill="' + (last ? color : '#fff') + '" stroke="' + color + '" stroke-width="1.6"/>';
    }).join('');
    var labels = points.map(function (p, i) {
      if (n > 6 && i % 2 !== 0 && i !== n - 1) return '';
      return '<text x="' + pts[i][0].toFixed(1) + '" y="' + (h - 5) + '" font-size="8.5" fill="#98a2b3" text-anchor="middle">' + (p.label || '') + '</text>';
    }).join('');
    var gid = 'g' + Math.random().toString(36).slice(2, 7);
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="max-width:100%">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".20"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + labels + '</svg>';
  };

  ui.empty = function (title, desc, act, actLabel) {
    return '<div class="empty"><div class="empty-ic">' + ui.icon('clip', 26) + '</div>' +
      '<div class="empty-t">' + title + '</div>' +
      (desc ? '<div class="empty-d">' + desc + '</div>' : '') +
      (act ? '<button class="btn sm" data-act="' + act + '">' + actLabel + '</button>' : '') +
      '</div>';
  };

  ui.ROLES = [
    { key: 'guard', name: '安保（抄表员）', short: '安保', page: 'guard.task' },
    { key: 'supervisor', name: '安保主管', short: '主管', page: 'supervisor.dash' },
    { key: 'manager', name: '物业管家', short: '管家', page: 'manager.bills' },
    { key: 'finance', name: '财务', short: '财务', page: 'finance.deduct' },
    { key: 'admin', name: '管理员（审批）', short: '管理员', page: 'admin.approvals' },
    { key: 'employee', name: '员工（张伟）', short: '员工', page: 'employee.bill' }
  ];

  ui.roleMeta = function (key) {
    for (var i = 0; i < ui.ROLES.length; i++) if (ui.ROLES[i].key === key) return ui.ROLES[i];
    return ui.ROLES[0];
  };

  // 顶部：品牌 + 角色切换器（用 <details>，不依赖 JS）
  ui.topbar = function (role) {
    var cur = ui.roleMeta(role);
    var items = ui.ROLES.map(function (r) {
      return '<button data-act="role:' + r.key + '" class="' + (r.key === role ? 'on' : '') + '">' +
        '<span>' + r.name + '</span>' + (r.key === role ? ui.icon('check', 14) : '') + '</button>';
    }).join('');
    return '<div class="topbar">' +
      '<div class="brand"><i></i>宿舍水电费</div>' +
      '<details class="roleswitch">' +
      '<summary>演示：<b>' + cur.short + '</b> ' + ui.icon('chev', 12) + '</summary>' +
      '<div class="menu">' +
      '<div class="menu-t">切换角色（数据不变，视角变化）</div>' + items +
      '<div class="menu-sep"></div>' +
      '<button data-act="open-install">' + ui.icon('down', 14) + ' 安装到手机桌面</button>' +
      '<button data-act="export">' + ui.icon('download', 14) + ' 导出备份</button>' +
      '<button data-act="import">' + ui.icon('upload', 14) + ' 导入备份</button>' +
      '<button data-act="reset" class="danger">' + ui.icon('reset', 14) + ' 重置演示数据</button>' +
      '</div></details>' +
      '</div>';
  };

  ui.tabbar = function (items) {
    return '<nav class="tabbar">' + items.map(function (it) {
      return '<button class="tab ' + (it.active ? 'on' : '') + '" data-act="' + it.act + '">' +
        '<span class="tab-ic">' + ui.icon(it.icon, 19) + '</span>' + it.label + '</button>';
    }).join('') + '</nav>';
  };

  ui.hdr = function (o) {
    return '<header class="nav">' +
      (o.back ? '<button class="back" data-act="' + o.back + '">' + ui.icon('back', 17) + '</button>' : '') +
      '<div class="nav-mid"><h1>' + o.title + '</h1>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div>' +
      (o.right ? '<div class="nav-right">' + o.right + '</div>' : '') +
      '</header>';
  };

  /* ---------- 需要 DOM 的（浏览器内才生效） ---------- */
  ui.toast = function (msg, ms) {
    if (typeof document === 'undefined') return;
    var d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, (ms || 1600));
    setTimeout(function () { d.remove(); }, (ms || 1600) + 300);
  };

  App.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);

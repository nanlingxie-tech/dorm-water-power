/* 宿舍水电费管理 · 工具库
 * 运行环境无关：浏览器挂到 window.App，Node 测试挂到 globalThis.App
 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = {};

  /* ---------- 数字与金额 ---------- */
  // 用量统一保留 1 位小数（消除 1301.2-1234.5 的浮点尾巴）
  /* 搜索命中：q 为空返回 true；否则在若干字段里做不区分大小写的包含匹配 */
U.hit = function (q, parts) {
  if (!q) return true;
  var needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  var hay = (parts || []).map(function (x) { return x == null ? '' : String(x); })
    .join(' ').toLowerCase();
  return hay.indexOf(needle) > -1;
};

U.round1 = function (n) {
    return Math.round((Number(n) || 0) * 10) / 10;
  };

  // 金额以「分」为单位的整数计算，避免浮点误差
  // usageTenths: 用量 × 10 的整数；priceCents: 每度/每吨的分数（如 0.65 元 => 65）
  U.amountOf = function (usageTenths, priceCents) {
    var t = Math.round(Number(usageTenths) || 0);
    var p = Math.round(Number(priceCents) || 0);
    return Math.round((t * p) / 10);
  };

  // 账单：usageE/usageW 为「度/吨」（1 位小数），priceE/priceW 为「分」
  U.calcBill = function (usageE, usageW, priceE, priceW) {
    var amountE = U.amountOf(U.round1(usageE) * 10, priceE);
    var amountW = U.amountOf(U.round1(usageW) * 10, priceW);
    return { amountE: amountE, amountW: amountW, total: amountE + amountW };
  };

  U.fmtMoney = function (cents) {
    return ((Number(cents) || 0) / 100).toFixed(2);
  };
  U.fmtYuan = function (cents) {
    return '¥' + U.fmtMoney(cents);
  };
  U.fmtUsage = function (n) {
    return (U.round1(n)).toFixed(1);
  };
  U.pct = function (a, b) {
    if (!b) return 0;
    return Math.min(100, Math.round((a / b) * 100));
  };

  /* ---------- 读数校验 ---------- */
  /**
   * @param {Object} o
   *   prevReading   上期读数
   *   reading       本期读数
   *   lastUsage     上月用量
   *   hasPhoto      是否已拍照
   *   duplicate     30 分钟内重复提交
   *   unit          '度' | '吨'
   * @return {block:boolean, warnings:[{code,level,msg}], usage:number}
   */
  U.validate = function (o) {
    o = o || {};
    var unit = o.unit || '度';
    var warnings = [];
    var block = false;
    var readingRaw = o.reading;
    var reading = Number(readingRaw);
    var prev = Number(o.prevReading) || 0;

    function add(code, level, msg) {
      warnings.push({ code: code, level: level, msg: msg });
      if (level === 'block') block = true;
    }

    if (readingRaw === '' || readingRaw === null || readingRaw === undefined || isNaN(reading)) {
      add('V1', 'block', '请填写本期读数');
      return { block: block, warnings: warnings, usage: 0 };
    }
    if (reading < prev) {
      add('V2', 'block', '本期读数 ' + reading + ' 小于上期 ' + prev + '，读数不会倒退，请核对表盘或重拍');
    }
    var usage = U.round1(reading - prev);
    if (!block && usage === 0) {
      add('V3', 'warn', '本期用量为 0，确认本月未使用？');
    }
    if (!block && o.lastUsage > 0 && usage > o.lastUsage * 2) {
      var up = Math.round((usage / o.lastUsage - 1) * 100);
      add('V4', 'warn', '用量比上月高 ' + up + '%，请核对表盘照片');
    }
    if (!block) {
      var dCur = String(Math.trunc(Math.abs(reading))).length;
      var dPrev = String(Math.trunc(Math.abs(prev))).length;
      var dDiff = Math.abs(dCur - dPrev);
      var ratio = prev > 0 ? reading / prev : 0;
      // 位数差≥2 一律预警；位数差 1 仅当数量级跳变（≥8 倍）才预警，避免把 999→1000 的正常进位误判
      if (dDiff >= 2 || (dDiff >= 1 && ratio >= 8)) {
        add('V5', 'warn', '读数位数异常，请确认是否多输/少输了一位');
      }
    }
    if (!o.hasPhoto) {
      add('V6', 'block', '请先拍摄表盘照片');
    }
    if (o.duplicate) {
      add('V7', 'warn', '疑似重复提交，请确认是否已抄过');
    }
    // 加上"电表/水表"前缀，避免只看到"用量比上月高 234%"却不知道是哪块表
    if (o.label) {
      warnings = warnings.map(function (w) {
        return { code: w.code, level: w.level, msg: o.label + '：' + w.msg };
      });
    }
    return { block: block, warnings: warnings, usage: usage };
  };

  U.needNote = function (warnings) {
    return (warnings || []).some(function (w) { return w.level === 'warn'; });
  };

  /* ---------- 日期 ---------- */
  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  U.nowISO = function (d) {
    d = d || new Date();
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    var abs = Math.abs(off);
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate()) +
      'T' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes()) + ':' + U.pad2(d.getSeconds()) +
      sign + U.pad2(Math.floor(abs / 60)) + ':' + U.pad2(abs % 60);
  };

  U.fmtDT = function (iso) {
    if (!iso) return '';
    return String(iso).replace('T', ' ').slice(0, 16);
  };
  U.fmtD = function (iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  };

  // 账期：2026-11 => { start:'2026-10-25', end:'2026-11-24' }
  U.periodRange = function (period, day) {
    day = day || 25;
    var y = +period.slice(0, 4), m = +period.slice(5, 7);
    var startY = m === 1 ? y - 1 : y, startM = m === 1 ? 12 : m - 1;
    var lastDay = new Date(y, m, 0).getDate();
    var startDay = Math.min(day, lastDay);
    var endDate = new Date(y, m - 1, startDay - 1);
    return {
      start: startY + '-' + U.pad2(startM) + '-' + U.pad2(startDay),
      end: U.fmtD(U.nowISO(endDate)).slice(0, 10)
    };
  };

  U.periodLabel = function (period) {
    var r = U.periodRange(period);
    return period.slice(0, 4) + '年' + (+period.slice(5, 7)) + '月（' + r.start + ' 至 ' + r.end + '）';
  };

  U.addDays = function (iso, days) {
    var d = new Date(iso);
    d.setDate(d.getDate() + days);
    return U.nowISO(d);
  };

  U.daysLeft = function (iso, from) {
    var a = new Date(iso).getTime(), b = (from ? new Date(from) : new Date()).getTime();
    return Math.ceil((a - b) / 86400000);
  };

  /* ---------- 其它 ---------- */
  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.clone = function (o) {
    return JSON.parse(JSON.stringify(o));
  };

  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  };

  U.sum = function (arr, key) {
    return (arr || []).reduce(function (a, b) { return a + (+b[key] || 0); }, 0);
  };

  U.groupBy = function (arr, key) {
    var out = {};
    (arr || []).forEach(function (x) {
      var k = typeof key === 'function' ? key(x) : x[key];
      (out[k] || (out[k] = [])).push(x);
    });
    return out;
  };

  // 确定性伪随机（让演示数据每次重置都一致）
  U.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.pick = function (rand, arr) {
    return arr[Math.floor(rand() * arr.length) % arr.length];
  };
  U.rint = function (rand, min, max) {
    return min + Math.floor(rand() * (max - min + 1));
  };

  /* ---------- CSV ---------- */
  U.toCSV = function (rows) {
    return '\uFEFF' + rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  };

  U.download = function (filename, content, mime) {
    if (typeof document === 'undefined') return false;
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 300);
    return true;
  };

  App.util = U;
})(typeof window !== 'undefined' ? window : globalThis);

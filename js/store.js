/* 存储层：负责「持久化 + 导入导出 + 重置」，不含业务规则 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var PREFIX = 'dwp.';
  var KEYS = ['meta', 'buildings', 'rooms', 'employees', 'prices', 'priceRequests', 'roomRequests', 'exports', 'readings', 'bills', 'disputes', 'audit', 'drafts', 'session'];
  var SCHEMA = 3;

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      clear: function () { m = {}; },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }

  function detectStorage() {
    try {
      if (root.localStorage) {
        root.localStorage.setItem('dwp.__probe', '1');
        root.localStorage.removeItem('dwp.__probe');
        return { storage: root.localStorage, degraded: false };
      }
    } catch (e) { /* 无痕模式 / 禁用 */ }
    return { storage: memoryStorage(), degraded: true };
  }

  var S = {
    data: null,
    schemaVersion: SCHEMA,
    degraded: false,
    warning: '',
    _storage: null,
    _listeners: [],

    init: function (opts) {
      opts = opts || {};
      if (opts.storage) {
        this._storage = opts.storage;
        this.degraded = !!opts.degraded;
      } else {
        var d = detectStorage();
        this._storage = d.storage;
        this.degraded = d.degraded;
      }
      var meta = this._read('meta');
      if (!meta) {
        this.reset();
      } else {
        this._load();
      }
      return this;
    },

    onChange: function (fn) { this._listeners.push(fn); },
    _emit: function (type) {
      var self = this;
      this._listeners.forEach(function (f) { try { f(type, self.data); } catch (e) { /* ignore */ } });
    },

    _read: function (key) {
      try {
        var raw = this._storage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return '__corrupt__'; }
    },

    _load: function () {
      var d = {}, corrupt = false;
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        var v = this._read(k);
        if (v === '__corrupt__') { corrupt = true; break; }
        d[k] = v;
      }
      if (corrupt || !d.meta || !d.rooms || !d.rooms.length) {
        this.reset();
        this.warning = '检测到本地数据异常，已重置为演示数据';
        return;
      }
      if (!d.drafts) d.drafts = {};
      if (!d.priceRequests) d.priceRequests = [];
      if (!d.roomRequests) d.roomRequests = [];
      if (!d.exports) d.exports = [];
      // 版本迁移
      var ver = +((d.meta && d.meta.schemaVersion) || 0);
      if (!ver || ver < SCHEMA) {
        d = this._migrate(d, ver || 1);
        d.meta.schemaVersion = SCHEMA;
        this.data = d;
        this._persist();
      } else {
        this.data = d;
      }
    },

    /**
     * v1 → v2：楼栋从「房间上的一串名称」抽成独立 buildings 表，
     * 房间的 bld 改为楼栋编号。旧备份导入时同样走这里。
     */
    _migrate: function (d, fromVer) {
      d = d || {};
      if ((fromVer || 1) < 2) {
        var names = [];
        (d.rooms || []).forEach(function (r) {
          if (r && r.bld && names.indexOf(r.bld) === -1) names.push(r.bld);
        });
        if (!d.buildings || !d.buildings.length) {
          d.buildings = names.map(function (n, i) {
            return { code: String.fromCharCode(65 + i), name: n, floors: 6, perFloor: 10 };
          });
        }
        var byName = {};
        d.buildings.forEach(function (b) { byName[b.name] = b.code; });
        (d.rooms || []).forEach(function (r) {
          if (r && byName[r.bld]) r.bld = byName[r.bld];
        });
      }
      // v2 → v3：单价从「全局一条」展开为「每个楼栋一条」
      if ((fromVer || 1) < 3) {
        var codes = (d.buildings || []).map(function (b) { return b.code; });
        var out = [];
        (d.prices || []).forEach(function (p) {
          if (p.building) { out.push(p); return; }
          if (!codes.length) { p.building = '*'; out.push(p); return; }
          codes.forEach(function (c) {
            out.push({
              period: p.period, building: c,
              electricity: p.electricity, water: p.water,
              note: p.note || '', createdAt: p.createdAt || ''
            });
          });
        });
        d.prices = out;
        d.priceRequests = d.priceRequests || [];
      }
      return d;
    },

    _persist: function () {
      if (!this.data) return false;
      for (var i = 0; i < KEYS.length; i++) {
        var k = KEYS[i];
        try {
          this._storage.setItem(PREFIX + k, JSON.stringify(this.data[k] == null ? null : this.data[k]));
        } catch (e) {
          this.warning = '本地存储空间不足，请导出备份后重置';
          return false;
        }
      }
      return true;
    },

    commit: function () {
      var ok = this._persist();
      this._emit('change');
      return ok;
    },

    /** 只落盘一个集合（草稿每次输入都要写，避免整包重写） */
    commitKey: function (key) {
      if (!this.data) return false;
      try {
        this._storage.setItem(PREFIX + key, JSON.stringify(this.data[key] == null ? null : this.data[key]));
        return true;
      } catch (e) {
        this.warning = '本地存储空间不足，草稿可能未保存';
        return false;
      }
    },

    get: function (key) { return this.data ? this.data[key] : null; },

    reset: function () {
      this.data = App.seed.build();
      this.warning = '';
      this._persist();
      this._emit('reset');
      return this.data;
    },

    clear: function () {
      KEYS.forEach(function (k) { try { this._storage.removeItem(PREFIX + k); } catch (e) { } }, this);
    },

    /* ---------- 导出 / 导入 ---------- */
    exportAll: function (photos) {
      return {
        app: 'dorm-water-power',
        schemaVersion: SCHEMA,
        exportedAt: App.util.nowISO(),
        data: App.util.clone(this.data),
        photos: photos || []
      };
    },

    exportFilename: function () {
      var d = new Date();
      return '宿舍水电费_备份_' + d.getFullYear() + App.util.pad2(d.getMonth() + 1) + App.util.pad2(d.getDate()) +
        '_' + App.util.pad2(d.getHours()) + App.util.pad2(d.getMinutes()) + '.json';
    },

    /**
     * 导入校验：任何一项不通过都整体拒绝，不做"尽量恢复"
     * @returns {{ok:boolean, msg:string}}
     */
    validateImport: function (obj) {
      if (!obj || typeof obj !== 'object') return { ok: false, msg: '文件内容不是有效的 JSON 对象' };
      if (obj.app && obj.app !== 'dorm-water-power') return { ok: false, msg: '不是本系统的备份文件' };
      var ver = +obj.schemaVersion;
      if (ver && ver > SCHEMA) return { ok: false, msg: '备份来自更新版本（v' + ver + '），请升级后再导入' };
      var d = obj.data;
      if (!d || !d.meta || !d.rooms || !d.employees || !d.prices || !d.readings || !d.bills) {
        return { ok: false, msg: '备份缺少必需的数据集合' };
      }
      if (!Array.isArray(d.rooms) || !Array.isArray(d.readings) || !Array.isArray(d.bills)) {
        return { ok: false, msg: '备份数据结构不正确' };
      }
      var roomIds = {};
      d.rooms.forEach(function (r) { roomIds[r.id] = 1; });
      for (var i = 0; i < d.readings.length; i++) {
        var rd = d.readings[i];
        if (!rd || !rd.roomId) return { ok: false, msg: '第 ' + (i + 1) + ' 条抄表记录缺少 roomId' };
        if (!roomIds[rd.roomId]) return { ok: false, msg: '抄表记录引用了不存在的房间：' + rd.roomId };
      }
      var billIds = {};
      d.bills.forEach(function (b) { billIds[b.id] = 1; });
      (d.disputes || []).forEach(function (x, i) {
        if (x.billId && !billIds[x.billId]) {
          throw { __msg: '第 ' + (i + 1) + ' 条申诉引用了不存在的账单' };
        }
      });
      return { ok: true, msg: '校验通过' };
    },

    importAll: function (obj) {
      var check;
      try {
        check = this.validateImport(obj);
      } catch (e) {
        return { ok: false, msg: e.__msg || '备份文件校验失败' };
      }
      if (!check.ok) return check;
      var d = App.util.clone(obj.data);
      d = this._migrate(d, +obj.schemaVersion || 1);
      d.meta = d.meta || {};
      d.meta.schemaVersion = SCHEMA;
      KEYS.forEach(function (k) {
        if (d[k] === undefined) d[k] = (k === 'audit' || k === 'disputes') ? [] : null;
      });
      this.data = d;
      this._persist();
      this._emit('import');
      return { ok: true, msg: '导入成功' };
    },

    storageBytes: function () {
      var total = 0;
      for (var i = 0; i < KEYS.length; i++) {
        try {
          var raw = this._storage.getItem(PREFIX + KEYS[i]);
          total += raw ? raw.length : 0;
        } catch (e) { }
      }
      return total;
    }
  };

  App.store = S;
})(typeof window !== 'undefined' ? window : globalThis);

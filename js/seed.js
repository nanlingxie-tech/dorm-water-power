/* 演示数据生成器：确定性（固定种子），每次重置结果完全一致 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var SEED = 20261125;
  var PERIOD_NOW = '2026-11';
  var PERIOD_PREV = '2026-10';
  var PERIOD_PREV2 = '2026-09';

  var SURNAME = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤'.split('');
  var GIVEN = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '文', '辉', '玲', '建华', '春梅', '鹏', '丽', '斌', '红梅', '晓明', '雪', '建国', '海燕', '志强', '玉兰'];
  var DEPTS = ['制造一部', '制造二部', '品质部', '仓储部', '设备部', '行政部', '工程部', '物流部'];
  var BLD = [
    { code: 'A', name: '翔宁大厦' },
    { code: 'B', name: '安宜居A栋' },
    { code: 'C', name: '安宜居B栋' },
    { code: 'D', name: '迎笑楼A栋' },
    { code: 'E', name: '迎笑楼C栋' },
    { code: 'F', name: '安力科技园D26栋' }
  ];
  var FLOORS = 6;
  var PER_FLOOR = 10;

  function buildBuildings() {
    return BLD.map(function (b) {
      return { code: b.code, name: b.name, floors: FLOORS, perFloor: PER_FLOOR };
    });
  }

  // 锚点员工（演示必须复现）
  var ANCHOR = {
    'A-302': { name: '张伟', empId: 'V20231187', dept: '制造一部' },
    'A-303': { name: '李娜', empId: 'V20220845', dept: '品质部' },
    'A-304': { name: '王强', empId: 'V20231102', dept: '制造二部' },
    'A-305': { name: '赵敏', empId: 'V20210455', dept: '仓储部' },
    'A-306': { name: '陈杰', empId: 'V20231201', dept: '设备部' },
    'A-307': { name: '刘洋', empId: 'V20220977', dept: '制造一部' },
    'A-308': { name: '孙丽', empId: 'V20211008', dept: '行政部' }
  };

  // 已抄 / 待复核 / 异常 的确定性分配
  var APPROVED = 94;
  var PENDING = 34;
  var EXCEPTION = 7;

  function readingId(period, roomId, type) {
    return period + '-' + roomId + '-' + type;
  }

  function build() {
    var rand = U.rng(SEED);
    var rooms = [], employees = [], readings = [], bills = [];
    var occupied = [];

    // 1) 房间（bld 存楼栋编号，名称另存于 buildings，改名不影响房间数据）
    BLD.forEach(function (bb) {
      var b = bb.code;
      for (var floor = 1; floor <= FLOORS; floor++) {
        for (var idx = 1; idx <= PER_FLOOR; idx++) {
          var id = b + '-' + floor + (idx < 10 ? '0' + idx : String(idx));
          rooms.push({
            id: id,
            bld: b,
            floor: floor,
            status: 'occupied',
            employeeId: '',
            meterE: { no: 'E-' + b + floor + (idx < 10 ? '0' + idx : idx), init: 0 },
            meterW: { no: 'W-' + b + floor + (idx < 10 ? '0' + idx : idx), init: 0 }
          });
        }
      }
    });

    // 2) 空置房（E 栋最后 8 间）
    rooms.slice(-8).forEach(function (r) { r.status = 'vacant'; });

    // 3) 员工（每个在住房一人）
    var usedNames = {};
    rooms.forEach(function (r, i) {
      if (r.status !== 'occupied') return;
      var anchor = ANCHOR[r.id];
      var name, empId;
      if (anchor) {
        name = anchor.name;
        empId = anchor.empId;
      } else {
        var n = '';
        var guard = 0;
        do {
          n = U.pick(rand, SURNAME) + U.pick(rand, GIVEN);
          guard++;
        } while (usedNames[n] && guard < 50);
        name = n;
        empId = 'V' + (20000000 + i * 137 + 11);
      }
      usedNames[name] = 1;
      var emp = {
        id: empId,
        name: name,
        dept: anchor ? anchor.dept : U.pick(rand, DEPTS),
        phone: '138' + String(10000000 + U.rint(rand, 0, 89999999)).slice(0, 8),
        roomId: r.id,
        status: 'active'
      };
      r.employeeId = empId;
      employees.push(emp);
      occupied.push(r);
    });

    // 4) 历史两期读数 + 账单（全部已代扣）
    var initE = {}, initW = {};
    occupied.forEach(function (r) {
      var baseE = U.rint(rand, 600, 2200) + U.rint(rand, 0, 9) / 10;
      var baseW = U.rint(rand, 30, 130) + U.rint(rand, 0, 9) / 10;
      r.meterE.init = baseE;
      r.meterW.init = baseW;
    });

    // A-302 的历史必须精确：10 月读数 1234.5 / 88.0，上月用量 21.5 度 / 3.9 吨
    var a302 = rooms.filter(function (r) { return r.id === 'A-302'; })[0];
    a302.meterE.init = 1190.0;
    a302.meterW.init = 80.6;
    var HIST_A302 = {
      '2026-09': { e0: 1190.0, e1: 1213.0, w0: 80.6, w1: 84.1 },
      '2026-10': { e0: 1213.0, e1: 1234.5, w0: 84.1, w1: 88.0 }
    };

    // 生成 2026-09 / 2026-10
    [PERIOD_PREV2, PERIOD_PREV].forEach(function (period) {
      occupied.forEach(function (r) {
        var isA302 = r.id === 'A-302';
        var e0, e1, w0, w1;
        if (isA302) {
          var h = HIST_A302[period];
          e0 = h.e0; e1 = h.e1; w0 = h.w0; w1 = h.w1;
        } else {
          var prevE = r.meterE.init, prevW = r.meterW.init;
          // 用已生成的上一期读数作为本期起点
          var lastE = findLastReading(readings, period, r.id, 'e', prevE);
          var lastW = findLastReading(readings, period, r.id, 'w', prevW);
          e0 = lastE; w0 = lastW;
          e1 = U.round1(e0 + U.rint(rand, 120, 300) / 10);
          w1 = U.round1(w0 + U.rint(rand, 20, 50) / 10);
        }
        var uE = U.round1(e1 - e0), uW = U.round1(w1 - w0);
        readings.push({
          id: readingId(period, r.id, 'e'), period: period, roomId: r.id, meterType: 'e',
          prevReading: e0, reading: e1, usage: uE, photoId: 'ph_' + period + '_' + r.id + '_e',
          shotAt: period + '-25T10:' + U.pad2(U.rint(rand, 10, 59)) + ':00+08:00',
          operator: '李强', status: 'approved', exceptionReason: '', note: '', warnings: [], edits: [],
          lastUsage: uE
        });
        readings.push({
          id: readingId(period, r.id, 'w'), period: period, roomId: r.id, meterType: 'w',
          prevReading: w0, reading: w1, usage: uW, photoId: 'ph_' + period + '_' + r.id + '_w',
          shotAt: period + '-25T10:' + U.pad2(U.rint(rand, 10, 59)) + ':00+08:00',
          operator: '李强', status: 'approved', exceptionReason: '', note: '', warnings: [], edits: [],
          lastUsage: uW
        });
      });

      var price = period === PERIOD_PREV2 ? { e: 62, w: 345 } : { e: 62, w: 350 };
      occupied.forEach(function (r) {
        var re = findReading(readings, period, r.id, 'e');
        var rw = findReading(readings, period, r.id, 'w');
        var amt = U.calcBill(re.usage, rw.usage, price.e, price.w);
        bills.push({
          id: 'B-' + period + '-' + r.id, period: period, roomId: r.id, employeeId: r.employeeId,
          usageE: re.usage, usageW: rw.usage, priceE: price.e, priceW: price.w,
          amountE: amt.amountE, amountW: amt.amountW, total: amt.total,
          status: 'deducted', generatedAt: period + '-29T09:00:00+08:00',
          publicEndAt: period + '-29T09:00:00+08:00', deductedAt: shiftMonth(period) + '-10T08:00:00+08:00'
        });
      });
    });

    // 5) 本期（2026-11）抄表进度
    var pool = occupied.filter(function (r) { return ['A-302', 'A-304', 'A-305'].indexOf(r.id) === -1; });
    var shuffled = shuffle(pool, rand);

    // 分配：94 已复核 + 34 待复核（含 A-304）+ 7 异常（含 A-305），其余待抄（含 A-302）
    var cursor = 0;
    var approvedRooms = shuffled.slice(cursor, cursor + APPROVED);
    cursor += APPROVED;
    var pendingRooms = shuffled.slice(cursor, cursor + (PENDING - 1)).concat(
      rooms.filter(function (r) { return r.id === 'A-304'; })
    );
    cursor += (PENDING - 1);
    var exceptionRooms = shuffled.slice(cursor, cursor + (EXCEPTION - 1)).concat(
      rooms.filter(function (r) { return r.id === 'A-305'; })
    );

    approvedRooms.concat(pendingRooms).forEach(function (r) {
      var prevE = lastUsageOf(readings, r.id, 'e');
      var prevW = lastUsageOf(readings, r.id, 'w');
      var last = readPrev(readings, r.id);
      var e1 = U.round1(last.e + prevE * (0.9 + rand() * 0.2));
      var w1 = U.round1(last.w + prevW * (0.9 + rand() * 0.2));
      if (r.id === 'A-304') { last.e = 1560.8; last.w = 102.3; e1 = 1585.9; w1 = 106.4; prevE = 25.1; prevW = 4.1; }
      var status = pendingRooms.indexOf(r) >= 0 ? 'pending' : 'approved';
      readings.push({
        id: readingId(PERIOD_NOW, r.id, 'e'), period: PERIOD_NOW, roomId: r.id, meterType: 'e',
        prevReading: U.round1(last.e), reading: e1, usage: U.round1(e1 - last.e),
        photoId: 'ph_' + PERIOD_NOW + '_' + r.id + '_e',
        shotAt: PERIOD_NOW + '-25T14:' + U.pad2(U.rint(rand, 10, 59)) + ':00+08:00',
        operator: '李强', status: status, exceptionReason: '', note: '',
        warnings: [], edits: [], lastUsage: prevE
      });
      readings.push({
        id: readingId(PERIOD_NOW, r.id, 'w'), period: PERIOD_NOW, roomId: r.id, meterType: 'w',
        prevReading: U.round1(last.w), reading: w1, usage: U.round1(w1 - last.w),
        photoId: 'ph_' + PERIOD_NOW + '_' + r.id + '_w',
        shotAt: PERIOD_NOW + '-25T14:' + U.pad2(U.rint(rand, 10, 59)) + ':00+08:00',
        operator: '李强', status: status, exceptionReason: '', note: '',
        warnings: [], edits: [], lastUsage: prevW
      });
    });

    exceptionRooms.forEach(function (r) {
      readings.push({
        id: readingId(PERIOD_NOW, r.id, 'x'), period: PERIOD_NOW, roomId: r.id, meterType: 'both',
        prevReading: 0, reading: null, usage: 0, photoId: 'ph_exc_' + r.id,
        shotAt: PERIOD_NOW + '-25T15:05:00+08:00', operator: '李强',
        status: 'exception', exceptionReason: r.id === 'A-305' ? '表盘看不清' : '住户不在家',
        note: '', warnings: [], edits: [], lastUsage: 0
      });
    });

    // 6) 单价：按「账期 + 楼栋」分别设置
    var PRICE_SEED = [
      { period: PERIOD_PREV2, e: 62, w: 345, note: '9月价' },
      { period: PERIOD_PREV, e: 62, w: 350, note: '水价上调' },
      { period: PERIOD_NOW, e: 65, w: 350, note: '电价上调' }
    ];
    var prices = [];
    PRICE_SEED.forEach(function (x) {
      BLD.forEach(function (bb) {
        var code = bb.code;
        prices.push({
          period: x.period, building: code,
          electricity: x.e, water: x.w, note: x.note,
          createdAt: x.period + '-01T00:00:00+08:00'
        });
      });
    });

    var meta = {
      schemaVersion: 3,
      appName: '宿舍水电费管理',
      currentPeriod: PERIOD_NOW,
      periodStart: '2026-10-25',
      periodEnd: '2026-11-24',
      publicityDays: 3,
      demo: true,
      generatedAt: PERIOD_NOW + '-01T00:00:00+08:00',
      operator: '李强'
    };

    return {
      meta: meta,
      buildings: buildBuildings(),
      rooms: rooms,
      employees: employees,
      prices: prices,
      priceRequests: [],
      roomRequests: [],
      readings: readings,
      bills: bills,
      disputes: [],
      audit: [],
      drafts: {},
      session: { role: 'guard', period: PERIOD_NOW, employeeId: 'V20231187', page: 'task' }
    };
  }

  /* ---------- 内部工具 ---------- */
  // Fisher-Yates：跨引擎结果一致（不用 sort 比较器）
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function findReading(list, period, roomId, type) {
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.period === period && x.roomId === roomId && x.meterType === type) return x;
    }
    return null;
  }
  function findLastReading(list, period, roomId, type, fallback) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.roomId === roomId && x.meterType === type && x.period < period) {
        if (idx === -1 || x.period > list[idx].period) idx = i;
      }
    }
    return idx === -1 ? fallback : list[idx].reading;
  }
  function readPrev(list, roomId) {
    var e = 0, w = 0;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.roomId === roomId && x.period === PERIOD_PREV) {
        if (x.meterType === 'e') e = x.reading;
        if (x.meterType === 'w') w = x.reading;
      }
    }
    return { e: e, w: w };
  }
  function lastUsageOf(list, roomId, type) {
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.roomId === roomId && x.period === PERIOD_PREV && x.meterType === type) return x.usage;
    }
    return 0;
  }
  function shiftMonth(period) {
    var y = +period.slice(0, 4), m = +period.slice(5, 7);
    m++;
    if (m > 12) { m = 1; y++; }
    return y + '-' + U.pad2(m);
  }

  App.seed = {
    build: build,
    PERIODS: [PERIOD_PREV2, PERIOD_PREV, PERIOD_NOW],
    CURRENT: PERIOD_NOW,
    ANCHOR: ANCHOR
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* 业务规则层：抄表、复核、出账、确认、申诉、代扣 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;

  function D() { return App.store.data; }
  function now() { return U.nowISO(); }
  function actorName(a) { return a || (D().session && D().session.operator) || '系统'; }

  function audit(action, target, before, after, reason, actor) {
    var d = D();
    if (!d.audit) d.audit = [];
    d.audit.push({
      at: now(), actor: actorName(actor), action: action, target: target,
      before: before == null ? '' : String(before), after: after == null ? '' : String(after),
      reason: reason || ''
    });
    if (d.audit.length > 2000) d.audit.splice(0, d.audit.length - 2000);
  }

  var DOM = {
    /* ---------------- 查询 ---------------- */
    period: function () { return D().meta.currentPeriod; },

    /** 系统里出现过的所有账期，倒序（最新在前） */
    periods: function () {
      var set = {};
      (D().prices || []).forEach(function (p) { if (p.period) set[p.period] = 1; });
      (D().bills || []).forEach(function (b) { if (b.period) set[b.period] = 1; });
      (D().readings || []).forEach(function (r) { if (r.period) set[r.period] = 1; });
      return Object.keys(set).sort().reverse();
    },

    roomOf: function (id) {
      return D().rooms.filter(function (r) { return r.id === id; })[0] || null;
    },
    employeeOf: function (roomId) {
      return D().employees.filter(function (e) { return e.roomId === roomId; })[0] || null;
    },
    employeeById: function (id) {
      return D().employees.filter(function (e) { return e.id === id; })[0] || null;
    },
    occupiedRooms: function () {
      return D().rooms.filter(function (r) { return r.status === 'occupied'; });
    },
    priceOf: function (period, building) {
      period = period || DOM.period();
      var list = D().prices || [];
      var i;
      if (building) {
        for (i = 0; i < list.length; i++) {
          if (list[i].period === period && list[i].building === building) return list[i];
        }
      }
      for (i = 0; i < list.length; i++) {
        if (list[i].period === period && (!list[i].building || list[i].building === '*')) return list[i];
      }
      return null;
    },
    readingsOf: function (period, roomId) {
      return D().readings.filter(function (r) { return r.period === period && r.roomId === roomId; });
    },
    readingOne: function (period, roomId, type) {
      return D().readings.filter(function (r) {
        return r.period === period && r.roomId === roomId && r.meterType === type;
      })[0] || null;
    },
    billOf: function (period, roomId) {
      return D().bills.filter(function (b) { return b.period === period && b.roomId === roomId; })[0] || null;
    },
    billById: function (id) {
      return D().bills.filter(function (b) { return b.id === id; })[0] || null;
    },
    billsOf: function (period) {
      return D().bills.filter(function (b) { return b.period === period; });
    },
    disputesOf: function (period) {
      var ids = {};
      DOM.billsOf(period).forEach(function (b) { ids[b.id] = 1; });
      return D().disputes.filter(function (x) { return ids[x.billId]; });
    },
    openDisputeOf: function (billId) {
      return D().disputes.filter(function (x) { return x.billId === billId && x.status === 'open'; })[0] || null;
    },

    // 该房间该表上一期的读数与用量
    prevOf: function (period, roomId, type) {
      var best = null;
      D().readings.forEach(function (r) {
        if (r.roomId === roomId && r.meterType === type && r.period < period && r.reading != null) {
          if (!best || r.period > best.period) best = r;
        }
      });
      return best ? { reading: best.reading, usage: best.usage } : { reading: 0, usage: 0 };
    },

    /* ---------------- 统计 ---------------- */
    roomState: function (roomId, period) {
      period = period || DOM.period();
      var exc = D().readings.filter(function (r) {
        return r.period === period && r.roomId === roomId && r.status === 'exception';
      })[0];
      if (exc) return 'exception';
      var e = DOM.readingOne(period, roomId, 'e');
      var w = DOM.readingOne(period, roomId, 'w');
      if (!e || !w) return 'todo';
      if (e.status === 'approved' && w.status === 'approved') return 'approved';
      if (e.status === 'rejected' || w.status === 'rejected') return 'rejected';
      return 'pending';
    },

    stats: function (period) {
      period = period || DOM.period();
      var rooms = DOM.occupiedRooms();
      var s = { total: rooms.length, done: 0, approved: 0, pending: 0, exception: 0, rejected: 0, todo: 0, pct: 0 };
      rooms.forEach(function (r) {
        var st = DOM.roomState(r.id, period);
        if (st === 'approved') { s.approved++; s.done++; }
        else if (st === 'pending') { s.pending++; s.done++; }
        else if (st === 'exception') { s.exception++; }
        else if (st === 'rejected') { s.rejected++; }
        else { s.todo++; }
      });
      s.pct = U.pct(s.done, s.total);
      var bills = DOM.billsOf(period);
      s.bills = bills.length;
      s.billTotal = U.sum(bills, 'total');
      s.confirmed = bills.filter(function (b) { return b.status === 'confirmed'; }).length;
      s.disputed = bills.filter(function (b) { return b.status === 'disputed'; }).length;
      s.public = bills.filter(function (b) { return b.status === 'public'; }).length;
      s.deducted = bills.filter(function (b) { return b.status === 'deducted'; }).length;
      return s;
    },

    buildings: function (period) {
      period = period || DOM.period();
      var list = DOM.buildingList();
      var map = {};
      list.forEach(function (b) { map[b.code] = { code: b.code, name: b.name, total: 0, done: 0, exception: 0 }; });
      D().rooms.forEach(function (r) {
        if (r.status !== 'occupied') return;
        var b = map[r.bld] || (map[r.bld] = { code: r.bld, name: DOM.buildingName(r.bld), total: 0, done: 0, exception: 0 });
        b.total++;
        var st = DOM.roomState(r.id, period);
        if (st === 'approved' || st === 'pending') b.done++;
        if (st === 'exception') b.exception++;
      });
      return list.map(function (x) {
        var b = map[x.code];
        b.pct = U.pct(b.done, b.total);
        return b;
      });
    },

    /* ---------------- 楼栋维护 ---------------- */
    buildingList: function () { return D().buildings || []; },

    buildingOf: function (code) {
      return DOM.buildingList().filter(function (b) { return b.code === code; })[0] || null;
    },

    buildingName: function (code) {
      var b = DOM.buildingOf(code);
      return b ? b.name : code;
    },

    roomCountOf: function (code) {
      return D().rooms.filter(function (r) { return r.bld === code; }).length;
    },

    occupiedCountOf: function (code) {
      return D().rooms.filter(function (r) { return r.bld === code && r.status === 'occupied'; }).length;
    },

    /** 改楼栋名称（房间数据用编号关联，改名不影响抄表与账单） */
    renameBuilding: function (code, newName, actor) {
      var b = DOM.buildingOf(code);
      if (!b) return { ok: false, msg: '楼栋不存在' };
      var name = String(newName || '').trim();
      if (!name) return { ok: false, msg: '楼栋名称不能为空' };
      if (name.length > 20) return { ok: false, msg: '楼栋名称不能超过 20 个字' };
      var dup = DOM.buildingList().filter(function (x) {
        return x.code !== code && x.name === name;
      })[0];
      if (dup) return { ok: false, msg: '已存在同名楼栋：' + name };
      var old = b.name;
      if (old === name) return { ok: true, msg: '名称未变化' };
      b.name = name;
      audit('building.rename', code, old, name, '', actor);
      App.store.commit();
      return { ok: true, msg: '楼栋名称已改为「' + name + '」', before: old, after: name };
    },

    /**
     * 调整楼栋规模（楼层数 / 每层房间数）。
     * 缩小时若涉及在住或已有数据的房间，整体拒绝，不做半截修改。
     */
    setBuildingSize: function (code, floors, perFloor, actor) {
      var b = DOM.buildingOf(code);
      if (!b) return { ok: false, msg: '楼栋不存在' };
      floors = Math.round(Number(floors));
      perFloor = Math.round(Number(perFloor));
      if (!(floors >= 1 && floors <= 30)) return { ok: false, msg: '楼层数需在 1–30 之间' };
      if (!(perFloor >= 1 && perFloor <= 50)) return { ok: false, msg: '每层房间数需在 1–50 之间' };

      var have = {};
      D().rooms.forEach(function (r) { if (r.bld === code) have[r.id] = r; });

      var target = {};
      for (var f = 1; f <= floors; f++) {
        for (var i = 1; i <= perFloor; i++) {
          target[code + '-' + f + (i < 10 ? '0' + i : String(i))] = { floor: f };
        }
      }

      var toAdd = Object.keys(target).filter(function (id) { return !have[id]; });
      var toRemove = Object.keys(have).filter(function (id) { return !target[id]; });

      var blocked = [];
      toRemove.forEach(function (id) {
        var r = have[id];
        var hasReading = D().readings.some(function (x) { return x.roomId === id; });
        var hasBill = D().bills.some(function (x) { return x.roomId === id; });
        if (r.status === 'occupied' || r.employeeId || hasReading || hasBill) blocked.push(id);
      });
      if (blocked.length) {
        return {
          ok: false,
          msg: '以下房间已有住户或抄表/账单数据，不能删除：' + blocked.slice(0, 5).join('、') +
            (blocked.length > 5 ? ' 等 ' + blocked.length + ' 间' : '')
        };
      }

      toAdd.forEach(function (id) {
        D().rooms.push({
          id: id, bld: code, floor: target[id].floor, status: 'vacant', employeeId: '',
          meterE: { no: 'E-' + id, init: 0 }, meterW: { no: 'W-' + id, init: 0 }
        });
      });
      if (toRemove.length) {
        var rm = {};
        toRemove.forEach(function (id) { rm[id] = 1; });
        D().rooms = D().rooms.filter(function (r) { return !rm[r.id]; });
      }

      b.floors = floors;
      b.perFloor = perFloor;
      audit('building.resize', code, toRemove.length + '→' + toAdd.length,
        '楼层 ' + floors + ' / 每层 ' + perFloor, '', actor);
      App.store.commit();
      return {
        ok: true,
        msg: '已调整：新增 ' + toAdd.length + ' 间，删除 ' + toRemove.length + ' 间',
        added: toAdd.length, removed: toRemove.length
      };
    },

    /* ---------------- 抄表 ---------------- */
    /**
     * 保存一条读数（按 period+roomId+meterType 幂等）
     * @return {{ok:boolean,msg:string,warnings:Array,record:Object}}
     */
    saveReading: function (o) {
      o = o || {};
      var period = o.period || DOM.period();
      var room = DOM.roomOf(o.roomId);
      if (!room) return { ok: false, msg: '房间不存在' };
      if (room.status !== 'occupied') return { ok: false, msg: '空置房无需抄表' };
      var price = DOM.priceOf(period, room.bld);
      if (!price) return { ok: false, msg: '该账期未设置本楼栋单价' };

      var prev = DOM.prevOf(period, o.roomId, o.meterType);
      var existing = DOM.readingOne(period, o.roomId, o.meterType);
      if (existing && existing.status === 'approved') {
        return { ok: false, msg: '该读数已复核通过，如需修改请联系主管' };
      }
      if (existing && existing.locked) {
        return { ok: false, msg: '该房间已提交审核，需主管退回后才能修改' };
      }

      var label = o.meterType === 'w' ? '水表' : '电表';
      var v = U.validate({
        prevReading: prev.reading,
        reading: o.reading,
        lastUsage: prev.usage,
        hasPhoto: !!o.photoId,
        duplicate: !!(existing && existing.status === 'pending' && o.isResubmit !== true),
        unit: o.meterType === 'w' ? '吨' : '度',
        label: label
      });
      if (v.block) {
        return { ok: false, msg: v.warnings[0].msg, warnings: v.warnings };
      }
      if (U.needNote(v.warnings) && !(o.note && String(o.note).trim())) {
        return { ok: false, msg: '读数异常，请填写备注后保存', warnings: v.warnings };
      }

      var rec = existing || {
        id: period + '-' + o.roomId + '-' + o.meterType,
        period: period, roomId: o.roomId, meterType: o.meterType,
        edits: []
      };
      var before = rec.reading;
      rec.prevReading = prev.reading;
      rec.reading = Number(o.reading);
      rec.usage = v.usage;
      rec.lastUsage = prev.usage;
      rec.photoId = o.photoId || rec.photoId || '';
      // 原图（dataURL）随记录保存，员工端才能看到"原始照片"；超过 400KB 不存，避免撑爆本地存储
      if (o.photoData && String(o.photoData).indexOf('data:') === 0 && String(o.photoData).length <= 400000) {
        rec.photoData = o.photoData;
      } else if (existing && existing.photoData) {
        rec.photoData = existing.photoData;
      }
      rec.shotAt = now();
      rec.operator = o.actor || '李强';
      rec.status = 'pending';
      rec.locked = !!o.submit;   // 提交后锁定，保安不能再改
      rec.exceptionReason = '';
      rec.note = o.note || '';
      rec.warnings = v.warnings.map(function (w) { return w.code; });
      if (before != null && Number(before) !== Number(o.reading)) {
        rec.edits.push({ at: now(), by: actorName(o.actor), from: before, to: Number(o.reading), reason: o.note || '修改' });
      }
      if (!existing) D().readings.push(rec);

      audit('reading.save', o.roomId + '/' + o.meterType, before, o.reading, o.note, o.actor);
      App.store.commit();
      return { ok: true, msg: '已保存', warnings: v.warnings, record: rec };
    },

    markException: function (o) {
      o = o || {};
      var period = o.period || DOM.period();
      var room = DOM.roomOf(o.roomId);
      if (!room) return { ok: false, msg: '房间不存在' };
      if (!o.reason) return { ok: false, msg: '请选择异常原因' };
      var ex = D().readings.filter(function (r) {
        return r.period === period && r.roomId === o.roomId && r.status === 'exception';
      })[0];
      if (ex) {
        ex.exceptionReason = o.reason;
        ex.photoId = o.photoId || ex.photoId;
        ex.shotAt = now();
      } else {
        D().readings.push({
          id: period + '-' + o.roomId + '-x', period: period, roomId: o.roomId, meterType: 'both',
          prevReading: 0, reading: null, usage: 0, photoId: o.photoId || '',
          shotAt: now(), operator: o.actor || '李强', status: 'exception',
          exceptionReason: o.reason, note: '', warnings: [], edits: [], lastUsage: 0
        });
      }
      audit('reading.exception', o.roomId, '', o.reason, o.reason, o.actor);
      App.store.commit();
      return { ok: true, msg: '已标记异常' };
    },

    /**
     * 提交一间房（电 + 水 一起校验、一起写入、一起锁定）
     * 任意一块表不合格则整间不落库，避免"半提交"把房间锁死。
     */
    submitReadings: function (o, actor) {
      o = o || {};
      var period = o.period || DOM.period();
      var room = DOM.roomOf(o.roomId);
      if (!room) return { ok: false, msg: '房间不存在' };
      if (room.status !== 'occupied') return { ok: false, msg: '空置房无需抄表' };
      var price = DOM.priceOf(period, room.bld);
      if (!price) return { ok: false, msg: '该账期未设置本楼栋单价' };

      var list = ['e', 'w'].map(function (t) {
        var src = (o.readings || {})[t] || {};
        return { meterType: t, reading: src.reading, photoId: src.photoId, photoData: src.photoData };
      });
      var missing = list.filter(function (x) { return x.reading === '' || x.reading == null || isNaN(Number(x.reading)); });
      if (missing.length) return { ok: false, msg: '请先填写电表和水表读数' };

      var problems = [], needNote = false;
      list.forEach(function (it) {
        var prev = DOM.prevOf(period, o.roomId, it.meterType);
        var ex = DOM.readingOne(period, o.roomId, it.meterType);
        if (ex && ex.status === 'approved') problems.push('该房间已复核通过，如需修改请联系主管');
        else if (ex && ex.locked) problems.push('该房间已提交审核，需主管退回后才能修改');
        var v = U.validate({
          prevReading: prev.reading, reading: it.reading,
          lastUsage: prev.usage, hasPhoto: !!it.photoId,
          unit: it.meterType === 'w' ? '吨' : '度',
          label: it.meterType === 'w' ? '水表' : '电表'
        });
        if (v.block) problems.push(v.warnings[0].msg);
        if (U.needNote(v.warnings)) needNote = true;
      });
      if (problems.length) return { ok: false, msg: problems[0] };
      if (needNote && !(o.note && String(o.note).trim())) {
        return { ok: false, msg: '读数异常，请填写备注后提交' };
      }

      // 备份原记录，任一块写入失败则整体回滚
      var backup = list.map(function (it) {
        var ex = DOM.readingOne(period, o.roomId, it.meterType);
        return { meterType: it.meterType, existed: !!ex, snapshot: ex ? JSON.parse(JSON.stringify(ex)) : null };
      });

      var failed = null;
      for (var i = 0; i < list.length; i++) {
        var r = DOM.saveReading({
          roomId: o.roomId, meterType: list[i].meterType, reading: list[i].reading,
          photoId: list[i].photoId, photoData: list[i].photoData,
          note: o.note, submit: true, isResubmit: true
        }, actor);
        if (!r.ok) { failed = r.msg; break; }
      }

      if (failed) {
        backup.forEach(function (b) {
          var arr = D().readings;
          for (var k = arr.length - 1; k >= 0; k--) {
            if (arr[k].period === period && arr[k].roomId === o.roomId && arr[k].meterType === b.meterType) {
              if (b.existed) arr[k] = b.snapshot;
              else arr.splice(k, 1);
            }
          }
        });
        App.store.commit();
        return { ok: false, msg: failed };
      }

      audit('reading.submitRoom', o.roomId, '', 'locked', o.note, actor);
      App.store.commit();
      return { ok: true, msg: '已提交，等待主管审核' };
    },

    /* ---------------- 草稿（防退出丢数据） ---------------- */
    draftOf: function (roomId, meterType) {
      var dr = D().drafts || {};
      return dr[roomId + ':' + meterType] || null;
    },

    saveDraft: function (roomId, meterType, patch) {
      var d = D();
      if (!d.drafts) d.drafts = {};
      var k = roomId + ':' + meterType;
      var cur = d.drafts[k] || { roomId: roomId, meterType: meterType, reading: '', note: '', photoId: '', at: '' };
      Object.keys(patch || {}).forEach(function (x) { cur[x] = patch[x]; });
      cur.at = now();
      d.drafts[k] = cur;
      if (App.store.commitKey) App.store.commitKey('drafts');
      return cur;
    },

    clearDraft: function (roomId, meterType) {
      var d = D();
      if (!d.drafts) return;
      delete d.drafts[roomId + ':' + meterType];
      if (App.store.commitKey) App.store.commitKey('drafts');
    },

    draftCount: function () {
      return Object.keys(D().drafts || {}).length;
    },

    /* ---------------- 房间变更（保安提交，主管审核） ---------------- */
    roomRequestsAll: function () { return D().roomRequests || []; },

    pendingRoomRequests: function () {
      return (D().roomRequests || []).filter(function (r) { return r.status === 'pending'; });
    },

    pendingRoomRequestOf: function (roomId) {
      return (D().roomRequests || []).filter(function (r) {
        return r.status === 'pending' && r.roomId === roomId;
      })[0] || null;
    },

    submitRoomChange: function (o, actor) {
      o = o || {};
      var b = DOM.buildingOf(o.building);
      if (!b) return { ok: false, msg: '楼栋不存在' };
      var action = o.action === 'add' ? 'add' : 'edit';
      var roomId = String(o.roomId || '').trim().toUpperCase();
      if (!roomId) return { ok: false, msg: '请填写房间编号' };
      var floor = Math.round(Number(o.floor) || 0);
      if (!(floor >= 1 && floor <= b.floors)) return { ok: false, msg: '楼层需在 1–' + b.floors + ' 之间' };
      var name = String((o.employee && o.employee.name) || '').trim();
      if (!name) return { ok: false, msg: '请填写住户姓名' };

      var existing = DOM.roomOf(roomId);
      if (action === 'add' && existing) return { ok: false, msg: '房间 ' + roomId + ' 已存在，改用「修改」' };
      if (action === 'edit' && !existing) return { ok: false, msg: '房间 ' + roomId + ' 不存在，改用「新增」' };
      if (action === 'edit' && existing.bld !== o.building) return { ok: false, msg: '该房间不属于本楼栋' };
      if (DOM.pendingRoomRequestOf(roomId)) return { ok: false, msg: '该房间已有待审核的变更' };

      var before = existing ? {
        name: (DOM.employeeOf(roomId) || {}).name || '',
        dept: (DOM.employeeOf(roomId) || {}).dept || '',
        phone: (DOM.employeeOf(roomId) || {}).phone || ''
      } : null;

      var req = {
        id: U.uid('RR'), kind: 'room', action: action,
        building: o.building, buildingName: b.name, roomId: roomId, floor: floor,
        employee: { name: name, dept: String((o.employee.dept) || '').trim(), phone: String((o.employee.phone) || '').trim() },
        before: before,
        status: 'pending',
        requestedBy: actor || '李强', requestedAt: now(),
        reviewedBy: '', reviewedAt: '', reviewNote: ''
      };
      if (!D().roomRequests) D().roomRequests = [];
      D().roomRequests.push(req);
      audit('room.submit', roomId, before ? before.name : '', name, action, actor);
      App.store.commit();
      return { ok: true, msg: '已提交房间变更，等待安保主管审核', request: req };
    },

    approveRoomChange: function (id, actor) {
      var req = (D().roomRequests || []).filter(function (r) { return r.id === id; })[0];
      if (!req) return { ok: false, msg: '申请不存在' };
      if (req.status !== 'pending') return { ok: false, msg: '该申请已处理' };

      var empId = 'V' + String(Date.now()).slice(-9);
      if (req.action === 'add') {
        D().rooms.push({
          id: req.roomId, bld: req.building, floor: req.floor, status: 'occupied', employeeId: empId,
          meterE: { no: 'E-' + req.roomId, init: 0 }, meterW: { no: 'W-' + req.roomId, init: 0 }
        });
        D().employees.push({
          id: empId, name: req.employee.name, dept: req.employee.dept || '',
          phone: req.employee.phone || '', roomId: req.roomId, status: 'active'
        });
      } else {
        var room = DOM.roomOf(req.roomId);
        if (!room) return { ok: false, msg: '房间已不存在，无法应用变更' };
        var emp = DOM.employeeById(room.employeeId);
        if (emp) {
          emp.name = req.employee.name;
          emp.dept = req.employee.dept || emp.dept;
          emp.phone = req.employee.phone || emp.phone;
        } else {
          D().employees.push({
            id: empId, name: req.employee.name, dept: req.employee.dept || '',
            phone: req.employee.phone || '', roomId: req.roomId, status: 'active'
          });
          room.employeeId = empId;
        }
        room.status = 'occupied';
      }

      req.status = 'approved';
      req.reviewedBy = actor || '安保主管';
      req.reviewedAt = now();
      audit('room.approve', req.roomId, req.action, 'approved', '', actor);
      App.store.commit();
      return { ok: true, msg: '已通过，房间与住户已更新' };
    },

    rejectRoomChange: function (id, note, actor) {
      var req = (D().roomRequests || []).filter(function (r) { return r.id === id; })[0];
      if (!req) return { ok: false, msg: '申请不存在' };
      if (req.status !== 'pending') return { ok: false, msg: '该申请已处理' };
      if (!note || !String(note).trim()) return { ok: false, msg: '驳回必须填写理由' };
      req.status = 'rejected';
      req.reviewedBy = actor || '安保主管';
      req.reviewedAt = now();
      req.reviewNote = note;
      audit('room.reject', req.roomId, 'pending', 'rejected', note, actor);
      App.store.commit();
      return { ok: true, msg: '已驳回' };
    },

    /* ---------------- 单价变更审批 ---------------- */
    priceRequestsAll: function () { return D().priceRequests || []; },

    pendingPriceRequests: function () {
      return (D().priceRequests || []).filter(function (r) { return r.status === 'pending'; });
    },

    priceRequestOf: function (building, period) {
      return (D().priceRequests || []).filter(function (r) {
        return r.status === 'pending' && r.building === building && r.period === period;
      })[0] || null;
    },

    /** 管家提交改价申请：只登记，不生效 */
    submitPriceChange: function (o, actor) {
      o = o || {};
      var period = o.period || DOM.period();
      var b = DOM.buildingOf(o.building);
      if (!b) return { ok: false, msg: '楼栋不存在' };
      var e = Math.round(Number(o.electricity));
      var w = Math.round(Number(o.water));
      if (!(e > 0 && e <= 10000)) return { ok: false, msg: '电价需在 0.01–100 元/度之间' };
      if (!(w > 0 && w <= 100000)) return { ok: false, msg: '水价需在 0.01–1000 元/吨之间' };
      if (DOM.priceRequestOf(o.building, period)) {
        return { ok: false, msg: '该楼栋本期已有待审批的改价申请' };
      }
      var cur = DOM.priceOf(period, o.building);
      if (cur && cur.electricity === e && cur.water === w) {
        return { ok: false, msg: '与当前单价相同，无需申请' };
      }
      var req = {
        id: U.uid('PR'), kind: 'price', period: period, building: o.building, buildingName: b.name,
        electricity: e, water: w,
        beforeE: cur ? cur.electricity : null, beforeW: cur ? cur.water : null,
        reason: String(o.reason || '').trim(),
        status: 'pending',
        requestedBy: actor || '王管家', requestedAt: now(),
        reviewedBy: '', reviewedAt: '', reviewNote: ''
      };
      if (!D().priceRequests) D().priceRequests = [];
      D().priceRequests.push(req);
      audit('price.submit', b.code, cur ? (cur.electricity + '/' + cur.water) : '', e + '/' + w, req.reason, actor);
      App.store.commit();
      return { ok: true, msg: '已提交改价申请，等待管理员审批', request: req };
    },

    approvePriceChange: function (id, actor) {
      var req = (D().priceRequests || []).filter(function (r) { return r.id === id; })[0];
      if (!req) return { ok: false, msg: '申请不存在' };
      if (req.status !== 'pending') return { ok: false, msg: '该申请已处理' };
      var list = D().prices || [];
      var hit = null;
      list.forEach(function (p) {
        if (p.period === req.period && p.building === req.building) hit = p;
      });
      if (hit) {
        hit.electricity = req.electricity;
        hit.water = req.water;
        hit.updatedAt = now();
      } else {
        list.push({
          period: req.period, building: req.building,
          electricity: req.electricity, water: req.water,
          note: '审批通过', createdAt: now()
        });
      }
      D().prices = list;
      req.status = 'approved';
      req.reviewedBy = actor || '管理员';
      req.reviewedAt = now();
      audit('price.approve', req.building, req.beforeE + '/' + req.beforeW, req.electricity + '/' + req.water, '', actor);
      App.store.commit();
      return { ok: true, msg: '已批准并生效' };
    },

    rejectPriceChange: function (id, note, actor) {
      var req = (D().priceRequests || []).filter(function (r) { return r.id === id; })[0];
      if (!req) return { ok: false, msg: '申请不存在' };
      if (req.status !== 'pending') return { ok: false, msg: '该申请已处理' };
      if (!note || !String(note).trim()) return { ok: false, msg: '驳回必须填写理由' };
      req.status = 'rejected';
      req.reviewedBy = actor || '管理员';
      req.reviewedAt = now();
      req.reviewNote = note;
      audit('price.reject', req.building, '', '', note, actor);
      App.store.commit();
      return { ok: true, msg: '已驳回' };
    },

    /* ---------------- 复核 ---------------- */
    pendingReadings: function (period) {
      period = period || DOM.period();
      return D().readings.filter(function (r) {
        return r.period === period && r.status === 'pending';
      });
    },

    approveReading: function (id, actor) {
      var r = D().readings.filter(function (x) { return x.id === id; })[0];
      if (!r) return { ok: false, msg: '记录不存在' };
      if (r.status !== 'pending') return { ok: false, msg: '该记录不在待复核状态' };
      r.status = 'approved';
      r.approvedAt = now();
      var bill = DOM._ensureBill(r.period, r.roomId, actor);
      audit('reading.approve', r.roomId + '/' + r.meterType, 'pending', 'approved', '', actor);
      App.store.commit();
      return { ok: true, msg: '已通过', bill: bill };
    },

    rejectReading: function (id, reason, actor) {
      var r = D().readings.filter(function (x) { return x.id === id; })[0];
      if (!r) return { ok: false, msg: '记录不存在' };
      if (!reason || !String(reason).trim()) return { ok: false, msg: '退回必须填写原因' };
      r.status = 'rejected';
      r.rejectReason = reason;
      r.rejectedAt = now();
      r.locked = false;   // 退回后解锁，保安可重新抄
      audit('reading.reject', r.roomId + '/' + r.meterType, 'pending', 'rejected', reason, actor);
      App.store.commit();
      return { ok: true, msg: '已退回' };
    },

    // 按房间成对复核（一间房 = 电 + 水 两条记录）
    approveRoom: function (roomId, actor) {
      var period = DOM.period();
      var list = D().readings.filter(function (r) {
        return r.period === period && r.roomId === roomId && r.status === 'pending';
      });
      if (!list.length) return { ok: false, msg: '该房间没有待复核记录' };
      list.forEach(function (r) { r.status = 'approved'; r.approvedAt = now(); });
      // 两表都通过 → 立即出账，账单进入物业管家的"待确认"
      var bill = DOM._ensureBill(period, roomId, actor);
      audit('reading.approveRoom', roomId, 'pending', list.length, '', actor);
      App.store.commit();
      return { ok: true, count: list.length, bill: bill };
    },

    rejectRoom: function (roomId, reason, actor) {
      if (!reason || !String(reason).trim()) return { ok: false, msg: '退回必须填写原因' };
      var period = DOM.period();
      var list = D().readings.filter(function (r) {
        return r.period === period && r.roomId === roomId && r.status === 'pending';
      });
      if (!list.length) return { ok: false, msg: '该房间没有待复核记录' };
      list.forEach(function (r) {
        r.status = 'rejected'; r.rejectReason = reason; r.rejectedAt = now(); r.locked = false;
      });
      audit('reading.rejectRoom', roomId, 'pending', 'rejected', reason, actor);
      App.store.commit();
      return { ok: true, count: list.length };
    },

    pendingRooms: function (period) {
      period = period || DOM.period();
      return D().rooms.filter(function (r) { return DOM.roomState(r.id, period) === 'pending'; });
    },

    approveAllClean: function (period, actor) {
      period = period || DOM.period();
      var list = DOM.pendingReadings(period).filter(function (r) {
        return !r.warnings || r.warnings.length === 0;
      });
      list.forEach(function (r) { r.status = 'approved'; r.approvedAt = now(); });
      audit('reading.approveBatch', period, '', list.length, '', actor);
      App.store.commit();
      return { ok: true, count: list.length };
    },

    /* ---------------- 出账 ---------------- */
    /** 内部：某房间两表都复核通过后，立即出一张待确认账单（已存在则跳过） */
    _ensureBill: function (period, roomId, actor) {
      if (DOM.billOf(period, roomId)) return null;
      var room = DOM.roomOf(roomId);
      if (!room || room.status !== 'occupied') return null;
      if (DOM.roomState(roomId, period) !== 'approved') return null;
      var price = DOM.priceOf(period, room.bld);
      if (!price) return null;
      var e = DOM.readingOne(period, roomId, 'e');
      var w = DOM.readingOne(period, roomId, 'w');
      if (!e || !w) return null;
      var amt = U.calcBill(e.usage, w.usage, price.electricity, price.water);
      var pubDays = D().meta.publicityDays || 3;
      var genAt = now();
      var bill = {
        id: 'B-' + period + '-' + roomId, period: period, roomId: roomId, employeeId: room.employeeId,
        usageE: e.usage, usageW: w.usage, priceE: price.electricity, priceW: price.water,
        amountE: amt.amountE, amountW: amt.amountW, total: amt.total,
        status: 'public', generatedAt: genAt, publicEndAt: U.addDays(genAt, pubDays), deductedAt: ''
      };
      D().bills.push(bill);
      audit('bill.auto', period, roomId, String(amt.total), '', actor);
      return bill;
    },

    generateBills: function (period, actor) {
      period = period || DOM.period();
      var created = 0, total = 0, skipped = 0, noPrice = 0;
      var pubDays = (D().meta.publicityDays || 3);
      var genAt = now();
      DOM.occupiedRooms().forEach(function (room) {
        if (DOM.billOf(period, room.id)) { skipped++; return; }
        if (DOM.roomState(room.id, period) !== 'approved') { return; }
        var price = DOM.priceOf(period, room.bld);
        if (!price) { noPrice++; return; }
        var e = DOM.readingOne(period, room.id, 'e');
        var w = DOM.readingOne(period, room.id, 'w');
        if (!e || !w) return;
        var amt = U.calcBill(e.usage, w.usage, price.electricity, price.water);
        D().bills.push({
          id: 'B-' + period + '-' + room.id, period: period, roomId: room.id, employeeId: room.employeeId,
          usageE: e.usage, usageW: w.usage, priceE: price.electricity, priceW: price.water,
          amountE: amt.amountE, amountW: amt.amountW, total: amt.total,
          status: 'public', generatedAt: genAt, publicEndAt: U.addDays(genAt, pubDays), deductedAt: ''
        });
        created++;
        total += amt.total;
      });
      audit('bill.generate', period, '', created + ' 户 / ' + total + ' 分', '', actor);
      App.store.commit();
      return { ok: true, created: created, skipped: skipped, total: total, noPrice: noPrice };
    },

    confirmBill: function (billId, actor) {
      var b = DOM.billById(billId);
      if (!b) return { ok: false, msg: '账单不存在' };
      if (b.status === 'confirmed') return { ok: false, msg: '该账单已确认' };
      if (b.status === 'deducted') return { ok: false, msg: '该账单已代扣' };
      if (b.status === 'disputed') return { ok: false, msg: '该账单申诉处理中，暂不能确认' };
      if (b.status !== 'public') return { ok: false, msg: '该账单尚未公示' };
      b.status = 'confirmed';
      b.confirmedAt = now();
      audit('bill.confirm', b.id, 'public', 'confirmed', '', actor);
      App.store.commit();
      return { ok: true, msg: '已确认' };
    },

    submitAppeal: function (billId, o, actor) {
      o = o || {};
      var b = DOM.billById(billId);
      if (!b) return { ok: false, msg: '账单不存在' };
      if (b.status === 'deducted') return { ok: false, msg: '该账单已代扣，请线下联系' };
      if (b.status === 'disputed') return { ok: false, msg: '已有申诉在处理中' };
      if (!o.type) return { ok: false, msg: '请选择申诉类型' };
      b.status = 'disputed';
      D().disputes.push({
        id: U.uid('D'), billId: billId, type: o.type, desc: o.desc || '',
        status: 'open', handlerNote: '', handledAt: '', createdAt: now(),
        photoId: o.photoId || ''
      });
      audit('bill.appeal', b.id, 'public', 'disputed', o.type, actor);
      App.store.commit();
      return { ok: true, msg: '已提交申诉' };
    },

    resolveAppeal: function (billId, decision, note, actor) {
      var b = DOM.billById(billId);
      if (!b) return { ok: false, msg: '账单不存在' };
      var d = DOM.openDisputeOf(billId);
      if (!d) return { ok: false, msg: '没有待处理的申诉' };
      if (!note || !String(note).trim()) return { ok: false, msg: '请填写处理说明' };
      if (decision === 'accept') {
        var price = DOM.priceOf(b.period);
        var e = DOM.readingOne(b.period, b.roomId, 'e');
        var w = DOM.readingOne(b.period, b.roomId, 'w');
        if (e && w && price) {
          var amt = U.calcBill(e.usage, w.usage, price.electricity, price.water);
          b.amountE = amt.amountE; b.amountW = amt.amountW; b.total = amt.total;
          b.usageE = e.usage; b.usageW = w.usage;
        }
        b.status = 'confirmed';
        d.status = 'resolved';
      } else {
        b.status = 'confirmed';
        d.status = 'rejected';
      }
      d.handlerNote = note;
      d.handledAt = now();
      audit('appeal.resolve', billId, 'open', d.status, note, actor);
      App.store.commit();
      return { ok: true, msg: decision === 'accept' ? '已更正并确认' : '已驳回' };
    },

    /* ---------------- 代扣 ---------------- */
    deductList: function (period) {
      period = period || DOM.period();
      var t = Date.now();
      return DOM.billsOf(period).filter(function (b) {
        if (b.status === 'confirmed') return true;
        if (b.status === 'public' && b.publicEndAt && new Date(b.publicEndAt).getTime() < t) return true;
        return false;
      }).filter(function (b) {
        return !DOM.openDisputeOf(b.id);
      }).map(function (b) {
        var emp = DOM.employeeById(b.employeeId) || { name: '—', dept: '—', id: '—' };
        return {
          billId: b.id, empId: emp.id, name: emp.name, dept: emp.dept,
          roomId: b.roomId, period: b.period,
          range: (U.periodRange(b.period).start) + ' ~ ' + (U.periodRange(b.period).end),
          amount: b.total
        };
      });
    },

    exportDeductCSV: function (period) {
      var rows = [['工号', '姓名', '部门', '费用期间', '金额']];
      DOM.deductList(period).forEach(function (x) {
        rows.push([x.empId, x.name, x.dept, x.range, U.fmtMoney(x.amount)]);
      });
      return U.toCSV(rows);
    },

    markDeducted: function (ids, actor) {
      var n = 0;
      (ids || []).forEach(function (id) {
        var b = DOM.billById(id);
        if (b && b.status !== 'deducted') {
          b.status = 'deducted';
          b.deductedAt = now();
          n++;
        }
      });
      audit('bill.deduct', '', '', n, '', actor);
      App.store.commit();
      return { ok: true, count: n };
    },

    /* ---------------- 趋势 ---------------- */
    // 按读数统计（不依赖账单，出账前也能看）
    trend: function (roomId, limit) {
      limit = limit || 6;
      var map = {};
      D().readings.forEach(function (r) {
        if (r.roomId !== roomId || r.reading == null) return;
        if (r.meterType !== 'e' && r.meterType !== 'w') return;
        var m = map[r.period] || (map[r.period] = { period: r.period, usageE: 0, usageW: 0 });
        if (r.meterType === 'e') m.usageE = r.usage;
        else m.usageW = r.usage;
      });
      return Object.keys(map).sort().slice(-limit).map(function (k) {
        var x = map[k];
        var bill = DOM.billOf(x.period, roomId);
        return { period: k, usageE: x.usageE, usageW: x.usageW, total: bill ? bill.total : 0 };
      });
    },

    /* ---------------- 重置 ---------------- */
    resetDemo: function () {
      App.store.reset();
      return { ok: true, msg: '演示数据已重置' };
    }
  };

  App.domain = DOM;
})(typeof window !== 'undefined' ? window : globalThis);

/* 启动与全局交互（事件委托） */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var A = {};

  // 所有可处理的 data-act 命令（测试会检查页面里出现的命令都在此表）
  A.COMMANDS = [
    'nav', 'role', 'noop', 'open-reading', 'photo', 'exc', 'exc-reason', 'exc-close', 'exc-submit',
    'use-photo', 'save-reading', 'approve-room', 'reject-room', 'approve', 'reject', 'approve-all',
    'gen-bills', 'confirm-bill', 'open-appeal', 'appeal-type', 'appeal-submit', 'export', 'import',
    'reset', 'skip-publicity', 'export-csv', 'mark-deducted', 'set-price', 'toast', 'open-install',
    'ocr-upload', 'bld-save', 'price-submit', 'price-approve', 'price-reject',
    'room-submit', 'room-approve', 'room-reject'
  ];

  // 识图：上传照片 → 自动读数 → 回填（可手改）
  A.handleOcrFile = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var room = App.guardState.room;
    var type = App.guardState.photoType || 'e';
    App.ui.toast('正在识别读数…', 2500);
    var fr = new FileReader();
    fr.onload = function () {
      App.ocr.ocrFile(file, { maxW: 900, decimalLast: true }, function (err, res) {
        if (err) { App.ui.toast('图片读取失败：' + err.message); return; }
        if (!res || !res.ok) {
          App.ui.toast('自动识别没把握（' + Math.round((res ? res.confidence : 0) * 100) + '%），请手动输入');
          return;
        }
        App.guardState.values[room + ':' + type] = res.value;
        App.guardState.photos[room + ':' + type] = fr.result;
        App.ui.toast('识别到 ' + res.value + '，请核对后保存');
        App.router.go('guard.reading', { room: room });
      });
    };
    fr.readAsDataURL(file);
  };

  A.setRole = function (role) {
    var st = App.store.data;
    st.session = st.session || {};
    st.session.role = role;
    if (role === 'employee') st.session.employeeId = st.session.employeeId || 'V20231187';
    App.store.commit();
    App.router.go(App.router.homeOf(role));
  };

  A.nextRoom = function (roomId) {
    var d = App.domain;
    var rooms = App.store.data.rooms.filter(function (r) { return r.bld === (d.roomOf(roomId) || {}).bld; });
    var idx = -1;
    for (var i = 0; i < rooms.length; i++) if (rooms[i].id === roomId) idx = i;
    for (var j = idx + 1; j < rooms.length; j++) {
      if (d.roomState(rooms[j].id) !== 'approved') return rooms[j].id;
    }
    return null;
  };

  A.handle = function (act, el) {
    var parts = act.split(':');
    var cmd = parts[0];
    var arg = parts[1];

    if (cmd === 'nav') {
      // 形如 nav:guard.rooms?bld=A%E6%A0%8B
      var target = act.slice(4);
      var qi = target.indexOf('?');
      var key = qi >= 0 ? target.slice(0, qi) : target;
      var params = {};
      if (qi >= 0) {
        target.slice(qi + 1).split('&').forEach(function (kv) {
          var i = kv.indexOf('=');
          if (i > 0) params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
        });
      }
      App.router.go(key, params);
      return;
    }

    if (cmd === 'room-submit') {
      if (!App.perm.can(App.store.data.session.role, 'room.edit')) {
        App.ui.toast(App.perm.deny('room.edit'));
        return;
      }
      var mode = parts[1] === 'edit' ? 'edit' : 'add';
      var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
      var rr = App.domain.submitRoomChange({
        action: mode,
        building: App.guardState.manageBld,
        roomId: val('rmId'),
        floor: val('rmFloor'),
        employee: { name: val('rmName'), dept: val('rmDept'), phone: val('rmPhone') }
      }, '李强');
      App.ui.toast(rr.msg);
      App.router.render();
      return;
    }

    if (cmd === 'room-approve') {
      if (!App.perm.can(App.store.data.session.role, 'room.approve')) {
        App.ui.toast(App.perm.deny('room.approve'));
        return;
      }
      var ra2 = App.domain.approveRoomChange(parts.slice(1).join(':'), '李主管');
      App.ui.toast(ra2.msg);
      App.router.render();
      return;
    }

    if (cmd === 'room-reject') {
      if (!App.perm.can(App.store.data.session.role, 'room.approve')) {
        App.ui.toast(App.perm.deny('room.approve'));
        return;
      }
      var rjId2 = parts.slice(1).join(':');
      var rjNote2 = root.prompt ? root.prompt('驳回理由（必填）') : '不同意';
      if (rjNote2 === null) return;
      var rr2 = App.domain.rejectRoomChange(rjId2, rjNote2, '李主管');
      App.ui.toast(rr2.msg);
      App.router.render();
      return;
    }

    if (cmd === 'price-submit') {
      var bcode = parts.slice(1).join(':');
      var eEl = document.getElementById('prE-' + bcode);
      var wEl = document.getElementById('prW-' + bcode);
      var rEl = document.getElementById('prR-' + bcode);
      var toCents = function (v) {
        var n = parseFloat(v);
        return isNaN(n) ? NaN : Math.round(n * 100);
      };
      var rp = App.domain.submitPriceChange({
        building: bcode,
        electricity: toCents(eEl ? eEl.value : ''),
        water: toCents(wEl ? wEl.value : ''),
        reason: rEl ? rEl.value : ''
      }, '王管家');
      App.ui.toast(rp.msg);
      App.router.render();
      return;
    }

    if (cmd === 'price-approve') {
      var ra = App.domain.approvePriceChange(parts.slice(1).join(':'), '管理员');
      App.ui.toast(ra.msg);
      App.router.render();
      return;
    }

    if (cmd === 'price-reject') {
      var rjId = parts.slice(1).join(':');
      var rjNote = root.prompt ? root.prompt('驳回理由（必填）') : '不同意';
      if (rjNote === null) return;
      var rr = App.domain.rejectPriceChange(rjId, rjNote, '管理员');
      App.ui.toast(rr.msg);
      App.router.render();
      return;
    }

    if (cmd === 'bld-save') {
      if (!App.perm.can(App.store.data.session.role, 'building.rename')) {
        App.ui.toast(App.perm.deny('building.rename'));
        return;
      }
      var code = parts.slice(1).join(':');
      var nEl = document.getElementById('bldName-' + code);
      var fEl = document.getElementById('bldFloors-' + code);
      var pEl = document.getElementById('bldPer-' + code);
      var msgs = [];
      var r1 = App.domain.renameBuilding(code, nEl ? nEl.value : '', '王管家');
      msgs.push(r1.msg);
      if (r1.ok) {
        var r2 = App.domain.setBuildingSize(code, fEl ? fEl.value : 0, pEl ? pEl.value : 0, '王管家');
        msgs.push(r2.msg);
      }
      App.ui.toast(msgs.join('；'));
      App.router.render();
      return;
    }

    if (cmd === 'ocr-upload') {
      var f = document.getElementById('ocrFile');
      if (f) f.click();
      else App.ui.toast('请在拍照页使用识图');
      return;
    }

    if (cmd === 'noop') return;

    if (cmd === 'open-install') {
      if (typeof window !== 'undefined' && window.open) {
        window.open('./install.html', '_blank');
      } else {
        App.ui.toast('请在浏览器中打开 install.html');
      }
      return;
    }

    if (cmd === 'role') { A.setRole(arg); return; }

    if (cmd === 'open-reading') {
      var rid = parts.slice(1).join(':');
      App.guardState.room = rid;
      App.guardState.values = {};
      App.guardState.photos = {};
      App.guardState.note = '';
      App.router.go('guard.reading', { room: rid });
      return;
    }

    if (cmd === 'photo') {
      var roomId = parts[1], type = parts[2];
      App.guardState.room = roomId;
      App.guardState.photoType = type;
      App.router.go('guard.camera', { room: roomId, type: type });
      return;
    }

    if (cmd === 'exc') {
      App.guardState.room = parts[1];
      App.guardState.excOpen = true;
      App.router.render();
      return;
    }

    if (cmd === 'exc-reason') {
      App.guardState.excReason = parts.slice(1).join(':');
      App.router.render();
      return;
    }

    if (cmd === 'exc-close') { App.guardState.excOpen = false; App.router.render(); return; }

    if (cmd === 'exc-submit') {
      var reason = App.guardState.excReason;
      if (!reason) { App.ui.toast('请选择异常原因'); return; }
      var r = App.domain.markException({ roomId: App.guardState.room, reason: reason, photoId: 'ph_exc_new' });
      App.ui.toast(r.msg);
      if (r.ok) {
        App.guardState.excOpen = false;
        App.guardState.excReason = '';
        App.router.go('guard.rooms');
      }
      return;
    }

    if (cmd === 'use-photo') {
      var t = App.guardState.photoType || 'e';
      var k = App.guardState.room + ':' + t;
      App.guardState.photos[k] = 'ph_' + Date.now();
      App.ui.toast('照片已保存，水印已叠加');
      App.router.go('guard.reading', { room: App.guardState.room });
      return;
    }

    if (cmd === 'save-reading') {
      var room = App.guardState.room;
      var inputs = {};
      ['e', 'w'].forEach(function (type) {
        var inp = document.getElementById('inp-' + type);
        inputs[type] = inp ? inp.value : '';
      });
      var pack = {};
      ['e', 'w'].forEach(function (type) {
        var pv = App.guardState.photos[room + ':' + type] || '';
        var isData = String(pv).indexOf('data:') === 0;
        pack[type] = {
          reading: inputs[type],
          photoId: isData ? ('ph_' + Date.now() + '_' + type) : (pv || 'ph_' + room + '_' + type),
          photoData: isData ? pv : ''
        };
      });
      var sub = App.domain.submitReadings({
        roomId: room, readings: pack,
        note: document.getElementById('noteInput') ? document.getElementById('noteInput').value : ''
      }, '李强');
      if (!sub.ok) { App.ui.toast(sub.msg); return; }
      App.domain.clearDraft(room, 'e');
      App.domain.clearDraft(room, 'w');
      App.ui.toast('已提交，进入下一间');
      var next = A.nextRoom(room);
      App.guardState.values = {};
      App.guardState.photos = {};
      App.guardState.note = '';
      if (next) App.router.go('guard.reading', { room: next });
      else App.router.go('guard.rooms');
      return;
    }
    if (cmd === 'approve-room') {
      var rr = App.domain.approveRoom(parts.slice(1).join(':'), '李主管');
      App.ui.toast(rr.msg || ('已通过 ' + rr.count + ' 条'));
      App.router.render();
      return;
    }
    if (cmd === 'reject-room') {
      var rid2 = parts.slice(1).join(':');
      var reason2 = root.prompt ? root.prompt('退回原因（必填）') : '需重抄';
      if (reason2 === null) return;
      var rr2 = App.domain.rejectRoom(rid2, reason2, '李主管');
      App.ui.toast(rr2.msg || '已退回');
      App.router.render();
      return;
    }
    if (cmd === 'approve') {
      var r = App.domain.approveReading(parts.slice(1).join(':'), '李主管');
      App.ui.toast(r.msg);
      App.router.render();
      return;
    }
    if (cmd === 'reject') {
      var id = parts.slice(1).join(':');
      var reason = root.prompt ? root.prompt('退回原因（必填）') : '需重抄';
      if (reason === null) return;
      var r2 = App.domain.rejectReading(id, reason, '李主管');
      App.ui.toast(r2.msg);
      App.router.render();
      return;
    }
    if (cmd === 'approve-all') {
      var r3 = App.domain.approveAllClean('2026-11', '李主管');
      App.ui.toast('已批量通过 ' + r3.count + ' 条');
      App.router.render();
      return;
    }
    if (cmd === 'gen-bills') {
      var r4 = App.domain.generateBills(App.domain.period(), '王管家');
      App.ui.toast(r4.ok ? ('已生成 ' + r4.created + ' 户账单') : r4.msg);
      App.router.render();
      return;
    }
    if (cmd === 'confirm-bill') {
      var r5 = App.domain.confirmBill(parts.slice(1).join(':'), '张伟');
      App.ui.toast(r5.msg);
      App.router.render();
      return;
    }
    if (cmd === 'open-appeal') {
      App.guardState.appealBill = parts.slice(1).join(':');
      App.router.go('employee.appeal');
      return;
    }
    if (cmd === 'appeal-type') {
      App.guardState.appealType = parts.slice(1).join(':');
      App.router.render();
      return;
    }
    if (cmd === 'appeal-submit') {
      var r6 = App.domain.submitAppeal(App.guardState.appealBill, {
        type: App.guardState.appealType || '读数不对',
        desc: (document.getElementById('appealDesc') || {}).value || ''
      }, '张伟');
      App.ui.toast(r6.msg);
      if (r6.ok) App.router.go('employee.bill');
      return;
    }
    if (cmd === 'export') {
      var snap = App.store.exportAll();
      App.util.download(App.store.exportFilename(), JSON.stringify(snap, null, 2), 'application/json');
      App.ui.toast('已导出备份文件');
      return;
    }
    if (cmd === 'import') {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          var obj;
          try { obj = JSON.parse(fr.result); } catch (e) { App.ui.toast('文件不是有效的 JSON'); return; }
          var r = App.store.importAll(obj);
          App.ui.toast(r.msg);
          if (r.ok) App.router.render();
        };
        fr.readAsText(f);
      };
      input.click();
      return;
    }
    if (cmd === 'reset') {
      if (root.confirm && !root.confirm('将清空所有演示数据并恢复初始状态，确定？')) return;
      App.domain.resetDemo();
      App.ui.toast('演示数据已重置');
      App.router.go('guard.task');
      return;
    }
    if (cmd === 'skip-publicity') {
      var p = App.domain.period();
      var n = 0;
      App.store.data.bills.forEach(function (b) {
        if (b.period === p && b.status === 'public') {
          b.publicEndAt = App.util.addDays(App.util.nowISO(), -1);
          n++;
        }
      });
      App.store.commit();
      App.ui.toast('已模拟公示期结束（' + n + ' 户）');
      App.router.render();
      return;
    }
    if (cmd === 'export-csv') {
      var csv = App.domain.exportDeductCSV(App.domain.period());
      App.util.download('代扣清单_' + App.domain.period() + '.csv', csv, 'text/csv;charset=utf-8');
      App.ui.toast('已导出代扣清单');
      return;
    }
    if (cmd === 'mark-deducted') {
      var rows = App.domain.deductList(App.domain.period());
      var r7 = App.domain.markDeducted(rows.map(function (x) { return x.billId; }), '财务');
      App.ui.toast('已标记 ' + r7.count + ' 户为已代扣');
      App.router.render();
      return;
    }
    if (cmd === 'set-price') {
      App.ui.toast('演示版暂不支持改价，请用默认单价');
      return;
    }
    if (cmd === 'toast') {
      App.ui.toast(parts.slice(1).join(':'));
      return;
    }
  };

  A.start = function () {
    if (A._started) return;
    A._started = true;
    App.store.init();
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) return;
      // 点 <details> 菜单外部时收起
      var act = el.getAttribute('data-act');
      var sw = document.querySelector('.roleswitch');
      if (sw && sw.open && !('' + act).startsWith('role') && act !== 'export' && act !== 'import' && act !== 'reset') {
        sw.open = false;
      }
      A.handle(act, el);
    });
    // 识图文件选择
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'ocrFile') A.handleOcrFile(e.target);
    });
    window.addEventListener('error', function (ev) {
      App.ui.toast('出错了：' + (ev.message || '未知'));
    });

    // Service Worker：开发用 ?dev=1 跳过，避免缓存导致改了不生效
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      if (/[?&]dev=1/.test(location.search)) {
        navigator.serviceWorker.getRegistrations().then(function (rs) {
          rs.forEach(function (r) { r.unregister(); });
        }).catch(function () { });
      } else {
        navigator.serviceWorker.register('./sw.js').catch(function () { });
      }
    }

    App.router.start();

    // 若有上次未提交的草稿，提示已恢复
    try {
      var dn = App.domain.draftCount();
      if (dn > 0) App.ui.toast('已恢复上次未提交的草稿（' + dn + ' 条）', 2800);
    } catch (e) { }
  };

  App.app = A;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.start);
    else A.start();
  }
})(typeof window !== 'undefined' ? window : globalThis);

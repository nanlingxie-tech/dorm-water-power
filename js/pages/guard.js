/* 安保视角页面：任务 / 房间列表 / 抄表录入 / 拍照 / 标记异常 / 记录 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});
  var M = App.mounts || (App.mounts = {});

  // 抄表页临时状态（重渲染会重建）
  var RS = App.readingState = { room: null, values: {}, photos: {}, warn: {}, note: '' };

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  /* ==================== 任务页 ==================== */
  P['guard.task'] = function (ctx) {
    var d = dom();
    var s = d.stats();
    var blds = d.buildings();
    var period = d.period();
    var left = s.total - s.done;

    var cards = blds.map(function (b) {
      var cls = b.pct === 0 ? 'todo' : (b.pct === 100 ? 'done' : 'pri');
      return '<button class="card bld" data-act="nav:guard.floors?bld=' + encodeURIComponent(b.code) + '">' +
        '<div class="between">' +
        '<b class="t3">' + b.name + '</b>' +
        '<span class="t2 muted num">' + b.done + ' / ' + b.total + ' 间</span>' +
        '<span class="chip ' + cls + '">' + b.pct + '%</span>' +
        '</div>' + ui().pbar(b.pct, b.pct === 0 ? '#dfe4ee' : (b.pct === 100 ? '#0f9d6e' : '')) +
        '</button>';
    }).join('');

    var pr = d.buildingList().map(function (b) { return d.priceOf(period, b.code); }).filter(Boolean);
    var kinds = {};
    pr.forEach(function (p) { kinds[p.electricity + '/' + p.water] = 1; });
    var priceText = !pr.length ? '本月单价未设置'
      : (Object.keys(kinds).length === 1
        ? '电 ' + (pr[0].electricity / 100).toFixed(2) + ' 元/度 · 水 ' + (pr[0].water / 100).toFixed(2) + ' 元/吨'
        : '各楼栋单价不同（' + Object.keys(kinds).length + ' 种），进楼层页可看本楼价格');

    return '<div class="view">' +
      '<header class="hero">' +
      '<div class="between">' +
      '<div><h1>本月抄表任务</h1><p>' + d.period().replace('-', '年') + '月 · 第 12 期 · 截止 11-28</p></div>' +
      '<div class="avatar">李</div>' +
      '</div></header>' +
      '<main class="body">' +
      '<section class="card prog">' +
      ui().ring(s.pct) +
      '<div class="prog-info">' +
      '<div class="t3"><b>已抄 ' + s.done + '</b> <span class="muted t2">/ ' + s.total + ' 间</span></div>' +
      '<div class="t2 muted" style="margin-top:4px">还剩 <b class="bad">' + left + '</b> 间 · 约需 ' + Math.max(1, Math.ceil(left / 80)) + ' 天</div>' +
      '<div class="row" style="gap:6px;margin-top:9px">' +
      ui().chip('异常 ' + s.exception, 'warn', 'warn') +
      ui().chip('待复核 ' + s.pending, 'pri') +
      '</div></div></section>' +
      '<div class="sec-title"><span>按楼栋抄表</span><span class="muted t1">共 ' + blds.length + ' 栋</span></div>' +
      cards +
      '<section class="card soft">' +
      '<div class="t1 muted">本月单价（出账时按楼栋自动套用）</div>' +
      '<div class="t2" style="margin-top:7px">' + priceText + '</div></section>' +
      '<div class="guide">👆 右上角可切换角色，2 分钟看完整闭环</div>' +
      '</main>' +
      ui().tabbar([
        { label: '任务', icon: 'list', act: 'nav:guard.task', active: true },
        { label: '记录', icon: 'clip', act: 'nav:guard.records' }
      ]) +
      '</div>';
  };

  /* ==================== 房间管理（保安提交，主管审核） ==================== */
  P['guard.manage'] = function (ctx) {
    var d = dom();
    var first = (d.buildingList()[0] || { code: 'A' }).code;
    var bld = (ctx && ctx.params && ctx.params.bld) || first;
    App.guardState.manageBld = bld;
    var b = d.buildingOf(bld) || { code: bld, name: bld, floors: 6 };
    var rooms = App.store.data.rooms.filter(function (r) { return r.bld === bld; });

    var rows = rooms.map(function (r) {
      var emp = d.employeeOf(r.id);
      var pend = d.pendingRoomRequestOf(r.id);
      return '<div class="listline static">' +
        '<b class="t2" style="width:72px">' + r.id + '</b>' +
        '<span class="ll-main"><span class="t2">' + (emp ? U.esc(emp.name) : '空置') + '</span>' +
        '<span class="t1 muted">' + r.floor + 'F · ' + (emp ? U.esc(emp.dept || '—') : '—') + '</span></span>' +
        (pend ? ui().chip('待审核', 'warn')
          : (r.status === 'occupied' ? ui().chip('在住', 'done') : ui().chip('空置', 'todo'))) +
        '</div>';
    }).join('');

    return '<div class="view">' +
      ui().hdr({
        title: b.name + ' · 房间管理',
        sub: '共 ' + rooms.length + ' 间 · 变更需安保主管审核',
        back: 'nav:guard.floors?bld=' + encodeURIComponent(bld)
      }) +
      '<main class="body">' +
      '<section class="card">' +
      '<div class="t2 b" style="margin-bottom:9px">提交房间变更</div>' +
      '<div class="row" style="gap:8px;margin-bottom:8px">' +
      '<input class="cell-input" id="rmId" placeholder="房间编号，如 ' + bld + '-701" />' +
      '<input class="cell-input num" id="rmFloor" placeholder="楼层" inputmode="numeric" />' +
      '</div>' +
      '<div class="row" style="gap:8px;margin-bottom:8px">' +
      '<input class="cell-input" id="rmName" placeholder="住户姓名" />' +
      '<input class="cell-input" id="rmDept" placeholder="部门" />' +
      '</div>' +
      '<input class="cell-input" id="rmPhone" placeholder="手机号（可空）" style="margin-bottom:10px" />' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn sm" data-act="room-submit:add">提交新增</button>' +
      '<button class="btn sm ghost" data-act="room-submit:edit">提交修改</button>' +
      '</div>' +
      '<p class="hint">新增：填不存在的房间编号；修改：填已有房间编号以更换住户。提交后需主管审核，通过才生效。</p>' +
      '</section>' +
      '<section class="card" style="padding:2px 12px">' + (rows || ui().empty('本楼栋还没有房间')) + '</section>' +
      '</main>' +
      ui().tabbar([
        { label: '任务', icon: 'list', act: 'nav:guard.task' },
        { label: '记录', icon: 'clip', act: 'nav:guard.records' }
      ]) +
      '</div>';
  };

  /* ==================== 楼层列表 ==================== */
  P['guard.floors'] = function (ctx) {
    var d = dom();
    var first = (d.buildingList()[0] || { code: 'A' }).code;
    var bld = (ctx && ctx.params && ctx.params.bld) || first;
    var b = d.buildingOf(bld) || { code: bld, name: bld, floors: 6 };
    var period = d.period();
    var rooms = App.store.data.rooms.filter(function (r) { return r.bld === bld; });
    var bp = d.priceOf(period, bld);
    var priceCard = bp
      ? '<div class="card mini between"><span class="t1 muted">本楼栋单价</span><span class="t2 num">电 <b>' +
      (bp.electricity / 100).toFixed(2) + '</b> 元/度 · 水 <b>' + (bp.water / 100).toFixed(2) + '</b> 元/吨</span></div>'
      : '';

    var cards = '';
    for (var f = 1; f <= b.floors; f++) {
      var list = rooms.filter(function (r) { return r.floor === f; });
      if (!list.length) continue;
      var done = 0, exc = 0;
      list.forEach(function (r) {
        var st = d.roomState(r.id, period);
        if (st === 'approved' || st === 'pending') done++;
        if (st === 'exception') exc++;
      });
      var pct = U.pct(done, list.length);
      cards += '<button class="card bld" data-act="nav:guard.rooms?bld=' + encodeURIComponent(bld) + '&floor=' + f + '">' +
        '<div class="between">' +
        '<b class="t3">' + f + 'F</b>' +
        '<span class="t2 muted num">' + done + ' / ' + list.length + ' 间</span>' +
        '<span class="chip ' + (pct === 100 ? 'done' : (pct === 0 ? 'todo' : 'pri')) + '">' + pct + '%</span>' +
        '</div>' + ui().pbar(pct, pct === 0 ? '#dfe4ee' : (pct === 100 ? '#0f9d6e' : '')) +
        (exc ? '<div style="margin-top:8px">' + ui().chip('异常 ' + exc, 'warn') + '</div>' : '') +
        '</button>';
    }

    return '<div class="view">' +
      ui().hdr({
        title: b.name,
        sub: '共 ' + b.floors + ' 层 · ' + rooms.length + ' 间',
        back: 'nav:guard.task',
        right: '按楼层抄表'
      }) +
      '<main class="body">' + priceCard + cards +
      '<p class="hint center">点楼层进入该层房间；一层抄完再下一层，避免跳抄漏户</p>' +
      '<button class="btn ghost" style="margin-top:10px" data-act="nav:guard.manage?bld=' + encodeURIComponent(bld) +
      '">房间管理（新增/更换住户，需主管审核）</button></main>' +
      ui().tabbar([
        { label: '任务', icon: 'list', act: 'nav:guard.task' },
        { label: '记录', icon: 'clip', act: 'nav:guard.records' }
      ]) +
      '</div>';
  };

  /* ==================== 房间列表（单层） ==================== */
  P['guard.rooms'] = function (ctx) {
    var d = dom();
    var first = (d.buildingList()[0] || { code: 'A' }).code;
    var bld = (ctx && ctx.params && ctx.params.bld) || first;
    var all = App.store.data.rooms.filter(function (r) { return r.bld === bld; });
    var floor = Number((ctx && ctx.params && ctx.params.floor) || 0);
    if (!floor) {
      var fs = {};
      all.forEach(function (r) { fs[r.floor] = 1; });
      var keys = Object.keys(fs).map(Number).sort(function (a, b) { return a - b; });
      floor = keys[0] || 1;
    }
    var rooms = all.filter(function (r) { return r.floor === floor; });
    var bldName = d.buildingName(bld);
    var period = d.period();
    var doneHere = 0;
    rooms.forEach(function (r) {
      var s0 = d.roomState(r.id, period);
      if (s0 === 'approved' || s0 === 'pending') doneHere++;
    });

    var sorted = rooms.slice().sort(function (a, b) {
      var order = { todo: 0, rejected: 1, exception: 2, pending: 3, approved: 4 };
      var oa = order[d.roomState(a.id, period)] - order[d.roomState(b.id, period)];
      if (oa !== 0) return oa;
      return a.id < b.id ? -1 : 1;
    });

    var lastFloor = null;
    var rows = sorted.map(function (r) {
      var st = d.roomState(r.id, period);
      var emp = d.employeeOf(r.id);
      var chip = {
        todo: '<span class="chip todo">未抄</span>',
        pending: '<span class="chip pri">待复核</span>',
        approved: '<span class="chip done">已抄</span>',
        exception: '<span class="chip warn">异常</span>',
        rejected: '<span class="chip bad">被退回</span>'
      }[st];
      var head = '';
      if (r.floor !== lastFloor) {
        lastFloor = r.floor;
        head = '<div class="floor">' + r.floor + 'F</div>';
      }
      var prev = d.prevOf(period, r.id, 'e');
      return head +
        '<button class="listline" data-act="open-reading:' + r.id + '">' +
        '<span class="roomno ' + (st === 'approved' ? 'done' : '') + '">' + r.id.split('-')[1] + '</span>' +
        '<span class="ll-main"><span class="row" style="gap:7px"><b class="t2">' + r.id + '</b>' + chip + '</span>' +
        '<span class="t1 muted">' + (emp ? emp.name + ' · ' + emp.dept : '空置') + '</span></span>' +
        '<span class="ll-right"><span class="t1 muted">上次</span><b class="t2 num">' + (prev.reading || 0).toFixed(1) + '</b></span>' +
        '<span class="arrow">' + ui().icon('chev', 15) + '</span>' +
        '</button>';
    }).join('');

    var st = d.stats();
    return '<div class="view">' +
      ui().hdr({
        title: bldName + ' · ' + floor + 'F',
        sub: '本层已抄 ' + doneHere + '/' + rooms.length + ' · 全楼 ' + st.done + '/' + st.total,
        back: 'nav:guard.floors?bld=' + encodeURIComponent(bld),
        right: '第 6 天'
      }) +
      '<main class="body"><div class="card" style="padding:2px 12px">' + rows + '</div>' +
      '<p class="hint center">未抄房间排在前面，避免跳抄漏户</p></main>' +
      ui().tabbar([
        { label: '任务', icon: 'list', act: 'nav:guard.task' },
        { label: '记录', icon: 'clip', act: 'nav:guard.records' }
      ]) +
      '</div>';
  };

  /* ==================== 抄表录入（核心页） ==================== */
  P['guard.reading'] = function (ctx) {
    var d = dom();
    var roomId = (ctx && ctx.params && ctx.params.room) || RS.room || 'A-302';
    var period = d.period();
    var room = d.roomOf(roomId);
    if (!room) return '<div class="view">' + ui().empty('房间不存在', '', 'nav:guard.task', '返回任务') + '</div>';
    var emp = d.employeeOf(roomId);
    var e = d.readingOne(period, roomId, 'e');
    var w = d.readingOne(period, roomId, 'w');
    var locked = !!((e && e.locked) || (w && w.locked));
    var prevE = d.prevOf(period, roomId, 'e');
    var prevW = d.prevOf(period, roomId, 'w');
    var dE = d.draftOf(roomId, 'e');
    var dW = d.draftOf(roomId, 'w');
    var valE = RS.values[roomId + ':e'] != null ? RS.values[roomId + ':e']
      : (dE && dE.reading !== '' ? dE.reading : (e ? e.reading : ''));
    var valW = RS.values[roomId + ':w'] != null ? RS.values[roomId + ':w']
      : (dW && dW.reading !== '' ? dW.reading : (w ? w.reading : ''));
    var phE = RS.photos[roomId + ':e'] || (dE && dE.photoId) || (e && (e.photoData || e.photoId)) || '';
    var phW = RS.photos[roomId + ':w'] || (dW && dW.photoId) || (w && (w.photoData || w.photoId)) || '';
    var noteVal = RS.note || (dE && dE.note) || (dW && dW.note) || '';

    function meterCard(type, label, iconName, prev, val, ph) {
      var thumb;
      if (ph && String(ph).indexOf('data:') === 0) {
        thumb = '<button class="thumb has" data-act="photo:' + roomId + ':' + type + '">' +
          '<img src="' + ph + '" alt="表盘照片" style="width:100%;height:100px;object-fit:cover;border-radius:12px" /></button>';
      } else if (ph) {
        thumb = '<button class="thumb has" data-act="photo:' + roomId + ':' + type + '">' + meterThumb(type, val) + '</button>';
      } else {
        thumb = '<button class="thumb" data-act="photo:' + roomId + ':' + type + '">' + ui().icon('cam', 20) + '<span>拍摄' + label + '</span></button>';
      }
      return '<section class="card meter-card" data-type="' + type + '">' +
        '<div class="between" style="margin-bottom:10px">' +
        '<b class="t2">' + ui().icon(iconName, 15) + ' ' + label + '</b>' +
        '<span class="t1 muted">上期读数 <b class="num ink">' + U.round1(prev).toFixed(1) + '</b></span>' +
        '</div>' +
        '<div class="meter-row">' + thumb +
        '<div class="meter-input">' +
        '<div class="t1 muted">本期读数（' + (type === 'w' ? '吨' : '度') + '）</div>' +
        '<input class="numin" id="inp-' + type + '" inputmode="decimal" autocomplete="off" ' +
        'data-room="' + roomId + '" data-type="' + type + '" value="' + (val === '' ? '' : val) + '" placeholder="0.0"' +
        (locked ? ' readonly' : '') + ' />' +
        '<div class="calc" id="calc-' + type + '"></div>' +
        '</div></div></section>';
    }

    return '<div class="view">' +
      ui().hdr({
        title: roomId,
        sub: (emp ? emp.name + ' · ' + emp.dept : '空置'),
        back: 'nav:guard.rooms?bld=' + encodeURIComponent(room.bld) + '&floor=' + room.floor,
        right: '第 6/12 间'
      }) +
      '<main class="body">' +
      '<section class="card mini between">' +
      '<div><div class="t1 muted">上期抄表日</div><b class="t2">2026-10-25</b></div>' +
      '<div class="right"><div class="t1 muted">住户工号</div><b class="t2 num">' + (emp ? emp.id : '—') + '</b></div>' +
      '</section>' +
      meterCard('e', '电表', 'bolt', prevE.reading, valE, phE) +
      meterCard('w', '水表', 'drop', prevW.reading, valW, phW) +
      '<div class="warn" id="warnBox" hidden></div>' +
      '<section class="card">' +
      '<div class="t1 muted" style="margin-bottom:6px">异常备注 <span class="req" id="noteReq" hidden>必填</span></div>' +
      '<textarea id="noteInput" rows="2" placeholder="读数异常时说明原因，例：已电话核对住户，本月开空调取暖">' + U.esc(noteVal) + '</textarea>' +
      '</section>' +
      '<p class="hint center">照片自动叠加：房间号 / 时间 / 抄表员水印</p>' +
      '<div class="t1 center" id="draftTip" hidden style="margin-top:6px;color:#0f9d6e">草稿已自动保存，退出也不会丢</div>' +
      '</main>' +
      '<footer class="footbar">' +
      (locked
        ? '<div class="card" style="margin:0 0 9px;background:var(--ok-bg);border-color:#bfe9d8;color:#0f9d6e;font-size:12.5px">' +
        ui().icon('check', 15) + ' 本间已提交，等待主管审核；审核前不可修改</div>' +
        '<button class="btn ghost" data-act="nav:guard.rooms?bld=' + encodeURIComponent(room.bld) +
        '&floor=' + room.floor + '">返回本层房间</button>'
        : '<div class="between" style="margin-bottom:9px">' +
        '<span class="t2 muted">本户合计</span><b class="total" id="totalTxt">¥0.00</b></div>' +
        '<div class="row" style="gap:10px">' +
        '<button class="btn ghost" style="flex:0 0 112px;font-size:14px" data-act="exc:' + roomId + '">标记异常</button>' +
        '<button class="btn" data-act="save-reading">提交本间</button>' +
        '</div>' +
        '<div class="t1 center" style="color:#98a2b3;margin-top:6px">提交后锁定，需主管审核或退回</div>') +
      '</footer>' +
      (App.guardState.excOpen ? excSheet(roomId) : '') +
      '</div>';
  };

  /* ==================== 标记异常弹层 ==================== */
  var EXC_REASONS = ['住户不在家', '门锁进不去', '表盘看不清', '表被柜子遮挡', '住户拒绝抄表', '其他原因'];

  function excSheet(roomId) {
    var sel = App.guardState.excReason || '';
    var opts = EXC_REASONS.map(function (r) {
      return '<button class="radio ' + (sel === r ? 'on' : '') + '" data-act="exc-reason:' + r + '">' +
        '<span class="c"></span>' + r + '</button>';
    }).join('');
    return '<div class="mask" data-act="exc-close"><div class="sheet" data-act="noop">' +
      '<h3>标记异常</h3>' +
      '<div class="t1 muted">选择原因并上传一张现场照片，房间将进入后台待处理池</div>' +
      opts +
      '<div class="row" style="gap:10px;margin-top:16px">' +
      '<button class="btn ghost" data-act="exc-close">取消</button>' +
      '<button class="btn" data-act="exc-submit">提交</button>' +
      '</div></div></div>';
  }

  /* ==================== 拍照页 ==================== */
  P['guard.camera'] = function (ctx) {
    var room = (ctx && ctx.params && ctx.params.room) || RS.room || 'A-302';
    var type = (ctx && ctx.params && ctx.params.type) || RS.photoType || 'e';
    var label = type === 'w' ? '水表' : '电表';
    var prev = dom().prevOf(dom().period(), room, type);
    RS.photoType = type;
    RS.room = room;
    var shotVal = RS.values[room + ':' + type];
    if (shotVal === '' || shotVal == null) shotVal = U.round1(prev.reading + 5);
    return '<div class="view">' +
      ui().hdr({
        title: '拍摄' + label,
        sub: room + ' · 把表盘数字对准框内',
        back: 'nav:guard.reading?room=' + room
      }) +
      '<div class="camera-screen">' +
      '<div class="viewfinder">' +
      '<div class="frame"></div>' +
      '<div class="big-meter">' + meterThumb(type, shotVal) + '</div>' +
      '<span class="cam-badge">● 自动对焦</span>' +
      '<span class="cam-sim">演示用模拟表盘 · 真机调用相机</span>' +
      '</div>' +
      '<div class="cam-tip">水印将自动叠加：房间号 / 时间 / 抄表员</div>' +
      '<div style="padding:0 18px 12px">' +
      '<button class="btn" data-act="ocr-upload" style="margin-bottom:10px">上传照片，自动识别读数</button>' +
      '<div class="t1" style="color:#8ea0bf;text-align:center;margin-bottom:12px">识别不准则由安保手动修改</div>' +
      '<input type="file" id="ocrFile" accept="image/*" hidden />' +
      '<div class="cam-actions" style="padding:0">' +
      '<button class="btn ghost" data-act="nav:guard.camera?room=' + room + '&type=' + type + '" style="background:rgba(255,255,255,.1);border:0;color:#fff">重拍</button>' +
      '<button class="btn" data-act="use-photo">使用照片</button>' +
      '</div></div></div></div>';
  };

  function meterThumb(type, val) {
    return ui().meter(type, val);
  }

  M['guard.reading'] = function () {
    var roomId = RS.room;
    if (!roomId) return;
    var d = dom();
    var persist = App.util.debounce(function () {
      ['e', 'w'].forEach(function (type) {
        var inp = document.getElementById('inp-' + type);
        if (inp) d.saveDraft(roomId, type, { reading: inp.value });
      });
      var nt = document.getElementById('noteInput');
      if (nt) {
        ['e', 'w'].forEach(function (type) { d.saveDraft(roomId, type, { note: nt.value }); });
      }
      var tip = document.getElementById('draftTip');
      if (tip) {
        tip.hidden = false;
        tip.textContent = '草稿已自动保存 ' + new Date().toTimeString().slice(0, 5) + '，退出也不会丢';
      }
    }, 400);

    var inputs = document.querySelectorAll('.numin');
    Array.prototype.forEach.call(inputs, function (inp) {
      inp.addEventListener('input', function () {
        RS.values[roomId + ':' + inp.dataset.type] = inp.value;
        recompute(roomId);
        persist();
      });
    });
    var note = document.getElementById('noteInput');
    if (note) note.addEventListener('input', function () { RS.note = note.value; persist(); });
    recompute(roomId);
  };

  function recompute(roomId) {
    var d = dom();
    var period = d.period();
    var res = {};
    ['e', 'w'].forEach(function (type) {
      var inp = document.getElementById('inp-' + type);
      if (!inp) return;
      var prev = d.prevOf(period, roomId, type);
      var v = U.validate({
        prevReading: prev.reading,
        reading: inp.value === '' ? '' : Number(inp.value),
        lastUsage: prev.usage,
        hasPhoto: true
      });
      var usage = v.usage || 0;
      var price = d.priceOf(period, (d.roomOf(roomId) || {}).bld);
      var amount = price ? U.amountOf(usage * 10, type === 'e' ? price.electricity : price.water) : 0;
      res[type] = { usage: usage, amount: amount, warnings: v.warnings, block: v.block };
      if (inp) {
        if (v.block) inp.classList.add('err');
        else inp.classList.remove('err');
      }
      var calc = document.getElementById('calc-' + type);
      if (calc) {
        calc.innerHTML = '<b class="num">' + usage.toFixed(1) + '</b> ' + (type === 'w' ? '吨' : '度') +
          ' × ' + (price ? (type === 'e' ? price.electricity : price.water) / 100 : 0).toFixed(2) +
          ' = <b class="num bad">¥' + U.fmtMoney(amount) + '</b>';
      }
    });
    var total = (res.e ? res.e.amount : 0) + (res.w ? res.w.amount : 0);
    var tt = document.getElementById('totalTxt');
    if (tt) tt.textContent = '¥' + U.fmtMoney(total);

    var warns = [];
    if (res.e) warns = warns.concat(res.e.warnings);
    if (res.w) warns = warns.concat(res.w.warnings);
    var box = document.getElementById('warnBox');
    var req = document.getElementById('noteReq');
    var needNote = warns.some(function (x) { return x.level === 'warn'; });
    if (req) req.hidden = !needNote;
    if (box) {
      if (warns.length) {
        box.hidden = false;
        box.className = 'warn ' + (warns.some(function (x) { return x.level === 'block'; }) ? 'block' : 'soft');
        box.innerHTML = warns.map(function (x) { return '<div>' + ui().icon('warn', 14) + ' ' + x.msg + '</div>'; }).join('');
      } else {
        box.hidden = true;
      }
    }
    RS.warn[roomId] = warns;
  }

  /* ==================== 记录 ==================== */
  P['guard.records'] = function () {
    var d = dom();
    var period = d.period();
    var list = App.store.data.readings.filter(function (r) {
      return r.period === period && r.meterType !== 'both' && r.status !== 'exception' && r.operator === '李强';
    }).sort(function (a, b) { return a.shotAt < b.shotAt ? 1 : -1; }).slice(0, 12);

    var rows = list.map(function (r) {
      var st = r.status === 'approved' ? '<span class="chip done">已上传</span>'
        : r.status === 'rejected' ? '<span class="chip bad">被退回</span>'
          : '<span class="chip pri">待复核</span>';
      return '<div class="listline static">' +
        '<b class="t2" style="width:64px">' + r.roomId + '</b>' +
        '<span class="ll-main"><span class="t2">' + (r.meterType === 'e' ? '电表' : '水表') + '</span>' +
        '<span class="t1 muted">' + U.fmtDT(r.shotAt) + '</span></span>' +
        '<span class="t2 num">' + (r.reading == null ? '—' : r.reading) + '</span>' + st +
        '</div>';
    }).join('');

    return '<div class="view">' +
      ui().hdr({ title: '抄表记录', sub: '今日已抄 ' + list.length + ' 条', back: 'nav:guard.task' }) +
      '<main class="body">' +
      '<div class="card notice">' + ui().icon('clock', 15) + ' 离线也能抄，联网自动补传</div>' +
      '<div class="card" style="padding:2px 12px">' + (rows || ui().empty('还没有记录')) + '</div>' +
      '<section class="card"><div class="t2"><b>修改规则</b></div>' +
      '<ul class="rules"><li>已提交读数可改，但必须填写原因</li><li>每次修改记录「谁、几点、改前、改后」</li>' +
      '<li>复核通过后，仅主管有权修改</li></ul></section>' +
      '</main>' +
      ui().tabbar([
        { label: '任务', icon: 'list', act: 'nav:guard.task' },
        { label: '记录', icon: 'clip', act: 'nav:guard.records', active: true }
      ]) +
      '</div>';
  };

  App.guardState = RS;
})(typeof window !== 'undefined' ? window : globalThis);

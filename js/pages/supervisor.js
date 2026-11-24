/* 主管视角：工作台 / 抄表审核 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  function svNav(active) {
    return '<div class="subnav">' +
      '<button class="' + (active === 'dash' ? 'on' : '') + '" data-act="nav:supervisor.dash">工作台</button>' +
      '<button class="' + (active === 'review' ? 'on' : '') + '" data-act="nav:supervisor.review">抄表审核</button>' +
      '<button class="' + (active === 'rooms' ? 'on' : '') + '" data-act="nav:supervisor.rooms">房间审核</button>' +
      '<button class="' + (active === 'blddetail' ? 'on' : '') + '" data-act="nav:supervisor.blddetail">楼栋明细</button>' +
      '</div>';
  }

  /* ==================== 房间变更审核 ==================== */
  P['supervisor.rooms'] = function () {
    var d = dom();
    var pend = d.pendingRoomRequests();
    var hist = d.roomRequestsAll().filter(function (r) { return r.status !== 'pending'; })
      .sort(function (a, b) { return a.reviewedAt < b.reviewedAt ? 1 : -1; }).slice(0, 10);

    var rows = pend.map(function (r) {
      return '<tr>' +
        '<td class="b">' + U.esc(r.roomId) + '</td>' +
        '<td>' + U.esc(r.buildingName || r.building) + '</td>' +
        '<td class="num">' + r.floor + 'F</td>' +
        '<td>' + (r.action === 'add' ? ui().chip('新增', 'pri') : ui().chip('修改', 'todo')) + '</td>' +
        '<td>' + U.esc(r.employee.name) + '<div class="t1 muted">' + U.esc(r.employee.dept || '—') + '</div></td>' +
        '<td class="muted">' + (r.before && r.before.name ? U.esc(r.before.name) : '—') + '</td>' +
        '<td class="muted">' + U.esc(r.requestedBy) + '<div class="t1 muted">' + U.fmtDT(r.requestedAt) + '</div></td>' +
        '<td style="white-space:nowrap">' +
        '<button class="btn sm" data-act="room-approve:' + r.id + '">通过</button> ' +
        '<button class="btn sm danger" data-act="room-reject:' + r.id + '">驳回</button></td>' +
        '</tr>';
    }).join('');

    var histRows = hist.map(function (r) {
      return '<tr><td class="b">' + U.esc(r.roomId) + '</td><td>' + U.esc(r.buildingName || r.building) + '</td>' +
        '<td>' + U.esc(r.employee.name) + '</td>' +
        '<td>' + (r.status === 'approved' ? ui().chip('已通过', 'done') : ui().chip('已驳回', 'bad')) + '</td>' +
        '<td class="muted">' + U.esc(r.reviewedBy || '—') + '</td>' +
        '<td class="muted num">' + U.fmtDT(r.reviewedAt) + '</td>' +
        '<td class="muted">' + U.esc(r.reviewNote || '') + '</td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + svNav('rooms') +
      '<div class="panel"><div class="ph">待审核的房间变更（' + pend.length + '）</div>' +
      '<div class="note-bar">保安提交的新增/更换住户，需主管通过后才写入房间台账。驳回必须填理由。</div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>楼栋</th><th>楼层</th><th>类型</th><th>新住户</th>' +
      '<th>原住户</th><th>提交人</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="8" class="muted center" style="padding:26px">没有待审核的房间变更</td></tr>') +
      '</tbody></table></div>' +
      '<div class="panel"><div class="ph">处理记录</div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>楼栋</th><th>住户</th><th>结果</th>' +
      '<th>审核人</th><th>时间</th><th>备注</th></tr></thead>' +
      '<tbody>' + (histRows || '<tr><td colspan="7" class="muted center" style="padding:22px">暂无记录</td></tr>') +
      '</tbody></table></div>' +
      '</div></div>';
  };

  // 有原图显示原图，否则显示示意表盘
  function thumbOf(rec, type) {
    if (rec && rec.photoData && String(rec.photoData).indexOf('data:') === 0) {
      return '<span class="mini-meter"><img src="' + rec.photoData + '" alt="原图" ' +
        'style="width:46px;height:50px;object-fit:cover;border-radius:6px;border:1px solid #e8ebf1" /></span>';
    }
    return '<span class="mini-meter">' + ui().meter(type, rec ? rec.reading : '') + '</span>';
  }

  /* ==================== 工作台 ==================== */
  P['supervisor.dash'] = function () {
    var d = dom();
    var s = d.stats();
    var blds = d.buildings();
    var pendingBills = Math.max(0, s.approved - s.bills);

    var kpis = [
      { lab: '本月抄表进度', val: s.done, unit: '/ ' + s.total + ' 间', trend: s.pct + '%，剩余 ' + (s.total - s.done) + ' 间' },
      { lab: '待复核', val: s.pending, unit: '单', trend: '主管待处理' },
      { lab: '异常待处理', val: s.exception, unit: '单', trend: '无人 / 看不清 / 估抄嫌疑' },
      { lab: '待出账', val: pendingBills, unit: '户', trend: '已复核但未生成账单' }
    ].map(function (k) {
      return '<div class="kpi"><div class="lab">' + k.lab + '</div>' +
        '<div class="val num">' + k.val + '<small>' + k.unit + '</small></div>' +
        '<div class="trend">' + k.trend + '</div></div>';
    }).join('');

    var bars = blds.map(function (b) {
      return '<div style="padding:7px 0"><div class="between" style="margin-bottom:5px">' +
        '<span class="t2">' + b.name + '</span>' +
        '<span class="t1 muted num">' + b.done + '/' + b.total + ' · ' + b.pct + '%</span></div>' +
        ui().pbar(b.pct, b.pct === 0 ? '#dfe4ee' : '') + '</div>';
    }).join('');

    var tl = [
      { d: '11-20', t: '生成抄表任务', s: 'ok', m: blds.length + ' 个楼栋 · ' + s.total + ' 间' },
      { d: '11-21', t: '安保上门抄表', s: s.todo > 0 ? 'now' : 'ok', m: '已抄 ' + s.done + ' 间' + (s.todo > 0 ? '，进行中' : '，已完成') },
      { d: '11-28', t: '抄表截止 + 主管复核', s: s.pending > 0 ? 'now' : '', m: '待复核 ' + s.pending + ' 条' },
      { d: '11-29', t: '系统自动出账', s: s.bills > 0 ? 'ok' : '', m: s.bills > 0 ? ('已生成 ' + s.bills + ' 户') : '待开始' },
      { d: '11-29', t: '账单公示 3 天', s: s.public > 0 ? 'now' : '', m: '待确认 ' + s.public + ' 户' },
      { d: '12-10', t: '财务工资代扣', s: s.deducted > 0 ? 'ok' : '', m: '已代扣 ' + s.deducted + ' 户' }
    ].map(function (x) {
      return '<li class="' + x.s + '"><span class="d"></span><div style="flex:1">' +
        '<div class="between"><span class="t2"><b>' + x.t + '</b></span><span class="t1 muted num">' + x.d + '</span></div>' +
        '<div class="t1 muted">' + x.m + '</div></div></li>';
    }).join('');

    var recent = d.pendingReadings().slice(0, 6).map(function (r) {
      var emp = d.employeeOf(r.roomId);
      return '<tr><td class="b">' + r.roomId + '</td><td>' + (emp ? emp.name : '—') + '</td>' +
        '<td class="num">' + (r.meterType === 'e' ? '电' : '水') + '</td>' +
        '<td class="num">' + r.prevReading + ' → <b>' + r.reading + '</b></td>' +
        '<td class="num">' + r.usage + '</td>' +
        '<td>' + (r.warnings && r.warnings.length ? ui().chip('需核对', 'warn') : ui().chip('正常', 'todo')) + '</td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + svNav('dash') +
      '<div class="kpis">' + kpis + '</div>' +
      '<div class="cols">' +
      '<div class="panel"><div class="ph">楼栋抄表进度</div><div style="padding:6px 16px 12px">' + bars + '</div></div>' +
      '<div class="panel"><div class="ph">本期流程</div><ul class="timeline">' + tl + '</ul></div>' +
      '</div>' +
      '<div class="panel"><div class="ph">最近提交的读数' +
      '<div class="r"><button class="btn sm soft" data-act="nav:supervisor.review">去复核</button></div></div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>住户</th><th>表</th><th>上期 → 本期</th><th>用量</th><th>校验</th></tr></thead>' +
      '<tbody>' + (recent || '<tr><td colspan="6" class="muted center">暂无待复核记录</td></tr>') + '</tbody></table></div>' +
      '</div></div>';
  };

  /* ==================== 抄表审核 ==================== */
  P['supervisor.review'] = function () {
    var d = dom();
    var period = d.period();
    var rooms = d.pendingRooms(period);
    var exceptions = App.store.data.readings.filter(function (r) {
      return r.period === period && r.status === 'exception';
    });

    var rows = rooms.map(function (room) {
      var e = d.readingOne(period, room.id, 'e');
      var w = d.readingOne(period, room.id, 'w');
      var emp = d.employeeOf(room.id);
      var warns = [].concat((e && e.warnings) || [], (w && w.warnings) || []);
      var warn = warns.length ? ui().chip('需核对', 'warn') : ui().chip('正常', 'todo');
      var note = (e && e.note) || (w && w.note) || '';
      return '<tr>' +
        '<td><span class="thumbs">' +
        thumbOf(e, 'e') + thumbOf(w, 'w') +
        '</span></td>' +
        '<td class="b">' + room.id + '</td>' +
        '<td>' + (emp ? emp.name : '—') + '</td>' +
        '<td class="num">' + (e ? e.prevReading + ' → <b>' + e.reading + '</b>' : '—') + '</td>' +
        '<td class="num">' + (w ? w.prevReading + ' → <b>' + w.reading + '</b>' : '—') + '</td>' +
        '<td>' + warn + (note ? '<div class="t1 muted">' + U.esc(note) + '</div>' : '') + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button class="btn sm soft" data-act="approve-room:' + room.id + '">通过</button> ' +
        '<button class="btn sm danger" data-act="reject-room:' + room.id + '">退回</button></td>' +
        '</tr>';
    }).join('');

    var excRows = exceptions.map(function (r) {
      var emp = d.employeeOf(r.roomId);
      return '<tr><td class="b">' + r.roomId + '</td><td>' + (emp ? emp.name : '—') + '</td>' +
        '<td>' + ui().chip(r.exceptionReason || '未填原因', 'warn') + '</td>' +
        '<td class="num">' + U.fmtDT(r.shotAt) + '</td>' +
        '<td><button class="btn sm soft" data-act="toast:已通知安保补抄">安排补抄</button></td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + svNav('review') +
      '<div class="panel"><div class="ph">待复核清单（' + rooms.length + ' 间）' +
      '<div class="r">' + ui().chip('异常 ' + exceptions.length, 'warn') +
      '<button class="btn sm ghost" data-act="approve-all">批量通过（无预警）</button></div></div>' +
      '<div class="note-bar">缩略图即表盘照片（左电右水）；标黄的说明读数比上月异常，需先看备注。</div>' +
      '<table class="tbl"><thead><tr><th>表盘</th><th>房间</th><th>住户</th><th>电（上期→本期）</th><th>水（上期→本期）</th><th>校验</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" class="muted center" style="padding:26px">全部复核完毕 🎉</td></tr>') + '</tbody></table></div>' +

      '<div class="panel"><div class="ph">异常待处理（' + exceptions.length + '）</div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>住户</th><th>原因</th><th>标记时间</th><th>操作</th></tr></thead>' +
      '<tbody>' + (excRows || '<tr><td colspan="5" class="muted center" style="padding:22px">没有异常单</td></tr>') + '</tbody></table></div>' +
      '</div></div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);

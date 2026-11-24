/* 楼栋明细查询：安全主管与物业管家共用同一份实现 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  function render(ctx) {
    var d = dom();
    var role = (ctx && ctx.role) || 'supervisor';
    var first = (d.buildingList()[0] || { code: 'A' }).code;
    var bld = (ctx && ctx.params && ctx.params.bld) || first;
    var b = d.buildingOf(bld) || { code: bld, name: bld, floors: 0 };
    var period = d.period();
    var key = role === 'manager' ? 'manager.blddetail' : 'supervisor.blddetail';

    var rooms = App.store.data.rooms.filter(function (r) { return r.bld === bld; });
    var occupied = 0, done = 0, exc = 0, amountAll = 0;

    var rows = rooms.map(function (r) {
      if (r.status === 'occupied') occupied++;
      var st = d.roomState(r.id, period);
      if (st === 'approved' || st === 'pending') done++;
      if (st === 'exception') exc++;
      var emp = d.employeeOf(r.id);
      var e = d.readingOne(period, r.id, 'e');
      var w = d.readingOne(period, r.id, 'w');
      var bill = d.billOf(period, r.id);
      if (bill) amountAll += bill.total;
      var chip = {
        todo: ui().chip('未抄', 'todo'),
        pending: ui().chip('待复核', 'pri'),
        approved: ui().chip('已抄', 'done'),
        exception: ui().chip('异常', 'warn'),
        rejected: ui().chip('被退回', 'bad')
      }[st] || ui().chip('未抄', 'todo');

      return '<tr>' +
        '<td class="b">' + r.id + '</td>' +
        '<td>' + (emp ? U.esc(emp.name) : '<span class="muted">空置</span>') + '</td>' +
        '<td class="num">' + (e ? e.prevReading + ' → ' + e.reading : '—') + '</td>' +
        '<td class="num">' + (w ? w.prevReading + ' → ' + w.reading : '—') + '</td>' +
        '<td class="num">' + (e ? e.usage : '—') + ' / ' + (w ? w.usage : '—') + '</td>' +
        '<td class="num b">' + (bill ? ui().money(bill.total) : '—') + '</td>' +
        '<td>' + chip + '</td>' +
        '</tr>';
    }).join('');

    var tabs = d.buildingList().map(function (x) {
      return '<button class="' + (x.code === bld ? 'on' : '') + '" data-act="nav:' + key +
        '?bld=' + encodeURIComponent(x.code) + '">' + U.esc(x.name) + '</button>';
    }).join('');

    return '<div class="view wide"><div class="body">' +
      '<div class="subnav" style="flex-wrap:wrap;max-width:100%">' + tabs + '</div>' +
      '<div class="kpis">' +
      '<div class="kpi"><div class="lab">房间数</div><div class="val num">' + rooms.length +
      '<small>间</small></div><div class="trend">在住 ' + occupied + ' 间</div></div>' +
      '<div class="kpi"><div class="lab">本期已抄</div><div class="val num">' + done +
      '<small>间</small></div><div class="trend">' + U.pct(done, rooms.length) + '%</div></div>' +
      '<div class="kpi"><div class="lab">异常</div><div class="val num">' + exc +
      '<small>间</small></div><div class="trend">需补抄或处理</div></div>' +
      '<div class="kpi"><div class="lab">本期账单合计</div><div class="val num">' + U.fmtMoney(amountAll) +
      '<small>元</small></div><div class="trend">已出账部分</div></div>' +
      '</div>' +
      '<div class="panel"><div class="ph">' + U.esc(b.name) + ' · 明细（' + period + '）</div>' +
      '<div class="note-bar">按楼栋查看房间的读数、用量与金额；数据与抄表、账单同源，不另算一套。</div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>住户</th><th>电（上期→本期）</th><th>水（上期→本期）</th>' +
      '<th>用量（度/吨）</th><th>本期金额</th><th>状态</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" class="muted center" style="padding:24px">本楼栋没有房间</td></tr>') +
      '</tbody></table></div>' +
      '</div></div>';
  }

  P['supervisor.blddetail'] = render;
  P['manager.blddetail'] = render;
})(typeof window !== 'undefined' ? window : globalThis);

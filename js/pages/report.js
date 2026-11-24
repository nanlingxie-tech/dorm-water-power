/* 楼栋明细：安全主管与物业管家共用同一份实现
 * 展示思路：先看整体（进度/异常/金额），再看楼层，最后看单间。
 * 手机上不横向滚动，一屏能扫完。
 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  var CHIP = {
    todo: ['未抄', 'todo'],
    pending: ['待复核', 'pri'],
    approved: ['已抄', 'done'],
    exception: ['异常', 'warn'],
    rejected: ['被退回', 'bad']
  };

  function render(ctx) {
    var d = dom();
    var role = (ctx && ctx.role) || 'supervisor';
    var params = (ctx && ctx.params) || {};
    var first = (d.buildingList()[0] || { code: 'A' }).code;
    var bld = params.bld || first;
    var b = d.buildingOf(bld) || { code: bld, name: bld, floors: 0 };
    var period = params.period || d.period();
    var filter = params.filter || 'all';
    var key = role === 'manager' ? 'manager.blddetail' : 'supervisor.blddetail';

    var rooms = App.store.data.rooms.filter(function (r) { return r.bld === bld; });
    var occupied = 0, done = 0, exc = 0, amountAll = 0;

    var cards = rooms.map(function (r) {
      var st = d.roomState(r.id, period);
      if (r.status === 'occupied') occupied++;
      if (st === 'approved' || st === 'pending') done++;
      if (st === 'exception') exc++;
      var bill = d.billOf(period, r.id);
      if (bill) amountAll += bill.total;
      return { room: r, st: st, bill: bill, emp: d.employeeOf(r.id),
               e: d.readingOne(period, r.id, 'e'), w: d.readingOne(period, r.id, 'w') };
    });

    var shown = cards.filter(function (c) {
      if (filter === 'todo') return c.st === 'todo';
      if (filter === 'exception') return c.st === 'exception';
      if (filter === 'billed') return !!c.bill;
      return true;
    });

    var floors = {};
    shown.forEach(function (c) {
      var f = c.room.floor || 1;
      (floors[f] = floors[f] || []).push(c);
    });
    var floorKeys = Object.keys(floors).map(Number).sort(function (a, b) { return a - b; });

    var blocks = floorKeys.map(function (f) {
      var list = floors[f].sort(function (a, b) { return a.room.id < b.room.id ? -1 : 1; });
      var fDone = list.filter(function (c) { return c.st === 'approved' || c.st === 'pending'; }).length;
      var fExc = list.filter(function (c) { return c.st === 'exception'; }).length;

      var rows = list.map(function (c) {
        var chip = CHIP[c.st] || CHIP.todo;
        var amt = c.bill ? U.fmtMoney(c.bill.total) : '';
        return '<div class="rmcard' + (c.st === 'exception' ? ' is-exc' : '') +
          (c.st === 'approved' ? ' is-done' : '') + '">' +
          '<div class="rm-top"><b class="rm-no">' + c.room.id + '</b>' +
          ui().chip(chip[0], chip[1]) + '</div>' +
          '<div class="rm-name">' + (c.emp ? U.esc(c.emp.name) : '空置') + '</div>' +
          '<div class="rm-usage">' +
          '<span>电 <b>' + (c.e ? c.e.usage : '—') + '</b> 度</span>' +
          '<span>水 <b>' + (c.w ? c.w.usage : '—') + '</b> 吨</span>' +
          '</div>' +
          '<div class="rm-foot">' +
          (amt ? '<span class="rm-amt">' + amt + '</span>' : '<span class="rm-amt none">未出账</span>') +
          (c.e && c.e.reading != null
            ? '<span class="rm-read num">' + c.e.reading + '</span>' : '') +
          '</div>' +
          '</div>';
      }).join('');

      return '<section class="floorblock">' +
        '<div class="floorhead"><b>' + f + 'F</b>' +
        '<span class="fh-sub">' + fDone + '/' + list.length + ' 已抄' +
        (fExc ? ' · <i class="fh-exc">' + fExc + ' 异常</i>' : '') + '</span></div>' +
        '<div class="roomgrid">' + rows + '</div>' +
        '</section>';
    }).join('');

    var tabs = d.buildingList().map(function (x) {
      return '<button class="' + (x.code === bld ? 'on' : '') + '" data-act="nav:' + key +
        '?bld=' + encodeURIComponent(x.code) + '">' + U.esc(x.name) + '</button>';
    }).join('');

    var filters = [['all', '全部'], ['todo', '只看未抄'], ['exception', '只看异常'], ['billed', '只看已出账']]
      .map(function (f) {
        return '<button class="' + (filter === f[0] ? 'on' : '') + '" data-act="nav:' + key +
          '?bld=' + encodeURIComponent(bld) + '&period=' + period + '&filter=' + f[0] + '">' + f[1] + '</button>';
      }).join('');

    var pct = U.pct(done, rooms.length);

    return '<div class="view wide"><div class="body">' +
      '<div class="subnav" style="flex-wrap:wrap;max-width:100%">' + tabs + '</div>' +
      ui().periodChips(d.periods(), period, key, { bld: bld }) +

      '<section class="ovcard">' +
      '<div class="ov-left">' +
      '<div class="ov-pct num">' + pct + '<small>%</small></div>' +
      '<div class="ov-lab">本期抄表进度</div>' +
      '<div class="pbar ov-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>' +
      '<div class="ov-grid">' +
      '<div class="ov-item"><span class="ov-k">应抄</span><b class="num">' + rooms.length + '</b><span class="ov-u">间</span></div>' +
      '<div class="ov-item"><span class="ov-k">已抄</span><b class="num">' + done + '</b><span class="ov-u">间</span></div>' +
      '<div class="ov-item' + (exc ? ' warn' : '') + '"><span class="ov-k">异常</span><b class="num">' + exc + '</b><span class="ov-u">间</span></div>' +
      '<div class="ov-item"><span class="ov-k">在住</span><b class="num">' + occupied + '</b><span class="ov-u">间</span></div>' +
      '</div>' +
      '<div class="ov-amt"><span class="ov-k">本期账单合计</span><b class="num">' + U.fmtMoney(amountAll) + '</b><span class="ov-u">元</span></div>' +
      '</section>' +

      '<div class="filterbar">' + filters + '</div>' +
      '<div class="bld-caption">' + U.esc(b.name) + ' · ' + period +
      '　共 ' + shown.length + ' 间' + (filter === 'all' ? '' : '（已筛选）') + '</div>' +

      (blocks || '<div class="empty"><div class="empty-ic">' + ui().icon('list', 26) + '</div>' +
        '<div class="empty-t">没有符合条件的房间</div>' +
        '<div class="empty-d">换个筛选条件试试，或切换到其他楼栋</div></div>') +
      '</div></div>';
  }

  P['supervisor.blddetail'] = render;
  P['manager.blddetail'] = render;
})(typeof window !== 'undefined' ? window : globalThis);

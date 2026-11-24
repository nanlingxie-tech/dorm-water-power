/* 管理员视角：审批中心（单价变更；后续房间变更也走这里） */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  function nav(active) {
    var items = [
      { k: 'approvals', t: '待审批' }
    ];
    return '<div class="subnav">' + items.map(function (it) {
      return '<button class="' + (it.k === active ? 'on' : '') + '" data-act="nav:admin.' + it.k + '">' + it.t + '</button>';
    }).join('') + '</div>';
  }

  P['admin.approvals'] = function () {
    var d = dom();
    var pending = d.pendingPriceRequests();
    var all = d.priceRequestsAll().slice().sort(function (a, b) {
      return a.requestedAt < b.requestedAt ? 1 : -1;
    });

    var cents = function (v) { return v == null ? '—' : (v / 100).toFixed(2); };

    var rows = pending.map(function (r) {
      return '<tr>' +
        '<td class="b">' + U.esc(r.buildingName || r.building) + '</td>' +
        '<td class="num">' + r.period + '</td>' +
        '<td class="num">' + cents(r.beforeE) + ' → <b class="bad">' + cents(r.electricity) + '</b></td>' +
        '<td class="num">' + cents(r.beforeW) + ' → <b class="bad">' + cents(r.water) + '</b></td>' +
        '<td>' + U.esc(r.reason || '—') + '</td>' +
        '<td class="muted">' + U.esc(r.requestedBy) + '<div class="t1 muted">' + U.fmtDT(r.requestedAt) + '</div></td>' +
        '<td style="white-space:nowrap">' +
        '<button class="btn sm" data-act="price-approve:' + r.id + '">批准</button> ' +
        '<button class="btn sm danger" data-act="price-reject:' + r.id + '">驳回</button></td>' +
        '</tr>';
    }).join('');

    var history = all.filter(function (x) { return x.status !== 'pending'; }).slice(0, 10).map(function (r) {
      return '<tr><td>' + U.esc(r.buildingName || r.building) + '</td>' +
        '<td class="num">' + r.period + '</td>' +
        '<td class="num">' + cents(r.electricity) + ' / ' + cents(r.water) + '</td>' +
        '<td>' + (r.status === 'approved' ? ui().chip('已批准', 'done') : ui().chip('已驳回', 'bad')) + '</td>' +
        '<td class="muted">' + U.esc(r.reviewedBy || '—') + '</td>' +
        '<td class="muted num">' + U.fmtDT(r.reviewedAt) + '</td>' +
        '<td class="muted">' + U.esc(r.reviewNote || '') + '</td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + nav('approvals') +
      '<div class="panel"><div class="ph">待审批（' + pending.length + '）</div>' +
      '<div class="note-bar">物业管家提交的单价变更，必须经管理员批准后才会生效；批准前系统仍按原单价出账。</div>' +
      '<table class="tbl"><thead><tr><th>楼栋</th><th>账期</th><th>电价（元/度）</th><th>水价（元/吨）</th>' +
      '<th>变更原因</th><th>申请人</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" class="muted center" style="padding:26px">没有待审批事项</td></tr>') +
      '</tbody></table></div>' +
      '<div class="panel"><div class="ph">处理记录</div>' +
      '<table class="tbl"><thead><tr><th>楼栋</th><th>账期</th><th>新单价（电/水）</th><th>结果</th>' +
      '<th>审批人</th><th>时间</th><th>备注</th></tr></thead>' +
      '<tbody>' + (history || '<tr><td colspan="7" class="muted center" style="padding:22px">暂无记录</td></tr>') +
      '</tbody></table></div>' +
      '</div></div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);

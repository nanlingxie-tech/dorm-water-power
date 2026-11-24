/* 财务视角：代扣清单与导出 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  P['finance.deduct'] = function (ctx) {
    var d = dom();
    var period = (ctx && ctx.params && ctx.params.period) || d.period();
    var s = d.stats(period);
    var list = d.deductList(period);
    var total = list.reduce(function (a, b) { return a + b.amount; }, 0);

    var rows = list.slice(0, 40).map(function (x) {
      return '<tr><td class="num">' + x.empId + '</td><td>' + x.name + '</td>' +
        '<td class="muted">' + x.dept + '</td><td class="num">' + x.range + '</td>' +
        '<td class="num b">' + U.fmtMoney(x.amount) + '</td></tr>';
    }).join('');

    var body;
    if (!list.length) {
      body = '<div class="panel"><div class="ph">代扣清单（' + period + '）</div>' +
        '<div class="empty"><div class="empty-ic">' + ui().icon('money', 26) + '</div>' +
        '<div class="empty-t">暂无可代扣账单</div>' +
        '<div class="empty-d">代扣清单只包含「已确认」或「公示期满无异议」的账单。<br>' +
        '当前：已生成 ' + s.bills + ' 户、已确认 ' + s.confirmed + ' 户、待确认 ' + s.public + ' 户</div>' +
        (s.bills ? '<button class="btn sm ghost" data-act="skip-publicity">模拟公示期结束</button>' : '') +
        '</div></div>';
    } else {
      body = '<div class="kpis">' +
        '<div class="kpi"><div class="lab">可代扣户数</div><div class="val num">' + list.length + '<small>户</small></div><div class="trend">仅含已确认/公示期满</div></div>' +
        '<div class="kpi"><div class="lab">扣款合计</div><div class="val num">' + U.fmtMoney(total) + '<small>元</small></div><div class="trend">费用期间 ' + U.periodRange(period).start + ' ~ ' + U.periodRange(period).end + '</div></div>' +
        '<div class="kpi"><div class="lab">已确认</div><div class="val num">' + s.confirmed + '<small>户</small></div><div class="trend">员工主动确认</div></div>' +
        '<div class="kpi"><div class="lab">申诉中</div><div class="val num">' + s.disputed + '<small>户</small></div><div class="trend">已剔除，不代扣</div></div>' +
        '</div>' +
        '<div class="panel"><div class="ph">代扣清单（' + period + '）' +
        '<div class="r"><button class="btn sm ghost" data-act="export-csv">导出 Excel(CSV)</button>' +
        '<button class="btn sm" data-act="mark-deducted">标记已代扣</button></div></div>' +
        '<div class="note-bar">导出列：工号 · 姓名 · 部门 · 费用期间 · 金额，可直接导入工资系统。</div>' +
        '<div class="table-scroll"><table class="tbl"><thead><tr><th>工号</th><th>姓名</th><th>部门</th><th>费用期间</th><th>扣款金额(元)</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        (list.length > 40 ? '<div class="note-bar">仅显示前 40 户</div>' : '') +
        '</div>';
    }

    return '<div class="view wide"><div class="body">' +
      ui().periodChips(d.periods(), period, 'finance.deduct') + body +
      '<div class="panel"><div class="ph">导出记录</div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>文件名</th><th>期间</th><th>条数</th><th>导出人</th><th>时间</th></tr></thead><tbody>' +
      '<tr><td>代扣清单_' + period + '.csv</td><td>' + period + '</td><td class="num">' + list.length + '</td><td>财务</td><td class="num">' + U.fmtDT(U.nowISO()) + '</td></tr>' +
      '</tbody></table></div></div>' +
      '</div></div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);

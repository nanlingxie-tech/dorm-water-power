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

    var logs = (App.store.data.exports || []).slice(0, 10);
    var logRows = logs.map(function (l) {
      return '<tr><td><button class="linkbtn" data-act="nav:finance.exportlog?id=' + l.id + '">' +
        U.esc(l.file) + '</button></td>' +
        '<td>' + l.period + '</td><td class="num">' + l.count + '</td>' +
        '<td>' + U.esc(l.by) + '</td><td class="num">' + U.fmtDT(l.at) + '</td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' +
      ui().periodChips(d.periods(), period, 'finance.deduct') + body +
      '<div class="panel"><div class="ph">导出记录' +
      '<div class="r"><button class="btn sm" data-act="export-csv:' + period + '">导出本期.csv</button></div></div>' +
      '<div class="note-bar">点文件名可查看该次导出的详情，并可重新导出。</div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>文件名</th><th>期间</th><th>条数</th><th>导出人</th><th>时间</th></tr></thead><tbody>' +
      (logRows || '<tr><td colspan="5" class="muted center" style="padding:22px">还没有导出记录</td></tr>') +
      '</tbody></table></div></div>' +
      '</div></div>';
  };

  /* ==================== 导出记录详情 ==================== */
  P['finance.exportlog'] = function (ctx) {
    var d = dom();
    var id = (ctx && ctx.params && ctx.params.id) || '';
    var log = (App.store.data.exports || []).filter(function (x) { return x.id === id; })[0];
    if (!log) {
      return '<div class="view">' + ui().hdr({ title: '导出记录', back: 'nav:finance.deduct' }) +
        '<div class="body">' + ui().empty('记录不存在', '可能已被重置', 'nav:finance.deduct', '返回代扣') + '</div></div>';
    }
    var list = d.deductList(log.period);
    var total = list.reduce(function (s, x) { return s + x.amount; }, 0);
    var rows = list.slice(0, 40).map(function (x) {
      return '<tr><td class="num">' + U.esc(x.employeeId) + '</td><td>' + U.esc(x.name) + '</td>' +
        '<td>' + U.esc(x.dept) + '</td><td class="num">' + ui().money(x.amount) + '</td></tr>';
    }).join('');

    return '<div class="view">' +
      ui().hdr({ title: '导出记录', sub: log.file, back: 'nav:finance.deduct' }) +
      '<div class="body">' +
      '<section class="card">' +
      '<div class="between"><span class="t1 muted">费用期间</span><b>' + log.period + '</b></div>' +
      '<div class="between" style="margin-top:8px"><span class="t1 muted">导出条数</span><b class="num">' + log.count + ' 户</b></div>' +
      '<div class="between" style="margin-top:8px"><span class="t1 muted">扣款合计</span><b class="num">' + ui().money(total) + '</b></div>' +
      '<div class="between" style="margin-top:8px"><span class="t1 muted">导出人 / 时间</span>' +
      '<b class="t2">' + U.esc(log.by) + ' · ' + U.fmtDT(log.at) + '</b></div>' +
      '</section>' +
      '<button class="btn" data-act="export-csv:' + log.period + '">重新导出该期 CSV</button>' +
      '<div class="sec-title"><span>清单明细（前 40 户）</span></div>' +
      '<section class="panel"><div class="table-scroll"><table class="tbl">' +
      '<thead><tr><th>工号</th><th>姓名</th><th>部门</th><th>金额</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4" class="muted center" style="padding:20px">该期已无待扣数据</td></tr>') +
      '</tbody></table></div></section>' +
      '</div></div>';
  };

})(typeof window !== 'undefined' ? window : globalThis);

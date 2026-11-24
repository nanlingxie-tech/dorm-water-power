/* 员工视角：我的账单 / 明细 / 趋势 / 申诉 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});
  var M = App.mounts || (App.mounts = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  var STATUS = {
    draft: ['生成中', 'todo'],
    public: ['待确认', 'warn'],
    confirmed: ['已确认', 'done'],
    disputed: ['申诉中', 'bad'],
    deducted: ['已代扣', 'done'],
    void: ['已作废', 'todo']
  };

  function me() {
    var st = App.store.data.session || {};
    return dom().employeeById(st.employeeId) || App.store.data.employees[0];
  }

  // 有原图就显示原图，没有才回退到示意表盘
  function photoBox(rec, type, label) {
    var dt = rec ? U.fmtDT(rec.shotAt) : '';
    if (rec && rec.photoData && String(rec.photoData).indexOf('data:') === 0) {
      return '<div style="flex:1">' +
        '<img src="' + rec.photoData + '" alt="' + label + '原图" ' +
        'style="width:100%;height:120px;object-fit:cover;border-radius:12px;border:1px solid #e8ebf1" />' +
        '<div class="t1 muted center" style="margin-top:4px">' + label + ' · 原图 ' + dt + '</div></div>';
    }
    return '<div style="flex:1"><div class="thumb has" style="width:100%">' +
      ui().meter(type, rec ? rec.reading : '', dt) + '</div>' +
      '<div class="t1 muted center" style="margin-top:4px">' + label + ' · 示意</div></div>';
  }

  // 本期账单优先；没有则回退到最近一期，并标记 isCurrent=false
  function pickBill() {
    var d = dom();
    var emp = me();
    var period = d.period();
    var bill = d.billOf(period, emp.roomId);
    if (bill) return { bill: bill, isCurrent: true, emp: emp };
    var hist = App.store.data.bills.filter(function (b) { return b.roomId === emp.roomId; })
      .sort(function (a, b) { return a.period < b.period ? 1 : -1; });
    return { bill: hist[0] || null, isCurrent: false, emp: emp };
  }

  /* ==================== 我的账单 ==================== */
  P['employee.bill'] = function () {
    var d = dom();
    var picked = pickBill();
    var emp = picked.emp;
    var bill = picked.bill;

    if (!bill) {
      return '<div class="view">' +
        '<div class="bill-hero"><div class="between"><div><h1 style="font-size:15px">我的账单</h1>' +
        '<p class="t1" style="color:#cfe0ff">' + emp.roomId + ' · ' + emp.name + '</p></div></div></div>' +
        '<div class="body" style="margin-top:-20px">' +
        ui().empty('还没有账单', '账单生成后会显示在这里', 'nav:employee.trend', '查看用量趋势') +
        '</div>' +
        ui().tabbar([
          { label: '账单', icon: 'doc', act: 'nav:employee.bill', active: true },
          { label: '趋势', icon: 'chart', act: 'nav:employee.trend' }
        ]) + '</div>';
    }

    var st = STATUS[bill.status] || ['未知', 'todo'];
    var isPublic = bill.status === 'public';
    var canConfirm = isPublic;
    var canAppeal = bill.status === 'public' || bill.status === 'confirmed';
    var days = bill.publicEndAt ? U.daysLeft(bill.publicEndAt) : 0;

    var notice = '';
    if (!picked.isCurrent) {
      notice = '<div class="card notice">' + ui().icon('clock', 15) +
        ' 本月账单尚未生成，先看看上一期（' + bill.period + '）</div>';
    } else if (isPublic) {
      notice = '<div class="card notice">' + ui().icon('clock', 15) +
        ' 公示期剩余 <b>&nbsp;' + Math.max(0, days) + ' 天&nbsp;</b>，逾期未确认将默认认可</div>';
    } else if (bill.status === 'confirmed') {
      notice = '<div class="card" style="background:var(--ok-bg);border-color:#bfe9d8;color:#0f9d6e;font-size:12.5px">' +
        ui().icon('check', 15) + ' 已确认，将于 12-10 随工资代扣</div>';
    } else if (bill.status === 'deducted') {
      notice = '<div class="card" style="background:var(--ok-bg);border-color:#bfe9d8;color:#0f9d6e;font-size:12.5px">' +
        ui().icon('check', 15) + ' 已于 ' + U.fmtD(bill.deductedAt) + ' 随工资代扣</div>';
    } else if (bill.status === 'disputed') {
      notice = '<div class="card" style="background:var(--warn-bg);border-color:#f5d9b0;color:var(--warn);font-size:12.5px">' +
        ui().icon('warn', 15) + ' 申诉处理中，本单暂不代扣</div>';
    }

    var actions = '';
    if (canConfirm || canAppeal) {
      actions = '<div class="row" style="gap:10px;margin-bottom:11px">' +
        (canConfirm ? '<button class="btn" style="flex:1" data-act="confirm-bill:' + bill.id + '">确认无误</button>' : '') +
        (canAppeal ? '<button class="btn ghost" style="flex:1" data-act="open-appeal:' + bill.id + '">有异议，去申诉</button>' : '') +
        '</div>';
    }

    var history = App.store.data.bills.filter(function (b) { return b.roomId === emp.roomId && b.id !== bill.id; })
      .sort(function (a, b) { return a.period < b.period ? 1 : -1; }).slice(0, 3)
      .map(function (b) {
        var s2 = STATUS[b.status] || ['未知', 'todo'];
        return '<div class="listline static"><span class="t2" style="flex:1">' + b.period + '</span>' +
          '<span class="t2 num">' + ui().money(b.total) + '</span>' +
          ui().chip(s2[0], s2[1]) + '</div>';
      }).join('');

    return '<div class="view">' +
      '<div class="bill-hero"><div class="between">' +
      '<div><h1 style="font-size:15px">我的账单</h1>' +
      '<p class="t1" style="color:#cfe0ff">' + emp.roomId + ' · ' + emp.name + ' · ' + emp.dept + '</p></div>' +
      ui().chip(bill.period, 'pri') + '</div></div>' +
      '<div class="body" style="margin-top:-30px">' +
      '<section class="card">' +
      '<div class="between"><span class="t1 muted">本期应缴电费 + 水费</span>' + ui().chip(st[0], st[1]) + '</div>' +
      '<div class="amount num">' + ui().money(bill.total) + '</div>' +
      '<div class="t1 muted">费用期间 ' + U.periodRange(bill.period).start + ' 至 ' + U.periodRange(bill.period).end + '</div>' +
      '<div class="dashed"></div>' +
      '<div class="line-item"><span>' + ui().icon('bolt', 13) + ' 电费</span>' +
      '<span class="num">' + bill.usageE + ' 度 × ' + (bill.priceE / 100).toFixed(2) + ' = <b>' + ui().money(bill.amountE) + '</b></span></div>' +
      '<div class="line-item"><span>' + ui().icon('drop', 13) + ' 水费</span>' +
      '<span class="num">' + bill.usageW + ' 吨 × ' + (bill.priceW / 100).toFixed(2) + ' = <b>' + ui().money(bill.amountW) + '</b></span></div>' +
      '</section>' +
      notice + actions +
      '<section class="card" style="padding:2px 12px">' +
      '<button class="listline" data-act="nav:employee.detail">' +
      '<span class="muted">' + ui().icon('clip', 17) + '</span><span class="t2" style="flex:1">查看账单明细与表盘照片</span>' +
      '<span class="arrow">' + ui().icon('chev', 15) + '</span></button>' +
      '<button class="listline" data-act="nav:employee.trend">' +
      '<span class="muted">' + ui().icon('chart', 17) + '</span><span class="t2" style="flex:1">近一年用量趋势</span>' +
      '<span class="arrow">' + ui().icon('chev', 15) + '</span></button>' +
      '<button class="listline" data-act="nav:employee.history">' +
      '<span class="muted">' + ui().icon('list', 17) + '</span><span class="t2" style="flex:1">查看往期读数与费用</span>' +
      '<span class="arrow">' + ui().icon('chev', 15) + '</span></button>' +
      '</section>' +
      (history ? '<div class="sec-title"><span>历史账单</span></div><section class="card" style="padding:2px 12px">' + history + '</section>' : '') +
      '</div>' +
      ui().tabbar([
        { label: '账单', icon: 'doc', act: 'nav:employee.bill', active: true },
        { label: '趋势', icon: 'chart', act: 'nav:employee.trend' }
      ]) +
      '</div>';
  };

  /* ==================== 往期账单 ==================== */
  P['employee.history'] = function () {
    var d = dom();
    var emp = me();
    var map = {};

    App.store.data.bills.forEach(function (b) {
      if (b.roomId !== emp.roomId) return;
      var m = map[b.period] || (map[b.period] = { period: b.period });
      m.bill = b;
      m.usageE = b.usageE;
      m.usageW = b.usageW;
    });
    App.store.data.readings.forEach(function (r) {
      if (r.roomId !== emp.roomId || r.reading == null) return;
      if (r.meterType !== 'e' && r.meterType !== 'w') return;
      var m = map[r.period] || (map[r.period] = { period: r.period });
      if (r.meterType === 'e') m.usageE = r.usage;
      else m.usageW = r.usage;
    });

    var keys = Object.keys(map).sort().reverse();
    var rows = keys.map(function (k) {
      var x = map[k];
      var st = x.bill ? (STATUS[x.bill.status] || ['未知', 'todo']) : ['未出账', 'todo'];
      var inner =
        '<div class="listline static" style="align-items:flex-start">' +
        '<span class="ll-main">' +
        '<span class="row" style="gap:7px"><b class="t2">' + k + '</b>' + ui().chip(st[0], st[1]) + '</span>' +
        '<span class="t1 muted">电 ' + (x.usageE == null ? '—' : x.usageE) + ' 度 · 水 ' +
        (x.usageW == null ? '—' : x.usageW) + ' 吨</span>' +
        '</span>' +
        '<span class="ll-right">' +
        '<b class="t2 num">' + (x.bill ? ui().money(x.bill.total) : '—') + '</b>' +
        '<span class="t1 muted">' + (x.bill ? U.fmtD(x.bill.generatedAt) : '待出账') + '</span>' +
        '</span>' +
        '</div>';
      return x.bill
        ? '<button style="width:100%;background:none;border:0;padding:0;text-align:left;color:inherit" ' +
        'data-act="nav:employee.detail?period=' + k + '">' + inner + '</button>'
        : inner;
    }).join('');

    return '<div class="view">' +
      ui().hdr({ title: '往期读数与费用', sub: emp.roomId + ' · 共 ' + keys.length + ' 期', back: 'nav:employee.bill' }) +
      '<div class="body">' +
      '<section class="card" style="padding:2px 12px">' + (rows || ui().empty('还没有历史记录')) + '</section>' +
      '<p class="hint center">点有账单的期次可查看明细与表盘原图</p>' +
      '</div>' +
      ui().tabbar([
        { label: '账单', icon: 'doc', act: 'nav:employee.bill', active: true },
        { label: '趋势', icon: 'chart', act: 'nav:employee.trend' }
      ]) +
      '</div>';
  };

  /* ==================== 账单明细 ==================== */
  P['employee.detail'] = function (ctx) {
    var d = dom();
    var emp = me();
    var want = ctx && ctx.params && ctx.params.period;
    var bill = want ? d.billOf(want, emp.roomId) : pickBill().bill;
    var back = want ? 'nav:employee.history' : 'nav:employee.bill';

    if (!bill) {
      return '<div class="view">' +
        ui().hdr({ title: '账单明细', sub: want || '', back: back }) +
        '<div class="body">' + ui().periodChips(d.periods(), want, 'employee.detail') +
        ui().empty('该账期没有账单', '可能尚未出账或已作废', 'nav:employee.history', '返回往期') + '</div></div>';
    }

    var e = d.readingOne(bill.period, emp.roomId, 'e');
    var w = d.readingOne(bill.period, emp.roomId, 'w');

    return '<div class="view">' +
      ui().hdr({ title: '账单明细', sub: bill.period + ' · ' + emp.roomId, back: back }) +
      '<div class="body">' +
      ui().periodChips(d.periods(), bill.period, 'employee.detail') +
      '<section class="card">' +
      '<table class="detail-table">' +
      '<thead><tr><th>项目</th><th>上期</th><th>本期</th><th>用量</th><th style="text-align:right">金额</th></tr></thead>' +
      '<tbody>' +
      '<tr><td>电</td><td class="num">' + (e ? e.prevReading : '—') + '</td><td class="num">' + (e ? e.reading : '—') + '</td>' +
      '<td class="num"><b>' + bill.usageE + ' 度</b></td><td class="num" style="text-align:right"><b>' + ui().money(bill.amountE) + '</b></td></tr>' +
      '<tr><td>水</td><td class="num">' + (w ? w.prevReading : '—') + '</td><td class="num">' + (w ? w.reading : '—') + '</td>' +
      '<td class="num"><b>' + bill.usageW + ' 吨</b></td><td class="num" style="text-align:right"><b>' + ui().money(bill.amountW) + '</b></td></tr>' +
      '<tr><td colspan="4"><b>合计</b></td><td class="num" style="text-align:right;color:var(--bad);font-size:15px"><b>' + ui().money(bill.total) + '</b></td></tr>' +
      '</tbody></table></section>' +

      '<div class="sec-title"><span>表盘照片（抄表凭证）</span></div>' +
      '<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:12px">' +
      photoBox(e, 'e', '电表') + photoBox(w, 'w', '水表') +
      '</div>' +
      '<p class="hint center" style="margin-bottom:12px">照片为抄表员现场上传的原图；对读数有疑问可直接申诉</p>' +

      '<section class="card">' +
      '<div class="between" style="margin-bottom:6px"><span class="t1 muted">抄表员</span><span class="t2">' + (e ? e.operator : '李强') + '（安保部）</span></div>' +
      '<div class="between" style="margin-bottom:6px"><span class="t1 muted">抄表时间</span><span class="t2 num">' + U.fmtDT(e ? e.shotAt : '') + '</span></div>' +
      '<div class="between"><span class="t1 muted">照片水印</span><span class="t2">房间号 / 时间 / 抄表员</span></div>' +
      '</section>' +
      '<section class="card soft"><div class="t1 muted" style="line-height:1.9">' +
      '读数由本期与上期照片之差计算；电 ' + (bill.priceE / 100).toFixed(2) + ' 元/度、水 ' + (bill.priceW / 100).toFixed(2) +
      ' 元/吨；公共区域水电由公司承担，不分摊到个人。</div></section>' +
      '</div></div>';
  };

  /* ==================== 用量趋势 ==================== */
  P['employee.trend'] = function () {
    var d = dom();
    var emp = me();
    var list = d.trend(emp.roomId, 6);
    var ptsE = list.map(function (x) { return { label: (+x.period.slice(5, 7)) + '月', value: x.usageE }; });
    var ptsW = list.map(function (x) { return { label: (+x.period.slice(5, 7)) + '月', value: x.usageW }; });
    var last = list[list.length - 1] || { usageE: 0, usageW: 0 };
    var prev = list[list.length - 2] || { usageE: 0, usageW: 0 };
    var diff = U.round1(last.usageE - prev.usageE);
    var chip = diff > 0
      ? ui().chip('本月 ↑ ' + diff + ' 度', 'warn')
      : (diff < 0 ? ui().chip('本月 ↓ ' + Math.abs(diff) + ' 度', 'done') : ui().chip('与上月持平', 'done'));

    return '<div class="view">' +
      ui().hdr({ title: '用量趋势', sub: emp.roomId + ' · 近 ' + list.length + ' 期', back: 'nav:employee.bill' }) +
      '<div class="body">' +
      '<section class="card"><div class="between" style="margin-bottom:6px">' +
      '<b class="t2">' + ui().icon('bolt', 15) + ' 用电量（度）</b>' + chip + '</div>' +
      (ptsE.length ? ui().lineChart(ptsE, { color: '#e6a417' }) : '<div class="muted t2">数据不足</div>') +
      '</section>' +
      '<section class="card"><div class="between" style="margin-bottom:6px">' +
      '<b class="t2">' + ui().icon('drop', 15) + ' 用水量（吨）</b>' +
      ui().chip('本月 ' + last.usageW + ' 吨', 'pri') + '</div>' +
      (ptsW.length ? ui().lineChart(ptsW, { color: '#2f8fd8' }) : '<div class="muted t2">数据不足</div>') +
      '</section>' +
      '<section class="card soft">' +
      '<div class="between" style="margin-bottom:5px"><span class="t2 muted">本月 vs 上月（电）</span><span class="t2 num">' + last.usageE + ' / ' + prev.usageE + ' 度</span></div>' +
      '<div class="between"><span class="t2 muted">本月 vs 上月（水）</span><span class="t2 num">' + last.usageW + ' / ' + prev.usageW + ' 吨</span></div>' +
      '<p class="hint">冬季取暖用电上升属正常范围；如对用量有疑问，可在账单页发起申诉。</p>' +
      '</section></div>' +
      ui().tabbar([
        { label: '账单', icon: 'doc', act: 'nav:employee.bill' },
        { label: '趋势', icon: 'chart', act: 'nav:employee.trend', active: true }
      ]) +
      '</div>';
  };

  /* ==================== 申诉 ==================== */
  P['employee.appeal'] = function () {
    var types = ['读数不对', '金额算错', '照片不是我房间的表', '其他问题'];
    var sel = App.guardState.appealType || '';
    var opts = types.map(function (t) {
      return '<button class="radio ' + (sel === t ? 'on' : '') + '" data-act="appeal-type:' + t + '">' +
        '<span class="c"></span>' + t + '</button>';
    }).join('');

    return '<div class="view">' +
      ui().hdr({ title: '发起申诉', sub: '处理期间本单暂不代扣', back: 'nav:employee.bill' }) +
      '<div class="body">' +
      '<section class="card"><div class="t1 muted" style="margin-bottom:2px">申诉类型</div>' + opts + '</section>' +
      '<section class="card"><div class="t1 muted" style="margin-bottom:7px">问题描述</div>' +
      '<textarea id="appealDesc" rows="4" placeholder="请描述具体情况，例如：11-25 我出差不在家，电表读数应该有误"></textarea></section>' +
      '<p class="hint">提交后由安保主管在 1 个工作日内处理；处理期间账单暂不代扣。</p>' +
      '</div>' +
      '<footer class="footbar"><button class="btn" data-act="appeal-submit">提交申诉</button></footer>' +
      '</div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);

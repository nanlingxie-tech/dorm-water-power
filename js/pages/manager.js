/* 管家视角：单价设置 / 账单管理 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var U = App.util;
  var P = App.pages || (App.pages = {});

  function ui() { return App.ui; }
  function dom() { return App.domain; }

  var STATUS = {
    draft: ['草稿', 'todo'],
    public: ['待确认', 'warn'],
    confirmed: ['已确认', 'done'],
    disputed: ['申诉中', 'bad'],
    deducted: ['已代扣', 'done'],
    void: ['已作废', 'todo']
  };

  function mgrNav(active) {
    var items = [
      { k: 'bills', t: '账单管理' },
      { k: 'price', t: '单价设置' },
      { k: 'buildings', t: '楼栋管理' },
      { k: 'blddetail', t: '楼栋明细' }
    ];
    return '<div class="subnav">' + items.map(function (it) {
      return '<button class="' + (it.k === active ? 'on' : '') + '" data-act="nav:manager.' + it.k + '">' + it.t + '</button>';
    }).join('') + '</div>';
  }

  /* ==================== 楼栋管理 ==================== */
  P['manager.buildings'] = function () {
    var d = dom();
    var list = d.buildingList();
    var rows = list.map(function (b) {
      var total = d.roomCountOf(b.code);
      var occ = d.occupiedCountOf(b.code);
      return '<tr>' +
        '<td><input class="cell-input" id="bldName-' + b.code + '" value="' + U.esc(b.name) + '" maxlength="20" /></td>' +
        '<td class="num muted">' + b.code + '</td>' +
        '<td><input class="cell-input num" id="bldFloors-' + b.code + '" value="' + b.floors + '" inputmode="numeric" /></td>' +
        '<td><input class="cell-input num" id="bldPer-' + b.code + '" value="' + b.perFloor + '" inputmode="numeric" /></td>' +
        '<td class="num">' + total + ' 间</td>' +
        '<td class="num">' + occ + ' 间</td>' +
        '<td><button class="btn sm" data-act="bld-save:' + b.code + '">保存</button></td>' +
        '</tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + mgrNav('buildings') +
      '<div class="panel"><div class="ph">楼栋管理</div>' +
      '<div class="note-bar">本页仅<b>物业管家</b>可修改。改名称只影响显示，不影响抄表记录与账单；' +
      '改楼层数/每层房间数会增减房间，已有住户或抄表数据的房间不会被删除。</div>' +
      '<table class="tbl"><thead><tr><th>楼栋名称</th><th>编号</th><th>楼层数</th><th>每层房间数</th><th>房间总数</th><th>在住</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" class="muted center">还没有楼栋</td></tr>') + '</tbody></table></div>' +
      '</div></div>';
  };

  /* ==================== 单价设置（按楼栋 + 审批） ==================== */
  P['manager.price'] = function () {
    var d = dom();
    var period = d.period();
    var list = d.buildingList();

    var rows = list.map(function (b) {
      var cur = d.priceOf(period, b.code);
      var req = d.priceRequestOf(b.code, period);
      var curE = cur ? (cur.electricity / 100).toFixed(2) : '';
      var curW = cur ? (cur.water / 100).toFixed(2) : '';
      return '<tr>' +
        '<td class="b">' + U.esc(b.name) + '</td>' +
        '<td class="num">' + (curE || '—') + '</td>' +
        '<td class="num">' + (curW || '—') + '</td>' +
        '<td><input class="cell-input num" id="prE-' + b.code + '" value="' + curE + '" inputmode="decimal" /></td>' +
        '<td><input class="cell-input num" id="prW-' + b.code + '" value="' + curW + '" inputmode="decimal" /></td>' +
        '<td><input class="cell-input" id="prR-' + b.code + '" placeholder="变更原因" maxlength="30" /></td>' +
        '<td>' + (req
          ? ui().chip('审批中', 'warn')
          : '<button class="btn sm" data-act="price-submit:' + b.code + '">提交变更</button>') + '</td>' +
        '</tr>';
    }).join('');

    var history = (App.store.data.prices || []).slice()
      .sort(function (a, b) { return a.period < b.period ? 1 : -1; })
      .slice(0, 12)
      .map(function (p) {
        var b = d.buildingOf(p.building);
        return '<tr><td>' + U.esc(b ? b.name : p.building) + '</td>' +
          '<td class="num">' + p.period + '</td>' +
          '<td class="num">' + (p.electricity / 100).toFixed(2) + '</td>' +
          '<td class="num">' + (p.water / 100).toFixed(2) + '</td>' +
          '<td class="muted">' + U.esc(p.note || '—') + '</td></tr>';
      }).join('');

    return '<div class="view wide"><div class="body">' + mgrNav('price') +
      '<div class="panel"><div class="ph">各楼栋单价（' + period + '）</div>' +
      '<div class="note-bar">每个楼栋单独定价；提交后进入待审批，<b>管理员批准前不生效</b>，系统仍按原单价出账。</div>' +
      '<table class="tbl"><thead><tr><th>楼栋</th><th>当前电价</th><th>当前水价</th>' +
      '<th>新电价（元/度）</th><th>新水价（元/吨）</th><th>变更原因</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" class="muted center">还没有楼栋</td></tr>') + '</tbody></table></div>' +
      '<div class="panel"><div class="ph">价格历史（近 12 条）</div>' +
      '<table class="tbl"><thead><tr><th>楼栋</th><th>账期</th><th>电价</th><th>水价</th><th>备注</th></tr></thead>' +
      '<tbody>' + (history || '<tr><td colspan="5" class="muted center" style="padding:22px">暂无记录</td></tr>') +
      '</tbody></table></div>' +
      '</div></div>';
  };

  /* ==================== 账单管理 ==================== */
  P['manager.bills'] = function () {
    var d = dom();
    var period = d.period();
    var bills = d.billsOf(period);
    var s = d.stats();

    if (!bills.length) {
      var ready = s.approved;
      return '<div class="view wide"><div class="body">' + mgrNav('bills') +
        '<div class="panel"><div class="ph">本期账单（' + period + '）</div>' +
        '<div class="empty">' +
        '<div class="empty-ic">' + ui().icon('doc', 26) + '</div>' +
        '<div class="empty-t">还没有生成账单</div>' +
        '<div class="empty-d">已完成复核 <b>' + ready + '</b> 户，可生成账单。<br>单价按楼栋分别设置，' +
        '各楼栋见「单价设置」</div>' +
        '<button class="btn" style="max-width:240px;margin:0 auto" data-act="gen-bills">一键生成账单</button>' +
        '</div></div>' +
        '<div class="panel"><div class="ph">出账规则（系统自动执行）</div>' +
        '<div style="padding:14px 16px">' +
        '<ul class="rules" style="font-size:12px;line-height:2">' +
        '<li>· 只对「已复核通过」的房间出账，未抄或异常的房间跳过</li>' +
        '<li>· 金额 = 本户用量 × 当期单价，水电分别计算后相加</li>' +
        '<li>· 公共区域水电由公司承担，不分摊到个人</li>' +
        '<li>· 生成后进入 3 天公示期，员工可查看并确认或申诉</li>' +
        '</ul></div></div>' +
        '</div></div>';
    }

    var rows = bills.slice(0, 40).map(function (b) {
      var emp = d.employeeById(b.employeeId);
      var st = STATUS[b.status] || ['未知', 'todo'];
      return '<tr><td class="b">' + b.roomId + '</td>' +
        '<td>' + (emp ? emp.name : '—') + '</td>' +
        '<td class="num">' + b.usageE + '</td><td class="num">' + b.usageW + '</td>' +
        '<td class="num b">' + ui().money(b.total) + '</td>' +
        '<td>' + ui().chip(st[0], st[1]) + '</td></tr>';
    }).join('');

    return '<div class="view wide"><div class="body">' + mgrNav('bills') +
      '<div class="kpis">' +
      '<div class="kpi"><div class="lab">已生成</div><div class="val num">' + bills.length + '<small>户</small></div><div class="trend">应收 ' + ui().money(s.billTotal) + '</div></div>' +
      '<div class="kpi"><div class="lab">待确认</div><div class="val num">' + s.public + '<small>户</small></div><div class="trend">公示期中</div></div>' +
      '<div class="kpi"><div class="lab">已确认</div><div class="val num">' + s.confirmed + '<small>户</small></div><div class="trend">可进入代扣</div></div>' +
      '<div class="kpi"><div class="lab">申诉中</div><div class="val num">' + s.disputed + '<small>户</small></div><div class="trend">需处理后才能代扣</div></div>' +
      '</div>' +
      '<div class="panel"><div class="ph">本期账单（' + period + '）' +
      '<div class="r">' + ui().chip('公示期 3 天', 'pri') +
      '<button class="btn sm ghost" data-act="skip-publicity">模拟公示期结束</button></div></div>' +
      '<table class="tbl"><thead><tr><th>房间</th><th>住户</th><th>用电(度)</th><th>用水(吨)</th><th>应缴</th><th>状态</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      (bills.length > 40 ? '<div class="note-bar">仅显示前 40 户，其余可在导出中查看</div>' : '') +
      '</div></div></div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);

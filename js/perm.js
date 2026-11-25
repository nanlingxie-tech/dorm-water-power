/* 权限表：把"谁能做什么"集中定义，路由与操作都查这一处 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var P = {};

  // 动作 → 允许的角色
  var MATRIX = {
    'building.rename': ['manager'],
    'building.resize': ['manager'],
    'price.submit': ['manager'],
    'price.approve': ['admin'],
    'bill.generate': ['manager'],
    'reading.submit': ['guard'],
    'reading.approve': ['supervisor'],
    'report.byBuilding': ['supervisor', 'manager'],
    'deduct.export': ['finance'],
    'employee.self': ['employee'],
    'room.edit': ['guard'],
    'room.approve': ['supervisor']
  };

  // 页面 → 需要的动作（没有映射的页面按角色前缀校验）
  var PAGE_ACTION = {
    'manager.buildings': 'building.rename',
    'manager.price': 'price.submit',
    'manager.bills': 'bill.generate',
    'supervisor.review': 'reading.approve',
    'admin.approvals': 'price.approve',
    'finance.deduct': 'deduct.export',
    'finance.exportlog': 'deduct.export',
    'employee.bill': 'employee.self',
    'employee.detail': 'employee.self',
    'employee.history': 'employee.self',
    'employee.reconcile': 'employee.self',
    'employee.trend': 'employee.self',
    'employee.appeal': 'employee.self',
    'guard.manage': 'room.edit',
    'supervisor.rooms': 'room.approve',
    'supervisor.blddetail': 'report.byBuilding',
    'manager.blddetail': 'report.byBuilding'
  };

  P.MATRIX = MATRIX;
  P.PAGE_ACTION = PAGE_ACTION;

  P.can = function (role, action) {
    var list = MATRIX[action];
    return !!list && list.indexOf(role) > -1;
  };

  P.canPage = function (role, key) {
    var act = PAGE_ACTION[key];
    if (!act) return true;
    return P.can(role, act);
  };

  P.actionsOf = function (role) {
    return Object.keys(MATRIX).filter(function (a) { return P.can(role, a); });
  };

  // 统一拒绝文案
  P.deny = function (action) {
    var names = { guard: '安保', supervisor: '安保主管', manager: '物业管家', finance: '财务', admin: '管理员', employee: '员工' };
    var list = (MATRIX[action] || []).map(function (r) { return names[r] || r; });
    return '该操作仅限' + (list.join('、') || '授权角色') + '执行';
  };

  App.perm = P;
})(typeof window !== 'undefined' ? window : globalThis);

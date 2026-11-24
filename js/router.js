/* 极简 hash 路由 + 角色守卫 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});
  var R = {};

  function qs(str) {
    var o = {};
    (str || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      o[decodeURIComponent(k)] = v;
    });
    return o;
  }

  R.parse = function (hash) {
    var h = String(hash || '').replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var q = qi >= 0 ? h.slice(qi + 1) : '';
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var seg = path.split('/').filter(Boolean);
    var key = (seg[0] || 'guard') + '.' + (seg[1] || 'task');
    var params = qs(q);
    if (seg[2]) params.room = decodeURIComponent(seg[2]);
    return { key: key, params: params };
  };

  R.hashOf = function (key, params) {
    var p = key.split('.');
    var q = [];
    Object.keys(params || {}).forEach(function (k) {
      if (k === 'room') return;
      q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    });
    var url = '#/' + p[0] + '/' + p[1];
    if (params && params.room) url += '/' + encodeURIComponent(params.room);
    if (q.length) url += '?' + q.join('&');
    return url;
  };

  R.go = function (key, params) {
    var hash = R.hashOf(key, params);
    if (root.location && root.location.hash === hash) {
      R.render();
    } else if (root.location) {
      root.location.hash = hash;
    } else {
      R.render();
    }
  };

  R.homeOf = function (role) {
    for (var i = 0; i < App.ui.ROLES.length; i++) {
      if (App.ui.ROLES[i].key === role) return App.ui.ROLES[i].page;
    }
    return 'guard.task';
  };

  R.render = function () {
    var app = root.document && document.getElementById('app');
    var parsed = R.parse(root.location ? root.location.hash : '');
    var role = (App.store.data.session && App.store.data.session.role) || 'guard';
    var pageRole = parsed.key.split('.')[0];

    // 角色与路由不符 → 跳到该角色首页
    if (pageRole !== role || !App.pages[parsed.key]) {
      parsed = R.parse('#/' + R.homeOf(role).replace('.', '/'));
    }
    // 显式权限校验（比角色前缀更细，可支持跨角色页面）
    if (App.perm && !App.perm.canPage(role, parsed.key)) {
      parsed = R.parse('#/' + R.homeOf(role).replace('.', '/'));
    }
    if (!app) return;
    if (document.body) document.body.classList.toggle('wide', /^(supervisor|manager|finance)\./.test(parsed.key));

    App.store.data.session.page = parsed.key;
    App.store.data.session.params = parsed.params;

    var ctx = { role: role, params: parsed.params, period: App.domain.period() };
    var html;
    try {
      html = App.pages[parsed.key](ctx) || '';
    } catch (e) {
      html = '<div class="view"><div class="empty"><div class="empty-t">页面出错了</div>' +
        '<div class="empty-d">' + (e && e.message ? e.message : '未知错误') + '</div></div></div>';
      if (root.console) console.error(e);
    }
    app.innerHTML = App.ui.topbar(role) + html;
    App.store.data.session.lastKey = parsed.key;
    if (App.mounts[parsed.key]) {
      try { App.mounts[parsed.key](ctx); } catch (e) { if (root.console) console.error(e); }
    }
    if (root.scrollTo) root.scrollTo(0, 0);
  };

  R.start = function () {
    if (!root.location) return;
    root.addEventListener('hashchange', R.render);
    if (!root.location.hash) {
      var role = (App.store.data.session && App.store.data.session.role) || 'guard';
      root.location.hash = '#/' + R.homeOf(role).replace('.', '/');
    }
    R.render();
  };

  App.router = R;
})(typeof window !== 'undefined' ? window : globalThis);

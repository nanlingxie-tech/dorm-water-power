/* 表盘识图：图像 → 二值化 → 数字切分 → 模板匹配
 * 纯函数部分可在 Node 下测试；Canvas 相关部分只在浏览器生效。
 */
(function (root) {
  'use strict';
  var App = root.App || (root.App = {});

  /* ---------- 5×7 数字模板 ---------- */
  var TPL = {
    '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..']
  };

  /* 把任意二值区域「拉伸」重采样到 gw×gh（对模板与待识别段用同一套规则） */
  function resampleBox(bin, w, x0, x1, y0, y1, gw, gh) {
    var sw = x1 - x0 + 1, sh = y1 - y0 + 1, g = [];
    for (var gy = 0; gy < gh; gy++) {
      var row = [];
      for (var gx = 0; gx < gw; gx++) {
        var sx = x0 + Math.min(sw - 1, Math.floor((gx + 0.5) * sw / gw));
        var sy = y0 + Math.min(sh - 1, Math.floor((gy + 0.5) * sh / gh));
        row.push(bin[sy * w + sx] ? 1 : 0);
      }
      g.push(row);
    }
    return g;
  }

  /* 模板：先裁到笔迹外框，再拉伸到 5×7 —— 与待识别段用同一归一化 */
  function normTemplate(rows) {
    var h = rows.length, w = rows[0].length;
    var x0 = w, x1 = -1, y0 = h, y1 = -1;
    var flat = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) flat.push(rows[y].charAt(x) === '#' ? 1 : 0);
      for (var x2 = 0; x2 < w; x2++) {
        if (rows[y].charAt(x2) === '#') {
          if (x2 < x0) x0 = x2; if (x2 > x1) x1 = x2;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    return resampleBox(flat, w, x0, x1, y0, y1, 5, 7);
  }
  var TPL_GRIDS = {};
  Object.keys(TPL).forEach(function (d) { TPL_GRIDS[d] = normTemplate(TPL[d]); });
  var O = {};
  O._resampleBox = resampleBox;

  /* 灰度：RGBA → 0..255 */
  O.toGray = function (data, w, h) {
    var out = new Uint8Array(w * h);
    for (var i = 0, p = 0; i < w * h; i++, p += 4) {
      out[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0;
    }
    return out;
  };

  /* Otsu 自动阈值 */
  O.otsu = function (gray) {
    var hist = new Array(256).fill(0);
    for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length, sum = 0;
    for (var t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, best = 0, bestT = 127;
    for (var t2 = 0; t2 < 256; t2++) {
      wB += hist[t2];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += t2 * hist[t2];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; bestT = t2; }
    }
    return bestT;
  };

  /* 二值化：返回 1=笔迹（暗） */
  O.binarize = function (gray, threshold) {
    var t = threshold == null ? O.otsu(gray) : threshold;
    var out = new Uint8Array(gray.length);
    for (var i = 0; i < gray.length; i++) out[i] = gray[i] <= t ? 1 : 0;
    return out;
  };

  /* 去孤立噪点：8 邻域不足 2 个墨点的像素视为噪声 */
  O.denoise = function (bin, w, h) {
    var out = new Uint8Array(bin.length);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!bin[i]) continue;
        var n = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (!dy && !dx) continue;
            var yy = y + dy, xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
            if (bin[yy * w + xx]) n++;
          }
        }
        if (n >= 2) out[i] = 1;
      }
    }
    return out;
  };

  /* 列投影 → 按空白切出数字段 */
  O.findSegments = function (bin, w, h, opts) {
    opts = opts || {};
    var minW = opts.minW || Math.max(2, Math.round(h * 0.12));
    var gapTol = opts.gapTol || Math.max(1, Math.round(h * 0.08));
    var cols = new Array(w).fill(0);
    for (var x = 0; x < w; x++) {
      var c = 0;
      for (var y = 0; y < h; y++) if (bin[y * w + x]) c++;
      cols[x] = c;
    }
    // 有笔迹的列阈值：至少 15% 行高（挡掉残留噪点）
    var minInk = opts.minInk || Math.max(2, Math.round(h * 0.15));
    var segs = [], start = -1, gap = 0;
    for (var i = 0; i < w; i++) {
      if (cols[i] >= minInk) {
        if (start < 0) start = i;
        gap = 0;
      } else if (start >= 0) {
        gap++;
        if (gap > gapTol) {
          segs.push([start, i - gap]);
          start = -1; gap = 0;
        }
      }
    }
    if (start >= 0) segs.push([start, w - 1]);
    return segs.filter(function (s) { return (s[1] - s[0] + 1) >= minW; });
  };

  /* 把一段裁下来，拉伸到 5×7（与模板同一规则） */
  O.normalizeSegment = function (bin, w, h, seg) {
    var x0 = seg[0], x1 = seg[1];
    var y0 = h, y1 = -1;
    for (var y = 0; y < h; y++) {
      for (var x = x0; x <= x1; x++) {
        if (bin[y * w + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (y1 < 0) return null;
    return resampleBox(bin, w, x0, x1, y0, y1, 5, 7);
  };

  /* 与模板比对，返回 {digit, score} */
  O.matchDigit = function (grid) {
    var best = { digit: '?', score: -1 };
    Object.keys(TPL_GRIDS).forEach(function (d) {
      var t = TPL_GRIDS[d], hit = 0;
      for (var y = 0; y < 7; y++) {
        for (var x = 0; x < 5; x++) {
          if (t[y][x] === grid[y][x]) hit++;
        }
      }
      var score = hit / 35;
      if (score > best.score) best = { digit: d, score: score };
    });
    return best;
  };

  /* 读完整串数字 */
  O.readDigits = function (bin, w, h, opts) {
    var clean = O.denoise(bin, w, h);
    var segs = O.findSegments(clean, w, h, opts || {});
    var digits = '', scores = [], rejected = 0;
    segs.forEach(function (s) {
      var g = O.normalizeSegment(clean, w, h, s);
      if (!g) return;
      var m = O.matchDigit(g);
      if (m.score < 0.72) { rejected++; return; }
      digits += m.digit;
      scores.push(m.score);
    });
    var conf = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 0;
    return {
      digits: digits,
      confidence: conf,
      segments: segs.length,
      rejected: rejected,
      ok: digits.length >= 3 && conf >= 0.80 && rejected === 0
    };
  };

  /* 数字串 → 表读数（默认最后一位是小数位） */
  O.toMeterValue = function (digits, decimalLast) {
    if (!digits) return '';
    if (decimalLast === false || digits.length < 2) return String(Number(digits));
    var i = digits.length - 1;
    return String(Number(digits.slice(0, i) + '.' + digits.charAt(i)));
  };

  /* ---------- 浏览器：图片 → 二值矩阵 ---------- */
  O.fileToImageData = function (file, maxW, cb) {
    if (typeof document === 'undefined' || !root.FileReader) { cb(new Error('当前环境不支持读取图片')); return; }
    var fr = new FileReader();
    fr.onerror = function () { cb(new Error('读取图片失败')); };
    fr.onload = function () {
      var img = new root.Image();
      img.onerror = function () { cb(new Error('图片解码失败')); };
      img.onload = function () {
        var scale = Math.min(1, (maxW || 900) / img.width);
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        cb(null, ctx.getImageData(0, 0, w, h));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  /* 完整流程：文件 → 读数 */
  O.ocrFile = function (file, opts, cb) {
    opts = opts || {};
    O.fileToImageData(file, opts.maxW || 900, function (err, imgData) {
      if (err) return cb(err);
      try {
        var gray = O.toGray(imgData.data, imgData.width, imgData.height);
        var t = O.otsu(gray);
        var bin = O.binarize(gray, t);
        var res = O.readDigits(bin, imgData.width, imgData.height, opts);
        res.value = O.toMeterValue(res.digits, opts.decimalLast !== false);
        res.threshold = t;
        cb(null, res);
      } catch (e) { cb(e); }
    });
  };

  O.TEMPLATES = TPL;
  App.ocr = O;
})(typeof window !== 'undefined' ? window : globalThis);

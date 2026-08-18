// 一刻猫咪 · 主互动场景（骨架版）
// 猫 = Canvas 精灵动画；手指跟随由代码控制；15 分钟倒计时。

var CATS = [
  {
    name: '蹩脚狸花猫',
    sprite: '/assets/sprites/cat1_side.png',
    // 素材到位后替换为动作帧序列（白底全身，同一只猫）：
    // idleFrames: ['/assets/sprites/cat1/idle1.png', '/assets/sprites/cat1/idle2.png'],
    // walkFrames: ['/assets/sprites/cat1/walk1.png', ...]
  }
];

var RETURN_MS = 3000;          // 松手 3 秒后火腿肠消失、猫回沙发
var SPEED_FACTOR = 1.5;        // 猫奔跑速度系数
var SESSION_SECONDS = 15 * 60; // 单次 15 分钟

Page({
  data: {
    timeText: '15:00',
    catName: CATS[0].name,
    hint: '手指点哪里，火腿肠就出现在哪里，\n猫会飞快跑过去～ 松手 3 秒后它回沙发',
    ended: false
  },

  onReady: function () {
    var that = this;
    wx.createSelectorQuery()
      .select('#game')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) return;
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var dpr = wx.getWindowInfo().pixelRatio;
        that.W = res[0].width;
        that.H = res[0].height;
        canvas.width = that.W * dpr;
        canvas.height = that.H * dpr;
        ctx.scale(dpr, dpr);
        that.canvas = canvas;
        that.ctx = ctx;
        that.initGame();
      });
  },

  onUnload: function () {
    if (this.returnTimer) clearTimeout(this.returnTimer);
    if (this.raf) {
      if (this.canvas && this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(this.raf);
      else clearTimeout(this.raf);
    }
  },

  initGame: function () {
    var that = this;
    this.cat = { x: 0, y: 0, w: 0, h: 0, dir: 1, phase: 0 };
    this.target = null;
    this.touching = false;
    this.sausagePos = null;
    this.returnTimer = null;
    this.secondsLeft = SESSION_SECONDS;
    this.lastSec = -1;
    this.catImg = null;
    this.sausageImg = null;
    this.loadAsset('/assets/sprites/cat1_side.png', function (img) {
      that.catImg = img;
      that.layout();
      that.startLoop();
    });
    this.loadAsset('/assets/items/sausage.png', function (img) {
      that.sausageImg = img;
    });
  },

  loadAsset: function (src, cb) {
    var img = this.canvas.createImage();
    img.onload = function () { cb(img); };
    img.src = src;
  },

  layout: function () {
    var H = this.H;
    var catH = H * 0.4;
    var aspect = this.catImg.width / this.catImg.height;
    this.cat.w = catH * aspect;
    this.cat.h = catH;
    this.home = { x: this.W / 2, y: H - catH - H * 0.06 };
    this.cat.x = this.home.x;
    this.cat.y = this.home.y;
  },

  startLoop: function () {
    var that = this;
    var step = function (t) {
      that.update(t);
      that.render();
      that.raf = that.canvas.requestAnimationFrame
        ? that.canvas.requestAnimationFrame(step)
        : setTimeout(step, 16);
    };
    step(Date.now());
  },

  update: function (t) {
    var dt = Math.min(0.05, (t - (this.lastT || t)) / 1000 || 0.016);
    this.lastT = t;
    this.cat.phase += dt * 16;
    if (this.endedNow) return;

    // 猫朝目标移动
    if (this.target) {
      var dx = this.target.x - this.cat.x;
      var dy = this.target.y - this.cat.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        this.moving = false;
      } else {
        this.moving = true;
        if (Math.abs(dx) > 1) this.cat.dir = dx > 0 ? 1 : -1;
        var speed = Math.max(this.W, this.H) * SPEED_FACTOR;
        var step = Math.min(speed * dt, dist);
        this.cat.x += dx / dist * step;
        this.cat.y += dy / dist * step;
      }
    }

    // 15 分钟倒计时
    if (!this.data.ended) {
      var sec = Math.ceil(this.secondsLeft);
      if (sec !== this.lastSec) {
        this.lastSec = sec;
        this.setData({ timeText: this.fmt(sec) });
      }
      this.secondsLeft -= dt;
      if (this.secondsLeft <= 0) {
        this.secondsLeft = 0;
        this.endedNow = true;
        this.setData({ ended: true });
      }
    }
  },

  fmt: function (s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  },

  render: function () {
    var ctx = this.ctx;
    var W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    // 背景渐变
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2136');
    g.addColorStop(1, '#1a1420');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 地板线
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, H * 0.78, W, 2);

    // 火腿肠（跟手）
    if (this.sausageImg && this.sausagePos) {
      var sw = Math.min(W * 0.14, 64);
      var sh = sw * this.sausageImg.height / this.sausageImg.width;
      ctx.drawImage(this.sausageImg, this.sausagePos.x - sw / 2, this.sausagePos.y - sh / 2, sw, sh);
    }

    // 猫
    if (this.catImg) {
      var bob = 0, squash = 1;
      if (this.moving) {
        var f = Math.sin(this.cat.phase);
        bob = -Math.abs(f) * this.cat.h * 0.05;
        squash = 1 + f * 0.05;
      } else {
        bob = Math.sin(this.cat.phase * 0.5) * this.cat.h * 0.01;
      }
      ctx.save();
      ctx.translate(this.cat.x, this.cat.y + this.cat.h);
      ctx.scale(this.cat.dir, 1);
      ctx.translate(-this.cat.w / 2, -this.cat.h);
      ctx.translate(0, bob);
      ctx.scale(1, squash);
      ctx.drawImage(this.catImg, 0, 0, this.cat.w, this.cat.h);
      ctx.restore();
    }
  },

  toLocal: function (touch) {
    if (typeof touch.x === 'number' && typeof touch.y === 'number') {
      return { x: touch.x, y: touch.y };
    }
    return { x: touch.clientX, y: touch.clientY };
  },

  onTouchStart: function (e) {
    if (this.data.ended) return;
    this.touching = true;
    if (this.returnTimer) { clearTimeout(this.returnTimer); this.returnTimer = null; }
    var p = this.toLocal(e.touches[0]);
    this.sausagePos = p;
    this.target = { x: p.x, y: p.y };
    this.setData({ hint: '' });
  },

  onTouchMove: function (e) {
    if (!this.touching || this.data.ended) return;
    var p = this.toLocal(e.touches[0]);
    this.sausagePos = p;
    this.target = { x: p.x, y: p.y };
  },

  onTouchEnd: function () {
    if (this.data.ended) return;
    this.touching = false;
    if (this.returnTimer) clearTimeout(this.returnTimer);
    var that = this;
    this.returnTimer = setTimeout(function () {
      that.sausagePos = null;
      that.target = { x: that.home.x, y: that.home.y };
      that.returnTimer = null;
    }, RETURN_MS);
  },

  restart: function () {
    this.secondsLeft = SESSION_SECONDS;
    this.lastSec = -1;
    this.endedNow = false;
    this.cat.x = this.home.x;
    this.cat.y = this.home.y;
    this.setData({ ended: false, timeText: '15:00', hint: '再摸一摸它吧～' });
  },

  goRenew: function () {
    wx.showToast({ title: '续时功能即将上线', icon: 'none' });
  }
});

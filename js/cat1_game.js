(function () {
  'use strict';

  // ============ 元素 ============
  var stage = document.getElementById('stage');
  var catEl = document.getElementById('cat');
  var sofaEl = document.getElementById('sofa');
  var sausageEl = document.getElementById('sausage');
  var hintEl = document.getElementById('hint');
  var muteBtn = document.getElementById('muteBtn');

  // ============ 状态 ============
  var cat = { x: 0, y: 0, w: 0, h: 0 };   // x,y = 猫的落脚点（底部中心）
  var home = { x: 0, y: 0 };
  var target = null;                       // 当前目的地
  var touching = false;
  var activePointer = null;
  var returnTimer = null;
  var raf = null;
  var lastT = 0;
  var dir = 1;                             // 1 朝右，-1 朝左
  var runPhase = 0;
  var idlePhase = 0;
  var moving = false;
  var muted = false;
  var audioCtx = null;

  var RETURN_MS = 3000;                    // 松手 3 秒后火腿肠消失
  var SPEED_FACTOR = 1.6;                  // 猫的奔跑速度系数（三条腿也很快）

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  // ============ 布局 ============
  function layout() {
    // 沙发：底部居中
    var sw = Math.min(vw() * 0.52, 340);
    var sh = sw * (sofaEl.naturalHeight / sofaEl.naturalWidth);
    sofaEl.style.width = sw + 'px';
    sofaEl.style.left = ((vw() - sw) / 2) + 'px';
    sofaEl.style.bottom = (vh() * 0.05) + 'px';

    // 猫：站在沙发面上，居中偏右一点
    var catH = vh() * 0.42;
    cat.w = catH * (catEl.naturalWidth / catEl.naturalHeight);
    cat.h = catH;
    catEl.style.width = cat.w + 'px';
    var sofaTop = vh() - vh() * 0.05 - sh;
    home.x = vw() / 2 + sw * 0.06;
    home.y = sofaTop - 6;

    cat.x = home.x;
    cat.y = home.y;
    updateCat(0);
  }

  function updateCat(now) {
    var bob = 0, sway = 0, squash = 1;
    if (moving) {
      // 奔跑：上下颠簸 + 轻微拉伸，模拟三条腿踮脚快跑
      var f = Math.sin(runPhase);
      bob = -Math.abs(f) * cat.h * 0.05;
      squash = 1 + f * 0.05;
    } else {
      // 待机：轻微呼吸 + 左右摇摆
      idlePhase += 0.016;
      sway = Math.sin(idlePhase * 1.4) * 2;
      squash = 1 + Math.sin(idlePhase * 1.4) * 0.015;
    }
    catEl.style.transform =
      'translate(' + (cat.x - cat.w / 2) + 'px,' + (cat.y - cat.h) + 'px)' +
      ' translateY(' + bob + 'px) scaleX(' + dir + ') rotate(' + sway + 'deg) scaleY(' + squash + ')';
  }

  // ============ 火腿肠 ============
  function showSausage(x, y) {
    sausageEl.style.display = 'block';
    sausageEl.style.left = x + 'px';
    sausageEl.style.top = y + 'px';
  }

  function hideSausage() {
    sausageEl.style.display = 'none';
  }

  // ============ 移动逻辑 ============
  function stepCat(dt) {
    if (!target) { moving = false; return; }
    var dx = target.x - cat.x;
    var dy = target.y - cat.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 8) {
      moving = false;
      return;
    }
    moving = true;
    if (Math.abs(dx) > 1) dir = dx > 0 ? 1 : -1;
    var speed = Math.max(vw(), vh()) * SPEED_FACTOR;
    var step = speed * dt;
    if (step > dist) step = dist;
    cat.x += dx / dist * step;
    cat.y += dy / dist * step;
  }

  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    runPhase += dt * 16;
    stepCat(dt);
    updateCat(t);
    raf = requestAnimationFrame(loop);
  }

  // ============ 事件 ============
  function pointOf(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function onDown(e) {
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    touching = true;
    if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }
    var p = pointOf(e);
    showSausage(p.x, p.y);
    target = { x: p.x, y: p.y };
    meow();
    hintEl.style.opacity = '0';
  }

  function onMove(e) {
    if (e.pointerId !== activePointer || !touching) return;
    var p = pointOf(e);
    showSausage(p.x, p.y);
    target = { x: p.x, y: p.y };
  }

  function onUp(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    touching = false;
    if (returnTimer) clearTimeout(returnTimer);
    returnTimer = setTimeout(function () {
      hideSausage();
      target = { x: home.x, y: home.y };
      returnTimer = null;
    }, RETURN_MS);
  }

  function meow() {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(980, t + 0.16);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.42);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    } catch (err) { /* 忽略音频错误 */ }
  }

  // ============ 初始化 ============
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('resize', layout);

  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });
  muteBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  document.getElementById('back').addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  layout();
  cat.x = home.x;
  cat.y = home.y;
  raf = requestAnimationFrame(loop);
})();

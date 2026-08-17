(function () {
  'use strict';

  // ========== 素材配置：三只猫，每只一个文件夹 ==========
  var CATS = [
    { name: '猫一', img: 'assets/img/cat1.png',
      idle:  ['assets/video/cat1/idle1.mp4'],
      react: ['assets/video/cat1/react1.mp4'],
      sleep: 'assets/video/cat1/sleep.mp4' },
    { name: '猫二', img: 'assets/img/cat2.png',
      idle:  ['assets/video/cat2/idle1.mp4'],
      react: ['assets/video/cat2/react1.mp4'],
      sleep: 'assets/video/cat2/sleep.mp4' },
    { name: '猫三', img: 'assets/img/cat3.png',
      idle:  ['assets/video/cat3/idle1.mp4'],
      react: ['assets/video/cat3/react1.mp4'],
      sleep: 'assets/video/cat3/sleep.mp4' }
  ];
  var TIMER_SECONDS = 15 * 60; // 一刻钟
  var SWIPE_MIN = 50;          // 判定为滑动的横向距离
  // =====================================================================

  var $video = document.getElementById('catVideo');
  var $placeholder = document.getElementById('catPlaceholder');
  var $hint = document.getElementById('touchHint');
  var $timer = document.getElementById('timer');
  var $muteBtn = document.getElementById('muteBtn');
  var $fxLayer = document.getElementById('fxLayer');
  var $endOverlay = document.getElementById('endOverlay');
  var $renewBtn = document.getElementById('renewBtn');
  var $restartBtn = document.getElementById('restartBtn');
  var $catDots = document.getElementById('catDots');

  var cur = 0;          // 当前猫索引
  var muted = false;
  var ended = false;
  var secondsLeft = TIMER_SECONDS;
  var audioCtx = null;

  // 触屏手势记录
  var touchStartX = 0, touchStartY = 0, touchStartT = 0;

  function cat() { return CATS[cur]; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---------- 指示点 ----------
  function buildDots() {
    $catDots.innerHTML = '';
    CATS.forEach(function (_, i) {
      var d = document.createElement('div');
      d.className = 'dot' + (i === cur ? ' active' : '');
      d.addEventListener('pointerdown', function (e) { e.stopPropagation(); switchCat(i); });
      $catDots.appendChild(d);
    });
  }

  // ---------- 视频播放 ----------
  function hasIdle(c) { return !!(c.idle && c.idle.length); }
  function hasReact(c) { return !!(c.react && c.react.length); }

  function showPlaceholder() {
    $video.pause();
    $video.style.display = 'none';
    $placeholder.style.backgroundImage = "url('" + cat().img + "')";
    $placeholder.style.display = 'block';
  }

  function showVideo() {
    $video.style.display = 'block';
    $placeholder.style.display = 'none';
  }

  function playClip(src, loop) {
    if (!src) { showPlaceholder(); return; }
    showVideo();
    $video.src = src;
    $video.loop = !!loop;
    $video.play().catch(showPlaceholder);
  }

  function playIdle() {
    $video.classList.remove('switching');
    if (!hasIdle(cat())) { showPlaceholder(); return; }
    playClip(pick(cat().idle), true);
  }

  function playReact() {
    if (!hasReact(cat())) { showPlaceholder(); return; }
    $video.loop = false;
    $video.src = pick(cat().react);
    $video.play().catch(showPlaceholder);
    $video.onended = function () { $video.onended = null; playIdle(); };
  }

  // ---------- 切换猫咪（左右滑动） ----------
  function switchCat(i) {
    if (ended || i === cur) return;
    cur = i;
    buildDots();
    $video.classList.add('switching');
    setTimeout(function () { playIdle(); }, 250);
    meow();
  }

  function nextCat() { switchCat((cur + 1) % CATS.length); }
  function prevCat() { switchCat((cur - 1 + CATS.length) % CATS.length); }

  // ---------- 喵喵叫（Web Audio 合成） ----------
  function meow() {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(950, t + 0.18);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.45);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    } catch (e) { /* 忽略音频错误 */ }
  }

  // ---------- 点击/滑动手势 ----------
  function onDown(e) {
    var p = e.touches ? e.touches[0] : e;
    touchStartX = p.clientX; touchStartY = p.clientY; touchStartT = Date.now();
  }

  function onUp(e) {
    if (ended) return;
    var p = e.changedTouches ? e.changedTouches[0] : e;
    var dx = p.clientX - touchStartX;
    var dy = p.clientY - touchStartY;
    var dt = Date.now() - touchStartT;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 700) {
      if (dx < 0) nextCat(); else prevCat();
      return;
    }
    // 否则视为点击互动
    spawnBurst(p.clientX, p.clientY);
    meow();
    if (hasReact(cat())) playReact(); else shakeCat();
  }

  function spawnBurst(x, y) {
    var emojis = ['❤️', '⭐', '💛', '✨', '😽'];
    var el = document.createElement('div');
    el.className = 'burst';
    el.textContent = pick(emojis);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $fxLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, 750);
  }

  function shakeCat() {
    var wrap = document.getElementById('catWrap');
    wrap.style.animation = 'shake .35s';
    setTimeout(function () { wrap.style.animation = ''; }, 400);
  }

  // ---------- 15 分钟计时 ----------
  function fmt(s) {
    var m = Math.floor(s / 60), ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function tick() {
    if (ended) return;
    secondsLeft--;
    $timer.textContent = fmt(Math.max(0, secondsLeft));
    if (secondsLeft <= 0) endSession();
  }

  function endSession() {
    ended = true;
    $video.pause();
    if (cat().sleep) playClip(cat().sleep, false);
    setTimeout(function () { $endOverlay.classList.remove('hidden'); }, 1500);
  }

  function restart() {
    ended = false;
    secondsLeft = TIMER_SECONDS;
    $timer.textContent = fmt(TIMER_SECONDS);
    $endOverlay.classList.add('hidden');
    playIdle();
  }

  // ---------- 初始化 ----------
  function init() {
    $timer.textContent = fmt(TIMER_SECONDS);
    buildDots();
    $video.addEventListener('error', showPlaceholder);
    playIdle();
    document.getElementById('stage').addEventListener('pointerdown', onDown);
    document.getElementById('stage').addEventListener('pointerup', onUp);
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') nextCat();
      if (e.key === 'ArrowLeft') prevCat();
    });
    setInterval(tick, 1000);
  }

  $muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted;
    $muteBtn.textContent = muted ? '🔇' : '🔊';
  });
  $renewBtn.addEventListener('click', function () {
    // TODO: 后续接充值
    alert('续时功能即将上线，敬请期待～');
  });
  $restartBtn.addEventListener('click', function () { restart(); });

  init();
})();

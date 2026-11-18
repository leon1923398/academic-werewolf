/* ============================================================
   学术狼人杀 · 游戏内核
   主持人中心制单机版：一台设备完成配牌 / 夜间行动 / 答题判定 /
   白天发言 / 匿名投票 / 胜负结算 / 学术战报
   ============================================================ */

(function () {
  'use strict';

  var BANK = window.QUESTION_BANK;
  var CAT = window.SKILL_CATEGORY;

  /* ------------------------------------------------------------
     角色定义（完全对应策划书）
     ------------------------------------------------------------ */
  var ROLES = {
    dev: {
      name: '普通程序员', camp: 'good', icon: '👨‍💻', short: '平民',
      desc: '无特殊技能。依靠线索、发言和投票找出 Bug 制造者。',
      hint: '你的武器是逻辑与观察。少说废话，多说疑点。'
    },
    reviewer: {
      name: '代码审核员', camp: 'good', icon: '🔍', short: '预言家',
      desc: '每晚 1 次身份核验权。夜间指定一名玩家，答对「代码审查」题才核验成功，主持人告知该玩家是否为卧底；答题失败，本次核验作废。',
      hint: '你是好人的眼睛——但眼睛要先证明自己看得懂代码。'
    },
    supervisor: {
      name: '学术监督员', camp: 'good', icon: '🛡️', short: '守卫',
      desc: '每晚 1 次防火墙（不可连续两晚保护同一人）。答对「编程规范」题即设置成功，该玩家本轮免疫投票出局。',
      hint: '防火墙挡的是舆论攻击，不是夜间暗杀。别指望它救人。'
    },
    doubao: {
      name: '豆包', camp: 'good', icon: '💊', short: '女巫',
      desc: '好包 / 孬包各一次，每晚只能用一种，均需答对「调试排错」题。好包救回被暗害者；孬包在投票前强制淘汰一人。',
      hint: '一手救命，一手杀人。药只有两剂，想清楚再喂。'
    },
    bugmaker: {
      name: 'Bug 制造者', camp: 'bad', icon: '🐛', short: '狼人',
      desc: '夜间与队友共同暗害一人，答对「Bug 识别」题才暗杀成功，反之失败。白天可发动病毒植入（自爆，全局仅一次），答题成功立即入夜。',
      hint: '你是这颗代码库里最深的隐患。藏好，也别手软。'
    },
    porter: {
      name: '代码搬运工', camp: 'bad', icon: '📦', short: '卧底',
      desc: '无夜间暗害能力。白天配合主卧底带节奏、洗白队友、诬陷好人，干扰推理。',
      hint: '你不杀人，你只搬运舆论。'
    }
  };

  var ROLE_ORDER = ['dev', 'reviewer', 'supervisor', 'doubao', 'bugmaker', 'porter'];

  /* 推荐配置 */
  var PRESETS = {
    6:  { dev: 1, reviewer: 1, supervisor: 1, doubao: 1, bugmaker: 1, porter: 1 },
    8:  { dev: 2, reviewer: 1, supervisor: 1, doubao: 1, bugmaker: 2, porter: 1 },
    10: { dev: 4, reviewer: 1, supervisor: 1, doubao: 1, bugmaker: 2, porter: 1 },
    12: { dev: 5, reviewer: 1, supervisor: 1, doubao: 1, bugmaker: 2, porter: 2 },
    14: { dev: 6, reviewer: 1, supervisor: 1, doubao: 1, bugmaker: 3, porter: 2 }
  };

  /* ------------------------------------------------------------
     状态
     ------------------------------------------------------------ */
  var S = {};

  function freshState() {
    return {
      phase: 'cover',
      cfg: {
        count: 6,
        counts: Object.assign({}, PRESETS[6]),
        quizTime: 30,
        guardScope: 'vote',      // vote | both
        selfDestruct: true,
        speechSec: 90,
        judgeMode: false         // true = 主持人口头判定，不点选项
      },
      names: [],
      players: [],
      round: 0,
      dealIdx: 0,
      dealtId: null,
      night: {},
      nightQueue: [],
      nightStep: 0,
      nightSub: null,
      lastGuardId: null,
      potions: { save: false, poison: false },
      selfBombUsed: false,
      speechIdx: 0,
      speechLeft: 0,
      speechTimer: null,
      voteMode: false,          // 是否处于匿名记录中
      tally: {},
      voteSeq: [],
      voteRound: 1,
      votesCast: 0,
      log: [],
      quizLog: [],
      usedQ: {},
      modal: null,
      modalTimer: null,
      gameOver: null,
      winner: null,
      winReason: '',
      toast: null
    };
  }

  S = freshState();

  /* ------------------------------------------------------------
     工具
     ------------------------------------------------------------ */
  function alive() { return S.players.filter(function (p) { return p.alive; }); }
  function aliveOf(role) { return S.players.filter(function (p) { return p.alive && p.role === role; }); }
  function byId(id) { return S.players.find(function (p) { return p.id === id; }); }
  function aliveCamp(camp) { return S.players.filter(function (p) { return p.alive && ROLES[p.role].camp === camp; }); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pushLog(round, text, kind) {
    S.log.push({ round: round, text: text, kind: kind || 'info' });
  }
  function setPhase(p) { S.phase = p; render(); }

  /* ------------------------------------------------------------
     答题系统
     ------------------------------------------------------------ */
  function pickQuestion(cat) {
    if (!S.usedQ[cat]) S.usedQ[cat] = [];
    var pool = BANK[cat];
    var idx = [];
    for (var i = 0; i < pool.length; i++) if (S.usedQ[cat].indexOf(i) < 0) idx.push(i);
    if (idx.length === 0) { S.usedQ[cat] = []; for (var k = 0; k < pool.length; k++) idx.push(k); }
    var chosen = idx[Math.floor(Math.random() * idx.length)];
    S.usedQ[cat].push(chosen);
    return { q: pool[chosen], index: chosen, cat: cat };
  }

  var CAT_LABEL = { spec: '编程规范', review: '代码审查', debug: '调试排错', bug: 'Bug 识别' };
  var CAT_OWNER = { spec: '学术监督员 · 防火墙', review: '代码审核员 · 身份核验', debug: '豆包 · 双药', bug: 'Bug 制造者 · 暗杀' };

  /**
   * 弹出一道答题
   * @param {string} cat  题目类别
   * @param {string} sub  副标题（谁在用技能做什么）
   * @param {function(boolean, object)} done
   */
  function openQuiz(cat, sub, done) {
    var item = pickQuestion(cat);
    var q = item.q;
    var shown = Math.min(q.opts.length, 4);

    S.modal = {
      type: 'quiz',
      cat: cat,
      sub: sub,
      q: q,
      item: item,
      left: S.cfg.quizTime,
      picked: null,
      revealed: false,
      done: done
    };

    if (S.modalTimer) clearInterval(S.modalTimer);
    S.modalTimer = setInterval(function () {
      if (!S.modal || S.modal.type !== 'quiz' || S.modal.revealed) return;
      S.modal.left--;
      if (S.modal.left <= 0) {
        S.modal.left = 0;
        revealQuiz(-1);
      } else {
        paintModalClock();
      }
    }, 1000);

    paintModal();
  }

  function revealQuiz(picked) {
    if (!S.modal || S.modal.revealed) return;
    if (S.modalTimer) { clearInterval(S.modalTimer); S.modalTimer = null; }
    S.modal.picked = picked;
    S.modal.revealed = true;
    var ok = picked === S.modal.q.ans;
    S.modal.passed = ok;
    if (ok) AUDIO.ok(); else AUDIO.no();

    S.quizLog.push({
      round: S.round,
      sub: S.modal.sub,
      cat: S.modal.cat,
      q: S.modal.q.q,
      answer: S.modal.q.opts[S.modal.q.ans],
      picked: picked >= 0 ? S.modal.q.opts[picked] : '（超时未答）',
      passed: ok,
      why: S.modal.q.why
    });
    paintModal();
  }

  function closeQuiz() {
    var m = S.modal;
    S.modal = null;
    if (S.modalTimer) { clearInterval(S.modalTimer); S.modalTimer = null; }
    var el = document.getElementById('modal');
    if (el) { el.innerHTML = ''; el.classList.remove('open'); }
    if (m && m.done) m.done(m.passed, m);
  }

  /* ------------------------------------------------------------
     提示音（WebAudio，无外部音频文件）
     ------------------------------------------------------------ */
  var AUDIO = (function () {
    var ctx = null, muted = false;
    try { muted = localStorage.getItem('awl_muted') === '1'; } catch (e) {}
    function ac() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        try { ctx = new C(); } catch (e) { ctx = null; }
      }
      if (ctx && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    /* 一个带包络的单音 */
    function tone(freq, dur, type, vol, at) {
      if (muted) return;
      var c = ac(); if (!c) return;
      var t0 = c.currentTime + (at || 0);
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    return {
      isMuted: function () { return muted; },
      toggle: function () {
        muted = !muted;
        try { localStorage.setItem('awl_muted', muted ? '1' : '0'); } catch (e) {}
        if (!muted) tone(880, 0.12, 'sine', 0.14, 0);
        return muted;
      },
      unlock: function () { ac(); },
      night: function () { tone(320, 0.5, 'sine', 0.12, 0); tone(240, 0.7, 'sine', 0.10, 0.18); },
      dawn:  function () { tone(523, 0.3, 'triangle', 0.14, 0); tone(659, 0.3, 'triangle', 0.12, 0.16); tone(784, 0.5, 'triangle', 0.12, 0.32); },
      ok:    function () { tone(784, 0.14, 'triangle', 0.16, 0); tone(1046, 0.22, 'triangle', 0.14, 0.12); },
      no:    function () { tone(196, 0.22, 'sawtooth', 0.12, 0); tone(147, 0.34, 'sawtooth', 0.12, 0.16); },
      out:   function () { tone(300, 0.18, 'square', 0.10, 0); tone(200, 0.26, 'square', 0.10, 0.14); tone(140, 0.4, 'square', 0.10, 0.32); },
      win:   function () { tone(523, 0.18, 'triangle', 0.14, 0); tone(659, 0.18, 'triangle', 0.14, 0.16); tone(784, 0.18, 'triangle', 0.14, 0.32); tone(1046, 0.6, 'triangle', 0.16, 0.48); }
    };
  })();

  /* ------------------------------------------------------------
     渲染主入口
     ------------------------------------------------------------ */
  function render() {
    var app = document.getElementById('app');
    if (!app) return;
    var html = '';
    switch (S.phase) {
      case 'cover': html = viewCover(); break;
      case 'setup': html = viewSetup(); break;
      case 'deal': html = viewDeal(); break;
      case 'night': html = viewNight(); break;
      case 'dawn': html = viewDawn(); break;
      case 'speech': html = viewSpeech(); break;
      case 'vote': html = viewVote(); break;
      case 'voteResult': html = viewVoteResult(); break;
      case 'gameover': html = viewGameOver(); break;
      default: html = viewCover();
    }
    app.innerHTML = html;
  }

  function boardHTML(opts) {
    opts = opts || {};
    var html = '<div class="board">';
    S.players.forEach(function (p) {
      var cls = ['seat'];
      if (!p.alive) cls.push('dead');
      if (opts.highlight === p.id) cls.push('hl');
      if (opts.mark && opts.mark[p.id]) cls.push(opts.mark[p.id]);
      var roleTag = opts.showRole
        ? '<span class="seat-role">' + ROLES[p.role].icon + '</span>' : '';
      html += '<div class="' + cls.join(' ') + '"' +
        (opts.clickable && p.alive ? ' data-act="boardPick" data-id="' + p.id + '"' : '') + '>' +
        '<div class="seat-no">' + (p.id + 1) + '</div>' +
        '<div class="seat-name">' + esc(p.name) + '</div>' +
        roleTag +
        (p.alive ? '' : '<div class="seat-x">✕</div>') +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function hudHTML() {
    var good = aliveCamp('good').length, bad = aliveCamp('bad').length;
    return '<div class="hud">' +
      '<div class="hud-item"><b>' + (S.round || 1) + '</b><span>轮次</span></div>' +
      '<div class="hud-item"><b class="c-good">' + good + '</b><span>好人存活</span></div>' +
      '<div class="hud-item"><b class="c-bad">' + bad + '</b><span>卧底存活</span></div>' +
      '<div class="hud-item"><b>' + alive().length + '/' + S.players.length + '</b><span>在场</span></div>' +
      '<button class="hud-mute" data-act="toggleMute" title="开关提示音">' + (AUDIO.isMuted() ? '🔇' : '🔊') + '</button>' +
      '</div>';
  }

  /* ---------- 封面 ---------- */
  function viewCover() {
    return '' +
      '<div class="screen cover">' +
      '<div class="cover-grid"></div>' +
      '<div class="cover-inner">' +
      '<div class="cover-badge">共青团软件学院委员会 · 学生会学术创新部</div>' +
      '<h1 class="cover-title">学术<span>狼人杀</span></h1>' +
      '<p class="cover-sub">以辩促思 · 以游促学</p>' +
      '<p class="cover-desc">好人阵营追查 Bug，卧底阵营制造 Bug。<br>' +
      '但在这局游戏里，<b>你的每一次技能都要先答对一道题</b>——<br>' +
      '说得出原理的人，才有资格出手。</p>' +
      '<div class="cover-actions">' +
      '<button class="btn btn-primary btn-lg" data-act="toSetup">开始配置 →</button>' +
      '<button class="btn btn-ghost" data-act="showRules">规则速览</button>' +
      '</div>' +
      '<div class="cover-foot">主持人中心制 · 一台设备 / 投影同屏 · 无需联网</div>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 配置 ---------- */
  function viewSetup() {
    var cfg = S.cfg;
    var total = 0;
    ROLE_ORDER.forEach(function (r) { total += cfg.counts[r] || 0; });
    var bad = (cfg.counts.bugmaker || 0) + (cfg.counts.porter || 0);
    var good = total - bad;
    var mismatch = total !== cfg.count;

    var roleRows = ROLE_ORDER.map(function (r) {
      var R = ROLES[r];
      var n = cfg.counts[r] || 0;
      return '<tr>' +
        '<td class="tc-icon">' + R.icon + '</td>' +
        '<td><b>' + R.name + '</b> <span class="tag ' + (R.camp === 'good' ? 'tag-good' : 'tag-bad') + '">' + (R.camp === 'good' ? '好人' : '卧底') + '</span>' +
        '<div class="role-desc">' + R.desc + '</div></td>' +
        '<td class="tc-num">' +
        '<button class="step" data-act="roleInc" data-id="' + r + '" data-v="-1">−</button>' +
        '<span class="num">' + n + '</span>' +
        '<button class="step" data-act="roleInc" data-id="' + r + '" data-v="1">+</button>' +
        '</td></tr>';
    }).join('');

    return '' +
      '<div class="screen">' +
      '<div class="page-head"><h2>开局配置</h2>' +
      '<div class="head-right"><span class="pill">' + cfg.count + ' 人局</span>' +
      '<span class="pill pill-good">好 ' + good + '</span>' +
      '<span class="pill pill-bad">卧底 ' + bad + '</span>' +
      (mismatch ? '<span class="pill pill-warn">人数不符</span>' : '') +
      '</div></div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-title">人数</div>' +
      '<div class="chips">' +
      Object.keys(PRESETS).map(function (n) {
        return '<button class="chip' + (cfg.count == n ? ' on' : '') + '" data-act="setCount" data-id="' + n + '">' + n + ' 人</button>';
      }).join('') +
      '</div>' +
      '<div class="card-title" style="margin-top:18px">角色配置</div>' +
      '<table class="role-table">' + roleRows + '</table>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title">规则参数</div>' +
      '<div class="opt-row"><label>答题时限</label>' +
      '<div class="chips">' + [20, 30, 45, 60].map(function (v) {
        return '<button class="chip' + (cfg.quizTime === v ? ' on' : '') + '" data-act="setOpt" data-id="quizTime" data-v="' + v + '">' + v + 's</button>';
      }).join('') + '</div></div>' +

      '<div class="opt-row"><label>守卫保护范围</label>' +
      '<div class="chips">' +
      '<button class="chip' + (cfg.guardScope === 'vote' ? ' on' : '') + '" data-act="setOpt" data-id="guardScope" data-v="vote">仅挡投票（策划书原文）</button>' +
      '<button class="chip' + (cfg.guardScope === 'both' ? ' on' : '') + '" data-act="setOpt" data-id="guardScope" data-v="both">挡投票 + 夜刀</button>' +
      '</div></div>' +

      '<div class="opt-row"><label>发言时长</label>' +
      '<div class="chips">' + [60, 90, 120, 180].map(function (v) {
        return '<button class="chip' + (cfg.speechSec === v ? ' on' : '') + '" data-act="setOpt" data-id="speechSec" data-v="' + v + '">' + v + 's</button>';
      }).join('') + '</div></div>' +

      '<div class="opt-row"><label>病毒植入（自爆）</label>' +
      '<div class="chips">' +
      '<button class="chip' + (cfg.selfDestruct ? ' on' : '') + '" data-act="setOpt" data-id="selfDestruct" data-v="1">开启</button>' +
      '<button class="chip' + (!cfg.selfDestruct ? ' on' : '') + '" data-act="setOpt" data-id="selfDestruct" data-v="0">关闭</button>' +
      '</div></div>' +

      '<div class="opt-row"><label>判定方式</label>' +
      '<div class="chips">' +
      '<button class="chip' + (!cfg.judgeMode ? ' on' : '') + '" data-act="setOpt" data-id="judgeMode" data-v="0">选手点选答案</button>' +
      '<button class="chip' + (cfg.judgeMode ? ' on' : '') + '" data-act="setOpt" data-id="judgeMode" data-v="1">口头抢答 · 主持人判</button>' +
      '</div></div>' +

      '<div class="card-title" style="margin-top:18px">玩家名单 <small>（每行一个，可留空自动编号）</small></div>' +
      '<textarea id="names" class="names" rows="5" placeholder="张三&#10;李四&#10;王五">' + esc(S.names.join('\n')) + '</textarea>' +

      '<div class="card-foot">' +
      '<button class="btn btn-ghost" data-act="backCover">← 返回</button>' +
      '<button class="btn btn-primary" data-act="startDeal"' + (mismatch || bad < 1 || good < 1 ? ' disabled' : '') + '>洗牌发牌 →</button>' +
      '</div>' +
      '</div></div></div>';
  }

  /* ---------- 发牌 ---------- */
  function viewDeal() {
    var p = byId(S.dealtId);
    if (p) {
      var R = ROLES[p.role];
      var mates = S.players.filter(function (x) { return x.id !== p.id && ROLES[x.role].camp === 'bad' && ROLES[p.role].camp === 'bad'; });
      var mateHTML = mates.length
        ? '<div class="mate">你的队友：' + mates.map(function (m) { return '<b>' + (m.id + 1) + ' 号 ' + esc(m.name) + '</b>（' + ROLES[m.role].name + '）'; }).join('、') + '</div>'
        : (ROLES[p.role].camp === 'bad' ? '<div class="mate">你没有队友，独自潜伏。</div>' : '');

      return '' +
        '<div class="deal-overlay">' +
        '<div class="deal-card ' + (R.camp === 'bad' ? 'bad' : 'good') + '">' +
        '<div class="deal-no">' + (p.id + 1) + ' 号 · ' + esc(p.name) + '</div>' +
        '<div class="deal-icon">' + R.icon + '</div>' +
        '<div class="deal-camp">' + (R.camp === 'good' ? '靠谱开发阵营' : 'Bug 制造者阵营') + '</div>' +
        '<div class="deal-role">' + R.name + '</div>' +
        '<div class="deal-desc">' + R.desc + '</div>' +
        mateHTML +
        '<div class="deal-hint">' + R.hint + '</div>' +
        '<button class="btn btn-primary btn-lg" data-act="dealDone">我已记住，遮住屏幕</button>' +
        '</div></div>';
    }

    var dealt = S.players.filter(function (x) { return x.dealt; }).length;
    var list = S.players.map(function (x) {
      return '<button class="deal-slot' + (x.dealt ? ' done' : '') + '"' +
        (x.dealt ? '' : ' data-act="dealPick" data-id="' + x.id + '"') + '>' +
        '<span class="ds-no">' + (x.id + 1) + '</span>' +
        '<span class="ds-name">' + esc(x.name) + '</span>' +
        '<span class="ds-state">' + (x.dealt ? '已查看' : '待查看') + '</span>' +
        '</button>';
    }).join('');

    return '' +
      '<div class="screen">' +
      '<div class="page-head"><h2>身份分发</h2>' +
      '<div class="head-right"><span class="pill">' + dealt + ' / ' + S.players.length + '</span></div></div>' +
      '<div class="card">' +
      '<p class="lead">把设备依次递给对应玩家，点他的座位翻看身份卡，看完点「我已记住」自动遮屏。<b>请勿口头说出屏幕内容。</b></p>' +
      '<div class="deal-grid">' + list + '</div>' +
      '<div class="card-foot">' +
      '<button class="btn btn-ghost" data-act="backSetup">← 重新配置</button>' +
      '<button class="btn btn-primary" data-act="beginNight"' + (dealt === S.players.length ? '' : ' disabled') + '>全部看完，进入第一夜 →</button>' +
      '</div></div></div>';
  }

  /* ---------- 夜晚 ---------- */
  var NIGHT_STEPS = [
    { key: 'guard', role: 'supervisor', title: '学术监督员请睁眼', sub: '设置防火墙' },
    { key: 'wolves', role: 'bugmaker', title: 'Bug 制造者请睁眼', sub: '确认队友，选择暗害目标' },
    { key: 'witch', role: 'doubao', title: '豆包请睁眼', sub: '好包 / 孬包，今晚用哪个' },
    { key: 'seer', role: 'reviewer', title: '代码审核员请睁眼', sub: '指定一人进行身份核验' }
  ];

  function viewNight() {
    var step = NIGHT_STEPS[S.nightStep];
    if (!step) { return viewDawn(); }

    var actor = aliveOf(step.role)[0];
    if (!actor) {
      return '<div class="screen"><div class="card center"><h2>' + step.title + '</h2>' +
        '<p class="lead">' + ROLES[step.role].name + ' 已出局，本步骤跳过。</p>' +
        '<button class="btn btn-primary" data-act="nightSkip">继续 →</button></div></div>';
    }

    var head = '<div class="page-head"><h2>第 ' + S.round + ' 夜</h2>' +
      '<div class="head-right">' + hudHTML() + '</div></div>';

    var n = S.night;

    /* 醒目提示：这一步该把设备交给谁 */
    var whoTxt;
    if (step.key === 'wolves') {
      var ws = aliveOf('bugmaker').map(function (w) { return (w.id + 1) + ' 号'; }).join('、');
      whoTxt = ws + (aliveOf('porter').length ? '（及队友 ' + aliveOf('porter').map(function (w) { return (w.id + 1) + ' 号'; }).join('、') + '）' : '');
    } else {
      whoTxt = (actor.id + 1) + ' 号 · ' + esc(actor.name);
    }
    var handoff = '<div class="handoff">📱 请把设备递给 <b>' + whoTxt + '</b>，由本人在自己的回合操作</div>';

    /* ---- 守卫 ---- */
    if (step.key === 'guard') {
      var tgt = n.guardTarget;
      return head + handoff + '<div class="card">' +
        '<div class="act-head"><span class="act-role">🛡️ 学术监督员</span>' +
        '<span class="act-who">' + (actor.id + 1) + ' 号 · ' + esc(actor.name) + '</span></div>' +
        '<p class="lead">选择今晚要设置防火墙的玩家。答对「编程规范」题即生效，<b>该玩家本轮免疫投票出局</b>；答错则本次作废。</p>' +
        (S.lastGuardId !== null ? '<p class="warn">规则：不可连续两晚保护同一人。（上一晚保护了 ' + (S.lastGuardId + 1) + ' 号）</p>' : '') +
        boardHTML({ clickable: true, showRole: true, mark: markFor('guard') }) +
        '<div class="card-foot"><button class="btn btn-ghost" data-act="nightSkip">放弃本次行动</button></div>' +
        '</div>';
    }

    /* ---- 狼人 ---- */
    if (step.key === 'wolves') {
      var wolves = aliveOf('bugmaker');
      var mateList = wolves.map(function (w) { return (w.id + 1) + ' 号 ' + esc(w.name); }).join('、');
      return head + handoff + '<div class="card bad-card">' +
        '<div class="act-head"><span class="act-role">🐛 Bug 制造者</span>' +
        '<span class="act-who">' + mateList + (aliveOf('porter').length ? ' ｜ 队友 ' + aliveOf('porter').map(function (w) { return (w.id + 1) + ' 号'; }).join('、') : '') + '</span></div>' +
        '<p class="lead">共同选择一名暗害目标。答对「Bug 识别」题即暗杀成功，失败则今晚无人受伤。</p>' +
        boardHTML({ clickable: true, showRole: true, mark: markFor('wolves') }) +
        '<div class="card-foot"><button class="btn btn-ghost" data-act="nightSkip">今晚不暗害（跳过）</button></div>' +
        '</div>';
    }

    /* ---- 女巫 ---- */
    if (step.key === 'witch') {
      if (!S.nightSub) {
        var saveLeft = !S.potions.save;
        var poisonLeft = !S.potions.poison;
        var killed = (n.wolfOk && n.wolfTarget !== null) ? byId(n.wolfTarget) : null;
        return head + handoff + '<div class="card">' +
          '<div class="act-head"><span class="act-role">💊 豆包</span>' +
          '<span class="act-who">' + (actor.id + 1) + ' 号 · ' + esc(actor.name) + '</span></div>' +
          '<div class="potion-status">' +
          '<span class="' + (saveLeft ? '' : 'used') + '">好包 ' + (saveLeft ? '可用' : '已用') + '</span>' +
          '<span class="' + (poisonLeft ? '' : 'used') + '">孬包 ' + (poisonLeft ? '可用' : '已用') + '</span>' +
          '</div>' +
          '<p class="lead">今晚只能选择一种药。每剂都要答对「调试排错」题才生效。</p>' +
          (killed ? '<p class="warn">今夜被暗害的是：<b>' + (killed.id + 1) + ' 号 ' + esc(killed.name) + '</b></p>'
                  : '<p class="muted">今夜无人被暗害。</p>') +
          '<div class="potion-grid">' +
          '<button class="potion ' + (saveLeft && killed ? '' : 'dis') + '" data-act="witchMode" data-id="save"' + (saveLeft && killed ? '' : ' disabled') + '>' +
          '<b>好包</b><span>救回被暗害的玩家</span></button>' +
          '<button class="potion ' + (poisonLeft ? '' : 'dis') + '" data-act="witchMode" data-id="poison"' + (poisonLeft ? '' : ' disabled') + '>' +
          '<b>孬包</b><span>毒杀一名疑似卧底</span></button>' +
          '</div>' +
          '<div class="card-foot"><button class="btn btn-ghost" data-act="nightSkip">今晚不用药</button></div>' +
          '</div>';
      }
      // 选目标
      var modeTxt = S.nightSub === 'save' ? '好包（救人）' : '孬包（毒杀）';
      return head + handoff + '<div class="card">' +
        '<div class="act-head"><span class="act-role">💊 豆包 · ' + modeTxt + '</span></div>' +
        '<p class="lead">' + (S.nightSub === 'save' ? '救回今夜被暗害的人。' : '选择一名玩家毒杀。') + '答对「调试排错」题才生效。</p>' +
        boardHTML({ clickable: true, showRole: true }) +
        '<div class="card-foot"><button class="btn btn-ghost" data-act="witchBack">← 换个选择</button></div>' +
        '</div>';
    }

    /* ---- 预言家 ---- */
    if (step.key === 'seer') {
      return head + handoff + '<div class="card">' +
        '<div class="act-head"><span class="act-role">🔍 代码审核员</span>' +
        '<span class="act-who">' + (actor.id + 1) + ' 号 · ' + esc(actor.name) + '</span></div>' +
        '<p class="lead">指定一名玩家进行身份核验。答对「代码审查」题才核验成功，主持人告知其是否为卧底；答错本次作废。</p>' +
        boardHTML({ clickable: true, showRole: true }) +
        '<div class="card-foot"><button class="btn btn-ghost" data-act="nightSkip">放弃本次核验</button></div>' +
        '</div>';
    }

    return viewDawn();
  }

  function markFor(key) { return {}; }

  /* ---------- 天亮 ---------- */
  function viewDawn() {
    var n = S.night;
    var lines = [];
    var deadIds = [];
    if (n.wolfOk && n.wolfTarget !== null) {
      var t = byId(n.wolfTarget);
      var saved = n.witchMode === 'save' && n.witchOk && n.witchTarget === n.wolfTarget;
      var guarded = S.cfg.guardScope === 'both' && n.guardOk && n.guardTarget === n.wolfTarget;
      if (t && t.alive && !saved && !guarded) { t.alive = false; deadIds.push(t.id); }
    }
    if (n.witchMode === 'poison' && n.witchOk && n.witchTarget !== null) {
      var v = byId(n.witchTarget);
      if (v && v.alive) { v.alive = false; deadIds.push(v.id); }
    }

    var deathHTML = deadIds.length
      ? '<div class="dead-list">' + deadIds.map(function (id) {
          var p = byId(id);
          return '<div class="dead-item"><b>' + (p.id + 1) + ' 号 ' + esc(p.name) + '</b><span>昨夜出局</span></div>';
        }).join('') + '</div>'
      : '<div class="peace">昨夜平安无事，无人出局。</div>';

    deadIds.forEach(function (id) {
      pushLog(S.round, (id + 1) + ' 号 ' + byId(id).name + ' 于第 ' + S.round + ' 夜出局', 'death');
    });

    return '<div class="screen">' +
      '<div class="page-head"><h2>天亮了 · 第 ' + S.round + ' 天</h2><div class="head-right">' + hudHTML() + '</div></div>' +
      '<div class="card">' +
      '<div class="dawn-mark">☀</div>' +
      deathHTML +
      '<p class="lead center">主持人公布完毕后，进入轮流发言环节。</p>' +
      '<div class="card-foot center"><button class="btn btn-primary btn-lg" data-act="toSpeech">进入发言 →</button></div>' +
      '</div>' + boardHTML({}) + '</div>';
  }

  /* ---------- 发言 ---------- */
  function viewSpeech() {
    var live = alive();
    if (S.speechIdx >= live.length) {
      return '<div class="screen"><div class="card center"><h2>发言结束</h2>' +
        '<p class="lead">所有在场玩家发言完毕，进入匿名投票。</p>' +
        '<button class="btn btn-primary btn-lg" data-act="toVote">开始投票 →</button></div></div>';
    }
    var cur = live[S.speechIdx];
    var bombAvailable = S.cfg.selfDestruct && !S.selfBombUsed && aliveOf('bugmaker').length > 0;

    return '<div class="screen">' +
      '<div class="page-head"><h2>轮流发言 · 第 ' + S.round + ' 天</h2><div class="head-right">' + hudHTML() + '</div></div>' +
      '<div class="card">' +
      '<div class="speaker">' +
      '<div class="sp-idx">' + (S.speechIdx + 1) + '/' + live.length + '</div>' +
      '<div class="sp-name">' + (cur.id + 1) + ' 号 · ' + esc(cur.name) + '</div>' +
      '<div class="sp-timer" id="spTimer">' + fmt(S.speechLeft) + '</div>' +
      '</div>' +
      '<p class="lead center">分析疑点、质疑、辩护。倒计时结束自动切下一位。</p>' +
      '<div class="card-foot center">' +
      '<button class="btn btn-ghost" data-act="speechReset">重置计时</button>' +
      '<button class="btn btn-primary" data-act="speechNext">下一位 →</button>' +
      (bombAvailable ? '<button class="btn btn-danger" data-act="selfBomb">💣 病毒植入（自爆）</button>' : '') +
      '</div></div>' +
      boardHTML({ highlight: cur.id }) + '</div>';
  }

  function fmt(s) {
    s = Math.max(0, s | 0);
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  /* ---------- 投票 ---------- */
  function viewVote() {
    var live = alive();
    var need = live.length;
    var cast = S.votesCast;

    if (!S.voteMode) {
      return '<div class="screen">' +
        '<div class="page-head"><h2>匿名投票 · 第 ' + S.round + ' 天' + (S.voteRound > 1 ? '（第 ' + S.voteRound + ' 轮重投）' : '') + '</h2>' +
        '<div class="head-right">' + hudHTML() + '</div></div>' +
        '<div class="card center">' +
        '<p class="lead">全员匿名投票，选出怀疑的卧底。得票最高者成为嫌疑人。<br>' +
        (S.cfg.guardScope === 'vote' || S.cfg.guardScope === 'both' ? '若该玩家被学术监督员的防火墙保护，本轮投票无效，无人出局。' : '') +
        '</p>' +
        '<button class="btn btn-primary btn-lg" data-act="voteStart">开始记录投票 →</button>' +
        '</div></div>';
    }

    var grid = live.map(function (p) {
      var c = S.tally[p.id] || 0;
      return '<button class="vote-btn' + (c > 0 ? ' has' : '') + '" data-act="castVote" data-id="' + p.id + '">' +
        '<span class="vb-no">' + (p.id + 1) + '</span>' +
        '<span class="vb-name">' + esc(p.name) + '</span>' +
        '<span class="vb-count">' + (c > 0 ? '+' + c : '') + '</span>' +
        '</button>';
    }).join('');

    return '<div class="screen">' +
      '<div class="page-head"><h2>记录中 · 已投 ' + cast + ' / ' + need + '</h2>' +
      '<div class="head-right">' + hudHTML() + '</div></div>' +
      '<div class="card">' +
      '<p class="lead center">按主持人唱票顺序点击对应座位，每点一次记一票。<b>票数实时隐藏</b>，全部投完再揭晓。</p>' +
      '<div class="vote-grid">' + grid + '</div>' +
      '<div class="vote-bar"><div class="vb-fill" style="width:' + Math.round(cast / need * 100) + '%"></div></div>' +
      '<div class="card-foot center">' +
      '<button class="btn btn-ghost" data-act="voteUndo">撤销一票</button>' +
      '<button class="btn btn-primary" data-act="voteReveal"' + (cast >= need ? '' : ' disabled') + '>揭晓结果 →</button>' +
      '</div></div></div>';
  }

  /* ---------- 投票结果 ---------- */
  function viewVoteResult() {
    var r = S.voteResult;
    var bars = r.rows.map(function (row) {
      var pct = r.top ? Math.round(row.count / r.total * 100) : 0;
      return '<div class="bar-row' + (row.top ? ' top' : '') + '">' +
        '<span class="br-name">' + (row.id + 1) + ' 号 ' + esc(row.name) + '</span>' +
        '<span class="br-track"><span class="br-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="br-num">' + row.count + '</span></div>';
    }).join('');

    var verdict = '';
    if (r.tied && S.voteRound === 1) {
      verdict = '<div class="verdict warn"><b>平票</b><span>' + r.tieNames + ' 并列最高票，需要重投一轮。</span></div>';
    } else if (r.tied) {
      verdict = '<div class="verdict"><b>再次平票</b><span>本轮无人出局。</span></div>';
    } else if (r.blocked) {
      verdict = '<div class="verdict good"><b>防火墙生效</b><span>' + (r.outId + 1) + ' 号 ' + esc(r.outName) + ' 被学术监督员保护，本轮投票无效，无人出局。</span></div>';
    } else if (r.outId === null) {
      verdict = '<div class="verdict"><b>无人出局</b><span>本轮没有产生有效出局。</span></div>';
    } else {
      verdict = '<div class="verdict bad"><b>投票出局</b><span>' + (r.outId + 1) + ' 号 ' + esc(r.outName) + ' 以 ' + r.topCount + ' 票出局。</span></div>';
    }

    var btn = '';
    if (r.tied && S.voteRound === 1) btn = '<button class="btn btn-primary btn-lg" data-act="revote">重投一轮 →</button>';
    else btn = '<button class="btn btn-primary btn-lg" data-act="afterVote">继续 →</button>';

    return '<div class="screen">' +
      '<div class="page-head"><h2>投票结果</h2><div class="head-right">' + hudHTML() + '</div></div>' +
      '<div class="card">' + bars + verdict +
      '<div class="card-foot center">' + btn + '</div></div>' +
      boardHTML({}) + '</div>';
  }

  /* ---------- 结束 ---------- */
  function viewGameOver() {
    var w = S.winner;
    var reveal = S.players.map(function (p) {
      var R = ROLES[p.role];
      return '<div class="rev-item ' + (R.camp === 'bad' ? 'bad' : 'good') + (p.alive ? '' : ' out') + '">' +
        '<span class="rv-icon">' + R.icon + '</span>' +
        '<span class="rv-no">' + (p.id + 1) + '</span>' +
        '<span class="rv-name">' + esc(p.name) + '</span>' +
        '<span class="rv-role">' + R.name + '</span>' +
        (p.alive ? '<span class="rv-st">存活</span>' : '<span class="rv-st dead">出局</span>') +
        '</div>';
    }).join('');

    var quizRows = S.quizLog.map(function (q, i) {
      return '<tr class="' + (q.passed ? 'ok' : 'no') + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td>R' + q.round + '</td>' +
        '<td>' + esc(q.sub) + '</td>' +
        '<td><span class="mini-cat">' + (CAT_LABEL[q.cat] || q.cat) + '</span></td>' +
        '<td class="qcell">' + esc(q.q) + '</td>' +
        '<td>' + esc(q.picked) + '</td>' +
        '<td>' + (q.passed ? '✅' : '❌') + '</td>' +
        '<td class="whycell">' + esc(q.why) + '</td>' +
        '</tr>';
    }).join('');

    var pass = S.quizLog.filter(function (q) { return q.passed; }).length;
    var tot = S.quizLog.length;
    var rate = tot ? Math.round(pass / tot * 100) : 0;
    var weak = {};
    S.quizLog.filter(function (q) { return !q.passed; }).forEach(function (q) { weak[q.cat] = (weak[q.cat] || 0) + 1; });
    var weakTxt = Object.keys(weak).map(function (c) { return CAT_LABEL[c] + '（错 ' + weak[c] + '）'; }).join('、') || '无';

    return '<div class="screen wide">' +
      '<div class="over ' + (w === 'good' ? 'good' : 'bad') + '">' +
      '<div class="over-tag">' + (w === 'good' ? '靠谱开发阵营 胜利' : 'Bug 制造者阵营 胜利') + '</div>' +
      '<div class="over-title">' + (w === 'good' ? '代码通过评审' : '缺陷已上线') + '</div>' +
      '<div class="over-why">' + esc(S.winReason) + '</div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-title">身份揭晓</div><div class="reveal">' + reveal + '</div></div>' +
      '<div class="card"><div class="card-title">学术复盘</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><b>' + tot + '</b><span>答题次数</span></div>' +
      '<div class="stat"><b>' + pass + '</b><span>答对</span></div>' +
      '<div class="stat"><b>' + rate + '%</b><span>正确率</span></div>' +
      '</div>' +
      '<p class="lead">本局最需要补的知识块：<b>' + esc(weakTxt) + '</b></p>' +
      '<div class="log-list">' + S.log.map(function (l) {
        return '<div class="log-item ' + l.kind + '"><span class="lg-r">R' + l.round + '</span>' + esc(l.text) + '</div>';
      }).join('') + '</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-title">逐题战报 <small>（可直接导出用于活动总结 / 学时认定）</small></div>' +
      (tot ? '<div class="table-wrap"><table class="report"><thead><tr>' +
        '<th>#</th><th>轮</th><th>技能</th><th>类别</th><th>题目</th><th>作答</th><th>结果</th><th>解析</th>' +
        '</tr></thead><tbody>' + quizRows + '</tbody></table></div>'
        : '<p class="lead">本局未触发答题。</p>') +
      '</div>' +

      '<div class="card-foot center" style="padding:20px 0 40px">' +
      '<button class="btn btn-ghost" data-act="exportReport">导出战报 .md</button>' +
      '<button class="btn btn-primary btn-lg" data-act="restart">再来一局</button>' +
      '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------
     流程控制
     ------------------------------------------------------------ */
  function startDeal() {
    var ta = document.getElementById('names');
    if (ta) S.names = ta.value.split('\n').map(function (s) { return s.trim(); });

    var n = S.cfg.count;
    var pool = [];
    ROLE_ORDER.forEach(function (r) {
      var c = S.cfg.counts[r] || 0;
      for (var i = 0; i < c; i++) pool.push(r);
    });
    while (pool.length < n) pool.push('dev');
    pool = pool.slice(0, n);
    shuffle(pool);

    S.players = [];
    for (var i = 0; i < n; i++) {
      var nm = (S.names[i] || '').trim() || ('玩家' + (i + 1));
      S.players.push({ id: i, name: nm, role: pool[i], alive: true, dealt: false, iconHtml: '' });
    }
    S.round = 0;
    S.dealIdx = 0;
    S.dealtId = null;
    S.log = [];
    S.quizLog = [];
    S.usedQ = {};
    S.potions = { save: false, poison: false };
    S.selfBombUsed = false;
    S.lastGuardId = null;
    S.winner = null;
    setPhase('deal');
  }

  function beginNight() {
    S.round++;
    S.night = {
      guardTarget: null, guardOk: false,
      wolfTarget: null, wolfOk: false,
      witchMode: null, witchTarget: null, witchOk: false,
      seerTarget: null, seerOk: false, seerResult: null
    };
    S.nightStep = 0;
    S.nightSub = null;
    S.voteMode = false;
    S.tally = {};
    S.votesCast = 0;
    S.voteRound = 1;
    S.speechIdx = 0;
    S.speechLeft = S.cfg.speechSec;
    pushLog(S.round, '第 ' + S.round + ' 夜开始', 'phase');
    AUDIO.night();
    setPhase('night');
  }

  function nextNightStep() {
    S.nightStep++;
    S.nightSub = null;
    if (S.nightStep >= NIGHT_STEPS.length) {
      if (S.speechTimer) { clearInterval(S.speechTimer); S.speechTimer = null; }
      AUDIO.dawn();
      setPhase('dawn');
    } else {
      render();
    }
  }

  /* 守卫选人 */
  function guardPick(id) {
    if (S.lastGuardId === id) { toast('不可连续两晚保护同一人'); return; }
    var p = byId(id);
    openQuiz(CAT.supervisor, '学术监督员 · 为 ' + (p.id + 1) + ' 号设置防火墙', function (ok) {
      S.night.guardTarget = id;
      S.night.guardOk = ok;
      if (ok) S.lastGuardId = id;
      pushLog(S.round, '学术监督员为 ' + (p.id + 1) + ' 号设置防火墙：' + (ok ? '成功' : '答题失败，作废'), ok ? 'ok' : 'no');
      nextNightStep();
    });
  }

  /* 狼人选人 */
  function wolfPick(id) {
    var p = byId(id);
    openQuiz(CAT.bugmaker, 'Bug 制造者 · 暗害 ' + (p.id + 1) + ' 号', function (ok) {
      S.night.wolfTarget = id;
      S.night.wolfOk = ok;
      pushLog(S.round, 'Bug 制造者暗害 ' + (p.id + 1) + ' 号：' + (ok ? '成功' : '答题失败，暗杀未成'), ok ? 'bad' : 'no');
      nextNightStep();
    });
  }

  /* 女巫 */
  function witchMode(mode) {
    S.nightSub = mode;
    S.night.witchMode = mode;
    if (mode === 'save') {
      // 只能救被暗害的那个人
      var id = S.night.wolfTarget;
      if (id === null || !S.night.wolfOk) { toast('今夜无人被暗害'); S.nightSub = null; render(); return; }
      var p = byId(id);
      openQuiz(CAT.doubao, '豆包 · 用好包救 ' + (p.id + 1) + ' 号', function (ok) {
        S.night.witchTarget = id;
        S.night.witchOk = ok;
        if (ok) S.potions.save = true;
        pushLog(S.round, '豆包使用好包救 ' + (p.id + 1) + ' 号：' + (ok ? '成功' : '答题失败，药剂浪费'), ok ? 'ok' : 'no');
        nextNightStep();
      });
    } else {
      render();
    }
  }

  function witchPoisonPick(id) {
    var p = byId(id);
    openQuiz(CAT.doubao, '豆包 · 用孬包毒杀 ' + (p.id + 1) + ' 号', function (ok) {
      S.night.witchTarget = id;
      S.night.witchOk = ok;
      if (ok) S.potions.poison = true;
      pushLog(S.round, '豆包使用孬包毒杀 ' + (p.id + 1) + ' 号：' + (ok ? '成功' : '答题失败，药剂浪费'), ok ? 'bad' : 'no');
      nextNightStep();
    });
  }

  /* 预言家 */
  function seerPick(id) {
    var p = byId(id);
    openQuiz(CAT.reviewer, '代码审核员 · 核验 ' + (p.id + 1) + ' 号身份', function (ok) {
      S.night.seerTarget = id;
      S.night.seerOk = ok;
      var camp = ROLES[p.role].camp;
      if (ok) {
        pushLog(S.round, '代码审核员核验 ' + (p.id + 1) + ' 号：' + (camp === 'bad' ? '卧底' : '好人'), 'ok');
        showResultCard(
          '核验成功',
          '🎯',
          (p.id + 1) + ' 号 ' + p.name + ' 的身份是 —— ' +
          (camp === 'bad'
            ? '<b class="c-bad">卧底（' + ROLES[p.role].name + '）</b>'
            : '<b class="c-good">好人（' + ROLES[p.role].name + '）</b>'),
          function () { nextNightStep(); }
        );
      } else {
        pushLog(S.round, '代码审核员核验 ' + (p.id + 1) + ' 号：答题失败，本次作废', 'no');
        showResultCard('核验失败', '❌', '答题未通过，本次核验作废。只能等下一晚再试。', function () { nextNightStep(); });
      }
    });
  }

  function showResultCard(title, icon, body, done) {
    S.modal = { type: 'result', done: done };
    var m = document.getElementById('modal');
    m.className = 'modal open';
    m.innerHTML = '<div class="result-card">' +
      '<div class="rc-icon">' + icon + '</div>' +
      '<div class="rc-title">' + title + '</div>' +
      '<div class="rc-body">' + body + '</div>' +
      '<button class="btn btn-primary btn-lg" id="rcBtn">继续 →</button></div>';
    document.getElementById('rcBtn').onclick = function () {
      m.className = 'modal';
      m.innerHTML = '';
      var d = S.modal.done; S.modal = null;
      if (d) d();
    };
  }

  /* 白天发言 */
  function startSpeechTimer() {
    if (S.speechTimer) clearInterval(S.speechTimer);
    S.speechLeft = S.cfg.speechSec;
    paintSpeechClock();
    S.speechTimer = setInterval(function () {
      S.speechLeft--;
      paintSpeechClock();
      if (S.speechLeft <= 0) {
        clearInterval(S.speechTimer); S.speechTimer = null;
        speechNext();
      }
    }, 1000);
  }
  function paintSpeechClock() {
    var el = document.getElementById('spTimer');
    if (el) {
      el.textContent = fmt(S.speechLeft);
      el.classList.toggle('urgent', S.speechLeft <= 10);
    }
  }
  function speechNext() {
    if (S.speechTimer) { clearInterval(S.speechTimer); S.speechTimer = null; }
    S.speechIdx++;
    S.speechLeft = S.cfg.speechSec;
    render();
    if (S.speechIdx < alive().length) startSpeechTimer();
  }

  /* 投票 */
  function voteReveal() {
    var rows = alive().map(function (p) {
      return { id: p.id, name: p.name, count: S.tally[p.id] || 0 };
    });
    var total = rows.reduce(function (a, b) { return a + b.count; }, 0);
    var max = 0;
    rows.forEach(function (r) { if (r.count > max) max = r.count; });
    var tops = rows.filter(function (r) { return r.count === max && max > 0; });
    rows.sort(function (a, b) { return b.count - a.count; });
    rows.forEach(function (r) { r.top = (r.count === max && max > 0); });

    var r = { rows: rows, total: total, top: max > 0, topCount: max, outId: null, outName: '', tied: tops.length > 1, blocked: false };
    if (tops.length === 1) { r.outId = tops[0].id; r.outName = tops[0].name; }
    if (r.tied) r.tieNames = tops.map(function (t) { return (t.id + 1) + ' 号'; }).join('、');

    // 防火墙判定
    if (r.outId !== null) {
      var guardedNow = S.night.guardOk && S.night.guardTarget === r.outId;
      if (guardedNow) {
        r.blocked = true;
        pushLog(S.round, (r.outId + 1) + ' 号投票最高，但学术监督员的防火墙生效，本轮无人出局', 'ok');
      } else {
        var p = byId(r.outId);
        p.alive = false;
        pushLog(S.round, (r.outId + 1) + ' 号 ' + p.name + ' 以 ' + max + ' 票出局', 'death');
      }
    } else if (!r.tied) {
      pushLog(S.round, '本轮无有效票，无人出局', 'info');
    }

    S.voteResult = r;
    S.voteMode = false;
    setPhase('voteResult');
  }

  function afterVote() {
    var w = checkWin();
    if (w) { endGame(w); return; }
    beginNight();
  }

  function checkWin() {
    var good = aliveCamp('good').length, bad = aliveCamp('bad').length;
    var killers = aliveOf('bugmaker').length;
    if (bad === 0) return { winner: 'good', reason: '全部卧底已被找出，代码库重归干净。' };
    if (bad >= good) return { winner: 'bad', reason: '卧底人数已不少于好人，代码评审彻底失守。' };
    return null;
  }

  function endGame(w) {
    S.winner = w.winner;
    S.winReason = w.reason;
    pushLog(S.round, (w.winner === 'good' ? '好人阵营胜利' : '卧底阵营胜利') + '：' + w.reason, 'phase');
    if (S.speechTimer) { clearInterval(S.speechTimer); S.speechTimer = null; }
    AUDIO.win();
    setPhase('gameover');
  }

  /* ------------------------------------------------------------
     弹层
     ------------------------------------------------------------ */
  function paintModal() {
    var m = document.getElementById('modal');
    if (!m || !S.modal) return;
    var md = S.modal;
    if (md.type !== 'quiz') return;

    var q = md.q;
    var catTxt = CAT_LABEL[md.cat] || md.cat;
    var optsHTML = q.opts.map(function (o, i) {
      var cls = 'opt';
      if (md.revealed) {
        if (i === q.ans) cls += ' right';
        else if (i === md.picked) cls += ' wrong';
        else cls += ' dim';
      }
      return '<button class="' + cls + '" data-act="pickOpt" data-id="' + i + '"' + (md.revealed ? ' disabled' : '') + '>' +
        '<span class="opt-k">' + 'ABCD'[i] + '</span><span class="opt-t">' + esc(o) + '</span></button>';
    }).join('');

    var rush = '';
    if (md.revealed) {
      rush = '<div class="quiz-res ' + (md.passed ? 'ok' : 'no') + '">' +
        '<div class="qr-head">' + (md.passed ? '✅ 答对 —— 技能生效' : (md.picked < 0 ? '⏰ 超时 —— 技能作废' : '❌ 答错 —— 技能作废')) + '</div>' +
        '<div class="qr-why"><b>解析：</b>' + esc(q.why) + '</div>' +
        '<button class="btn btn-primary btn-lg" id="quizNext">继续 →</button></div>';
    }

    m.className = 'modal open';
    m.innerHTML = '<div class="quiz">' +
      '<div class="quiz-top">' +
      '<span class="quiz-cat">' + catTxt + '</span>' +
      '<span class="quiz-sub">' + esc(md.sub) + '</span>' +
      '<span class="quiz-clock" id="qClock">' + fmt(md.left) + '</span>' +
      '</div>' +
      '<div class="quiz-q">' + esc(q.q) + '</div>' +
      (q.code ? '<pre class="quiz-code">' + esc(q.code) + '</pre>' : '') +
      '<div class="quiz-opts' + (md.revealed ? ' locked' : '') + '">' + optsHTML + '</div>' +
      (!md.revealed && S.cfg.judgeMode
        ? '<div class="judge-row"><button class="btn btn-good" data-act="judge" data-id="1">口头答对 ✔</button>' +
          '<button class="btn btn-danger" data-act="judge" data-id="0">口头答错 ✘</button></div>'
        : '') +
      rush +
      '</div>';

    var btn = document.getElementById('quizNext');
    if (btn) btn.onclick = closeQuiz;
  }

  function paintModalClock() {
    var el = document.getElementById('qClock');
    if (el && S.modal) {
      el.textContent = fmt(S.modal.left);
      el.classList.toggle('urgent', S.modal.left <= 10);
    }
  }

  /* 浮动提示 */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* ------------------------------------------------------------
     事件
     ------------------------------------------------------------ */
  var ACT = {
    toSetup: function () { setPhase('setup'); },
    showRules: function () { showRules(); },
    toggleMute: function () { AUDIO.toggle(); render(); },
    backCover: function () { setPhase('cover'); },
    backSetup: function () { setPhase('setup'); },

    setCount: function (el) {
      var n = +el.dataset.id;
      S.cfg.count = n;
      S.cfg.counts = Object.assign({}, PRESETS[n]);
      render();
    },
    roleInc: function (el) {
      var r = el.dataset.id, v = +el.dataset.v;
      var c = Object.assign({}, S.cfg.counts);
      c[r] = Math.max(0, (c[r] || 0) + v);
      S.cfg.counts = c;
      var tot = 0; ROLE_ORDER.forEach(function (x) { tot += c[x] || 0; });
      S.cfg.count = tot;
      render();
    },
    setOpt: function (el) {
      var k = el.dataset.id, v = el.dataset.v;
      if (k === 'quizTime' || k === 'speechSec') S.cfg[k] = +v;
      else if (k === 'selfDestruct') S.cfg[k] = v === '1';
      else if (k === 'judgeMode') S.cfg[k] = v === '1';
      else S.cfg[k] = v;
      render();
    },

    startDeal: function () { startDeal(); },
    dealPick: function (el) {
      var id = +el.dataset.id;
      S.dealtId = id;
      render();
    },
    dealDone: function () {
      var p = byId(S.dealtId);
      if (p) p.dealt = true;
      S.dealtId = null;
      render();
    },
    beginNight: function () { beginNight(); },

    nightSkip: function () { nextNightStep(); },
    boardPick: function (el) {
      var id = +el.dataset.id;
      var step = NIGHT_STEPS[S.nightStep];
      if (!step) return;
      if (step.key === 'guard') guardPick(id);
      else if (step.key === 'wolves') wolfPick(id);
      else if (step.key === 'witch') witchPoisonPick(id);
      else if (step.key === 'seer') seerPick(id);
    },
    witchMode: function (el) { witchMode(el.dataset.id); },
    witchBack: function () { S.nightSub = null; S.night.witchMode = null; render(); },

    toSpeech: function () {
      var w = checkWin();
      if (w) { endGame(w); return; }
      S.speechIdx = 0;
      S.speechLeft = S.cfg.speechSec;
      setPhase('speech');
      startSpeechTimer();
    },
    speechReset: function () { startSpeechTimer(); },
    speechNext: function () { speechNext(); },
    selfBomb: function () {
      S.selfBombUsed = true; // 全局一次：答错也算用掉
      openQuiz(CAT.bugmaker, 'Bug 制造者 · 病毒植入（自爆）', function (ok) {
        if (ok) {
          pushLog(S.round, 'Bug 制造者发动病毒植入成功，立即入夜（本轮跳过投票）', 'bad');
          if (S.speechTimer) { clearInterval(S.speechTimer); S.speechTimer = null; }
          beginNight();
        } else {
          pushLog(S.round, 'Bug 制造者病毒植入失败，继续发言', 'no');
          render();
        }
      });
    },

    toVote: function () {
      if (S.speechTimer) { clearInterval(S.speechTimer); S.speechTimer = null; }
      S.tally = {};
      S.votesCast = 0;
      setPhase('vote');
    },
    voteStart: function () { S.voteMode = true; S.tally = {}; S.votesCast = 0; render(); },
    castVote: function (el) {
      var id = +el.dataset.id;
      if (S.votesCast >= alive().length) return; // 票数已满，防止多记
      S.tally[id] = (S.tally[id] || 0) + 1;
      S.voteSeq.push(id);
      S.votesCast++;
      render();
    },
    voteUndo: function () {
      if (!S.voteSeq.length) return;
      var last = S.voteSeq.pop();
      if (S.tally[last] > 0) S.tally[last]--;
      S.votesCast = Math.max(0, S.votesCast - 1);
      render();
    },
    voteReveal: function () { voteReveal(); },
    revote: function () {
      S.voteRound++; S.tally = {}; S.voteSeq = []; S.votesCast = 0; S.voteMode = false; setPhase('vote');
    },
    afterVote: function () { afterVote(); },

    pickOpt: function (el) { if (S.modal && !S.modal.revealed) revealQuiz(+el.dataset.id); },
    judge: function (el) {
      if (!S.modal || S.modal.revealed) return;
      var ok = el.dataset.id === '1';
      revealQuiz(ok ? S.modal.q.ans : (S.modal.q.ans === 0 ? 1 : 0));
    },

    exportReport: function () { exportReport(); },
    downloadReport: function () { downloadReport(); },
    copyReport: function () { copyReport(); },
    closeModal: function () {
      var m = document.getElementById('modal');
      if (m) { m.innerHTML = ''; m.className = 'modal'; }
    },
    restart: function () {
      S = freshState();
      render();
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var fn = ACT[el.dataset.act];
    if (!fn) return;
    if (el.disabled) return;
    AUDIO.unlock();
    // 记录投票顺序（撤销用）
    if (el.dataset.act === 'castVote') S.lastVoteId = +el.dataset.id;
    fn(el);
  });

  /* 键盘：空格/回车 = 主按钮，Esc = 关弹层，1-9 = 投票选座位 */
  document.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    var m = document.getElementById('modal');

    if (e.key === 'Escape') {
      if (m && m.classList.contains('open')) { ACT.closeModal(); }
      return;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;

    if (m && m.classList.contains('open')) {
      var mb = m.querySelector('.btn-primary');
      if (mb) { e.preventDefault(); mb.click(); }
      return;
    }
    var p = document.querySelector('#app .btn-primary');
    if (p && !p.disabled) { e.preventDefault(); p.click(); }
  });

  /* ------------------------------------------------------------
     规则速览 / 导出
     ------------------------------------------------------------ */
  function showRules() {
    var m = document.getElementById('modal');
    m.className = 'modal open';
    m.innerHTML = '<div class="rules">' +
      '<h3>规则速览</h3>' +
      '<p class="lead">好人阵营（靠谱开发）追查 Bug，卧底阵营（Bug 制造者）制造事故。所有技能都需答题生效。</p>' +
      '<div class="rule-grid">' +
      '<div class="rule-col"><h4 class="c-good">好人阵营</h4>' +
      '<p><b>👨‍💻 普通程序员</b> 无技能，靠推理与投票。</p>' +
      '<p><b>🔍 代码审核员</b> 每晚核验一人，答对「代码审查」题才成功。</p>' +
      '<p><b>🛡️ 学术监督员</b> 每晚设防火墙，答对「编程规范」题才成功，不可连续两晚同一人；被保护者免疫投票出局。</p>' +
      '<p><b>💊 豆包</b> 好包 / 孬包各一次，每晚只能用一种，需答对「调试排错」题。</p>' +
      '</div>' +
      '<div class="rule-col"><h4 class="c-bad">卧底阵营</h4>' +
      '<p><b>🐛 Bug 制造者</b> 夜间共同暗害，答对「Bug 识别」题才成功；白天可发动病毒植入（自爆，全局一次），成功即入夜。</p>' +
      '<p><b>📦 代码搬运工</b> 无夜间能力，白天带节奏、洗白、诬陷。</p>' +
      '</div></div>' +
      '<h4>胜负</h4>' +
      '<p>卧底全部出局 → 好人胜；卧底人数 ≥ 好人 → 卧底胜。</p>' +
      '<h4>流程</h4>' +
      '<p>闭眼夜（守卫 → 卧底 → 豆包 → 审核员）→ 天亮公布 → 轮流发言 → 投票 → 复盘判定 → 进入下一夜。</p>' +
      '<button class="btn btn-primary" data-act="closeRules">知道了</button>' +
      '</div>';
    ACT.closeRules = function () {
      m.className = 'modal';
      m.innerHTML = '';
    };
  }

  function exportReport() {
    var L = [];
    L.push('# 学术狼人杀 · 对局战报');
    L.push('');
    L.push('- 时间：' + new Date().toLocaleString('zh-CN'));
    L.push('- 人数：' + S.players.length + ' 人');
    L.push('- 轮次：' + S.round + ' 轮');
    L.push('- 结果：' + (S.winner === 'good' ? '好人阵营（靠谱开发）胜利' : '卧底阵营（Bug 制造者）胜利'));
    L.push('- 判定：' + S.winReason);
    L.push('');
    L.push('## 身份与存活');
    L.push('');
    L.push('| 座位 | 玩家 | 身份 | 阵营 | 结局 |');
    L.push('|---|---|---|---|---|');
    S.players.forEach(function (p) {
      var R = ROLES[p.role];
      L.push('| ' + (p.id + 1) + ' | ' + p.name + ' | ' + R.name + ' | ' + (R.camp === 'good' ? '好人' : '卧底') + ' | ' + (p.alive ? '存活' : '出局') + ' |');
    });
    L.push('');
    L.push('## 逐题战报');
    L.push('');
    var pass = S.quizLog.filter(function (q) { return q.passed; }).length;
    L.push('答题 ' + S.quizLog.length + ' 次，答对 ' + pass + ' 次，正确率 ' +
      (S.quizLog.length ? Math.round(pass / S.quizLog.length * 100) : 0) + '%。');
    L.push('');
    L.push('| # | 轮次 | 技能 | 类别 | 题目 | 选手作答 | 结果 | 解析 |');
    L.push('|---|---|---|---|---|---|---|---|');
    S.quizLog.forEach(function (q, i) {
      L.push('| ' + (i + 1) + ' | R' + q.round + ' | ' + q.sub + ' | ' + (CAT_LABEL[q.cat] || q.cat) + ' | ' +
        q.q.replace(/\n/g, ' ') + ' | ' + q.picked + ' | ' + (q.passed ? '对' : '错') + ' | ' + q.why.replace(/\n/g, ' ') + ' |');
    });
    L.push('');
    L.push('## 事件时间线');
    L.push('');
    S.log.forEach(function (l) { L.push('- [R' + l.round + '] ' + l.text); });
    L.push('');
    L.push('---');
    L.push('');
    L.push('*由「学术狼人杀」主持人控制台自动生成*');

    S.reportText = L.join('\n');
    S.reportName = '学术狼人杀战报_' + new Date().toISOString().slice(0, 10) + '.md';
    var m = document.getElementById('modal');
    m.className = 'modal open';
    m.innerHTML = '<div class="report-modal">' +
      '<div class="rm-head"><h3>战报已生成</h3><button class="btn btn-ghost btn-sm" data-act="closeModal">关闭</button></div>' +
      '<p class="lead">共 ' + S.quizLog.length + ' 次答题、' + S.log.length + ' 条事件。可以直接下载，也可以复制全文粘进活动总结。</p>' +
      '<textarea class="rm-text" readonly>' + esc(S.reportText) + '</textarea>' +
      '<div class="rm-foot">' +
      '<button class="btn btn-primary" data-act="downloadReport">下载 .md</button>' +
      '<button class="btn btn-ghost" data-act="copyReport">复制全文</button>' +
      '</div></div>';
  }

  function downloadReport() {
    if (!S.reportText) return;
    try {
      var blob = new Blob([S.reportText], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = S.reportName || 'report.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('已开始下载');
    } catch (e) {
      toast('下载被拦截，请用「复制全文」');
    }
  }

  function copyReport() {
    if (!S.reportText) return;
    var done = function () { toast('已复制到剪贴板'); };
    var fail = function () { toast('请长按文本框手动全选复制'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(S.reportText).then(done, fail);
        return;
      }
    } catch (e) {}
    var ta = document.querySelector('.rm-text');
    if (ta) { ta.focus(); ta.select(); }
    try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); }
  }

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */
  function boot() {
    S = freshState();
    render();
  }

  window.__START__ = boot;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

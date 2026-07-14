// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════
var STOCKFISH_WORKER_URL = 'stockfish.js';
var EDGE_TTS_URL = '';
var EDGE_TTS_VOICE = 'en-US-AndrewNeural';
var RATING_STORAGE_KEY = 'chessCoachRating';
var REVIEW_DEPTH = 10;
var REVIEW_DEPTH_DEEP = 14;
var POOL_SIZE = 1;

// ═══════════════════════════════════════════════════════
// CLASSIFICATION DATA
// ═══════════════════════════════════════════════════════
var MOOD_COLORS = {
  blunder:'#e0483e', mistake:'#e29233', inaccuracy:'#4c8fe0',
  good:'#d4cfc9', excellent:'#4caf6e', best:'#3fbf6a',
  great:'#3f7ce0', brilliant:'#2fd3c9', forced:'#8a8a8a', book:'#8a8a8a'
};
var CLASS_META = {
  blunder:{label:'Blunder',icon:'!!'},
  mistake:{label:'Mistake',icon:'?'},
  inaccuracy:{label:'Inaccuracy',icon:'?!'},
  good:{label:'Good Move',icon:'\u2713'},
  excellent:{label:'Excellent',icon:'\u2713'},
  best:{label:'Best Move',icon:'\u2605'},
  great:{label:'Great Move',icon:'!'},
  brilliant:{label:'Brilliant',icon:'!!'},
  forced:{label:'Forced',icon:'\u25C1'},
  book:{label:'Book Move',icon:'\u25C7'}
};
var MOUTH = {
  blunder:'M90,94 Q100,86 110,94', mistake:'M90,93 Q100,89 110,93',
  inaccuracy:'M91,92 L109,92', good:'M90,90 Q100,94 110,90',
  excellent:'M88,89 Q100,97 112,89', best:'M86,88 Q100,100 114,88',
  great:'M87,89 Q100,98 113,89', brilliant:'M86,87 Q100,101 114,87'
};
var BROW_L = {
  blunder:'M82,74 Q90,79 98,73', mistake:'M83,72 Q90,75 97,72',
  inaccuracy:'M83,71 Q90,69 97,71', good:'M83,70 Q90,67 97,70',
  excellent:'M82,69 Q90,65 98,69', best:'M81,68 Q90,63 99,68',
  great:'M82,68 Q90,64 98,68', brilliant:'M80,67 Q90,61 100,67'
};
var BROW_R = {
  blunder:'M102,73 Q110,79 118,74', mistake:'M103,72 Q110,75 117,72',
  inaccuracy:'M103,71 Q110,69 117,71', good:'M103,70 Q110,67 117,70',
  excellent:'M102,69 Q110,65 118,69', best:'M101,68 Q110,63 119,68',
  great:'M102,68 Q110,64 118,68', brilliant:'M100,67 Q110,61 120,67'
};

// ═══════════════════════════════════════════════════════
// RATING PREFERENCE
// ═══════════════════════════════════════════════════════
function loadRatingPref() {
  try { return localStorage.getItem(RATING_STORAGE_KEY) || '1400'; } catch(e) { return '1400'; }
}
function saveRatingPref(r) {
  try { localStorage.setItem(RATING_STORAGE_KEY, r); } catch(e) {}
}

// ═══════════════════════════════════════════════════════
// LICHESS OPENING API
// ═══════════════════════════════════════════════════════
function normalizeRatingToLichessBucket(rating) {
  var r = parseInt(rating, 10);
  if (r < 1200) return '1000';
  if (r < 1400) return '1200';
  if (r < 1600) return '1400';
  if (r < 1800) return '1600';
  if (r < 2000) return '1800';
  if (r < 2200) return '2000';
  if (r < 2400) return '2200';
  return '2500';
}

var TOKEN_STORAGE_KEY = 'chessCoachApiToken';
function loadApiToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch(e) { return ''; }
}
function saveApiToken(t) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, t); } catch(e) {}
}
function getApiToken() {
  return loadApiToken() || document.getElementById('apiToken').value.trim();
}
// Load token from .env at startup
fetch('.env').then(function(r) { return r.text(); }).then(function(text) {
  var m = text.match(/^LICHESS_API_TOKEN=(.+)$/m);
  if (m) {
    document.getElementById('apiToken').value = m[1];
    saveApiToken(m[1]);
  }
}).catch(function() {});
function explorerFetchOpts() {
  var token = getApiToken();
  if (!token) return {};
  return { headers: { 'Authorization': 'Bearer ' + token } };
}

function fetchOpening(fen, rating) {
  var bucket = normalizeRatingToLichessBucket(rating);
  var params = new URLSearchParams({ fen: fen, ratings: bucket, speeds: 'blitz,rapid,classical' });
  return fetch('https://explorer.lichess.ovh/lichess?' + params.toString(), explorerFetchOpts())
    .then(function(r) { if (!r.ok) throw new Error('Lichess ' + r.status); return r.json(); })
    .then(function(d) {
      return d.opening ? { ecoCode: d.opening.eco || 'A00', openingName: d.opening.name || 'Unknown Opening' } : null;
    })
    .catch(function() { return null; });
}

function fetchExplorerMoves(fen, rating) {
  var bucket = normalizeRatingToLichessBucket(rating);
  var params = new URLSearchParams({ fen: fen, ratings: bucket, speeds: 'blitz,rapid,classical' });
  return fetch('https://explorer.lichess.ovh/lichess?' + params.toString(), explorerFetchOpts())
    .then(function(r) { if (!r.ok) throw new Error('Lichess ' + r.status); return r.json(); })
    .catch(function() { return null; });
}

var explorerTimeout = null;
function updateExplorer() {
  if (explorerTimeout) clearTimeout(explorerTimeout);
  explorerTimeout = setTimeout(doUpdateExplorer, 300);
}
var _explorerRetries = 0;
var _lastExplorerFen = '';
function doUpdateExplorer() {
  if (isAnalysing) return;
  var fen = game.fen();
  if (fen === _lastExplorerFen) return;
  _lastExplorerFen = fen;
  if (!getApiToken()) {
    if (_explorerRetries < 3) {
      _explorerRetries++;
      setTimeout(doUpdateExplorer, 500);
      return;
    }
    document.getElementById('explorerContent').innerHTML = '<div class="explorer-empty">Enter a <a href="https://lichess.org/account/oauth/token" target="_blank" style="color:var(--gold)">Lichess API token</a> in the header to unlock the Opening Explorer</div>';
    return;
  }
  var fen = game.fen();
  var startFen = new Chess().fen();
  if (fen === startFen) {
    document.getElementById('explorerContent').innerHTML = '<div class="explorer-empty">Make a move to see opening statistics</div>';
    return;
  }
  var el = document.getElementById('explorerContent');
  el.innerHTML = '<div class="explorer-empty">Loading...</div>';
  fetchExplorerMoves(fen, document.getElementById('ratingSelect').value).then(function(data) {
    renderExplorer(data);
  });
}
function renderExplorer(data) {
  var el = document.getElementById('explorerContent');
  if (!data || !data.moves || data.moves.length === 0) {
    el.innerHTML = '<div class="explorer-empty">No opening data available for this position</div>';
    return;
  }
  var html = '';
  if (data.opening) {
    html += '<div class="explorer-opening">' + data.opening.name + ' (' + data.opening.eco + ')</div>';
  }
  html += '<table class="explorer-table"><tr><th>Move</th><th>Games</th><th>W</th><th>D</th><th>B</th></tr>';
  var moves = data.moves.slice().sort(function(a, b) {
    return (b.white + b.draws + b.black) - (a.white + a.draws + a.black);
  }).slice(0, 10);
  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    var total = m.white + m.draws + m.black;
    var gamesStr = total >= 1000 ? (total / 1000).toFixed(total >= 10000 ? 0 : 1) + 'k' : total;
    html += '<tr class="explorer-row" data-uci="' + m.uci + '">';
    html += '<td class="explorer-move">' + m.san + '</td>';
    html += '<td class="explorer-num">' + gamesStr + '</td>';
    html += '<td class="explorer-pct">' + (m.white / total * 100).toFixed(0) + '%</td>';
    html += '<td class="explorer-pct">' + (m.draws / total * 100).toFixed(0) + '%</td>';
    html += '<td class="explorer-pct">' + (m.black / total * 100).toFixed(0) + '%</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
  var _explorerSavedShapes = (cg.state && cg.state.drawable && cg.state.drawable.shapes) ? cg.state.drawable.shapes.slice() : [];
  var rows = el.querySelectorAll('.explorer-row');
  for (var j = 0; j < rows.length; j++) {
    (function(row) {
      row.addEventListener('click', function() {
        if (isAnalysing) return;
        var uci = this.getAttribute('data-uci');
        cg.setShapes([]);
        onMove(uci.slice(0, 2), uci.slice(2, 4));
      });
      row.addEventListener('mouseenter', function() {
        if (isAnalysing) return;
        var uci = this.getAttribute('data-uci');
        _explorerSavedShapes = (cg.state && cg.state.drawable && cg.state.drawable.shapes) ? cg.state.drawable.shapes.slice() : [];
        cg.setShapes([{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'blue' }]);
      });
      row.addEventListener('mouseleave', function() {
        cg.setShapes(_explorerSavedShapes);
      });
    })(rows[j]);
  }
}

// ═══════════════════════════════════════════════════════
// TEXT-TO-SPEECH
// ═══════════════════════════════════════════════════════
var ttsEnabled = false;
var ttsAudio = null;
var _synth = window.speechSynthesis || null;
var _synthVoice = null;

function _initVoice() {
  if (!_synth) return;
  var voices = _synth.getVoices();
  var preferred = ['Microsoft Andrew', 'Google US English', 'Alex', 'Daniel'];
  for (var p = 0; p < preferred.length; p++) {
    for (var v = 0; v < voices.length; v++) {
      if (voices[v].name.indexOf(preferred[p]) !== -1) { _synthVoice = voices[v]; return; }
    }
  }
  for (var v = 0; v < voices.length; v++) {
    if (voices[v].lang === 'en-US' || voices[v].lang === 'en_US') { _synthVoice = voices[v]; return; }
  }
  if (voices.length) _synthVoice = voices[0];
}
if (_synth) {
  _synth.onvoiceschanged = _initVoice;
  _initVoice();
}

function _speakBrowser(plain) {
  if (!_synth) return;
  _synth.cancel();
  var utt = new SpeechSynthesisUtterance(plain);
  utt.rate = 1.05;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  if (_synthVoice) utt.voice = _synthVoice;
  _synth.speak(utt);
}

function _speakEdgeTTS(plain) {
  if (ttsAudio) { ttsAudio.pause(); URL.revokeObjectURL(ttsAudio.src); ttsAudio = null; }
  fetch(EDGE_TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: plain, voice: EDGE_TTS_VOICE })
  }).then(function(r) { if (!r.ok) throw new Error('EdgeTTS ' + r.status); return r.blob(); })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      ttsAudio = new Audio(url);
      ttsAudio.play();
      ttsAudio.onended = function() { URL.revokeObjectURL(url); ttsAudio = null; };
    }).catch(function() { _speakBrowser(plain); });
}

function speakText(text) {
  if (!ttsEnabled) return;
  var plain = text.replace(/<[^>]+>/g, '').trim();
  if (!plain) return;
  if (EDGE_TTS_URL) { _speakEdgeTTS(plain); } else { _speakBrowser(plain); }
}

// ═══════════════════════════════════════════════════════
// DIALOGUE LOGIC
// ═══════════════════════════════════════════════════════
var POOLS = {
  blunder: ['Ouch! {move} throws away a huge chunk of your advantage.',
    'That is a blunder. {move} hands material straight back.',
    'Careful! {move} was a serious error. Let us steady the ship.',
    'That one hurts. {move} and the position swung hard.'],
  mistake: ['{move} gives up more than needed. Your defense just got harder.',
    'That is a mistake. {move} loosens your grip on the position.',
    'Not your best. {move} concedes a meaningful chunk of advantage.',
    '{move} is a step back. There was a sturdier option.'],
  inaccuracy: ['{move} is fine, but not the sharpest path. A small inaccuracy.',
    'Close, but {move} drifts slightly from the best plan.',
    'That is playable, just a minor inaccuracy. Nothing alarming.',
    '{move} loses a little precision. Nothing serious.'],
  good: ['{move} is solid. Keeping the position balanced.',
    'Good, sensible move. Steady progress.',
    '{move} holds everything together nicely.',
    'Reasonable and safe. {move} keeps the balance.',
    'A grounded choice. {move} maintains equilibrium.',
    '{move} is fine — the scales stay level.',
    'Sensible play. Both sides remain equal after {move}.',
    'No damage done. {move} preserves the tension perfectly.',
    '{move} keeps things honest. A fair fight still ahead.',
    'Balanced and controlled. {move} is a stable option.',
    'The position stays level. {move} is a solid keep.',
    'Good instinct. {move} does not tip the boat.',
    'Quiet but effective. {move} maintains the equilibrium.',
    'The engine approves. {move} keeps symmetry in the game.'],
  excellent: ['Excellent! {move} is right among the top engine picks.',
    '{move} is a strong, well-calculated choice.',
    'Nicely played. {move} is an excellent continuation.',
    'Sharp play. {move} was one of the best ideas available.'],
  best: ['That is it! {move} is the single best move here!',
    'Perfect. {move} is exactly what the engine would play.',
    'You found the best move! {move} is spot on.',
    '{move}, the top engine choice. Beautifully found.'],
  great: ['Great move! {move} was the only real way to keep this going.',
    'Difficult find. {move} is the winning continuation.',
    '{move} is a great move. Not easy to spot, but you nailed it.',
    'Impressive. {move} was the saving try, and you found it.'],
  brilliant: ['Brilliant!! {move} is a stunning move that wins on the spot.',
    'Wow! {move} is brilliant! That completely changes the game.',
    'That is brilliant. {move} finds an amazing winning idea.',
    '{move}, brilliant! Most players would never even consider that.'],
  forced: ['{move} was the only legal move here. Stay focused.',
    'Only move available. {move} was forced. Onward.'],
  book: ['{move}, a standard book move. Solid opening play.',
    'Book move. {move} follows established opening theory.']
};

function pickMsg(cls, san, ev, swing, oppTurn) {
  var e = ev || 0, s = swing || 0;
  var dominated = oppTurn ? e > 4 : e < -4;
  var stillCrushing = oppTurn ? e < -4 : e > 4;
  var balanced = Math.abs(e) < 0.5;
  var bigSwing = s > 2.5;
  var msg = null;

  var BALANCED_BLUNDER = [
    'Ouch. {move} lets equality slip away. It was balanced; now you are under pressure.',
    'That tipped the scales! {move} breaks the equilibrium — and not in your favour.',
    'The position was level and {move} disturbs that balance badly. Watch out.',
    'Equal game no more. {move} hands the initiative straight to your opponent.'
  ];
  var BALANCED_MISS = [
    'A mistake in a balanced game hurts the most. {move} gives away ground you did not need to.',
    'It was dead equal, and {move} tilts it. Not catastrophic, but noticeable.',
    'From balance to disadvantage — {move} was an unnecessary concession.'
  ];
  var BALANCED_BEST = [
    'Excellent move keeping the tension in this perfectly balanced game. {move} was precise.',
    'In a razor-sharp equal position, {move} is exactly the right call. Well navigated.',
    'Impressive. With the game balanced on a knife-edge, {move} is the calmest, clearest path.',
    'Dead equal and you found the best reply. {move} keeps the tension perfectly.',
    'When the position is level, precision matters most — and {move} delivers that.',
    'The balance was delicate and {move} honours it. A masterful restraint.',
    'Equal games demand accuracy. {move} is exactly what the engine recommends here.',
    'The scales stay perfectly even after {move}. That is harder than it looks.'
  ];
  var BALANCED_GOOD = [
    'Solid choice in an equal position. {move} keeps the scales even.',
    'The game is balanced and {move} respects that. No risks, no concessions.',
    'From equality, {move} maintains harmony. A steady hand.',
    'A level battlefield stays level after {move}. Good discipline.',
    'When it is equal, do not rock the boat — and {move} does exactly that.',
    'Quiet and correct. {move} sustains the balance without overreaching.',
    'The engines see parity, and {move} keeps it that way. Well played.',
    'Even positions reward patience. {move} is a patient, principled move.'
  ];

  if (cls === 'blunder') {
    if (bigSwing && dominated) msg = 'Oh no! {move} just threw the game away. The opponent is completely taking over!';
    else if (bigSwing) msg = '{move} was a blunder and momentum has swung heavily. This is a real fight now.';
    else if (stillCrushing) msg = 'That was a blunder, but you are still overwhelmingly winning with {move}. Stay accurate!';
    else if (balanced) msg = BALANCED_BLUNDER[Math.floor(Math.random() * BALANCED_BLUNDER.length)];
  } else if (cls === 'mistake') {
    if (dominated) msg = '{move} was a mistake and you are in serious trouble. Look for a fortress!';
    else if (stillCrushing) msg = 'A mistake, but {move} does not ruin your dominant position. Convert carefully.';
    else if (balanced) msg = BALANCED_MISS[Math.floor(Math.random() * BALANCED_MISS.length)];
  } else if (cls === 'best' || cls === 'excellent') {
    if (balanced) msg = BALANCED_BEST[Math.floor(Math.random() * BALANCED_BEST.length)];
    else if (stillCrushing && bigSwing) msg = '{move} capitalises on a massive swing. You are pressing a crushing advantage!';
    else if (dominated) msg = 'Fighting spirit! {move} is the best try in a tough spot. Keep the resistance going.';
  } else if (cls === 'good' && balanced) {
    msg = BALANCED_GOOD[Math.floor(Math.random() * BALANCED_GOOD.length)];
  } else if (cls === 'brilliant' && bigSwing) {
    msg = 'Wow, {move} creates a massive shift in momentum! That sacrifice has completely changed the game!';
  } else if (cls === 'great' && dominated) {
    msg = 'Incredible find. {move} is the only saving move in this position. The coach is impressed!';
  }

  if (!msg) {
    var pool = POOLS[cls] || POOLS.good;
    msg = pool[Math.floor(Math.random() * pool.length)];
  }
  var label = san ? '<span class="accent">' + san.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' : 'That move';
  return msg.replace(/\{move\}/g, label);
}

// Game review commentary templates
var REVIEW_COMMENTARY = {
  Book: ['{move} is standard book. Solid opening play.'],
  Brilliant: ['{move} is a brilliant sacrifice! Material is given for a crushing positional advantage. The evaluation spikes dramatically.'],
  Great: ['{move} is the only move that holds the position. Every alternative would lose. A great defensive find.'],
  Best: ['{move} is the top engine choice, maintaining maximum pressure. Precise play.'],
  Blunder: ['A costly blunder. {move} swings the evaluation sharply in the opponent\'s favour. This is the critical turning point.'],
  Miss: ['Missed opportunity! The opponent slipped, but {move} fails to punish. {bestResponse} would have capitalized.']
};

// ═══════════════════════════════════════════════════════
// COACH BOT UI
// ═══════════════════════════════════════════════════════
var typeTimer = null, talkTimer = null;

function updateCoach(data) {
  var cls = (data.classification || 'good').toLowerCase().replace(/\s+/g, '');
  var meta = CLASS_META[cls] || CLASS_META.good;
  var color = MOOD_COLORS[cls] || '#c9a24b';
  var bot = document.getElementById('coachBot');
  var box = document.getElementById('dialogueBox');
  bot.style.setProperty('--mood', color);
  box.style.setProperty('--mood', color);
  document.getElementById('botMouth').setAttribute('d', MOUTH[cls] || MOUTH.good);
  document.getElementById('botBrowL').setAttribute('d', BROW_L[cls] || BROW_L.good);
  document.getElementById('botBrowR').setAttribute('d', BROW_R[cls] || BROW_R.good);
  document.getElementById('badgeIcon').textContent = meta.icon;
  var lbl = document.getElementById('dialogueLabel');
  var ico = document.getElementById('dialogueIconEl');
  lbl.textContent = meta.label;
  lbl.style.color = color;
  ico.textContent = meta.icon;
  ico.style.color = color;
  bot.setAttribute('data-mood', cls);
  bot.classList.remove('pulse-in');
  void bot.offsetWidth;
  bot.classList.add('pulse-in');
  box.classList.remove('setting-mood');
  void box.offsetWidth;
  box.classList.add('setting-mood');
  triggerFx(cls);
  window._lastPv = data.pvAfter || null;
  window._lastFen = data.fenAfter || null;
  var isBad = ['blunder','mistake','inaccuracy'].indexOf(cls) !== -1;
  var whyBtn = document.getElementById('whyMistakeBtn');
  if (whyBtn) {
    whyBtn.style.display = isBad && data.pvAfter ? 'inline-block' : 'none';
    document.getElementById('refutationDisplay').innerHTML = '';
  }
  var html = data.customMsg || pickMsg(cls, data.moveSan, data.currentEval, data.evalSwing, data.isWhiteToMove);
  typewrite(html);
}

// ── Refutation Replay State ──
var _refReplayTimer = null;
var _refReplayFenSaved = null;

function clearMistakeUI() {
  window._lastPv = null;
  window._lastFen = null;
  if (_refReplayTimer) { clearTimeout(_refReplayTimer); _refReplayTimer = null; }
  _refReplayFenSaved = null;
  var whyBtn = document.getElementById('whyMistakeBtn');
  if (whyBtn) whyBtn.style.display = 'none';
  var stopBtn = document.getElementById('refStopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  var refDisplay = document.getElementById('refutationDisplay');
  if (refDisplay) refDisplay.innerHTML = '';
}

function stopRefutationReplay() {
  if (_refReplayTimer) { clearTimeout(_refReplayTimer); _refReplayTimer = null; }
  if (_refReplayFenSaved) {
    cg.set({ fen: _refReplayFenSaved, movable: { color: 'both', dests: getLegalDests() } });
    cg.setShapes([]);
    _refReplayFenSaved = null;
  }
  var stopBtn = document.getElementById('refStopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  var whyBtn = document.getElementById('whyMistakeBtn');
  if (whyBtn) whyBtn.style.display = 'inline-block';
}

function showRefutation() {
  var pv = window._lastPv;
  var fen = window._lastFen;
  if (!pv || pv.length < 2 || !fen) return;

  // Stop any running replay first
  if (_refReplayTimer) { clearTimeout(_refReplayTimer); _refReplayTimer = null; }

  // Build the refutation move list (SAN + UCI pairs)
  var g = new Chess(fen);
  var moves = [];
  for (var i = 0; i < Math.min(pv.length, 6); i++) {
    var u = pv[i];
    var mr = g.move({ from: u.slice(0,2), to: u.slice(2,4), promotion: u.length > 4 ? u[4] : 'q' });
    if (!mr) break;
    moves.push({ san: mr.san, from: mr.from, to: mr.to, fenAfter: g.fen(), isOpp: i % 2 === 0 });
  }
  if (!moves.length) return;

  // Render refutation text in the dialogue box
  var html = '<span style="font-size:10px;color:var(--text-mute)">Best reply:</span> ';
  for (var j = 0; j < moves.length; j++) {
    html += '<span class="ref-move' + (moves[j].isOpp ? ' opp' : '') + '" id="refMv' + j + '">' + moves[j].san + '</span> ';
  }
  document.getElementById('refutationDisplay').innerHTML = html;
  document.getElementById('whyMistakeBtn').style.display = 'none';

  // Show stop button
  var stopBtn = document.getElementById('refStopBtn');
  if (stopBtn) stopBtn.style.display = 'inline-block';

  // Save current board state so we can restore it
  _refReplayFenSaved = fen;

  // Build voice narration
  var oppColor = new Chess(fen).turn() === 'w' ? 'White' : 'Black';
  var narration = buildRefutationNarration(moves, oppColor);

  // Speak the narration
  speakText(narration);

  // Animate each move on the board with delay
  var delay = 900;
  var startDelay = 400;

  function animateStep(idx) {
    if (idx >= moves.length) {
      // After last move, pause then restore board
      _refReplayTimer = setTimeout(function() {
        stopRefutationReplay();
      }, 2200);
      return;
    }

    _refReplayTimer = setTimeout(function() {
      var mv = moves[idx];

      // Highlight the active move chip in the refutation text
      var chips = document.querySelectorAll('#refutationDisplay .ref-move');
      for (var k = 0; k < chips.length; k++) {
        chips[k].classList.toggle('ref-move-active', k === idx);
      }

      // Show colored arrow: red for opponent, teal for player response
      var brush = mv.isOpp ? 'red' : 'paleBlue';
      cg.setShapes([{ orig: mv.from, dest: mv.to, brush: brush }]);

      // Animate the piece on the board
      cg.set({
        fen: mv.fenAfter,
        lastMove: [mv.from, mv.to],
        movable: { color: 'both', dests: new Map() } // lock interaction during replay
      });

      animateStep(idx + 1);
    }, idx === 0 ? startDelay : delay);
  }

  animateStep(0);
}

function buildRefutationNarration(moves, oppColor) {
  if (!moves.length) return '';
  var lines = [];
  var firstOppMove = moves[0].san;

  // Describe the punishment
  lines.push('Here is why: ' + oppColor + ' replies with ' + readSan(firstOppMove) + '.');

  if (moves.length >= 2) {
    lines.push('After ' + readSan(moves[1].san) + ',');
  }
  if (moves.length >= 3) {
    lines.push(oppColor + ' continues with ' + readSan(moves[2].san) + ',');
  }
  if (moves.length >= 4) {
    lines.push('and then ' + readSan(moves[3].san) + '.');
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '.');
  }

  lines.push('This sequence shows the position is now much harder to defend.');
  return lines.join(' ');
}

// Convert SAN notation to speakable text
function readSan(san) {
  if (!san) return san;
  var PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };
  var s = san;
  // Castling
  if (s === 'O-O-O') return 'Queen-side castling';
  if (s === 'O-O') return 'King-side castling';
  // Strip check/mate symbols for reading
  s = s.replace(/[+#!?]/g, '');
  // Capture word
  s = s.replace('x', ' takes ');
  // Promotion
  s = s.replace(/=([QRBN])/, function(_, p) { return ', promoting to ' + (PIECE_NAMES[p] || p); });
  // Named piece prefix
  var piece = PIECE_NAMES[s[0]];
  if (piece) {
    s = piece + ' ' + s.slice(1).trim();
  }
  // Spread out squares for clarity: e4 → "E 4"
  s = s.replace(/\b([a-h])([1-8])\b/g, function(_, f, r) { return f.toUpperCase() + ' ' + r; });
  return s;
}

function triggerFx(cls) {
  var layer = document.getElementById('fxLayer');
  layer.innerHTML = '';
  if (cls === 'brilliant' || cls === 'best') {
    for (var n = 0; n < 14; n++) {
      var a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 50;
      var el = document.createElement('div');
      el.className = 'fx-spark sparkle';
      el.style.setProperty('--dx', Math.cos(a) * d + 'px');
      el.style.setProperty('--dy', (Math.sin(a) * d - 20) + 'px');
      el.style.left = (88 + Math.random() * 20 - 10) + 'px';
      el.style.top = (70 + Math.random() * 20 - 10) + 'px';
      el.style.background = '#fcd34d';
      layer.appendChild(el);
    }
  } else if (cls === 'blunder') {
    for (var n = 0; n < 10; n++) {
      var a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
      var el = document.createElement('div');
      el.className = 'fx-spark crack';
      el.style.setProperty('--dx', Math.cos(a) * d + 'px');
      el.style.left = (88 + Math.random() * 20 - 10) + 'px';
      el.style.top = (70 + Math.random() * 20 - 10) + 'px';
      layer.appendChild(el);
    }
  }
  setTimeout(function() { layer.innerHTML = ''; }, 1000);
}

function typewrite(html) {
  if (typeTimer) clearInterval(typeTimer);
  if (talkTimer) clearTimeout(talkTimer);
  var bot = document.getElementById('coachBot');
  var el = document.getElementById('dialogueText');
  bot.classList.add('talking');
  el.classList.add('typing');
  var plain = html.replace(/<[^>]+>/g, ''), i = 0, speed = 16;
  speakText(plain);
  typeTimer = setInterval(function() {
    i++;
    el.textContent = plain.slice(0, i);
    if (i >= plain.length) {
      clearInterval(typeTimer);
      el.innerHTML = html;
      el.classList.remove('typing');
      // If cursor is over a stockfish-preview that appeared after typing, trigger it
      console.log('[SFPreview] typewrite done, checking mouse at', _lastMouseX, _lastMouseY);
      if (_lastMouseX >= 0 && _lastMouseY >= 0) {
        var under = document.elementFromPoint(_lastMouseX, _lastMouseY);
        console.log('[SFPreview] elementUnderCursor after typewrite', under, under && under.className);
        if (under && under.classList && under.classList.contains('stockfish-preview')) {
          console.log('[SFPreview] Triggering preview from typewrite completion');
          showSfPreview(under);
        }
      }
    }
  }, speed);
  talkTimer = setTimeout(function() { bot.classList.remove('talking'); }, plain.length * speed + 400);
}

function coachReset(text) {
  clearMistakeUI();
  var color = '#c9a24b';
  var bot = document.getElementById('coachBot');
  var box = document.getElementById('dialogueBox');
  bot.style.setProperty('--mood', color);
  box.style.setProperty('--mood', color);
  bot.setAttribute('data-mood', 'good');
  document.getElementById('botMouth').setAttribute('d', MOUTH.good);
  document.getElementById('botBrowL').setAttribute('d', BROW_L.good);
  document.getElementById('botBrowR').setAttribute('d', BROW_R.good);
  document.getElementById('badgeIcon').textContent = '\u2713';
  var lbl = document.getElementById('dialogueLabel');
  var ico = document.getElementById('dialogueIconEl');
  lbl.textContent = 'Ready';
  lbl.style.color = color;
  ico.textContent = '\u2713';
  ico.style.color = color;
  if (typeTimer) clearInterval(typeTimer);
  document.getElementById('dialogueText').innerHTML = text || 'Ready when you are. Make a move!';
  document.getElementById('dialogueText').classList.remove('typing');
  bot.classList.remove('talking');
}

function coachProgress(text) {
  var el = document.getElementById('dialogueText');
  if (typeTimer) clearInterval(typeTimer);
  el.innerHTML = text;
  el.classList.remove('typing');
}

// ═══════════════════════════════════════════════════════
// EVAL GRAPH
// ═══════════════════════════════════════════════════════
var graphMoves = [], graphHoverIdx = -1;
var _previewActive = false, _savedPreviewNavIdx = -1;
var _sfPreviewActive = false, _sfSavedNavIdx = -1;
var GLYPH = {brilliant:'!!',great:'!',best:'\u2605',excellent:'\u2713',good:'\u2713',inaccuracy:'?!',mistake:'?',blunder:'!!',book:'\u25C7',forced:'\u25C1'};

function drawGraph() {
  var canvas = document.getElementById('evalCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var rect = canvas.parentElement.getBoundingClientRect();
  var w = Math.max(1, Math.round(rect.width)), h = 70;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  var barH = graphMoves.length ? 16 : 0;
  var padTop = 6, areaH = Math.max(4, h - barH - padTop - 4);
  var areaY = padTop, barY = h - barH;
  function clamp(v) { var c = Math.max(-12, Math.min(12, v)); if (Math.abs(c) <= 8) return c; return Math.sign(c) * (8 + (Math.abs(c) - 8) / 4 * 8 * .12); }
  function toY(ev) { var c = clamp(ev), m = 8 * 1.12, mid = areaY + areaH / 2; return mid - (c / m) * (areaH / 2); }
  function toX(i) { if (graphMoves.length <= 1) return w / 2; return (i / (graphMoves.length - 1)) * w; }
  if (!graphMoves.length) {
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.font = '12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Play moves to see the evaluation graph', w / 2, areaY + areaH / 2);
    return;
  }
  var mid = areaY + areaH / 2;
  var gT = ctx.createLinearGradient(0, areaY, 0, mid);
  gT.addColorStop(0, 'rgba(255,255,255,.06)');
  gT.addColorStop(1, 'rgba(255,255,255,.02)');
  ctx.fillStyle = gT;
  ctx.fillRect(0, areaY, w, mid - areaY);
  var gB = ctx.createLinearGradient(0, mid, 0, areaY + areaH);
  gB.addColorStop(0, 'rgba(0,0,0,.05)');
  gB.addColorStop(1, 'rgba(0,0,0,.15)');
  ctx.fillStyle = gB;
  ctx.fillRect(0, mid, w, areaY + areaH - mid);
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  graphMoves.forEach(function(m, i) { i === 0 ? ctx.moveTo(toX(i), toY(m.eval)) : ctx.lineTo(toX(i), toY(m.eval)); });
  ctx.lineTo(toX(graphMoves.length - 1), mid);
  ctx.lineTo(0, mid);
  ctx.closePath();
  var gF = ctx.createLinearGradient(0, areaY, 0, areaY + areaH);
  gF.addColorStop(0, 'rgba(252,211,77,.25)');
  gF.addColorStop(.5, 'rgba(252,211,77,.03)');
  gF.addColorStop(.5, 'rgba(76,143,224,.03)');
  gF.addColorStop(1, 'rgba(76,143,224,.20)');
  ctx.fillStyle = gF;
  ctx.fill();
  ctx.beginPath();
  graphMoves.forEach(function(m, i) { i === 0 ? ctx.moveTo(toX(i), toY(m.eval)) : ctx.lineTo(toX(i), toY(m.eval)); });
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  for (var i = 1; i < graphMoves.length; i++) {
    var sw = Math.abs(graphMoves[i].eval - graphMoves[i - 1].eval);
    if (sw < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(toX(i), toY(graphMoves[i - 1].eval));
    ctx.lineTo(toX(i), toY(graphMoves[i].eval));
    ctx.strokeStyle = sw >= 1.5 ? 'rgba(224,72,62,.8)' : 'rgba(226,146,51,.6)';
    ctx.lineWidth = sw >= 1.5 ? 2 : 1.2;
    ctx.setLineDash(sw >= 3 ? [] : [3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (graphHoverIdx >= 0 && graphHoverIdx < graphMoves.length) {
    var hx = toX(graphHoverIdx);
    ctx.beginPath();
    ctx.moveTo(hx, areaY);
    ctx.lineTo(hx, barY);
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, toY(graphMoves[graphHoverIdx].eval), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fcd34d';
    ctx.fill();
    ctx.strokeStyle = '#1c1c2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  var cw = w / graphMoves.length;
  graphMoves.forEach(function(m, i) {
    ctx.globalAlpha = (graphHoverIdx === i || graphHoverIdx === -1) ? 1 : .4;
    ctx.fillStyle = MOOD_COLORS[m.classification] || '#6b7280';
    ctx.fillRect(i * cw, barY, Math.max(1, cw - 1), barH);
  });
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(w, barY);
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

var _lastMouseX = -1, _lastMouseY = -1;
var _lastSfEl = null;
function showSfPreview(el) {
  console.log('[SFPreview] showSfPreview called', el, el.dataset);
  var uci = el.dataset.sfUci;
  var fen = el.dataset.sfFen;
  if (!uci || !fen) { console.log('[SFPreview] Missing uci or fen', { uci: uci, fen: fen }); return; }
  _sfPreviewActive = true;
  _lastSfEl = el;
  _sfSavedNavIdx = navIdx;
  console.log('[SFPreview] Creating Chess from fen', fen, 'uci', uci);
  var tmpG = new Chess(fen);
  var mr = tmpG.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci.length > 4 ? uci[4] : 'q' });
  console.log('[SFPreview] move result', mr);
  if (mr) cg.set({ fen: tmpG.fen() });
}
function hideSfPreview() {
  console.log('[SFPreview] hideSfPreview called, _sfPreviewActive=' + _sfPreviewActive);
  if (!_sfPreviewActive) return;
  _sfPreviewActive = false;
  _lastSfEl = null;
  if (_sfSavedNavIdx >= 0 && _sfSavedNavIdx < moveHistory.length) {
    var savedM = moveHistory[_sfSavedNavIdx];
    console.log('[SFPreview] Restoring to savedNavIdx', _sfSavedNavIdx, 'fenAfter', savedM ? savedM.fenAfter : null);
    if (savedM && savedM.fenAfter) cg.set({ fen: savedM.fenAfter });
  } else {
    console.log('[SFPreview] Falling back to updateBoard');
    updateBoard();
  }
}
document.addEventListener('pointermove', function(evt) {
  _lastMouseX = evt.clientX; _lastMouseY = evt.clientY;
  var el = document.elementFromPoint(evt.clientX, evt.clientY);
  if (el && el.classList && el.classList.contains('stockfish-preview')) {
    if (el !== _lastSfEl) {
      console.log('[SFPreview] pointermove detected stockfish-preview', el.textContent, 'last was', _lastSfEl);
      if (_lastSfEl) hideSfPreview();
      _lastSfEl = el;
      showSfPreview(el);
    }
  } else if (_lastSfEl) {
    console.log('[SFPreview] pointermove left stockfish-preview');
    hideSfPreview();
  }
});
document.getElementById('evalCanvas').addEventListener('pointermove', function(evt) {
  if (!graphMoves.length) return;
  var rect = this.getBoundingClientRect(), x = evt.clientX - rect.left;
  var idx = Math.max(0, Math.min(graphMoves.length - 1, Math.round((x / rect.width) * (graphMoves.length - 1))));
  if (idx !== graphHoverIdx) {
    graphHoverIdx = idx;
    drawGraph();
    var m = graphMoves[idx];
    if (!m) return;
    var tip = document.getElementById('graphTooltip');
    var color = MOOD_COLORS[m.classification] || '#9ca3b8';
    tip.innerHTML = '<strong>' + m.ply + '. ' + m.moveSan + '</strong><span style="color:' + color + ';font-weight:700;margin:0 6px">' + GLYPH[m.classification] + ' ' + m.classification + '</span><span style="color:#9ca3b8">' + (m.eval > 0 ? '+' : '') + m.eval.toFixed(2) + '</span>';
    tip.style.display = 'block';
    var tx = Math.max(4, Math.min(rect.width - tip.offsetWidth - 4, x - tip.offsetWidth / 2));
    tip.style.left = tx + 'px';
    tip.style.top = '-2px';

    // Board preview on hover
    if (!isAnalysing && currentMode !== 'review') {
      if (!_previewActive) {
        _previewActive = true;
        _savedPreviewNavIdx = navIdx;
      }
      var hm = moveHistory[idx];
      if (hm && hm.fenAfter) {
        cg.set({ fen: hm.fenAfter });
      }
    }
  }
});
document.getElementById('evalCanvas').addEventListener('pointerleave', function() {
  graphHoverIdx = -1;
  drawGraph();
  document.getElementById('graphTooltip').style.display = 'none';
  // Restore board from preview
  if (_previewActive) {
    _previewActive = false;
    if (_savedPreviewNavIdx >= 0 && _savedPreviewNavIdx < moveHistory.length) {
      var savedM = moveHistory[_savedPreviewNavIdx];
      if (savedM && savedM.fenAfter) {
        cg.set({ fen: savedM.fenAfter });
      }
    } else {
      updateBoard();
    }
  }
});
document.getElementById('evalCanvas').addEventListener('click', function(evt) {
  if (!graphMoves.length) return;
  _lastMouseX = evt.clientX; _lastMouseY = evt.clientY;
  var rect = this.getBoundingClientRect(), x = evt.clientX - rect.left;
  var idx = Math.max(0, Math.min(graphMoves.length - 1, Math.round((x / rect.width) * (graphMoves.length - 1))));
  var m = moveHistory[idx];
  if (!m) return;

  // During review playback, skip to next landmark
  if (currentMode === 'review' && playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
    // Jump directly to the clicked move's position
    var targetIdx = -1;
    if (reviewData) {
      for (var li = 0; li < reviewData.landmarks.length; li++) {
        var lm = reviewData.landmarks[li];
        var lmMoveNum = Math.floor((lm.moveNumber - 1) * 2 + (lm.color === 'Black' ? 1 : 0));
        if (lmMoveNum >= idx) { targetIdx = li; break; }
      }
    }
    if (targetIdx >= 0) {
      goToMove(idx);
      playbackCancelled = false;
      advanceToLandmark(targetIdx);
    } else {
      goToMove(idx);
      cancelReview();
    }
    return;
  }

  // Navigate board to clicked move
  _previewActive = false;
  goToMove(idx);

  // Show coach explanation for the clicked move
  var cls = m.classification || 'good';
  var g = graphMoves[idx];
  var swing = g ? Math.abs(g.eval - (idx > 0 ? graphMoves[idx - 1].eval : 0)) : 0;
  var stockfishNote = '';
  if (m.bestUci) {
    var tmpG = new Chess(m.fenBefore);
    var sfMr = tmpG.move({ from: m.bestUci.slice(0,2), to: m.bestUci.slice(2,4), promotion: m.bestUci.length > 4 ? m.bestUci[4] : 'q' });
    var sfSan = sfMr ? sfMr.san : m.bestUci;
    stockfishNote = ' Stockfish preferred <span class="stockfish-preview accent" data-sf-uci="' + m.bestUci + '" data-sf-fen="' + m.fenBefore + '">' + sfSan + '</span>.';
  }
  var mn = Math.floor(idx / 2) + 1;
  var suffix = idx % 2 === 0 ? '.' : '...';
  var moveLabel = mn + suffix + ' ' + m.san;
  var msg = '<strong>' + moveLabel + '</strong> &mdash; <span style="color:' + (MOOD_COLORS[cls] || '#c9a24b') + '">' + cls.toUpperCase() + '</span>.' + stockfishNote;
  msg += ' Eval: ' + (m.evalAfter > 0 ? '+' : '') + m.evalAfter.toFixed(2);
  if (swing > 0.15) msg += ' (swing ' + (swing > 0 ? '+' : '') + swing.toFixed(2) + ')';
  updateCoach({ classification: cls, currentEval: m.evalAfter, evalSwing: swing, moveSan: m.san, isWhiteToMove: idx % 2 === 0, customMsg: msg, pvAfter: m.pvAfter || null, fenAfter: m.fenAfter || null });
});
new ResizeObserver(drawGraph).observe(document.getElementById('evalCanvas').parentElement);


// ═══════════════════════════════════════════════════════
// EVAL BAR
// ═══════════════════════════════════════════════════════
function updateEvalDisplay(cp) {
  var p = cp / 100;
  var disp = document.getElementById('evalDisplay');
  var bar = document.getElementById('evalBar');
  if (Math.abs(cp) >= 10000) { disp.textContent = cp > 0 ? 'M+' : 'M-'; } else { disp.textContent = (p >= 0 ? '+' : '') + p.toFixed(2); }
  var clamped = Math.max(-8, Math.min(8, p));
  bar.style.height = (50 + (clamped / 8) * 50).toFixed(1) + '%';
}

// ═══════════════════════════════════════════════════════
// MOVE HISTORY
// ═══════════════════════════════════════════════════════
var moveHistory = [];

function updateMoveHighlight() {
  var chips = document.querySelectorAll('#moveList .move-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', i === navIdx && branchState.mode === 'mainline');
  }
}
function renderHistory() {
  var list = document.getElementById('moveList');
  list.innerHTML = '';
  moveHistory.forEach(function(m, i) {
    var chip = document.createElement('span');
    chip.className = 'move-chip' + (i === navIdx && branchState.mode === 'mainline' ? ' active' : '');
    var color = MOOD_COLORS[m.classification] || '#6b7280';
    var mn = Math.floor(i / 2) + 1, isW = i % 2 === 0;
    chip.innerHTML = '<span class="move-num">' + (isW ? mn + '.' : '') + '</span><span class="cls-dot" style="background:' + color + '"></span>' + m.san;
    chip.addEventListener('click', function() {
      if (!isAnalysing) goToMove(i);
    });
    list.appendChild(chip);

    // Render branch buttons below the divergence point
    var brsAt = branches.filter(function(b) { return b.parentMoveIndex === i; });
    if (brsAt.length > 0) {
      var brWrap = document.createElement('div');
      brWrap.className = 'branch-wrap';
      brsAt.forEach(function(b) {
        var brChip = document.createElement('span');
        var isActive = (branchState.mode === 'branch' && branchState.activeBranchId === b.id);
        brChip.className = 'branch-chip' + (isActive ? ' active' : '');
        brChip.innerHTML = '&#9492; Var ' + b.label + ': <strong>' + b.moves[0] + '</strong>' + (b.moves.length > 1 ? '...' : '');
        brChip.title = 'Branch ' + b.label + ': ' + b.moves.join(' ');
        brChip.addEventListener('click', function(ev) {
          if (!isAnalysing) { ev.stopPropagation(); goToBranch(b.id); }
        });
        // Promote button
        var promBtn = document.createElement('span');
        promBtn.className = 'branch-prom';
        promBtn.textContent = '\u2B06';
        promBtn.title = 'Promote to main line';
        promBtn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          if (!isAnalysing) promoteBranch(b.id);
        });
        brChip.appendChild(promBtn);
        // X delete button on hover
        var delBtn = document.createElement('span');
        delBtn.className = 'branch-del';
        delBtn.textContent = '\u2716';
        delBtn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          if (!isAnalysing) deleteBranch(b.id);
        });
        brChip.appendChild(delBtn);
        brWrap.appendChild(brChip);
      });

      // Popover for "Delete branches here" on the main line chip
      var popBtn = document.createElement('span');
      popBtn.className = 'branch-pop-btn';
      popBtn.textContent = '\u25BE';
      popBtn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        showBranchPopover(popBtn, i);
      });
      chip.appendChild(popBtn);

      list.appendChild(brWrap);
    }
  });
  list.scrollTop = list.scrollHeight;
  var vals = { blunder: 0, mistake: .2, inaccuracy: .4, good: .65, excellent: .9, best: 1, great: 1, brilliant: 1, forced: 1, book: 1 };
  var wS = 0, wT = 0, bS = 0, bT = 0;
  moveHistory.forEach(function(m, i) {
    var v = vals[m.classification] || .65;
    // Best moves only score as best when eval is decisively in one side's favour (±3+)
    if ((m.classification === 'best' || m.classification === 'excellent') && Math.abs(m.evalAfter) < 3.0) {
      v = .65; // treat as good in balanced positions
    }
    if (i % 2 === 0) { wS += v; wT++; } else { bS += v; bT++; }
  });
  var acc = document.getElementById('accuracyDisplay');
  if (wT > 0) acc.textContent = 'W: ' + Math.round(wS / wT * 100) + '% \u00B7 B: ' + (bT > 0 ? Math.round(bS / bT * 100) + '%' : '--');
  else acc.textContent = '';
}

function showBranchPopover(anchorEl, parentIdx) {
  var existing = document.querySelector('.branch-popover');
  if (existing) existing.remove();

  var pop = document.createElement('div');
  pop.className = 'branch-popover';
  pop.innerHTML = '<div class="branch-pop-item" id="branchPopGo">Go to move</div><div class="branch-pop-item danger" id="branchPopDel">Delete branches here</div>';
  pop.style.position = 'absolute';
  document.body.appendChild(pop);

  var rect = anchorEl.getBoundingClientRect();
  pop.style.left = Math.max(4, rect.left - pop.offsetWidth + 20) + 'px';
  pop.style.top = (rect.bottom + 2) + 'px';

  document.getElementById('branchPopGo').addEventListener('click', function() {
    pop.remove();
    if (!isAnalysing) goToMove(parentIdx);
  });
  document.getElementById('branchPopDel').addEventListener('click', function() {
    pop.remove();
    if (!isAnalysing) deleteBranchesAt(parentIdx);
  });

  setTimeout(function() {
    document.addEventListener('click', function _closePop(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', _closePop); }
    });
  }, 0);
}

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function goToMove(idx) {
  if (idx < -1 || idx >= moveHistory.length) return;
  navIdx = idx;

  // Stop playback but keep review mode (don't cancel branch potential)
  if (playbackTimer) clearTimeout(playbackTimer);
  playbackCancelled = true;

  // Exit branch mode when navigating main line
  branchState.mode = 'mainline';
  branchState.activeBranchId = null;

  if (idx === -1) {
    game = new Chess();
    updateBoard();
    cg.set({ check: false });
    updateEvalDisplay(0);
    cg.setShapes([]);
    updateNavDisplay();
    renderHistory();
    drawGraph();
    coachProgress('Start position');
    updateExplorer();
    return;
  }

  var m = moveHistory[idx];
  if (!m) return;
  var currentPly = game.history().length;
  var targetPly = idx + 1;
  if (currentPly > targetPly) {
    game = new Chess();
    for (var i = 0; i <= idx; i++) game.move(moveHistory[i].san);
  } else if (currentPly < targetPly) {
    for (var i = currentPly; i <= idx; i++) game.move(moveHistory[i].san);
  }
  var displayCp = m.evalAfter * 100;
  if (game.turn() === 'b') displayCp = -displayCp;
  updateEvalDisplay(displayCp);

  // Compute the from/to squares for the target move
  var lastFrom = null, lastTo = null;
  if (m.fenBefore) {
    var tmpPrev = new Chess(m.fenBefore);
    var moveObj = tmpPrev.move(m.san);
    if (moveObj) { lastFrom = moveObj.from; lastTo = moveObj.to; }
  }
  if (!lastFrom && idx >= 0) {
    var tmpPrev2 = new Chess();
    for (var j = 0; j < idx; j++) { tmpPrev2.move(moveHistory[j].san); }
    var moveObj2 = tmpPrev2.move(m.san);
    if (moveObj2) { lastFrom = moveObj2.from; lastTo = moveObj2.to; }
  }

  // Single combined cg.set so chessground animates from current visual state to target FEN
  cg.set({
    fen: game.fen(),
    turnColor: toColor(game.turn()),
    movable: { color: 'both', dests: getLegalDests() },
    lastMove: lastFrom && lastTo ? [lastFrom, lastTo] : [],
    check: game.in_check() ? game.turn() : false
  });
  cg.setShapes([]);

  updateNavDisplay();

  var cls = m.classification || 'good';
  var color = MOOD_COLORS[cls] || '#c9a24b';
  var meta = CLASS_META[cls] || CLASS_META.good;
  var mn = Math.floor(idx / 2) + 1;
  var suffix = idx % 2 === 0 ? '.' : '...';
  coachProgress(mn + suffix + ' ' + m.san + ' &middot; <span style="color:' + color + '">' + meta.label + '</span> &middot; ' + (m.evalAfter > 0 ? '+' : '') + m.evalAfter.toFixed(2));
  renderHistory();
  drawGraph();
  updateExplorer();
}

function suggestBestMove() {
  if (isAnalysing || !engineReady) return;

  var fen = game.fen();
  var depth = parseInt(document.getElementById('depthSlider').value, 10);

  setEngineStatus('thinking');
  coachProgress('Thinking...');

  analysisPool.evaluate(fen, depth, function(lines) {
    setEngineStatus('ready');
    var parsed = parseLines(lines);
    var top = parsed[0];
    if (!top || !top.move) {
      coachReset('Could not find a best move for this position.');
      return;
    }

    var uci = top.move;
    var from = uci.slice(0, 2), to = uci.slice(2, 4);

    // Highlight on board
    cg.setShapes([{ orig: from, dest: to, brush: 'yellow' }]);

    // Convert UCI to SAN
    var tmpGame = new Chess(fen);
    var moveResult = tmpGame.move({ from: from, to: to, promotion: 'q' });
    var san = moveResult ? moveResult.san : uci;

    var cp = top.cp || 0;
    var evStr = (cp > 0 ? '+' : '') + (cp / 100).toFixed(2);
    coachProgress('Best: <span class="accent">' + san + '</span> (eval ' + evStr + ') @ depth ' + depth);
    speakText('Best move: ' + san + ', evaluation ' + evStr);
  });
}

// ═══════════════════════════════════════════════════════
// STOCKFISH ENGINE
// ═══════════════════════════════════════════════════════
var analysisPool = null;
var engineReady = false;

function setEngineStatus(s) {
  var dot = document.getElementById('engineDot'), lbl = document.getElementById('engineLabel');
  dot.className = 'engine-dot';
  if (s === 'ready') { dot.classList.add('ready');
    lbl.textContent = 'Engine ready'; } else if (s === 'thinking') { dot.classList.add('thinking');
    lbl.textContent = 'Analysing...'; } else if (s === 'maia') { dot.classList.add('maia');
    lbl.textContent = 'Maia thinking...'; } else { lbl.textContent = 'Connecting...'; }
}

function initEngine() {
  setEngineStatus('connect');
  POOL_SIZE = 1;
  console.log('[Engine] Starting init, URL:', STOCKFISH_WORKER_URL);

  // Diagnose: can the Worker file be loaded at all?
  fetch(STOCKFISH_WORKER_URL).then(function(r) {
    console.log('[Engine] Worker file fetch:', r.status, r.statusText);
    return r.text();
  }).then(function(text) {
    console.log('[Engine] Worker file size:', text.length, 'bytes, first 200 chars:', text.substring(0, 200));
  }).catch(function(err) {
    console.error('[Engine] Worker file fetch FAILED:', err);
  });

  try {
    analysisPool = createAnalysisPool(POOL_SIZE);
  } catch (e) {
    console.error('[Engine] Failed to create worker pool:', e);
    document.getElementById('engineLabel').textContent = 'Engine failed to load: ' + e.message;
  }
  // Timeout: if engine doesn't connect in 15s, warn the user
  setTimeout(function() {
    if (!engineReady) {
      console.warn('[Engine] Init timeout — engine not ready after 15s');
      console.warn('[Engine] Last 10 messages from worker:', recentWorkerMsgs ? recentWorkerMsgs.join(' | ') : '(none)');
      document.getElementById('engineLabel').textContent = 'Engine not responding (check console)';
      document.getElementById('engineDot').className = 'engine-dot error';
    }
  }, 15000);
}

function createAnalysisPool(size) {
  var workers = [];
  var readyCount = 0;
  var busy = [];
  var pendingCbs = [];
  var queue = [];

  function init(idx) {
    console.log('[Engine] Creating worker #' + idx + ' from URL:', STOCKFISH_WORKER_URL);
    var w;
    try {
      w = new Worker(STOCKFISH_WORKER_URL);
      console.log('[Engine] Worker #' + idx + ' created successfully');
    } catch (e) {
      console.error('[Engine] Worker creation failed:', e);
      document.getElementById('engineLabel').textContent = 'Worker creation failed';
      return null;
    }
    var buf = [];
    w.onmessage = function(e) {
      var line = e.data;
      var type = typeof line;
      if (type !== 'string') {
        console.log('[Engine] Worker #' + idx + ' msg (non-string):', type, JSON.stringify(line).substring(0, 200));
        return;
      }
      recentWorkerMsgs.push(line);
      if (recentWorkerMsgs.length > 50) recentWorkerMsgs.shift();
      console.log('[Engine] Worker #' + idx + ' says:', JSON.stringify(line.substring(0, 200)));
      buf.push(line);
      if (line === 'uciok') {
        console.log('[Engine] Worker #' + idx + ' uciok → sending isready');
        w.postMessage('isready');
      }
      else if (line === 'readyok') {
        console.log('[Engine] Worker #' + idx + ' ready!');
        readyCount++;
        busy[idx] = false;
        engineReady = true;
        if (readyCount === size) setEngineStatus('ready');
        dispatch();
      } else if (line.indexOf('bestmove') === 0) {
        console.log('[Engine] Worker #' + idx + ' bestmove received');
        busy[idx] = false;
        var cb = pendingCbs[idx];
        pendingCbs[idx] = null;
        if (cb) cb(buf);
        buf = [];
        dispatch();
      }
    };
    w.onerror = function(e) {
      console.error('[Engine] Worker #' + idx + ' error:', e.message || e, 'file:', e.filename, 'line:', e.lineno);
      document.getElementById('engineLabel').textContent = 'Worker error: ' + (e.message || 'unknown');
    };
    console.log('[Engine] Worker #' + idx + ' sending: uci');
    w.postMessage('uci');
    workers.push(w);
    busy.push(true);
    pendingCbs.push(null);
  }

  for (var i = 0; i < size; i++) init(i);

  function dispatch() {
    while (queue.length > 0) {
      var free = -1;
      for (var i = 0; i < workers.length; i++) {
        if (!busy[i] && workers[i]) { free = i; break; }
      }
      if (free === -1) break;
      var item = queue.shift();
      busy[free] = true;
      pendingCbs[free] = item.cb;
      workers[free].postMessage('position fen ' + item.fen);
      workers[free].postMessage('go depth ' + item.depth + ' movetime 1500');
    }
  }

  return {
    evaluate: function(fen, depth, cb) {
      queue.push({ fen: fen, depth: depth, cb: cb });
      dispatch();
    },
    isReady: function() { return readyCount === size; },
    readyCount: function() { return readyCount; },
    terminate: function() {
      workers.forEach(function(w) { if (w) w.terminate(); });
      workers = []; queue = [];
    }
  };
}

// ═══════════════════════════════════════════════════════
// UCI PARSING (reused from original)
// ═══════════════════════════════════════════════════════
function parseLines(lines) {
  var byPV = {};
  lines.forEach(function(l) {
    if (l.indexOf('info') !== 0) return;
    var pvM = l.match(/\bpv\s+(\S+)/);
    var cpM = l.match(/\bscore cp (-?\d+)/);
    var mateM = l.match(/\bscore mate (-?\d+)/);
    var pvIdM = l.match(/\bmultipv (\d+)/);
    var depM = l.match(/\bdepth (\d+)/);
    if (!pvM) return;
    var pvId = pvIdM ? +pvM[1] : 1, dep = depM ? +depM[1] : 0;
    if (!byPV[pvId] || dep > byPV[pvId].dep) {
      var pvFull = l.match(/\bpv\s+(.+)/);
      var pvArr = pvFull ? pvFull[1].trim().split(/\s+/) : [pvM[1]];
      byPV[pvId] = { move: pvM[1], pv: pvArr.slice(0, 10), cp: cpM ? +cpM[1] : null, mateIn: mateM ? +mateM[1] : null, dep: dep };
    }
  });
  return Object.values(byPV);
}

function toCp(line) {
  if (!line) return 0;
  if (line.mateIn !== null) return line.mateIn > 0 ? 100000 - line.mateIn : -100000 - line.mateIn;
  return line.cp || 0;
}

// ═══════════════════════════════════════════════════════
// CLASSIFICATION
// ═══════════════════════════════════════════════════════
function getThresh(c, prevCp) {
  var a = Math.abs(prevCp);
  if (c === 'best') return Math.max(0, .0001 * a * a + .0236 * a - 3.7143);
  if (c === 'excellent') return Math.max(0, .0002 * a * a + .1231 * a + 27.5455);
  if (c === 'good') return Math.max(0, .0002 * a * a + .2643 * a + 60.5455);
  if (c === 'inaccuracy') return Math.max(0, .0002 * a * a + .3624 * a + 108.0909);
  if (c === 'mistake') return Math.max(0, .0003 * a * a + .4027 * a + 225.8182);
  return Infinity;
}

function classifyMove(topBefore, secondBefore, afterLine, playedUci, boardBefore) {
  if (!topBefore || !afterLine) return 'good';
  var afterNeg = { cp: afterLine.cp !== null ? -afterLine.cp : null, mateIn: afterLine.mateIn !== null ? -afterLine.mateIn : null };
  var evBefore = toCp(topBefore), evAfter = toCp(afterNeg);
  var delta = Math.max(0, evBefore - evAfter), prevCp = topBefore.cp || 0;
  var onlyMove = secondBefore && (toCp(topBefore) - toCp(secondBefore)) >= 350;

  if (afterNeg.mateIn !== null) {
    if (afterNeg.mateIn < 0) return 'blunder';
    if (afterNeg.mateIn > 0) return 'brilliant';
  }

  if (playedUci === topBefore.move) return onlyMove ? 'great' : 'best';
  if (onlyMove) return 'blunder';

  if (detectBrilliantSacrifice(playedUci, evBefore, evAfter, boardBefore)) return 'brilliant';

  var cats = ['best', 'excellent', 'good', 'inaccuracy', 'mistake'];
  for (var i = 0; i < cats.length; i++) {
    if (delta <= getThresh(cats[i], prevCp)) {
      if (cats[i] === 'blunder') { if (evAfter >= 600) return 'good'; if (evBefore <= -600) return 'good'; }
      return cats[i];
    }
  }
  return 'blunder';
}

function detectBrilliantSacrifice(playedUci, evBefore, evAfter, boardBefore) {
  if (!boardBefore) return false;
  var BRILLIANT_GAIN_CP = 200;
  var WINNING_THRESHOLD = 600;

  var from = playedUci.slice(0, 2), to = playedUci.slice(2, 4);
  var piece = boardBefore.get(from);
  if (!piece || piece.type === 'p') return false;
  if (evBefore >= WINNING_THRESHOLD || evBefore <= -WINNING_THRESHOLD) return false;
  var gain = evAfter - evBefore;
  if (gain < BRILLIANT_GAIN_CP) return false;
  var opponentColor = piece.color === 'w' ? 'b' : 'w';
  if (!boardBefore.isSquareAttacked(to, opponentColor)) return false;
  if (boardBefore.isSquareAttacked(to, piece.color)) return false;
  return true;
}

// ═══════════════════════════════════════════════════════
// CHESS BOARD
// ═══════════════════════════════════════════════════════
var game = new Chess();
var cg = null;
var isAnalysing = false;
var currentMode = 'interactive'; // 'interactive' | 'review'
var reviewData = null; // store review results for navigation
var prevEval = null; // cached best-line from previous eval (reused as before-eval for next move)
var recentWorkerMsgs = []; // debug: last 50 worker messages
var navIdx = -1;
var branches = [];
var branchState = { mode: 'mainline', activeBranchId: null };
var deletedBranches = [];
var branchIdCounter = 0;
function genBranchId() { return 'br_' + (++branchIdCounter); }

function getLegalDests() {
  var dests = new Map();
  game.moves({ verbose: true }).forEach(function(m) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  });
  return dests;
}

function toColor(turn) { return turn === 'w' ? 'white' : 'black'; }

function initBoard() {
  var el = document.getElementById('board');
  cg = ChessgroundLib.Chessground(el, {
    movable: { color: 'both', free: false, dests: getLegalDests() },
    events: { move: onMove },
    animation: { enabled: true, duration: 150 },
    highlight: { lastMove: true, check: true },
    draggable: { showGhost: true }
  });
}

function updateBoard() {
  cg.set({
    fen: game.fen(),
    turnColor: toColor(game.turn()),
    movable: { color: 'both', dests: getLegalDests() },
    lastMove: undefined,
    check: game.in_check() ? game.turn() : false
  });
  cg.setShapes([]);
}

function updateNavDisplay() {
  var navBar = document.getElementById('navBar');
  var navInfo = document.getElementById('navMoveInfo');
  if (moveHistory.length === 0) { navBar.style.display = 'none'; return; }
  navBar.style.display = 'flex';
  document.getElementById('prevMoveBtn').disabled = (navIdx <= -1);
  document.getElementById('nextMoveBtn').disabled = (navIdx >= moveHistory.length - 1);
  if (navIdx < 0) { navInfo.innerHTML = 'Start'; return; }
  var m = moveHistory[navIdx];
  if (!m) { navInfo.textContent = ''; return; }
  var mn = Math.floor(navIdx / 2) + 1;
  var suffix = navIdx % 2 === 0 ? '.' : '...';
  var evStr = (m.evalAfter > 0 ? '+' : '') + m.evalAfter.toFixed(2);
  navInfo.innerHTML = mn + suffix + ' ' + m.san + ' (' + evStr + ')';
}

function onMove(from, to) {
  if (isAnalysing) return;

  if (currentMode === 'review') {
    handleReviewMove(from, to);
    return;
  }

  if (branchState.mode === 'branch') {
    handleBranchMove(from, to);
    return;
  }

  // ── Play vs Coach mode ──
  if (maiaMode) {
    onMaiaUserMove(from, to);
    return;
  }

  // If we navigated back and are now playing a new move, truncate the future
  var insertIdx = navIdx + 1; // where the new move goes
  if (insertIdx < moveHistory.length) {
    moveHistory.splice(insertIdx);
    graphMoves.splice(insertIdx);
    branches = branches.filter(function(b) { return b.parentMoveIndex < insertIdx; });
    // prevEval should be the engine line cached after the move at navIdx
    prevEval = navIdx >= 0 && moveHistory[navIdx] ? null : null; // will re-evaluate fenBefore
  }

  var fenBefore = game.fen();
  var isWhiteTurn = game.turn() === 'w';
  var uci = from + to;
  var result = game.move({ from: from, to: to, promotion: 'q' });
  if (!result) {
    cg.set({ fen: game.fen(), movable: { dests: getLegalDests() } });
    return;
  }
  var san = result.san, fenAfter = game.fen();
  isAnalysing = true;

  updateBoard();
  cg.set({ lastMove: [from, to], check: game.in_check() ? game.turn() : false });

  var depth = parseInt(document.getElementById('depthSlider').value, 10);

  if (moveHistory.length < 5) {
    fetchOpening(fenBefore, document.getElementById('ratingSelect').value).then(function(opening) {
      if (opening && moveHistory.length <= 5) {
        coachProgress('Opening: ' + opening.openingName + ' (' + opening.ecoCode + ')');
      }
    });
  }

  function finalize(beforeLine, afterLine) {
    setEngineStatus('ready');

    var beforeCpWhite = beforeLine ? (isWhiteTurn ? (beforeLine.cp || 0) : -(beforeLine.cp || 0)) : 0;
    var afterCpRaw = afterLine ? (afterLine.cp || 0) : 0;
    var afterCpWhite = isWhiteTurn ? -afterCpRaw : afterCpRaw;

    var evBefore = beforeCpWhite / 100;
    var evAfter = afterCpWhite / 100;
    var swing = Math.abs(evAfter - evBefore);

    var cls = classifyMove(beforeLine, null, afterLine, uci, new Chess(fenBefore));

    updateEvalDisplay(afterCpWhite);

    moveHistory.push({ san: san, classification: cls, evalBefore: evBefore, evalAfter: evAfter, fenBefore: fenBefore, fenAfter: fenAfter, bestUci: beforeLine ? beforeLine.move : null, pvBefore: beforeLine ? beforeLine.pv || null : null, pvAfter: afterLine ? afterLine.pv || null : null });
    graphMoves.push({ eval: evAfter, classification: cls, moveSan: san, ply: moveHistory.length });
    navIdx = moveHistory.length - 1;
    renderHistory();
    drawGraph();

    updateCoach({
      classification: cls,
      currentEval: evAfter,
      evalSwing: swing,
      moveSan: san,
      isWhiteToMove: !isWhiteTurn,
      pvAfter: afterLine ? afterLine.pv || null : null,
      fenAfter: fenAfter
    });

    prevEval = afterLine;
    isAnalysing = false;

    updateNavDisplay();
    updateExplorer();
  }

  setEngineStatus('thinking');
  analysisPool.evaluate(fenAfter, depth, function(linesAfter) {
    var parsedAfter = parseLines(linesAfter);
    var afterLine = parsedAfter[0] || null;

    if (!prevEval) {
      // First move: seed before-eval by evaluating fenBefore
      analysisPool.evaluate(fenBefore, depth, function(linesBefore) {
        var parsedBefore = parseLines(linesBefore);
        finalize(parsedBefore[0] || null, afterLine);
      });
    } else {
      finalize(prevEval, afterLine);
    }
  });
}

// ═══════════════════════════════════════════════════════
// BRANCHING (Review Mode)
// ═══════════════════════════════════════════════════════

function handleReviewMove(from, to) {
  var fenBefore = game.fen();
  var currentPly = game.history().length;

  // Check if the main line has an expected move at this ply
  var result = game.move({ from: from, to: to, promotion: 'q' });
  if (!result) return;
  var san = result.san;
  var fenAfter = game.fen();
  var uci = from + to;

  // Does it match the recorded game move at this ply?
  if (currentPly < moveHistory.length && san === moveHistory[currentPly].san) {
    // Advance along main line
    game = new Chess();
    for (var i = 0; i <= currentPly; i++) game.move(moveHistory[i].san);
    updateBoard();
    cg.set({ lastMove: [from, to], check: game.in_check() ? game.turn() : false });
    navIdx = currentPly;
    updateNavDisplay();
    var nM = moveHistory[navIdx];
    var mn = Math.floor(navIdx / 2) + 1;
    var suffix = navIdx % 2 === 0 ? '.' : '...';
    coachProgress(mn + suffix + ' ' + san + ' &middot; ' + (nM.evalAfter > 0 ? '+' : '') + nM.evalAfter.toFixed(2));
    updateExplorer();
    return;
  }

  // Different move — create a branch
  // Undo on the live game, use a temp game for the branch
  game.undo();
  var tempGame = new Chess(fenBefore);
  tempGame.move({ from: from, to: to, promotion: 'q' });

  var id = genBranchId();

  var existingLabels = branches.filter(function(b) { return b.parentMoveIndex === currentPly; }).map(function(b) { return b.label; });
  var label = 'A';
  for (var l = 65; l <= 90; l++) {
    if (existingLabels.indexOf(String.fromCharCode(l)) === -1) { label = String.fromCharCode(l); break; }
  }

  branches.push({ id: id, parentMoveIndex: currentPly, moves: [san], fens: [fenAfter], label: label });
  branchState.mode = 'branch';
  branchState.activeBranchId = id;
  game = tempGame;
  updateBoard();
  updateExplorer();
  cg.set({ lastMove: [from, to], check: game.in_check() ? game.turn() : false });

  isAnalysing = true;
  setEngineStatus('thinking');
  var depth = parseInt(document.getElementById('depthSlider').value, 10);
  analysisPool.evaluate(fenBefore, depth, function(beforeLines) {
    var beforeParsed = parseLines(beforeLines);
    var beforeTop = beforeParsed[0];
    analysisPool.evaluate(fenAfter, depth, function(afterLines) {
      setEngineStatus('ready');
      isAnalysing = false;
      var afterParsed = parseLines(afterLines);
      var afterTop = afterParsed[0];
      if (afterTop) {
        var cp = afterTop.cp || 0;
        updateEvalDisplay(cp);
        var evStr = (cp > 0 ? '+' : '') + (cp / 100).toFixed(2);
        var cls = classifyMove(beforeTop, null, afterTop, uci, new Chess(fenBefore));
        var isBlackTurn = game.turn() === 'b';
        var evAfter = (cp / 100);
        var whiteRel = isBlackTurn ? -evAfter : evAfter;
        coachProgress('Branch ' + label + ': ' + san + ' (' + evStr + ')');
        updateCoach({ classification: cls, currentEval: whiteRel, evalSwing: 0, moveSan: san, isWhiteToMove: !isBlackTurn });
      }
    });
  });

  renderHistory();
}

function handleBranchMove(from, to) {
  var branch = branches.filter(function(b) { return b.id === branchState.activeBranchId; })[0];
  if (!branch) { branchState.mode = 'mainline'; branchState.activeBranchId = null; return; }

  var fenBefore = game.fen();
  var result = game.move({ from: from, to: to, promotion: 'q' });
  if (!result) return;
  var san = result.san;
  var uci = from + to;
  var fenAfter = game.fen();

  branch.moves.push(san);
  branch.fens.push(fenAfter);
  updateBoard();
  updateExplorer();
  cg.set({ lastMove: [from, to], check: game.in_check() ? game.turn() : false });

  isAnalysing = true;
  setEngineStatus('thinking');
  var depth = parseInt(document.getElementById('depthSlider').value, 10);
  analysisPool.evaluate(fenBefore, depth, function(beforeLines) {
    var beforeParsed = parseLines(beforeLines);
    var beforeTop = beforeParsed[0];
    analysisPool.evaluate(fenAfter, depth, function(afterLines) {
      setEngineStatus('ready');
      isAnalysing = false;
      var afterParsed = parseLines(afterLines);
      var afterTop = afterParsed[0];
      if (afterTop) {
        var cp = afterTop.cp || 0;
        updateEvalDisplay(cp);
        var evStr = (cp > 0 ? '+' : '') + (cp / 100).toFixed(2);
        var cls = classifyMove(beforeTop, null, afterTop, uci, new Chess(fenBefore));
        var isBlackTurn = game.turn() === 'b';
        var evAfter = (cp / 100);
        var whiteRel = isBlackTurn ? -evAfter : evAfter;
        coachProgress('Branch ' + branch.label + ': ... ' + san + ' (' + evStr + ')');
        updateCoach({ classification: cls, currentEval: whiteRel, evalSwing: 0, moveSan: san, isWhiteToMove: !isBlackTurn });
      }
    });
  });

  renderHistory();
}

// ═══════════════════════════════════════════════════════
// BRANCH DELETION & UNDO
// ═══════════════════════════════════════════════════════

function deleteBranch(branchId) {
  for (var i = 0; i < branches.length; i++) {
    if (branches[i].id === branchId) {
      var removed = branches.splice(i, 1)[0];
      if (deletedBranches.length >= 10) deletedBranches.shift();
      deletedBranches.push(removed);
      if (branchState.activeBranchId === branchId) {
        branchState.mode = 'mainline';
        branchState.activeBranchId = null;
      }
      break;
    }
  }
  updateUndoBtn();
  renderHistory();
}

function promoteBranch(branchId) {
  var branch = null;
  for (var i = 0; i < branches.length; i++) {
    if (branches[i].id === branchId) { branch = branches[i]; break; }
  }
  if (!branch) return;
  var parentIdx = branch.parentMoveIndex;
  var before = moveHistory.slice(0, parentIdx);
  var promoted = branch.moves.map(function(san, j) {
    return {
      san: san,
      fenBefore: j === 0 ? moveHistory[parentIdx].fenBefore : branch.fens[j - 1],
      fenAfter: branch.fens[j],
      classification: null,
      evalBefore: 0,
      evalAfter: 0,
      bestUci: null
    };
  });
  branches.splice(i, 1);
  moveHistory = before.concat(promoted);
  game = new Chess();
  moveHistory.forEach(function(m) { game.move(m.san); });
  navIdx = moveHistory.length - 1;
  updateBoard();
  updateExplorer();
  branchState.mode = 'mainline';
  branchState.activeBranchId = null;
  updateUndoBtn();
  renderHistory();
  updateNavDisplay();
}

function deleteBranchesAt(parentMoveIndex) {
  var i = branches.length;
  while (i--) {
    if (branches[i].parentMoveIndex === parentMoveIndex) {
      var removed = branches.splice(i, 1)[0];
      if (deletedBranches.length >= 10) deletedBranches.shift();
      deletedBranches.push(removed);
      if (branchState.activeBranchId === removed.id) {
        branchState.mode = 'mainline';
        branchState.activeBranchId = null;
      }
    }
  }
  updateUndoBtn();
  renderHistory();
}

function undoDeleteBranch() {
  if (!deletedBranches.length) return;
  var restored = deletedBranches.pop();
  branches.push(restored);
  updateUndoBtn();
  renderHistory();
}

function updateUndoBtn() {
  var btn = document.getElementById('undoDeleteBtn');
  if (!btn) return;
  btn.style.display = deletedBranches.length > 0 ? 'inline-block' : 'none';
}

function goToBranch(branchId) {
  var branch = branches.filter(function(b) { return b.id === branchId; })[0];
  if (!branch) return;

  if (playbackTimer) clearTimeout(playbackTimer);
  playbackCancelled = true;

  branchState.mode = 'branch';
  branchState.activeBranchId = branchId;
  navIdx = Math.max(-1, branch.parentMoveIndex - 1);

  // Replay main line up to (but not including) parentMoveIndex, then play branch moves
  game = new Chess();
  for (var i = 0; i < branch.parentMoveIndex && i < moveHistory.length; i++) {
    game.move(moveHistory[i].san);
  }
  for (var j = 0; j < branch.moves.length; j++) {
    game.move(branch.moves[j]);
  }
  updateBoard();
  // Set lastMove from the final branch move
  var lastBranchSan = branch.moves[branch.moves.length - 1];
  var tmp = new Chess(game.fen());
  tmp.undo();
  var prevFen = tmp.fen();
  var tmp2 = new Chess(prevFen);
  var mr = tmp2.move(lastBranchSan);
  if (mr) cg.set({ lastMove: [mr.from, mr.to], check: game.in_check() ? game.turn() : false });

  cg.setShapes([]);
  updateNavDisplay();

  var idx = branch.parentMoveIndex + 1;
  var mn = Math.floor(idx / 2) + 1;
  var suffix = idx % 2 === 0 ? '.' : '...';
  coachProgress('Branch ' + branch.label + ': ' + branch.moves.join(' ') + ' &middot; ' + branch.moves.length + ' move(s)');
  renderHistory();
}

// ═══════════════════════════════════════════════════════
// GAME REVIEW PIPELINE
// ═══════════════════════════════════════════════════════
function runGameReview() {
  var pgn = document.getElementById('pgnInput').value.trim();
  if (!pgn) {
    coachReset('Paste a PGN first, then click Review Game.');
    return;
  }

  var reviewGame = new Chess();
  try {
    if (!reviewGame.load_pgn(pgn, { sloppy: true })) {
      coachReset('Invalid PGN. Please check the format and try again.');
      return;
    }
  } catch (e) {
    coachReset('Could not parse PGN. Please check the format.');
    return;
  }

  if (!engineReady) {
    coachReset('Engine still loading. Please wait a moment and try again.');
    return;
  }

  // Get opening info from starting position
  var startFen = new Chess().fen();
  var rating = document.getElementById('ratingSelect').value;
  fetchOpening(startFen, rating).then(function(opening) {
    if (opening) {
      coachProgress('Opening: ' + opening.openingName + ' (' + opening.ecoCode + ')');
    }
  });

  var moves = reviewGame.history({ verbose: true });
  if (!moves || moves.length === 0) {
    coachReset('No moves found in the PGN.');
    return;
  }

  clearMistakeUI();
  currentMode = 'review';
  reviewData = null;
  isAnalysing = true;
  setEngineStatus('thinking');
  coachProgress('Analysing ' + moves.length + ' moves with ' + POOL_SIZE + ' workers...');

  // Build flat position list — evaluate only after-state positions
  // evalBefore for move i = evalAfter for position i-1
  var allPositions = [{ fen: new Chess().fen() }]; // starting position (index 0)
  var temp = new Chess();
  for (var i = 0; i < moves.length; i++) {
    temp.move(moves[i]);
    allPositions.push({ fen: temp.fen(), move: moves[i], idx: i });
  }

  // Submit all evaluations to the pool in parallel
  var evals = [];
  var completed = 0;
  var startTime = performance.now();

  for (var i = 0; i < allPositions.length; i++) {
    (function(idx) {
      analysisPool.evaluate(allPositions[idx].fen, REVIEW_DEPTH, function(lines) {
        evals[idx] = parseLines(lines)[0] || null;
        completed++;

        if (completed % 4 === 0 || completed === allPositions.length) {
          var elapsed = Math.round((performance.now() - startTime) / 1000);
          coachProgress('Analysed ' + completed + '/' + allPositions.length + ' positions (' + elapsed + 's)...');
        }

        if (completed === allPositions.length) {
          // Build results array from evals (halved: N+1 evals → N move results)
          var results = [];
          for (var j = 0; j < moves.length; j++) {
            var m = allPositions[j + 1];
            var prevEval = evals[j];
            var afterEval = evals[j + 1];
            var uci = m.move.from + m.move.to;

            results.push({
              san: m.move.san,
              moveNumber: Math.floor(m.idx / 2) + 1,
              color: m.idx % 2 === 0 ? 'White' : 'Black',
              fenBefore: allPositions[j].fen,
              fenAfter: m.fen,
              uci: uci,
              from: m.move.from,
              to: m.move.to,
              classification: classifyMove(prevEval, null, afterEval, uci, new Chess(allPositions[j].fen)),
              evalBefore: toCp(prevEval),
              evalAfter: toCp(afterEval),
              evalSwing: Math.abs(toCp(prevEval) - toCp(afterEval)),
              isWhiteTurn: (m.idx % 2 === 0),
              topBefore: prevEval,
              afterLine: afterEval
            });
          }

          finishReview(results, moves, rating);
        }
      });
    })(i);
  }
}

function finishReview(results, moves, rating) {
  isAnalysing = false;
  setEngineStatus('ready');

  var r = parseInt(rating, 10);
  var thresholdBase = r < 1400 ? 2.0 : r < 1800 ? 1.5 : 1.0; // lower rating = higher threshold

  var landmarks = [];

  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    var isBook = i < 5; // first few moves considered book
    var evalSwingPawns = res.evalSwing / 100;

    var landmarkCategory = null;
    var isLandmark = false;

    // Determine if this is a landmark
    if (res.classification === 'blunder' || res.classification === 'brilliant') {
      isLandmark = true;
      landmarkCategory = res.classification === 'blunder' ? 'Blunder' : 'Brilliant';
    } else if (res.classification === 'great') {
      isLandmark = true;
      landmarkCategory = 'Great';
    } else if ((res.classification === 'best' || res.classification === 'excellent') && evalSwingPawns > 0.5 && Math.abs(res.evalAfter / 100) >= 3.0) {
      isLandmark = true;
      landmarkCategory = 'Best';
    } else if (i > 0 && (res.classification === 'mistake' || res.classification === 'inaccuracy')) {
      // Check for "Miss": opponent made a suboptimal move, player failed to capitalize
      var prevRes = results[i - 1];
      var prevWasSuboptimal = (prevRes.classification === 'blunder' || prevRes.classification === 'mistake' || prevRes.classification === 'inaccuracy');
      var playerFailed = res.classification !== 'best' && res.classification !== 'excellent' && res.classification !== 'brilliant' && res.classification !== 'great';
      if (prevWasSuboptimal && playerFailed && evalSwingPawns > thresholdBase * 0.7) {
        isLandmark = true;
        landmarkCategory = 'Miss';
      }
    }

    if (isLandmark) {
      var bestMoveSan = res.topBefore ? res.topBefore.move : null;
      var bestMoveHuman = null;
      if (bestMoveSan) {
        var tempGame = new Chess(res.fenBefore);
        var moveResult = tempGame.move({ from: bestMoveSan.slice(0, 2), to: bestMoveSan.slice(2, 4), promotion: 'q' });
        bestMoveHuman = moveResult ? moveResult.san : bestMoveSan;
      }

      landmarks.push({
        moveNumber: res.moveNumber,
        color: res.color,
        moveNotation: res.san,
        category: isBook ? 'Book' : landmarkCategory,
        evalSwing: evalSwingPawns,
        evalAfter: res.evalAfter / 100,
        commentary: generateReviewCommentary(landmarkCategory, res, bestMoveHuman, isBook)
      });
    }
  }

  // Checkmate landmark: the final move of the game
  var lastRes = results[results.length - 1];
  if (lastRes) {
    var finalGame = new Chess(lastRes.fenAfter);
    if (finalGame.in_checkmate()) {
      landmarks.push({
        moveNumber: lastRes.moveNumber,
        color: lastRes.color,
        moveNotation: lastRes.san,
        category: 'Checkmate',
        evalSwing: lastRes.evalSwing / 100,
        evalAfter: lastRes.evalAfter / 100,
        commentary: lastRes.color === 'White' ? 'White delivers checkmate!' : 'Black delivers checkmate!'
      });
    }
  }

  // Filter: only show landmark categories that matter (not every Best)
  var significantLandmarks = landmarks.filter(function(l) {
    return l.category === 'Checkmate' || l.category === 'Blunder' || l.category === 'Brilliant' || l.category === 'Great' || l.category === 'Miss' || (l.category === 'Best' && Math.abs(l.evalAfter) >= 3.0);
  });

  // Fallback: if no significant landmarks, show the top 3 most impactful moments (excluding Best under ±3)
  var fallbackLandmarks = landmarks.filter(function(l) {
    return l.category !== 'Best' || Math.abs(l.evalAfter) >= 3.0;
  }).sort(function(a, b) { return b.evalSwing - a.evalSwing; }).slice(0, 3);
  var finalLandmarks = significantLandmarks.length > 0 ? significantLandmarks : fallbackLandmarks;

  // Generate takeaway
  var blunderCount = finalLandmarks.filter(function(l) { return l.category === 'Blunder'; }).length;
  var missCount = finalLandmarks.filter(function(l) { return l.category === 'Miss'; }).length;
  var brilliantCount = finalLandmarks.filter(function(l) { return l.category === 'Brilliant'; }).length;

  var takeaway = '';
  if (blunderCount > 1) {
    takeaway = 'Focus on reducing blunders — ' + blunderCount + ' critical mistakes cost you the game. Try to calculate one extra ply before committing.';
  } else if (missCount > 1) {
    takeaway = 'You missed ' + missCount + ' opportunities to punish opponent errors. Practice spotting tactics when the opponent slips.';
  } else if (brilliantCount > 0) {
    takeaway = 'Great attacking vision! Keep sharpening your calculation to convert these brilliant ideas consistently.';
  } else {
    takeaway = 'A solid game. Continue working on positional understanding and tactical awareness to find the critical moments.';
  }

  reviewData = {
    landmarks: finalLandmarks,
    takeaway: takeaway,
    allMoves: moves,
    currentLandmark: -1
  };

  // Store all review moves in graph and history for display
  moveHistory = [];
  graphMoves = [];
  branches = [];
  branchState.mode = 'mainline';
  branchState.activeBranchId = null;
  deletedBranches = [];
  var ub = document.getElementById('undoDeleteBtn');
  if (ub) ub.style.display = 'none';
  results.forEach(function(r, idx) {
    var evPawns = r.evalAfter / 100;
    var whiteEval = idx % 2 === 0 ? -evPawns : evPawns;
    moveHistory.push({ san: r.san, classification: r.classification, evalBefore: r.evalBefore / 100, evalAfter: evPawns, fenBefore: r.fenBefore, fenAfter: r.fenAfter, bestUci: r.topBefore ? r.topBefore.move : null, pvBefore: r.topBefore ? r.topBefore.pv || null : null, pvAfter: r.afterLine ? r.afterLine.pv || null : null });
    graphMoves.push({ eval: whiteEval, classification: r.classification, moveSan: r.san, ply: moveHistory.length });
  });
  // Sync game to end of reviewed moves so graph clicks don't replay from scratch
  game = new Chess();
  moveHistory.forEach(function(m) { game.move(m.san); });
  renderHistory();
  drawGraph();

  // Start playback
  coachReset('Found ' + finalLandmarks.length + ' key moments. Starting review...');
  navIdx = -1;
  updateNavDisplay();
  updateExplorer();
  startLandmarkPlayback();
}

function generateReviewCommentary(category, res, bestMoveHuman, isBook) {
  if (isBook && category === 'Book') {
    return res.san + ' is a standard book move. Solid opening play.';
  }

  var templates = REVIEW_COMMENTARY[category] || ['{move} is a notable moment in the game.'];
  var msg = templates[Math.floor(Math.random() * templates.length)];
  msg = msg.replace(/\{move\}/g, res.san);
  if (category === 'Miss' && bestMoveHuman) {
    msg = msg.replace(/\{bestResponse\}/g, bestMoveHuman);
  }
  return msg;
}

// ═══════════════════════════════════════════════════════
// LANDMARK PLAYBACK
// ═══════════════════════════════════════════════════════
var playbackTimer = null;
var playbackCancelled = false;
var reviewPhase = 'navigate'; // 'navigate' | 'takeaway'

function startLandmarkPlayback() {
  if (!reviewData || reviewData.landmarks.length === 0) {
    coachReset('No significant landmarks found in this game.');
    document.getElementById('landmarkNavRow').style.display = 'none';
    return;
  }

  playbackCancelled = false;
  reviewData.currentLandmark = -1;
  document.getElementById('landmarkNavRow').style.display = '';
  updateLandmarkCounter();
  game = new Chess();
  updateBoard();
  advanceToLandmark(0);
}

function advanceToLandmark(idx) {
  if (playbackCancelled || idx >= reviewData.landmarks.length) {
    document.getElementById('landmarkNavRow').style.display = 'none';
    reviewPhase = 'takeaway';
    showTakeaway();
    return;
  }

  reviewData.currentLandmark = idx;
  var landmark = reviewData.landmarks[idx];

  // Find the move index in allMoves for this landmark
  var targetMoveIdx = -1;
  var moveCount = 0;
  for (var i = 0; i < reviewData.allMoves.length; i++) {
    var m = reviewData.allMoves[i];
    var mn = Math.floor(i / 2) + 1;
    var color = i % 2 === 0 ? 'White' : 'Black';
    if (mn === landmark.moveNumber && color === landmark.color && m.san === landmark.moveNotation) {
      targetMoveIdx = i;
      break;
    }
  }

  if (targetMoveIdx < 0) {
    advanceToLandmark(idx + 1);
    return;
  }

  // Fast-forward from current board state to target move
  var currentPly = game.history().length;
  if (currentPly > targetMoveIdx) {
    game = new Chess();
    currentPly = 0;
    updateBoard();
  }

  function playNextPly() {
    if (playbackCancelled) return;
    if (currentPly > targetMoveIdx) {
      showLandmark(landmark);
      return;
    }
    var m = reviewData.allMoves[currentPly];
    if (!m) { showLandmark(landmark); return; }
    game.move({ from: m.from, to: m.to, promotion: 'q' });
    updateBoard();
    cg.set({ lastMove: [m.from, m.to], check: game.in_check() ? game.turn() : false });
    currentPly++;
    navIdx = currentPly - 1;
    updateNavDisplay();
    updateMoveHighlight();
    var navM = moveHistory[navIdx];
    playbackTimer = setTimeout(playNextPly, 180);
  }

  playNextPly();
}

function showLandmark(landmark) {
  if (playbackCancelled) return;
  renderHistory();
  updateLandmarkCounter();

  var cat = landmark.category;
  var moodMap = { Book: 'book', Brilliant: 'brilliant', Great: 'great', Best: 'best', Blunder: 'blunder', Miss: 'inaccuracy' };
  var mood = moodMap[cat] || 'good';

  // Update coach with landmark info
  var meta = CLASS_META[mood] || CLASS_META.good;
  var color = MOOD_COLORS[mood] || '#c9a24b';
  var bot = document.getElementById('coachBot');
  var box = document.getElementById('dialogueBox');
  bot.style.setProperty('--mood', color);
  box.style.setProperty('--mood', color);
  document.getElementById('botMouth').setAttribute('d', MOUTH[mood] || MOUTH.good);
  document.getElementById('botBrowL').setAttribute('d', BROW_L[mood] || BROW_L.good);
  document.getElementById('botBrowR').setAttribute('d', BROW_R[mood] || BROW_R.good);
  document.getElementById('badgeIcon').textContent = meta.icon;
  document.getElementById('dialogueLabel').textContent = cat;
  document.getElementById('dialogueLabel').style.color = color;
  document.getElementById('dialogueIconEl').textContent = meta.icon;
  document.getElementById('dialogueIconEl').style.color = color;
  bot.setAttribute('data-mood', mood);
  triggerFx(mood);

  var html = '<strong>' + landmark.moveNumber + '. ' + landmark.moveNotation + '</strong><br><span style="color:' + color + '">[' + cat + ']</span> ' + landmark.commentary;
  var el = document.getElementById('dialogueText');
  var plain = 'Landmark ' + cat + ': ' + landmark.moveNumber + '. ' + landmark.moveNotation + '. ' + landmark.commentary.replace(/<[^>]+>/g, '');
  speakText(plain);

  if (typeTimer) clearInterval(typeTimer);
  el.innerHTML = html;
  el.classList.remove('typing');

  // Show "Why this is a mistake" button for bad landmarks
  var isBad = (cat === 'Blunder' || cat === 'Mistake' || cat === 'Miss');
  var lmMoveIdx = navIdx >= 0 ? navIdx : -1;
  var lmMoveData = lmMoveIdx >= 0 ? moveHistory[lmMoveIdx] : null;
  var pvAfter = lmMoveData ? (lmMoveData.pvAfter || null) : null;
  var fenAfter = lmMoveData ? (lmMoveData.fenAfter || null) : null;
  window._lastPv = isBad && pvAfter ? pvAfter : null;
  window._lastFen = isBad && fenAfter ? fenAfter : null;
  var whyBtn = document.getElementById('whyMistakeBtn');
  if (whyBtn) {
    whyBtn.style.display = isBad && pvAfter ? 'inline-block' : 'none';
    document.getElementById('refutationDisplay').innerHTML = '';
  }
  var stopBtn = document.getElementById('refStopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
}

function showTakeaway() {
  setEngineStatus('ready');
  if (!reviewData) return;

  coachReset('Review complete!<br><br><strong>Final Takeaway:</strong> ' + reviewData.takeaway);
  speakText('Review complete. ' + reviewData.takeaway);
}

function jumpToLandmark(landmarkIdx) {
  if (!reviewData) return;
  if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null; }
  var landmark = reviewData.landmarks[landmarkIdx];
  if (!landmark) return;
  var targetMoveIdx = -1;
  for (var i = 0; i < reviewData.allMoves.length; i++) {
    var m = reviewData.allMoves[i];
    var mn = Math.floor(i / 2) + 1;
    var color = i % 2 === 0 ? 'White' : 'Black';
    if (mn === landmark.moveNumber && color === landmark.color && m.san === landmark.moveNotation) { targetMoveIdx = i; break; }
  }
  if (targetMoveIdx < 0) return;
  game = new Chess();
  for (var j = 0; j <= targetMoveIdx; j++) { game.move(reviewData.allMoves[j]); }
  updateBoard();
  cg.set({ lastMove: [reviewData.allMoves[targetMoveIdx].from, reviewData.allMoves[targetMoveIdx].to], check: game.in_check() ? game.turn() : false });
  navIdx = targetMoveIdx;
  updateNavDisplay();
  reviewData.currentLandmark = landmarkIdx;
  showLandmark(landmark);
}

function updateLandmarkCounter() {
  if (!reviewData) return;
  var total = reviewData.landmarks.length;
  var current = reviewData.currentLandmark;
  var prevBtn = document.getElementById('prevLandmarkBtn');
  var nextBtn = document.getElementById('nextLandmarkBtn');
  prevBtn.disabled = current <= 0;
  nextBtn.disabled = current >= total - 1;
}

function cancelReview() {
  if (playbackTimer) clearTimeout(playbackTimer);
  playbackCancelled = true;
  document.getElementById('landmarkNavRow').style.display = 'none';
  currentMode = 'interactive';
  reviewPhase = 'navigate';
  branches = [];
  branchState.mode = 'mainline';
  branchState.activeBranchId = null;
  deletedBranches = [];
  var ub = document.getElementById('undoDeleteBtn');
  if (ub) ub.style.display = 'none';
}

function endReview() {
  cancelReview();
  coachReset('Review ended. You can play from the final position or start a new review.');
}

// ═══════════════════════════════════════════════════════
// MAIA3 COACH ENGINE (Play vs Coach)
// ═══════════════════════════════════════════════════════

var maiaSession = null;
var maiaReady = false;
var maiaMode = false;
var maiaHistory = [];
var MAIA_HISTORY_LEN = 8;
var MAIA_MOVE_VOCAB_SIZE = 4352;
var maiaUciFromIdx = new Array(MAIA_MOVE_VOCAB_SIZE);
var maiaUciToIdx = {};

var MAIA_WHITE_TOK = {p:0,n:1,b:2,r:3,q:4,k:5};
var MAIA_BLACK_TOK = {p:6,n:7,b:8,r:9,q:10,k:11};
var MAIA_PROMO_PIECES = ['q','r','b','n'];

function buildMaiaMoveVocab() {
  var files = 'abcdefgh';
  for (var i = 0; i < 4096; i++) {
    var srcSq = i >> 6;
    var dstSq = i & 63;
    var uci = files[srcSq & 7] + ((srcSq >> 3) + 1) + files[dstSq & 7] + ((dstSq >> 3) + 1);
    maiaUciFromIdx[i] = uci;
    maiaUciToIdx[uci] = i;
  }
  for (var pi = 0; pi < 256; pi++) {
    var idx = 4096 + pi;
    var fromFile = pi >> 5;
    var toFile = (pi >> 2) & 7;
    var promoPiece = pi & 3;
    var uci = files[fromFile] + '7' + files[toFile] + '8' + MAIA_PROMO_PIECES[promoPiece];
    maiaUciFromIdx[idx] = uci;
    maiaUciToIdx[uci] = idx;
  }
}

function mirrorFen(fen) {
  var parts = fen.split(' ');
  var ranks = parts[0].split('/');
  for (var r = 0; r < 8; r++) {
    var row = ranks[r];
    var newRow = '';
    for (var c = 0; c < row.length; c++) {
      var ch = row[c];
      if (ch >= 'A' && ch <= 'Z') newRow += ch.toLowerCase();
      else if (ch >= 'a' && ch <= 'z') newRow += ch.toUpperCase();
      else newRow += ch;
    }
    ranks[r] = newRow;
  }
  ranks.reverse();
  parts[0] = ranks.join('/');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  if (parts[3] !== '-') {
    var epRank = parts[3][1];
    parts[3] = parts[3][0] + (epRank === '3' ? '6' : '3');
  }
  return parts.join(' ');
}

function tokenizeBoard(game) {
  var isWhite = game.turn() === 'w';
  var workGame = isWhite ? game : new Chess(mirrorFen(game.fen()));
  var tokens = new Float32Array(64 * 12);
  var board = workGame.board();
  for (var row = 0; row < 8; row++) {
    for (var file = 0; file < 8; file++) {
      var sq = (7 - row) * 8 + file;
      var piece = board[row][file];
      if (piece) {
        var tok = piece.color === 'w' ? MAIA_WHITE_TOK[piece.type] : MAIA_BLACK_TOK[piece.type];
        tokens[sq * 12 + tok] = 1;
      }
    }
  }
  return tokens;
}

function buildMaiaInputTensor() {
  var numPads = Math.max(0, MAIA_HISTORY_LEN - maiaHistory.length);
  var width = 12 * MAIA_HISTORY_LEN + 1;
  var tensor = new Float32Array(64 * width);
  for (var h = 0; h < MAIA_HISTORY_LEN; h++) {
    var histIdx = h < numPads ? 0 : h - numPads;
    var src = maiaHistory[histIdx];
    if (!src) continue;
    for (var sq = 0; sq < 64; sq++) {
      var dstOff = sq * width + h * 12;
      var srcOff = sq * 12;
      for (var t = 0; t < 12; t++) {
        tensor[dstOff + t] = src[srcOff + t];
      }
    }
  }
  return tensor;
}

function mirrorSq(sq) {
  return sq[0] + (9 - parseInt(sq[1]));
}

function mirrorUci(uci) {
  if (uci.length === 4) return mirrorSq(uci.slice(0,2)) + mirrorSq(uci.slice(2,4));
  return mirrorSq(uci.slice(0,2)) + mirrorSq(uci.slice(2,4)) + uci[4];
}

function eloToTemp(rating) {
  var r = parseInt(rating, 10);
  if (r <= 1000) return 3.0;
  if (r <= 1200) return 2.0;
  if (r <= 1400) return 1.5;
  if (r <= 1600) return 1.2;
  if (r <= 1800) return 1.0;
  if (r <= 2000) return 0.8;
  if (r <= 2200) return 0.6;
  return 0.4;
}

function sampleFromLogits(maskedLogits, temperature) {
  if (temperature <= 0) {
    var maxIdx = 0, maxVal = maskedLogits[0];
    for (var i = 1; i < maskedLogits.length; i++) {
      if (maskedLogits[i] > maxVal) { maxVal = maskedLogits[i]; maxIdx = i; }
    }
    return maxIdx;
  }
  var maxL = -Infinity;
  for (var i = 0; i < maskedLogits.length; i++) {
    if (maskedLogits[i] > maxL) maxL = maskedLogits[i];
  }
  var sum = 0;
  var vals = new Float64Array(maskedLogits.length);
  for (var i = 0; i < maskedLogits.length; i++) {
    vals[i] = Math.exp((maskedLogits[i] - maxL) / temperature);
    sum += vals[i];
  }
  var r = Math.random() * sum;
  for (var i = 0; i < vals.length; i++) {
    r -= vals[i];
    if (r <= 0) return i;
  }
  return vals.length - 1;
}

function tryParseUciMove(game, uci) {
  try {
    var from = uci.slice(0,2);
    var to = uci.slice(2,4);
    var promo = uci.length > 4 ? uci[4] : undefined;
    var result = game.move({ from: from, to: to, promotion: promo || 'q' });
    return result;
  } catch(e) { return null; }
}

async function initMaiaSession() {
  if (typeof ort === 'undefined') {
    coachReset('onnxruntime not loaded yet — cannot start Maia engine.');
    return;
  }
  try {
    buildMaiaMoveVocab();
    coachProgress('Loading Maia AI model...');
    maiaSession = await ort.InferenceSession.create('maia3.onnx');
    maiaReady = true;
    coachProgress('Maia AI engine loaded!');
  } catch (e) {
    console.error('Maia init failed:', e);
    coachReset('Maia AI failed to load: ' + e.message);
    maiaReady = false;
  }
}

async function getMaiaMove(chessGame, rating) {
  if (!maiaReady || !maiaSession) return null;
  var tokens = tokenizeBoard(chessGame);
  maiaHistory.push(tokens);
  if (maiaHistory.length > MAIA_HISTORY_LEN) maiaHistory.shift();
  var inputTensor = buildMaiaInputTensor();
  var elo = parseInt(rating, 10);
  try {
    var feeds = {
      tokens: new ort.Tensor('float32', inputTensor, [1, 64, 97]),
      self_elo: new ort.Tensor('int64', [BigInt(elo)], [1]),
      oppo_elo: new ort.Tensor('int64', [BigInt(elo)], [1]),
    };
    var results = await maiaSession.run(feeds);
    var logits = results.logits_move.data;
    var isBlack = chessGame.turn() === 'b';
    var legalMoves = chessGame.moves({ verbose: true });
    var masked = new Float64Array(MAIA_MOVE_VOCAB_SIZE);
    for (var i = 0; i < MAIA_MOVE_VOCAB_SIZE; i++) masked[i] = -1e30;
    for (var m = 0; m < legalMoves.length; m++) {
      var mv = legalMoves[m];
      var uci = mv.from + mv.to;
      if (mv.promotion) uci += mv.promotion;
      var vocabUci = isBlack ? mirrorUci(uci) : uci;
      var idx = maiaUciToIdx[vocabUci];
      if (idx !== undefined) masked[idx] = logits[idx];
    }
    var temp = eloToTemp(rating);
    var chosen = sampleFromLogits(masked, temp);
    var predUci = maiaUciFromIdx[chosen];
    if (isBlack) predUci = mirrorUci(predUci);
    var topMoves = getMaiaTopMoves(masked, legalMoves, isBlack, temp, 3);
    return { move: predUci, topMoves: topMoves };
  } catch (e) {
    console.error('Maia inference failed:', e);
    return null;
  }
}

function getMaiaTopMoves(maskedLogits, legalMoves, isBlack, temperature, count) {
  var maxL = -Infinity;
  for (var i = 0; i < maskedLogits.length; i++) {
    if (maskedLogits[i] > maxL) maxL = maskedLogits[i];
  }
  var sum = 0;
  var probs = [];
  for (var i = 0; i < maskedLogits.length; i++) {
    var p = Math.exp((maskedLogits[i] - maxL) / temperature);
    sum += p;
    probs.push(p);
  }
  var indexed = [];
  for (var i = 0; i < probs.length; i++) {
    if (maskedLogits[i] > -1e20) {
      var uci = maiaUciFromIdx[i];
      if (isBlack) uci = mirrorUci(uci);
      indexed.push({ idx: i, uci: uci, prob: probs[i] / sum });
    }
  }
  indexed.sort(function(a, b) { return b.prob - a.prob; });
  var top = [];
  var moveMap = {};
  for (var i = 0; i < indexed.length && top.length < count; i++) {
    var uci = indexed[i].uci;
    if (!moveMap[uci]) {
      moveMap[uci] = true;
      top.push({ uci: uci, prob: indexed[i].prob });
    }
  }
  return top;
}

function startMaiaGame() {
  game = new Chess();
  moveHistory = [];
  graphMoves.length = 0;
  prevEval = null;
  maiaHistory = [];
  navIdx = -1;
  updateBoard();
  updateEvalDisplay(0);
  renderHistory();
  drawGraph();
  document.getElementById('explorerContent').parentElement.classList.add('explorer-hidden');
  document.getElementById('navBar').style.display = 'none';
  document.getElementById('pgnInput').value = '';
  document.getElementById('fenInput').value = '';
  document.getElementById('maiaDelayRow').style.display = '';
  document.getElementById('explorerToggleBtn').style.display = '';
  coachReset('Play vs Coach started. Make your move.');
}

function classifyAndPushMove(from, to, san, uci, fenBefore, fenAfter, beforeLine, afterLine, isWhiteAfter) {
  var beforeCp = beforeLine ? (beforeLine.cp || 0) : 0;
  var afterCp = afterLine ? (afterLine.cp || 0) : 0;
  var evBefore = (isWhiteAfter ? -beforeCp : beforeCp) / 100;
  var evAfter = (isWhiteAfter ? -afterCp : afterCp) / 100;
  var swing = Math.abs(evAfter - evBefore);
  var cls = classifyMove(beforeLine, null, afterLine, uci, new Chess(fenBefore));
   moveHistory.push({ san: san, classification: cls, evalBefore: evBefore, evalAfter: evAfter, fenBefore: fenBefore, fenAfter: fenAfter, bestUci: beforeLine ? beforeLine.move : null });
  var graphEval = isWhiteAfter ? -evAfter : evAfter;
  graphMoves.push({ eval: graphEval, classification: cls, moveSan: san, ply: moveHistory.length });
  return { cls: cls, evBefore: evBefore, evAfter: evAfter, swing: swing };
}

function evalPosition(fen, depth, cb) {
  analysisPool.evaluate(fen, depth, function(lines) {
    cb(parseLines(lines)[0] || null);
  });
}

function onMaiaUserMove(from, to) {
  // If navigated back, truncate history — new move becomes the latest
  if (navIdx < moveHistory.length - 1) {
    moveHistory = moveHistory.slice(0, navIdx + 1);
    graphMoves = graphMoves.slice(0, navIdx + 1);
    maiaHistory = [];
    prevEval = null;
    navIdx = -1;
  }
  var result = game.move({ from: from, to: to, promotion: 'q' });
  if (!result) return;
  var san = result.san, uci = from + to;
  var fenAfter = game.fen();
  updateBoard();
  cg.set({ lastMove: [from, to], check: game.in_check() ? game.turn() : false });
  if (game.game_over()) {
    finishMaiaGame('Checkmate! You won!', san, uci, '');
    return;
  }
  isAnalysing = true;
  var depth = Math.min(parseInt(document.getElementById('depthSlider').value, 10), 12);
  var rating = document.getElementById('ratingSelect').value;
  var fenBefore = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].fenAfter : new Chess().fen();

  function afterUserEval(afterLine) {
    var isBlackTurn = game.turn() === 'b';
    var rawCp = afterLine ? afterLine.cp || 0 : 0;
    if (!prevEval) {
      evalPosition(fenBefore, depth, function(beforeLine) {
        var r = classifyAndPushMove(from, to, san, uci, fenBefore, fenAfter, beforeLine, afterLine, isBlackTurn);
        updateEvalDisplay(isBlackTurn ? -rawCp : rawCp);
        renderHistory();
        drawGraph();
        updateCoach({ classification: r.cls, currentEval: r.evAfter, evalSwing: r.swing, moveSan: san, isWhiteToMove: !isBlackTurn });
        prevEval = afterLine;
        doMaiaResponse(depth, rating);
      });
    } else {
      var r = classifyAndPushMove(from, to, san, uci, fenBefore, fenAfter, prevEval, afterLine, isBlackTurn);
      updateEvalDisplay(isBlackTurn ? -rawCp : rawCp);
      renderHistory();
      drawGraph();
      updateCoach({ classification: r.cls, currentEval: r.evAfter, evalSwing: r.swing, moveSan: san, isWhiteToMove: !isBlackTurn });
      prevEval = afterLine;
      doMaiaResponse(depth, rating);
    }
  }

  evalPosition(fenAfter, depth, afterUserEval);
}

function doMaiaResponse(depth, rating) {
  setEngineStatus('maia');
  coachProgress('Maia is thinking...');
  getMaiaMove(game, rating).then(function(result) {
    if (!result) {
      isAnalysing = false;
      setEngineStatus('ready');
      coachReset('Maia could not find a move.');
      return;
    }
    var predUci = result.move;
    var topMoves = result.topMoves;
    var delay = parseInt(document.getElementById('maiaDelaySlider').value, 10);
    setTimeout(function() {
      var fenBefore = game.fen();
      var mr = tryParseUciMove(game, predUci);
      if (!mr) {
        isAnalysing = false;
        setEngineStatus('ready');
        coachReset('Maia returned an illegal move: ' + predUci);
        return;
      }
      var maiaUci = mr.from + mr.to + (mr.promotion || '');
      var fenAfter = game.fen();
      maiaHistory.push(tokenizeBoard(game));
      if (maiaHistory.length > MAIA_HISTORY_LEN) maiaHistory.shift();
      updateBoard();
      cg.set({ lastMove: [mr.from, mr.to], check: game.in_check() ? game.turn() : false });
      navIdx = moveHistory.length;
      updateNavDisplay();

      if (game.game_over()) {
        finishMaiaGame('Maia wins! Checkmate.', mr.san, maiaUci, fenAfter);
        return;
      }

      // Evaluate Maia's move quality
      evalPosition(fenAfter, depth, function(afterLine) {
        var isBlackTurn = game.turn() === 'b';
        var rawCp = afterLine ? afterLine.cp || 0 : 0;
        var r = classifyAndPushMove(mr.from, mr.to, mr.san, maiaUci, fenBefore, fenAfter, prevEval, afterLine, isBlackTurn);
        updateEvalDisplay(isBlackTurn ? -rawCp : rawCp);
        renderHistory();
        drawGraph();

        // Build dual feedback message
        var stockfishMove = null;
        if (prevEval && prevEval.move) {
          var tmpGame = new Chess(fenBefore);
          var sfMr = tmpGame.move({ from: prevEval.move.slice(0,2), to: prevEval.move.slice(2,4), promotion: 'q' });
          stockfishMove = sfMr ? sfMr.san : prevEval.move;
        }
        var sfEval = prevEval ? ((prevEval.cp || 0) / 100).toFixed(2) : null;
        var sfEvalStr = sfEval ? (sfEval > 0 ? '+' : '') + sfEval : '';
        var maiaTopHtml = '';
        for (var t = 0; t < topMoves.length; t++) {
          var tmpGame2 = new Chess(fenBefore);
          var tmMr = tmpGame2.move({ from: topMoves[t].uci.slice(0,2), to: topMoves[t].uci.slice(2,4), promotion: topMoves[t].uci.length > 4 ? topMoves[t].uci[4] : 'q' });
          var tmSan = tmMr ? tmMr.san : topMoves[t].uci;
          maiaTopHtml += '<span class="accent">' + tmSan + '</span> ' + (topMoves[t].prob * 100).toFixed(0) + '%' + (t < topMoves.length - 1 ? ' &middot; ' : '');
        }
        var msg = 'Maia played <span class="accent">' + mr.san + '</span>.';
        if (prevEval && prevEval.move) {
          if (prevEval.move === predUci) {
            msg += ' That was also Stockfish\'s top choice (' + sfEvalStr + ').';
          } else if (stockfishMove && sfEvalStr) {
            msg += ' Stockfish preferred <span class="stockfish-preview accent" data-sf-uci="' + prevEval.move + '" data-sf-fen="' + fenBefore + '">' + stockfishMove + '</span> (' + sfEvalStr + ').';
          }
        }
        msg += ' Maia was choosing among: ' + maiaTopHtml;

        updateCoach({ classification: r.cls, currentEval: r.evAfter, evalSwing: r.swing, moveSan: mr.san, isWhiteToMove: !isBlackTurn, customMsg: msg });
        prevEval = afterLine;
        isAnalysing = false;
        setEngineStatus('ready');
      });
    }, delay);
  });
}

function finishMaiaGame(msg, lastSan, lastUci, lastFen) {
  isAnalysing = false;
  setEngineStatus('ready');
  var pgn = game.pgn();
  document.getElementById('pgnInput').value = pgn;
  coachReset(msg + ' Your game PGN is ready above. Click <strong>Review Game</strong> to analyze it.');
  stopMaiaMode();
}

function stopMaiaMode() {
  maiaMode = false;
  maiaHistory = [];
  document.getElementById('coachPlayBtn').classList.remove('active-coach');
  document.getElementById('explorerContent').parentElement.classList.remove('explorer-hidden');
  document.getElementById('maiaDelayRow').style.display = 'none';
  document.getElementById('explorerToggleBtn').style.display = 'none';
  if (moveHistory.length > 0 && !document.getElementById('pgnInput').value.trim()) {
    var t = new Chess();
    moveHistory.forEach(function(m) { t.move(m.san); });
    document.getElementById('pgnInput').value = t.pgn();
  }
}

// ═══════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════
document.getElementById('positionBtn').addEventListener('click', function() {
  if (maiaMode) stopMaiaMode();
  cancelReview();
  clearMistakeUI();
  var fen = document.getElementById('fenInput').value.trim();
  if (!fen) return;
  var test = new Chess();
  if (!test.load(fen)) { coachReset('Invalid FEN — please check and try again.'); return; }
  game = test;
  moveHistory = [];
  graphMoves.length = 0;
  prevEval = null;
  renderHistory();
  drawGraph();
  updateEvalDisplay(0);
  updateBoard();
  updateExplorer();

  // Fetch opening info
  fetchOpening(fen, document.getElementById('ratingSelect').value).then(function(opening) {
    if (opening) {
      coachReset('Position loaded: ' + opening.openingName + ' (' + opening.ecoCode + '). Stockfish is analysing...');
    } else {
      coachReset('Position loaded. Analysing with Stockfish...');
    }
  });

  // Queue analysis immediately (pool handles wait if engine not ready)
  setEngineStatus('thinking');
  var depth = parseInt(document.getElementById('depthSlider').value, 10);
  analysisPool.evaluate(fen, depth, function(lines) {
    setEngineStatus('ready');
    var parsed = parseLines(lines);
    var top = parsed[0];
    if (!top) return;
    prevEval = top;
    var cp = top.cp || 0;
    updateEvalDisplay(cp);
    var evStr = (cp / 100).toFixed(2);
    var bestMoveSan = null;
    if (top.move) {
      var tempGame = new Chess(fen);
      var mr = tempGame.move({ from: top.move.slice(0, 2), to: top.move.slice(2, 4), promotion: 'q' });
      bestMoveSan = mr ? mr.san : top.move;
    }
    if (bestMoveSan) {
      coachProgress('Eval: ' + (cp > 0 ? '+' : '') + evStr + ' &middot; Best: ' + bestMoveSan);
    } else {
      coachProgress('Eval: ' + (cp > 0 ? '+' : '') + evStr);
    }
    navIdx = -1;
    updateNavDisplay();
  });
});

document.getElementById('reviewBtn').addEventListener('click', function() {
  if (maiaMode) stopMaiaMode();
  if (isAnalysing) { coachReset('Already analysing. Please wait.'); return; }
  if (!engineReady) { coachReset('Engine still loading. Please wait.'); return; }
  var pgnInput = document.getElementById('pgnInput');
  if (!pgnInput.value.trim() && moveHistory.length > 0) {
    var t = new Chess();
    for (var mi = 0; mi < moveHistory.length; mi++) {
      try { t.move(moveHistory[mi].san); } catch(e) {}
    }
    pgnInput.value = t.pgn();
  }
  runGameReview();
});

document.getElementById('clearBtn').addEventListener('click', function() {
  if (maiaMode) stopMaiaMode();
  cancelReview();
  clearMistakeUI();
  document.getElementById('pgnInput').value = '';
  game = new Chess();
  moveHistory = [];
  graphMoves.length = 0;
  prevEval = null;
  renderHistory();
  drawGraph();
  updateEvalDisplay(0);
  document.getElementById('fenInput').value = '';
  updateBoard();
  updateExplorer();
  coachReset('Board cleared. Make a move or paste a PGN to review a game.');
  navIdx = -1;
  updateNavDisplay();
});

document.getElementById('prevMoveBtn').addEventListener('click', function() {
  if (navIdx > -1) { goToMove(navIdx - 1); }
});

document.getElementById('nextMoveBtn').addEventListener('click', function() {
  if (navIdx < moveHistory.length - 1) { goToMove(navIdx + 1); }
});
document.getElementById('nextLandmarkBtn').addEventListener('click', function() {
  if (!reviewData) return;
  if (playbackTimer) clearTimeout(playbackTimer);
  playbackTimer = null;
  playbackCancelled = false;
  advanceToLandmark(reviewData.currentLandmark + 1);
});
document.getElementById('prevLandmarkBtn').addEventListener('click', function() {
  console.log('prevLandmarkBtn clicked', { reviewData: !!reviewData, playbackTimer: !!playbackTimer, currentPly: game.history().length, landmarks: reviewData ? reviewData.landmarks.length : null });
  if (!reviewData) return;
  if (playbackTimer) clearTimeout(playbackTimer);
  playbackTimer = null;
  playbackCancelled = false;
  var currentPly = game.history().length;
  var bestIdx = -1, bestMoveIdx = -1;
  for (var li = 0; li < reviewData.landmarks.length; li++) {
    var lm = reviewData.landmarks[li];
    var lmMoveIdx = -1;
    for (var mi = 0; mi < reviewData.allMoves.length; mi++) {
      var m = reviewData.allMoves[mi];
      var mn = Math.floor(mi / 2) + 1;
      var color = mi % 2 === 0 ? 'White' : 'Black';
      if (mn === lm.moveNumber && color === lm.color && m.san === lm.moveNotation) { lmMoveIdx = mi; break; }
    }
    if (lmMoveIdx >= 0 && lmMoveIdx < currentPly - 1 && lmMoveIdx > bestMoveIdx) { bestMoveIdx = lmMoveIdx; bestIdx = li; }
  }
  if (bestIdx < 0) return;
  jumpToLandmark(bestIdx);
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft') {
    document.getElementById('prevMoveBtn').click();
  } else if (e.key === 'ArrowRight') {
    document.getElementById('nextMoveBtn').click();
  }
});

// ── Undo Delete Branch ──
document.getElementById('undoDeleteBtn').addEventListener('click', function() {
  if (!isAnalysing) undoDeleteBranch();
});

// ── Flip Board ──
document.getElementById('flipBtn').addEventListener('click', function() {
  cg.toggleOrientation();
});

// ── Explorer Toggle (Maia mode) ──
document.getElementById('explorerToggleBtn').addEventListener('click', function() {
  var parent = document.getElementById('explorerContent').parentElement;
  parent.classList.toggle('explorer-hidden');
  this.textContent = parent.classList.contains('explorer-hidden') ? '\u25B6' : '\u25BC';
});

// ── Play vs Coach (Maia AI) ──
document.getElementById('coachPlayBtn').addEventListener('click', function() {
  if (!maiaReady) {
    if (typeof ort === 'undefined') {
      coachReset('onnxruntime-web not loaded yet. Please wait or check the console.');
      return;
    }
    initMaiaSession();
    coachReset('Loading Maia AI model (first time). Please wait...');
    return;
  }
  maiaMode = !maiaMode;
  if (maiaMode) {
    this.classList.add('active-coach');
    startMaiaGame();
    // If user is black, Maia plays as white first
    if (game.turn() === 'b') {
      isAnalysing = true;
      setEngineStatus('maia');
      coachProgress('Maia is thinking...');
      var rating = document.getElementById('ratingSelect').value;
      getMaiaMove(game, rating).then(function(result) {
        if (!result) { isAnalysing = false; setEngineStatus('ready'); return; }
        var delay = parseInt(document.getElementById('maiaDelaySlider').value, 10);
        setTimeout(function() {
          var mr = tryParseUciMove(game, result.move);
          if (mr) {
            updateBoard();
            cg.set({ lastMove: [mr.from, mr.to], check: game.in_check() ? game.turn() : false });
            coachProgress('Maia played ' + mr.san + ' (White). Your turn.');
          }
          isAnalysing = false;
          setEngineStatus('ready');
        }, delay);
      });
    }
  } else {
    stopMaiaMode();
    coachReset('Play vs Coach ended.');
  }
});

// ── Suggest Best Move ──
document.getElementById('suggestBtn').addEventListener('click', suggestBestMove);

// ── TTS Toggle ──
document.getElementById('ttsToggle').addEventListener('click', function() {
  ttsEnabled = !ttsEnabled;
  this.textContent = ttsEnabled ? '\uD83D\uDD0A Voice: ON' : '\uD83D\uDD07 Voice: OFF';
  this.classList.toggle('tts-on', ttsEnabled);
  if (!ttsEnabled) {
    if (_synth) _synth.cancel();
    if (ttsAudio) { ttsAudio.pause();
      ttsAudio = null; }
  } else {
    speakText('Voice enabled. Good luck!');
  }
});

// ── Rating Select ──
document.getElementById('ratingSelect').addEventListener('change', function() {
  saveRatingPref(this.value);
  _lastExplorerFen = '';
  updateExplorer();
});

// ── API Token ──
document.getElementById('tokenSaveBtn').addEventListener('click', function() {
  saveApiToken(document.getElementById('apiToken').value.trim());
  updateExplorer();
});
document.getElementById('apiToken').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('tokenSaveBtn').click();
});

// ── FEN input enter key ──
document.getElementById('fenInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('positionBtn').click();
});

// ── PGN input paste shortcut ──
document.getElementById('pgnInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.ctrlKey) document.getElementById('reviewBtn').click();
});

// Restore saved chess.com username
(function() {
  var saved = localStorage.getItem('chessCoach.chessUser');
  if (saved) document.getElementById('chessUserInput').value = saved;
})();

// ── Chess.com Sync ──
var _cachedGames = [];
var _syncPage = 0;
var _syncPerPage = 6;

function buildGameItem(g) {
  var pgn = g.pgn;
  var lines = pgn.split('\n');
  var dateTag = '', whiteTag = '', blackTag = '', resultTag = '', ecoTag = '', openingTag = '';
  lines.forEach(function(l) {
    if (l.startsWith('[Date ')) dateTag = l.replace('[Date "', '').replace('"]', '').trim();
    if (l.startsWith('[White ')) whiteTag = l.replace('[White "', '').replace('"]', '').trim();
    if (l.startsWith('[Black ')) blackTag = l.replace('[Black "', '').replace('"]', '').trim();
    if (l.startsWith('[Result ')) resultTag = l.replace('[Result "', '').replace('"]', '').trim();
    if (l.startsWith('[ECO ')) ecoTag = l.replace('[ECO "', '').replace('"]', '').trim();
    if (l.startsWith('[Opening ')) openingTag = l.replace('[Opening "', '').replace('"]', '').trim();
  });
  var timeClass = g.time_class || 'standard';
  var isUserWhite = whiteTag.toLowerCase() === document.getElementById('chessUserInput').value.trim().toLowerCase();
  var opp = isUserWhite ? blackTag : whiteTag;
  var displayResult = resultTag;
  var resultClass = '';
  if (resultTag === '1-0') { displayResult = isUserWhite ? '1-0' : '0-1'; resultClass = isUserWhite ? 'win' : 'lose'; }
  else if (resultTag === '0-1') { displayResult = isUserWhite ? '0-1' : '1-0'; resultClass = isUserWhite ? 'lose' : 'win'; }
  else if (resultTag === '1/2-1/2') { displayResult = '\u00BD-\u00BD'; resultClass = 'draw'; }
  var label = openingTag || (ecoTag ? ecoTag : '\u2022');
  var item = document.createElement('div');
  item.className = 'sync-game-item';
  item.innerHTML = '<span class="g-opp">' + opp + '</span><span class="g-result ' + resultClass + '">' + displayResult + '</span><span class="g-meta">' + timeClass + ' ' + dateTag + '</span>';
  item.title = label + ' vs ' + opp;
  item.addEventListener('click', function() {
    document.getElementById('pgnInput').value = pgn;
    document.getElementById('reviewBtn').click();
  });
  return item;
}

function renderSyncGames(games) {
  var list = document.getElementById('syncGameList');
  list.innerHTML = '';
  if (!games || games.length === 0) {
    list.innerHTML = '<div style="color:var(--text-mute);padding:8px 0;text-align:center">No games found</div>';
    return;
  }
  var totalPages = Math.ceil(games.length / _syncPerPage);
  if (_syncPage >= totalPages) _syncPage = totalPages - 1;
  if (_syncPage < 0) _syncPage = 0;
  var start = _syncPage * _syncPerPage;
  var pageGames = games.slice(start, start + _syncPerPage);
  pageGames.forEach(function(g) { list.appendChild(buildGameItem(g)); });
  // Page nav
  var nav = document.createElement('div');
  nav.className = 'sync-pages';
  nav.innerHTML = '<button class="btn-sm" ' + (_syncPage <= 0 ? 'disabled' : '') + ' id="syncPrevBtn">&#9664; Prev</button>' +
    '<span class="sync-page-num">' + (_syncPage + 1) + '/' + totalPages + '</span>' +
    '<button class="btn-sm" ' + (_syncPage >= totalPages - 1 ? 'disabled' : '') + ' id="syncNextBtn">Next &#9654;</button>';
  list.appendChild(nav);
  document.getElementById('syncPrevBtn').addEventListener('click', function() {
    if (_syncPage > 0) { _syncPage--; renderSyncGames(games); }
  });
  document.getElementById('syncNextBtn').addEventListener('click', function() {
    if (_syncPage < totalPages - 1) { _syncPage++; renderSyncGames(games); }
  });
}

function doSync() {
  var username = document.getElementById('chessUserInput').value.trim();
  if (!username) { document.getElementById('syncStatus').textContent = 'Enter a username'; return; }
  try { localStorage.setItem('chessCoach.chessUser', username); } catch(e) {}
  _syncPage = 0;
  document.getElementById('syncStatus').textContent = 'Fetching archives...';
  document.getElementById('syncGameList').innerHTML = '';
  var listUrl = 'https://api.chess.com/pub/player/' + encodeURIComponent(username) + '/games/archives';
  fetch(listUrl, { headers: { 'User-Agent': 'chess-coach-app/1.0' } })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      if (!data.archives || data.archives.length === 0) throw new Error('No archives found');
      var allGames = [];
      var idx = 0;
      function fetchNext() {
        if (idx >= data.archives.length) {
          _cachedGames = allGames.reverse();
          document.getElementById('syncStatus').textContent = allGames.length + ' total game' + (allGames.length !== 1 ? 's' : '');
          renderSyncGames(allGames);
          return;
        }
        var url = data.archives[idx];
        document.getElementById('syncStatus').textContent = 'Fetching ' + url.slice(-7) + ' (' + (idx + 1) + '/' + data.archives.length + ')...';
        fetch(url, { headers: { 'User-Agent': 'chess-coach-app/1.0' } })
          .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function(d) {
            var gs = d.games || [];
            allGames = allGames.concat(gs);
            idx++;
            fetchNext();
          })
          .catch(function(err) { document.getElementById('syncStatus').textContent = 'Error: ' + err.message; });
      }
      fetchNext();
    })
    .catch(function(err) {
      document.getElementById('syncStatus').textContent = 'Error: ' + err.message;
    });
}

document.getElementById('syncBtn').addEventListener('click', doSync);
document.getElementById('chessUserInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doSync();
});



// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
// Restore rating pref
var savedRating = loadRatingPref();
document.getElementById('ratingSelect').value = savedRating;

// Fallback: populate input from localStorage (if .env fetch already set it, this is a no-op)
if (!document.getElementById('apiToken').value) {
  document.getElementById('apiToken').value = loadApiToken();
}

initEngine();
initBoard();
coachReset('Ready when you are. Make a move or paste a PGN to review a game.');

// Lazy-init Maia AI (give engine time to load first)
setTimeout(function() {
  if (typeof ort !== 'undefined') initMaiaSession();
}, 1000);

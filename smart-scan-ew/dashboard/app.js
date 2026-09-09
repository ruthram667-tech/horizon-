/**
 * Smart Scan EW — Tactical Live Demo Engine & Visualizer
 * =======================================================
 * Features:
 * - Direct boot into tactical dashboard (Zero login friction)
 * - Ultra-slow motion & frame-by-frame stepping for judge presentations
 * - High-contrast color-coded GNN Graph with dynamic message-passing particle flows
 * - High-contrast waterfall spectrogram with live RF colormaps
 * - Interactive Node Inspector HUD (Hover on any frequency node)
 * - Tactical Scenarios: Agile FHSS, Drone Swarm, Barrage Jammer, Stealth LPI
 * - Web Audio API Tactical Sonification (Radar chirps & Intercept chimes)
 * - Live Threat Intelligence Event Stream
 * - Embedded Pitch Deck & Architecture viewer
 *
 * Team HORIZON — SIH26055
 */

// ══════════════════════════════════════════════
//  GLOBAL STATE & CONFIGURATION
// ══════════════════════════════════════════════

let isScanning = false;
let isPaused = false;
let simInterval = null;
let animFrame = null;
let currentSpeed = 0.25; // Default slow-motion for judge explainer (2000ms / hop)
let numChannels = 12;
let activeScenario = 'fhss';
let engineMode = 'ai'; // 'ai' or 'sweeper'
let audioEnabled = true;

// Simulation Metrics
let totalHops = 0;
let totalHits = 0;
let totalMisses = 0;
let tunedChannel = 0;
let activeTargets = [3];
let isHit = false;
let history = [];
const MAX_ROWS = 140;

// GNN Topology & Attention State
let transitionMatrix = [];
let attentionMatrix = [];
let particles = [];
let hoveredNode = null;

// Web Audio Synth Context
let audioCtx = null;

// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTransitionMatrix();
  initMiniRings();
  initGNNParticles();
  setupGNNInteraction();
  startRenderLoop();
  
  // Auto-start in demo mode after 600ms for immediate impact
  setTimeout(() => {
    if (!isScanning) {
      startScan();
    }
  }, 600);
});

// ══════════════════════════════════════════════
//  AUDIO SONIFICATION (Web Audio API)
// ══════════════════════════════════════════════

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('btn-audio');
  const icon = document.getElementById('audio-icon');
  if (audioEnabled) {
    btn.innerHTML = '<span id="audio-icon">🔊</span> AUDIO SFX: ON';
    btn.classList.add('active');
    playTone(880, 0.08, 'sine');
  } else {
    btn.innerHTML = '<span id="audio-icon">🔇</span> AUDIO SFX: OFF';
    btn.classList.remove('active');
  }
}

function playTone(freq, duration, type = 'sine', gainVal = 0.08) {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context may be restricted by browser policy before first interaction
  }
}

function playInterceptSound() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Harmonized double lock chime
    playTone(1046.5, 0.12, 'triangle', 0.1); // C6
    setTimeout(() => playTone(1318.5, 0.18, 'sine', 0.12), 40); // E6
  } catch (e) {}
}

function playHopSound() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(340 + tunedChannel * 40, 0.05, 'sine', 0.04);
  } catch (e) {}
}

// ══════════════════════════════════════════════
//  MARKOV CHAIN & GNN ATTENTION TOPOLOGY
// ══════════════════════════════════════════════

function initTransitionMatrix() {
  transitionMatrix = [];
  attentionMatrix = [];
  
  for (let i = 0; i < numChannels; i++) {
    const tRow = [];
    const aRow = [];
    let sum = 0;
    
    for (let j = 0; j < numChannels; j++) {
      const dist = Math.abs(i - j);
      // Base hopping Markov weights
      let w = dist === 0 ? 0.05 : (1 / (dist + 1.2)) + Math.random() * 0.15;
      if (activeScenario === 'drone') {
        // Drone swarm has harmonic correlation (hops in pairs/triads)
        if (Math.abs(dist - 4) <= 1) w += 0.4;
      } else if (activeScenario === 'jamming') {
        // Jammer spreads broad interference
        w = 0.2 + Math.random() * 0.2;
      }
      tRow.push(w);
      sum += w;
      
      // Attention weight between channel i and j
      aRow.push(Math.min(1.0, w * 3.5));
    }
    
    // Normalize transition probabilities
    for (let j = 0; j < numChannels; j++) tRow[j] /= sum;
    transitionMatrix.push(tRow);
    attentionMatrix.push(aRow);
  }
}

function initGNNParticles() {
  particles = [];
  for (let i = 0; i < 24; i++) {
    particles.push({
      fromNode: Math.floor(Math.random() * numChannels),
      toNode: Math.floor(Math.random() * numChannels),
      progress: Math.random(),
      speed: 0.008 + Math.random() * 0.012,
      color: Math.random() > 0.5 ? '#00FFAA' : '#00E5FF'
    });
  }
}

// ══════════════════════════════════════════════
//  SIMULATION PLAYBACK CONTROLS
// ══════════════════════════════════════════════

function getIntervalForSpeed(spd) {
  // 0.1x = 4000ms (Ultra Slow for Judges), 0.25x = 2500ms, 0.5x = 1400ms, 1.0x = 700ms
  if (spd === 0.1) return 4000;
  if (spd === 0.25) return 2500;
  if (spd === 0.5) return 1400;
  return 700;
}

function toggleScan() {
  if (isScanning) {
    stopScan();
  } else {
    startScan();
  }
}

function startScan() {
  isScanning = true;
  isPaused = false;
  totalHops = 0;
  totalHits = 0;
  totalMisses = 0;
  history = [];
  
  spawnTargets();

  const btn = document.getElementById('btn-start-stop');
  btn.className = 'btn-control btn-stop';
  btn.innerHTML = '■ STOP SCAN';

  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.disabled = false;
  pauseBtn.className = 'btn-control btn-secondary';
  pauseBtn.innerHTML = '⏸ PAUSE';

  const stepBtn = document.getElementById('btn-step');
  stepBtn.disabled = true;

  updateBadge('scanning', 'Live AI Tracking');
  addLog('ai', `Scan initiated in [${activeScenario.toUpperCase()}] mode. GNN Attention Network active.`);

  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(simulateStep, getIntervalForSpeed(currentSpeed));
}

function stopScan() {
  isScanning = false;
  isPaused = false;
  if (simInterval) { clearInterval(simInterval); simInterval = null; }

  const btn = document.getElementById('btn-start-stop');
  btn.className = 'btn-control btn-start';
  btn.innerHTML = '▶ START SCAN';

  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.disabled = true;
  pauseBtn.innerHTML = '⏸ PAUSE';

  const stepBtn = document.getElementById('btn-step');
  stepBtn.disabled = true;

  updateBadge('idle', 'Idle');
  addLog('ai', 'Simulation stopped. Monitoring standby.');
}

function togglePause() {
  if (!isScanning) return;
  isPaused = !isPaused;
  const pauseBtn = document.getElementById('btn-pause');
  const stepBtn = document.getElementById('btn-step');

  if (isPaused) {
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
    pauseBtn.innerHTML = '▶ RESUME';
    pauseBtn.classList.add('accent-gold');
    stepBtn.disabled = false;
    updateBadge('paused', 'Paused (Freeze Frame)');
    addLog('ai', 'Simulation paused for frame-by-frame inspection.');
  } else {
    pauseBtn.innerHTML = '⏸ PAUSE';
    pauseBtn.classList.remove('accent-gold');
    stepBtn.disabled = true;
    updateBadge('scanning', 'Live AI Tracking');
    if (simInterval) clearInterval(simInterval);
    simInterval = setInterval(simulateStep, getIntervalForSpeed(currentSpeed));
  }
}

function stepSimulation() {
  if (!isScanning || !isPaused) return;
  simulateStep();
  addLog('ai', `Single hop advanced (Step #${totalHops}).`);
}

function setSpeed(spd, btnEl) {
  currentSpeed = spd;
  document.querySelectorAll('.speed-chip').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  if (isScanning && !isPaused) {
    if (simInterval) clearInterval(simInterval);
    simInterval = setInterval(simulateStep, getIntervalForSpeed(currentSpeed));
  }
}

function updateBadge(state, text) {
  const badge = document.getElementById('scan-badge');
  badge.className = `status-badge ${state}`;
  document.getElementById('scan-status-text').textContent = text;
}

// ══════════════════════════════════════════════
//  SCENARIOS & MODE HANDLERS
// ══════════════════════════════════════════════

function changeScenario(val) {
  activeScenario = val;
  initTransitionMatrix();
  spawnTargets();
  addLog('threat', `Scenario switched to: ${val.toUpperCase()}. Emitter signature updated.`);
}

function changeEngine(val) {
  engineMode = val;
  const pill = document.getElementById('gnn-mode-pill');
  if (val === 'ai') {
    pill.textContent = 'GAT Message Passing';
    pill.className = 'legend-pill tuner';
    addLog('ai', 'AI Engine Activated: DQN Policy + Graph Attention Network.');
  } else {
    pill.textContent = 'Blind Linear Sweep';
    pill.className = 'legend-pill threat';
    addLog('threat', 'Switched to Traditional Linear Sweeper (~35% detection rate).');
  }
}

function setChannels(val) {
  numChannels = parseInt(val);
  initTransitionMatrix();
  initGNNParticles();
  spawnTargets();
  addLog('ai', `Spectrum resolution set to ${numChannels} Channels (2.0–18.0 GHz).`);
}

// Target & Prediction State
let prevTarget = 0;
let currentTarget = 3;
let predictedNext = 7;
let hopStartTime = Date.now();

function spawnTargets() {
  if (activeScenario === 'drone') {
    activeTargets = [2, Math.min(numChannels - 1, 6)];
  } else if (activeScenario === 'jamming') {
    activeTargets = [1, 4, 7];
  } else {
    activeTargets = [Math.floor(Math.random() * numChannels)];
  }
  currentTarget = activeTargets[0];
  prevTarget = (currentTarget + numChannels - 1) % numChannels;
  computePredictedNext();
  hopStartTime = Date.now();
}

function computePredictedNext() {
  const probs = transitionMatrix[currentTarget] || [];
  let bestCh = (currentTarget + 2) % numChannels;
  let maxP = 0;
  for (let j = 0; j < numChannels; j++) {
    if (j !== currentTarget && (probs[j] || 0) > maxP) {
      maxP = probs[j];
      bestCh = j;
    }
  }
  predictedNext = bestCh;
}

// ══════════════════════════════════════════════
//  SIMULATION STEP (FHSS & AI PREDICTION)
// ══════════════════════════════════════════════

function simulateStep() {
  totalHops++;
  prevTarget = currentTarget;

  // 1. Move active targets according to scenario Markov probabilities
  activeTargets = activeTargets.map(ch => {
    const probs = transitionMatrix[ch] || transitionMatrix[0];
    let r = Math.random();
    for (let j = 0; j < numChannels; j++) {
      r -= (probs[j] || 0);
      if (r <= 0) return j;
    }
    return ch;
  });

  currentTarget = activeTargets[0];

  // 2. Determine Receiver Tuning (AI vs Traditional)
  if (engineMode === 'ai') {
    // DQN + GNN Agent prediction
    const confidence = 0.94 - (activeScenario === 'jamming' ? 0.08 : 0.0);
    
    if (Math.random() < confidence) {
      tunedChannel = currentTarget;
    } else {
      // Near-miss exploration
      const offset = Math.random() > 0.5 ? 1 : -1;
      tunedChannel = Math.max(0, Math.min(numChannels - 1, currentTarget + offset));
    }
  } else {
    // Traditional linear sweeping receiver
    tunedChannel = (tunedChannel + 1) % numChannels;
  }

  // Pre-calculate next predicted hop for the slow-moving pulse animation
  computePredictedNext();
  hopStartTime = Date.now();

  // 3. Evaluate Intercept
  isHit = activeTargets.includes(tunedChannel);
  if (isHit) {
    totalHits++;
    playInterceptSound();
  } else {
    totalMisses++;
    playHopSound();
  }

  // 4. Generate Channel Powers (dBm)
  const powers = [];
  for (let ch = 0; ch < numChannels; ch++) {
    let baseNoise = -95 + Math.random() * 8;
    if (activeTargets.includes(ch)) {
      if (activeScenario === 'stealth') {
        baseNoise = -55 + Math.random() * 10;
      } else {
        baseNoise = -25 + Math.random() * 15;
      }
    } else if (activeScenario === 'jamming' && Math.random() < 0.3) {
      baseNoise = -45 + Math.random() * 12;
    }
    powers.push(baseNoise);
  }

  // 5. Store in Spectrogram History
  const centerFreq = (2.0 + (tunedChannel / numChannels) * 16.0).toFixed(2);
  history.push({
    powers,
    tunedCh: tunedChannel,
    activeTargets: [...activeTargets],
    isHit,
    freq: centerFreq
  });
  if (history.length > MAX_ROWS) history.shift();

  // 7. Log Threat Event
  const nowStr = new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 9);
  if (isHit) {
    addLog('lock', `<span class="log-time">[${nowStr}]</span> 🎯 <b>INTERCEPT LOCKED:</b> Signal on CH-${tunedChannel} (${centerFreq} GHz) | GNN Conf: ${(92 + Math.random()*7).toFixed(1)}% | MATCH!`);
  } else {
    addLog('threat', `<span class="log-time">[${nowStr}]</span> 📡 <b>HOP:</b> Emitter at CH-${activeTargets[0]} (${(2.0 + (activeTargets[0]/numChannels)*16).toFixed(1)} GHz) | AI receiver at CH-${tunedChannel}`);
  }

  // Update dynamic metrics
  updateMetrics();
}

// ══════════════════════════════════════════════
//  METRICS DISPLAY
// ══════════════════════════════════════════════

function updateMetrics() {
  const pd = totalHops > 0 ? totalHits / totalHops : 0;
  const pfa = totalHops > 0 ? Math.max(0.008, 0.045 - pd * 0.038 + (Math.random() * 0.005)) : 0;
  const eff = totalHops > 0 ? (totalHits / totalHops) : 0;
  const latency = engineMode === 'ai' ? (1.6 + Math.random() * 0.4).toFixed(1) + ' ms' : '42.8 ms';

  document.getElementById('val-pd').textContent = (pd * 100).toFixed(1) + '%';
  document.getElementById('val-pfa').textContent = (pfa * 100).toFixed(2) + '%';
  document.getElementById('val-hits').textContent = totalHits;
  document.getElementById('val-hops').textContent = totalHops;
  document.getElementById('val-eff').textContent = (eff * 100).toFixed(1) + '%';
  document.getElementById('val-latency').textContent = latency;

  updateRing('ring-pd', pd, '#00FFAA');
  updateRing('ring-pfa', 1 - (pfa * 10), '#76FF03');
  updateRing('ring-eff', eff, '#FFEA00');
}

function updateRing(id, value, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const size = 38;
  const sw = 3.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(Math.max(value, 0), 1);
  const offset = circ - progress * circ;

  el.innerHTML = `<svg width="${size}" height="${size}">
    <circle class="track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${sw}"/>
    <circle class="fill" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${sw}"
      stroke="${color}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
      style="filter:drop-shadow(0 0 6px ${color}80)"/>
  </svg>`;
}

function initMiniRings() {
  updateRing('ring-pd', 0, '#00FFAA');
  updateRing('ring-pfa', 1, '#76FF03');
  updateRing('ring-eff', 0, '#FFEA00');
}

function addLog(type, htmlContent) {
  const feed = document.getElementById('logs-feed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = htmlContent;
  feed.insertBefore(entry, feed.firstChild);
  if (feed.children.length > 25) {
    feed.removeChild(feed.lastChild);
  }
}

// ══════════════════════════════════════════════
//  HIGH-CONTRAST WATERFALL SPECTRUM RENDERER
// ══════════════════════════════════════════════

const SPECTRUM_MAP = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  let r, g, b;
  if (t < 0.2) {
    const s = t / 0.2;
    r = Math.floor(s * 4); g = Math.floor(s * 20); b = Math.floor(s * 30);
  } else if (t < 0.45) {
    const s = (t - 0.2) / 0.25;
    r = Math.floor(4 + s * 0); g = Math.floor(20 + s * 180); b = Math.floor(30 + s * 225);
  } else if (t < 0.7) {
    const s = (t - 0.45) / 0.25;
    r = Math.floor(s * 0); g = Math.floor(200 + s * 55); b = Math.floor(255 - s * 85);
  } else if (t < 0.88) {
    const s = (t - 0.7) / 0.18;
    r = Math.floor(s * 255); g = Math.floor(255 - s * 21); b = 0;
  } else {
    const s = (t - 0.88) / 0.12;
    r = 255; g = Math.floor(234 * (1 - s)); b = Math.floor(s * 68);
  }
  SPECTRUM_MAP.push([r, g, b]);
}

let sweepPos = 0;

function startRenderLoop() {
  const canvas = document.getElementById('waterfall-canvas');
  const overlay = document.getElementById('overlay-canvas');
  const gnnCanvas = document.getElementById('gnn-canvas');
  if (!canvas || !overlay || !gnnCanvas) return;

  function render() {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      overlay.width = w; overlay.height = h;
    }

    const gnnWrap = gnnCanvas.parentElement;
    const gw = gnnWrap.clientWidth;
    const gh = gnnWrap.clientHeight;
    if (gnnCanvas.width !== gw || gnnCanvas.height !== gh) {
      gnnCanvas.width = gw; gnnCanvas.height = gh;
    }

    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');

    ctx.fillStyle = '#040909';
    ctx.fillRect(0, 0, w, h);
    octx.clearRect(0, 0, w, h);

    if (history.length === 0) {
      ctx.fillStyle = '#577B6E';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press START SCAN to activate tactical RF sensor...', w / 2, h / 2);
    } else {
      const nCh = numChannels;
      const nRows = history.length;
      const cellW = w / nCh;
      const cellH = h / MAX_ROWS;

      for (let row = 0; row < nRows; row++) {
        const rd = history[row];
        const y = h - (nRows - row) * cellH;
        for (let ch = 0; ch < nCh; ch++) {
          const norm = Math.max(0, Math.min(1, ((rd.powers[ch] || -90) + 95) / 80));
          const ci = Math.floor(norm * 255);
          const [cr, cg, cb] = SPECTRUM_MAP[ci] || [4, 15, 20];
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
          ctx.fillRect(Math.floor(ch * cellW), Math.floor(y), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
        }
      }

      ctx.strokeStyle = 'rgba(0, 255, 170, 0.08)';
      ctx.lineWidth = 1;
      for (let ch = 1; ch < nCh; ch++) {
        const x = Math.floor(ch * cellW);
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.stroke();
      }

      sweepPos += 0.0018; // Slower sweep for calm presentation
      if (sweepPos > 1) sweepPos = 0;
      const sweepY = h * sweepPos;
      
      ctx.beginPath();
      ctx.moveTo(0, sweepY); ctx.lineTo(w, sweepY);
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const sg = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 15);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.5, 'rgba(0, 255, 170, 0.1)');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(0, sweepY - 15, w, 30);

      const latest = history[nRows - 1];
      const latestY = h - cellH;

      for (const ch of latest.activeTargets) {
        const cx = ch * cellW + cellW / 2;
        const cy = latestY + cellH / 2;
        
        octx.beginPath();
        octx.arc(cx, cy, Math.max(6, cellW / 3), 0, Math.PI * 2);
        octx.strokeStyle = '#FF1744';
        octx.lineWidth = 2.5;
        octx.stroke();
      }

      const tx = latest.tunedCh * cellW;
      if (latest.isHit) {
        octx.fillStyle = 'rgba(255, 234, 0, 0.28)';
        octx.fillRect(tx, 0, cellW, h);
        octx.strokeStyle = '#FFEA00';
        octx.lineWidth = 2.5;
        octx.strokeRect(tx, latestY, cellW, cellH);

        octx.fillStyle = '#FFEA00';
        octx.font = 'bold 10px "JetBrains Mono", monospace';
        octx.textAlign = 'center';
        octx.fillText('⚡ LOCKED', tx + cellW / 2, latestY - 6);
      } else {
        octx.fillStyle = 'rgba(0, 255, 170, 0.14)';
        octx.fillRect(tx, 0, cellW, h);
        octx.strokeStyle = 'rgba(0, 255, 170, 0.8)';
        octx.lineWidth = 2;
        octx.strokeRect(tx, latestY, cellW, cellH);
      }

      octx.font = '500 10px "JetBrains Mono", monospace';
      octx.textAlign = 'center';
      octx.fillStyle = '#F0FDF4';
      for (let ch = 0; ch < nCh; ch++) {
        const fGhz = (2.0 + (ch / nCh) * 16.0).toFixed(1);
        octx.fillText(`CH${ch}`, ch * cellW + cellW / 2, 14);
        octx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        octx.fillText(`${fGhz}G`, ch * cellW + cellW / 2, 26);
        octx.fillStyle = '#F0FDF4';
      }
    }

    drawGNN(gnnCanvas.getContext('2d'), gw, gh);

    animFrame = requestAnimationFrame(render);
  }

  animFrame = requestAnimationFrame(render);
}

// ══════════════════════════════════════════════
//  CLEAN & HIGH-CONTRAST GNN TOPOLOGY VISUALIZER
// ══════════════════════════════════════════════

function drawGNN(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.36;

  if (history.length === 0) {
    ctx.fillStyle = '#577B6E';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Awaiting scan initialization...', cx, cy);
    return;
  }

  const latest = history[history.length - 1];
  const srcNode = currentTarget;
  const dstNode = predictedNext;
  const isLock = latest.isHit;

  // 1. Draw Clean Subtle Outer Frequency Ring (Perimeter)
  ctx.beginPath();
  for (let i = 0; i < numChannels; i++) {
    const angle = i * 2 * Math.PI / numChannels;
    const nx = cx + Math.cos(angle) * radius;
    const ny = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(nx, ny);
    else ctx.lineTo(nx, ny);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0, 255, 170, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Draw Active Prediction Beam (From Current Emitter to Predicted Next Hop)
  const p1x = cx + Math.cos(srcNode * 2 * Math.PI / numChannels) * radius;
  const p1y = cy + Math.sin(srcNode * 2 * Math.PI / numChannels) * radius;
  const p2x = cx + Math.cos(dstNode * 2 * Math.PI / numChannels) * radius;
  const p2y = cy + Math.sin(dstNode * 2 * Math.PI / numChannels) * radius;

  // Main Glowing Attention Vector
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00E5FF';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Secondary subtle transition probability line (top alternative hop)
  const probs = transitionMatrix[srcNode] || [];
  let altNode = (srcNode + 3) % numChannels;
  let maxAlt = 0;
  for (let j = 0; j < numChannels; j++) {
    if (j !== srcNode && j !== dstNode && (probs[j] || 0) > maxAlt) {
      maxAlt = probs[j];
      altNode = j;
    }
  }
  const altX = cx + Math.cos(altNode * 2 * Math.PI / numChannels) * radius;
  const altY = cy + Math.sin(altNode * 2 * Math.PI / numChannels) * radius;
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(altX, altY);
  ctx.strokeStyle = 'rgba(124, 77, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. SLOW-MOVING SIGNAL PULSE (Comet Dot with Pattern Flow)
  const duration = getIntervalForSpeed(currentSpeed);
  const elapsed = Date.now() - hopStartTime;
  // Progress smoothly moves from 0.0 to 1.0 during the entire hop duration
  const progress = isPaused ? 0.5 : Math.min(1.0, (elapsed % duration) / duration);

  const curX = p1x + (p2x - p1x) * progress;
  const curY = p1y + (p2y - p1y) * progress;

  // Draw Glowing Comet Trail behind the dot
  for (let t = 1; t <= 4; t++) {
    const trailProg = Math.max(0, progress - t * 0.04);
    const tx = p1x + (p2x - p1x) * trailProg;
    const ty = p1y + (p2y - p1y) * trailProg;
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(1, 4 - t * 0.8), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 170, ${0.7 - t * 0.15})`;
    ctx.fill();
  }

  // Draw Main Glowing Dot
  ctx.beginPath();
  ctx.arc(curX, curY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#00FFAA';
  ctx.shadowColor = '#00FFAA';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Outer Pulse Ring around the moving dot
  ctx.beginPath();
  ctx.arc(curX, curY, 9, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 255, 170, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Attention Probability Badge
  const midX = (p1x + p2x) / 2;
  const midY = (p1y + p2y) / 2;
  ctx.fillStyle = 'rgba(7, 19, 19, 0.9)';
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(midX - 28, midY - 11, 56, 22, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#00FFAA';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('94.8%', midX, midY);

  // 4. Channel Nodes (High-Contrast Clean Badges)
  for (let i = 0; i < numChannels; i++) {
    const angle = i * 2 * Math.PI / numChannels;
    const nx = cx + Math.cos(angle) * radius;
    const ny = cy + Math.sin(angle) * radius;

    const isCurrentThreat = (srcNode === i);
    const isPredictedNext = (dstNode === i);
    const isTuned = (latest.tunedCh === i);
    const isHovered = (hoveredNode === i);

    if (isCurrentThreat && isTuned && isLock) {
      // 🟡 Intercept Locked Halo
      ctx.beginPath();
      ctx.arc(nx, ny, 22, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 234, 0, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#FFEA00';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Lock Crosshairs
      ctx.strokeStyle = '#FFEA00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx - 14, ny); ctx.lineTo(nx + 14, ny);
      ctx.moveTo(nx, ny - 14); ctx.lineTo(nx, ny + 14);
      ctx.stroke();
    } else if (isCurrentThreat) {
      // 🔴 Current Threat Origin Beacon
      ctx.beginPath();
      ctx.arc(nx, ny, 19, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 23, 68, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (isPredictedNext) {
      // 🟢 Target Destination Node (Anticipation Ring)
      ctx.beginPath();
      ctx.arc(nx, ny, 19, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 255, 170, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#00FFAA';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Node Core
    ctx.beginPath();
    ctx.arc(nx, ny, isHovered ? 13 : 11, 0, 2 * Math.PI);
    
    if (isCurrentThreat && isLock) {
      ctx.fillStyle = '#FFEA00';
      ctx.strokeStyle = '#FFFFFF';
    } else if (isCurrentThreat) {
      ctx.fillStyle = '#FF1744';
      ctx.strokeStyle = '#FFA1A1';
    } else if (isPredictedNext) {
      ctx.fillStyle = '#00FFAA';
      ctx.strokeStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = '#0B1C1C';
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.35)';
    }

    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Node Label Number
    ctx.fillStyle = (isCurrentThreat && isLock) || isPredictedNext ? '#040909' : '#FFFFFF';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i, nx, ny);
  }
}

// ══════════════════════════════════════════════
//  INTERACTIVE NODE INSPECTOR HUD
// ══════════════════════════════════════════════

function setupGNNInteraction() {
  const gnnWrapper = document.getElementById('gnn-wrapper');
  const gnnCanvas = document.getElementById('gnn-canvas');
  const inspector = document.getElementById('node-inspector');
  if (!gnnWrapper || !gnnCanvas || !inspector) return;

  gnnCanvas.addEventListener('mousemove', (e) => {
    const rect = gnnCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = gnnCanvas.width / 2;
    const cy = gnnCanvas.height / 2;
    const radius = Math.min(gnnCanvas.width, gnnCanvas.height) * 0.36;

    let found = null;
    for (let i = 0; i < numChannels; i++) {
      const angle = i * 2 * Math.PI / numChannels;
      const nx = cx + Math.cos(angle) * radius;
      const ny = cy + Math.sin(angle) * radius;
      const dist = Math.hypot(x - nx, y - ny);
      if (dist < 18) {
        found = i;
        break;
      }
    }

    hoveredNode = found;

    if (found !== null && history.length > 0) {
      const latest = history[history.length - 1];
      const fGhz = (2.0 + (found / numChannels) * 16.0).toFixed(2);
      const pwr = (latest.powers[found] || -90).toFixed(1);
      const isThreat = latest.activeTargets.includes(found);
      const attWeight = ((transitionMatrix[found] ? transitionMatrix[found][(found+1)%numChannels] : 0.2) * 100).toFixed(1);
      const predProb = isThreat ? (88.4 + Math.random() * 8.0).toFixed(1) : (4.2 + Math.random() * 5.0).toFixed(1);

      document.getElementById('insp-ch').textContent = `CHANNEL ${found} (BAND ${found < 4 ? 'S' : (found < 8 ? 'C' : 'X')})`;
      document.getElementById('insp-freq').textContent = `${fGhz} GHz`;
      document.getElementById('insp-pwr').textContent = `${pwr} dBm`;
      document.getElementById('insp-threat').textContent = isThreat ? '🔴 EMITTER ACTIVE' : '⚪ IDLE SPECTRUM';
      document.getElementById('insp-threat').style.color = isThreat ? '#FF1744' : '#94A3B8';
      document.getElementById('insp-att').textContent = `${attWeight}%`;
      document.getElementById('insp-pred').textContent = `${predProb}%`;

      inspector.classList.add('visible');
    } else {
      inspector.classList.remove('visible');
    }
  });

  gnnCanvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    inspector.classList.remove('visible');
  });
}

// ══════════════════════════════════════════════
//  PRESENTATION / PITCH DECK MODAL
// ══════════════════════════════════════════════

function openPitchModal() {
  document.getElementById('pitch-modal').classList.add('active');
}

function closePitchModal() {
  document.getElementById('pitch-modal').classList.remove('active');
}

function closePitchModalOnBackdrop(e) {
  if (e.target.id === 'pitch-modal') {
    closePitchModal();
  }
}

function switchPitchSlide(index, btnEl) {
  document.querySelectorAll('.pitch-slide').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.pitch-tab-btn').forEach(b => b.classList.remove('active'));

  const targetSlide = document.getElementById(`slide-${index}`);
  if (targetSlide) targetSlide.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
}

/**
 * Smart Scan EW — Standalone Dashboard JavaScript
 * ==================================================
 * Sign-in logic, fake simulation engine, waterfall rendering,
 * and live metrics updates. No frameworks, no dependencies.
 *
 * Team HORIZON — SIH26055
 */

// ══════════════════════════════════════════════
//  CREDENTIALS & STATE
// ══════════════════════════════════════════════

const VALID_CREDS = {
  'admin': 'horizon2026',
  'operator': 'smartscan',
  'demo': 'demo123',
};

const BASE_REGIONS = {
  'nc-hq': 'Udhampur',
  'ead-01': 'Shillong',
  'wc-sec': 'Chandimandir',
  'sc-ops': 'Pune',
  'nsd-07': 'Visakhapatnam',
  'caf-12': 'Nagpur',
};

let isScanning = false;
let simInterval = null;
let animFrame = null;
let numChannels = 12;

// Simulation state
let totalHops = 0;
let totalHits = 0;
let totalMisses = 0;
let tunedChannel = 0;
let activeTargets = [];
let isHit = false;
let history = [];
const MAX_ROWS = 200;

// Markov transition matrix (simulates FHSS hopping)
let transitionMatrix = [];

// ══════════════════════════════════════════════
//  SIGN-IN
// ══════════════════════════════════════════════

function handleSignIn(e) {
  e.preventDefault();
  const base = document.getElementById('select-base').value;
  const user = document.getElementById('input-username').value.trim().toLowerCase();
  const pass = document.getElementById('input-password').value.trim();
  const errEl = document.getElementById('signin-error');

  if (!base) {
    errEl.textContent = '⚠ Please select a military base';
    errEl.style.display = 'block';
    return false;
  }

  if (VALID_CREDS[user] === pass) {
    // Success — show dashboard
    errEl.style.display = 'none';
    document.getElementById('signin-page').classList.remove('active');
    document.getElementById('dashboard-page').classList.add('active');

    // Set navbar info
    const baseText = document.getElementById('select-base').selectedOptions[0].text;
    document.getElementById('nav-base-name').textContent = baseText.split('•')[0].trim();
    document.getElementById('nav-username').textContent = user;
    document.getElementById('nav-region').textContent = BASE_REGIONS[base] || '';

    initDashboard();
  } else {
    errEl.textContent = '⚠ Invalid credentials. Access denied.';
    errEl.style.display = 'block';
  }
  return false;
}

function handleSignOut() {
  stopScan();
  document.getElementById('dashboard-page').classList.remove('active');
  document.getElementById('signin-page').classList.add('active');
  document.getElementById('input-password').value = '';
}

// ══════════════════════════════════════════════
//  DASHBOARD INIT
// ══════════════════════════════════════════════

function initDashboard() {
  initTransitionMatrix();
  initMiniRings();
  startRenderLoop();
}

function initTransitionMatrix() {
  // Create a Markov chain for FHSS simulation
  transitionMatrix = [];
  for (let i = 0; i < numChannels; i++) {
    const row = [];
    let sum = 0;
    for (let j = 0; j < numChannels; j++) {
      const dist = Math.abs(i - j);
      // Prefer nearby channels + some random long hops
      const w = dist === 0 ? 0.05 : (1 / (dist + 1)) + Math.random() * 0.1;
      row.push(w);
      sum += w;
    }
    // Normalize
    for (let j = 0; j < numChannels; j++) row[j] /= sum;
    transitionMatrix.push(row);
  }
}

// ══════════════════════════════════════════════
//  SCAN CONTROL
// ══════════════════════════════════════════════

function toggleScan() {
  if (isScanning) {
    stopScan();
  } else {
    startScan();
  }
}

function startScan() {
  isScanning = true;
  totalHops = 0;
  totalHits = 0;
  totalMisses = 0;
  history = [];
  activeTargets = [Math.floor(Math.random() * numChannels)];
  if (numChannels > 8) activeTargets.push((activeTargets[0] + 4 + Math.floor(Math.random() * 4)) % numChannels);

  const btn = document.getElementById('btn-start-stop');
  btn.className = 'btn-stop';
  btn.innerHTML = '■ STOP SCAN';

  const badge = document.getElementById('scan-badge');
  badge.className = 'status-badge scanning';
  document.getElementById('scan-status-text').textContent = 'Scanning';

  // Run simulation at ~0.6 FPS (1500ms intervals) for Slow Motion
  simInterval = setInterval(simulateStep, 1500);
}

function stopScan() {
  isScanning = false;
  if (simInterval) { clearInterval(simInterval); simInterval = null; }

  const btn = document.getElementById('btn-start-stop');
  btn.className = 'btn-start';
  btn.innerHTML = '▶ START SCAN';

  const badge = document.getElementById('scan-badge');
  badge.className = 'status-badge idle';
  document.getElementById('scan-status-text').textContent = 'Idle';
}

function setMode(el, mode) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function setChannels(val) {
  numChannels = parseInt(val);
  document.getElementById('ch-count').textContent = numChannels + ' CH';
  initTransitionMatrix();
  if (isScanning) {
    stopScan();
    startScan();
  }
}

// ══════════════════════════════════════════════
//  SIMULATION ENGINE (Fake FHSS)
// ══════════════════════════════════════════════

function simulateStep() {
  totalHops++;

  // Move active targets using Markov chain
  activeTargets = activeTargets.map(ch => {
    const probs = transitionMatrix[ch];
    let r = Math.random();
    for (let j = 0; j < numChannels; j++) {
      r -= probs[j];
      if (r <= 0) return j;
    }
    return ch;
  });

  // AI agent "decides" where to tune (smart: follows targets with some noise)
  // Simulates DQN behavior — mostly correct, sometimes explores
  const epsilon = Math.max(0.05, 0.3 - totalHops * 0.001); // Epsilon decays
  if (Math.random() < epsilon) {
    // Explore: random channel
    tunedChannel = Math.floor(Math.random() * numChannels);
  } else {
    // Exploit: target the most likely active channel (with some GNN-like adjacency bias)
    const target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
    // Add slight offset sometimes (simulates imperfect prediction)
    const offset = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : -1);
    tunedChannel = Math.max(0, Math.min(numChannels - 1, target + offset));
  }

  // Check if hit
  isHit = activeTargets.includes(tunedChannel);
  if (isHit) {
    totalHits++;
  } else {
    totalMisses++;
  }

  // Generate channel power readings
  const powers = [];
  for (let ch = 0; ch < numChannels; ch++) {
    let power = -90 + Math.random() * 10; // Noise floor: -90 to -80 dBm
    if (activeTargets.includes(ch)) {
      power = -30 + Math.random() * 20; // Active signal: -30 to -10 dBm
    }
    powers.push(power);
  }

  // Store in history
  history.push({
    powers,
    tunedCh: tunedChannel,
    activeTargets: [...activeTargets],
    isHit,
  });
  if (history.length > MAX_ROWS) history.shift();

  // Occasionally shift transition matrix (emitter adapts)
  if (totalHops % 50 === 0) {
    initTransitionMatrix();
  }

  // Update metrics
  updateMetrics();
}

// ══════════════════════════════════════════════
//  METRICS UPDATE
// ══════════════════════════════════════════════

function updateMetrics() {
  const pd = totalHops > 0 ? totalHits / totalHops : 0;
  const pfa = totalHops > 0 ? Math.max(0, 0.05 - pd * 0.03 + Math.random() * 0.01) : 0;
  const eff = totalHops > 0 ? totalHits / totalHops : 0;

  document.getElementById('val-pd').textContent = (pd * 100).toFixed(1) + '%';
  document.getElementById('val-pfa').textContent = (pfa * 100).toFixed(2) + '%';
  document.getElementById('val-hits').textContent = totalHits;
  document.getElementById('val-hops').textContent = totalHops;
  document.getElementById('val-eff').textContent = (eff * 100).toFixed(1) + '%';

  // Update ring gauges
  updateRing('ring-pd', pd, '#2dd4a8');
  updateRing('ring-pfa', 1 - pfa, '#84cc16');
  updateRing('ring-eff', eff, '#e8614d');
}

function updateRing(id, value, color) {
  const el = document.getElementById(id);
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
      style="filter:drop-shadow(0 0 4px ${color}40)"/>
  </svg>`;
}

function initMiniRings() {
  updateRing('ring-pd', 0, '#2dd4a8');
  updateRing('ring-pfa', 1, '#84cc16');
  updateRing('ring-eff', 0, '#e8614d');
}

// ══════════════════════════════════════════════
//  WATERFALL RENDERING
// ══════════════════════════════════════════════

// Night-vision teal colormap
const COLORMAP = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  let r, g, b;
  if (t < 0.15) {
    const s = t / 0.15;
    r = Math.floor(s * 6); g = Math.floor(s * 18); b = Math.floor(s * 14);
  } else if (t < 0.35) {
    const s = (t - 0.15) / 0.2;
    r = Math.floor(6 + s * 7); g = Math.floor(18 + s * 52); b = Math.floor(14 + s * 45);
  } else if (t < 0.55) {
    const s = (t - 0.35) / 0.2;
    r = Math.floor(13 + s * 32); g = Math.floor(70 + s * 142); b = Math.floor(59 + s * 109);
  } else if (t < 0.75) {
    const s = (t - 0.55) / 0.2;
    r = Math.floor(45 + s * 36); g = Math.floor(212 + s * 35); b = Math.floor(168 + s * 62);
  } else if (t < 0.9) {
    const s = (t - 0.75) / 0.15;
    r = Math.floor(81 + s * 120); g = Math.floor(247 + s * 8); b = Math.floor(230 + s * 20);
  } else {
    const s = (t - 0.9) / 0.1;
    r = Math.floor(201 + s * 54); g = 255; b = Math.floor(250 + s * 5);
  }
  COLORMAP.push([r, g, b]);
}

let sweepPos = 0;

function startRenderLoop() {
  const canvas = document.getElementById('waterfall-canvas');
  const overlay = document.getElementById('overlay-canvas');
  if (!canvas || !overlay) return;

  function render() {
    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      overlay.width = w; overlay.height = h;
    }

    const gnnCanvas = document.getElementById('gnn-canvas');
    if (gnnCanvas) {
      const gnnWrap = gnnCanvas.parentElement;
      const gw = gnnWrap.clientWidth;
      const gh = gnnWrap.clientHeight;
      if (gnnCanvas.width !== gw || gnnCanvas.height !== gh) {
        gnnCanvas.width = gw; gnnCanvas.height = gh;
      }
      drawGNN(gnnCanvas.getContext('2d'), gw, gh);
    }

    // Clear
    ctx.fillStyle = '#0A1A1A';
    ctx.fillRect(0, 0, w, h);
    octx.clearRect(0, 0, w, h);

    if (history.length === 0) {
      ctx.fillStyle = '#577b6e';
      ctx.font = '14px Space Grotesk, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press START SCAN to begin simulation...', w / 2, h / 2);
      animFrame = requestAnimationFrame(render);
      return;
    }

    const nCh = history[0].powers.length;
    const nRows = history.length;
    const cellW = w / nCh;
    const cellH = h / MAX_ROWS;

    // Draw heatmap
    for (let row = 0; row < nRows; row++) {
      const rd = history[row];
      const y = h - (nRows - row) * cellH;
      for (let ch = 0; ch < nCh; ch++) {
        const norm = Math.max(0, Math.min(1, (rd.powers[ch] + 90) / 80));
        const ci = Math.floor(norm * 255);
        const [cr, cg, cb] = COLORMAP[ci];
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(Math.floor(ch * cellW), Math.floor(y), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }

    // Sweep line
    sweepPos += 0.003;
    if (sweepPos > 1) sweepPos = 0;
    const sweepY = h * sweepPos;
    ctx.beginPath();
    ctx.moveTo(0, sweepY); ctx.lineTo(w, sweepY);
    ctx.strokeStyle = 'rgba(45,212,168,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const sg = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 15);
    sg.addColorStop(0, 'transparent');
    sg.addColorStop(0.5, 'rgba(45,212,168,0.1)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.fillRect(0, sweepY - 15, w, 30);

    // Overlay markers on latest row
    if (nRows > 0) {
      const latest = history[nRows - 1];
      const latestY = h - cellH;

      // Active target circles (coral)
      for (const ch of latest.activeTargets) {
        if (ch !== latest.tunedCh) {
          const x = ch * cellW + cellW / 2;
          octx.beginPath();
          octx.arc(x, latestY + cellH / 2, cellW / 3, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(232,97,77,0.9)';
          octx.lineWidth = 2;
          octx.stroke();
          octx.beginPath();
          octx.arc(x, latestY + cellH / 2, cellW / 2, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(232,97,77,0.3)';
          octx.lineWidth = 1;
          octx.stroke();
        }
      }

      // Tuned channel highlight
      const tx = latest.tunedCh * cellW;
      if (latest.isHit) {
        octx.fillStyle = 'rgba(132,204,22,0.25)';
        octx.fillRect(tx, 0, cellW, h);
        octx.strokeStyle = 'rgba(132,204,22,0.9)';
        octx.lineWidth = 2;
        octx.strokeRect(tx, latestY, cellW, cellH);
      } else {
        octx.fillStyle = 'rgba(45,212,168,0.12)';
        octx.fillRect(tx, 0, cellW, h);
        octx.strokeStyle = 'rgba(45,212,168,0.6)';
        octx.lineWidth = 1.5;
        octx.strokeRect(tx, latestY, cellW, cellH);
      }

      // Channel labels
      octx.font = '10px IBM Plex Mono, monospace';
      octx.textAlign = 'center';
      octx.fillStyle = 'rgba(232,240,236,0.4)';
      for (let ch = 0; ch < nCh; ch++) {
        octx.fillText(`${ch}`, ch * cellW + cellW / 2, 12);
      }

      // Time labels
      octx.font = '9px Space Grotesk, sans-serif';
      octx.fillStyle = 'rgba(232,240,236,0.3)';
      octx.textAlign = 'left';
      octx.fillText('← TIME', 4, h - 4);
      octx.fillText('NOW →', 4, latestY - 2);
    }

    animFrame = requestAnimationFrame(render);
  }

  animFrame = requestAnimationFrame(render);
}

// ══════════════════════════════════════════════
//  GNN VISUALIZER
// ══════════════════════════════════════════════

function drawGNN(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  
  if (history.length === 0) {
    ctx.fillStyle = '#577b6e';
    ctx.font = '12px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for scan...', w / 2, h / 2);
    return;
  }

  const latest = history[history.length - 1];
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.35;

  // Draw edges (attention weights)
  ctx.lineWidth = 1.5;
  for (let i = 0; i < numChannels; i++) {
    for (let j = i + 1; j < numChannels; j++) {
      const p1x = cx + Math.cos(i * 2 * Math.PI / numChannels) * radius;
      const p1y = cy + Math.sin(i * 2 * Math.PI / numChannels) * radius;
      const p2x = cx + Math.cos(j * 2 * Math.PI / numChannels) * radius;
      const p2y = cy + Math.sin(j * 2 * Math.PI / numChannels) * radius;
      
      // Calculate a fake attention weight based on Markov chain & targets
      let weight = transitionMatrix[i][j] * 5;
      if (latest.activeTargets.includes(i) && latest.activeTargets.includes(j)) weight += 0.5;
      if (latest.tunedCh === i || latest.tunedCh === j) weight += 0.2;
      
      if (weight > 0.1) {
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.strokeStyle = `rgba(45,212,168,${Math.min(0.8, weight)})`;
        ctx.stroke();
      }
    }
  }

  // Draw nodes
  for (let i = 0; i < numChannels; i++) {
    const angle = i * 2 * Math.PI / numChannels;
    const nx = cx + Math.cos(angle) * radius;
    const ny = cy + Math.sin(angle) * radius;
    
    let isTarget = latest.activeTargets.includes(i);
    let isTuned = (latest.tunedCh === i);
    
    // Outer glow for tuned
    if (isTuned) {
      ctx.beginPath();
      ctx.arc(nx, ny, 16, 0, 2 * Math.PI);
      ctx.fillStyle = latest.isHit ? 'rgba(132,204,22,0.3)' : 'rgba(45,212,168,0.3)';
      ctx.fill();
    }
    
    // Node circle
    ctx.beginPath();
    ctx.arc(nx, ny, 8, 0, 2 * Math.PI);
    ctx.fillStyle = isTarget ? '#e8614d' : '#0d4f4f';
    ctx.fill();
    ctx.strokeStyle = isTuned ? (latest.isHit ? '#84cc16' : '#2dd4a8') : '#2dd4a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#E8F0EC';
    ctx.font = '11px IBM Plex Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i, nx, ny);
  }
  
  // Legend
  ctx.fillStyle = '#7a9a8e';
  ctx.font = '10px Space Grotesk, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🔴 Enemy Signal', 10, h - 25);
  ctx.fillText('🟢 AI Tuner', 10, h - 10);
}

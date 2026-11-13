'use strict';

const canvas = document.querySelector('#garden');
const ctx = canvas.getContext('2d');
const el = id => document.getElementById(id);
const backdrop = document.createElement('canvas');
const scene = backdrop.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const tau = Math.PI * 2;
const droplets = [];
const splashes = [];
const patches = [];
const keys = new Set();
const reactions = ['They haven’t noticed.', 'Someone’s looking.', 'A few laughs from the window.', 'The whole table’s watching.', 'The table’s lost it.'];
let w, h, unit, density;
let cupX = .53;
let tilt = 0;
let coffee = 100;
let stream = 0;
let level = 0;
let drag, hold, lastFrame, audio;
let sound = false;
let finished = false;
let clock = 0;
let nextChatter = 0;

function path(context, points, fill) {
  context.beginPath();
  points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}
function oval(context, x, y, rx, ry, colour) {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, tau);
  context.fillStyle = colour;
  context.fill();
}
function line(context, x, y, endX, endY, width, colour) {
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(endX, endY);
  context.lineWidth = width;
  context.strokeStyle = colour;
  context.stroke();
}
function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function dimensions() {
  const width = Math.min(w * .78, 730);
  return { x: (w - width) / 2, y: h * .135, width, height: h * .385 };
}
function drawBackdrop() {
  const random = rng(214);
  const view = dimensions();
  const wall = scene.createLinearGradient(0, 0, 0, h * .66);
  wall.addColorStop(0, '#eed7ab');
  wall.addColorStop(1, '#c79c73');
  scene.fillStyle = wall;
  scene.fillRect(0, 0, w, h);
  for (let row = 0; row < h * .6; row += 13 * unit) {
    line(scene, 0, row, w, row, 1, '#a77e5a38');
    for (let x = row % 2; x < w; x += 46 * unit) {
      const seam = x + (Math.round(row / (13 * unit)) % 2) * 22 * unit;
      line(scene, seam, row, seam, row + 13 * unit, 1, '#a77e5a38');
    }
  }
  const { x, y, width, height } = view;
  scene.fillStyle = '#513e35';
  scene.fillRect(x - 8 * unit, y - 7 * unit, width + 16 * unit, height + 17 * unit);
  const glass = scene.createLinearGradient(0, y, 0, y + height);
  glass.addColorStop(0, '#2f4140');
  glass.addColorStop(1, '#66574a');
  scene.fillStyle = glass;
  scene.fillRect(x, y, width, height);
  for (let i = 1; i <= 3; i++) {
    const px = x + width * i / 4;
    line(scene, px, y, px, y + height * .21, 1.2, '#b3916d');
    oval(scene, px, y + height * .23, 9 * unit, 4 * unit, '#efbf78');
  }
  const pavement = scene.createLinearGradient(0, h * .54, 0, h);
  pavement.addColorStop(0, '#b8a08c');
  pavement.addColorStop(1, '#8b8174');
  scene.fillStyle = pavement;
  scene.fillRect(0, h * .555, w, h);
  for (const offset of [-.48, -.25, 0, .25, .48]) line(scene, w * (.5 + offset * .6), h * .56, w * (.5 + offset), h, 1, '#665b5363');
  path(scene, [[0,h*.77],[w*.14,h*.66],[w*.84,h*.66],[w,h*.78],[w,h],[0,h]], '#594d40');
  path(scene, [[0,h*.81],[w*.16,h*.69],[w*.85,h*.69],[w,h*.82],[w,h],[0,h]], '#3f4434');
  for (let i = 0; i < 950; i++) {
    const px = random() * w, py = h * (.56 + random() * .44);
    scene.fillStyle = i % 2 ? '#e4ceaa24' : '#332e212b';
    scene.fillRect(px, py, 1 + random() * 4 * unit, 1 + random() * 2 * unit);
  }
  for (let i = 0; i < 17; i++) {
    const px = w * i / 16;
    const py = h * (.735 + random() * .08);
    oval(scene, px, py, w * .056, h * (.047 + random() * .032), '#293e31');
  }
  for (let i = 0; i < 680; i++) {
    const px = random() * w;
    const py = h * (.67 + random() * .24) + Math.sin(px / w * 10) * h * .016;
    const size = (2 + random() * 7) * unit;
    scene.save();
    scene.translate(px, py);
    scene.rotate((random() - .5) * 2.7);
    oval(scene, 0, 0, size, size * .38, ['#405a38','#587344','#77834c','#9a9c56','#304b36'][i % 5]);
    scene.restore();
  }
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  if (w && (w !== rect.width || h !== rect.height)) {
    clearInput();
    droplets.length = splashes.length = 0;
  }
  w = rect.width;
  h = rect.height;
  unit = clamp(Math.min(w / 650, h / 400), .64, 1.45);
  cupX = clamp(cupX, .065, rightEdge());
  density = Math.min(devicePixelRatio || 1, 2);
  canvas.width = backdrop.width = Math.round(w * density);
  canvas.height = backdrop.height = Math.round(h * density);
  ctx.setTransform(density, 0, 0, density, 0, 0);
  scene.setTransform(density, 0, 0, density, 0, 0);
  drawBackdrop();
}
function crowd() {
  const { x, y, width, height } = dimensions();
  const people = ['#a56447','#69798b','#ba8b59','#8e666f','#768764'];
  const skin = ['#a9765d','#d3a280','#895a48','#c89475','#dfb18e'];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  for (let i = 0; i < people.length; i++) {
    const cx = x + width * (.12 + i * .19);
    const active = level > i % 4;
    const size = Math.min(width * .075, height * .2);
    const bounce = active && !reduceMotion.matches ? Math.sin(clock * (5 + level * 2) + i * 1.9) * size * level * .11 : 0;
    const cy = y + height * (.57 - (active ? .07 : 0)) + bounce;
    oval(ctx, cx, cy + size * .92, size * .77, size * .78, people[i]);
    oval(ctx, cx, cy, size * .45, size * .55, skin[i]);
    oval(ctx, cx - size * .06, cy - size * .32, size * .45, size * .26, '#383232');
    if (active) {
      oval(ctx, cx, cy + size * .18, size * .15, size * .095, '#553832');
      if (level >= 3) line(ctx, cx + size * .35, cy + size, cx + size * .83, cy - size * .16, size * .27, skin[i]);
    } else line(ctx, cx - size * .12, cy + size * .16, cx + size * .08, cy + size * .16, 1, '#624338');
  }
  oval(ctx, x + width * .5, y + height * .83, width * .45, height * .12, '#a17d5b');
  for (let i = 0; i < 5; i++) oval(ctx, x + width * (.13 + i * .18), y + height * .8, 4 * unit, 2 * unit, '#e8d8b0');
  path(ctx, [[x,y],[x+width*.24,y],[x+width*.07,y+height],[x,y+height]], '#c7e9d220');
  path(ctx, [[x+width*.61,y],[x+width*.69,y],[x+width*.51,y+height],[x+width*.44,y+height]], '#e4f3e21c');
  for (const f of [1/3,2/3]) line(ctx, x + width * f, y, x + width * f, y + height, 4 * unit, '#665f4f');
  line(ctx, x, y + height * .12, x + width, y + height * .12, 2 * unit, '#a39b794f');
  ctx.restore();
}
function rightEdge() {
  return Math.min(.89, 1 - 85 * unit / w);
}
function cup() {
  const x = cupX * w, y = h * .612;
  const angle = tilt * 2.03;
  const cx = 22 * unit, cy = -32 * unit;
  return { x, y, angle, lipX: x + cx * Math.cos(angle) - cy * Math.sin(angle),
    lipY: y + cx * Math.sin(angle) + cy * Math.cos(angle) };
}
function drawCup(held) {
  ctx.save();
  ctx.lineCap = 'round';
  line(ctx, held.x + 10 * unit, held.y + 13 * unit, w * .64, h + 17 * unit, 27 * unit, '#283c39');
  line(ctx, held.x + 10 * unit, held.y + 13 * unit, w * .64, h + 17 * unit, 19 * unit, '#3b5550');
  ctx.translate(held.x, held.y);
  ctx.rotate(held.angle);
  const body = ctx.createLinearGradient(-23 * unit, 0, 24 * unit, 0);
  body.addColorStop(0, '#ae865e');
  body.addColorStop(.35, '#ead4a6');
  body.addColorStop(1, '#c59b6a');
  path(ctx, [[-24,-32],[24,-32],[16,29],[-16,29]].map(([x,y])=>[x*unit,y*unit]), body);
  path(ctx, [[-21,-12],[21,-12],[18,12],[-18,12]].map(([x,y])=>[x*unit,y*unit]), '#987453');
  oval(ctx, 0, -32 * unit, 24 * unit, 7 * unit, '#f6e5c4');
  oval(ctx, 0, -32 * unit, 21 * unit, 5 * unit, coffee > .1 ? '#4c3026' : '#93704f');
  oval(ctx, 13 * unit, 11 * unit, 13 * unit, 7 * unit, '#bd9070');
  line(ctx, 8 * unit, 10 * unit, 18 * unit, 8 * unit, 1.5 * unit, '#dfac88');
  ctx.restore();
}
function tone(pitch, duration, volume) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * .65, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(now + duration);
  } catch { /* Audio is optional. */ }
}
function clearInput() {
  keys.clear();
  drag = hold = null;
}
function reset() {
  clearInput();
  cupX = .53;
  tilt = stream = level = nextChatter = 0;
  coffee = 100;
  finished = false;
  droplets.length = splashes.length = patches.length = 0;
  el('coffee').value = coffee;
  el('reaction').textContent = reactions[0];
  el('finish').hidden = true;
  el('pour').hidden = false;
  canvas.focus({preventScroll:true});
}
function hit(drop) {
  if (patches.length > 190) patches.shift();
  patches.push({ x: drop.x / w, y: drop.y / h, size: 1 + Math.random() * 4 });
  if (!reduceMotion.matches) {
    for (let i = 0; i < 2; i++) splashes.push({ x:drop.x,y:drop.y,vx:(Math.random()-.5)*75*unit,vy:-35*unit,life:.22 });
  }
}
function simulate(dt) {
  const movement = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  cupX = clamp(cupX + movement * dt * .44, .065, rightEdge());
  const desired = finished ? 0 : (hold != null || keys.has('Space') ? 1 : drag?.tilt ?? 0);
  tilt += (desired - tilt) * Math.min(1, dt * 11);
  const held = cup();
  const pourThreshold = .39 + (100 - coffee) * .0012;
  const flow = coffee > 0 ? clamp((tilt - pourThreshold) / .55, 0, 1) : 0;
  if (flow > 0) {
    coffee = Math.max(0, coffee - 24 * flow * dt);
    el('coffee').value = coffee;
    stream += dt * 110 * flow;
    while (stream >= 1) {
      stream--;
      droplets.push({ x: held.lipX, y: held.lipY, vx:(44 + 55 * tilt + Math.random()*15)*unit,
        vy:(10 + Math.random()*22)*unit, ground:h*(.72 + Math.random()*.13), size:(1.3 + Math.random()*1.45)*unit });
    }
    const next = coffee < 16 ? 4 : coffee < 40 ? 3 : coffee < 65 ? 2 : coffee < 87 ? 1 : 0;
    if (next !== level) {
      level = next;
      el('reaction').textContent = reactions[level];
    }
    if (clock > nextChatter) {
      tone(105 + level * 28 + Math.random() * 45, .12 + level * .025, .025 + level * .009);
      nextChatter = clock + .55 - level * .075;
    }
  }
  for (let i = droplets.length - 1; i >= 0; i--) {
    const drop = droplets[i];
    drop.x += drop.vx * dt;
    drop.vy += 950 * unit * dt;
    drop.y += drop.vy * dt;
    if (drop.y >= drop.ground || drop.x > w) {
      if (drop.x < w) hit(drop);
      droplets.splice(i,1);
    }
  }
  for (let i = splashes.length - 1; i >= 0; i--) {
    const drop = splashes[i];
    drop.life -= dt;
    if (drop.life <= 0) { splashes.splice(i,1); continue; }
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.vy += 450 * unit * dt;
  }
  if (!finished && coffee === 0 && droplets.length === 0) {
    finished = true;
    const shouldFocus = document.activeElement === canvas || document.activeElement === el('pour');
    el('finish').hidden = false;
    el('pour').hidden = true;
    if (shouldFocus) el('again').focus({preventScroll:true});
  }
  return held;
}
function frame(time) {
  const dt = clamp((time - (lastFrame ?? time)) / 1000, 0, .04);
  lastFrame = time;
  clock += dt;
  if (w && h) {
    const held = simulate(dt);
    ctx.drawImage(backdrop,0,0,w,h);
    crowd();
    for (const patch of patches) oval(ctx,patch.x*w,patch.y*h,patch.size*unit,patch.size*.4*unit,'#34291b38');
    for (const drop of droplets) {
      line(ctx,drop.x,drop.y,drop.x-drop.vx*.014,drop.y-drop.vy*.014,drop.size*1.3,'#633e2b');
      oval(ctx,drop.x,drop.y,drop.size*.6,drop.size*.7,'#ad7446');
    }
    for (const drop of splashes) oval(ctx,drop.x,drop.y,1.2*unit,1.2*unit,'#ac7650');
    drawCup(held);
  }
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || finished) return;
  canvas.focus({preventScroll:true});
  canvas.setPointerCapture(event.pointerId);
  drag = { id:event.pointerId, x:event.clientX, y:event.clientY, cupX, tilt:0 };
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  cupX = clamp(drag.cupX + (event.clientX - drag.x) / w, .065, rightEdge());
  drag.tilt = clamp((event.clientY - drag.y) / Math.min(h * .27, 122), 0, 1);
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) {
  canvas.addEventListener(name,event => { if (drag?.id === event.pointerId) drag = null; });
  el('pour').addEventListener(name,event => { if (hold === event.pointerId) hold = null; });
}
el('pour').addEventListener('pointerdown',event => {
  if (event.button !== 0 || finished) return;
  el('pour').setPointerCapture(event.pointerId);
  hold = event.pointerId;
});
for (const control of [canvas, el('pour')]) {
  control.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Space'].includes(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  control.addEventListener('blur',clearInput);
}
window.addEventListener('keyup',event => keys.delete(event.code));
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',() => { if (document.hidden) clearInput(); });
el('reset').addEventListener('click',reset);
el('again').addEventListener('click',reset);
el('sound').addEventListener('click',() => {
  sound = !sound;
  el('sound').setAttribute('aria-pressed',String(sound));
  el('sound').textContent = sound ? 'Sound on' : 'Sound off';
  if (sound) tone(195,.15,.05);
});
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);

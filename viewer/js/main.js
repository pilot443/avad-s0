// Авад S-0: 3D-просмотр модели РД (ред. Г, модель v2.6) в браузере. Стадия: концепция (FEL-1); это показ, а не чертёж и не расчёт.
// Данные: data/model.json и data/model.bin готовит инструменты/универсал_веб_экспорт.py (детали в системе своих тел, дерево суставов, позы, числа модели).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { buildSkin } from './skin.js';
import { Gait } from './gait.js';

const $ = (s) => document.querySelector(s);
const rad = (g) => (g * Math.PI) / 180;
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const MM = 0.001;
const OMEGA0 = 4.72; // рад/с, серво STS3215 без нагрузки [И, данные продавцов]
// наборы серво по суставам: скорость без нагрузки, рад/с [И: Robotshop, Waveshare, ROBOTIS e-manual]; расчёт — v22/СЕРВО-варианты.md
const SERVO_SETS = {
  'Ноги S-0 v2.6: поворот ST3215-HS, бедро и колено STS3250 (12 В)': { yaw: 11.14, hip: 7.87, knee: 7.87 },
  'STS3215 везде (сейчас)': { yaw: 4.72, hip: 4.72, knee: 4.72 },
  'Бедро и колено XM430-W210, поворот STS3215 (12 В)': { yaw: 4.72, hip: 8.06, knee: 8.06 },
  'Поворот HS, бедро и колено XM430-W210 (14,8 В)': { yaw: 11.14, hip: 9.95, knee: 9.95 },
  'Все ST3215-HS (12 В)': { yaw: 11.14, hip: 11.14, knee: 11.14 },
};
const JOINT_NAMES = { yaw: 'поворот бедра', hip: 'подъём бедра', knee: 'колено' };
const maxRatio = (g) => { const s = SERVO_SETS[document.querySelector('#servo')?.value] ?? SERVO_SETS['STS3215 везде (сейчас)']; return Math.max(...['yaw', 'hip', 'knee'].map((j) => g.peakT[j] / s[j])); };

const VER = new URLSearchParams(location.search).get('v') || 'A';
const SUF = VER === 'A' ? '' : '-' + VER;
const [data, buf] = await Promise.all([fetch(`data/model${SUF}.json`).then((r) => r.json()), fetch(`data/model${SUF}.bin`).then((r) => r.arrayBuffer())]);
document.querySelectorAll('#vers a').forEach((a) => a.classList.toggle('on', a.dataset.v === VER));

// ------------------------------------------------------------------ сцена
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.style.background = 'radial-gradient(ellipse at 60% 40%, #232a35 0%, #12161c 55%, #0a0c10 100%)';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 60);
camera.position.set(0.9, 0.5, -0.95);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0.04, 0.2, 0); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.12; controls.maxDistance = 6; controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.9;

function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 p; void main(){ float h=normalize(p).y; vec3 top=vec3(.30,.38,.52); vec3 hor=vec3(.80,.60,.46); vec3 bot=vec3(.05,.06,.08); vec3 c = h>0. ? mix(hor,top,pow(h,.5)) : mix(hor*.35,bot,pow(-h,.4)); gl_FragColor=vec4(c,1.);}',
  })));
  const panel = (w, h, pos, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.96), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
  panel(16, 9, new THREE.Vector3(8, 12, 6), 7); panel(7, 11, new THREE.Vector3(-12, 6, -8), 4); panel(12, 3, new THREE.Vector3(0, 4, -14), 3);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.02).texture; pm.dispose(); return tex;
}
scene.environment = makeEnv(renderer);

function stage(scene) {
const key = new THREE.DirectionalLight(0xfff1dd, 2.6); key.position.set(1.6, 2.4, -1.0); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.5, far: 6 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002;
scene.add(key);
const rim = new THREE.DirectionalLight(0x78a8ff, 1.3); rim.position.set(-1.5, 1.2, 1.4); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x8fa9d0, 0x20242c, 0.55));

// пол: тень, мягкое пятно, сетка
const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.5 })); floorShadow.rotation.x = -Math.PI / 2; floorShadow.receiveShadow = true; scene.add(floorShadow);
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(70,86,110,.55)'); g.addColorStop(0.6, 'rgba(40,50,64,.28)'); g.addColorStop(1, 'rgba(20,24,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = -0.0005; scene.add(disc);
}
const grid = new THREE.GridHelper(8, 80, 0x3a4658, 0x232b37); grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = 0.0002; scene.add(grid);
  return { key, grid };
}
const { key } = stage(scene); scene.add(key.target);


// ------------------------------------------------------------------ робот: тела и суставы
const world = new THREE.Group(); scene.add(world);
const robot = new THREE.Group(); robot.rotation.x = -Math.PI / 2; robot.scale.setScalar(MM); world.add(robot); // система модели: X вперёд, Y влево, Z вверх, мм
const bodies = {}, bodyData = {}, joints = {};
for (const b of data.тела) {
  const g = new THREE.Group(); g.name = b.имя; bodies[b.имя] = g; bodyData[b.имя] = b;
  if (b.родитель) { const pp = bodyData[b.родитель].точка; g.position.set(b.точка[0] - pp[0], b.точка[1] - pp[1], b.точка[2] - pp[2]); bodies[b.родитель].add(g); } else robot.add(g);
  if (b.сустав) joints[b.сустав] = { group: g, axis: new THREE.Vector3(...b.ось).normalize(), limits: b.предел, servos: b.серво };
}

// ------------------------------------------------------------------ детали каркаса
const partMeshes = [], partById = {};
const graphite = new THREE.Color(0x262a31);
for (const p of data.детали) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, p.в[0], p.в[1] * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, p.и[0], p.и[1] * 3), 1));
  geo.computeVertexNormals();
  const c = data.палитра[p.цвет] ?? [0.5, 0.5, 0.5];
  const base = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const metal = p.цвет === 'серво' ? 0.55 : p.вид === 'покупное' ? 0.3 : 0.22;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: base.clone(), metalness: metal, roughness: 0.55, side: THREE.DoubleSide }));
  const pt = bodyData[p.тело].точка;
  mesh.userData = { p, base, c0: [(p.габ[0][0] + p.габ[1][0]) / 2 + pt[0], (p.габ[0][1] + p.габ[1][1]) / 2 + pt[1], (p.габ[0][2] + p.габ[1][2]) / 2 + pt[2]] };
  mesh.castShadow = true; mesh.receiveShadow = true;
  bodies[p.тело].add(mesh); partMeshes.push(mesh); partById[p.ид] = p;
}
const boxOf = (p) => { const pt = bodyData[p.тело].точка; return [[0, 1, 2].map((i) => p.габ[0][i] + pt[i]), [0, 1, 2].map((i) => p.габ[1][i] + pt[i])]; };
document.title = `Авад S-0 — 3D (${data.детали.length} деталей${VER === 'A' ? ', v2.6' : VER === 'V21' ? ', v2.1' : ', вариант ' + VER})`;

// ------------------------------------------------------------------ облицовка
const skinHolders = [];
function addAbs(bodyName, obj, label = '') {
  if (!bodyData[bodyName] && bodyName.startsWith('grip')) bodyName = 'arm' + bodyName.slice(4) + '5';
  const holder = new THREE.Group(); const pt = bodyData[bodyName].точка; holder.position.set(-pt[0], -pt[1], -pt[2]);
  holder.add(obj); holder.userData.label = label; bodies[bodyName].add(holder); skinHolders.push(holder); return holder;
}
buildSkin(THREE, { Z: data.Z, J: data.J, addAbs, boxOf, parts: partById });
const glowSprites = []; for (const h of skinHolders) h.traverse((o) => { if (o.userData.glow) glowSprites.push(o); });

// ------------------------------------------------------------------ размеры версии, кольца и масштабные метки
const dims = (() => {
  let Rmax = 0, zmax = 0;
  for (const m of partMeshes) {
    const p = m.userData.p, pt = bodyData[p.тело].точка, pos = m.geometry.attributes.position, leg = p.узел.startsWith('нога-');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + pt[0], y = pos.getY(i) + pt[1], z = pos.getZ(i) + pt[2];
      if (leg) Rmax = Math.max(Rmax, Math.hypot(x, y));
      zmax = Math.max(zmax, z);
    }
  }
  const Z = data.Z, L1 = Math.hypot(Z['нога.колено_R'] - Z['корень_ноги.R'], Z['нога.колено_z'] - Z['корень_ноги.z']), L2 = Math.hypot(Z['нога.стопа_R'] - Z['нога.колено_R'], Z['нога.колено_z']);
  return { Rmax, zmax, L1, L2 };
})();
$('#verinfo').innerHTML = `<b>Круг ног Ø${Math.round(2 * dims.Rmax)} мм</b> · высота ${Math.round(dims.zmax)} мм · бедро ${Math.round(dims.L1)} / голень ${Math.round(dims.L2)} мм · масса деталей ${(data.масса_деталей_г / 1000).toFixed(2)} кг<br>Модель v2.6, РД ред. Г: поворот бедра — ST3215-HS, подъём бедра — два STS3250, колено — STS3250. Серое кольцо — Ø400 для масштаба.`;
const scaleGroup = new THREE.Group(); scene.add(scaleGroup);
const ringGroup = new THREE.Group(); world.add(ringGroup);
function textSprite(text, size = 0.07, color = '#cfd6e0') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = 'bold 30px Segoe UI, sans-serif'; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(size * 4, size, 1); return s;
}
function ring(rMm, color, dashed, label) {
  const pts = []; for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rMm * MM, 0.0008, Math.sin(a) * rMm * MM)); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.012, gapSize: 0.01 }) : new THREE.LineBasicMaterial({ color }));
  if (dashed) l.computeLineDistances(); ringGroup.add(l);
  const t = textSprite(label, 0.035, '#' + new THREE.Color(color).getHexString()); t.position.set(0, 0.004, rMm * MM + 0.03); ringGroup.add(t);
}
ring(200, 0x8c95a3, true, 'Ø400 — прежний предел');
ring(dims.Rmax, 0x3b8d94, false, `круг ног Ø${Math.round(2 * dims.Rmax)}`);
{   // линейка 500 мм с делениями и куб 100 мм рядом с роботом (слева по ходу)
  const z0 = -0.62, mat = new THREE.LineBasicMaterial({ color: 0xe6e9ee });
  scaleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0.001, z0), new THREE.Vector3(0.3, 0.001, z0)]), mat));
  for (let i = 0; i <= 5; i++) {
    const x = -0.2 + i * 0.1;
    scaleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.001, z0), new THREE.Vector3(x, 0.001, z0 + 0.02)]), mat));
    const t = textSprite(i === 0 ? '0' : `${i * 100}`, 0.03); t.position.set(x, 0.008, z0 + 0.045); scaleGroup.add(t);
  }
  const unit = textSprite('мм', 0.03, '#8c95a3'); unit.position.set(0.35, 0.008, z0 + 0.045); scaleGroup.add(unit);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.7, metalness: 0.1 })); cube.position.set(-0.32, 0.05, z0 + 0.02); cube.castShadow = true; scaleGroup.add(cube);
  const ct = textSprite('куб 100 мм', 0.03); ct.position.set(-0.32, 0.12, z0 + 0.02); scaleGroup.add(ct);
}
const applyScale = () => { scaleGroup.visible = ringGroup.visible = $('#L-scale').checked; };
$('#L-scale').onchange = applyScale; applyScale();

// ------------------------------------------------------------------ слои и оформление
function restyle() {
  const skin = $('#L-skin').checked;
  for (const m of partMeshes) {
    const p = m.userData.p; const col = m.userData.base.clone();
    if (skin) {
      if (p.ид === 'контейнер') col.set(0x8793a6);
      else if (p.ид === 'балласт') col.set(0x2a2d33);
      else if (p.цвет !== 'держатель' && p.цвет !== 'антенна' && p.группа !== 'Контейнер') col.lerp(graphite, p.цвет === 'серво' ? 0.25 : 0.55);
    }
    m.userData.col = col; if (!m.userData.sel) m.material.color.copy(col);
  }
}
function layers() {
  const frame = $('#L-frame').checked, skin = $('#L-skin').checked, cont = $('#L-cont').checked, explode = +$('#explode').value > 0.02;
  for (const m of partMeshes) { const g = m.userData.p.группа; m.visible = g === 'Контейнер' ? cont : frame; }
  for (const h of skinHolders) h.visible = skin && !explode && (h.userData.label !== 'контейнер' || cont);
  for (const s of glowSprites) s.visible = $('#L-glow').checked;
  restyle(); isolateRefresh();
}
function explodeApply() {
  const k = +$('#explode').value, C = [0, 0, 200];
  for (const m of partMeshes) { const c = m.userData.c0; m.position.set((c[0] - C[0]) * k, (c[1] - C[1]) * k, (c[2] - C[2]) * k); }
  layers();
}

// ------------------------------------------------------------------ выбор детали и дерево
let selected = null;
function isolateRefresh() {
  const iso = $('#iso').checked && selected;
  for (const m of partMeshes) {
    const ghost = iso && m !== selected && m.visible;
    m.material.transparent = !!ghost; m.material.opacity = ghost ? 0.1 : 1; m.material.depthWrite = !ghost;
  }
}
function select(mesh) {
  if (selected) { selected.userData.sel = false; selected.material.color.copy(selected.userData.col ?? selected.userData.base); selected.material.emissive.setHex(0); }
  selected = mesh;
  document.querySelectorAll('#tree .part.sel').forEach((e) => e.classList.remove('sel'));
  if (mesh) {
    mesh.userData.sel = true; mesh.material.emissive.setHex(0x8a3d00); mesh.material.emissiveIntensity = 0.8;
    const p = mesh.userData.p; const el = document.querySelector(`#tree .part[data-id="${CSS.escape(p.ид)}"]`);
    if (el) { el.classList.add('sel'); el.parentElement.open = true; el.scrollIntoView({ block: 'nearest' }); }
    const b = boxOf(p), sz = [0, 1, 2].map((i) => Math.round(b[1][i] - b[0][i]));
    $('#info').innerHTML = `<b>${p.имя}</b><br>${p.обозн ? 'обозначение: <b>' + p.обозн + '</b><br>' : ''}${p.вид === 'покупное' ? 'покупное изделие' : 'собственная деталь'} · ${p.мат}<br>масса ${p.масса_г} г · габарит ${sz[0]}×${sz[1]}×${sz[2]} мм<br>тело: ${p.тело} · узел: ${p.узел}`;
  } else $('#info').textContent = 'Нажми на деталь на экране или в списке.';
  isolateRefresh();
}
{
  const order = ['Корпус', 'Контейнер', 'Голова', 'Нога 1', 'Нога 2', 'Нога 3', 'Нога 4', 'Нога 5', 'Нога 6', 'Рука левая', 'Рука правая'];
  const groups = {};
  for (const m of partMeshes) (groups[m.userData.p.группа] ??= []).push(m);
  const names = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 100) % 100 - (order.indexOf(b) + 100) % 100);
  const tree = $('#tree');
  for (const g of names) {
    const d = document.createElement('details'); const s = document.createElement('summary');
    const mass = groups[g].reduce((a, m) => a + m.userData.p.масса_г, 0);
    s.textContent = `${g} · ${groups[g].length} шт · ${Math.round(mass)} г`; d.appendChild(s);
    for (const m of groups[g].sort((a, b) => a.userData.p.имя.localeCompare(b.userData.p.имя, 'ru'))) {
      const e = document.createElement('div'); e.className = 'part'; e.dataset.id = m.userData.p.ид; e.dataset.q = (m.userData.p.имя + ' ' + m.userData.p.ид + ' ' + m.userData.p.обозн).toLowerCase();
      e.innerHTML = `<span>${m.userData.p.имя}</span><i>${m.userData.p.масса_г} г</i>`; e.onclick = () => select(m); d.appendChild(e);
    }
    tree.appendChild(d);
  }
  $('#count').textContent = `· ${data.детали.length} шт · ${(data.масса_деталей_г / 1000).toFixed(2)} кг`;
  $('#find').oninput = (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    tree.querySelectorAll('.part').forEach((e) => { e.style.display = !q || e.dataset.q.includes(q) ? '' : 'none'; });
    tree.querySelectorAll('details').forEach((d) => { if (q) d.open = [...d.querySelectorAll('.part')].some((e) => e.style.display !== 'none'); });
  };
}
// выбор кликом по детали (без перетаскивания)
{
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(partMeshes.filter((m) => m.visible), false)[0];
    select(hit ? hit.object : null);
  });
}

// ------------------------------------------------------------------ позы и суставы
const ang = {}, tgt = {};
for (const n of Object.keys(joints)) ang[n] = tgt[n] = 0;
const poseNames = { 'стойка': 'Стойка', 'прямо': 'Руки прямо', 'шаг': 'Шаг', 'работа': 'Работа', 'взял контейнер': 'Взял контейнер' };
let curPose = 'стойка';
function setPose(name) {
  curPose = name;
  for (const n of Object.keys(tgt)) tgt[n] = data.позы[name]?.[n] ?? 0;
  document.querySelectorAll('#poses button').forEach((b) => b.classList.toggle('on', b.dataset.pose === name));
}
for (const name of Object.keys(data.позы)) {
  const b = document.createElement('button'); b.textContent = poseNames[name] ?? name; b.dataset.pose = name; b.onclick = () => { if (walking) setWalking(false); setPose(name); }; $('#poses').appendChild(b);
}
setPose('стойка');
for (const n of Object.keys(ang)) ang[n] = tgt[n];

// ------------------------------------------------------------------ ходьба
const limitsByJoint = {}; for (const [n, j] of Object.entries(joints)) if (j.limits) limitsByJoint[n] = j.limits;
const gait = new Gait(data.Z, limitsByJoint);
gait.radius = data.Z['нога.стопа_R'] - 6; // середина хода на 6 мм внутрь от стойки (как в расчёте); раньше было 174 мм — число v2.1
let walking = false, cruise = false, walkT = 0, px = 0, py = 0, yaw = 0;
const keys = {};
function setWalking(on, withCruise = false) {
  walking = on; cruise = on && withCruise; walkT = 0; $('#walk').textContent = on ? 'Стоять' : 'Идти'; $('#walk').classList.toggle('on', on);
  if (on) { document.querySelectorAll('#poses button').forEach((b) => b.classList.remove('on')); if (!['стойка', 'прямо', 'работа', 'взял контейнер'].includes(curPose)) setPose('стойка'); }
  else gait.command = [0, 0, 0];
}
$('#walk').onclick = () => { if (walking) setWalking(false); else setWalking(true, true); };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'search') return;
  keys[e.code] = true;
  if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code) && !walking) setWalking(true);
  if (e.code === 'Space') { e.preventDefault(); cruise = false; for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE']) keys[k] = false; }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
{   // умолчания хода по версии модели: v2.2 — шаг 45 мм, самый быстрый цикл 1,17 с (7,7 см/с при 70 % скорости серво); v2.1 — 27,5 мм и 0,92 с
  const DEF = VER === 'V21' ? { T0: 0.92, stroke: 27.5 } : { T0: 1.17, stroke: 45 };
  $('#stroke').max = 65; $('#stroke').value = DEF.stroke; $('#T0').value = DEF.T0;
}
const servoSel = $('#servo'); for (const k of Object.keys(SERVO_SETS)) { const o = document.createElement('option'); o.textContent = k; servoSel.appendChild(o); }
servoSel.value = 'Ноги S-0 v2.6: поворот ST3215-HS, бедро и колено STS3250 (12 В)';   // для v2.2 принят набор 8 (30.10.2026)
const meters = {}; for (const j of ['yaw', 'hip', 'knee']) { const d = document.createElement('div'); d.className = 'meter'; d.innerHTML = '<div></div><span></span>'; $('#meters').appendChild(d); meters[j] = d; }
for (const [id, prop, fmt] of [['T0', 'T0', (v) => v.toFixed(2) + ' с'], ['stroke', 'stroke', (v) => v.toFixed(1) + ' мм'], ['lift', 'lift', (v) => v.toFixed(0) + ' мм']]) {
  const el = $('#' + id), lab = $('#' + id + 'v'); const upd = () => { gait[prop] = +el.value; lab.textContent = fmt(+el.value); }; el.oninput = upd; upd();
}

// ------------------------------------------------------------------ панель и камера
const views = {
  '3/4 спереди': [[0.9, 0.5, -0.95], [0.04, 0.2, 0]], 'Спереди': [[1.2, 0.3, 0.02], [0.05, 0.22, 0]], 'Сбоку': [[0.06, 0.3, -1.25], [0.06, 0.2, 0]],
  'Сзади': [[-1.15, 0.38, -0.2], [0.04, 0.22, 0]], 'Сверху': [[0.05, 1.35, 0.002], [0.05, 0.1, 0]], 'Голова': [[0.62, 0.3, -0.34], [0.17, 0.22, 0]], 'Нога': [[0.42, 0.16, -0.40], [0.15, 0.07, -0.09]], 'Рука': [[0.5, 0.4, -0.52], [0.28, 0.18, -0.13]],
};
function setView(name) { const v = views[name]; if (!v) return; camera.position.set(...v[0]); controls.target.set(...v[1]); controls.update(); }
for (const n of Object.keys(views)) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => setView(n); $('#views').appendChild(b); }

$('#hidepanel').onclick = () => document.body.classList.add('nopanel');
$('#showpanel').onclick = () => document.body.classList.remove('nopanel');
for (const id of ['L-skin', 'L-frame', 'L-cont', 'L-glow', 'iso']) $('#' + id).onchange = layers;
$('#explode').oninput = explodeApply;
$('#spin').onchange = (e) => { controls.autoRotate = e.target.checked; };
$('#shot').onclick = () => {
  renderer.render(scene, camera);
  canvas.toBlob((bl) => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `avad-s0-${Date.now()}.png`; a.click(); URL.revokeObjectURL(a.href); });
};
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); new ResizeObserver(resize).observe(canvas); resize();
layers();


function secondView() {}

// ------------------------------------------------------------------ цикл
let last = performance.now(), tAll = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now; tAll += dt;
  const gaitAngles = {};
  if (walking) {
    walkT += dt;
    const fast = keys.ShiftLeft || keys.ShiftRight ? 1 : 0.6;
    let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), t = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), s = (keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0);
    if (!f && !t && !s && cruise) f = 1; // кнопка «Идти»: ровный ход вперёд, пока не нажат «Пробел» или другая клавиша хода
    gait.command = [f * gait.vmax * fast, s * gait.vmax * fast * 0.7, t * (gait.umaxLimit / 190) * fast];
    Object.assign(gaitAngles, gait.step(dt));
    yaw += gait.cur[2] * dt;
    px += (gait.cur[0] * Math.cos(yaw) - gait.cur[1] * Math.sin(yaw)) * dt * 1000;
    py += (gait.cur[0] * Math.sin(yaw) + gait.cur[1] * Math.cos(yaw)) * dt * 1000;
    world.position.set(px * MM, 0, -py * MM); world.rotation.y = yaw;
    const wp = new THREE.Vector3(world.position.x, 0.2, world.position.z).add(new THREE.Vector3(0.0, 0, 0));
    const d = wp.clone().sub(controls.target).multiplyScalar(1 - Math.exp(-dt / 0.25));
    controls.target.add(d); camera.position.add(d);
  }
  const k = 1 - Math.exp(-dt / 0.14);
  for (const [name, j] of Object.entries(joints)) {
    let target = tgt[name] ?? 0;
    if ($('#scan').checked) { if (name === 'head_pan') target = 15 * Math.sin(tAll * 0.55); if (name === 'head_tilt') target = 4 * Math.sin(tAll * 0.9 + 1); }
    if (walking && gaitAngles[name] !== undefined) {
      const kk = walkT < 0.5 ? 1 - Math.exp(-dt / 0.08) : 1; ang[name] += (gaitAngles[name] - ang[name]) * kk;
    } else ang[name] += (target - ang[name]) * k;
    j.group.quaternion.setFromAxisAngle(j.axis, rad(ang[name]));
  }
  // показания
  const v = walking ? Math.hypot(gait.cur[0], gait.cur[1]) : 0;
  const sset = SERVO_SETS[servoSel.value];
  let ratio = 0;
  for (const j of ['yaw', 'hip', 'knee']) { const r_ = walking ? gait.peakT[j] / sset[j] : 0; ratio = Math.max(ratio, r_); meters[j].firstChild.style.width = clamp(r_, 0, 1) * 100 + '%'; meters[j].lastChild.textContent = `${JOINT_NAMES[j]}: ${Math.round(r_ * 100)} % скорости серво (${sset[j].toFixed(1)} рад/с)`; }
  $('#status').textContent = !walking ? '' : gait.warn ? '⚠ ' + gait.warn : ratio > 0.7 ? '⚠ выше 70 % скорости серво: под нагрузкой не удержит' : gait.scale < 0.999 ? 'команда урезана по ходу опоры' : 'в пределах модели';
  $('#hv').textContent = walking ? `v = ${(v * 100).toFixed(1)} см/с · цикл ${(gait.T ?? gait.T0).toFixed(2)} с · шаг ${(gait.stroke * 2).toFixed(0)} мм` : `поза: ${poseNames[curPose] ?? curPose}`;
  key.position.set(world.position.x + 1.6, 2.4, world.position.z - 1.0); key.target.position.set(world.position.x, 0, world.position.z);
  secondView(dt, walking ? gait.command.slice() : [0, 0, 0]);
  controls.update(); renderer.render(scene, camera); requestAnimationFrame(safeFrame);
}
let frameErrors = 0;
function safeFrame(now) {   // ошибка в кадре не должна убивать весь цикл: пишем в консоль (не чаще 5 раз) и идём дальше
  try { frame(now); } catch (e) { if (frameErrors++ < 5) console.error('ошибка кадра:', e && e.stack ? e.stack : e); requestAnimationFrame(safeFrame); }
}
requestAnimationFrame(safeFrame);

window.__avad = { THREE, scene, camera, controls, renderer, robot, world, bodies, joints, partMeshes, skinHolders, gait, setPose, setWalking, select, layers, data, ang, tgt };

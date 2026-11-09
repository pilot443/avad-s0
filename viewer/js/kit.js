// Общие заготовки для облицовки Авада и реконструкции игрового краба: формы со скосами, процедурные текстуры (потёртая броня, панели контейнера), свечение линз.
// Всё рисуется кодом, внешних файлов нет. Стадия: концепция (FEL-1).

export function makeKit(T) {
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const prng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const canvasTex = (S, paint, repeat) => {
    const c = document.createElement('canvas'); c.width = c.height = S; paint(c.getContext('2d'), S);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); } return t;
  };
  const armorTex = (seed, tint) => canvasTex(512, (x, S) => {
    const r = prng(seed); x.fillStyle = tint; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) { const rr = 4 + r() * r() * 30; x.fillStyle = `rgba(${70 + r() * 20 | 0},${68 + r() * 18 | 0},${66 + r() * 18 | 0},${0.025 + r() * 0.09})`; x.beginPath(); x.ellipse(r() * S, r() * S, rr, rr * (0.5 + r() * 0.7), r() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(24,22,20,${0.3 + r() * 0.4})`; x.beginPath(); x.arc(r() * S, r() * S, 1 + r() * 2.4, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; for (let i = 0; i < 70; i++) { const a = r() * S, b = r() * S, l = 10 + r() * 50, g = r() * 6.28; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(g) * l, b + Math.sin(g) * l); x.stroke(); }
  }, 1 / 85);
  const faceTex = (seed, yellow) => canvasTex(512, (x, S) => {
    const r = prng(seed); x.fillStyle = '#7a8699'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#4e596b'; x.beginPath(); x.moveTo(16, S - 16); x.lineTo(S - 16, S - 16); x.lineTo(S - 16, 16); x.closePath(); x.fill();
    if (yellow) { x.fillStyle = '#f0c030'; x.beginPath(); x.moveTo(300, 250); x.lineTo(360, 250); x.lineTo(360, 190); x.closePath(); x.fill(); x.fillStyle = '#d8d8d0'; x.beginPath(); x.moveTo(300, 250); x.lineTo(300, 190); x.lineTo(360, 190); x.closePath(); x.globalAlpha = 0.5; x.fill(); x.globalAlpha = 1; }
    for (let i = 0; i < 380; i++) { const rr = 2 + r() * r() * 30; x.fillStyle = `rgba(${20 + r() * 30 | 0},${20 + r() * 20 | 0},${24 + r() * 20 | 0},${0.04 + r() * 0.16})`; x.beginPath(); x.ellipse(r() * S, r() * S, rr, rr * (0.4 + r() * 0.6), r() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 22; i++) { const gx = r() * S; const g = x.createLinearGradient(0, 0, 0, S * (0.3 + r() * 0.5)); g.addColorStop(0, 'rgba(18,16,14,.22)'); g.addColorStop(1, 'rgba(18,16,14,0)'); x.fillStyle = g; x.fillRect(gx, 0, 2 + r() * 5, S); }
    x.strokeStyle = 'rgba(12,14,18,.9)'; x.lineWidth = 7; x.strokeRect(8, 8, S - 16, S - 16); x.lineWidth = 3; x.strokeRect(44, 44, S - 88, S - 88);
    x.beginPath(); x.moveTo(S / 2, 44); x.lineTo(S / 2, S - 44); x.moveTo(44, S / 2); x.lineTo(S - 44, S / 2); x.stroke();
    x.fillStyle = '#20252d'; for (let i = 0; i < 9; i++) for (const [a, b] of [[26, 26 + i * 57], [S - 26, 26 + i * 57], [26 + i * 57, 26], [26 + i * 57, S - 26]]) { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1.2; for (let i = 0; i < 90; i++) { const a = r() * S, b = r() * S, l = 8 + r() * 60, g = r() * 6.28; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(g) * l, b + Math.sin(g) * l); x.stroke(); }
  });
  // ---------- заготовки формы
  function roundRect(w, h, r) {
    const s = new T.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI); return s;
  }
  const extrude = (shape, depth, b) => { const g = new T.ExtrudeGeometry(shape, { depth: Math.max(depth - 2 * b, 0.4), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -(depth - 2 * b) / 2); return g; };
  const turn = (g, bx, by, bz) => { g.applyMatrix4(new T.Matrix4().makeBasis(bx, by, bz)); return g; }; // базис: образы осей X, Y, Z формы
  // скошенная плита (ось Z — толщина): w × h × d с центром в нуле
  const plateXY = (w, h, d, b = 2.5, r = 6) => extrude(roundRect(w - 2 * b, h - 2 * b, r), d, b);
  // оболочка звена: длина по X, толщина по Y, высота по Z
  const shellXZ = (len, thick, height, r = 10) => turn(extrude(roundRect(len - 8, height - 8, r), thick, 4), V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
  // плита на грани, перпендикулярной X: ширина по Y, высота по Z, толщина по X
  const plateYZ = (w, h, d, b = 2.2, r = 8) => turn(extrude(roundRect(w - 2 * b, h - 2 * b, r), d, b), V(0, 1, 0), V(0, 0, 1), V(1, 0, 0));
  // каплевидная плита: ширина по X, вершина при y = 0, остриё при y = −L
  function dropShape(w, L, tip) {
    const hw = w / 2, s = new T.Shape();
    s.moveTo(-hw * 0.82, 0); s.lineTo(hw * 0.82, 0);
    s.bezierCurveTo(hw * 1.06, -L * 0.1, hw * 1.0, -L * 0.55, hw * tip, -L); s.lineTo(-hw * tip, -L);
    s.bezierCurveTo(-hw * 1.0, -L * 0.55, -hw * 1.06, -L * 0.1, -hw * 0.82, 0); return s;
  }
  // коготь: длина по X, изгиб острия вверх (+Z), толщина по Y
  function clawGeo(len, wid, thick) {
    const s = new T.Shape(); s.moveTo(0, -wid / 2); s.lineTo(len * 0.68, -wid / 2); s.quadraticCurveTo(len * 0.97, -wid * 0.12, len, wid * 0.62); s.lineTo(len * 0.6, wid * 0.55); s.lineTo(0, wid / 2); s.closePath();
    const g = extrude(s, thick, 2); g.translate(-len / 2, 0, 0); return turn(g, V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
  }
  const tri = (p0, p1, p2) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...p0, ...p1, ...p2], 3)); g.computeVertexNormals(); return g; };
  function glow(color, size) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(0.25, color + 'aa'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.set(size, size, 1); s.userData.glow = true; return s;
  }

  return { V, prng, canvasTex, armorTex, faceTex, roundRect, extrude, turn, plateXY, shellXZ, plateYZ, dropShape, clawGeo, tri, glow };
}

// Облицовка («облик») краба Авад S-0 по мотивам шагающих машин из игр Horizon: накладки поверх каркаса по чертежам.
// Всё построено кодом от размеров модели (параметры Z, J и габариты деталей из data/model.json); при смене модели облицовка перестраивается.
// Это визуальная заготовка для обсуждения, не рабочий чертёж: массы, крепления и допуски облицовки не рассчитаны. Стадия: концепция (FEL-1).
// Признаки взяты с игровых рендеров Horizon Zero Dawn: контейнер с чёрными замками и жёлтыми треугольниками, широкая голова с парами синих линз,
// оранжевый ребристый блок под платформой, каплевидные бронеплиты ног с когтистой стопой, оранжевые клешни. Форма и детали — собственные.
// Оружие и энергощит игрового образца не воспроизводятся (правило проекта: без боевых функций).

import { makeKit } from './kit.js';

export function buildSkin(T, ctx) {
  const { Z, J, addAbs, boxOf, parts, k1 = false } = ctx;   // k1 — на руках кисть-захват К1 v2 (09.11.2026): клешни облицовки не ставятся
  const rad = (g) => (g * Math.PI) / 180;
  const C = { cream: 0xd9d5c9, teal: 0x3b8d94, orange: 0xe27b1d, black: 0x14161a, steel: 0x2b2f36, slate: 0x7d899b, slateDark: 0x566174, yellow: 0xf2c230 };
  const mats = {};
  const { prng, canvasTex, armorTex, faceTex, roundRect, extrude, turn, plateXY, shellXZ, plateYZ, dropShape, clawGeo, tri, glow } = makeKit(T);
  // ---------- процедурные текстуры: потёртая пятнистая броня и панели контейнера (рисуются кодом, без внешних файлов)
  const texCream = armorTex(11, '#d6d2c6'), texTeal = armorTex(23, '#3f8c94'), texOrange = armorTex(37, '#e5791c');
  const mat = (name, color, metalness, roughness, extra = {}) => (mats[name] ??= new T.MeshStandardMaterial({ color, metalness, roughness, ...extra }));
  const mCream = () => mat('cream', 0xffffff, 0.25, 0.6, { map: texCream });
  const mTeal = () => mat('teal', 0xffffff, 0.3, 0.5, { map: texTeal });
  const mOrange = () => mat('orange', 0xffffff, 0.2, 0.5, { map: texOrange });
  const mBlack = () => mat('black', C.black, 0.55, 0.4);
  const mSteel = () => mat('steel', C.steel, 0.6, 0.38);
  const mYellow = () => mat('yellow', C.yellow, 0.1, 0.5);
  const mLens = () => mat('lens', 0x7fd0ff, 0, 0.2, { emissive: 0x2d9bff, emissiveIntensity: 2.2 });
  const mLamp = () => mat('lamp', 0xff6060, 0, 0.3, { emissive: 0xff2020, emissiveIntensity: 2.0 });
  const mDecal = (c) => new T.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.6, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const V = (x, y, z) => new T.Vector3(x, y, z);

  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // =================================================  КОНТЕЙНЕР: рамка, чёрные замки, двухцветные панели, жёлтые метки, габаритный огонь
  const cont = parts['контейнер'];
  if (cont) {
    const [[x0, y0, z0], [x1, y1, z1]] = boxOf(cont);
    const g = new T.Group();
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const bar = (geo, x, y, z) => add(g, geo, mSteel(), x, y, z);
    for (const yy of [y0, y1]) for (const zz of [z0, z1]) bar(new T.BoxGeometry(x1 - x0 - 6, 7, 7), xc, yy - Math.sign(yy) * 1, zz - Math.sign(zz - zc) * 1);
    for (const xx of [x0, x1]) for (const zz of [z0, z1]) bar(new T.BoxGeometry(7, y1 - y0 - 6, 7), xx - Math.sign(xx - xc) * 1, 0, zz - Math.sign(zz - zc) * 1);
    for (const xx of [x0, x1]) for (const yy of [y0, y1]) bar(new T.BoxGeometry(7, 7, z1 - z0 - 6), xx - Math.sign(xx - xc) * 1, yy - Math.sign(yy) * 1, zc);
    for (const xx of [x0, x1]) for (const yy of [y0, y1]) for (const zz of [z0, z1]) add(g, new T.BoxGeometry(17, 17, 17), mBlack(), xx - Math.sign(xx - xc) * 4, yy - Math.sign(yy) * 4, zz - Math.sign(zz - zc) * 4);
    for (const sy of [-1, 1]) for (const zz of [z0 + 52, z1 - 52]) for (const xx of [x0 + 44, x1 - 44]) add(g, new T.BoxGeometry(18, 5, 9), mBlack(), xx, sy * (y1 + 0.2), zz);
    for (const sx of [-1, 1]) for (const zz of [z0 + 52, z1 - 52]) for (const yy of [-52, 52]) add(g, new T.BoxGeometry(5, 18, 9), mBlack(), sx > 0 ? x1 + 0.2 : x0 - 0.2, yy, zz);
    // панели: пластина на каждой грани (текстура со швами, заклёпками, диагональной окраской и потёртостью)
    const panelMat = (seed, yellow) => new T.MeshStandardMaterial({ map: faceTex(seed, yellow), metalness: 0.2, roughness: 0.68, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const facePlane = (n, w, h, center, m) => {   // n — внешняя нормаль грани (единичный вектор), «вверх» на грани — Z (для верха — X)
      const nn = V(...n), up = Math.abs(nn.z) > 0.5 ? V(1, 0, 0) : V(0, 0, 1), t1 = new T.Vector3().crossVectors(up, nn);
      const geo = new T.PlaneGeometry(w, h); geo.applyMatrix4(new T.Matrix4().makeBasis(t1, up, nn));
      const mesh = new T.Mesh(geo, m); mesh.position.set(...center); mesh.receiveShadow = true; mesh.castShadow = true; g.add(mesh); return mesh;
    };
    facePlane([0, 1, 0], x1 - x0 - 10, z1 - z0 - 10, [xc, y1 + 0.5, zc], panelMat(3, true));
    facePlane([0, -1, 0], x1 - x0 - 10, z1 - z0 - 10, [xc, y0 - 0.5, zc], panelMat(5, false));
    facePlane([1, 0, 0], y1 - y0 - 10, z1 - z0 - 10, [x1 + 0.5, 0, zc], panelMat(7, true));
    facePlane([-1, 0, 0], y1 - y0 - 10, z1 - z0 - 10, [x0 - 0.5, 0, zc], panelMat(9, false));
    facePlane([0, 0, 1], x1 - x0 - 10, y1 - y0 - 10, [xc, 0, z1 + 0.5], panelMat(13, false));
    add(g, new T.BoxGeometry(5, 16, 11), mLamp(), x0 - 1.5, 62, z1 - 28);
    const sp = glow('#ff3030', 34); sp.position.set(x0 - 6, 62, z1 - 28); g.add(sp);
    addAbs('trunk', g, 'контейнер');
  }

  // =================================================  КОРПУС: бронепластины на больших гранях и оранжевый ребристый блок на лотке батареи
  {
    const g = new T.Group();
    const apothem = 103.9, zc = 144;
    for (let k = 0; k < 6; k++) {
      const holder = new T.Group(); holder.position.set(0, 0, zc); holder.rotation.z = rad(60 * k); g.add(holder);
      add(holder, plateYZ(60, 54, 5, 2.2, 9), mCream(), apothem + 2.5, 0, 0);
      add(holder, new T.BoxGeometry(2.4, 6, 38), mTeal(), apothem + 6.2, 0, 0);
      add(holder, new T.BoxGeometry(2.8, 5, 12), mOrange(), apothem + 6.4, 17, 12);
    }
    const tray = parts['лоток'];
    if (tray) {
      const [[a0, b0, c0], [a1, b1, c1]] = boxOf(tray);
      const cx = (a0 + a1) / 2, cy = (b0 + b1) / 2, cz = (c0 + c1) / 2;
      add(g, plateXY(a1 - a0 + 8, b1 - b0 + 6, c1 - c0 + 6, 3, 10), mOrange(), cx, cy, cz);
      for (let i = -4; i <= 4; i++) add(g, new T.BoxGeometry(a1 - a0 + 14, 5, c1 - c0 + 2), mBlack(), cx, cy + i * ((b1 - b0) / 9.2), cz - 2);
    }
    addAbs('trunk', g, 'корпус');
  }

  // =================================================  ГОЛОВА: широкая планка с парами синих линз, маска, основание антенн
  const head = parts['голова_кожух'];
  if (head) {
    const [[x0, y0, z0], [x1, y1, z1]] = boxOf(head);
    const g = new T.Group();
    const zc = (z0 + z1) / 2;
    for (const sy of [-1, 1]) {
      const yc = sy * (y1 - 20);
      // угловатый чёрный блок датчиков: два ряда по две линзы и боковая линза
      add(g, plateYZ(40, 38, 30, 3, 8), mBlack(), x1 - 4, yc, zc);
      add(g, plateYZ(42, 6, 34, 1.5, 2), mTeal(), x1 - 4, yc, zc + 21);
      for (const [dy, dz] of [[-9, 8], [9, 8], [-9, -7], [9, -7]]) {
        add(g, new T.CylinderGeometry(4.6, 4.6, 3, 16), mLens(), x1 + 11.5, yc + dy, zc + dz).rotation.z = Math.PI / 2;
        const s = glow('#58b6ff', 22); s.position.set(x1 + 14, yc + dy, zc + dz); g.add(s);
      }
      add(g, new T.CylinderGeometry(3.2, 3.2, 3, 14), mLens(), x1 - 2, yc + sy * 20.5, zc);
      add(g, new T.BoxGeometry(14, 2.5, 10), mOrange(), x1 - 6, yc, zc - 22);
    }
    add(g, plateYZ(56, 38, 6, 2.4, 10), mCream(), x1 + 4, 0, z1 - 14);
    add(g, new T.BoxGeometry(2.4, 14, 24), mTeal(), x1 + 8.4, 0, z1 - 14);
    add(g, plateXY(x1 - x0 + 4, y1 - y0 - 44, 6, 2.6, 12), mCream(), (x0 + x1) / 2, 0, z1 + 3);
    add(g, new T.BoxGeometry(12, 12, 40), mCream(), 143, 82, z1 + 22);
    add(g, new T.BoxGeometry(14, 14, 7), mYellow(), 143, 82, z1 + 44);
    addAbs('head_tilt', g, 'голова');
  }

  // =================================================  НОГИ: колпак и накладка бедра, колено, каплевидная плита голени, стопа-коготь
  const hipR = Z['корень_ноги.R'], hipZ = Z['корень_ноги.z'], kR = Z['нога.колено_R'], kZ = Z['нога.колено_z'], fR = Z['нога.стопа_R'];
  const shinW = Z['нога.ширина_голени'], shinT = Z['нога.толщина_голени'], thW = Z['нога.ширина_бедра'], thT = Z['нога.толщина_бедра'], kD = Z['нога.колено_диаметр'];
  for (let n = 1; n <= 6; n++) {
    const a = rad(Z['нога.углы_град'][n - 1]);
    const at = (R, z) => [R * Math.cos(a), R * Math.sin(a), z];
    {   // бедро
      const L = Math.hypot(kR - hipR, kZ - hipZ), slope = Math.atan2(kZ - hipZ, kR - hipR);
      const frame = new T.Group(); frame.position.set(...at(hipR, hipZ)); frame.rotation.z = a;
      const arm = new T.Group(); arm.rotation.y = -slope; frame.add(arm);
      add(arm, shellXZ(L + 36, thW + 8, thT, 12), mCream(), L / 2, 0, 0);
      for (const sy of [-1, 1]) add(arm, new T.BoxGeometry(L * 0.6, 3, thT * 0.5), mTeal(), L * 0.5, sy * ((thW + 8) / 2 + 1.2), 0);
      add(frame, new T.CylinderGeometry(21, 21, thW + 12, 24), mBlack(), 0, 0, 0);
      addAbs(`leg${n}_hip`, frame, `нога ${n}`);
    }
    {   // колено, голень, стопа
      const frame = new T.Group(); frame.position.set(...at(kR, kZ)); frame.rotation.z = a;
      add(frame, new T.CylinderGeometry(kD / 2, kD / 2, shinW + 4, 28), mBlack(), 0, 0, 0);
      for (const sy of [-1, 1]) add(frame, new T.TorusGeometry(kD / 2 + 0.5, 2.6, 8, 32), mOrange(), 0, sy * (shinW / 2 + 2), 0).rotation.x = Math.PI / 2;
      const dz = kZ - 30, dr = fR - kR, L = Math.hypot(dr, dz);
      const sdir = V(dr, 0, -dz).normalize(), up = sdir.clone().negate(), side = V(0, 1, 0), nrm = new T.Vector3().crossVectors(side, up).normalize();
      const plate = (w, len, d, m, off) => {
        const g = turn(extrude(dropShape(w, len, 0.22), d, 3), side, up, nrm);
        const mesh = add(frame, g, m); mesh.position.copy(nrm.clone().multiplyScalar(off)); return mesh;
      };
      plate(shinW + 12, L + 8, shinT + 10, mCream(), 0);
      const inset = plate((shinW + 12) * 0.56, (L + 8) * 0.7, shinT + 14, mTeal(), 1.5); inset.position.addScaledVector(up, -(L + 8) * 0.08);
      for (const sy of [-1, 1]) { const tab = add(frame, new T.BoxGeometry(4, 5, 13), mOrange()); tab.position.copy(side.clone().multiplyScalar(sy * (shinW / 2 + 5))).addScaledVector(sdir, L * 0.3).addScaledVector(nrm, 6); }
      const tp = (u, v) => side.clone().multiplyScalar(u).addScaledVector(sdir, v).addScaledVector(nrm, shinT / 2 + 8.7).toArray();
      frame.add(new T.Mesh(tri(tp(-8, 26), tp(8, 26), tp(0, 46)), mDecal(C.black)));
      const foot = new T.Group(); foot.position.copy(sdir.clone().multiplyScalar(L)); frame.add(foot);
      for (const [dy, tilt, len] of [[0, 0, 40], [-11, 0.34, 36], [11, -0.34, 36]]) {
        const pr = new T.Group(); pr.position.set(0, dy, 0); pr.rotation.x = tilt; foot.add(pr);
        add(pr, new T.ConeGeometry(5.8, len, 10), mBlack(), 0, 0, -len / 2 + 2).rotation.x = -Math.PI / 2;
      }
      addAbs(`leg${n}_knee`, frame, `нога ${n}`);
    }
  }

  // =================================================  РУКИ: накладки плеча и предплечья, колпаки суставов, оранжевая ладонь и два когтя
  for (const side of ['L', 'R']) {
    const sy = side === 'L' ? 1 : -1, zs = J.Zs;
    // координаты — левой руки в позе «прямо»; правая зеркалится по Y
    const put = (body, fn) => { const g = new T.Group(); fn(g); const mir = new T.Group(); mir.scale.y = sy; mir.add(g); addAbs(body, mir, side === 'L' ? 'рука левая' : 'рука правая'); };
    put(`arm${side}2`, (g) => {      // плечо
      const len = J.Xe - J.Xs + 24;
      add(g, shellXZ(len, 40, 52, 12), mCream(), (J.Xs + J.Xe) / 2 + 2, 135, zs);
      add(g, new T.BoxGeometry(len * 0.5, 3, 22), mTeal(), (J.Xs + J.Xe) / 2 + 2, 156, zs);
      add(g, new T.CylinderGeometry(24, 24, 48, 28), mBlack(), J.Xe, 133, zs);
    });
    put(`arm${side}3`, (g) => {      // предплечье
      const len = J.Xw - J.Xe + 22;
      add(g, shellXZ(len, 36, 48, 12), mCream(), (J.Xe + J.Xw) / 2 + 2, 128, zs);
      add(g, new T.BoxGeometry(len * 0.5, 3, 20), mTeal(), (J.Xe + J.Xw) / 2 + 2, 147, zs);
      add(g, new T.CylinderGeometry(21, 21, 46, 28), mBlack(), J.Xw, 127, zs);
    });
    put(`arm${side}4`, (g) => { add(g, shellXZ(66, 42, 50, 12), mOrange(), J.Xw + 36, 127, zs); });
    if (k1) continue;                // кисть-захват К1 v2 видна сама (настоящие детали РД ред. Д) — клешни облицовки не ставим
    put(`arm${side}5`, (g) => {      // ладонь вокруг серво захвата и неподвижный коготь
      add(g, shellXZ(50, 42, 50, 10), mOrange(), 380, 126, zs);
      const c = add(g, clawGeo(70, 17, 12), mOrange(), 398, 146, zs); c.rotation.x = 0;
    });
    put(`grip${side}`, (g) => {      // подвижный коготь (острие вниз)
      const c = add(g, clawGeo(64, 17, 12), mOrange(), 401, 143.5, zs); c.scale.z = -1;
    });
  }
  return { materials: mats };
}

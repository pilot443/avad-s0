// Ход краба Авад S-0: обратная кинематика ноги и походка «тройка» — те же формулы и размеры модели, что в
// инструменты/универсал_сим_управление.py (КинематикаНоги, Походка). Единицы — мм и градусы, как в модели.
// Стадия: концепция (FEL-1). Это показ движения, а не расчёт нагрузок.

const rad = (g) => (g * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

export class LegKin {
  constructor(Z, n) {
    this.n = n;
    this.g = rad(Z['нога.углы_град'][n - 1]);
    this.Rh = Z['корень_ноги.R'];
    this.zh = Z['корень_ноги.z'];
    const Rk = Z['нога.колено_R'], zk = Z['нога.колено_z'];
    this.Rf = Z['нога.стопа_R'];
    this.L1 = Math.hypot(Rk - this.Rh, zk - this.zh);
    this.L2 = Math.hypot(this.Rf - Rk, zk);
    this.a1 = Math.atan2(zk - this.zh, Rk - this.Rh);
    this.a2 = Math.atan2(-zk, this.Rf - Rk);
    this.base = [this.Rh * Math.cos(this.g), this.Rh * Math.sin(this.g)];
    this.stand = [this.Rf * Math.cos(this.g), this.Rf * Math.sin(this.g), 0];
  }

  // положение стопы (мм) по углам (град)
  foot(yaw, th_h, th_k) {
    const a = this.g + rad(yaw), a1 = this.a1 - rad(th_h), a2 = this.a2 - rad(th_h) - rad(th_k);
    const r = this.Rh + this.L1 * Math.cos(a1) + this.L2 * Math.cos(a2);
    const z = this.zh + this.L1 * Math.sin(a1) + this.L2 * Math.sin(a2);
    return [this.base[0] + (r - this.Rh) * Math.cos(a), this.base[1] + (r - this.Rh) * Math.sin(a), z];
  }

  // углы (град) по положению стопы; null — недостижимо. Колено наружу и вверх, как в стойке.
  angles(P) {
    const vx = P[0] - this.base[0], vy = P[1] - this.base[1];
    const ro = Math.hypot(vx, vy);
    if (ro < 1) return null;
    const a = Math.atan2(vy, vx);
    let yaw = a - this.g + Math.PI;
    yaw = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const dr = ro, dz = P[2] - this.zh, D = Math.hypot(dr, dz);
    if (D > this.L1 + this.L2 - 1e-6 || D < Math.abs(this.L1 - this.L2) + 1e-6) return null;
    const beta = -Math.acos((D * D - this.L1 ** 2 - this.L2 ** 2) / (2 * this.L1 * this.L2));
    const al1 = Math.atan2(dz, dr) - Math.atan2(this.L2 * Math.sin(beta), this.L1 + this.L2 * Math.cos(beta));
    return [deg(yaw), deg(this.a1 - al1), deg(this.a2 - this.a1 - beta)];
  }
}

const quintic = (x) => { x = clamp(x, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };
const trapezoid = (x, r = 0.3) => {
  x = clamp(x, 0, 1);
  if (x < r) return (x * x) / (2 * r) / (1 - r);
  if (x <= 1 - r) return (r / 2 + (x - r)) / (1 - r);
  return 1 - ((1 - x) ** 2) / (2 * r) / (1 - r);
};

// Живая походка «тройка»: ноги 1, 3, 5 и 2, 4, 6 переносятся по очереди; темп (цикл T0) задан, шаг пропорционален скорости.
// Параметры: ход — наибольший ход опоры за полцикл, мм (в модели v2: 27,5); подъём — высота переноса, мм (30); радиус середины хода, мм (174).
export class Gait {
  constructor(Z, limits) {
    this.legs = [1, 2, 3, 4, 5, 6].map((n) => new LegKin(Z, n));
    this.limits = limits; // {leg1_yaw:[lo,hi],...}
    this.T0 = 0.92;       // с, самый быстрый цикл; при меньшей скорости цикл длиннее: T = 2·ход/u (как в расчёте), не больше Tmax
    this.Tmax = 3.0;      // с, самый медленный цикл
    this.T = 3.0;         // с, текущий цикл
    this.peakT = { yaw: 0, hip: 0, knee: 0 };
    this.stroke = 27.5;   // мм за полцикл
    this.lift = 30;       // мм
    this.radius = 174;    // мм
    this.phase = 0;
    this.twist = [0, 0, 0]; // vx, vy [м/с], wz [рад/с] — заданные
    this.cur = [0, 0, 0];   // сглаженные
    this.act = 0;           // 0 — стоит, 1 — идёт
    this.angles = {};       // последние углы, град
    this.prev = null;
    this.peak = 0;          // пик угловой скорости за последние секунды, рад/с
    this.peakHist = [];
    this.warn = '';
    this.profile = trapezoid;
    this.b = 0.5; this.c = 0.2; // «вперемешку»
    for (const l of this.legs) this._set(l.n, ...l.angles(l.stand));
  }

  _set(n, yaw, h, k) { this.angles[`leg${n}_yaw`] = yaw; this.angles[`leg${n}_hip`] = h; this.angles[`leg${n}_knee`] = k; }

  // наибольшая допустимая скорость стопы относительно корпуса при данном темпе, мм/с
  get umaxLimit() { return (2 * this.stroke) / this.T0; }
  get vmax() { return this.umaxLimit / 1000; } // м/с прямо

  set command(v) { this.twist = v; }
  get command() { return this.twist; }

  step(dt) {
    // плавный разгон: ускорение ограничено
    const k = 1 - Math.exp(-dt / 0.18);
    const tgt = this.twist.slice();
    // не даём ходу опоры превысить предел: масштабируем команду
    const u = (p) => [-(tgt[0] * 1000 + tgt[2] * -p[1]), -(tgt[1] * 1000 + tgt[2] * p[0])];
    let umax = 0;
    for (const l of this.legs) {
      const P0 = l.stand.map((x) => x * (this.radius / l.Rf));
      const w = u(P0); umax = Math.max(umax, Math.hypot(w[0], w[1]));
    }
    const sc = umax > this.umaxLimit ? this.umaxLimit / umax : 1;
    this.scale = sc;
    for (let i = 0; i < 3; i++) this.cur[i] += (tgt[i] * sc - this.cur[i]) * k;
    const mag = Math.hypot(this.cur[0] * 1000, this.cur[1] * 1000, this.cur[2] * 200);
    const act = clamp(mag / 8, 0, 1);
    this.act += (act - this.act) * (1 - Math.exp(-dt / 0.12));
    let uCur = 0;
    for (const l of this.legs) {
      const P0 = l.stand.map((x) => x * (this.radius / l.Rf));
      uCur = Math.max(uCur, Math.hypot(-(this.cur[0] * 1000 - this.cur[2] * P0[1]), -(this.cur[1] * 1000 + this.cur[2] * P0[0])));
    }
    const T = clamp((2 * this.stroke) / Math.max(uCur, 1e-6), this.T0, this.Tmax);
    this.T = T;
    this.phase = (this.phase + dt / T) % 1;
    const old = { ...this.angles };
    let ok = true;
    for (const l of this.legs) {
      const P0 = l.stand.map((x, i) => (i < 2 ? x * (1 - this.act * (1 - this.radius / l.Rf)) : x));
      const w = [-(this.cur[0] * 1000 - this.cur[2] * P0[1]), -(this.cur[1] * 1000 + this.cur[2] * P0[0])];
      const d = [w[0] * (T / 2), w[1] * (T / 2), 0];
      const groupA = l.n % 2 === 1;
      const swing = groupA ? this.phase < 0.5 : this.phase >= 0.5;
      const s = (this.phase % 0.5) / 0.5;
      let P;
      if (swing) {
        const mu = s < this.b ? this.profile(s / this.b) : s > 1 - this.b ? this.profile((1 - s) / this.b) : 1;
        const la = this.profile((s - this.c) / (1 - 2 * this.c));
        P = [P0[0] + d[0] / 2 - d[0] * la, P0[1] + d[1] / 2 - d[1] * la, P0[2] + this.lift * this.act * mu];
      } else {
        P = [P0[0] - d[0] / 2 + d[0] * s, P0[1] - d[1] / 2 + d[1] * s, P0[2]];
      }
      const a = l.angles(P);
      if (!a) { ok = false; continue; }
      this._set(l.n, a[0], a[1], a[2]);
    }
    // пределы суставов и скорость серво
    let viol = [];
    let peak = 0;
    const pt = { yaw: 0, hip: 0, knee: 0 };
    for (const [name, val] of Object.entries(this.angles)) {
      const lim = this.limits[name];
      if (lim && (val < lim[0] - 0.01 || val > lim[1] + 0.01)) viol.push(name);
      const w_ = Math.abs(rad(val - (old[name] ?? val))) / dt;
      peak = Math.max(peak, w_);
      const тип = name.split('_')[1];
      if (тип in pt) pt[тип] = Math.max(pt[тип], w_);
    }
    this.peakHist.push([peak, dt, pt]);
    let tot = 0;
    while (this.peakHist.length > 1 && (tot = this.peakHist.reduce((a, b) => a + b[1], 0)) > 1.0) this.peakHist.shift();
    this.peak = Math.max(...this.peakHist.map((p) => p[0]));
    this.peakT = { yaw: Math.max(...this.peakHist.map((p) => p[2].yaw)), hip: Math.max(...this.peakHist.map((p) => p[2].hip)), knee: Math.max(...this.peakHist.map((p) => p[2].knee)) };
    this.warn = !ok ? 'стопа вне досягаемости' : viol.length ? `предел сустава: ${viol[0]}` : '';
    return this.angles;
  }
}

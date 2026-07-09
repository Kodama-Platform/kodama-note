const TRUNKS = [
  { left: "3%", w: 48, h: "90%", o: 0.66 },
  { left: "13%", w: 26, h: "62%", o: 0.42 },
  { left: "86%", w: 52, h: "94%", o: 0.7 },
  { left: "95%", w: 30, h: "66%", o: 0.44 },
  { left: "74%", w: 18, h: "46%", o: 0.26 },
  { left: "26%", w: 16, h: "42%", o: 0.24 },
];

const RAYS = [
  { left: "10%", rot: 8, delay: 0, o: 0.9 },
  { left: "30%", rot: 11, delay: -4, o: 0.65 },
  { left: "54%", rot: 7, delay: -8, o: 0.85 },
  { left: "74%", rot: 12, delay: -6, o: 0.6 },
  { left: "90%", rot: 9, delay: -2, o: 0.75 },
];

const MISTS = [
  { left: "2%", top: "24%", w: "40rem", h: "20rem", c: "var(--primary)", a: 0.16, d: 30, delay: 0 },
  { left: "58%", top: "50%", w: "36rem", h: "18rem", c: "var(--ember)", a: 0.07, d: 36, delay: -8 },
  { left: "20%", top: "70%", w: "44rem", h: "22rem", c: "var(--primary)", a: 0.14, d: 42, delay: -16 },
];

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  bottom: `${(i * 23) % 64}%`,
  s: 2 + (i % 3),
  d: 15 + (i % 5) * 3,
  delay: -(i * 1.6),
}));

const FIREFLIES = Array.from({ length: 6 }, (_, i) => ({
  left: `${(i * 61 + 9) % 92}%`,
  top: `${(i * 37 + 16) % 74}%`,
  s: 3 + (i % 2),
  float: 20 + (i % 4) * 3,
  twinkle: 4.6 + (i % 3),
  delay: -(i * 2.3),
}));

const WINDMOTES = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 17) % 58}%`,
  top: `${(i * 29) % 88}%`,
  s: 2 + (i % 2),
  d: 9 + (i % 5) * 2,
  delay: -(i * 1.1),
}));

export function ForestAtmosphere() {
  return (
    <>
      <div className="hero-forest-bg absolute inset-0 z-0" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {TRUNKS.map((t, i) => (
          <div
            key={i}
            className="hero-trunk k-float-slow absolute bottom-0"
            style={{
              left: t.left,
              width: t.w,
              height: t.h,
              opacity: t.o,
              animationDelay: `${i * -1.9}s`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 -top-24 z-0 overflow-hidden" aria-hidden="true">
        {RAYS.map((r, i) => (
          <span
            key={i}
            className="hero-ray absolute top-0"
            style={{
              left: r.left,
              opacity: r.o,
              transform: `rotate(${r.rot}deg)`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {MISTS.map((m, i) => (
          <span
            key={i}
            className="hero-mist absolute"
            style={{
              left: m.left,
              top: m.top,
              width: m.w,
              height: m.h,
              background: `radial-gradient(closest-side, rgb(${m.c} / ${m.a}), transparent 72%)`,
              animationDuration: `${m.d}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="k-dust absolute rounded-full bg-primary/40"
            style={{
              left: m.left,
              bottom: m.bottom,
              width: m.s,
              height: m.s,
              animationDuration: `${m.d}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {FIREFLIES.map((f, i) => (
          <span
            key={i}
            className="firefly-path absolute"
            style={{
              left: f.left,
              top: f.top,
              animationDuration: `${f.float}s`,
              animationDelay: `${f.delay}s`,
            }}
          >
            <span
              className={`firefly block ${i % 5 === 2 ? "firefly-ember" : ""}`}
              style={{
                width: f.s,
                height: f.s,
                animationDuration: `${f.twinkle}s`,
                animationDelay: `${f.delay}s`,
              }}
            />
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {WINDMOTES.map((m, i) => (
          <span
            key={i}
            className="wind-mote absolute"
            style={{
              left: m.left,
              top: m.top,
              width: m.s,
              height: m.s,
              animationDuration: `${m.d}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="hero-vignette absolute inset-0 z-0" aria-hidden="true" />
    </>
  );
}

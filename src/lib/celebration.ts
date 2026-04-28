/**
 * Effet de célébration — confettis + petit "ding" — déclenché quand un
 * ticket validé devient gagnant.
 */

let lastFire = 0;

function ding() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [
      { f: 880, t: 0 },
      { f: 1175, t: 0.12 },
      { f: 1568, t: 0.24 },
    ];
    notes.forEach(({ f, t }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* silent */
  }
}

function confetti() {
  if (typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);
  const colors = ["#22d3ee", "#a855f7", "#ec4899", "#facc15", "#34d399"];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const p = document.createElement("span");
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const dur = 2200 + Math.random() * 1800;
    const delay = Math.random() * 400;
    const rot = Math.random() * 720 - 360;
    const drift = (Math.random() - 0.5) * 200;
    p.style.cssText = `
      position:absolute; top:-20px; left:${left}vw;
      width:${size}px; height:${size * 1.6}px;
      background:${colors[i % colors.length]};
      transform:rotate(${rot}deg);
      border-radius:2px;
      opacity:0;
      animation: magic-confetti ${dur}ms ${delay}ms cubic-bezier(.25,.9,.35,1) forwards;
      --drift:${drift}px;
    `;
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 4500);
}

// Inject keyframes once
function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("magic-confetti-style")) return;
  const s = document.createElement("style");
  s.id = "magic-confetti-style";
  s.textContent = `
    @keyframes magic-confetti {
      0% { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 0; }
      8% { opacity: 1; }
      100% { transform: translate3d(var(--drift), 110vh, 0) rotate(720deg); opacity: 0.9; }
    }
  `;
  document.head.appendChild(s);
}

export function celebrateWin() {
  const now = Date.now();
  if (now - lastFire < 1000) return; // anti spam
  lastFire = now;
  ensureStyles();
  confetti();
  ding();
}

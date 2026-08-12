"use client";

/** Canvas confetti burst, shown when voting closes and a winner is revealed. */
export function runConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.id = "confettiCanvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#fde047", "#f472b6", "#8b5cf6", "#34d399", "#60a5fa", "#fb7185"];
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vy: 2 + Math.random() * 3.2,
    vx: (Math.random() - 0.5) * 1.6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.18,
    c: colors[(Math.random() * colors.length) | 0],
  }));

  let frames = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frames++;
    if (frames < 260 && parts.some((p) => p.y < canvas.height + 40)) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  };
  draw();
}

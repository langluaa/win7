import React, { useEffect, useRef } from 'react';

// Original screensavers drawn on canvas: Mystify (bouncing polygons), Ribbons, Bubbles, Blank.
export function Screensaver({ type, onExit, preview = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    let w = (canvas.width = canvas.clientWidth * (preview ? 1 : devicePixelRatio));
    let h = (canvas.height = canvas.clientHeight * (preview ? 1 : devicePixelRatio));
    let raf;
    const rnd = (a, b) => a + Math.random() * (b - a);
    let step;

    if (type === 'mystify') {
      const shapes = [0, 1].map((i) => ({
        pts: Array.from({ length: 4 }, () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-3, 3) * (w / 800), vy: rnd(-3, 3) * (h / 600) })),
        hue: i * 160,
        trail: [],
      }));
      step = () => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        for (const s of shapes) {
          for (const p of s.pts) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
          }
          s.trail.push(s.pts.map((p) => ({ ...p })));
          if (s.trail.length > 6) s.trail.shift();
          s.hue = (s.hue + 0.4) % 360;
          s.trail.forEach((pts, i) => {
            g.strokeStyle = `hsla(${s.hue},100%,60%,${(i + 1) / s.trail.length})`;
            g.lineWidth = preview ? 1 : 1.5 * devicePixelRatio;
            g.beginPath();
            pts.forEach((p, j) => (j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
            g.closePath();
            g.stroke();
          });
        }
      };
    } else if (type === 'ribbons') {
      const ribbons = Array.from({ length: 3 }, () => ({ x: rnd(0, w), y: rnd(0, h), a: rnd(0, 6.28), hue: rnd(0, 360), pts: [] }));
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      step = () => {
        g.fillStyle = 'rgba(0,0,0,0.04)';
        g.fillRect(0, 0, w, h);
        for (const r of ribbons) {
          r.a += rnd(-0.12, 0.12);
          r.x += Math.cos(r.a) * 4 * (w / 900);
          r.y += Math.sin(r.a) * 4 * (h / 700);
          if (r.x < 0 || r.x > w) r.a = Math.PI - r.a;
          if (r.y < 0 || r.y > h) r.a = -r.a;
          r.hue = (r.hue + 0.6) % 360;
          const width = (preview ? 6 : 26) * (w / 1600 + 0.5);
          const nx = Math.cos(r.a + Math.PI / 2) * width;
          const ny = Math.sin(r.a + Math.PI / 2) * width;
          const grad = g.createLinearGradient(r.x - nx, r.y - ny, r.x + nx, r.y + ny);
          grad.addColorStop(0, `hsla(${r.hue},90%,35%,0.9)`);
          grad.addColorStop(0.5, `hsla(${r.hue},100%,75%,0.9)`);
          grad.addColorStop(1, `hsla(${r.hue},90%,35%,0.9)`);
          g.strokeStyle = grad;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(r.x - nx, r.y - ny);
          g.lineTo(r.x + nx, r.y + ny);
          g.stroke();
        }
      };
    } else if (type === 'bubbles') {
      const bubbles = Array.from({ length: preview ? 6 : 14 }, () => {
        const r = rnd(30, 90) * (preview ? 0.25 : devicePixelRatio);
        return { r, x: rnd(r, w - r), y: rnd(r, h - r), vx: rnd(-2, 2), vy: rnd(-2, 2), hue: rnd(0, 360) };
      });
      step = () => {
        g.clearRect(0, 0, w, h);
        for (const b of bubbles) {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < b.r || b.x > w - b.r) b.vx *= -1;
          if (b.y < b.r || b.y > h - b.r) b.vy *= -1;
          b.hue = (b.hue + 0.3) % 360;
          const grd = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.05, b.x, b.y, b.r);
          grd.addColorStop(0, 'rgba(255,255,255,0.95)');
          grd.addColorStop(0.25, `hsla(${b.hue},90%,80%,0.25)`);
          grd.addColorStop(0.85, `hsla(${(b.hue + 120) % 360},90%,60%,0.25)`);
          grd.addColorStop(1, `hsla(${(b.hue + 200) % 360},100%,70%,0.7)`);
          g.fillStyle = grd;
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          g.fill();
        }
      };
    } else {
      step = () => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
      };
    }
    const loop = () => {
      step();
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => {
      w = canvas.width = canvas.clientWidth * (preview ? 1 : devicePixelRatio);
      h = canvas.height = canvas.clientHeight * (preview ? 1 : devicePixelRatio);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [type, preview]);

  useEffect(() => {
    if (preview || !onExit) return;
    const start = Date.now();
    const exit = (e) => {
      if (e.type === 'pointermove' && Date.now() - start < 600) return;
      onExit();
    };
    window.addEventListener('pointermove', exit);
    window.addEventListener('pointerdown', exit);
    window.addEventListener('keydown', exit);
    return () => {
      window.removeEventListener('pointermove', exit);
      window.removeEventListener('pointerdown', exit);
      window.removeEventListener('keydown', exit);
    };
  }, [onExit, preview]);

  return <canvas ref={ref} className={preview ? 'ss-preview' : 'screensaver'} />;
}

"use client";

import { useEffect, useRef } from "react";

type City = [lat: number, lng: number, name: string];

const CITIES: City[] = [
  [25.77, -80.19, "MIAMI"],
  [27.95, -82.46, "TAMPA"],
  [29.95, -90.07, "NEW ORLEANS"],
  [32.79, -79.94, "CHARLESTON"],
];

const len = Math.hypot(0.32, 0.42, -0.85);
const LIGHT = [0.32 / len, 0.42 / len, -0.85 / len] as const;

/** Rotating dot-matrix globe with Gulf-coast city markers, drawn on a 2D canvas. */
export function HeroGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = devicePixelRatio;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let rotation = -9.81;

    const project = (lat: number, lng: number, cx: number, cy: number, r: number) => {
      const phi = (Math.PI / 180) * (90 - lat);
      const theta = (Math.PI / 180) * (lng + 180 + rotation);
      const ux = Math.sin(phi) * Math.cos(theta);
      const uy = Math.cos(phi);
      return {
        ux,
        uy,
        uz: Math.sin(phi) * Math.sin(theta),
        sx: cx + ux * r,
        sy: cy - uy * r,
      };
    };

    const drawArc = (
      lat1: number,
      lng1: number,
      lat2: number,
      lng2: number,
      cx: number,
      cy: number,
      r: number,
    ) => {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const p1 = (Math.PI / 180) * (90 - lat1);
        const t1 = (Math.PI / 180) * (lng1 + 180 + rotation);
        const p2 = (Math.PI / 180) * (90 - lat2);
        const t2 = (Math.PI / 180) * (lng2 + 180 + rotation);
        const ax = Math.sin(p1) * Math.cos(t1);
        const ay = Math.cos(p1);
        const az = Math.sin(p1) * Math.sin(t1);
        const x = ax + (Math.sin(p2) * Math.cos(t2) - ax) * t;
        const y = ay + (Math.cos(p2) - ay) * t;
        const z = az + (Math.sin(p2) * Math.sin(t2) - az) * t;
        const n = Math.hypot(x, y, z);
        if (z / n < 0) {
          drawing = false;
          continue;
        }
        const sx = cx + (x / n) * r;
        const sy = cy - (y / n) * r;
        if (drawing) ctx.lineTo(sx, sy);
        else {
          ctx.moveTo(sx, sy);
          drawing = true;
        }
      }
      ctx.strokeStyle = "rgba(255,107,0,0.18)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    };

    const draw = (time: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const wide = w > 900;
      const cx = wide ? 0.82 * w : 0.5 * w;
      const cy = wide ? 0.5 * h : 0.34 * h;
      const r = wide ? Math.min(0.62 * h, 0.46 * w) : 0.36 * Math.min(w, h);
      rotation += 0.03;

      // Sun glow, upper right of the globe
      const gx = cx + 0.62 * r;
      const gy = cy - 0.78 * r;
      const breathe = (Math.sin(0.0012 * time) + 1) / 2;
      const glow = ctx.createRadialGradient(gx, gy, 0.1 * r, gx, gy, 1.5 * r);
      glow.addColorStop(0, `rgba(255,120,20,${0.5 + 0.12 * breathe})`);
      glow.addColorStop(0.4, "rgba(255,90,0,0.16)");
      glow.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Atmosphere rim
      const rim = ctx.createRadialGradient(cx, cy, 0.92 * r, cx, cy, 1.18 * r);
      rim.addColorStop(0, "rgba(255,107,0,0)");
      rim.addColorStop(0.5, "rgba(255,107,0,0.10)");
      rim.addColorStop(1, "rgba(255,107,0,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.18 * r, 0, 2 * Math.PI);
      ctx.fill();

      // Globe body
      const lx = cx + LIGHT[0] * r * 0.5;
      const ly = cy - LIGHT[1] * r * 0.5;
      const body = ctx.createRadialGradient(lx, ly, 0.1 * r, cx, cy, r);
      body.addColorStop(0, "rgba(26,22,20,1)");
      body.addColorStop(0.6, "rgba(12,11,12,1)");
      body.addColorStop(1, "rgba(6,6,8,1)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = body;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.clip();

      // Lit dot grid
      for (let lat = -85; lat <= 85; lat += 6) {
        for (let lng = -180; lng <= 180; lng += 6) {
          const { ux, uy, uz, sx, sy } = project(lat, lng, cx, cy, r);
          if (uz < -0.42) continue;
          const lit = Math.pow(Math.max(0, ux * LIGHT[0] + uy * LIGHT[1] + uz * LIGHT[2]), 1.5);
          const facing = Math.min(1, (uz + 0.42) / 1.42);
          const red = Math.round(60 + 195 * lit);
          const green = Math.round(55 + 55 * lit);
          const blue = Math.round(58 - 58 * lit);
          const alpha = 0.08 + 0.22 * facing + 0.5 * lit;
          const size = 0.6 + 0.7 * facing + 1.1 * lit;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(${red},${green},${blue},${Math.min(1, alpha)})`;
          ctx.fill();
        }
      }

      // Arcs from Miami to the other cities
      const [hubLat, hubLng] = CITIES[0];
      CITIES.slice(1).forEach(([lat, lng]) => {
        if (project(lat, lng, cx, cy, r).uz > -0.1) drawArc(hubLat, hubLng, lat, lng, cx, cy, r);
      });
      ctx.restore();

      // City markers
      CITIES.forEach(([lat, lng, name], i) => {
        const { uz, sx, sy } = project(lat, lng, cx, cy, r);
        if (uz < 0.05) return;
        const hub = i === 0;
        const fade = Math.min(1, (uz - 0.05) / 0.25);
        const pulse = (Math.sin(0.003 * time + 1.3 * i) + 1) / 2;

        ctx.beginPath();
        ctx.arc(sx, sy, (hub ? 9 : 5) + pulse * (hub ? 12 : 6), 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255,107,0,${fade * (0.35 - 0.28 * pulse)})`;
        ctx.lineWidth = hub ? 1.5 : 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, hub ? 7 : 4, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255,107,0,${0.5 * fade})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        const tick = hub ? 10 : 6;
        const gap = hub ? 4 : 2.5;
        ctx.strokeStyle = `rgba(255,107,0,${0.6 * fade})`;
        ctx.lineWidth = 0.8;
        (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const
        ).forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(sx + dx * gap, sy + dy * gap);
          ctx.lineTo(sx + dx * (gap + tick), sy + dy * (gap + tick));
          ctx.stroke();
        });

        ctx.beginPath();
        ctx.arc(sx, sy, hub ? 3 : 1.8, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255,107,0,${fade})`;
        ctx.fill();

        if (hub || uz > 0.25) {
          ctx.font = `${hub ? 600 : 400} ${hub ? 9 : 8}px monospace`;
          ctx.fillStyle = `rgba(255,107,0,${fade * (hub ? 0.9 : 0.55)})`;
          ctx.letterSpacing = "0.15em";
          ctx.fillText(name, sx + (hub ? 14 : 10), sy - (hub ? 10 : 7));
        }
      });

      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full block" />;
}

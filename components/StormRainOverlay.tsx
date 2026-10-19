"use client";

import { useEffect, useRef, useState } from "react";
import { rainAppearance, type StormPresentation } from "@/lib/storm-presentation";
import "./StormRainOverlay.css";

type Drop = { x: number; y: number; scale: number };

export default function StormRainOverlay({ storm }: { storm: StormPresentation }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(storm);
  const refresh = useRef<(() => void) | null>(null);
  const [animation, setAnimation] = useState(true);
  const animationRef = useRef(animation);

  useEffect(() => {
    latest.current = storm;
    animationRef.current = animation;
    refresh.current?.();
  }, [storm, animation]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let previousMinute = 0;
    let velocity = 180;
    const drops: Drop[] = [];

    const draw = (time: number, advance: boolean) => {
      const state = latest.current;
      const appearance = rainAppearance(state.rainMmPerHour, state.speed, width * height);
      context.clearRect(0, 0, width, height);
      if (state.minute < previousMinute || state.phase === "ready") drops.length = 0;
      previousMinute = state.minute;
      if (!appearance.count || !animationRef.current) {
        drops.length = 0;
        previous = 0;
        return;
      }
      while (drops.length < appearance.count) drops.push({ x: Math.random() * width, y: Math.random() * height, scale: 0.7 + Math.random() * 0.6 });
      drops.length = appearance.count;
      const dt = advance && previous ? Math.min((time - previous) / 1000, 0.05) : 0;
      previous = advance ? time : 0;
      velocity += (appearance.velocity - velocity) * Math.min(1, dt * 6);
      context.lineCap = "round";
      context.strokeStyle = `rgba(48, 102, 142, ${appearance.opacity})`;
      for (const drop of drops) {
        drop.y += velocity * drop.scale * dt;
        drop.x -= velocity * 0.18 * drop.scale * dt;
        if (drop.y > height + appearance.length) { drop.y = -appearance.length; drop.x = Math.random() * width; }
        if (drop.x < -appearance.length) drop.x = width + appearance.length;
        const length = appearance.length * drop.scale;
        context.lineWidth = 0.8 + drop.scale * 0.35;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - length * 0.18, drop.y + length);
        context.stroke();
      }
    };
    const animate = (time: number) => {
      draw(time, true);
      frame = window.requestAnimationFrame(animate);
    };
    const update = () => {
      window.cancelAnimationFrame(frame);
      previous = 0;
      if (document.hidden) return;
      draw(performance.now(), false);
      if (latest.current.running && (latest.current.rainMmPerHour ?? 0) > 0 && animationRef.current && !motion.matches) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drops.length = 0;
      update();
    };
    refresh.current = update;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    resize();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      refresh.current = null;
    };
  }, []);

  const available = storm.rainMmPerHour !== null;
  return <>
    <canvas ref={canvas} className="storm-rain-canvas" aria-hidden="true" />
    <div className="storm-map-label" data-phase={storm.phase}>
      <div className="storm-map-summary">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9H6Z" />
          <path d="m8 17-1 3m6-3-1 3m6-3-1 3" />
        </svg>
        <div><strong>{storm.label}</strong>
          <span>{available ? `${storm.rainMmPerHour} mm/h · Playback ${storm.speed}× · ${storm.source === "phone" ? "Phone sync" : "Local simulation"}` : "Synthetic storm · weather unavailable"}</span>
        </div>
      </div>
      <button type="button" className="storm-animation-toggle" aria-label="Rain animation" aria-pressed={animation} onClick={() => setAnimation(value => !value)}>
        Rain animation {animation ? "on" : "off"}
      </button>
    </div>
  </>;
}

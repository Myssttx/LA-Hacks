"use client";

import { motion } from "framer-motion";

export function AlertCard({
  title,
  place,
  className,
  delay,
}: {
  title: string;
  place: string;
  className: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={`absolute z-[5] w-52 ${className}`}
    >
      <div className="rounded-md border border-[#ff6b00]/25 bg-black/70 p-3 backdrop-blur-sm shadow-[0_8px_30px_-10px_rgba(255,107,0,0.4)]">
        <div className="mb-2 flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="h-1.5 w-1.5 rounded-full bg-[#ff6b00]"
          />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#ff6b00]">{title}</span>
        </div>
        <div className="font-mono text-sm font-medium tracking-[0.15em] text-white/90">{place}</div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "78%" }}
            transition={{ duration: 1.2, delay: delay + 0.3 }}
            className="h-full bg-[#ff6b00]/70"
          />
        </div>
      </div>
    </motion.div>
  );
}

export function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={`mb-5 flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-[#ff6b00] ${center ? "justify-center" : ""}`}
    >
      <span className="h-px w-6 bg-[#ff6b00]" />
      {children}
      {center && <span className="h-px w-6 bg-[#ff6b00]" />}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-sm border border-white/[0.07] bg-white/[0.02] p-6">
      <div className="mb-1 font-mono text-3xl font-semibold text-[#ff6b00]">{value}</div>
      <div className="text-sm leading-relaxed text-white/50">{label}</div>
    </div>
  );
}

export function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-5">
      <div className="w-5 shrink-0 pt-0.5 font-mono text-xs text-[#ff6b00]/40">{n}</div>
      <div>
        <div className="mb-1 text-sm font-medium text-white">{title}</div>
        <div className="text-sm leading-relaxed text-white/50">{body}</div>
      </div>
    </div>
  );
}

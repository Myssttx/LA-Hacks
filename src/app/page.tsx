"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HeroGlobe } from "@/components/landing/hero-globe";
import { AlertCard, Eyebrow, Stat, Step } from "@/components/landing/parts";
import { BRAND, BRAND_WORDMARK, COPYRIGHT_NOTICE, LEGAL } from "@/lib/brand";

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.96]);

  return (
    <div
      ref={scrollRef}
      className="h-screen overflow-y-scroll bg-black text-white"
      style={{ scrollSnapType: "y proximity" }}
    >
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col" style={{ scrollSnapAlign: "start" }}>
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="absolute inset-0 pointer-events-none"
        >
          <HeroGlobe />
          <AlertCard
            title="STRUCTURAL ALERT"
            place="MIAMI"
            className="right-[20%] top-[26%]"
            delay={0.9}
          />
          <AlertCard
            title="SURGE WATCH"
            place="MIAMI BEACH"
            className="right-[5%] top-[48%]"
            delay={1.3}
          />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 flex items-center justify-between px-8 pt-7">
          <span className="font-mono text-xs tracking-[0.3em] text-white/40">{BRAND_WORDMARK}</span>
          <span className="font-mono text-xs tracking-[0.2em] text-white/25">
            PRE-INCIDENT INTELLIGENCE
          </span>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Eyebrow>BUILT FOR FIRST RESPONDERS</Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="max-w-4xl text-balance text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl"
          >
            Know the building <span className="text-white/40">before the truck arrives.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-white/55"
          >
            {BRAND.name} runs an AI agent against every building — Street View, FEMA flood zones,
            surge maps, nearby assets — and produces a 30-second size-up a battalion chief can act
            on.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex items-center gap-6"
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 rounded-sm bg-[#ff6b00] px-6 py-3 text-sm font-medium tracking-wide text-black transition-colors hover:bg-[#ff7f1f]"
            >
              Open Dashboard
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <button
              onClick={() =>
                scrollRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" })
              }
              className="font-mono text-xs tracking-[0.2em] text-white/30 transition-colors hover:text-white/60"
            >
              LEARN MORE ↓
            </button>
          </motion.div>
        </div>

        <div className="relative z-10 flex justify-center pb-8">
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="font-mono text-[10px] tracking-[0.3em] text-white/20"
          >
            SCROLL
          </motion.div>
        </div>
      </section>

      {/* The problem */}
      <section
        className="flex min-h-screen items-center px-8 py-24 md:px-16"
        style={{ scrollSnapAlign: "start" }}
      >
        <div className="mx-auto grid w-full max-w-5xl items-center gap-16 md:grid-cols-2">
          <div>
            <Eyebrow>THE PROBLEM</Eyebrow>
            <h2 className="mb-7 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Firefighters size up on the curb.
            </h2>
            <p className="mb-6 leading-relaxed text-white/50">
              When Hurricane Helene hit Florida in 2024, Miami-Dade Fire Rescue ran over{" "}
              <span className="text-white/80">3,000 calls in 72 hours</span>. For most buildings
              they responded to, they had zero pre-incident information — no structural data, no
              flood risk, nothing.
            </p>
            <p className="leading-relaxed text-white/50">
              Crews get <span className="text-white/80">60 seconds</span> to size up an unfamiliar
              structure while lives are on the line. That’s the problem {BRAND.name} solves —
              before the tone drops.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat value="3,000+" label="calls in 72 hrs during Hurricane Helene" />
            <Stat value="~0" label="buildings with pre-incident plans in Miami-Dade" />
            <Stat value="60s" label="average on-scene size-up window" />
            <Stat value="30s" label={`${BRAND.name}'s size-up, ready before dispatch`} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        className="flex min-h-screen items-center px-8 py-24 md:px-16"
        style={{ scrollSnapAlign: "start" }}
      >
        <div className="mx-auto grid w-full max-w-5xl items-center gap-16 md:grid-cols-2">
          <div className="space-y-8">
            <Step
              n="01"
              title="Scan the building"
              body="Capture a LiDAR scan with a phone. Polycam exports a USDZ mesh in minutes."
            />
            <div className="h-px bg-white/[0.06]" />
            <Step
              n="02"
              title="Agent synthesizes the intel"
              body="Claude runs a multi-step tool-use loop — Street View, FEMA flood zones, NOAA surge data, nearby infrastructure — and produces a structured report."
            />
            <div className="h-px bg-white/[0.06]" />
            <Step
              n="03"
              title="Chief gets the size-up"
              body="Headline risk, immediate actions, and a storm-surge slider that floods the 3D scan and shows which exits stay open."
            />
            <div className="h-px bg-white/[0.06]" />
            <Step
              n="04"
              title="Cache it. Always ready."
              body="Reports are stored and replayed instantly. No live API call at dispatch, so it works in the field."
            />
          </div>
          <div>
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <h2 className="mb-7 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Scan once. <span className="text-white/40">Pre-plan every call.</span>
            </h2>
            <p className="leading-relaxed text-white/50">
              The same pattern used for AI-driven drone inspection — agent over visual + geospatial
              data — applied to building risk for the people who run toward the fire.
            </p>
            <Link
              href="/dashboard"
              className="group mt-8 inline-flex items-center gap-2 font-mono text-sm tracking-[0.15em] text-[#ff6b00] transition-colors hover:text-[#ff7f1f]"
            >
              OPEN THE DASHBOARD →
            </Link>
          </div>
        </div>
      </section>

      {/* Market */}
      <section
        className="flex min-h-screen items-center px-8 py-24 md:px-16"
        style={{ scrollSnapAlign: "start" }}
      >
        <div className="mx-auto w-full max-w-5xl">
          <Eyebrow>MARKET + USE CASE</Eyebrow>
          <h2 className="mb-4 max-w-2xl text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Every building in every city.
          </h2>
          <p className="mb-14 max-w-xl leading-relaxed text-white/50">
            Miami-Dade is the wedge. The architecture scales to any city, any building type, any
            risk profile.
          </p>
          <div className="mb-14 grid gap-6 md:grid-cols-3">
            <Stat value="30,000+" label="fire departments in the United States" />
            <Stat value="130M+" label="buildings in the US addressable by this system" />
            <Stat value="700k+" label="structures in Miami-Dade County alone" />
          </div>
          <div className="grid gap-8 border-t border-white/[0.06] pt-12 md:grid-cols-3">
            <div>
              <div className="mb-3 font-mono text-xs tracking-[0.25em] text-[#ff6b00]">
                FIRE &amp; RESCUE
              </div>
              <p className="text-sm leading-relaxed text-white/50">
                Battalion chiefs get a structured size-up before the truck leaves the station.
                Immediate actions are pre-generated and dispatchable from the app.
              </p>
            </div>
            <div>
              <div className="mb-3 font-mono text-xs tracking-[0.25em] text-[#ff6b00]">
                EMERGENCY MANAGEMENT
              </div>
              <p className="text-sm leading-relaxed text-white/50">
                Pre-plan entire neighborhoods before hurricane season. Drag the scenario slider to
                see exactly what 6 ft of surge looks like inside a specific building.
              </p>
            </div>
            <div>
              <div className="mb-3 font-mono text-xs tracking-[0.25em] text-[#ff6b00]">
                BEYOND FIRE
              </div>
              <p className="text-sm leading-relaxed text-white/50">
                Insurance underwriting, CRE due diligence, urban search &amp; rescue. {BRAND.name}{" "}
                is a structured-intel agent platform — fire response is the wedge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="flex min-h-[60vh] items-center justify-center px-8 text-center"
        style={{ scrollSnapAlign: "start" }}
      >
        <div>
          <Eyebrow center>TRY IT</Eyebrow>
          <h2 className="mx-auto mb-8 max-w-2xl text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            See it run on a real building.
          </h2>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 rounded-sm bg-[#ff6b00] px-8 py-4 text-sm font-medium tracking-wide text-black transition-colors hover:bg-[#ff7f1f]"
          >
            Open Dashboard
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p className="mt-6 font-mono text-xs tracking-[0.2em] text-white/40">
            CONTACT ·{" "}
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="text-white/70 underline-offset-4 transition-colors hover:text-[#ff6b00] hover:underline"
            >
              {LEGAL.contactEmail}
            </a>
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-8 py-8 text-center font-mono text-[11px] tracking-[0.15em] text-white/30">
        {COPYRIGHT_NOTICE}
      </footer>
    </div>
  );
}

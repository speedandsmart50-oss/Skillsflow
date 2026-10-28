import React from "react";
import Image from "next/image";

export function ElectricLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`electric-logo inline-flex items-center gap-2 rounded-full border border-[#D9D6FF] bg-white px-1.5 py-1.5 pr-3 shadow-[0_4px_14px_rgba(67,97,238,0.14)] ${className}`}>
      <Image src="/icon.svg" alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-[family-name:var(--font-geist-sans),sans-serif] text-[15px] font-semibold tracking-[-0.02em] text-[#172033]">Skillsflow</span>
        </div>
        <p className="text-[10px] font-medium tracking-wide text-[#8F9CAE]">Skills IA • MCP • Automatisation</p>
      </div>
    </div>
  );
}

export function NavIconOverview({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 20v-5h-4v5A1.5 1.5 0 0 1 8.5 21.5h-4A1.5 1.5 0 0 1 3 20z" />
    </svg>
  );
}

export function NavIconSkills({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function NavIconCatalog({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function NavIconMcp({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h8" />
    </svg>
  );
}

export function NavIconCommunity({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function NavIconMyCommunity({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

export function NavIconProspection({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="2" y1="12" x2="4" y2="12" />
    </svg>
  );
}

export function NavIconBilling({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function NavIconPrivacy({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function NavIconHelp({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[#8F9CAE]"}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function MoreVerticalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function GearIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function PlayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

export function BlueWavesGraphic() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -bottom-2 -right-4 h-28 w-44 opacity-80" viewBox="0 0 176 112" fill="none">
      <defs>
        <linearGradient id="blueWaveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#397BFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6557FF" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="blueWaveGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#397BFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0B1020" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 80C35 45 75 105 120 60C145 35 160 55 176 40V112H0V80Z" fill="url(#blueWaveGrad2)" />
      <path d="M15 95C50 60 90 100 135 65C155 50 168 62 176 55V112H15V95Z" fill="url(#blueWaveGrad1)" />
      <path d="M0 80C35 45 75 105 120 60C145 35 160 55 176 40" stroke="#397BFF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 95C50 60 90 100 135 65C155 50 168 62 176 55" stroke="#6557FF" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
    </svg>
  );
}

export function CyanBarChartGraphic() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -bottom-1 -right-2 h-24 w-36 opacity-85" viewBox="0 0 144 96" fill="none">
      <defs>
        <linearGradient id="cyanBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="20" y="58" width="16" height="38" rx="4" fill="url(#cyanBarGrad)" stroke="#00E5FF" strokeWidth="1" strokeOpacity="0.4" />
      <rect x="46" y="44" width="16" height="52" rx="4" fill="url(#cyanBarGrad)" stroke="#00E5FF" strokeWidth="1" strokeOpacity="0.5" />
      <rect x="72" y="32" width="16" height="64" rx="4" fill="url(#cyanBarGrad)" stroke="#00E5FF" strokeWidth="1" strokeOpacity="0.6" />
      <rect x="98" y="18" width="16" height="78" rx="4" fill="url(#cyanBarGrad)" stroke="#00E5FF" strokeWidth="1.2" strokeOpacity="0.8" />
      <rect x="124" y="6" width="16" height="90" rx="4" fill="url(#cyanBarGrad)" stroke="#00E5FF" strokeWidth="1.4" strokeOpacity="0.9" />
    </svg>
  );
}

export function VioletWaveGraphic() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -bottom-2 -right-3 h-28 w-44 opacity-80" viewBox="0 0 176 112" fill="none">
      <defs>
        <linearGradient id="violetWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B3A4FF" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#6557FF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#151F38" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M10 90C45 50 80 110 130 55C155 28 165 45 176 30V112H10V90Z" fill="url(#violetWaveGrad)" />
      <path d="M10 90C45 50 80 110 130 55C155 28 165 45 176 30" stroke="#B3A4FF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M35 102C65 72 95 105 140 70C158 55 168 62 176 55" stroke="#6557FF" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  );
}

export function LogOutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SparklesIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CreditCardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}


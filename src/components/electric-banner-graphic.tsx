import React from "react";

export function ElectricBannerGraphic({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 bg-gradient-to-tr from-[#397BFF]/25 via-[#6557FF]/35 to-[#00E5FF]/20 blur-3xl opacity-70 animate-electric-pulse"
      />

      <svg
        viewBox="0 0 380 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full max-w-[340px] drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="platTopGrad" x1="190" y1="120" x2="190" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#253A70" />
            <stop offset="50%" stopColor="#1B2B54" />
            <stop offset="100%" stopColor="#101C38" />
          </linearGradient>

          <linearGradient id="platLeftGrad" x1="80" y1="170" x2="190" y2="235" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#15244A" />
            <stop offset="100%" stopColor="#0B132B" />
          </linearGradient>

          <linearGradient id="platRightGrad" x1="300" y1="170" x2="190" y2="235" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#192A56" />
            <stop offset="100%" stopColor="#0D1630" />
          </linearGradient>

          <linearGradient id="subPlatTop" x1="190" y1="145" x2="190" y2="215" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#314E96" />
            <stop offset="100%" stopColor="#1B2E5C" />
          </linearGradient>

          <linearGradient id="crystalGrad" x1="170" y1="60" x2="210" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#70E5FF" />
            <stop offset="35%" stopColor="#397BFF" />
            <stop offset="100%" stopColor="#6557FF" />
          </linearGradient>

          <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#397BFF" />
          </linearGradient>

          <linearGradient id="neonIndigo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6557FF" />
            <stop offset="100%" stopColor="#B3A4FF" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer subtle glow disk beneath platform */}
        <ellipse cx="190" cy="210" rx="140" ry="40" fill="#397BFF" fillOpacity="0.15" />
        <ellipse cx="190" cy="210" rx="90" ry="25" fill="#00E5FF" fillOpacity="0.22" filter="url(#neonGlow)" />

        {/* Lower Base Isometric Platform */}
        <g>
          {/* Base bottom sides */}
          <path d="M70 195 L190 245 L190 255 L70 205 Z" fill="#091024" />
          <path d="M190 245 L310 195 L310 205 L190 255 Z" fill="#060B1A" />

          {/* Middle rim sides */}
          <path d="M70 185 L190 235 L190 245 L70 195 Z" fill="url(#platLeftGrad)" />
          <path d="M190 235 L310 185 L310 195 L190 245 Z" fill="url(#platRightGrad)" />

          {/* Lower surface */}
          <polygon points="190,145 310,185 190,235 70,185" fill="url(#platTopGrad)" stroke="#397BFF" strokeWidth="1" strokeOpacity="0.3" />
        </g>

        {/* Raised Inner Platform */}
        <g transform="translate(0, -14)">
          {/* Sides */}
          <path d="M105 180 L190 215 L190 228 L105 193 Z" fill="#122045" stroke="#397BFF" strokeWidth="0.8" strokeOpacity="0.4" />
          <path d="M190 215 L275 180 L275 193 L190 228 Z" fill="#0E1938" stroke="#6557FF" strokeWidth="0.8" strokeOpacity="0.4" />

          {/* Glowing Top Surface */}
          <polygon points="190,145 275,180 190,215 105,180" fill="url(#subPlatTop)" stroke="url(#neonCyan)" strokeWidth="1.6" />

          {/* Neon inner edge highlights */}
          <polyline points="105,180 190,215 275,180" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" filter="url(#neonGlow)" />
        </g>

        {/* Hovering Central Lightning Bolt Core (Animated) */}
        <g className="animate-electric-float">
          {/* Radial light behind crystal */}
          <circle cx="190" cy="98" r="38" fill="#397BFF" fillOpacity="0.35" filter="url(#neonGlow)" />
          <circle cx="190" cy="98" r="22" fill="#00E5FF" fillOpacity="0.4" />

          {/* 3D Crystal Body */}
          <polygon points="190,48 214,88 190,145 166,88" fill="url(#crystalGrad)" stroke="#70E5FF" strokeWidth="1.5" />
          {/* Facet highlights */}
          <polygon points="190,48 214,88 190,145" fill="#397BFF" fillOpacity="0.4" />
          <polygon points="190,48 166,88 190,145" fill="#B3A4FF" fillOpacity="0.25" />
          <line x1="190" y1="48" x2="190" y2="145" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.8" />

          {/* Glowing Lightning overlay on the crystal */}
          <path
            d="M192 68 L180 94 L190 94 L188 116 L202 88 L192 88 Z"
            fill="#FFFFFF"
            filter="url(#neonGlow)"
          />
          <path
            d="M192 68 L180 94 L190 94 L188 116 L202 88 L192 88 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* Floating Tech Chips / Badges */}

        {/* 1. MCP Graph Nodes Chip (Left) */}
        <g transform="translate(68, 92)" className="animate-electric-float" style={{ animationDelay: "0.8s" }}>
          <rect x="0" y="0" width="38" height="34" rx="10" fill="#141E3A" stroke="#397BFF" strokeWidth="1.2" filter="url(#neonGlow)" />
          <rect x="0" y="0" width="38" height="34" rx="10" fill="#141E3A" stroke="#397BFF" strokeWidth="1.2" />
          {/* MCP graph icon */}
          <circle cx="12" cy="17" r="3" fill="#397BFF" />
          <circle cx="26" cy="11" r="3" fill="#00E5FF" />
          <circle cx="26" cy="23" r="3" fill="#6557FF" />
          <line x1="14" y1="16" x2="24" y2="12" stroke="#70E5FF" strokeWidth="1.2" />
          <line x1="14" y1="18" x2="24" y2="22" stroke="#70E5FF" strokeWidth="1.2" />
        </g>

        {/* 2. Sparkles Chip (Top Center-Right) */}
        <g transform="translate(250, 60)" className="animate-electric-float" style={{ animationDelay: "1.6s" }}>
          <rect x="0" y="0" width="34" height="30" rx="9" fill="#18193C" stroke="#6557FF" strokeWidth="1.2" />
          <path d="M17 7 L19 12 L24 15 L19 18 L17 23 L15 18 L10 15 L15 12 Z" fill="#B3A4FF" />
        </g>

        {/* 3. Code Chip (Right) */}
        <g transform="translate(295, 102)" className="animate-electric-float" style={{ animationDelay: "2.3s" }}>
          <rect x="0" y="0" width="40" height="34" rx="10" fill="#0E233E" stroke="#00E5FF" strokeWidth="1.4" filter="url(#neonGlow)" />
          <rect x="0" y="0" width="40" height="34" rx="10" fill="#0E233E" stroke="#00E5FF" strokeWidth="1.4" />
          {/* Code brackets </> */}
          <path d="M12 17 L8 14 L8 20 Z" fill="#00E5FF" />
          <path d="M14 22 L17 12" stroke="#70E5FF" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M22 14 L26 17 L22 20" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Particle sparkles in air */}
        <circle cx="120" cy="65" r="1.5" fill="#70E5FF" opacity="0.8" />
        <circle cx="270" cy="115" r="2" fill="#B3A4FF" opacity="0.9" />
        <circle cx="150" cy="120" r="1.5" fill="#00E5FF" opacity="0.7" />
        <circle cx="235" cy="40" r="1.2" fill="#FFFFFF" opacity="0.9" />
      </svg>
    </div>
  );
}

/**
 * SVG Icons used throughout the app
 */
export const ICONS = {
  swap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>`,

  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>`,

  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,

  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>`,

  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
  </svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`,

  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,

  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`,

  logo: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#7b61ff"/>
        <stop offset="100%" style="stop-color:#ff6bdf"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#logo-g)"/>
    <!-- Ear tufts -->
    <path d="M22 12 L25 21 L18 19Z" fill="white" opacity="0.85"/>
    <path d="M42 12 L46 19 L39 21Z" fill="white" opacity="0.85"/>
    <!-- Head -->
    <ellipse cx="32" cy="22" rx="13" ry="11" fill="white" opacity="0.2"/>
    <!-- Body -->
    <ellipse cx="32" cy="40" rx="12" ry="14" fill="white" opacity="0.15"/>
    <!-- Left wing -->
    <path d="M14 28 Q12 40 18 50 Q22 44 22 34Z" fill="white" opacity="0.2"/>
    <!-- Right wing -->
    <path d="M50 28 Q52 40 46 50 Q42 44 42 34Z" fill="white" opacity="0.2"/>
    <!-- Chest feather pattern -->
    <path d="M27 32 Q32 36 37 32 Q34 38 32 40 Q30 38 27 32Z" fill="white" opacity="0.25"/>
    <path d="M28 38 Q32 42 36 38 Q34 44 32 46 Q30 44 28 38Z" fill="white" opacity="0.18"/>
    <!-- Left eye -->
    <circle cx="26" cy="21" r="6" fill="white" opacity="0.9"/>
    <circle cx="26" cy="21" r="3.8" fill="#2d1b69"/>
    <circle cx="27.2" cy="19.8" r="1.4" fill="white" opacity="0.9"/>
    <!-- Right eye -->
    <circle cx="38" cy="21" r="6" fill="white" opacity="0.9"/>
    <circle cx="38" cy="21" r="3.8" fill="#2d1b69"/>
    <circle cx="39.2" cy="19.8" r="1.4" fill="white" opacity="0.9"/>
    <!-- Beak -->
    <path d="M30.5 26 L32 30 L33.5 26Z" fill="#f5ac37"/>
    <!-- Eyebrow arcs -->
    <path d="M19 16 Q26 13 32 16" fill="none" stroke="white" stroke-width="1.2" opacity="0.45"/>
    <path d="M32 16 Q38 13 45 16" fill="none" stroke="white" stroke-width="1.2" opacity="0.45"/>
    <!-- Tail -->
    <path d="M28 52 L26 57 L30 55 L32 58 L34 55 L38 57 L36 52Z" fill="white" opacity="0.5"/>
    <!-- Talons -->
    <path d="M26 52 L24 55 M27 52 L27 55 M28 52 L30 55" stroke="white" stroke-width="1" opacity="0.6" fill="none" stroke-linecap="round"/>
    <path d="M36 52 L34 55 M37 52 L37 55 M38 52 L40 55" stroke="white" stroke-width="1" opacity="0.6" fill="none" stroke-linecap="round"/>
  </svg>`,
};

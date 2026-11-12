export type ThemeId = "lava" | "glass" | "vaporwave" | "memphis" | "pixel" | "y2k";
export type ModePref = "system" | "light" | "dark";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Google Fonts stylesheet, loaded only while this theme is active. */
  fonts: string;
  /** Four colours for the picker preview: background, surface, accent, text. */
  swatches: [string, string, string, string];
}

const gf = (families: string) => `https://fonts.googleapis.com/css2?${families}&display=swap`;

export const THEMES: ThemeMeta[] = [
  {
    id: "lava",
    label: "Lava",
    description: "Dark void, liquid-lava orange",
    fonts: gf("family=Urbanist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600"),
    swatches: ["#151419", "#262626", "#F56E0F", "#FBFBFB"],
  },
  {
    id: "glass",
    label: "Glass",
    description: "Frosted panels, blur and light",
    fonts: gf("family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;600"),
    swatches: ["#92b8ff", "#ffffff", "#5b3fe0", "#0f1630"],
  },
  {
    id: "vaporwave",
    label: "Vaporwave",
    description: "Neon pink and purple, 80s–90s synth",
    fonts: gf("family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono"),
    swatches: ["#1a0b2e", "#2d1150", "#ff2bd6", "#00f0ff"],
  },
  {
    id: "memphis",
    label: "Memphis",
    description: "Squiggles and clashing 80s shapes",
    fonts: gf("family=Bungee&family=Rubik:wght@400;500;600;700;800&family=Space+Mono:wght@400;700"),
    swatches: ["#fff6e5", "#ffd23f", "#ff4f79", "#2b59ff"],
  },
  {
    id: "pixel",
    label: "Pixel",
    description: "8-bit game screens and pixel type",
    fonts: gf("family=Press+Start+2P&family=Pixelify+Sans:wght@400;500;600;700&family=VT323"),
    swatches: ["#bcd35a", "#e2eeb4", "#8e1d4f", "#0f380f"],
  },
  {
    id: "y2k",
    label: "Y2K",
    description: "Chrome, gel buttons and sparkles",
    fonts: gf("family=Nunito:wght@400;600;700;800&family=Syncopate:wght@700&family=Space+Mono:wght@400;700"),
    swatches: ["#eef0ff", "#ead0ff", "#3d5cff", "#ff3fa4"],
  },
];

export const DEFAULT_THEME: ThemeId = "lava";
export const STYLE_KEY = "style";
export const MODE_KEY = "theme";
export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/** Inline <head> script: applies the saved theme + mode and starts its font download before first paint. */
export const themeBootScript = `(function(){try{
var d=document.documentElement,P='status-updater:';
function g(k,f){try{var v=JSON.parse(localStorage.getItem(P+k));return v==null?f:v}catch(e){return f}}
var F=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, t.fonts])))};
var s=g('${STYLE_KEY}','${DEFAULT_THEME}');if(!F[s])s='${DEFAULT_THEME}';
var p=g('${MODE_KEY}','system');
var m=p==='light'||p==='dark'?p:(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
d.setAttribute('data-style',s);d.setAttribute('data-mode',m);
var l=document.createElement('link');l.rel='stylesheet';l.id='theme-fonts';l.href=F[s];document.head.appendChild(l);
}catch(e){}})();`;

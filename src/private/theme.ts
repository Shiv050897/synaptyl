// Chat appearance, saved per user on this device only.

export type ThemeMode = 'auto' | 'light' | 'dark'
export type Wallpaper = 'classic' | 'plain' | 'dots' | 'sunset' | 'ocean' | 'forest'
export type ChatTheme = { mode: ThemeMode; accent: string; wallpaper: Wallpaper; textScale: number }

/** Text size steps (1 = normal). */
export const TEXT_SCALES = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45, 1.6]
export const textSizeLabel = (s: number) =>
  s < 0.9 ? 'Smallest' : s < 1 ? 'Small' : s === 1 ? 'Normal' : s < 1.2 ? 'Large' : s < 1.4 ? 'Larger' : 'Largest'

export const ACCENTS: { name: string; value: string }[] = [
  { name: 'Green', value: '#00a884' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
]

export const WALLPAPERS: { id: Wallpaper; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'plain', name: 'Plain' },
  { id: 'dots', name: 'Dots' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'forest', name: 'Forest' },
]

export const DEFAULT_THEME: ChatTheme = { mode: 'auto', accent: ACCENTS[0].value, wallpaper: 'classic', textScale: 1 }

const storageKey = (userId: string) => `syn-pc-theme:${userId}`

export function loadTheme(userId: string): ChatTheme {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null') as Partial<ChatTheme> | null
    if (!raw) return DEFAULT_THEME
    return {
      mode: raw.mode === 'light' || raw.mode === 'dark' ? raw.mode : 'auto',
      accent: ACCENTS.some((a) => a.value === raw.accent) ? raw.accent! : DEFAULT_THEME.accent,
      wallpaper: WALLPAPERS.some((w) => w.id === raw.wallpaper) ? raw.wallpaper! : 'classic',
      textScale: TEXT_SCALES.includes(raw.textScale as number) ? raw.textScale! : 1,
    }
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(userId: string, theme: ChatTheme) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(theme))
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

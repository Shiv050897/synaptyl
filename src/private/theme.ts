// Chat appearance, saved per user on this device only.

export type ThemeMode = 'auto' | 'light' | 'dark'
export type Wallpaper = 'classic' | 'plain' | 'dots' | 'sunset' | 'ocean' | 'forest'
export type ChatTheme = { mode: ThemeMode; accent: string; wallpaper: Wallpaper }

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

export const DEFAULT_THEME: ChatTheme = { mode: 'auto', accent: ACCENTS[0].value, wallpaper: 'classic' }

const storageKey = (userId: string) => `syn-pc-theme:${userId}`

export function loadTheme(userId: string): ChatTheme {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null') as Partial<ChatTheme> | null
    if (!raw) return DEFAULT_THEME
    return {
      mode: raw.mode === 'light' || raw.mode === 'dark' ? raw.mode : 'auto',
      accent: ACCENTS.some((a) => a.value === raw.accent) ? raw.accent! : DEFAULT_THEME.accent,
      wallpaper: WALLPAPERS.some((w) => w.id === raw.wallpaper) ? raw.wallpaper! : 'classic',
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

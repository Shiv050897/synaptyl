// Built-in emoji and sticker sets (no outside services involved).

export const EMOJI_GROUPS: { name: string; icon: string; emoji: string }[] = [
  { name: 'Smileys', icon: '😀', emoji: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👻 💀 🤡 💩 🙈 🙉 🙊' },
  { name: 'Love & hands', icon: '❤️', emoji: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 😻 💋 👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 🫂 👀 🫡' },
  { name: 'Animals', icon: '🐶', emoji: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🦋 🐝 🐞 🐢 🐍 🐙 🐬 🐳 🐠 🦈 🐘 🦒 🐴 🦄 🐑 🐐 🐈 🐕 🌸 🌹 🌻 🌷 🌼 💐 🍀 🌿 🌴 🌵 🍁 🌈 ☀️ 🌙 ⭐ 🌟 ✨ ⚡ 🔥 💧 ❄️ ☃️ 🌊' },
  { name: 'Food', icon: '🍕', emoji: '🍎 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌽 🥕 🌶️ 🥔 🍞 🧀 🥚 🍳 🥞 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍛 🍣 🍱 🥟 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 ☕ 🍵 🧋 🥤 🍹 🍺 🥂' },
  { name: 'Activities', icon: '⚽', emoji: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏏 🏸 🏓 🥊 🎯 🎮 🎲 🧩 🎨 🎬 🎤 🎧 🎵 🎶 🎸 🎹 🥁 🎉 🎊 🎈 🎁 🏆 🥇 🚗 🚕 🚌 🚲 🛵 ✈️ 🚀 🚢 🏠 🏖️ ⛰️ 🗽 🗼 🎡 🌃' },
  { name: 'Objects', icon: '💡', emoji: '📱 💻 ⌚ 📷 📞 💡 🔦 📚 ✏️ 📝 📌 📎 ✂️ 🔒 🔑 💰 💳 🎓 💼 🛒 🛏️ 🧸 🪴 💊 🩹 ✅ ❌ ❓ ❗ 💯 🔔 💤 💬 💭 🆗 🆒 🆕 ➕ ➖ ✔️ ♾️ 🔜 ⏰ 📅' },
]

export const STICKERS: { id: string; emoji: string; caption?: string }[] = [
  { id: 'love', emoji: '🥰' },
  { id: 'hug', emoji: '🫂', caption: 'Hug' },
  { id: 'kiss', emoji: '😘' },
  { id: 'heart', emoji: '❤️' },
  { id: 'lol', emoji: '😂', caption: 'LOL' },
  { id: 'cool', emoji: '😎' },
  { id: 'party', emoji: '🥳', caption: 'Yay!' },
  { id: 'wow', emoji: '🤩', caption: 'Wow' },
  { id: 'cry', emoji: '😭' },
  { id: 'please', emoji: '🥺', caption: 'Please?' },
  { id: 'angry', emoji: '😤' },
  { id: 'think', emoji: '🤔', caption: 'Hmm…' },
  { id: 'sleep', emoji: '😴', caption: 'Good night' },
  { id: 'morning', emoji: '☀️', caption: 'Good morning' },
  { id: 'miss', emoji: '💭', caption: 'Miss you' },
  { id: 'omw', emoji: '🏃', caption: 'On my way' },
  { id: 'thanks', emoji: '🙏', caption: 'Thank you' },
  { id: 'ok', emoji: '👍', caption: 'OK!' },
  { id: 'clap', emoji: '👏' },
  { id: 'fire', emoji: '🔥' },
  { id: 'sorry', emoji: '🙇', caption: 'Sorry' },
  { id: 'coffee', emoji: '☕', caption: 'Coffee?' },
  { id: 'food', emoji: '🍕', caption: 'Hungry' },
  { id: 'cat', emoji: '🐱', caption: 'Meow' },
]

export const stickerById = (id: string) => STICKERS.find((s) => s.id === id)

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : null
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u

/** True for short emoji-only messages, which are shown larger (like WhatsApp). */
export function isJumboEmoji(text: string): boolean {
  if (!EMOJI_ONLY.test(text) || /^[\d#*\s]+$/.test(text)) return false
  const count = segmenter ? [...segmenter.segment(text.replace(/\s/g, ''))].length : text.length / 2
  return count > 0 && count <= 3
}

const RECENT_KEY = 'syn-pc-recent-emoji'
export function recentEmoji(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[] } catch { return [] }
}
export function rememberEmoji(e: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...recentEmoji().filter((x) => x !== e)].slice(0, 24)))
  } catch {
    // ignore
  }
}

// Shared "community role tag" system.
// Used server-side (validation, admin actions) and client-side (legacy runtime rendering).
// No framework/browser-only APIs here so this file is safe to import from both worlds.

export type TagIconId = 'gear' | 'crown' | 'shield' | 'star' | 'bolt' | 'gem' | 'code' | 'flag' | 'heart' | 'wrench';

export interface ProfileTag {
  key: string;
  label: string;
  icon: TagIconId;
  background: string; // hex #RRGGBB
  foreground: string; // hex #RRGGBB
  glow: boolean;
}

export const MAX_TAGS_PER_PLAYER = 6;
export const MAX_LABEL_LENGTH = 24;

export const TAG_ICONS: Array<{ id: TagIconId; name: string }> = [
  { id: 'gear', name: 'Шестерня' },
  { id: 'shield', name: 'Щит' },
  { id: 'crown', name: 'Корона' },
  { id: 'star', name: 'Звезда' },
  { id: 'bolt', name: 'Молния' },
  { id: 'gem', name: 'Кристалл' },
  { id: 'code', name: 'Код' },
  { id: 'wrench', name: 'Гаечный ключ' },
  { id: 'flag', name: 'Флаг' },
  { id: 'heart', name: 'Сердце' }
];
const ICON_IDS = new Set<string>(TAG_ICONS.map((i) => i.id));

// Ready-made preset tags in the style of RP-project forum badges. Admins can assign any
// number of these to a player, plus build fully custom ones (see normalizeTag below).
export const TAG_PRESETS: ProfileTag[] = [
  { key: 'special_admin', label: 'Специальный администратор', icon: 'gear', background: '#FACC15', foreground: '#171717', glow: true },
  { key: 'project_team', label: 'Команда проекта', icon: 'shield', background: '#FACC15', foreground: '#171717', glow: true },
  { key: 'creator', label: 'Создатель проекта', icon: 'crown', background: '#FF4D67', foreground: '#FFFFFF', glow: true },
  { key: 'developer', label: 'Разработчик', icon: 'code', background: '#7C3AED', foreground: '#FFFFFF', glow: true },
  { key: 'tester', label: 'Тестировщик', icon: 'bolt', background: '#22C55E', foreground: '#07130A', glow: false },
  { key: 'moderator', label: 'Модератор', icon: 'shield', background: '#38BDF8', foreground: '#07131A', glow: false },
  { key: 'designer', label: 'Дизайнер', icon: 'gem', background: '#06B6D4', foreground: '#07131A', glow: false },
  { key: 'support', label: 'Тех. поддержка', icon: 'wrench', background: '#F472B6', foreground: '#3A0619', glow: false },
  { key: 'partner', label: 'Партнёр проекта', icon: 'flag', background: '#F97316', foreground: '#FFFFFF', glow: false },
  { key: 'veteran', label: 'Ветеран проекта', icon: 'star', background: '#64748B', foreground: '#FFFFFF', glow: false },
  { key: 'vip', label: 'VIP игрок', icon: 'heart', background: '#F43F5E', foreground: '#FFFFFF', glow: true }
];

function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : fallback;
}
function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}
function slug(label: string, fallback: string): string {
  const s = label.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return s || fallback;
}

export function normalizeTag(raw: unknown): ProfileTag | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const label = text(v.label, MAX_LABEL_LENGTH);
  if (!label) return null;
  const icon: TagIconId = typeof v.icon === 'string' && ICON_IDS.has(v.icon) ? (v.icon as TagIconId) : 'star';
  const rawKey = text(v.key, 60);
  const key = /^[a-z0-9_-]{1,60}$/i.test(rawKey) ? rawKey : `custom_${slug(label, 'tag')}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    key,
    label,
    icon,
    background: hex(v.background, '#FACC15'),
    foreground: hex(v.foreground, '#171717'),
    glow: v.glow === true
  };
}

// Accepts either the new array shape or a legacy single-tag object/column and always
// returns a deduplicated, length-capped array of valid tags.
export function normalizeTags(raw: unknown, max: number = MAX_TAGS_PER_PLAYER): ProfileTag[] {
  const arr: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out: ProfileTag[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const t = normalizeTag(item);
    if (!t || seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function escapeHtmlLocal(s: string): string {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

// Small hand-drawn SVG glyphs — no external icon library / no copied artwork.
export function tagIconSVG(icon: TagIconId, size = 12): string {
  const s = size;
  switch (icon) {
    case 'crown':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M3 19h18l-1.5-9-4.5 4-3-6-3 6-4.5-4L3 19Z" fill="currentColor"/></svg>`;
    case 'gear':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.6" fill="currentColor"/>${Array.from({ length: 8 })
        .map((_, i) => `<rect x="10.6" y="1.4" width="2.8" height="5.2" rx="1.2" fill="currentColor" transform="rotate(${i * 45} 12 12)"/>`)
        .join('')}</svg>`;
    case 'shield':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l7 3v6c0 5-3.1 8.6-7 11-3.9-2.4-7-6-7-11V5l7-3Z" fill="currentColor"/></svg>`;
    case 'star':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.9-5 4.8 1.3 6.8L12 17.4 5.9 20.8l1.3-6.8-5-4.8 6.9-.9L12 2Z" fill="currentColor"/></svg>`;
    case 'bolt':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg>`;
    case 'gem':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2 22 9 12 22 2 9Z" fill="currentColor"/></svg>`;
    case 'code':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M8.5 6 2.5 12l6 6M15.5 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'wrench':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M14.7 3.3a5 5 0 0 0-6.6 6l-6 6 3 3 6-6a5 5 0 0 0 6-6.6l-3.2 3.2-2.1-2.1 3.2-3.2Z" fill="currentColor"/></svg>`;
    case 'flag':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M5 3v18h1.6V14H18l-2.6-4L18 6H6.6V3H5Z" fill="currentColor"/></svg>`;
    case 'heart':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.8-9C.6 8.4 2 5 5.3 5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.3 0 4.7 3.4 3.1 7C19.5 16.4 12 21 12 21Z" fill="currentColor"/></svg>`;
    default:
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>`;
  }
}

export function tagBadgeHTML(tag: ProfileTag, compact = false): string {
  const glow = tag.glow ? ' tag-badge-glow' : '';
  return (
    `<span class="tag-badge${compact ? ' compact' : ''}${glow}" style="--tag-bg:${tag.background};--tag-fg:${tag.foreground}">` +
    `<span class="tag-badge-icon">${tagIconSVG(tag.icon, compact ? 10 : 12)}</span>` +
    `<span class="tag-badge-label">${escapeHtmlLocal(tag.label)}</span>` +
    `</span>`
  );
}

export function tagsRowHTML(raw: unknown, compact = false): string {
  const tags = normalizeTags(raw);
  if (!tags.length) return '';
  return `<span class="tags-row${compact ? ' compact' : ''}">${tags.map((t) => tagBadgeHTML(t, compact)).join('')}</span>`;
}

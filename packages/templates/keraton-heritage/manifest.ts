import type { TemplateManifest } from '../sdk/index.js'

/**
 * The first production theme. Palettes are starting points; the host's
 * `appearance.themeTokens` always win because the mount publishes them as
 * CSS custom properties on the template root.
 */
export const manifest: TemplateManifest = {
  id: 'keraton-heritage',
  name: 'Keraton Heritage',
  tier: 'PREMIUM',
  framework: 'vanilla',
  sortOrder: 1,
  isVisible: true,
  occasions: ['pernikahan', 'lamaran'],
  supportedFeatures: [
    'opening',
    'hosts',
    'events',
    'loveStory',
    'media',
    'gallery',
    'audio',
    'video',
    'gifts',
    'rsvp',
    'wishes',
    'liveStream',
    'socialKit',
    'travelInfo',
    'entourage',
    'coHosts',
    'additionalNotes',
    'closing',
    'qrCheckin',
    'privatePin',
  ],
  palettes: [
    {
      id: 'ivory-sogan',
      name: 'Ivory Sogan',
      tokens: {
        bgPrimary: '#faf6ee',
        bgSecondary: '#f1e7d4',
        textPrimary: '#2b241c',
        textMuted: '#786650',
        accent: '#7c5a26',
        accentContrast: '#fffaf0',
        border: '#d9c8a6',
      },
    },
    {
      id: 'ratna-green',
      name: 'Ratna Green',
      tokens: {
        bgPrimary: '#102a23',
        bgSecondary: '#183b31',
        textPrimary: '#f4ecdd',
        textMuted: '#c4b9a1',
        accent: '#d9b97a',
        accentContrast: '#17231e',
        border: '#3d5a4c',
      },
    },
    {
      id: 'lontar-copper',
      name: 'Lontar Copper',
      tokens: {
        bgPrimary: '#f7f1e6',
        bgSecondary: '#ece0cb',
        textPrimary: '#3a2a20',
        textMuted: '#7c6450',
        accent: '#8f4f2a',
        accentContrast: '#fff6ec',
        border: '#d8c2a8',
      },
    },
  ],
  fonts: [
    { family: 'Cormorant Garamond', weights: [400, 500, 600], styles: ['normal', 'italic'] },
    { family: 'Plus Jakarta Sans', weights: [300, 400, 500] },
  ],
}

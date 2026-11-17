import type { TemplateManifest } from '@kalamkala/templates/sdk'

export const manifest: TemplateManifest = {
  id: 'starter-react',
  name: 'Starter React',
  tier: 'BASIC',
  framework: 'react',
  sortOrder: 999,
  isVisible: false,
  occasions: ['pernikahan'],
  palettes: [
    {
      id: 'bawaan',
      name: 'Bawaan',
      tokens: {
        bgPrimary: '#faf8f5',
        bgSecondary: '#f2ece2',
        textPrimary: '#1c1917',
        textMuted: '#57534e',
        accent: '#9a7b56',
        accentContrast: '#ffffff',
        border: '#e6e1d6',
      },
    },
  ],
}

export default manifest

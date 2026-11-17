import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WHATSAPP_TEMPLATE,
  WHATSAPP_TEMPLATE_VARIABLES,
  createDefaultInvitationContent,
} from './defaults.js'
import { MasterInvitationSchema } from './invitation.js'

describe('createDefaultInvitationContent', () => {
  it('creates a complete document that parses with the master schema', () => {
    const content = createDefaultInvitationContent()

    expect(MasterInvitationSchema.safeParse(content).success).toBe(true)
    expect(content.hosts.displayOrder).toEqual(['primary', 'secondary'])
    expect(content.modules.enableQrCheckin).toBe(false)
  })

  it('places the single event one year after an injected now', () => {
    const content = createDefaultInvitationContent({
      now: new Date('2026-11-18T12:34:56.000Z'),
    })

    expect(content.events).toHaveLength(1)
    expect(content.events[0]?.startsAt).toBe('2027-11-18T09:00:00+07:00')
    expect(content.events[0]?.timezone).toBe('WIB')
  })

  it('honours the requested locale', () => {
    const content = createDefaultInvitationContent({ locale: 'en' })

    expect(content.settings.locale).toBe('en')
  })
})

describe('WhatsApp template defaults', () => {
  it('uses every supported placeholder at least once', () => {
    for (const variable of WHATSAPP_TEMPLATE_VARIABLES) {
      expect(DEFAULT_WHATSAPP_TEMPLATE).toContain(`{${variable}}`)
    }
  })
})

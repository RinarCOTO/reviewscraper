'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'Is PicoSure or PicoWay more painful?',
    a: 'Neither is significantly more painful than the other. Both feel similar to a rubber band snap. PicoWay\'s shorter pulse duration theoretically means less heat, which some patients find slightly more comfortable.',
  },
  {
    q: 'Can you switch between PicoSure and PicoWay during treatment?',
    a: 'Yes, if your provider has both systems. Some clinics use PicoWay for initial ink clearance and PicoSure for follow-up skin texture work. This is uncommon but possible.',
  },
  {
    q: 'How many sessions does each require?',
    a: 'Most tattoos require 5 to 10 sessions with either laser. PicoWay may require fewer sessions for multi-color tattoos due to its broader wavelength coverage. Session count depends more on the tattoo (age, color, depth, location on body) than on which picosecond laser is used.',
  },
  {
    q: 'Is PicoSure outdated?',
    a: 'No. PicoSure remains a current-generation picosecond laser with active FDA clearances. The PicoSure Pro (launched later) added wavelength flexibility. However, PicoWay\'s three-wavelength standard configuration and shorter pulse duration represent a technical advantage for tattoo removal specifically.',
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div>
      {FAQS.map((faq, i) => (
        <div key={i} className="faq-item">
          <h3>
            <button
              className="faq-btn"
              aria-expanded={open === i}
              aria-controls={`faq-body-${i}`}
              id={`faq-btn-${i}`}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {faq.q}
              <span className="faq-chevron" aria-hidden="true">▶</span>
            </button>
          </h3>
          <div
            id={`faq-body-${i}`}
            role="region"
            aria-labelledby={`faq-btn-${i}`}
            hidden={open !== i}
            className="faq-body"
          >
            {faq.a}
          </div>
        </div>
      ))}
    </div>
  )
}

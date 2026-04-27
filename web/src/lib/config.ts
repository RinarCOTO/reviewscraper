export interface CompetitorConfig {
  name: string
  slug: string
  stars: string
  isInkout?: boolean
  dotColor: string
}

export interface CityConfig {
  label: string
  slug: string
  competitors: CompetitorConfig[]
}

export const CITIES: CityConfig[] = [
  {
    label: 'Chicago IL', slug: 'chicago-il',
    competitors: [
      { name: 'inkOUT', slug: 'inkout-chicago-il', stars: '5★', isInkout: true, dotColor: 'var(--green)' },
      { name: 'Enfuse Medical Spa', slug: 'enfuse-medical-spa-chicago-il', stars: '5★', dotColor: 'var(--green)' },
      { name: 'Removery (Bucktown)', slug: 'removery-bucktown-chicago-il', stars: '4.9★', dotColor: 'var(--green)' },
      { name: 'Removery (Lincoln Square)', slug: 'removery-lincoln-square-chicago-il', stars: '4.8★', dotColor: 'var(--green)' },
      { name: 'Kovak Cosmetic Center', slug: 'kovak-cosmetic-center-chicago-il', stars: '4.7★', dotColor: 'var(--blue)' },
      { name: 'Tatt2Away', slug: 'tatt2away-chicago-il', stars: '4★', dotColor: 'var(--yellow)' },
    ],
  },
  {
    label: 'Austin TX', slug: 'austin-tx',
    competitors: [
      { name: 'Removery (South Congress)', slug: 'removery-south-congress-austin-tx', stars: '5★', dotColor: 'var(--green)' },
      { name: 'MEDermis Laser Clinic', slug: 'medermis-laser-clinic-austin-tx', stars: '5★', dotColor: 'var(--green)' },
      { name: 'Clean Slate Ink', slug: 'clean-slate-ink-austin-tx', stars: '5★', dotColor: 'var(--green)' },
      { name: 'Tatt2Away', slug: 'tatt2away-austin-tx', stars: '4.7★', dotColor: 'var(--blue)' },
      { name: 'inkOUT', slug: 'inkout-austin-tx', stars: '4.6★', isInkout: true, dotColor: 'var(--blue)' },
    ],
  },
  {
    label: 'Tampa FL', slug: 'tampa-fl',
    competitors: [
      { name: 'Arviv Medical Aesthetics', slug: 'arviv-medical-aesthetics-tampa-fl', stars: '5★', dotColor: 'var(--green)' },
      { name: 'Erasable Med Spa', slug: 'erasable-med-spa-tampa-fl', stars: '4.9★', dotColor: 'var(--green)' },
      { name: 'inkOUT', slug: 'inkout-tampa-fl', stars: '4.8★', isInkout: true, dotColor: 'var(--green)' },
    ],
  },
  {
    label: 'Houston TX', slug: 'houston-tx',
    competitors: [
      { name: 'inkOUT', slug: 'inkout-houston-tx', stars: '4.9★', isInkout: true, dotColor: 'var(--green)' },
      { name: 'InkFree, MD', slug: 'inkfree-md-houston-tx', stars: '4.8★', dotColor: 'var(--green)' },
      { name: 'DermSurgery Associates', slug: 'dermsurgery-associates-houston-tx', stars: '4.7★', dotColor: 'var(--blue)' },
    ],
  },
  {
    label: 'Pleasant Grove UT', slug: 'pleasant-grove-ut',
    competitors: [
      { name: 'Inklifters (Aesthetica)', slug: 'inklifters-aesthetica-pleasant-grove-ut', stars: '4.9★', dotColor: 'var(--green)' },
    ],
  },
  {
    label: 'Draper UT', slug: 'draper-ut',
    competitors: [
      { name: 'Clarity Skin', slug: 'clarity-skin-draper-ut', stars: '4.6★', dotColor: 'var(--blue)' },
      { name: 'inkOUT', slug: 'inkout-draper-ut', stars: '4.3★', isInkout: true, dotColor: 'var(--yellow)' },
      { name: 'Tatt2Away', slug: 'tatt2away-draper-ut', stars: '3★', dotColor: 'var(--red)' },
    ],
  },
]

export function getCityForCompetitor(competitorSlug: string): CityConfig | null {
  return CITIES.find(c => c.competitors.some(comp => comp.slug === competitorSlug)) ?? null
}

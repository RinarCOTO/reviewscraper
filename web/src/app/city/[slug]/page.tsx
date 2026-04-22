import { CITY_SLUGS } from '@/lib/data'
import CityPageClient from './CityPageClient'

export function generateStaticParams() {
  return CITY_SLUGS.map(slug => ({ slug }))
}

export default function CityPage({ params }: { params: { slug: string } }) {
  return <CityPageClient slug={params.slug} />
}

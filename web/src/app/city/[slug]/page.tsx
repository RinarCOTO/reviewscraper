import { CITY_SLUGS } from '@/lib/data'
import CityPageClient from './CityPageClient'

export function generateStaticParams() {
  return CITY_SLUGS.map(slug => ({ slug }))
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CityPageClient slug={slug} />
}

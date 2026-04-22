import { COMPETITOR_SLUGS } from '@/lib/data'
import CompetitorPageClient from './CompetitorPageClient'

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map(slug => ({ slug }))
}

export default function CompetitorPage({ params }: { params: { slug: string } }) {
  return <CompetitorPageClient slug={params.slug} />
}

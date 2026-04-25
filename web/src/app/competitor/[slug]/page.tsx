import { COMPETITOR_SLUGS } from '@/lib/data'
import CompetitorPageClient from './CompetitorPageClient'

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map(slug => ({ slug }))
}

export default async function CompetitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CompetitorPageClient slug={slug} />
}

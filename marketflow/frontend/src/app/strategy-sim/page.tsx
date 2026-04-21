import dynamic from 'next/dynamic'

const TQQQDCAStrategy = dynamic(
  () => import('@/components/strategy/TQQQDCAStrategy'),
  { ssr: false }
)

export default function StrategySimPage() {
  return <TQQQDCAStrategy />
}

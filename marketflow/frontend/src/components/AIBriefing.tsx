import BriefingView from '@/components/BriefingView'

interface AIBriefingProps {
  onOpenSectorRotation?: () => void
}

export default function AIBriefing({ onOpenSectorRotation }: AIBriefingProps) {
  return <BriefingView onOpenSectorRotation={onOpenSectorRotation} />
}

import type { AIInfrastructureDataStatus } from './aiInfrastructureRadar'

export type AIInfraDataConfidenceLevel = 0 | 1 | 2 | 3

export type AIInfraScoreDisplayState =
  | 'hidden'
  | 'qualitative_only'
  | 'numeric_allowed'

export type AIInfraScorePolicyInput = {
  dataStatus: AIInfrastructureDataStatus
  hasMomentumData?: boolean
  hasNewsContext?: boolean
  hasCapexContext?: boolean
}

export type AIInfraScorePolicyResult = {
  confidenceLevel: AIInfraDataConfidenceLevel
  displayState: AIInfraScoreDisplayState
  label: string
  explanation: string
}

export function getAIInfraScorePolicy(
  input: AIInfraScorePolicyInput,
): AIInfraScorePolicyResult {
  if (input.dataStatus === 'placeholder') {
    return {
      confidenceLevel: 0,
      displayState: 'hidden',
      label: 'Data not connected',
      explanation: 'Score is hidden because this theme is still placeholder-only.',
    }
  }

  if (input.dataStatus === 'manual') {
    return {
      confidenceLevel: 1,
      displayState: 'hidden',
      label: 'Manual context',
      explanation: 'Manual notes/watchlist are available, but numeric score is not shown.',
    }
  }

  if (input.dataStatus === 'partial') {
    return {
      confidenceLevel: 2,
      displayState: 'qualitative_only',
      label: 'Partial data',
      explanation: 'Only qualitative context should be shown until data coverage improves.',
    }
  }

  return {
    confidenceLevel: 3,
    displayState: 'numeric_allowed',
    label: 'Live data',
    explanation: 'Numeric score may be shown if the calculation method is documented.',
  }
}

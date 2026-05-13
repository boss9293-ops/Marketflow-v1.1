// AI 인프라 V2 — LiveFlowMap 노드/스테이지 레이아웃 계산기

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import { AI_INFRA_STAGE_ORDER } from '@/lib/semiconductor/aiInfraBucketMap'
import type { AIInfraStage } from '@/lib/semiconductor/aiInfraBucketMap'

export interface FlowMapNodeLayout {
  bucket_id:    string
  display_name: string
  x:            number
  y:            number
  width:        number
  height:       number
  state:        AIInfraBucketState
}

export interface FlowMapStageLayout {
  stage:  AIInfraStage
  x:      number
  y:      number
  width:  number
  nodes:  FlowMapNodeLayout[]
}

export interface FlowMapConnectorLayout {
  x1: number; y1: number
  x2: number; y2: number
}

export interface FlowMapLayout {
  stages:       FlowMapStageLayout[]
  connectors:   FlowMapConnectorLayout[]
  viewBoxWidth:  number
  viewBoxHeight: number
}

const NODE_H    = 58
const NODE_GAP  = 6
const HEADER_H  = 22
const PAD_X     = 8
const PAD_Y     = 8
const STAGE_GAP = 20

export function buildFlowMapLayout(
  states: AIInfraBucketState[],
  containerWidth: number,
): FlowMapLayout {
  const w = Math.max(containerWidth, 600)

  const byStage = new Map<AIInfraStage, AIInfraBucketState[]>()
  for (const stage of AI_INFRA_STAGE_ORDER) byStage.set(stage, [])
  for (const s of states) {
    const arr = byStage.get(s.stage) ?? []
    arr.push(s)
    byStage.set(s.stage, arr)
  }

  const stageCount = AI_INFRA_STAGE_ORDER.length
  const totalInner = w - PAD_X * 2
  const stageWidth = Math.floor((totalInner - (stageCount - 1) * STAGE_GAP) / stageCount)
  const nodeW      = Math.min(148, stageWidth - 4)

  let maxNodes = 0
  for (const nodes of byStage.values()) if (nodes.length > maxNodes) maxNodes = nodes.length

  const innerH   = maxNodes * (NODE_H + NODE_GAP) - (maxNodes > 0 ? NODE_GAP : 0)
  const viewBoxH = PAD_Y * 2 + HEADER_H + innerH

  const stages: FlowMapStageLayout[] = []
  let stageX = PAD_X

  for (const stage of AI_INFRA_STAGE_ORDER) {
    const list    = byStage.get(stage) ?? []
    const colH    = list.length * (NODE_H + NODE_GAP) - (list.length > 0 ? NODE_GAP : 0)
    const startY  = PAD_Y + HEADER_H + Math.floor((innerH - colH) / 2)
    const centerX = stageX + Math.floor(stageWidth / 2)

    const nodes: FlowMapNodeLayout[] = list.map((s, i) => ({
      bucket_id:    s.bucket_id,
      display_name: s.display_name,
      x:      stageX + Math.floor((stageWidth - nodeW) / 2),
      y:      startY + i * (NODE_H + NODE_GAP),
      width:  nodeW,
      height: NODE_H,
      state:  s,
    }))

    stages.push({ stage, x: centerX, y: PAD_Y, width: stageWidth, nodes })
    stageX += stageWidth + STAGE_GAP
  }

  const connectors: FlowMapConnectorLayout[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const cur  = stages[i]
    const next = stages[i + 1]
    if (cur.nodes.length === 0 || next.nodes.length === 0) continue

    const firstCur  = cur.nodes[0]
    const lastCur   = cur.nodes[cur.nodes.length - 1]
    const firstNext = next.nodes[0]
    const lastNext  = next.nodes[next.nodes.length - 1]

    connectors.push({
      x1: firstCur.x + nodeW,
      y1: (firstCur.y + lastCur.y + NODE_H) / 2,
      x2: firstNext.x,
      y2: (firstNext.y + lastNext.y + NODE_H) / 2,
    })
  }

  return { stages, connectors, viewBoxWidth: w, viewBoxHeight: Math.max(160, viewBoxH) }
}

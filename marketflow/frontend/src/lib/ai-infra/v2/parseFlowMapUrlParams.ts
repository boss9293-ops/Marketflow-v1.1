// AI 인프라 V2 — URL 쿼리 파라미터 파싱 + validation (bucket/symbol)

export interface FlowMapUrlParseResult {
  bucket:        string | null
  symbol:        string | null
  needsSanitize: boolean
}

export function parseFlowMapUrlParams(
  searchParams:         URLSearchParams,
  validBuckets:         string[],
  validSymbolsByBucket: Record<string, string[]>,
): FlowMapUrlParseResult {
  const rawBucket = searchParams.get('bucket')
  const rawSymbol = searchParams.get('symbol')

  // symbol without bucket
  if (!rawBucket && rawSymbol !== null) {
    return { bucket: null, symbol: null, needsSanitize: true }
  }

  // no params
  if (!rawBucket) {
    return { bucket: null, symbol: null, needsSanitize: false }
  }

  // invalid bucket
  if (!validBuckets.includes(rawBucket)) {
    return { bucket: null, symbol: null, needsSanitize: true }
  }

  const bucket = rawBucket

  // valid bucket, no symbol
  if (rawSymbol === null) {
    return { bucket, symbol: null, needsSanitize: false }
  }

  // validate symbol for this bucket
  const validSymbols = validSymbolsByBucket[bucket] ?? []
  const symbol       = validSymbols.includes(rawSymbol) ? rawSymbol : null

  return {
    bucket,
    symbol,
    needsSanitize: symbol === null,
  }
}

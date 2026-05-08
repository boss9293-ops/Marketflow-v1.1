# 반도체 펀더멘털 캐시 JSON의 유효성을 검사하는 스크립트
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_PATH = ROOT / 'marketflow/backend/output/cache/semiconductor_fundamentals_latest.json'

VALID_STATUSES    = {'LIVE', 'CACHE', 'STATIC', 'MANUAL', 'PENDING', 'UNAVAILABLE'}
VALID_FREQUENCIES = {'daily', 'weekly', 'monthly', 'quarterly', 'manual', 'unknown'}
REQUIRED_TOP      = ['generatedAt', 'dataStatusSummary', 'l1Fundamentals', 'l2CapitalFlow', 'l3MarketConfirmation']
REQUIRED_FIELDS   = ['displayValue', 'status', 'source', 'frequency']

REQUIRED_METRICS = {
    'l1Fundamentals':       ['tsmcRevenueYoY', 'bookToBill', 'siaSemiSales', 'nvdaDataCenterRevenue'],
    'l2CapitalFlow':        ['hyperscalerCapex', 'microsoftCapex', 'amazonCapex', 'googleCapex', 'metaCapex'],
    'l3MarketConfirmation': ['soxxReflection', 'soxlDecay'],
}


def validate(path: Path) -> list[str]:
    errors: list[str] = []

    if not path.exists():
        return [f'Cache file not found: {path}']

    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f'Invalid JSON: {e}']

    for key in REQUIRED_TOP:
        if key not in data:
            errors.append(f'Missing top-level key: {key}')

    if errors:
        return errors

    actual_counts: dict[str, int] = {s.lower(): 0 for s in VALID_STATUSES}

    for layer, fields in REQUIRED_METRICS.items():
        layer_data = data.get(layer, {})
        for field in fields:
            if field not in layer_data:
                errors.append(f'Missing metric: {layer}.{field}')
                continue
            metric = layer_data[field]

            for rf in REQUIRED_FIELDS:
                if rf not in metric:
                    errors.append(f'{layer}.{field}: missing field "{rf}"')

            status = metric.get('status', '')
            if status not in VALID_STATUSES:
                errors.append(f'{layer}.{field}: invalid status "{status}"')
            else:
                actual_counts[status.lower()] += 1

            freq = metric.get('frequency', '')
            if freq not in VALID_FREQUENCIES:
                errors.append(f'{layer}.{field}: invalid frequency "{freq}"')

            val = metric.get('value')
            if isinstance(val, float) and val != val:
                errors.append(f'{layer}.{field}: value is NaN')

            dv = metric.get('displayValue')
            if dv is None:
                errors.append(f'{layer}.{field}: displayValue is null')

    summary = data.get('dataStatusSummary', {})
    for k, expected in actual_counts.items():
        got = summary.get(k, None)
        if got != expected:
            errors.append(
                f'dataStatusSummary.{k}: expected {expected}, got {got}'
            )

    return errors


def main():
    errors = validate(CACHE_PATH)
    if errors:
        print('FAIL: semiconductor fundamentals cache validation errors:')
        for e in errors:
            print(f'  · {e}')
        sys.exit(1)
    print('PASS: semiconductor fundamentals cache is valid')


if __name__ == '__main__':
    main()

# 반도체 펀더멘털 캐시를 수동으로 업데이트하는 스크립트
import json
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_PATH = ROOT / 'marketflow/backend/output/cache/semiconductor_fundamentals_latest.json'

VALID_STATUSES = {'LIVE', 'CACHE', 'STATIC', 'MANUAL', 'PENDING', 'UNAVAILABLE'}

METRIC_META = {
    'tsmcRevenueYoY':        ('tsmc_yoy',      'TSMC Revenue YoY'),
    'bookToBill':            ('book_to_bill',   'Book-to-Bill Ratio'),
    'siaSemiSales':          ('sia_sales',      'SIA Global Semi Sales'),
    'nvdaDataCenterRevenue': ('nvda_dc',        'NVDA Data Center Revenue'),
    'hyperscalerCapex':      ('hyp_capex',      'Hyperscaler CapEx'),
    'microsoftCapex':        ('msft_capex',     'Microsoft CapEx'),
    'amazonCapex':           ('amzn_capex',     'Amazon CapEx'),
    'googleCapex':           ('goog_capex',     'Google CapEx'),
    'metaCapex':             ('meta_capex',     'Meta CapEx'),
    'soxxReflection':        ('soxx_ref',       'SOXX Reflection'),
    'soxlDecay':             ('soxl_decay',     'SOXL Decay'),
}

LAYERS = ['l1Fundamentals', 'l2CapitalFlow', 'l3MarketConfirmation']


def load_cache():
    if CACHE_PATH.exists():
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def build_initial_cache():
    return {
        'generatedAt': '',
        'dataStatusSummary': {s.lower(): 0 for s in VALID_STATUSES},
        'l1Fundamentals': {},
        'l2CapitalFlow': {},
        'l3MarketConfirmation': {},
    }


def calc_summary(payload):
    counts = {s.lower(): 0 for s in VALID_STATUSES}
    for layer in LAYERS:
        for metric in payload.get(layer, {}).values():
            st = metric.get('status', 'PENDING').lower()
            if st in counts:
                counts[st] += 1
    return counts


def merge_metric(existing, update, field_name):
    meta_id, meta_label = METRIC_META.get(field_name, (field_name, field_name))
    merged = dict(existing or {})
    merged.update(update)
    merged.setdefault('id', meta_id)
    merged.setdefault('label', meta_label)
    return merged


def apply_input(cache, inp):
    for layer in LAYERS:
        if layer not in inp:
            continue
        cache.setdefault(layer, {})
        for field, update in inp[layer].items():
            existing = cache[layer].get(field)
            cache[layer][field] = merge_metric(existing, update, field)
    return cache


def main():
    parser = argparse.ArgumentParser(description='Update semiconductor fundamentals cache')
    parser.add_argument('--input', '-i', help='Path to input JSON file')
    parser.add_argument('--tsmc-yoy',          help='TSMC Revenue YoY displayValue')
    parser.add_argument('--book-to-bill',       help='Book-to-Bill displayValue')
    parser.add_argument('--sia-sales',          help='SIA global sales displayValue')
    parser.add_argument('--nvda-dc',            help='NVDA DC Revenue displayValue')
    parser.add_argument('--hyperscaler-capex',  help='Hyperscaler CapEx displayValue')
    parser.add_argument('--as-of',              help='Period string e.g. 2026-05')
    args = parser.parse_args()

    if not args.input and not any([
        args.tsmc_yoy, args.book_to_bill, args.sia_sales,
        args.nvda_dc, args.hyperscaler_capex,
    ]):
        parser.print_help()
        sys.exit(1)

    cache = load_cache() or build_initial_cache()

    if args.input:
        inp_path = Path(args.input)
        if not inp_path.exists():
            print(f'ERROR: input file not found: {inp_path}', file=sys.stderr)
            sys.exit(1)
        with open(inp_path, 'r', encoding='utf-8') as f:
            inp = json.load(f)
        cache = apply_input(cache, inp)
        print(f'  loaded: {inp_path}')

    # CLI overrides
    as_of = args.as_of or ''
    def cli_patch(layer, field, val):
        if val:
            patch = {'displayValue': val, 'status': 'MANUAL'}
            if as_of:
                patch['asOf'] = as_of
            cache.setdefault(layer, {})
            existing = cache[layer].get(field)
            cache[layer][field] = merge_metric(existing, patch, field)

    cli_patch('l1Fundamentals', 'tsmcRevenueYoY',        args.tsmc_yoy)
    cli_patch('l1Fundamentals', 'bookToBill',            args.book_to_bill)
    cli_patch('l1Fundamentals', 'siaSemiSales',          args.sia_sales)
    cli_patch('l1Fundamentals', 'nvdaDataCenterRevenue', args.nvda_dc)
    cli_patch('l2CapitalFlow',  'hyperscalerCapex',      args.hyperscaler_capex)

    cache['generatedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    cache['dataStatusSummary'] = calc_summary(cache)

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = json.dumps(cache, ensure_ascii=False, indent=2)
    try:
        json.loads(out)
    except json.JSONDecodeError as e:
        print(f'ERROR: generated JSON is invalid: {e}', file=sys.stderr)
        sys.exit(1)

    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        f.write(out)

    summary = cache['dataStatusSummary']
    print(f'OK: cache written → {CACHE_PATH}')
    print(f'    generatedAt: {cache["generatedAt"]}')
    print(f'    status summary: {summary}')


if __name__ == '__main__':
    main()

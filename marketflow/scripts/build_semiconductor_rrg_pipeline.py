# 반도체 RRG 파이프라인 전체를 순서대로 실행하는 체인 스크립트
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

STEPS = [
    ('build_semiconductor_series_data.py',   'Ticker series data'),
    ('build_semiconductor_bucket_prices.py', 'Bucket price proxy index'),
    ('build_rrg_paths.py',                   'RRG paths (Candidate-D)'),
]


def main():
    for script, desc in STEPS:
        script_path = ROOT / 'marketflow/scripts' / script
        print(f'\n[{desc}]')
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(ROOT),
            capture_output=False,
        )
        if result.returncode != 0:
            print(f'ERROR: {script} failed (exit {result.returncode}) — pipeline stopped.')
            sys.exit(result.returncode)

    print('\nOK: full RRG pipeline completed.')


if __name__ == '__main__':
    main()

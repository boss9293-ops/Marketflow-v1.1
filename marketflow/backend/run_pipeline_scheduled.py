import os
import subprocess
import sys
import datetime
import time
import json
import urllib.request

ALERT_COOLDOWN_HOURS = 4


def _write_pipeline_status(here, ts_iso, returncode, duration_sec, log_path):
    report_path = os.path.join(here, 'output', 'pipeline_report.json')
    status = 'success' if returncode == 0 else 'failure'
    scripts_total = scripts_ok = scripts_failed = 0
    failed_scripts = []
    if os.path.exists(report_path):
        try:
            with open(report_path, encoding='utf-8') as f:
                report = json.load(f)
            scripts_total  = report.get('total', 0)
            scripts_ok     = report.get('success', 0)
            scripts_failed = report.get('failed', 0)
            failed_scripts = [
                item['filename'] for item in report.get('items', [])
                if not item.get('ok', True)
            ]
        except Exception:
            pass
    payload = {
        'last_run_at':    ts_iso,
        'status':         status,
        'exit_code':      returncode,
        'duration_sec':   round(duration_sec, 1),
        'log_file':       os.path.basename(log_path),
        'scripts_total':  scripts_total,
        'scripts_ok':     scripts_ok,
        'scripts_failed': scripts_failed,
        'failed_scripts': failed_scripts,
        'alert_sent':     False,
    }
    out_path = os.path.join(here, 'output', 'pipeline_status.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    history_path = os.path.join(here, 'output', 'pipeline_history.json')
    history = []
    if os.path.exists(history_path):
        try:
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []
            
    history.insert(0, {
        "timestamp": ts_iso,
        "status": status,
        "duration_sec": round(duration_sec, 1),
        "scripts_ok": scripts_ok,
        "scripts_failed": scripts_failed
    })
    history = history[:10]
    
    try:
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
    except Exception:
        pass

    return payload


def _maybe_send_slack_alert(here, payload):
    webhook = os.environ.get('PIPELINE_SLACK_WEBHOOK', '').strip()
    if not webhook or payload['status'] == 'success':
        return
    cooldown_path = os.path.join(here, 'logs', 'last_alert.json')
    if os.path.exists(cooldown_path):
        try:
            with open(cooldown_path, encoding='utf-8') as f:
                last = json.load(f)
            last_dt   = datetime.datetime.fromisoformat(last['alerted_at'])
            elapsed_h = (datetime.datetime.now() - last_dt).total_seconds() / 3600
            if elapsed_h < ALERT_COOLDOWN_HOURS:
                return
        except Exception:
            pass
    failed = ', '.join(payload['failed_scripts'][:5]) or 'unknown'
    text = '\n'.join([
        f":red_circle: *MarketFlow Pipeline FAILED* \u2014 {payload['last_run_at']}",
        f"Exit code: {payload['exit_code']} | Scripts: {payload['scripts_ok']}/{payload['scripts_total']} OK",
        f"Failed: {failed}",
    ])
    try:
        body = json.dumps({'text': text}).encode('utf-8')
        req  = urllib.request.Request(
            webhook, data=body, headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=10)
        with open(cooldown_path, 'w', encoding='utf-8') as f:
            json.dump({'alerted_at': payload['last_run_at'], 'status': 'failure'}, f)
        payload['alert_sent'] = True
        out_path = os.path.join(here, 'output', 'pipeline_status.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f'Slack alert failed: {e}', file=sys.stderr)



def _run_auto_retry(here, ts_iso, payload):
    """Run controlled auto-retry for transient failures. Never raises."""
    try:
        if here not in sys.path:
            sys.path.insert(0, here)
        from services.pipeline_retry import get_retry_plan, execute_retries, apply_retry_to_artifacts

        plan = get_retry_plan()
        if not plan['eligible']:
            print(f'[AUTO-RETRY] Skipped: {plan["reason"]}')
            return

        print(f'[AUTO-RETRY] {plan["reason"]}')
        for item in plan['scripts_to_retry']:
            print(f'[AUTO-RETRY]   queued: {item["script"]} (fail_count={item["fail_count"]})')

        retry_result = execute_retries(plan)
        apply_retry_to_artifacts(ts_iso, retry_result)

        rec  = retry_result['retry_recovered_count']
        fail = retry_result['retry_failed_count']
        print(f'[AUTO-RETRY] Done: {rec} recovered, {fail} still failed.')

        # Update payload so Slack alert reflects recovery
        if rec > 0:
            recovered_set = {r['script'] for r in retry_result['retry_summary'] if r['recovered']}
            payload['failed_scripts'] = [s for s in payload.get('failed_scripts', []) if s not in recovered_set]
            payload['scripts_failed'] = max(0, payload.get('scripts_failed', 0) - rec)
            if not payload['failed_scripts'] and payload.get('exit_code', 1) == 0:
                payload['status'] = 'success'

    except Exception as e:
        print(f'[AUTO-RETRY] Error (non-fatal): {e}', file=sys.stderr)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    run_all = os.path.join(here, 'run_all.py')
    logs_dir = os.path.join(here, 'logs')
    lock_file = os.path.join(logs_dir, 'pipeline.lock')
    os.makedirs(logs_dir, exist_ok=True)

    # PID lock -- abort if already running
    if os.path.exists(lock_file):
        with open(lock_file) as f:
            pid = f.read().strip()
        try:
            import ctypes
            handle = ctypes.windll.kernel32.OpenProcess(1, False, int(pid))
            if handle:
                ctypes.windll.kernel32.CloseHandle(handle)
                print(f"Pipeline already running (PID {pid}). Aborting.")
                sys.exit(0)
        except Exception:
            pass  # stale lock -- proceed
    with open(lock_file, 'w') as f:
        f.write(str(os.getpid()))

    # Log file
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    log_path = os.path.join(logs_dir, f'pipeline_{ts}.log')

    try:
        with open(log_path, 'w', encoding='utf-8', errors='replace') as log:
            log.write(f'=== MarketFlow Pipeline -- {ts} ===\n\n')
            start_time = time.time()
            result = subprocess.run(
                [sys.executable, '-X', 'utf8', run_all, '--skip-macro-bootstrap'],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                encoding='utf-8', errors='replace',
            )
            log.write(result.stdout or '')
            print(result.stdout or '', end='')

        end_time = time.time()
        ts_iso   = datetime.datetime.now().isoformat(timespec='seconds')
        payload  = _write_pipeline_status(here, ts_iso, result.returncode,
                                          end_time - start_time, log_path)
        _run_auto_retry(here, ts_iso, payload)
        _maybe_send_slack_alert(here, payload)

        # Log rotation: delete logs older than 30 days
        cutoff = time.time() - (30 * 86400)
        for name in os.listdir(logs_dir):
            if name.startswith('pipeline_') and name.endswith('.log'):
                path = os.path.join(logs_dir, name)
                if os.path.getmtime(path) < cutoff:
                    os.remove(path)

        sys.exit(result.returncode)
    finally:
        if os.path.exists(lock_file):
            os.remove(lock_file)


if __name__ == '__main__':
    main()

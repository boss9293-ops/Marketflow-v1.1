import os
import subprocess
import sys

TASK_NAME = "MarketFlow_Pipeline"
RUN_HOUR  = "09"   # 09:00 KST -- US market closes 4PM EST = 9AM KST next day
RUN_MIN   = "00"


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    wrapper = os.path.join(here, 'run_pipeline_scheduled.py')
    python  = sys.executable

    # Build schtasks command
    cmd = [
        'schtasks', '/Create', '/F',
        '/TN', TASK_NAME,
        '/TR', f'"{python}" -X utf8 "{wrapper}"',
        '/SC', 'DAILY',
        '/ST', f'{RUN_HOUR}:{RUN_MIN}',
        '/RL', 'HIGHEST',
    ]

    print("Creating scheduled task:")
    print("  Task name :", TASK_NAME)
    print("  Script    :", wrapper)
    print("  Python    :", python)
    print("  Schedule  : Daily at", f"{RUN_HOUR}:{RUN_MIN}")
    print()

    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace')
    if result.returncode == 0:
        print("Task created successfully.")
        print()
        print("To verify:  schtasks /Query /TN", TASK_NAME, "/FO LIST")
        print("To run now: schtasks /Run  /TN", TASK_NAME)
        print("To delete:  schtasks /Delete /TN", TASK_NAME, "/F")
        print()
        print("Retry config (run once in PowerShell):")
        print("  $task = Get-ScheduledTask -TaskName MarketFlow_Pipeline")
        print("  $task.Settings.RestartCount = 3")
        print("  $task.Settings.RestartInterval = 'PT30M'")
        print("  $task.Settings.ExecutionTimeLimit = 'PT2H'")
        print("  Set-ScheduledTask -InputObject $task")
    else:
        last_line = result.stderr.strip().split('\n')[-1]
        print("FAILED:", last_line)
        sys.exit(1)


if __name__ == '__main__':
    main()

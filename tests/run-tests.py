"""Run all Node regressions, and optionally Playwright integration tests."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--browser', action='store_true')
args = parser.parse_args()
commands = [['node', str(file.relative_to(ROOT))] for file in sorted((ROOT / 'tests').glob('*.test.js'))]
if args.browser:
    commands += [[sys.executable, '-X', 'utf8', str(ROOT / 'tests' / file)] for file in ['manual-browser.py', 'features-browser.py', 'onboarding-browser.py', 'inclusive-browser.py', 'class-records-browser.py','seating-constraints-browser.py']]
results = []
for command in commands:
    print('RUN', ' '.join(command), flush=True)
    result = subprocess.run(command, cwd=ROOT, encoding='utf-8', errors='replace', capture_output=True)
    print(result.stdout, end='')
    if result.stderr: print(result.stderr, end='', file=sys.stderr)
    results.append({'command': command, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
out = ROOT / 'test-results'
out.mkdir(exist_ok=True)
(out / 'regression.json').write_text(json.dumps({'date': datetime.now(timezone.utc).isoformat(), 'browserRequested': args.browser, 'results': results}, ensure_ascii=False, indent=2), encoding='utf-8')
sys.exit(0 if all(result['exitCode'] == 0 for result in results) else 1)

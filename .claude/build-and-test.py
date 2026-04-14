"""
Stop hook: after Claude finishes a response, run build then tests.
Exits 0 on success (silent). Exits 2 on failure to wake Claude via asyncRewake.
"""
import sys
import json
import subprocess
import os

bash = r'C:\Program Files\Git\usr\bin\bash.exe'
run_opts = dict(capture_output=True, encoding='utf-8', errors='replace')

npm_shim = '/c/Users/rpaiva/AppData/Local/mise/shims/npm'

def run_npm(script):
    return subprocess.run(
        [bash, '-c', f'cd "c:/Projects/mine/PlotWeave" && {npm_shim} run {script}'],
        **run_opts
    )

# Step 1: build
r1 = run_npm('build')
if r1.returncode != 0:
    output = ((r1.stdout or '') + (r1.stderr or ''))[-3000:]
    print(json.dumps({'systemMessage': 'Build FAILED:\n' + output}))
    sys.exit(2)

# Step 2: tests (only if build passed)
r2 = run_npm('test')
if r2.returncode != 0:
    output = ((r2.stdout or '') + (r2.stderr or ''))[-3000:]
    print(json.dumps({'systemMessage': 'Tests FAILED:\n' + output}))
    sys.exit(2)

sys.exit(0)

"""Replay the Python rules suite's transitions through the browser adapter using Node.
Randomness is fixed for both engines; state, messages, legal actions and privacy agree.
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tests'))
from cdg import engine
from cdg.games import paths_of_glory as g
from test_rules import RulesTests

original = engine.apply
cases = []

def capture(state, action):
    case = {'before': copy.deepcopy(state), 'action': copy.deepcopy(action)}
    try:
        updated, message = original(state, action)
    except ValueError:
        case['error'] = True
        cases.append(case)
        raise
    case.update(after=copy.deepcopy(updated), message=message, public=engine.view(updated))
    # Browser asset URLs are relative so /repo/ works on GitHub Pages.
    for side in case['public']['sides'].values():
        for slot in side['display'].values():
            if slot and slot['card']:
                slot['card']['image'] = slot['card']['image'].lstrip('/')
    cases.append(case)
    return updated, message

with patch.object(engine, 'apply', capture), patch.object(g, 'shuffled', lambda ids: list(ids)[1:] + list(ids)[:1]), patch.object(g.secrets, 'randbelow', lambda n: 0):
    result = unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(RulesTests))
if not result.wasSuccessful():
    raise SystemExit(1)

with tempfile.TemporaryDirectory() as temporary:
    fixtures = Path(temporary) / 'cases.json'
    fixtures.write_text(json.dumps(cases, ensure_ascii=False))
    subprocess.run([os.environ.get('NODE', 'node'), str(ROOT / 'scripts/check_static_rules.mjs'), str(fixtures)], check=True)

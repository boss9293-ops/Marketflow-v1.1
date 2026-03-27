import os
here = os.path.dirname(os.path.abspath('scripts/validate_cache.py'))
cand1 = os.path.realpath(os.path.join(here, '..'))
cand2 = os.path.realpath(os.path.join(here, '..', '..'))
if os.path.exists(os.path.join(cand1, 'data', 'marketflow.db')):
    ROOT = cand1
elif os.path.exists(os.path.join(cand2, 'data', 'marketflow.db')):
    ROOT = cand2
else:
    ROOT = 'None'
print('ROOT:', ROOT)
OUT = os.path.join(ROOT, 'backend', 'output')
print('OUT:', OUT)
full = os.path.join(OUT, 'cache', 'overview.json')
print('full:', full, os.path.exists(full))

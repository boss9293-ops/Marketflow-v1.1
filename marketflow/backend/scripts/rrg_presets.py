"""
MarketFlow RRG — Candidate F Presets
Kx/Ky are FIXED constants. Never derive from universe.
"""

PRESETS: dict = {
    'daily': {
        'N':  65,
        'M':  10,
        'Kx': 10,
        'Ky': 10,
    },
    'weekly': {
        'N':  52,
        'M':  5,
        'Kx': 10,
        'Ky': 10,
    },
}

EPSILON = 1e-4  # floor for rolling std; prevents float noise amplification in z-score chain

# Internal tail defaults — not exposed to users
TAIL_DEFAULTS = {
    'daily':  10,
    'weekly': 7,
}

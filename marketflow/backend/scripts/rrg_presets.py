"""
MarketFlow RRG — Final Engine Policy Presets
Engine routing is automatic and internal. Never expose to users.
"""

# Standard sector ETF universe — triggers Family D routing
STANDARD_SECTOR_ETFS: frozenset = frozenset({
    'XLK', 'XLV', 'XLF', 'XLE', 'XLY',
    'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC',
})

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

"""
Monte Carlo Simulation Engine
Based on: docs/MONTE_CARLO_SIMULATION_CONTRACT.md

Single run  : simulate(price_path, volume_path, ..., params)  → SimResult
Multi-run   : run_monte_carlo(paths, params)                   → dict of aggregated metrics
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import NamedTuple, Sequence

import numpy as np

from .state_machine import VRStateMachine, SMParams, State


# ---------------------------------------------------------------------------
# Strategy parameters
# ---------------------------------------------------------------------------

@dataclass
class SimParams:
    """
    Complete parameter set for one simulation configuration.

    Crash / bottom detection and state machine parameters are forwarded
    to SMParams.  All other fields control account-level behaviour.
    """

    # --- crash / bottom detection (forwarded to state machine) ---
    crash_speed_threshold:   float = -0.10
    crash_dd_threshold:      float = -0.15
    bottom_dd_threshold:     float = -0.20
    volume_spike_multiplier: float =  2.0

    # --- ladder ---
    ladder_levels:  list[float] = field(
        default_factory=lambda: [-0.20, -0.25, -0.30, -0.35, -0.40]
    )
    ladder_weights: list[float] = field(
        default_factory=lambda: [0.20, 0.20, 0.20, 0.20, 0.20]
    )

    # --- pool management ---
    crash_pool_cap: float = 0.50   # max fraction of pool deployable in one crash event
    reserve_ratio:  float = 0.10   # target pool/NAV ratio for S5 → S0 gate

    # --- normal-mode operations (simplified proxies for full VR rules) ---
    harvest_rate_per_day: float = 0.001   # fraction of position value taken as harvest per day
    vmin_buy_fraction:    float = 0.05    # fraction of cash_pool spent per Vmin buy
    vmin_threshold:       float = -0.03   # daily return ≤ this triggers a Vmin buy

    # --- state machine timing ---
    stabilization_days: int = 3
    rebuild_days:       int = 10

    def to_sm_params(self) -> SMParams:
        return SMParams(
            crash_speed_threshold   = self.crash_speed_threshold,
            crash_dd_threshold      = self.crash_dd_threshold,
            bottom_dd_threshold     = self.bottom_dd_threshold,
            volume_spike_multiplier = self.volume_spike_multiplier,
            stabilization_days      = self.stabilization_days,
            rebuild_days            = self.rebuild_days,
            reserve_ratio           = self.reserve_ratio,
        )


# ---------------------------------------------------------------------------
# Account
# ---------------------------------------------------------------------------

@dataclass
class Account:
    """
    Mutable financial state for one simulation run.

    Pool structure
    --------------
    cash_pool    — deployable reserve (Vmin buys, ladder buys, harvest target)
    reserve_pool — survival reserve; locked at crash onset; not spent on ladder
    Total pool   = cash_pool + reserve_pool
    """
    nav:             float
    cash_pool:       float
    reserve_pool:    float
    position_shares: float
    avg_cost:        float

    def pool_total(self) -> float:
        return self.cash_pool + self.reserve_pool

    def pool_ratio(self) -> float:
        return self.pool_total() / self.nav if self.nav > 0 else 0.0

    def position_value(self, price: float) -> float:
        return self.position_shares * price

    def update_nav(self, price: float) -> None:
        self.nav = self.position_value(price) + self.pool_total()

    def buy(self, spend: float, price: float) -> None:
        """Execute a buy: deduct from cash_pool, increase position."""
        shares = spend / price
        total_cost = self.avg_cost * self.position_shares + spend
        self.position_shares += shares
        self.avg_cost = total_cost / self.position_shares if self.position_shares > 0 else price
        self.cash_pool -= spend

    def harvest(self, value: float, price: float) -> None:
        """Sell a portion of position and return proceeds to cash_pool."""
        shares = value / price
        shares = min(shares, self.position_shares)
        self.position_shares -= shares
        self.cash_pool += shares * price


# ---------------------------------------------------------------------------
# Per-run result
# ---------------------------------------------------------------------------

class SimResult(NamedTuple):
    """
    Output of a single simulate() call.
    Matches the per-run summary record defined in MONTE_CARLO_SIMULATION_CONTRACT.md.
    """
    survived:             bool
    pool_exhausted:       bool
    reserve_breached:     bool
    max_dd_nav:           float          # most negative NAV drawdown seen (≤ 0)
    crash_events:         int
    ladder_steps_executed: int
    terminal_nav:         float          # final NAV normalised to starting NAV = 1.0

    # time-series (length T, normalised)
    nav_series:         np.ndarray       # daily NAV / initial_nav
    state_series:       np.ndarray       # daily State int
    pool_ratio_series:  np.ndarray       # daily pool_total / nav


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------

def simulate(
    price_path:       np.ndarray,
    volume_path:      np.ndarray,
    rolling_peak:     np.ndarray,
    drawdown_series:  np.ndarray,
    speed4_series:    np.ndarray,
    avgvol20_series:  np.ndarray,
    params:           SimParams,
    initial_nav:      float = 1.0,
    initial_pool_ratio: float = 0.10,
) -> SimResult:
    """
    Run the VR survival strategy on a single price/volume path.

    Pre-conditions
    --------------
    All six arrays must have the same length T.
    rolling_peak, drawdown_series, speed4_series, avgvol20_series are
    pre-computed by the caller (not derived inside this function).
    Evaluation of crash detection begins at day 4 (speed4 valid).
    Evaluation of bottom detection begins at day 20 (avgvol20 valid).

    Returns
    -------
    SimResult with per-day series and summary scalars.
    """
    T = len(price_path)
    p = params

    sm = VRStateMachine(p.to_sm_params())

    # --- initialise account ---
    initial_price   = price_path[0]
    pool_total_init = initial_nav * initial_pool_ratio
    position_value  = initial_nav - pool_total_init

    acct = Account(
        nav             = initial_nav,
        cash_pool       = pool_total_init * (1.0 - p.crash_pool_cap),   # leave room for reserve split
        reserve_pool    = pool_total_init * p.crash_pool_cap,            # pre-set; will be re-locked at crash
        position_shares = position_value / initial_price,
        avg_cost        = initial_price,
    )
    # Simplify: start with pool fully in cash_pool (reserve locking happens at crash onset)
    acct.cash_pool   = pool_total_init
    acct.reserve_pool = 0.0

    # --- crash event state ---
    crash_onset_pool:   float = 0.0    # pool total captured at S1 entry
    pool_locked_reserve: float = 0.0   # amount locked into reserve_pool at crash onset
    pool_used_crash:    float = 0.0    # cumulative spend on ladder in current crash event
    ladder_filled:      list[bool] = [False] * len(p.ladder_levels)

    # --- output buffers ---
    nav_series        = np.empty(T, dtype=np.float64)
    state_series      = np.empty(T, dtype=np.int8)
    pool_ratio_series = np.empty(T, dtype=np.float64)

    # --- run accumulators ---
    peak_nav              = initial_nav
    max_dd_nav            = 0.0
    crash_events          = 0
    ladder_steps_executed = 0
    pool_exhausted        = False
    reserve_breached      = False
    ladder_buy_today      = False     # passed to state machine on next step

    for t in range(T):
        price = price_path[t]
        acct.update_nav(price)

        # ----------------------------------------------------------------
        # Retrieve market data for this day
        # ----------------------------------------------------------------
        if t < 20:
            # Series not fully valid yet — step state machine in passive mode
            result = sm.step(
                t=t, speed4=0.0, dd=0.0, volume=0.0, avgvol20=1.0,
                ladder_buy_executed_today=False, pool_ratio=acct.pool_ratio()
            )
            nav_series[t]        = acct.nav / initial_nav
            state_series[t]      = int(result.new_state)
            pool_ratio_series[t] = acct.pool_ratio()
            ladder_buy_today     = False
            continue

        speed4   = float(speed4_series[t])
        dd       = float(drawdown_series[t])
        volume   = float(volume_path[t])
        avgvol20 = float(avgvol20_series[t])

        # ----------------------------------------------------------------
        # Determine actions based on current state (pre-step)
        # Actions execute BEFORE the state machine evaluates today's data,
        # so e.g. Vmin does not fire on the same day crash is detected.
        # ----------------------------------------------------------------
        actions      = sm.actions
        current_state = sm.state
        ladder_buy_today = False

        daily_return = (price / price_path[t - 1]) - 1.0 if t > 0 else 0.0

        # --- Vmin buy ---
        if actions.vmin_buy and daily_return <= p.vmin_threshold:
            spend = acct.cash_pool * p.vmin_buy_fraction
            if spend > 0 and acct.cash_pool >= spend:
                acct.buy(spend, price)

        # --- Ladder buy ---
        if actions.ladder_buy:
            for i, level in enumerate(p.ladder_levels):
                if ladder_filled[i]:
                    continue
                if dd <= level:
                    max_deployable = (crash_onset_pool * p.crash_pool_cap) - pool_used_crash
                    if max_deployable <= 0:
                        break
                    # allocate this step's weight against the crash pool cap
                    step_alloc = crash_onset_pool * p.crash_pool_cap * p.ladder_weights[i]
                    spend = min(step_alloc, max_deployable, acct.cash_pool)
                    if spend > 0:
                        acct.buy(spend, price)
                        pool_used_crash       += spend
                        ladder_filled[i]       = True
                        ladder_buy_today       = True
                        ladder_steps_executed += 1

        # --- Harvest (Vmax / time-based proxy) ---
        if actions.vmax_harvest or actions.time_harvest:
            harvest_value = acct.position_value(price) * p.harvest_rate_per_day
            if harvest_value > 0 and acct.position_shares > 0:
                acct.harvest(harvest_value, price)

        # ----------------------------------------------------------------
        # Step state machine with today's data
        # ----------------------------------------------------------------
        result = sm.step(
            t                         = t,
            speed4                    = speed4,
            dd                        = dd,
            volume                    = volume,
            avgvol20                  = avgvol20,
            ladder_buy_executed_today = ladder_buy_today,
            pool_ratio                = acct.pool_ratio(),
        )

        # ----------------------------------------------------------------
        # Handle state transition side effects
        # ----------------------------------------------------------------
        if result.transitioned and result.new_state == State.S1_CRASH_ALERT:
            # Crash onset: lock survival reserve
            crash_events      += 1
            crash_onset_pool   = acct.pool_total()
            deployable         = crash_onset_pool * p.crash_pool_cap
            locked             = crash_onset_pool - deployable          # remaining 50%
            # redistribute pool
            acct.reserve_pool  = locked
            acct.cash_pool     = acct.pool_total() - locked              # == deployable
            pool_locked_reserve = locked
            pool_used_crash     = 0.0
            ladder_filled       = [False] * len(p.ladder_levels)

        # ----------------------------------------------------------------
        # Update NAV, checks, metrics
        # ----------------------------------------------------------------
        acct.update_nav(price)

        if acct.nav <= 0:
            pool_exhausted = True
            # fill remainder of series with last known value
            nav_series[t:]        = acct.nav / initial_nav
            state_series[t:]      = int(result.new_state)
            pool_ratio_series[t:] = 0.0
            break

        if acct.pool_total() <= 0:
            pool_exhausted = True

        if pool_locked_reserve > 0 and acct.reserve_pool < pool_locked_reserve * 0.99:
            reserve_breached = True

        peak_nav   = max(peak_nav, acct.nav)
        nav_dd     = (acct.nav / peak_nav) - 1.0
        max_dd_nav = min(max_dd_nav, nav_dd)

        nav_series[t]        = acct.nav / initial_nav
        state_series[t]      = int(result.new_state)
        pool_ratio_series[t] = acct.pool_ratio()

    terminal_nav = acct.nav / initial_nav
    survived = (acct.nav > 0) and (not pool_exhausted) and (acct.pool_total() > 0)

    return SimResult(
        survived              = survived,
        pool_exhausted        = pool_exhausted,
        reserve_breached      = reserve_breached,
        max_dd_nav            = max_dd_nav,
        crash_events          = crash_events,
        ladder_steps_executed = ladder_steps_executed,
        terminal_nav          = terminal_nav,
        nav_series            = nav_series,
        state_series          = state_series,
        pool_ratio_series     = pool_ratio_series,
    )


# ---------------------------------------------------------------------------
# Monte Carlo runner
# ---------------------------------------------------------------------------

# Type alias for the 6-tuple a single path consists of
PathTuple = tuple[
    np.ndarray,   # price_path
    np.ndarray,   # volume_path
    np.ndarray,   # rolling_peak
    np.ndarray,   # drawdown_series
    np.ndarray,   # speed4_series
    np.ndarray,   # avgvol20_series
]


def run_monte_carlo(
    paths:              Sequence[PathTuple],
    params:             SimParams,
    initial_nav:        float = 1.0,
    initial_pool_ratio: float = 0.10,
) -> dict:
    """
    Run the simulation across N paths and return aggregated metrics.

    Each element of `paths` must be a 6-tuple:
        (price_path, volume_path, rolling_peak,
         drawdown_series, speed4_series, avgvol20_series)

    Returns
    -------
    dict with scalar summary metrics and raw distributions.
    Matches the Output Metrics section of MONTE_CARLO_SIMULATION_CONTRACT.md.
    """
    results: list[SimResult] = [
        simulate(
            *path,
            params             = params,
            initial_nav        = initial_nav,
            initial_pool_ratio = initial_pool_ratio,
        )
        for path in paths
    ]

    n = len(results)
    if n == 0:
        raise ValueError("paths is empty — nothing to simulate")

    # --- primary survival metrics ---
    survival_probability        = sum(r.survived         for r in results) / n
    pool_exhaustion_probability = sum(r.pool_exhausted   for r in results) / n
    reserve_breach_rate         = sum(r.reserve_breached for r in results) / n

    # --- recovery metrics ---
    bottom_capture_rate = sum(r.ladder_steps_executed > 0 for r in results) / n

    # --- distributions ---
    terminal_navs  = np.array([r.terminal_nav  for r in results])
    max_dd_navs    = np.array([r.max_dd_nav    for r in results])
    crash_counts   = np.array([r.crash_events  for r in results])
    ladder_counts  = np.array([r.ladder_steps_executed for r in results])

    # recovery time: days from peak NAV drawdown to full recovery, per run
    recovery_times = np.array([_recovery_time(r.nav_series) for r in results])

    # reentry success: fraction of runs where ladder positions reached breakeven
    # (terminal_nav > 1.0 as proxy, since we start normalised at 1.0)
    reentry_success_rate = float(np.mean(terminal_navs[np.array([r.ladder_steps_executed > 0 for r in results])] >= 1.0)) \
        if bottom_capture_rate > 0 else float("nan")

    return {
        # --- scalars ---
        "n_runs":                       n,
        "survival_probability":         survival_probability,
        "pool_exhaustion_probability":  pool_exhaustion_probability,
        "reserve_breach_rate":          reserve_breach_rate,
        "bottom_capture_rate":          bottom_capture_rate,
        "reentry_success_rate":         reentry_success_rate,

        # --- terminal NAV stats ---
        "terminal_nav_median": float(np.median(terminal_navs)),
        "terminal_nav_mean":   float(np.mean(terminal_navs)),
        "terminal_nav_p10":    float(np.percentile(terminal_navs, 10)),
        "terminal_nav_p25":    float(np.percentile(terminal_navs, 25)),
        "terminal_nav_p75":    float(np.percentile(terminal_navs, 75)),
        "terminal_nav_p90":    float(np.percentile(terminal_navs, 90)),

        # --- drawdown stats ---
        "max_dd_median": float(np.median(max_dd_navs)),
        "max_dd_p90":    float(np.percentile(max_dd_navs, 10)),   # 10th pct = worst 10%
        "max_dd_mean":   float(np.mean(max_dd_navs)),

        # --- recovery time stats (days) ---
        "recovery_time_median": float(np.median(recovery_times[recovery_times >= 0])) if np.any(recovery_times >= 0) else float("nan"),
        "recovery_time_p90":    float(np.percentile(recovery_times[recovery_times >= 0], 90)) if np.any(recovery_times >= 0) else float("nan"),

        # --- crash / ladder stats ---
        "avg_crash_events_per_run":         float(np.mean(crash_counts)),
        "avg_ladder_steps_per_run":         float(np.mean(ladder_counts)),

        # --- raw distributions (for plotting) ---
        "terminal_nav_distribution":    terminal_navs,
        "drawdown_distribution":        max_dd_navs,
        "recovery_time_distribution":   recovery_times,

        # --- per-run records ---
        "runs": results,
    }


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _recovery_time(nav_series: np.ndarray) -> int:
    """
    Return the number of days between the index of maximum NAV drawdown
    and the first day the NAV exceeds its pre-crash peak.

    Returns -1 if NAV never recovers within the path.
    """
    if len(nav_series) == 0:
        return -1

    peak      = 0.0
    trough_idx = 0
    peak_before_trough = nav_series[0]

    # find the trough index (max drawdown point)
    running_peak = nav_series[0]
    worst_dd     = 0.0
    for i, v in enumerate(nav_series):
        if v > running_peak:
            running_peak = v
        dd = (v / running_peak) - 1.0 if running_peak > 0 else 0.0
        if dd < worst_dd:
            worst_dd          = dd
            trough_idx        = i
            peak_before_trough = running_peak

    # find first day after trough where nav >= peak_before_trough
    for i in range(trough_idx, len(nav_series)):
        if nav_series[i] >= peak_before_trough:
            return i - trough_idx

    return -1   # did not recover

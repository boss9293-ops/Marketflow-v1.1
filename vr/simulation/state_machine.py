"""
VR Strategy State Machine
Based on: docs/VR_STRATEGY_STATE_MACHINE_V1.md

Six states: S0_NORMAL → S1_CRASH_ALERT → S2_CRASH_HOLD → S3_BOTTOM_ZONE
                                                               ↓
                                              S5_REBUILD ← S4_RECOVERY
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import NamedTuple


# ---------------------------------------------------------------------------
# States
# ---------------------------------------------------------------------------

class State(IntEnum):
    S0_NORMAL      = 0
    S1_CRASH_ALERT = 1
    S2_CRASH_HOLD  = 2
    S3_BOTTOM_ZONE = 3
    S4_RECOVERY    = 4
    S5_REBUILD     = 5


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

@dataclass
class SMParams:
    """Tunable thresholds that govern state transitions.

    All fraction values are signed ratios (e.g. -0.10 means -10%).
    """
    # --- crash detector ---
    crash_speed_threshold: float = -0.10   # Speed4 ≤ this
    crash_dd_threshold:    float = -0.15   # DD    ≤ this  (both required)

    # --- bottom detector ---
    bottom_dd_threshold:       float = -0.20   # DD ≤ this (crash active + volume spike)
    volume_spike_multiplier:   float =  2.0    # Volume ≥ this × AvgVolume20

    # --- S3 → S4: stabilization ---
    stabilization_days: int = 3     # consecutive days of Speed4 > 0 after first ladder buy

    # --- S5 → S0: rebuild gate ---
    rebuild_days:  int   = 10       # consecutive normal-regime days required
    reserve_ratio: float = 0.10     # pool/NAV ratio must reach this before exiting S5


# ---------------------------------------------------------------------------
# Action flags
# ---------------------------------------------------------------------------

class ActionFlags(NamedTuple):
    """Which actions are permitted in the current state.

    Matches the Actions Reference Table in VR_STRATEGY_STATE_MACHINE_V1.md.
    """
    vmin_buy:        bool   # buy on dip in normal mode
    vmax_harvest:    bool   # take profit at upper price extreme
    time_harvest:    bool   # periodic profit-taking
    pool_accumulate: bool   # harvest proceeds flow into pool
    ladder_buy:      bool   # crash ladder deployment


# Pre-computed flags per state  (order matches ActionFlags fields)
_ACTIONS: dict[State, ActionFlags] = {
    #                            vmin   vmax   time   pool   ladder
    State.S0_NORMAL:      ActionFlags(True,  True,  True,  True,  False),
    State.S1_CRASH_ALERT: ActionFlags(False, True,  True,  False, False),
    State.S2_CRASH_HOLD:  ActionFlags(False, True,  False, False, False),
    State.S3_BOTTOM_ZONE: ActionFlags(False, True,  False, False, True),
    State.S4_RECOVERY:    ActionFlags(False, True,  True,  False, False),
    State.S5_REBUILD:     ActionFlags(False, True,  True,  True,  False),
    # vmin in S5 is ◑ (research parameter); defaulted to False here.
    # Override by passing a custom _ACTIONS dict to VRStateMachine if needed.
}


# ---------------------------------------------------------------------------
# Internal context
# ---------------------------------------------------------------------------

@dataclass
class SMContext:
    """Mutable internal counters and flags carried between steps."""
    state:                  State      = State.S0_NORMAL

    # crash event tracking
    crash_onset_day:        int | None = None
    ladder_buy_executed:    bool       = False   # ≥1 ladder step done in current crash

    # S3 stabilization counter
    stabilization_counter:  int        = 0       # consecutive days of Speed4 > 0

    # S5 rebuild counter
    rebuild_counter:        int        = 0       # consecutive normal-regime days

    # diagnostics
    days_in_state:          int        = 0


# ---------------------------------------------------------------------------
# Step result
# ---------------------------------------------------------------------------

class StepResult(NamedTuple):
    prev_state:  State
    new_state:   State
    crash_flag:  bool
    bottom_flag: bool
    transitioned: bool
    actions:     ActionFlags


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

class VRStateMachine:
    """
    Deterministic finite state machine for the VR leveraged ETF survival strategy.

    Usage
    -----
    sm = VRStateMachine()

    for t in range(T):
        result = sm.step(
            t         = t,
            speed4    = speed4_series[t],
            dd        = drawdown_series[t],
            volume    = volume_path[t],
            avgvol20  = avgvol20_series[t],
            ladder_buy_executed_today = ladder_executed,
            pool_ratio = acct.pool_ratio(),
        )
        # act on result.actions, result.new_state, result.transitioned
    """

    def __init__(self, params: SMParams | None = None) -> None:
        self.params = params or SMParams()
        self.ctx    = SMContext()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def step(
        self,
        t: int,
        speed4:    float,
        dd:        float,
        volume:    float,
        avgvol20:  float,
        ladder_buy_executed_today: bool,
        pool_ratio: float,
    ) -> StepResult:
        """
        Evaluate one trading day.

        Parameters
        ----------
        t                         : day index (0-based)
        speed4                    : 4-day cumulative return  (e.g. -0.12)
        dd                        : drawdown from rolling peak  (e.g. -0.18, always ≤ 0)
        volume                    : today's trading volume
        avgvol20                  : 20-day trailing average volume
        ladder_buy_executed_today : True if simulation executed a ladder step today
        pool_ratio                : current (cash_pool + reserve_pool) / nav
        """
        p   = self.params
        ctx = self.ctx

        prev_state = ctx.state

        # --- compute observable condition flags ---
        crash_flag = (speed4 <= p.crash_speed_threshold) and (dd <= p.crash_dd_threshold)

        bottom_flag = (
            ctx.state in (State.S2_CRASH_HOLD, State.S3_BOTTOM_ZONE)
            and dd <= p.bottom_dd_threshold
            and avgvol20 > 0
            and volume >= p.volume_spike_multiplier * avgvol20
        )

        # --- record ladder execution before transition ---
        if ladder_buy_executed_today:
            ctx.ladder_buy_executed = True

        # --- state transition ---
        self._transition(t, crash_flag, bottom_flag, pool_ratio, speed4)

        # --- update diagnostics ---
        if ctx.state != prev_state:
            ctx.days_in_state = 0
        else:
            ctx.days_in_state += 1

        return StepResult(
            prev_state   = prev_state,
            new_state    = ctx.state,
            crash_flag   = crash_flag,
            bottom_flag  = bottom_flag,
            transitioned = (ctx.state != prev_state),
            actions      = _ACTIONS[ctx.state],
        )

    def reset(self) -> None:
        """Reset to initial state. Must be called between independent simulation runs."""
        self.ctx = SMContext()

    @property
    def state(self) -> State:
        return self.ctx.state

    @property
    def actions(self) -> ActionFlags:
        return _ACTIONS[self.ctx.state]

    # ------------------------------------------------------------------
    # Internal transition logic
    # ------------------------------------------------------------------

    def _transition(
        self,
        t: int,
        crash_flag:  bool,
        bottom_flag: bool,
        pool_ratio:  float,
        speed4:      float,
    ) -> None:
        p   = self.params
        ctx = self.ctx

        if ctx.state == State.S0_NORMAL:
            if crash_flag:
                self._enter_crash(t)

        elif ctx.state == State.S1_CRASH_ALERT:
            if crash_flag:
                # crash persisted one more cycle → confirmed
                ctx.state = State.S2_CRASH_HOLD
            else:
                # false alarm — conditions cleared before confirmation
                ctx.state           = State.S0_NORMAL
                ctx.crash_onset_day = None

        elif ctx.state == State.S2_CRASH_HOLD:
            if bottom_flag:
                ctx.state = State.S3_BOTTOM_ZONE

        elif ctx.state == State.S3_BOTTOM_ZONE:
            # Stabilization: Speed4 > 0 for N consecutive days
            # AND at least one ladder buy must have been executed first
            if ctx.ladder_buy_executed:
                if speed4 > 0:
                    ctx.stabilization_counter += 1
                else:
                    ctx.stabilization_counter = 0

                if ctx.stabilization_counter >= p.stabilization_days:
                    ctx.state                 = State.S4_RECOVERY
                    ctx.stabilization_counter = 0

        elif ctx.state == State.S4_RECOVERY:
            if crash_flag:
                # secondary crash leg — return to hold, do NOT re-enter bottom zone directly
                ctx.state                 = State.S2_CRASH_HOLD
                ctx.ladder_buy_executed   = False
                ctx.stabilization_counter = 0
            else:
                # crash conditions have cleared
                ctx.state           = State.S5_REBUILD
                ctx.rebuild_counter = 0

        elif ctx.state == State.S5_REBUILD:
            if crash_flag:
                # new crash event begins
                self._enter_crash(t)
            else:
                ctx.rebuild_counter += 1
                pool_ready = pool_ratio >= p.reserve_ratio
                if ctx.rebuild_counter >= p.rebuild_days and pool_ready:
                    ctx.state           = State.S0_NORMAL
                    ctx.rebuild_counter = 0

    def _enter_crash(self, t: int) -> None:
        """Common setup when a new crash event begins (S0 or S5 → S1)."""
        ctx               = self.ctx
        ctx.state         = State.S1_CRASH_ALERT
        ctx.crash_onset_day       = t
        ctx.ladder_buy_executed   = False
        ctx.stabilization_counter = 0
        ctx.rebuild_counter       = 0

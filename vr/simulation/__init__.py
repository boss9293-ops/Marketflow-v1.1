"""
VR Survival Simulation Engine
Based on docs/VR_STRATEGY_STATE_MACHINE_V1.md
       docs/MONTE_CARLO_SIMULATION_CONTRACT.md
"""
from .state_machine import VRStateMachine, SMParams, SMContext, State, ActionFlags, StepResult
from .simulate import SimParams, SimResult, Account, simulate, run_monte_carlo

__all__ = [
    "VRStateMachine", "SMParams", "SMContext", "State", "ActionFlags", "StepResult",
    "SimParams", "SimResult", "Account", "simulate", "run_monte_carlo",
]

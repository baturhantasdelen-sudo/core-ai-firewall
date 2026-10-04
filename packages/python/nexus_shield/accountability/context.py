"""Thread-local accountability runtime context."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nexus_shield.core.aar import AAREngine, AARSigningKeyPair
from nexus_shield.core.blast_radius import BlastRadiusSimulator
from nexus_shield.core.delegation import DelegationGraph
from nexus_shield.core.passport import AgentPassportRecord
from nexus_shield.core.circuit_breaker import AgentCircuitBreaker, CircuitBreakerState
from nexus_shield.core.outcome_verifier import OutcomeVerifier
from nexus_shield.core.verification import LedgerConnector, OutcomeVerificationEngine, ResourceStateConnector

from .store import AARStore


@dataclass
class AccountabilityContext:
    store: AARStore = field(default_factory=AARStore)
    signing_key: AARSigningKeyPair = field(default_factory=AARSigningKeyPair.generate)
    aar_engine: AAREngine | None = None
    passports: dict[str, AgentPassportRecord] = field(default_factory=dict)
    delegation_graph: DelegationGraph | None = None
    blast_radius_simulator: BlastRadiusSimulator | None = None
    db_connector: ResourceStateConnector | None = None
    ledger_connector: LedgerConnector | None = None
    verification_engine: OutcomeVerificationEngine | None = None
    policy_id: str = "FIN-PAY-07"
    circuit_breaker: AgentCircuitBreaker | None = None

    def __post_init__(self) -> None:
        if self.aar_engine is None:
            self.aar_engine = AAREngine(self.signing_key)
        if self.circuit_breaker is None:
            self.circuit_breaker = AgentCircuitBreaker(CircuitBreakerState())
        if self.db_connector is not None and self.ledger_connector is not None:
            if self.verification_engine is None:
                self.verification_engine = OutcomeVerifier(
                    self.db_connector,
                    self.ledger_connector,
                )

    def register_passport(self, passport: AgentPassportRecord) -> None:
        sealed = passport.seal(self.signing_key)
        self.passports[sealed.passport_id] = sealed

    def get_passport(self, passport_id: str) -> AgentPassportRecord | None:
        return self.passports.get(passport_id)


_global_context: AccountabilityContext | None = None


def set_accountability_context(ctx: AccountabilityContext) -> None:
    global _global_context
    _global_context = ctx


def get_accountability_context() -> AccountabilityContext:
    global _global_context
    if _global_context is None:
        _global_context = AccountabilityContext()
    return _global_context

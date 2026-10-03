"""FastAPI factory for accountability stack (production mount + pytest)."""

from __future__ import annotations

from fastapi import FastAPI

from nexus_shield.accountability.context import AccountabilityContext, set_accountability_context
from nexus_shield.accountability.routes import create_accountability_router
from nexus_shield.middleware.gateway import AccountabilityGatewayMiddleware


def create_accountability_app(ctx: AccountabilityContext | None = None) -> FastAPI:
    if ctx is not None:
        set_accountability_context(ctx)
    app = FastAPI(title="Nexus Shield Accountability API", version="2.0.0")
    app.add_middleware(AccountabilityGatewayMiddleware, path_prefix="/v1/accountability", post_verify=False)
    app.include_router(create_accountability_router())
    return app

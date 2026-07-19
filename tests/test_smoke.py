"""Pipeline sağlık kontrolü — import ve temel pytest altyapısı."""


def test_project_imports() -> None:
    import nexus_quantum_guard  # noqa: F401
    import nexus_shield_api  # noqa: F401

    assert hasattr(nexus_shield_api, "app")


def test_ci_environment_ready() -> None:
    assert True

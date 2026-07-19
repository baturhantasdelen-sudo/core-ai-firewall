function Get-AuthCheckScript {
    param([string]$KeyBody)
    $lines = @(
        "set -euo pipefail",
        "AUTH=`"`$HOME/.ssh/authorized_keys`"",
        "if [ ! -f `"`$AUTH`" ]; then",
        "  echo `"AUTH_FILE_MISSING`"",
        "  exit 31",
        "fi",
        "echo `"--- authorized_keys fingerprints ---`"",
        "ssh-keygen -lf `"`$AUTH`" 2>/dev/null || true",
        "echo `"--- grep deploy key ---`"",
        "if grep -Fq `"$KeyBody`" `"`$AUTH`"; then",
        "  echo `"AUTH_KEY_FOUND`"",
        "else",
        "  echo `"AUTH_KEY_NOT_FOUND`"",
        "fi"
    )
    return ($lines -join "`n")
}

function Get-DockerCheckScript {
    param([string]$DeployDir)
    $lines = @(
        "set -euo pipefail",
        "",
        "echo `"--- docker version ---`"",
        "docker --version",
        "",
        "echo `"--- docker compose version ---`"",
        "if docker compose version >/dev/null 2>&1; then",
        "  docker compose version",
        "  COMPOSE_OK=1",
        "elif command -v docker-compose >/dev/null 2>&1; then",
        "  docker-compose --version",
        "  COMPOSE_OK=1",
        "else",
        "  echo `"COMPOSE_MISSING`"",
        "  exit 21",
        "fi",
        "",
        "echo `"--- docker daemon ---`"",
        "if docker info >/dev/null 2>&1; then",
        "  echo `"DOCKER_DAEMON_OK`"",
        "else",
        "  echo `"DOCKER_DAEMON_FAIL`"",
        "  exit 22",
        "fi",
        "",
        "echo `"--- deploy directory ---`"",
        "if [ -d `"$DeployDir`" ]; then",
        "  echo `"DEPLOY_DIR_OK $DeployDir`"",
        "  ls -la `"$DeployDir`" | head -5",
        "else",
        "  echo `"DEPLOY_DIR_MISSING $DeployDir`"",
        "fi"
    )
    return ($lines -join "`n")
}

function Get-AuthCheckScript {
    param([string]$KeyComment = "nexus-github-actions-deploy")
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
        "if grep -Fq `"__KEY_COMMENT__`" `"`$AUTH`"; then",
        "  echo `"AUTH_KEY_FOUND`"",
        "else",
        "  echo `"AUTH_KEY_NOT_FOUND`"",
        "fi"
    )
    return (($lines -join "`n") -replace "__KEY_COMMENT__", $KeyComment)
}

function Get-DockerCheckScript {
    param([string]$DeployDir)
    $lines = @(
        "set -euo pipefail",
        "",
        "echo `"--- docker version ---`"",
        "if command -v docker >/dev/null 2>&1; then docker --version; else echo `"DOCKER_CLI_MISSING`"; fi",
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
        "if [ -d `"__DEPLOY_PATH__`" ]; then",
        "  echo `"DEPLOY_DIR_OK __DEPLOY_PATH__`"",
        "  ls -la `"__DEPLOY_PATH__`" | head -5",
        "else",
        "  echo `"DEPLOY_DIR_MISSING __DEPLOY_PATH__`"",
        "fi",
        "",
        "echo `"--- prod containers ---`"",
        "docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -E 'nexus-api|nginx-gateway|cloudflared' || echo `"PROD_CONTAINERS_NONE`""
    )
    return (($lines -join "`n") -replace "__DEPLOY_PATH__", $DeployDir)
}

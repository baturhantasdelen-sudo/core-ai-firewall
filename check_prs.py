import json
import urllib.error
import urllib.request

# Kontrol edilecek PR listesi (upstream repo + PR numarası)
# Not: LiteLLM docs PR upstream repo BerriAI/litellm-docs; LangChain docs repo langchain-ai/docs
prs = [
    {"repo": "BerriAI/litellm-docs", "pr": "YOUR_LITELLM_DOCS_PR_NUMBER"},
    {"repo": "langchain-ai/docs", "pr": "YOUR_LANGCHAIN_DOCS_PR_NUMBER"},
    {"repo": "Portkey-AI/docs-core", "pr": "YOUR_PORTKEY_DOCS_PR_NUMBER"},
    {"repo": "Helicone/helicone", "pr": "YOUR_HELICONE_PR_NUMBER"},
    {"repo": "vercel/ai", "pr": "YOUR_VERCEL_AI_PR_NUMBER"},
]

# Fork branch'lerinden PR numarası keşfi (opsiyonel)
FORK_HEADS = [
    ("BerriAI/litellm-docs", "baturhantasdelen-sudo:feat/add-nexus-shield-provider"),
    ("langchain-ai/docs", "baturhantasdelen-sudo:feat/add-nexus-shield-provider"),
    ("Portkey-AI/docs-core", "baturhantasdelen-sudo:feat/add-nexus-shield-integration"),
    ("Helicone/helicone", "baturhantasdelen-sudo:feat/add-nexus-shield-integration"),
    ("vercel/ai", "baturhantasdelen-sudo:feat/add-nexus-shield-guide"),
]


def discover_pr_number(repo: str, head: str) -> int | None:
    url = f"https://api.github.com/repos/{repo}/pulls?state=all&head={head}&per_page=5"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/vnd.github+json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode())
            if data:
                return int(data[0]["number"])
    except Exception:
        return None
    return None


def check_pr_status(repo: str, pr_num: str | int) -> None:
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_num}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/vnd.github+json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode())
            title = data.get("title", "")
            state = data.get("state", "")
            mergeable = data.get("mergeable_state", "unknown")
            comments = data.get("comments", 0)
            review_comments = data.get("review_comments", 0)

            print(f"=== {repo} (PR #{pr_num}) ===")
            print(f"  Title: {title}")
            print(f"  State: {state.upper()}")
            print(f"  Mergeable State: {mergeable}")
            print(f"  Comments: {comments} | Review Comments: {review_comments}")
            print("-" * 50)
    except urllib.error.HTTPError as exc:
        print(f"Error checking {repo} #{pr_num}: HTTP {exc.code} {exc.reason}")
    except Exception as exc:
        print(f"Error checking {repo} #{pr_num}: {exc}")


if __name__ == "__main__":
    print("PR Durumlari Kontrol Ediliyor...\n")

    # Placeholder PR numaralarini fork branch'lerinden otomatik doldur
    discovered: dict[str, int] = {}
    for repo, head in FORK_HEADS:
        num = discover_pr_number(repo, head)
        if num is not None:
            discovered[repo] = num

    for pr_info in prs:
        repo = pr_info["repo"]
        pr_val = pr_info["pr"]
        if isinstance(pr_val, str) and pr_val.startswith("YOUR_"):
            pr_num = discovered.get(repo)
            if pr_num is None:
                print(f"=== {repo} ===")
                print("  PR bulunamadi (henuz acilmamis veya numara guncellenmeli)")
                print("-" * 50)
                continue
        else:
            pr_num = pr_val
        check_pr_status(repo, pr_num)

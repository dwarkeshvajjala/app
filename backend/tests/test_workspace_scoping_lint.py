import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "check_workspace_scoping.py"


def test_workspace_scoping_lint_passes() -> None:
    """06-Backend-Architecture.md §6.4: every repository query must be workspace-scoped,
    or carry a reviewed `# workspace-scope-exempt: <reason>` comment explaining why not.
    A regression here means either a genuine tenant-isolation gap was introduced, or a
    legitimate new exemption is missing its explanation - both should fail CI."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr

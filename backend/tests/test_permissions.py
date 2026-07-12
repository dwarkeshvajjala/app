from app.core.permissions import PERMISSIONS, Role, role_allows


def test_owner_can_do_everything_admin_can() -> None:
    for action, roles in PERMISSIONS.items():
        if Role.ADMIN in roles:
            assert Role.OWNER in roles, f"owner should be allowed wherever admin is: {action}"


def test_guest_cannot_manage_workspace_or_members() -> None:
    assert not role_allows("workspace:manage_billing", Role.GUEST)
    assert not role_allows("member:invite", Role.GUEST)
    assert not role_allows("member:remove", Role.GUEST)
    assert not role_allows("integration:manage", Role.GUEST)


def test_guest_can_create_and_reply_to_client_comments() -> None:
    assert role_allows("comment:create", Role.GUEST)
    assert role_allows("comment:reply", Role.GUEST)
    assert role_allows("comment:view_client", Role.GUEST)


def test_guest_can_never_see_team_layer() -> None:
    # 13-Authentication.md §13.5: "View team-only comments: Guest -> No (never, server-enforced)".
    assert not role_allows("comment:view_team", Role.GUEST)
    assert not role_allows("comment:toggle_layer", Role.GUEST)


def test_only_owner_can_manage_billing() -> None:
    assert PERMISSIONS["workspace:manage_billing"] == frozenset({Role.OWNER})


def test_member_can_manage_projects_and_share_links_but_not_members() -> None:
    assert role_allows("project:manage", Role.MEMBER)
    assert role_allows("share_link:manage", Role.MEMBER)
    assert not role_allows("member:invite", Role.MEMBER)
    assert not role_allows("member:remove", Role.MEMBER)

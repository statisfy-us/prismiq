"""Permission checking functions for dashboards and widgets."""

from __future__ import annotations

from prismiq.dashboards import Dashboard


def can_view_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if a user can view a dashboard.

    A user can view a dashboard if:
    1. The dashboard is public (is_public=True)
    2. The user is the owner (owner_id matches)
    3. The user is in allowed_viewers list

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to view (None for anonymous)

    Returns:
        True if the user can view the dashboard
    """
    # Public dashboards are viewable by anyone
    if dashboard.is_public:
        return True

    # Anonymous users can only view public dashboards
    if user_id is None:
        return False

    # Owner can always view
    if dashboard.owner_id == user_id:
        return True

    # Check allowed viewers list
    return user_id in dashboard.allowed_viewers


def can_edit_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if a user can edit a dashboard.

    Only the owner can edit a dashboard.

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to edit (None for anonymous)

    Returns:
        True if the user can edit the dashboard
    """
    if user_id is None:
        return False

    return dashboard.owner_id == user_id


def can_delete_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if a user can delete a dashboard.

    Only the owner can delete a dashboard.

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to delete (None for anonymous)

    Returns:
        True if the user can delete the dashboard
    """
    if user_id is None:
        return False

    return dashboard.owner_id == user_id


def can_edit_widget(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if a user can edit widgets in a dashboard.

    Requires dashboard edit permission.

    Args:
        dashboard: The parent dashboard
        user_id: The user attempting to edit

    Returns:
        True if the user can edit widgets
    """
    return can_edit_dashboard(dashboard, user_id)

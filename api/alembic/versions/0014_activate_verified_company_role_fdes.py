"""activate verified company role fdes

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-10
"""
import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    verified_users = bind.execute(
        sa.text("SELECT id FROM users WHERE is_verified_fde IS TRUE")
    ).fetchall()

    for (user_id,) in verified_users:
        active_member = bind.execute(
            sa.text(
                "SELECT id FROM company_members "
                "WHERE user_id = :user_id AND fde_status = 'active' LIMIT 1"
            ),
            {"user_id": user_id},
        ).fetchone()
        if active_member is not None:
            continue

        role_members = bind.execute(
            sa.text(
                "SELECT id FROM company_members "
                "WHERE user_id = :user_id AND company_role IN ('owner', 'admin')"
            ),
            {"user_id": user_id},
        ).fetchall()
        if len(role_members) != 1:
            continue

        bind.execute(
            sa.text(
                "UPDATE company_members "
                "SET fde_status = 'active', fde_joined_at = CURRENT_TIMESTAMP, fde_exited_at = NULL "
                "WHERE id = :member_id AND fde_status = 'none'"
            ),
            {"member_id": role_members[0][0]},
        )


def downgrade() -> None:
    pass

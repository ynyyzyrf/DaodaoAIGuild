"""add admin tables: admin_audit_logs / sensitive_words / content_reports
+ users.is_verified_fde + tutorials.status default=pending

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-23

V3.2 管理后台（docs/3.2.md §8）：
- admin_audit_logs：所有后台写操作留痕，仅追加不可删
- sensitive_words：敏感词库 + 命中策略（warn / auto_hide）
- content_reports：用户举报记录，同一用户对同一内容唯一
- users.is_verified_fde：官方认证 FDE 标记
- tutorials.status 默认改为 pending（教程预审）
"""
import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users 扩充 ---
    op.add_column(
        "users",
        sa.Column("is_verified_fde", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # --- tutorials.status 默认改 pending（教程预审：新教程默认不可见，待管理员通过） ---
    op.alter_column(
        "tutorials",
        "status",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text("'pending'"),
    )

    # --- admin_audit_logs ---
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("before_value", sa.JSON(), nullable=True),
        sa.Column("after_value", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_audit_logs_admin_id", "admin_audit_logs", ["admin_id"])
    op.create_index("ix_admin_audit_logs_target", "admin_audit_logs", ["target_type", "target_id"])
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"])

    # --- sensitive_words ---
    op.create_table(
        "sensitive_words",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("word", sa.String(64), nullable=False),
        sa.Column("category", sa.String(32), nullable=True),
        sa.Column(
            "action",
            sa.Enum("warn", "auto_hide", name="sensitiveword_action"),
            nullable=False,
            server_default=sa.text("'warn'"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("word", name="uq_sensitive_word"),
    )

    # --- content_reports ---
    op.create_table(
        "content_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "handled", "dismissed", name="contentreport_status"),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("handled_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("handled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("reporter_id", "target_type", "target_id", name="uk_unique_report"),
    )
    op.create_index("ix_content_reports_status", "content_reports", ["status"])
    op.create_index("ix_content_reports_target", "content_reports", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_index("ix_content_reports_target", table_name="content_reports")
    op.drop_index("ix_content_reports_status", table_name="content_reports")
    op.drop_table("content_reports")
    op.execute("DROP TYPE IF EXISTS contentreport_status")

    op.drop_table("sensitive_words")
    op.execute("DROP TYPE IF EXISTS sensitiveword_action")

    op.drop_index("ix_admin_audit_logs_created_at", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_target", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_admin_id", table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")

    op.alter_column(
        "tutorials",
        "status",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text("'published'"),
    )
    op.drop_column("users", "is_verified_fde")

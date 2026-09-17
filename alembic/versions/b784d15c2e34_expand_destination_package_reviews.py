"""Expand destination package and review data

Revision ID: b784d15c2e34
Revises: 0ad82e3efb48
Create Date: 2026-09-13 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b784d15c2e34"
down_revision: Union[str, Sequence[str], None] = "0ad82e3efb48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _has_fk(inspector, table_name: str, fk_name: str) -> bool:
    return fk_name in {fk["name"] for fk in inspector.get_foreign_keys(table_name)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    for column in (
        sa.Column("attractions", sa.JSON(), nullable=True),
        sa.Column("activities", sa.JSON(), nullable=True),
        sa.Column("travel_tips", sa.JSON(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
    ):
        if not _has_column(inspector, "destinations", column.name):
            op.add_column("destinations", column)

    for column in (
        sa.Column("hotels", sa.JSON(), nullable=True),
        sa.Column("activities", sa.JSON(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("inclusions", sa.JSON(), nullable=True),
        sa.Column("exclusions", sa.JSON(), nullable=True),
        sa.Column("availability", sa.JSON(), nullable=True),
    ):
        if not _has_column(inspector, "travel_packages", column.name):
            op.add_column("travel_packages", column)

    if not _has_column(inspector, "reviews", "destination_id"):
        op.add_column("reviews", sa.Column("destination_id", sa.BigInteger(), nullable=True))
    inspector = sa.inspect(op.get_bind())

    if not _has_index(inspector, "reviews", "ix_reviews_destination_id"):
        op.create_index(op.f("ix_reviews_destination_id"), "reviews", ["destination_id"], unique=False)
    if not _has_fk(inspector, "reviews", "fk_reviews_destination_id_destinations"):
        op.create_foreign_key(
            "fk_reviews_destination_id_destinations",
            "reviews",
            "destinations",
            ["destination_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.alter_column("reviews", "planner_id", existing_type=sa.BigInteger(), nullable=True)


def downgrade() -> None:
    op.alter_column("reviews", "planner_id", existing_type=sa.BigInteger(), nullable=False)
    op.drop_constraint("fk_reviews_destination_id_destinations", "reviews", type_="foreignkey")
    op.drop_index(op.f("ix_reviews_destination_id"), table_name="reviews")
    op.drop_column("reviews", "destination_id")

    op.drop_column("travel_packages", "availability")
    op.drop_column("travel_packages", "exclusions")
    op.drop_column("travel_packages", "inclusions")
    op.drop_column("travel_packages", "images")
    op.drop_column("travel_packages", "activities")
    op.drop_column("travel_packages", "hotels")

    op.drop_column("destinations", "images")
    op.drop_column("destinations", "travel_tips")
    op.drop_column("destinations", "activities")
    op.drop_column("destinations", "attractions")

"""add visibility collaborators follows digest

Revision ID: d1873c708280
Revises: 0026c005dbd6
Create Date: 2026-04-18 01:43:20.302087

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1873c708280'
down_revision: Union[str, Sequence[str], None] = '0026c005dbd6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add visibility and share_token to collections
    with op.batch_alter_table('collections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('visibility', sa.String(length=20), server_default='private', nullable=False))
        batch_op.add_column(sa.Column('share_token', sa.String(length=64), nullable=True))
        batch_op.create_index(batch_op.f('ix_collections_share_token'), ['share_token'], unique=True)

    # Create collection_collaborators table
    op.create_table('collection_collaborators',
        sa.Column('collection_id', sa.CHAR(length=36), nullable=False),
        sa.Column('user_id', sa.CHAR(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='editor', nullable=False),
        sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('collection_id', 'user_id')
    )

    # Create follows table
    op.create_table('follows',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('follower_id', sa.CHAR(length=36), nullable=False),
        sa.Column('following_user_id', sa.CHAR(length=36), nullable=True),
        sa.Column('following_collection_id', sa.CHAR(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['following_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['following_collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_follows_follower_id'), 'follows', ['follower_id'], unique=False)
    op.create_index(op.f('ix_follows_following_user_id'), 'follows', ['following_user_id'], unique=False)
    op.create_index(op.f('ix_follows_following_collection_id'), 'follows', ['following_collection_id'], unique=False)

    # Create digest_items table
    op.create_table('digest_items',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('user_id', sa.CHAR(length=36), nullable=False),
        sa.Column('source_user_id', sa.CHAR(length=36), nullable=True),
        sa.Column('source_collection_id', sa.CHAR(length=36), nullable=True),
        sa.Column('bookmark_id', sa.CHAR(length=36), nullable=False),
        sa.Column('seen', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bookmark_id'], ['bookmarks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_digest_items_user_id'), 'digest_items', ['user_id'], unique=False)
    op.create_index(op.f('ix_digest_items_seen'), 'digest_items', ['seen'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_digest_items_seen'), table_name='digest_items')
    op.drop_index(op.f('ix_digest_items_user_id'), table_name='digest_items')
    op.drop_table('digest_items')
    op.drop_index(op.f('ix_follows_following_collection_id'), table_name='follows')
    op.drop_index(op.f('ix_follows_following_user_id'), table_name='follows')
    op.drop_index(op.f('ix_follows_follower_id'), table_name='follows')
    op.drop_table('follows')
    op.drop_table('collection_collaborators')
    with op.batch_alter_table('collections', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_collections_share_token'))
        batch_op.drop_column('share_token')
        batch_op.drop_column('visibility')

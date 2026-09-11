import os
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import URL
from alembic import context
from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        ".env"
    ),
    override=True
)


# ============================================================
# IMPORT DATABASE MODELS
# ============================================================

from backend.database.connection import Base  # noqa: F401
import backend.database.models  # noqa: F401


# ============================================================
# ALEMBIC CONFIGURATION
# ============================================================

config = context.config


# ============================================================
# DATABASE SETTINGS
# ============================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "travel_planner")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")


# ============================================================
# BUILD DATABASE URL SAFELY
# ============================================================
#
# URL.create() is used instead of manually writing:
#
# mysql+pymysql://user:password@host/database
#
# This is important because the MySQL password may contain
# special characters such as @, %, :, /, #, etc.
#
# SQLAlchemy handles the encoding internally.
# ============================================================

DATABASE_URL_OBJECT = URL.create(
    drivername="mysql+pymysql",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    query={
        "charset": "utf8mb4"
    }
)


# String version of the URL
DATABASE_URL = DATABASE_URL_OBJECT


# ============================================================
# ALEMBIC CONFIGURATION
# ============================================================
#
# This is only used by Alembic's configuration system.
# The actual online connection below uses DATABASE_URL_OBJECT
# directly, so ConfigParser cannot corrupt the password.
# ============================================================

config.set_main_option(
    "sqlalchemy.url",
    DATABASE_URL_OBJECT.render_as_string(hide_password=False).replace("%", "%%")
)


# ============================================================
# LOGGING
# ============================================================

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# ============================================================
# ALEMBIC METADATA
# ============================================================

target_metadata = Base.metadata


# ============================================================
# OFFLINE MIGRATIONS
# ============================================================

def run_migrations_offline() -> None:
    """
    Run migrations without creating a database connection.
    """

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
    )

    with context.begin_transaction():
        context.run_migrations()


# ============================================================
# ONLINE MIGRATIONS
# ============================================================

def run_migrations_online() -> None:
    """
    Run migrations using an active database connection.
    """

    # IMPORTANT:
    # Use the SQLAlchemy URL object directly.
    # This completely avoids Alembic ConfigParser issues
    # with special characters in the password.

    connectable = create_engine(
        DATABASE_URL_OBJECT,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


# ============================================================
# START MIGRATION
# ============================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
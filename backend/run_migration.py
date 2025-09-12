#!/usr/bin/env python3
"""
Migration runner for hit-centric analysis database changes.
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.migrations.add_bucket_2dp_column import run_migration


if __name__ == "__main__":
    print("Running hit-centric analysis database migration...")
    try:
        asyncio.run(run_migration())
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
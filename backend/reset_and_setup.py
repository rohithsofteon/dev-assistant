"""
Database reset script for enhanced schema
"""
import os
from pathlib import Path
import sys

# Backup and remove old database
def reset_database():
    db_files = ['DEV_USERS.db', 'DEV_USERS.db-shm', 'DEV_USERS.db-wal']
    
    print("Resetting database for enhanced schema...")
    
    for db_file in db_files:
        file_path = Path(db_file)
        if file_path.exists():
            try:
                # Try to backup first
                backup_path = Path(f"{db_file}.backup")
                if backup_path.exists():
                    backup_path.unlink()
                file_path.rename(backup_path)
                print(f"Backed up {db_file} to {backup_path}")
            except Exception as e:
                print(f"Could not backup {db_file}: {e}")
                try:
                    file_path.unlink()
                    print(f"Removed {db_file}")
                except Exception as e2:
                    print(f"Could not remove {db_file}: {e2}")
    
    print("Database reset completed.")

if __name__ == "__main__":
    reset_database()
    
    # Import and run the enhanced setup
    print("\nNow running enhanced setup...")
    try:
        from setup_enhanced import main
        main()
    except Exception as e:
        print(f"Error running enhanced setup: {e}")
        import traceback
        traceback.print_exc()

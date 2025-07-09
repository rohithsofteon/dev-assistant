import sqlite3
from db import get_db_connection

def check_current_schema():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print("Current tables:")
    for table in tables:
        print(f"- {table[0]}")
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table[0]});")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        print()
    
    conn.close()

if __name__ == "__main__":
    check_current_schema()

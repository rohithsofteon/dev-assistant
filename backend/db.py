# server/db.py

import os
import sqlite3
from pathlib import Path

# Define DB path relative to this file
DB_PATH = Path(__file__).parent / "DEV_USERS.db"

# Role Constants
ROLE_USER = 0           # Regular user - only chat access
ROLE_MASTER_ADMIN = 1   # Master admin - full system access

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row  # Enables dict-like access
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Create users table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role INTEGER DEFAULT 0,
            must_change_password INTEGER DEFAULT 1
        )
    ''')

    # Check if 'must_change_password' column exists
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    if not any(col["name"] == "must_change_password" for col in columns):
        cursor.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 1")
        print("Added must_change_password column to users table.")

    # Create teams table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            team_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
        )
    ''')

    # Create team_members table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_team_admin INTEGER DEFAULT 0,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams (team_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(team_id, user_id)
        )
    ''')

    # Add team_id to module table if not exists
    cursor.execute("PRAGMA table_info(module)")
    module_columns = cursor.fetchall()
    if not any(col["name"] == "team_id" for col in module_columns):
        cursor.execute("ALTER TABLE module ADD COLUMN team_id INTEGER")
        cursor.execute("ALTER TABLE module ADD FOREIGN KEY (team_id) REFERENCES teams (team_id) ON DELETE SET NULL")
        print("Added team_id column to module table.")

    # Add team_id to documents table if not exists  
    cursor.execute("PRAGMA table_info(documents)")
    doc_columns = cursor.fetchall()
    if not any(col["name"] == "team_id" for col in doc_columns):
        cursor.execute("ALTER TABLE documents ADD COLUMN team_id INTEGER")
        cursor.execute("ALTER TABLE documents ADD FOREIGN KEY (team_id) REFERENCES teams (team_id) ON DELETE SET NULL")
        print("Added team_id column to documents table.")

    # Create module table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS module (
            module_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            team_id INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams (team_id) ON DELETE SET NULL
        )
    ''')
    # Create documents table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            document_id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER,
            title TEXT,
            file_path TEXT,
            uploaded_by TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            team_id INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams (team_id) ON DELETE SET NULL
        )
    ''')
    # Create chat_sessions table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    # Create chat_history table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            user_id INTEGER,
            role TEXT,
            content TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()

def create_module(name, description=None, team_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO module (name, description, team_id) VALUES (?, ?, ?)",
        (name, description, team_id)
    )
    module_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return module_id

def add_document(module_id, title, file_path, uploaded_by=None, team_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (module_id, title, file_path, uploaded_by, team_id) VALUES (?, ?, ?, ?, ?)",
        (module_id, title, file_path, uploaded_by, team_id)
    )
    document_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return document_id

def get_modules(team_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if team_id:
        cursor.execute("""
            SELECT m.module_id, m.name, m.description, m.team_id, t.name as team_name
            FROM module m 
            LEFT JOIN teams t ON m.team_id = t.team_id
            WHERE m.team_id = ?
        """, (team_id,))
    else:
        cursor.execute("""
            SELECT m.module_id, m.name, m.description, m.team_id, t.name as team_name
            FROM module m 
            LEFT JOIN teams t ON m.team_id = t.team_id
        """)
    modules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return modules

def get_documents(team_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if team_id:
        cursor.execute("""
            SELECT d.document_id, d.module_id, d.title, d.file_path, d.uploaded_by, d.uploaded_at, d.team_id,
                   m.name as module_name
            FROM documents d 
            JOIN module m ON d.module_id = m.module_id 
            WHERE d.team_id = ?
            ORDER BY m.name, d.title
        """, (team_id,))
    else:
        cursor.execute("""
            SELECT d.document_id, d.module_id, d.title, d.file_path, d.uploaded_by, d.uploaded_at, d.team_id,
                   m.name as module_name
            FROM documents d 
            JOIN module m ON d.module_id = m.module_id 
            ORDER BY m.name, d.title
        """)
    documents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return documents

def get_documents_by_module(module_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT document_id, module_id, title, file_path, uploaded_by, uploaded_at
        FROM documents 
        WHERE module_id = ?
    """, (module_id,))
    documents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return documents

# Chat History Functions
def create_chat_session(user_id, session_name=None):
    """Create a new chat session for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if not session_name:
        # Generate default session name with timestamp
        from datetime import datetime
        session_name = f"Chat Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    cursor.execute("""
        INSERT INTO chat_sessions (user_id, session_name, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (user_id, session_name))
    
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id

def get_user_chat_sessions(user_id):
    """Get all chat sessions for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, session_name, created_at, updated_at 
        FROM chat_sessions 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
    """, (user_id,))
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sessions

def add_chat_message(session_id, user_id, role, content):
    """Add a message to chat history"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO chat_history (session_id, user_id, role, content, timestamp) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (session_id, user_id, role, content))
    
    # Update session's updated_at timestamp
    cursor.execute("""
        UPDATE chat_sessions 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    """, (session_id,))
    
    conn.commit()
    conn.close()

def get_chat_history(session_id, limit=50):
    """Get chat history for a session"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT role, content, timestamp 
        FROM chat_history 
        WHERE session_id = ? 
        ORDER BY timestamp ASC 
        LIMIT ?
    """, (session_id, limit))
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def delete_chat_session(session_id, user_id):
    """Delete a chat session and its history"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Delete chat history first (foreign key constraint)
    cursor.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
    
    # Delete the session (only if it belongs to the user)
    cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    
    conn.commit()
    conn.close()

def update_session_name(session_id, user_id, new_name):
    """Update a chat session name"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE chat_sessions 
        SET session_name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    """, (new_name, session_id, user_id))
    conn.commit()
    conn.close()

def is_session_empty(session_id):
    """Check if a session has any messages"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM chat_history 
        WHERE session_id = ?
    """, (session_id,))
    result = cursor.fetchone()
    conn.close()
    return result["count"] == 0

def has_only_greetings(session_id):
    """Check if a session only contains greeting messages"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT content 
        FROM chat_history 
        WHERE session_id = ? AND role = 'user'
        ORDER BY timestamp ASC
    """, (session_id,))
    messages = cursor.fetchall()
    conn.close()
    
    if not messages:
        return True
    
    greeting_patterns = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
    
    for message in messages:
        content = message["content"].lower().strip()
        # Remove punctuation and check if it's a simple greeting
        import re
        clean_content = re.sub(r'[^\w\s]', '', content).strip()
        
        # If message is longer than 10 words or doesn't match greeting patterns, it's not just a greeting
        if len(clean_content.split()) > 10:
            return False
        
        is_greeting = any(pattern in clean_content for pattern in greeting_patterns)
        if not is_greeting and clean_content:  # Non-empty and not a greeting
            return False
    
    return True

def generate_session_name_from_question(question):
    """Generate a session name based on the first substantive question"""
    import re
    
    # Clean the question
    clean_question = re.sub(r'[^\w\s]', ' ', question).strip()
    words = clean_question.split()
    
    # Take first 5-7 words and create a meaningful title
    if len(words) <= 7:
        name = ' '.join(words)
    else:
        name = ' '.join(words[:7]) + '...'
    
    # Capitalize appropriately
    name = name.title()
    
    # Ensure it's not too long
    if len(name) > 50:
        name = name[:47] + '...'
    
    return name if name else "New Chat"

def get_user_id_by_username(username):
    """Get user ID by username"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    result = cursor.fetchone()
    conn.close()
    return result["id"] if result else None

# Initialize DB on import
initialize_db()

# Permission Helper Functions
def is_master_admin(user_id):
    """Check if user is a master admin"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result and result["role"] == ROLE_MASTER_ADMIN

def is_team_admin(user_id, team_id):
    """Check if a user is an admin of a specific team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT is_team_admin FROM team_members WHERE user_id = ? AND team_id = ?",
        (user_id, team_id)
    )
    result = cursor.fetchone()
    conn.close()
    return result and result["is_team_admin"] == 1

def can_manage_team_members(user_id, team_id):
    """Check if user can manage team members (add/remove users, change roles)"""
    return is_master_admin(user_id) or is_team_admin(user_id, team_id)

def can_manage_team_content(user_id, team_id):
    """Check if user can manage team content (modules, documents)"""
    return is_master_admin(user_id) or is_team_admin(user_id, team_id)

def is_team_member(user_id, team_id):
    """Check if user is a member of a specific team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?",
        (user_id, team_id)
    )
    result = cursor.fetchone()
    conn.close()
    return result is not None

def has_team_access(user_id, team_id):
    """Check if user has access to a team (either master admin, team admin, or team member)"""
    return is_master_admin(user_id) or is_team_member(user_id, team_id)

def has_team_admin_access(user_id, team_id):
    """Check if user has admin access to a team (either master admin or team admin)"""
    return is_master_admin(user_id) or is_team_admin(user_id, team_id)

def get_user_permissions(user_id):
    """Get comprehensive permissions for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get user role
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user_result = cursor.fetchone()
    if not user_result:
        conn.close()
        return None
    
    user_role = user_result["role"]
    
    # Get team memberships
    cursor.execute("""
        SELECT t.team_id, t.name, tm.is_team_admin
        FROM teams t 
        JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.user_id = ?
    """, (user_id,))
    team_memberships = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "user_id": user_id,
        "is_master_admin": user_role == ROLE_MASTER_ADMIN,
        "team_memberships": team_memberships,
        "can_manage_users": user_role == ROLE_MASTER_ADMIN,
        "can_manage_all_teams": user_role == ROLE_MASTER_ADMIN,
        "can_access_chat": True  # All users can access chat
    }

def get_accessible_teams(user_id):
    """Get all teams a user has access to"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Master admin can access all teams
    if is_master_admin(user_id):
        cursor.execute("SELECT team_id, name, description FROM teams ORDER BY name")
    else:
        # Regular users can only access teams they belong to
        cursor.execute("""
            SELECT t.team_id, t.name, t.description
            FROM teams t 
            JOIN team_members tm ON t.team_id = tm.team_id
            WHERE tm.user_id = ?
            ORDER BY t.name
        """, (user_id,))
    
    teams = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return teams

def get_accessible_modules(user_id, team_id=None):
    """Get modules a user can access"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if is_master_admin(user_id):
        # Master admin can access all modules
        if team_id:
            cursor.execute("SELECT * FROM module WHERE team_id = ?", (team_id,))
        else:
            cursor.execute("SELECT * FROM module")
    else:
        # Regular users can only access modules from their teams
        if team_id:
            if has_team_access(user_id, team_id):
                cursor.execute("SELECT * FROM module WHERE team_id = ?", (team_id,))
            else:
                conn.close()
                return []
        else:
            cursor.execute("""
                SELECT m.* FROM module m
                JOIN team_members tm ON m.team_id = tm.team_id
                WHERE tm.user_id = ?
            """, (user_id,))
    
    modules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return modules

def get_accessible_documents(user_id, team_id=None):
    """Get documents a user can access"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if is_master_admin(user_id):
        # Master admin can access all documents
        if team_id:
            cursor.execute("""
                SELECT d.*, m.name as module_name
                FROM documents d 
                JOIN module m ON d.module_id = m.module_id 
                WHERE d.team_id = ?
                ORDER BY m.name, d.title
            """, (team_id,))
        else:
            cursor.execute("""
                SELECT d.*, m.name as module_name
                FROM documents d 
                JOIN module m ON d.module_id = m.module_id 
                ORDER BY m.name, d.title
            """)
    else:
        # Regular users can only access documents from their teams
        if team_id:
            if has_team_access(user_id, team_id):
                cursor.execute("""
                    SELECT d.*, m.name as module_name
                    FROM documents d 
                    JOIN module m ON d.module_id = m.module_id 
                    WHERE d.team_id = ?
                    ORDER BY m.name, d.title
                """, (team_id,))
            else:
                conn.close()
                return []
        else:
            cursor.execute("""
                SELECT d.*, m.name as module_name
                FROM documents d 
                JOIN module m ON d.module_id = m.module_id 
                JOIN team_members tm ON d.team_id = tm.team_id
                WHERE tm.user_id = ?
                ORDER BY m.name, d.title
            """, (user_id,))
    
    documents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return documents

# Team Management Functions
def create_team(name, description=None, created_by=None):
    """Create a new team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)",
        (name, description, created_by)
    )
    team_id = cursor.lastrowid
    
    # Add the creator as team admin
    if created_by:
        cursor.execute(
            "INSERT INTO team_members (team_id, user_id, is_team_admin) VALUES (?, ?, 1)",
            (team_id, created_by)
        )
    
    conn.commit()
    conn.close()
    return team_id

def get_teams():
    """Get all teams"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.team_id, t.name, t.description, t.created_at, 
               u.username as created_by_username,
               COUNT(tm.user_id) as member_count
        FROM teams t 
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN team_members tm ON t.team_id = tm.team_id
        GROUP BY t.team_id
        ORDER BY t.name
    """)
    teams = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return teams

def get_user_teams(user_id):
    """Get teams that a user belongs to, or all teams if user is global admin"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user is global admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user_result = cursor.fetchone()
    
    if user_result and user_result['role'] == 1:
        # Global admin gets access to all teams
        cursor.execute("""
            SELECT team_id, name, description, 1 as is_team_admin
            FROM teams 
            ORDER BY name
        """)
        teams = [dict(row) for row in cursor.fetchall()]
    else:
        # Regular user gets only their assigned teams
        cursor.execute("""
            SELECT t.team_id, t.name, t.description, tm.is_team_admin
            FROM teams t 
            JOIN team_members tm ON t.team_id = tm.team_id
            WHERE tm.user_id = ?
            ORDER BY t.name
        """, (user_id,))
        teams = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return teams

def add_user_to_team(team_id, user_id, is_team_admin=0):
    """Add a user to a team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO team_members (team_id, user_id, is_team_admin) VALUES (?, ?, ?)",
        (team_id, user_id, is_team_admin)
    )
    conn.commit()
    conn.close()
    return True

def remove_user_from_team(team_id, user_id):
    """Remove a user from a team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
        (team_id, user_id)
    )
    conn.commit()
    conn.close()
    return True

def get_team_members(team_id):
    """Get all members of a team, including global admins"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get regular team members
    cursor.execute("""
        SELECT u.id, u.username, u.role, tm.is_team_admin, tm.joined_at
        FROM users u 
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ?
        ORDER BY tm.is_team_admin DESC, u.username
    """, (team_id,))
    members = [dict(row) for row in cursor.fetchall()]
    
    # Get global admins (role = 1) who are not already in the team
    member_ids = {member['id'] for member in members}
    cursor.execute("""
        SELECT id, username, role
        FROM users 
        WHERE role = 1 AND id NOT IN ({})
    """.format(','.join('?' * len(member_ids)) if member_ids else '0'), list(member_ids))
    
    global_admins = cursor.fetchall()
    
    # Add global admins to the members list
    for admin in global_admins:
        members.append({
            'id': admin['id'],
            'username': admin['username'],
            'role': admin['role'],
            'is_team_admin': 0,  # They're global admin, not team admin
            'joined_at': None   # Global admins aren't explicitly joined
        })
    
    conn.close()
    
    # Sort: global admins first, then team admins, then regular members
    members.sort(key=lambda x: (x['role'] != 1, x['is_team_admin'] != 1, x['username']))
    
    return members

def get_user_by_id(user_id):
    """Get user by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return dict(result) if result else None

def get_all_users_for_team():
    """Get all users that can be added to teams"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role FROM users ORDER BY username")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def update_team_admin_status(team_id, user_id, is_admin):
    """Update team admin status for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE team_members SET is_team_admin = ? WHERE team_id = ? AND user_id = ?",
        (is_admin, team_id, user_id)
    )
    conn.commit()
    conn.close()
    return True

def delete_team(team_id):
    """Delete a team and all its associated data"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Delete team members first (foreign key constraint)
    cursor.execute("DELETE FROM team_members WHERE team_id = ?", (team_id,))
    
    # Update modules to remove team association
    cursor.execute("UPDATE module SET team_id = NULL WHERE team_id = ?", (team_id,))
    
    # Update documents to remove team association  
    cursor.execute("UPDATE documents SET team_id = NULL WHERE team_id = ?", (team_id,))
    
    # Delete the team
    cursor.execute("DELETE FROM teams WHERE team_id = ?", (team_id,))
    
    conn.commit()
    conn.close()
    return True

def clear_chat_messages(session_id, user_id):
    """Clear all messages from a chat session (but keep the session)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify session belongs to user and delete messages
    cursor.execute("""
        DELETE FROM chat_history 
        WHERE session_id = ? AND session_id IN (
            SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?
        )
    """, (session_id, session_id, user_id))
    
    # Update session timestamp
    cursor.execute("""
        UPDATE chat_sessions 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    """, (session_id, user_id))
    
    conn.commit()
    conn.close()

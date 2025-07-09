# Enhanced Database Schema with Improved Hierarchy
# This replaces the existing db.py with better role management

import os
import sqlite3
from pathlib import Path
from functools import wraps

# Define DB path relative to this file
DB_PATH = Path(__file__).parent / "ENHANCED_RFP.db"

# Enhanced Role Constants
GLOBAL_ROLE_USER = 'user'
GLOBAL_ROLE_MASTER_ADMIN = 'master_admin'

TEAM_ROLE_USER = 'user'
TEAM_ROLE_ADMIN = 'admin'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row  # Enables dict-like access
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def initialize_improved_db():
    """Initialize database with improved schema"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users table with enum-based global roles
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            global_role TEXT CHECK (global_role IN ('user', 'master_admin')) DEFAULT 'user',
            must_change_password INTEGER DEFAULT 1,
            config TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Teams table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            team_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Team members with enum-based team roles
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            team_role TEXT CHECK (team_role IN ('user', 'admin')) DEFAULT 'user',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(team_id, user_id)
        )
    ''')

    # Modules table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS modules (
            module_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            team_id INTEGER REFERENCES teams(team_id) ON DELETE SET NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Documents table with improved relationships
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            document_id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER REFERENCES modules(module_id) ON DELETE CASCADE,
            team_id INTEGER REFERENCES teams(team_id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_size INTEGER,
            mime_type TEXT
        )
    ''')

    # Chat sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            team_id INTEGER REFERENCES teams(team_id) ON DELETE SET NULL,
            session_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Chat history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_documents_team_id ON documents(team_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_documents_module_id ON documents(module_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_modules_team_id ON modules(team_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)')

    conn.commit()
    conn.close()
    print("Enhanced database schema initialized successfully!")

# Permission Helper Functions
def is_master_admin(user_id):
    """Check if user is a master admin"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT global_role FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result and result["global_role"] == GLOBAL_ROLE_MASTER_ADMIN

def is_team_admin(user_id, team_id):
    """Check if a user is an admin of a specific team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT team_role FROM team_members WHERE user_id = ? AND team_id = ?",
        (user_id, team_id)
    )
    result = cursor.fetchone()
    conn.close()
    return result and result["team_role"] == TEAM_ROLE_ADMIN

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

def can_manage_team_members(user_id, team_id):
    """Check if user can manage team members (add/remove users, change roles)"""
    return is_master_admin(user_id) or is_team_admin(user_id, team_id)

def can_manage_team_content(user_id, team_id):
    """Check if user can manage team content (modules, documents)"""
    return is_master_admin(user_id) or is_team_admin(user_id, team_id)

# Security Decorators
def require_master_admin(func):
    """Decorator to require master admin access"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        user_id = kwargs.get('user_id') or (args[0] if args else None)
        if not user_id or not is_master_admin(user_id):
            raise PermissionError("Master admin access required")
        return func(*args, **kwargs)
    return wrapper

def require_team_admin(func):
    """Decorator to require team admin access"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        user_id = kwargs.get('user_id')
        team_id = kwargs.get('team_id')
        if not user_id or not team_id or not has_team_admin_access(user_id, team_id):
            raise PermissionError("Team admin access required")
        return func(*args, **kwargs)
    return wrapper

def require_team_member(func):
    """Decorator to require team member access"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        user_id = kwargs.get('user_id')
        team_id = kwargs.get('team_id')
        if not user_id or not team_id or not has_team_access(user_id, team_id):
            raise PermissionError("Team member access required")
        return func(*args, **kwargs)
    return wrapper

# User Management Functions
def create_user(username, password, email=None, global_role=GLOBAL_ROLE_USER):
    """Create a new user with enhanced schema"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, email, password, global_role) VALUES (?, ?, ?, ?)",
        (username, email, password, global_role)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return user_id

def get_user_by_username(username):
    """Get user by username"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    result = cursor.fetchone()
    conn.close()
    return dict(result) if result else None

def get_user_by_id(user_id):
    """Get user by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return dict(result) if result else None

def get_all_users():
    """Get all users"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, global_role FROM users ORDER BY username")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

# Team Management Functions
@require_master_admin
def create_team(name, description=None, created_by=None, user_id=None):
    """Create a new team (requires master admin)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)",
        (name, description, created_by or user_id)
    )
    team_id = cursor.lastrowid
    
    # Add the creator as team admin
    if created_by or user_id:
        cursor.execute(
            "INSERT INTO team_members (team_id, user_id, team_role) VALUES (?, ?, ?)",
            (team_id, created_by or user_id, TEAM_ROLE_ADMIN)
        )
    
    conn.commit()
    conn.close()
    return team_id

def get_all_teams():
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
        GROUP BY t.team_id, t.name, t.description, t.created_at, u.username
        ORDER BY t.name
    """)
    teams = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return teams

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
            SELECT t.team_id, t.name, t.description, tm.team_role
            FROM teams t 
            JOIN team_members tm ON t.team_id = tm.team_id
            WHERE tm.user_id = ?
            ORDER BY t.name
        """, (user_id,))
    
    teams = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return teams

@require_team_admin
def add_user_to_team(team_id, target_user_id, team_role=TEAM_ROLE_USER, user_id=None):
    """Add a user to a team (requires team admin access)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO team_members (team_id, user_id, team_role) VALUES (?, ?, ?)",
        (team_id, target_user_id, team_role)
    )
    conn.commit()
    conn.close()
    return True

@require_team_admin
def remove_user_from_team(team_id, target_user_id, user_id=None):
    """Remove a user from a team (requires team admin access)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
        (team_id, target_user_id)
    )
    conn.commit()
    conn.close()
    return True

def get_team_members(team_id):
    """Get all members of a team"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.email, u.global_role, tm.team_role, tm.joined_at
        FROM users u 
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ?
        ORDER BY tm.team_role DESC, u.username
    """, (team_id,))
    members = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return members

@require_team_admin
def update_team_member_role(team_id, target_user_id, new_team_role, user_id=None):
    """Update team member role (requires team admin access)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE team_members SET team_role = ? WHERE team_id = ? AND user_id = ?",
        (new_team_role, team_id, target_user_id)
    )
    conn.commit()
    conn.close()
    return True

# Module Management Functions
@require_team_admin
def create_module(name, description=None, team_id=None, user_id=None):
    """Create a new module (requires team admin access)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO modules (name, description, team_id, created_by) VALUES (?, ?, ?, ?)",
        (name, description, team_id, user_id)
    )
    module_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return module_id

def get_accessible_modules(user_id, team_id=None):
    """Get modules a user can access"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if is_master_admin(user_id):
        # Master admin can access all modules
        if team_id:
            cursor.execute("SELECT * FROM modules WHERE team_id = ?", (team_id,))
        else:
            cursor.execute("SELECT * FROM modules")
    else:
        # Regular users can only access modules from their teams
        if team_id:
            if has_team_access(user_id, team_id):
                cursor.execute("SELECT * FROM modules WHERE team_id = ?", (team_id,))
            else:
                conn.close()
                return []
        else:
            cursor.execute("""
                SELECT m.* FROM modules m
                JOIN team_members tm ON m.team_id = tm.team_id
                WHERE tm.user_id = ?
            """, (user_id,))
    
    modules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return modules

# Document Management Functions
@require_team_admin
def add_document(module_id, title, file_path, team_id=None, user_id=None, file_size=None, mime_type=None):
    """Add a document (requires team admin access)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (module_id, team_id, title, file_path, uploaded_by, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (module_id, team_id, title, file_path, user_id, file_size, mime_type)
    )
    document_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return document_id

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
                JOIN modules m ON d.module_id = m.module_id 
                WHERE d.team_id = ?
                ORDER BY m.name, d.title
            """, (team_id,))
        else:
            cursor.execute("""
                SELECT d.*, m.name as module_name
                FROM documents d 
                JOIN modules m ON d.module_id = m.module_id 
                ORDER BY m.name, d.title
            """)
    else:
        # Regular users can only access documents from their teams
        if team_id:
            if has_team_access(user_id, team_id):
                cursor.execute("""
                    SELECT d.*, m.name as module_name
                    FROM documents d 
                    JOIN modules m ON d.module_id = m.module_id 
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
                JOIN modules m ON d.module_id = m.module_id 
                JOIN team_members tm ON d.team_id = tm.team_id
                WHERE tm.user_id = ?
                ORDER BY m.name, d.title
            """, (user_id,))
    
    documents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return documents

def get_user_permissions(user_id):
    """Get comprehensive permissions for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get user info
    cursor.execute("SELECT global_role FROM users WHERE id = ?", (user_id,))
    user_result = cursor.fetchone()
    if not user_result:
        conn.close()
        return None
    
    global_role = user_result["global_role"]
    
    # Get team memberships
    cursor.execute("""
        SELECT t.team_id, t.name, tm.team_role
        FROM teams t 
        JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.user_id = ?
    """, (user_id,))
    team_memberships = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "user_id": user_id,
        "global_role": global_role,
        "is_master_admin": global_role == GLOBAL_ROLE_MASTER_ADMIN,
        "team_memberships": team_memberships,
        "can_manage_users": global_role == GLOBAL_ROLE_MASTER_ADMIN,
        "can_manage_all_teams": global_role == GLOBAL_ROLE_MASTER_ADMIN,
        "can_access_chat": True  # All users can access chat
    }

# Initialize DB on import
initialize_improved_db()

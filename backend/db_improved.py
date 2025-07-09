"""
Improved Database Functions - Using Enum-based Role System
This module provides improved functions that use explicit role enums instead of integers
"""

import sqlite3
from db import get_db_connection

# Role Constants - Improved with explicit enums
class GlobalRole:
    MASTER_ADMIN = 'master_admin'
    USER = 'user'

class TeamRole:
    ADMIN = 'admin'
    USER = 'user'

# Permission Helper Functions - Improved Version
def is_master_admin_v2(user_id):
    """Check if user is a master admin using the new enum system"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT global_role FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result and result["global_role"] == GlobalRole.MASTER_ADMIN

def is_team_admin_v2(user_id, team_id):
    """Check if a user is an admin of a specific team using the new enum system"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT team_role FROM team_members WHERE user_id = ? AND team_id = ?",
        (user_id, team_id)
    )
    result = cursor.fetchone()
    conn.close()
    return result and result["team_role"] == TeamRole.ADMIN

def is_team_member_v2(user_id, team_id):
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

def has_team_access_v2(user_id, team_id):
    """Check if user has access to a team (either master admin, team admin, or team member)"""
    return is_master_admin_v2(user_id) or is_team_member_v2(user_id, team_id)

def has_team_admin_access_v2(user_id, team_id):
    """Check if user has admin access to a team (either master admin or team admin)"""
    return is_master_admin_v2(user_id) or is_team_admin_v2(user_id, team_id)

def can_manage_team_members_v2(user_id, team_id):
    """Check if user can manage team members (add/remove users, change roles)"""
    return is_master_admin_v2(user_id) or is_team_admin_v2(user_id, team_id)

def can_manage_team_content_v2(user_id, team_id):
    """Check if user can manage team content (modules, documents)"""
    return is_master_admin_v2(user_id) or is_team_admin_v2(user_id, team_id)

def get_user_permissions_v2(user_id):
    """Get comprehensive permissions for a user using the new enum system"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get user role
    cursor.execute("SELECT global_role FROM users WHERE id = ?", (user_id,))
    user_result = cursor.fetchone()
    if not user_result:
        conn.close()
        return None
    
    global_role = user_result["global_role"]
    
    # Get team memberships with explicit roles
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
        "is_master_admin": global_role == GlobalRole.MASTER_ADMIN,
        "team_memberships": team_memberships,
        "can_manage_users": global_role == GlobalRole.MASTER_ADMIN,
        "can_manage_all_teams": global_role == GlobalRole.MASTER_ADMIN,
        "can_access_chat": True  # All users can access chat
    }

def get_accessible_teams_v2(user_id):
    """Get all teams a user has access to"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Master admin can access all teams
    if is_master_admin_v2(user_id):
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

def add_user_to_team_v2(team_id, user_id, team_role=TeamRole.USER):
    """Add a user to a team with explicit role enum"""
    if team_role not in [TeamRole.ADMIN, TeamRole.USER]:
        raise ValueError(f"Invalid team role: {team_role}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Use new team_role column and maintain backward compatibility
    cursor.execute("""
        INSERT INTO team_members (team_id, user_id, team_role, is_team_admin) 
        VALUES (?, ?, ?, ?)
    """, (team_id, user_id, team_role, 1 if team_role == TeamRole.ADMIN else 0))
    
    conn.commit()
    conn.close()
    return True

def update_team_role_v2(team_id, user_id, team_role):
    """Update team role for a user using explicit enum"""
    if team_role not in [TeamRole.ADMIN, TeamRole.USER]:
        raise ValueError(f"Invalid team role: {team_role}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Update both new and old columns for backward compatibility
    cursor.execute("""
        UPDATE team_members 
        SET team_role = ?, is_team_admin = ?
        WHERE team_id = ? AND user_id = ?
    """, (team_role, 1 if team_role == TeamRole.ADMIN else 0, team_id, user_id))
    
    conn.commit()
    conn.close()
    return True

def create_user_v2(username, password, global_role=GlobalRole.USER):
    """Create a user with explicit global role enum"""
    if global_role not in [GlobalRole.MASTER_ADMIN, GlobalRole.USER]:
        raise ValueError(f"Invalid global role: {global_role}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Insert with both new and old role columns for backward compatibility
    cursor.execute("""
        INSERT INTO users (username, password, global_role, role, must_change_password) 
        VALUES (?, ?, ?, ?, 1)
    """, (username, password, global_role, 1 if global_role == GlobalRole.MASTER_ADMIN else 0))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return user_id

def update_user_global_role_v2(user_id, global_role):
    """Update user's global role using explicit enum"""
    if global_role not in [GlobalRole.MASTER_ADMIN, GlobalRole.USER]:
        raise ValueError(f"Invalid global role: {global_role}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Update both new and old columns for backward compatibility
    cursor.execute("""
        UPDATE users 
        SET global_role = ?, role = ?
        WHERE id = ?
    """, (global_role, 1 if global_role == GlobalRole.MASTER_ADMIN else 0, user_id))
    
    conn.commit()
    conn.close()
    return True

def get_team_members_v2(team_id):
    """Get all members of a team with explicit role information"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.global_role, tm.team_role, tm.joined_at
        FROM users u 
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ?
        ORDER BY 
            CASE WHEN tm.team_role = 'admin' THEN 0 ELSE 1 END,
            u.username
    """, (team_id,))
    members = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return members

# Validation Functions
def validate_role_consistency():
    """Validate that old and new role systems are consistent"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("=== ROLE CONSISTENCY VALIDATION ===")
    
    # Check users table consistency
    cursor.execute("""
        SELECT COUNT(*) FROM users 
        WHERE (role = 1 AND global_role != 'master_admin') 
           OR (role = 0 AND global_role != 'user')
           OR global_role IS NULL
    """)
    inconsistent_users = cursor.fetchone()[0]
    
    if inconsistent_users > 0:
        print(f"❌ Found {inconsistent_users} users with inconsistent global roles")
        cursor.execute("""
            SELECT id, username, role, global_role FROM users 
            WHERE (role = 1 AND global_role != 'master_admin') 
               OR (role = 0 AND global_role != 'user')
               OR global_role IS NULL
        """)
        for user in cursor.fetchall():
            print(f"   User {user[1]}: role={user[2]}, global_role={user[3]}")
    else:
        print("✅ All user global roles are consistent")
    
    # Check team_members table consistency
    cursor.execute("""
        SELECT COUNT(*) FROM team_members 
        WHERE (is_team_admin = 1 AND team_role != 'admin') 
           OR (is_team_admin = 0 AND team_role != 'user')
           OR team_role IS NULL
    """)
    inconsistent_team_members = cursor.fetchone()[0]
    
    if inconsistent_team_members > 0:
        print(f"❌ Found {inconsistent_team_members} team members with inconsistent roles")
        cursor.execute("""
            SELECT id, team_id, user_id, is_team_admin, team_role FROM team_members 
            WHERE (is_team_admin = 1 AND team_role != 'admin') 
               OR (is_team_admin = 0 AND team_role != 'user')
               OR team_role IS NULL
        """)
        for member in cursor.fetchall():
            print(f"   Member {member[2]} in team {member[1]}: is_team_admin={member[3]}, team_role={member[4]}")
    else:
        print("✅ All team member roles are consistent")
    
    conn.close()
    return inconsistent_users == 0 and inconsistent_team_members == 0

# Test the improved system
def test_improved_permissions():
    """Test the improved permission system"""
    print("=== TESTING IMPROVED PERMISSION SYSTEM ===\n")
    
    test_users = [2, 14]  # Master admin and regular user
    
    for user_id in test_users:
        print(f"Testing user ID: {user_id}")
        print("-" * 30)
        
        # Get permissions
        permissions = get_user_permissions_v2(user_id)
        if permissions:
            print(f"Global Role: {permissions['global_role']}")
            print(f"Is Master Admin: {permissions['is_master_admin']}")
            print(f"Can Manage Users: {permissions['can_manage_users']}")
            print(f"Team Memberships: {len(permissions['team_memberships'])}")
            
            for team in permissions['team_memberships']:
                print(f"  - {team['name']}: {team['team_role']}")
        
        # Test team access
        accessible_teams = get_accessible_teams_v2(user_id)
        print(f"Accessible Teams: {len(accessible_teams)}")
        
        print()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_improved_permissions()
    elif len(sys.argv) > 1 and sys.argv[1] == "validate":
        validate_role_consistency()
    else:
        print("Usage: python db_improved.py [test|validate]")
        print("  test - Test the improved permission system")
        print("  validate - Validate role consistency")

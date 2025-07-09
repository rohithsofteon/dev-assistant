import sqlite3
from db import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()

print('=== USERS ===')
cursor.execute('SELECT id, username, role, must_change_password FROM users')
users = cursor.fetchall()
for user in users:
    role_name = 'Master Admin' if user[2] == 1 else 'User'
    print(f'ID: {user[0]}, Username: {user[1]}, Role: {role_name} ({user[2]}), Must Change Password: {user[3]}')

print('\n=== TEAMS ===')
cursor.execute('SELECT team_id, name, description, created_by FROM teams')
teams = cursor.fetchall()
for team in teams:
    print(f'Team ID: {team[0]}, Name: {team[1]}, Description: {team[2]}, Created by: {team[3]}')

print('\n=== TEAM MEMBERS ===')
cursor.execute('''
    SELECT tm.team_id, tm.user_id, tm.is_team_admin, u.username 
    FROM team_members tm 
    JOIN users u ON tm.user_id = u.id
''')
members = cursor.fetchall()
for member in members:
    role = 'Team Admin' if member[2] == 1 else 'Team User'
    print(f'Team ID: {member[0]}, User: {member[3]} (ID: {member[1]}), Role: {role}')

print('\n=== MODULES ===')
cursor.execute('SELECT module_id, name, description, team_id FROM module')
modules = cursor.fetchall()
for module in modules:
    team_info = f'Team ID: {module[3]}' if module[3] else 'No Team'
    print(f'Module ID: {module[0]}, Name: {module[1]}, {team_info}')

print('\n=== DOCUMENTS ===')
cursor.execute('SELECT document_id, title, module_id, team_id FROM documents LIMIT 5')
documents = cursor.fetchall()
for doc in documents:
    team_info = f'Team ID: {doc[3]}' if doc[3] else 'No Team'
    print(f'Doc ID: {doc[0]}, Title: {doc[1][:50]}..., Module ID: {doc[2]}, {team_info}')

conn.close()

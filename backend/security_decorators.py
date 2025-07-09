"""
Security Decorators for Backend Route Protection
This module provides decorators to ensure proper permission checking on backend routes
"""

from functools import wraps
from flask import session, jsonify, request
from db_improved import (
    is_master_admin_v2, is_team_admin_v2, has_team_access_v2,
    has_team_admin_access_v2, can_manage_team_members_v2,
    can_manage_team_content_v2, GlobalRole, TeamRole
)

class PermissionError(Exception):
    """Custom exception for permission errors"""
    pass

def get_current_user_id():
    """Get current user ID from session"""
    if 'user_id' not in session:
        return None
    return session['user_id']

def require_login(f):
    """Decorator to require user login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_master_admin(f):
    """Decorator to require master admin privileges"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        
        if not is_master_admin_v2(user_id):
            return jsonify({"error": "Master admin privileges required"}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def require_team_access(f):
    """Decorator to require access to a specific team (from URL parameter or request body)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        
        # Try to get team_id from various sources
        team_id = None
        
        # From URL parameters
        if 'team_id' in kwargs:
            team_id = kwargs['team_id']
        elif 'team_id' in request.view_args:
            team_id = request.view_args['team_id']
        # From request JSON
        elif request.is_json and 'team_id' in request.json:
            team_id = request.json['team_id']
        # From form data
        elif 'team_id' in request.form:
            team_id = request.form['team_id']
        # From query parameters
        elif 'team_id' in request.args:
            team_id = request.args['team_id']
        
        if not team_id:
            return jsonify({"error": "Team ID required"}), 400
        
        try:
            team_id = int(team_id)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid team ID"}), 400
        
        if not has_team_access_v2(user_id, team_id):
            return jsonify({"error": "Access to this team denied"}), 403
        
        # Add team_id to kwargs for the route function
        kwargs['team_id'] = team_id
        return f(*args, **kwargs)
    return decorated_function

def require_team_admin(f):
    """Decorator to require team admin privileges for a specific team"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        
        # Try to get team_id from various sources
        team_id = None
        
        # From URL parameters
        if 'team_id' in kwargs:
            team_id = kwargs['team_id']
        elif 'team_id' in request.view_args:
            team_id = request.view_args['team_id']
        # From request JSON
        elif request.is_json and 'team_id' in request.json:
            team_id = request.json['team_id']
        # From form data
        elif 'team_id' in request.form:
            team_id = request.form['team_id']
        # From query parameters
        elif 'team_id' in request.args:
            team_id = request.args['team_id']
        
        if not team_id:
            return jsonify({"error": "Team ID required"}), 400
        
        try:
            team_id = int(team_id)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid team ID"}), 400
        
        if not has_team_admin_access_v2(user_id, team_id):
            return jsonify({"error": "Team admin privileges required"}), 403
        
        # Add team_id to kwargs for the route function
        kwargs['team_id'] = team_id
        return f(*args, **kwargs)
    return decorated_function

def require_permission(permission_type):
    """Generic decorator to require specific permissions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_current_user_id()
            if not user_id:
                return jsonify({"error": "Authentication required"}), 401
            
            team_id = None
            # Try to get team_id for team-specific permissions
            if permission_type in ['team_admin', 'team_access', 'team_member_management', 'team_content_management']:
                # Extract team_id from various sources
                if 'team_id' in kwargs:
                    team_id = kwargs['team_id']
                elif 'team_id' in request.view_args:
                    team_id = request.view_args['team_id']
                elif request.is_json and 'team_id' in request.json:
                    team_id = request.json['team_id']
                elif 'team_id' in request.form:
                    team_id = request.form['team_id']
                elif 'team_id' in request.args:
                    team_id = request.args['team_id']
                
                if not team_id:
                    return jsonify({"error": "Team ID required for this operation"}), 400
                
                try:
                    team_id = int(team_id)
                except (ValueError, TypeError):
                    return jsonify({"error": "Invalid team ID"}), 400
            
            # Check permissions based on type
            if permission_type == 'master_admin':
                if not is_master_admin_v2(user_id):
                    return jsonify({"error": "Master admin privileges required"}), 403
            
            elif permission_type == 'team_admin':
                if not has_team_admin_access_v2(user_id, team_id):
                    return jsonify({"error": "Team admin privileges required"}), 403
            
            elif permission_type == 'team_access':
                if not has_team_access_v2(user_id, team_id):
                    return jsonify({"error": "Access to this team denied"}), 403
            
            elif permission_type == 'team_member_management':
                if not can_manage_team_members_v2(user_id, team_id):
                    return jsonify({"error": "Team member management privileges required"}), 403
            
            elif permission_type == 'team_content_management':
                if not can_manage_team_content_v2(user_id, team_id):
                    return jsonify({"error": "Team content management privileges required"}), 403
            
            else:
                return jsonify({"error": f"Unknown permission type: {permission_type}"}), 500
            
            # Add team_id to kwargs if it was extracted
            if team_id:
                kwargs['team_id'] = team_id
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Route permission examples
def create_protected_routes(app):
    """Example of how to create protected routes"""
    
    @app.route('/api/admin/users', methods=['GET'])
    @require_master_admin
    def get_all_users():
        """Only master admins can view all users"""
        # Implementation here
        return jsonify({"message": "All users data"})
    
    @app.route('/api/teams/<int:team_id>/delete', methods=['DELETE'])
    @require_master_admin
    def delete_team(team_id):
        """Only master admins can delete teams"""
        # Implementation here
        return jsonify({"message": f"Team {team_id} deleted"})
    
    @app.route('/api/teams/<int:team_id>/members', methods=['POST'])
    @require_team_admin
    def add_team_member(team_id):
        """Team admins and master admins can add team members"""
        # Implementation here
        return jsonify({"message": f"Member added to team {team_id}"})
    
    @app.route('/api/teams/<int:team_id>/modules', methods=['POST'])
    @require_permission('team_content_management')
    def create_module(team_id):
        """Users with team content management privileges can create modules"""
        # Implementation here
        return jsonify({"message": f"Module created in team {team_id}"})
    
    @app.route('/api/teams/<int:team_id>/documents', methods=['GET'])
    @require_team_access
    def get_team_documents(team_id):
        """Any team member can view team documents"""
        # Implementation here
        return jsonify({"message": f"Documents for team {team_id}"})
    
    @app.route('/api/teams/<int:team_id>/members/<int:user_id>/role', methods=['PUT'])
    @require_permission('team_member_management')
    def update_member_role(team_id, user_id):
        """Users with team member management privileges can update roles"""
        # Implementation here
        return jsonify({"message": f"Updated role for user {user_id} in team {team_id}"})

# Audit logging decorator
def audit_log(action):
    """Decorator to log permission-based actions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_current_user_id()
            
            # Log the action
            import logging
            logger = logging.getLogger('audit')
            logger.info(f"User {user_id} performed action: {action} - Route: {request.endpoint} - IP: {request.remote_addr}")
            
            result = f(*args, **kwargs)
            
            # Log success
            logger.info(f"Action {action} completed successfully for user {user_id}")
            
            return result
        return decorated_function
    return decorator

# Usage examples:
"""
from security_decorators import require_master_admin, require_team_admin, require_permission, audit_log

@app.route('/api/admin/create-user', methods=['POST'])
@require_master_admin
@audit_log('create_user')
def create_user():
    # Only master admins can create users
    pass

@app.route('/api/teams/<int:team_id>/settings', methods=['PUT'])
@require_team_admin
@audit_log('update_team_settings')
def update_team_settings(team_id):
    # Team admins and master admins can update team settings
    pass

@app.route('/api/teams/<int:team_id>/upload', methods=['POST'])
@require_permission('team_content_management')
@audit_log('upload_document')
def upload_document(team_id):
    # Users with content management privileges can upload
    pass
"""

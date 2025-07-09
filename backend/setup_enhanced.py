"""
Setup script for enhanced RFP Assistant database with sample data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db_enhanced import *

def create_sample_data():
    """Create sample data for testing the enhanced hierarchy"""
    print("Setting up enhanced RFP Assistant database...")
    
    # Create master admin users
    print("\n1. Creating users...")
    master_admin_id = create_user(
        username="admin@company.com",
        email="admin@company.com", 
        password="admin123",
        global_role=GLOBAL_ROLE_MASTER_ADMIN
    )
    print(f"Created master admin: admin@company.com (ID: {master_admin_id})")
    
    # Create regular users
    user1_id = create_user(
        username="john.doe@company.com",
        email="john.doe@company.com",
        password="user123",
        global_role=GLOBAL_ROLE_USER
    )
    print(f"Created user: john.doe@company.com (ID: {user1_id})")
    
    user2_id = create_user(
        username="jane.smith@company.com", 
        email="jane.smith@company.com",
        password="user123",
        global_role=GLOBAL_ROLE_USER
    )
    print(f"Created user: jane.smith@company.com (ID: {user2_id})")
    
    user3_id = create_user(
        username="bob.johnson@company.com",
        email="bob.johnson@company.com", 
        password="user123",
        global_role=GLOBAL_ROLE_USER
    )
    print(f"Created user: bob.johnson@company.com (ID: {user3_id})")
    
    # Create teams
    print("\n2. Creating teams...")
    shipping_team_id = create_team(
        name="Shipping Team",
        description="Handles all shipping and logistics operations", 
        user_id=master_admin_id
    )
    print(f"Created team: Shipping Team (ID: {shipping_team_id})")
    
    picking_team_id = create_team(
        name="Picking Team", 
        description="Manages picking and fulfillment processes",
        user_id=master_admin_id
    )
    print(f"Created team: Picking Team (ID: {picking_team_id})")
    
    testing_team_id = create_team(
        name="Testing Team",
        description="Quality assurance and testing operations", 
        user_id=master_admin_id
    )
    print(f"Created team: Testing Team (ID: {testing_team_id})")
    
    # Add users to teams with different roles
    print("\n3. Adding users to teams...")
    
    # John Doe - Team admin in Shipping, regular user in Picking
    add_user_to_team(
        team_id=shipping_team_id,
        target_user_id=user1_id,
        team_role=TEAM_ROLE_ADMIN,
        user_id=master_admin_id
    )
    print(f"Added john.doe as admin to Shipping Team")
    
    add_user_to_team(
        team_id=picking_team_id, 
        target_user_id=user1_id,
        team_role=TEAM_ROLE_USER,
        user_id=master_admin_id
    )
    print(f"Added john.doe as user to Picking Team")
    
    # Jane Smith - Team admin in Picking
    add_user_to_team(
        team_id=picking_team_id,
        target_user_id=user2_id, 
        team_role=TEAM_ROLE_ADMIN,
        user_id=master_admin_id
    )
    print(f"Added jane.smith as admin to Picking Team")
    
    # Bob Johnson - Regular user in Testing
    add_user_to_team(
        team_id=testing_team_id,
        target_user_id=user3_id,
        team_role=TEAM_ROLE_USER, 
        user_id=master_admin_id
    )
    print(f"Added bob.johnson as user to Testing Team")
    
    # Create modules
    print("\n4. Creating modules...")
    shipping_module_id = create_module(
        name="Shipping Operations",
        description="Core shipping functionality and processes",
        team_id=shipping_team_id,
        user_id=user1_id  # John Doe creates it (team admin)
    )
    print(f"Created module: Shipping Operations (ID: {shipping_module_id})")
    
    picking_module_id = create_module(
        name="Picking Processes", 
        description="Picking and fulfillment workflows",
        team_id=picking_team_id,
        user_id=user2_id  # Jane Smith creates it (team admin)
    )
    print(f"Created module: Picking Processes (ID: {picking_module_id})")
    
    testing_module_id = create_module(
        name="QA Testing",
        description="Quality assurance and testing procedures", 
        team_id=testing_team_id,
        user_id=master_admin_id  # Master admin creates it
    )
    print(f"Created module: QA Testing (ID: {testing_module_id})")
    
    # Create sample documents
    print("\n5. Creating sample documents...")
    doc1_id = add_document(
        module_id=shipping_module_id,
        title="Shipping Workflow Guide",
        file_path="/uploads/shipping/workflow_guide.pdf",
        team_id=shipping_team_id,
        user_id=user1_id,
        file_size=1024000,
        mime_type="application/pdf"
    )
    print(f"Created document: Shipping Workflow Guide (ID: {doc1_id})")
    
    doc2_id = add_document(
        module_id=picking_module_id, 
        title="Picking Best Practices",
        file_path="/uploads/picking/best_practices.docx",
        team_id=picking_team_id,
        user_id=user2_id,
        file_size=512000,
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    print(f"Created document: Picking Best Practices (ID: {doc2_id})")
    
    print("\n✅ Sample data created successfully!")
    print("\n📋 Summary:")
    print("   - 1 Master Admin: admin@company.com")
    print("   - 3 Regular Users: john.doe, jane.smith, bob.johnson") 
    print("   - 3 Teams: Shipping, Picking, Testing")
    print("   - Multi-team membership: john.doe is in 2 teams with different roles")
    print("   - 3 Modules and 2 Documents created")
    
    return {
        "master_admin_id": master_admin_id,
        "users": [user1_id, user2_id, user3_id],
        "teams": [shipping_team_id, picking_team_id, testing_team_id],
        "modules": [shipping_module_id, picking_module_id, testing_module_id]
    }

def test_permissions():
    """Test the permission system with sample data"""
    print("\n" + "="*60)
    print("TESTING PERMISSION SYSTEM")
    print("="*60)
    
    # Get users for testing
    admin_user = get_user_by_username("admin@company.com")
    john_user = get_user_by_username("john.doe@company.com") 
    jane_user = get_user_by_username("jane.smith@company.com")
    bob_user = get_user_by_username("bob.johnson@company.com")
    
    test_users = [
        (admin_user, "Master Admin"),
        (john_user, "Multi-team User (Admin in Shipping, User in Picking)"),
        (jane_user, "Team Admin (Picking Team)"), 
        (bob_user, "Team User (Testing Team)")
    ]
    
    for user, description in test_users:
        if not user:
            continue
            
        print(f"\n👤 {user['username']} - {description}")
        print("-" * 50)
        
        permissions = get_user_permissions(user['id'])
        if permissions:
            print(f"Global Role: {permissions['global_role']}")
            print(f"Is Master Admin: {permissions['is_master_admin']}")
            print(f"Can Manage All Teams: {permissions['can_manage_all_teams']}")
            
            print(f"\nTeam Memberships ({len(permissions['team_memberships'])}):")
            for team in permissions['team_memberships']:
                print(f"  - {team['name']}: {team['team_role']}")
        
        # Test accessible teams
        accessible_teams = get_accessible_teams(user['id'])
        print(f"\nAccessible Teams ({len(accessible_teams)}):")
        for team in accessible_teams:
            team_id = team['team_id']
            access_level = []
            if is_team_admin(user['id'], team_id):
                access_level.append("Admin")
            elif is_team_member(user['id'], team_id):
                access_level.append("Member")
            
            print(f"  - {team['name']} ({', '.join(access_level)})")
        
        # Test accessible modules
        accessible_modules = get_accessible_modules(user['id'])
        print(f"\nAccessible Modules ({len(accessible_modules)}):")
        for module in accessible_modules:
            print(f"  - {module['name']} (Team ID: {module['team_id']})")

def main():
    """Main setup function"""
    try:
        # Create sample data
        data = create_sample_data()
        
        # Test permissions
        test_permissions()
        
        print(f"\n🎉 Enhanced RFP Assistant setup completed successfully!")
        print(f"\n🔐 Login credentials:")
        print(f"   Master Admin: admin@company.com / admin123")
        print(f"   Users: john.doe@company.com, jane.smith@company.com, bob.johnson@company.com / user123")
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

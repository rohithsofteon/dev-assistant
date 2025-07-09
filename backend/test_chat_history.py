#!/usr/bin/env python3
"""
Test script for chat history functionality
"""

import sys
import json
from db import (
    get_user_id_by_username, 
    create_chat_session, 
    get_user_chat_sessions,
    add_chat_message,
    get_chat_history,
    delete_chat_session,
    update_session_name
)

def test_chat_functionality():
    print("Testing chat history functionality...")
    
    # Test user lookup - use first available user
    from db import get_db_connection
    conn = get_db_connection()
    user = conn.execute('SELECT id, username FROM users LIMIT 1').fetchone()
    conn.close()
    
    if not user:
        print("❌ No users found in database")
        return False
    
    user_id = user['id']
    username = user['username']
    print(f"✅ Found user '{username}' with ID: {user_id}")
    
    # Test session creation
    session_id = create_chat_session(user_id, "Test Session")
    print(f"✅ Created session with ID: {session_id}")
    
    # Test adding messages
    add_chat_message(session_id, user_id, 'user', 'Hello, this is a test message')
    add_chat_message(session_id, user_id, 'assistant', 'Hello! How can I help you today?')
    print("✅ Added test messages")
    
    # Test getting chat history
    history = get_chat_history(session_id)
    print(f"✅ Retrieved {len(history)} messages from history")
    for msg in history:
        print(f"   {msg['role']}: {msg['content'][:50]}...")
    
    # Test getting user sessions
    sessions = get_user_chat_sessions(user_id)
    print(f"✅ User has {len(sessions)} chat sessions")
    
    # Test updating session name
    update_session_name(session_id, user_id, "Updated Test Session")
    print("✅ Updated session name")
    
    # Clean up - delete test session
    delete_chat_session(session_id, user_id)
    print("✅ Cleaned up test session")
    
    print("\n🎉 All chat history tests passed!")
    return True

if __name__ == "__main__":
    try:
        test_chat_functionality()
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        sys.exit(1)

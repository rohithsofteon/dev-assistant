import os
import pathlib
import shutil
import jwt
import smtplib
import sqlite3
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from email.mime.text import MIMEText
from typing import Optional, Dict, Any
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from datetime import datetime
from db import (get_db_connection, get_modules, create_module, add_document, get_documents,
                create_team, get_teams, get_user_teams, add_user_to_team, remove_user_from_team,
                get_team_members, is_team_admin, get_user_by_id, get_all_users_for_team,
                update_team_admin_status, delete_team, has_only_greetings, 
                generate_session_name_from_question, update_session_name)
import json
from semantic_indexing import answer_question, answer_question_stream
import logging

# Load env vars
load_dotenv()

app = FastAPI()
security = HTTPBearer()

FRONTEND_URL = (
    "https://rfp-assistant-frontend.onrender.com"
    if os.getenv("NODE_ENV") == "production"
    else "http://localhost:3000"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

JWT_SECRET = "your_jwt_secret"

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: Optional[int] = 0

class QueryRequest(BaseModel):
    question: str
    module_id: Optional[int] = None

class EditUserRequest(BaseModel):
    oldUsername: str
    newUsername: str

class ChangePasswordRequest(BaseModel):
    username: str
    newPassword: str

class DeleteUserRequest(BaseModel):
    username: str

class CreateTeamRequest(BaseModel):
    name: str
    description: Optional[str] = None

class AddTeamMemberRequest(BaseModel):
    team_id: int
    user_id: int
    is_team_admin: Optional[bool] = False

class RemoveTeamMemberRequest(BaseModel):
    team_id: int
    user_id: int

class UpdateTeamAdminRequest(BaseModel):
    team_id: int
    user_id: int
    is_admin: bool

class DeleteTeamRequest(BaseModel):
    team_id: int

class CreateSessionRequest(BaseModel):
    session_name: Optional[str] = None

class SaveChatMessageRequest(BaseModel):
    session_id: int
    role: str  # 'user' or 'assistant'
    content: str

class UpdateSessionNameRequest(BaseModel):
    session_id: int
    session_name: str

def create_token(user):
    return jwt.encode({"id": user["id"], "username": user["username"]}, JWT_SECRET, algorithm="HS256")

def get_user_from_token(request: Request):
    """Helper function to extract user info from JWT token"""
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        return None

@app.post("/api/login")
def login(req: LoginRequest):
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (req.username,)).fetchone()
    conn.close()
    if not user or req.password != user["password"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    config = user["config"] if "config" in user.keys() else None
    return {
        "token": create_token(user),
        "role": user["role"],
        "mustChangePassword": user["must_change_password"] == 1,
        "config": json.loads(config) if config else None
    }

DB_PATH = "DEV_USERS.DB"  # Make sure this is defined

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn

def execute_with_retry(query, params=(), retries=5, delay=0.3):
    for attempt in range(retries):
        try:
            with get_db_connection() as conn:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute(query, params)
                conn.commit()
            return
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                if attempt < retries - 1:
                    time.sleep(delay)
                    continue
                else:
                    raise
            else:
                raise

@app.post("/api/register")
def register(req: RegisterRequest):
    try:
        # Security: Force role to 0 (regular user) for the public register endpoint
        # Only global admins can create other global admins via the admin endpoint
        execute_with_retry(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (req.username, req.password, 0)  # Force role to 0 for security
        )

        email_user = os.getenv("EMAIL_USER")
        email_pass = os.getenv("EMAIL_PASS")
        login_url = "http://localhost:3000/login"

        msg = MIMEText(f"""Hello,

Your account has been created.

Username: {req.username}
Password: {req.password}

Please change your password after logging in for the first time here: {login_url}.

Thank you!
""")
        msg['Subject'] = 'Welcome to RFP Assistant'
        msg['From'] = email_user
        msg['To'] = req.username

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(email_user, email_pass)
            server.send_message(msg)

        return {"success": True}

    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    module_id: int = Form(...),
    title: str = Form(...)
):
    try:
        # Extract user from JWT token
        user = get_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        uploaded_by = user["username"]
        user_id = user["id"]

        # Check if user has permission to upload to this module
        conn = get_db_connection()
        user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        module_data = conn.execute("SELECT team_id FROM module WHERE module_id = ?", (module_id,)).fetchone()
        conn.close()

        if not module_data:
            raise HTTPException(status_code=404, detail="Module not found")

        # System admins can upload to any module
        if user_data["role"] != 1:
            # For regular users, check if they are team admin of the module's team
            if module_data["team_id"] and not is_team_admin(user_id, module_data["team_id"]):
                raise HTTPException(status_code=403, detail="Only team admins can upload documents to this module")

        # Create module directory if it doesn't exist
        module_dir = os.path.join(UPLOAD_DIR, str(module_id))
        os.makedirs(module_dir, exist_ok=True)

        # Save the uploaded file
        file_location = os.path.join(module_dir, file.filename)
        with open(file_location, "wb") as f:
            content = await file.read()
            f.write(content)

        # Save file info to the database
        doc_id = add_document(module_id, title, file_location, uploaded_by, module_data["team_id"])

        # After saving, process and index the file (text + images)
        from semantic_indexing import process_and_index
        process_and_index(file_location, doc_id, module_id)

        return {"success": True, "file_path": file_location, "document_id": doc_id, "module_id": module_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users")
def get_users():
    conn = get_db_connection()
    users = conn.execute("SELECT username FROM users").fetchall()
    conn.close()
    return {"users": [dict(u) for u in users]}

# Team Management Endpoints
@app.post("/api/teams")
async def create_team_endpoint(request: Request, team_data: CreateTeamRequest):
    """Create a new team"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user is system admin
    conn = get_db_connection()
    user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    if not user_data or user_data["role"] != 1:
        raise HTTPException(status_code=403, detail="Only system admins can create teams")
    
    try:
        team_id = create_team(team_data.name, team_data.description, user["id"])
        return {"success": True, "team_id": team_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/teams")
async def get_teams_endpoint(request: Request):
    """Get all teams"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        teams = get_teams()
        return {"teams": teams}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/teams")
async def get_user_teams_endpoint(request: Request):
    """Get teams that the current user belongs to"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        teams = get_user_teams(user["id"])
        return {"teams": teams}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/teams/{team_id}/members")
async def get_team_members_endpoint(request: Request, team_id: int):
    """Get members of a specific team"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        members = get_team_members(team_id)
        return {"members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/teams/add-member")
async def add_team_member_endpoint(request: Request, member_data: AddTeamMemberRequest):
    """Add a user to a team"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user is team admin or system admin
    conn = get_db_connection()
    user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    if user_data["role"] != 1 and not is_team_admin(user["id"], member_data.team_id):
        raise HTTPException(status_code=403, detail="Only team admins or system admins can add members")
    
    try:
        add_user_to_team(member_data.team_id, member_data.user_id, 1 if member_data.is_team_admin else 0)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/teams/remove-member")
async def remove_team_member_endpoint(request: Request, member_data: RemoveTeamMemberRequest):
    """Remove a user from a team"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user is team admin or system admin
    conn = get_db_connection()
    user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    if user_data["role"] != 1 and not is_team_admin(user["id"], member_data.team_id):
        raise HTTPException(status_code=403, detail="Only team admins or system admins can remove members")
    
    try:
        remove_user_from_team(member_data.team_id, member_data.user_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/teams/update-admin")
async def update_team_admin_endpoint(request: Request, admin_data: UpdateTeamAdminRequest):
    """Update team admin status for a user"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user is team admin or system admin
    conn = get_db_connection()
    user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    if user_data["role"] != 1 and not is_team_admin(user["id"], admin_data.team_id):
        raise HTTPException(status_code=403, detail="Only team admins or system admins can update admin status")
    
    try:
        update_team_admin_status(admin_data.team_id, admin_data.user_id, 1 if admin_data.is_admin else 0)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/teams/{team_id}")
async def delete_team_endpoint(request: Request, team_id: int):
    """Delete a team"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user is system admin
    conn = get_db_connection()
    user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    if not user_data or user_data["role"] != 1:
        raise HTTPException(status_code=403, detail="Only system admins can delete teams")
    
    try:
        delete_team(team_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/all-users")
async def get_all_users_endpoint(request: Request):
    """Get all users for team management"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        users = get_all_users_for_team()
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete-user")
def delete_user(req: DeleteUserRequest):
    if not req.username:
        raise HTTPException(status_code=400, detail="Username required")
    try:
        execute_with_retry("DELETE FROM users WHERE username = ?", (req.username,))
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/edit-user")
def edit_user(req: EditUserRequest):
    try:
        execute_with_retry("UPDATE users SET username = ? WHERE username = ?", (req.newUsername, req.oldUsername))
        return {"success": True}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists or database error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/change-password")
def change_password(req: ChangePasswordRequest):
    if not req.username or not req.newPassword:
        raise HTTPException(status_code=400, detail="Username and new password required")
    try:
        execute_with_retry(
            "UPDATE users SET password = ?, must_change_password = 0 WHERE username = ?",
            (req.newPassword, req.username)
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check-user")
async def check_user(request: Request):
    data = await request.json()
    username = data.get("username")
    if not username:
        return JSONResponse({"exists": False})
    try:
        with get_db_connection() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
        return JSONResponse({"exists": bool(user)})
    except Exception:
        return JSONResponse({"exists": False})

@app.get("/api/modules")
async def api_get_modules(request: Request, team_id: Optional[int] = None):
    try:
        # Extract user from JWT token for access control
        user = get_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = user["id"]
        
        # System admins can see all modules
        conn = get_db_connection()
        user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()

        if user_data["role"] == 1:
            # System admin sees all modules
            modules = get_modules(team_id)
        else:
            # Regular users only see modules from their teams
            user_teams = get_user_teams(user_id)
            user_team_ids = [team["team_id"] for team in user_teams]
            
            if team_id and team_id in user_team_ids:
                modules = get_modules(team_id)
            elif team_id:
                # User requesting team they don't belong to
                modules = []
            else:
                # Get modules from all user's teams
                all_modules = get_modules()
                modules = [m for m in all_modules if m.get("team_id") in user_team_ids or m.get("team_id") is None]
        
        return {"modules": modules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create_module")
async def api_create_module(
    request: Request, 
    name: str = Form(...), 
    description: str = Form(None),
    team_id: int = Form(None)
):
    try:
        # Extract user from JWT token
        user = get_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = user["id"]

        # Check permissions
        conn = get_db_connection()
        user_data = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()

        # System admins can create modules in any team
        if user_data["role"] != 1:
            # For regular users, check if they are team admin of the specified team
            if team_id and not is_team_admin(user_id, team_id):
                raise HTTPException(status_code=403, detail="Only team admins can create modules for this team")

        module_id = create_module(name, description, team_id)
        return {"success": True, "module_id": module_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.post("/api/ask")
async def ask(request: Request):
    try:
        data = await request.json()
        logger.info(f"Received data: {data}")
        
        question = data.get('question', '')
        module_id = data.get('module_id')
        user_config = data.get('config')
        chat_history = data.get('chat_history', [])  # Get chat history
        session_id = data.get('session_id')  # Optional session ID for saving
        
        # Extract user info from token if available
        auth_header = request.headers.get("authorization")
        username = None
        user_id = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                username = payload.get("username")
                if username:
                    from db import get_user_id_by_username
                    user_id = get_user_id_by_username(username)
            except jwt.InvalidTokenError:
                pass
        
        # Convert module_id to integer if it's a string
        if module_id is not None:
            try:
                module_id = int(module_id)
            except (ValueError, TypeError):
                logger.warning(f"Invalid module_id format: {module_id}, setting to None")
                module_id = None
        
        logger.info(f"Processing question: '{question}' for module_id: {module_id} with {len(chat_history)} history messages")
        
        if not question:
            return JSONResponse({"error": "No question provided"}, status_code=400)
        
        # Save user question if session_id is provided
        if session_id and user_id:
            try:
                from db import (add_chat_message, has_only_greetings, 
                               generate_session_name_from_question, update_session_name)
                
                # Check if this is the first substantive question (not just greetings)
                should_update_name = has_only_greetings(session_id)
                
                add_chat_message(session_id, user_id, 'user', question)
                
                # If this is the first non-greeting question, update session name
                if should_update_name:
                    # Check if the current question is also not just a greeting
                    import re
                    clean_question = re.sub(r'[^\w\s]', '', question.lower()).strip()
                    greeting_patterns = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
                    is_greeting = any(pattern in clean_question for pattern in greeting_patterns)
                    
                    if not is_greeting and len(clean_question.split()) > 2:
                        new_session_name = generate_session_name_from_question(question)
                        update_session_name(session_id, user_id, new_session_name)
                        logger.info(f"Updated session {session_id} name to: {new_session_name}")
                
            except Exception as e:
                logger.warning(f"Failed to save user message: {e}")
        
        def generate():
            try:
                response_chunks = []
                for chunk in answer_question_stream(question, module_id=module_id, user_config=user_config, chat_history=chat_history):
                    response_chunks.append(chunk)
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # Save assistant response if session_id is provided
                if session_id and user_id and response_chunks:
                    try:
                        full_response = ''.join(response_chunks)
                        from db import add_chat_message
                        add_chat_message(session_id, user_id, 'assistant', full_response)
                    except Exception as e:
                        logger.warning(f"Failed to save assistant message: {e}")
                
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                logger.error(f"Error in streaming: {e}")
                yield f"data: {json.dumps({'error': 'Internal server error'})}\n\n"
        
        return StreamingResponse(generate(), media_type='text/plain')
    
    except Exception as e:
        logger.error(f"Error in ask endpoint: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)

@app.post("/ask_simple")
async def ask_simple(request: Request):
    try:
        data = await request.json()
        question = data.get('question', '')
        module_id = data.get('module_id')
        
        if module_id is not None:
            try:
                module_id = int(module_id)
            except (ValueError, TypeError):
                module_id = None
        
        if not question:
            return JSONResponse({"error": "No question provided"}, status_code=400)
        
        # Use the original answer_question function
        answer = answer_question(question, module_id=module_id)
        return JSONResponse({"answer": answer})
    
    except Exception as e:
        logger.error(f"Error in ask_simple endpoint: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)

@app.get("/api/documents")
def api_get_documents():
    try:
        documents = get_documents()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_module/{module_id}")
def api_delete_module(module_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First, get all documents in this module to delete their files
        cursor.execute("SELECT file_path FROM documents WHERE module_id = ?", (module_id,))
        file_paths = [row[0] for row in cursor.fetchall()]
        
        # Delete embeddings for this module first
        try:
            from semantic_indexing import delete_module_embeddings
            delete_module_embeddings(module_id)
            logger.info(f"Deleted embeddings for module {module_id}")
        except Exception as e:
            logger.warning(f"Failed to delete embeddings for module {module_id}: {e}")
        
        # Delete document records
        cursor.execute("DELETE FROM documents WHERE module_id = ?", (module_id,))
        
        # Delete module record
        cursor.execute("DELETE FROM module WHERE module_id = ?", (module_id,))
        
        conn.commit()
        conn.close()
        
        # Delete physical files
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete file {file_path}: {e}")
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_document/{document_id}")
def api_delete_document(document_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get file path before deleting
        cursor.execute("SELECT file_path FROM documents WHERE document_id = ?", (document_id,))
        result = cursor.fetchone()
        
        if result:
            file_path = result[0]
            
            # Delete embeddings for this document first
            try:
                from semantic_indexing import delete_document_embeddings
                delete_document_embeddings(document_id)
                logger.info(f"Deleted embeddings for document {document_id}")
            except Exception as e:
                logger.warning(f"Failed to delete embeddings for document {document_id}: {e}")
            
            # Delete document record
            cursor.execute("DELETE FROM documents WHERE document_id = ?", (document_id,))
            conn.commit()
            conn.close()
            
            # Delete physical file
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete file {file_path}: {e}")
            
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="Document not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/module_stats/{module_id}")
def get_module_embedding_stats(module_id: int):
    """Get embedding statistics for a module"""
    try:
        from semantic_indexing import get_module_stats
        stats = get_module_stats(module_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting module stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_module_embeddings/{module_id}")
def delete_module_embeddings_endpoint(module_id: int):
    """Delete all embeddings for a module"""
    try:
        from semantic_indexing import delete_module_embeddings
        success = delete_module_embeddings(module_id)
        if success:
            return {"message": f"Successfully deleted embeddings for module {module_id}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete embeddings")
    except Exception as e:
        logger.error(f"Error deleting module embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_document_embeddings/{doc_id}")
def delete_document_embeddings_endpoint(doc_id: int):
    """Delete all embeddings for a document"""
    try:
        from semantic_indexing import delete_document_embeddings
        success = delete_document_embeddings(doc_id)
        if success:
            return {"message": f"Successfully deleted embeddings for document {doc_id}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete embeddings")
    except Exception as e:
        logger.error(f"Error deleting document embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Save user config endpoint ---
@app.post("/api/save_user_config")
async def save_user_config(request: Request, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        data = await request.json()
        config = data.get("config")
        if not config:
            return {"success": False, "error": "No config provided"}
        conn = get_db_connection()
        conn.execute(
            "UPDATE users SET config = ? WHERE username = ?",
            (json.dumps(config), username)
        )
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={
        "error": "Something broke!",
        "details": str(exc)
    })

def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload["username"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/document_file/{module_id}/{filename}")
def get_document_file(module_id: int, filename: str):
    file_path = os.path.join(UPLOAD_DIR, str(module_id), filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.get("/api/document_text/{module_id}/{filename}")
async def get_document_text(module_id: int, filename: str, token: HTTPAuthorizationCredentials = Depends(security)):
    """Extract and return text content from documents for preview"""
    try:
        # Verify token
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        file_path = os.path.join(UPLOAD_DIR, str(module_id), filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        ext = pathlib.Path(filename).suffix.lower()
        
        if ext in {".doc", ".docx"}:
            # Extract text from Word document
            try:
                import docx
                doc = docx.Document(file_path)
                text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
                return {"success": True, "text": text, "file_type": "word"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to extract text from Word document: {str(e)}")
        
        elif ext == ".pdf":
            # Extract text from PDF
            try:
                from semantic_indexing import extract_text_and_images
                text, _ = extract_text_and_images(file_path)
                return {"success": True, "text": text, "file_type": "pdf"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(e)}")
        
        elif ext in {".txt", ".py", ".js", ".md", ".json", ".xml", ".csv"}:
            # Read plain text files
            try:
                text = pathlib.Path(file_path).read_text("utf-8", errors="ignore")
                return {"success": True, "text": text, "file_type": "text"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to read text file: {str(e)}")
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type for text extraction")
            
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Get user config endpoint ---
@app.get("/api/get_user_config")
async def get_user_config(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        conn = get_db_connection()
        user = conn.execute("SELECT config FROM users WHERE username = ?", (username,)).fetchone()
        conn.close()
        
        if user and user["config"]:
            config = json.loads(user["config"])
            return {"success": True, "config": config}
        else:
            # Return default config if none exists
            default_config = {
                "response_mode": "concise",
                "show_source": "Yes",
                "explanation_level": "intermediate",
                "language_tone": "neutral",
                "step_by_step_mode": "Off",
                "follow_up_suggestions": "Enabled",
                "ask_for_clarification": "Yes",
                "chat_persona": "Friendly"
            }
            return {"success": True, "config": default_config}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/user-info")
async def get_user_info(request: Request):
    """Get current user information"""
    user = get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    return {"user": user}

# --- Chat History Endpoints ---
@app.post("/api/chat/sessions")
async def create_chat_session(request: CreateSessionRequest, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, create_chat_session
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        session_id = create_chat_session(user_id, request.session_name)
        return {"success": True, "session_id": session_id}
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions")
async def get_chat_sessions(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, get_user_chat_sessions
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        sessions = get_user_chat_sessions(user_id)
        return {"success": True, "sessions": sessions}
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions/{session_id}/history")
async def get_session_history(session_id: int, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, get_chat_history
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify session belongs to user
        conn = get_db_connection()
        session = conn.execute("SELECT user_id FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        conn.close()
        
        if not session or session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        history = get_chat_history(session_id)
        return {"success": True, "history": history}
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/messages")
async def save_chat_message(request: SaveChatMessageRequest, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, add_chat_message
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify session belongs to user
        conn = get_db_connection()
        session = conn.execute("SELECT user_id FROM chat_sessions WHERE id = ?", (request.session_id,)).fetchone()
        conn.close()
        
        if not session or session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        add_chat_message(request.session_id, user_id, request.role, request.content)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving chat message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chat/sessions/{session_id}")
async def delete_session(session_id: int, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, delete_chat_session
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        delete_chat_session(session_id, user_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chat/sessions/{session_id}")
async def update_session(session_id: int, request: UpdateSessionNameRequest, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, update_session_name
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        update_session_name(session_id, user_id, request.session_name)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating session name: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chat/sessions/{session_id}/messages")
async def clear_session_messages(session_id: int, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        from db import get_user_id_by_username, clear_chat_messages
        user_id = get_user_id_by_username(username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")
        
        clear_chat_messages(session_id, user_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error clearing chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/create-global-admin")
async def create_global_admin(req: RegisterRequest, token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Verify the requester is a global admin
        payload = jwt.decode(token.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload["username"]
        
        # Check if the requesting user is a global admin
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE username = ?", (username,))
        user_data = cursor.fetchone()
        conn.close()
        
        if not user_data or user_data[0] != 1:
            raise HTTPException(status_code=403, detail="Only global admins can create other global admins")
        
        # Create the new global admin
        execute_with_retry(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (req.username, req.password, 1)  # Force role to 1 for global admin
        )

        return {"success": True, "message": "Global admin created successfully"}

    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        return {"success": False, "error": str(e)}
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from db import create_module, add_document

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/api/create_module")
async def api_create_module(
    name: str = Form(...),
    description: Optional[str] = Form(None)
):
    module_id = create_module(name, description)
    return {"success": True, "module_id": module_id}

@router.post("/api/upload")
async def upload_file(
    module_id: int = Form(...),
    title: str = Form(...),
    uploaded_by: Optional[str] = Form(None),
    team_id: Optional[int] = Form(None),
    file: UploadFile = File(...)
):
    try:
        # Create module directory if it doesn't exist
        module_dir = os.path.join(UPLOAD_DIR, str(module_id))
        os.makedirs(module_dir, exist_ok=True)

        # Save the uploaded file
        file_location = os.path.join(module_dir, file.filename)
        with open(file_location, "wb") as f:
            content = await file.read()
            f.write(content)

        # Save file info to the database
        doc_id = add_document(module_id, title, file_location, uploaded_by, team_id)

        return {"success": True, "file_path": file_location, "document_id": doc_id, "module_id": module_id}
    except Exception as e:
        # Log the error for debugging
        print(f"Error in upload_file: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}")

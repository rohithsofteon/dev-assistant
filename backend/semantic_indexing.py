"""
multimodal_rag_complete.py - Complete multimodal RAG with OpenAI + OpenCLIP
"""
from __future__ import annotations

import io, os, ssl, uuid, logging, pathlib, argparse, sys, textwrap, re
from dataclasses import dataclass
from typing import List, Optional, Sequence, Dict

import numpy as np
from PIL import Image
import fitz  # PyMuPDF
import docx
import tiktoken

import torch
import open_clip
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from openai import OpenAI
from dotenv import load_dotenv

# Configuration
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger("mmRAG")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
QDRANT_PATH = pathlib.Path(__file__).with_suffix("").parent / "qdrant_store"
COLL_NAME = "documents"
TXT_DIM = 1536
IMG_DIM = 512

OPENAI_EMB_MODEL = "text-embedding-3-small"
OPENAI_CHAT_MODEL = "gpt-3.5-turbo"

ALPHA_TEXT = 0.7  # weight for text space
BETA_IMAGE = 0.3  # weight for image space

# Global CLIP model variables
_clip_model = _clip_pre = _clip_tok = None

def _init_clip():
    """Initialize CLIP model for image and text embedding"""
    global _clip_model, _clip_pre, _clip_tok
    try:
        # Try to load from local checkpoint first
        ckpt = pathlib.Path(__file__).with_suffix("").parent / "models/clip-vit-base-patch32/open_clip_pytorch_model.bin"
        if ckpt.exists():
            log.info("Loading CLIP weights from local checkpoint...")
            _clip_model, _, _clip_pre = open_clip.create_model_and_transforms("ViT-B-32", pretrained=None)
            _clip_model.load_state_dict(torch.load(ckpt, map_location=DEVICE))
        else:
            # Download pretrained weights
            ssl._create_default_https_context = ssl._create_unverified_context
            log.info("Downloading CLIP weights...")
            _clip_model, _, _clip_pre = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
        
        _clip_tok = open_clip.get_tokenizer("ViT-B-32")
        _clip_model = _clip_model.to(DEVICE).eval()
        log.info("CLIP model initialized successfully")
    except Exception as e:
        log.warning(f"CLIP initialization failed - image retrieval disabled: {e}")
        _clip_model = _clip_pre = _clip_tok = None

# Initialize CLIP
_init_clip()

# Initialize OpenAI client
enc_tok = tiktoken.get_encoding("cl100k_base")
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def openai_embed(texts: Sequence[str]) -> List[List[float]]:
    """Batch embed using OpenAI API"""
    try:
        text_list = [str(t).strip() for t in texts if t and str(t).strip()]
        if not text_list:
            return [[] for _ in texts]
        
        response = openai_client.embeddings.create(
            model=OPENAI_EMB_MODEL,
            input=text_list,
            encoding_format="float"
        )
        embeds = [d.embedding for d in response.data]
        
        # Pad for any filtered-out texts
        while len(embeds) < len(texts):
            embeds.append([])
        return embeds
    except Exception as e:
        log.error(f"OpenAI embedding error: {e}")
        return [[] for _ in texts]

def clip_image_embed(image_bytes: bytes) -> Optional[List[float]]:
    """Embed image using CLIP"""
    if _clip_model is None:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_tensor = _clip_pre(img).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            image_features = _clip_model.encode_image(img_tensor)
            vec = image_features.cpu().squeeze().tolist()
        return vec
    except Exception as e:
        log.error(f"CLIP image embedding error: {e}")
        return None

def clip_text_embed(text: str) -> Optional[List[float]]:
    """Embed text using CLIP (for cross-modal retrieval)"""
    if _clip_model is None:
        return None
    try:
        text_tokens = _clip_tok([text]).to(DEVICE)
        with torch.no_grad():
            text_features = _clip_model.encode_text(text_tokens)
            vec = text_features.cpu().squeeze().tolist()
        return vec
    except Exception as e:
        log.error(f"CLIP text embedding error: {e}")
        return None

# Qdrant setup
def _get_qdrant_client():
    try:
        return QdrantClient(path=str(QDRANT_PATH))
    except RuntimeError as e:
        if "already accessed by another instance" in str(e):
            log.warning("Qdrant storage locked - retrying with force_disable_check_same_thread=True")
            return QdrantClient(path=str(QDRANT_PATH), force_disable_check_same_thread=True)
        raise

qdrant = _get_qdrant_client()

def _ensure_collection():
    """Ensure Qdrant collection exists with proper vector configuration"""
    collections = [c.name for c in qdrant.get_collections().collections]
    if COLL_NAME not in collections:
        log.info("Creating Qdrant collection...")
        qdrant.recreate_collection(
            collection_name=COLL_NAME,
            vectors_config={
                "text": qmodels.VectorParams(size=TXT_DIM, distance="Cosine"),
                "image": qmodels.VectorParams(size=IMG_DIM, distance="Cosine"),
            },
        )
        return
    
    # Check if collection has correct vector config
    cfg = qdrant.get_collection(COLL_NAME).config.params.vectors
    if not (isinstance(cfg, dict) and cfg.get("text") and cfg.get("image")):
        log.warning("Collection has wrong vector config - recreating...")
        qdrant.recreate_collection(
            collection_name=COLL_NAME,
            vectors_config={
                "text": qmodels.VectorParams(size=TXT_DIM, distance="Cosine"),
                "image": qmodels.VectorParams(size=IMG_DIM, distance="Cosine"),
            },
        )

_ensure_collection()

# Data structures
@dataclass
class Chunk:
    text: str
    entities: List[str]
    chunk_id: str

def _extract_text_images(file_path: str) -> tuple[str, List[bytes]]:
    """Extract text and images from various file formats"""
    ext = pathlib.Path(file_path).suffix.lower()
    text, images = "", []
    
    if ext == ".pdf":
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text()
            # Extract images
            for img in page.get_images(full=True):
                try:
                    image_data = doc.extract_image(img[0])["image"]
                    images.append(image_data)
                except Exception as e:
                    log.warning(f"Failed to extract image: {e}")
        doc.close()
    
    elif ext in {".doc", ".docx"}:
        doc = docx.Document(file_path)
        text += "\n".join(paragraph.text for paragraph in doc.paragraphs)
        # Extract images from relationships
        for rel in doc.part.rels.values():
            if "image" in rel.target_ref:
                try:
                    images.append(rel.target_part.blob)
                except Exception as e:
                    log.warning(f"Failed to extract image from docx: {e}")
    
    else:
        # Plain text file
        text = pathlib.Path(file_path).read_text("utf-8", errors="ignore")
    
    return text, images

def _simple_entities(text: str) -> List[str]:
    """Extract simple entities using regex patterns"""
    entities = set()
    # Capitalized words and acronyms
    for match in re.finditer(r"[A-Z][a-z]+[A-Za-z0-9_]*|[A-Z0-9_]{2,}", text):
        entities.add(match.group(0))
    return list(entities)

def _sentence_chunk(text: str, max_tokens: int = 200) -> List[Chunk]:
    """Sentence-aware chunking that prioritizes single-fact isolation"""
    lines = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        
        # Split into sentences first
        sentences = [s.strip() for s in re.split(r"[.?!]", paragraph) if s.strip()]
        
        # For each sentence, check if it's a standalone fact
        for sentence in sentences:
            entities_in_sentence = _simple_entities(sentence)
            
            # If sentence has 1-2 entities and is short, keep it isolated
            if len(entities_in_sentence) <= 2 and len(sentence.split()) <= 15:
                lines.append(sentence)  # Isolate single facts
            else:
                # For longer sentences, split further if possible
                # Look for comma-separated clauses
                clauses = [c.strip() for c in sentence.split(',') if c.strip()]
                if len(clauses) > 1:
                    lines.extend(clauses)
                else:
                    lines.append(sentence)
    
    chunks = []
    current_chunk = []
    current_tokens = 0
    
    for sentence in lines:
        sentence_tokens = len(enc_tok.encode(sentence))
        
        # Be more aggressive about creating smaller chunks
        if current_tokens + sentence_tokens > max_tokens and current_chunk:
            # Finalize current chunk
            chunk_text = " ".join(current_chunk)
            chunks.append(Chunk(
                text=chunk_text,
                entities=_simple_entities(chunk_text),
                chunk_id=str(uuid.uuid4())
            ))
            current_chunk = []
            current_tokens = 0
        
        current_chunk.append(sentence)
        current_tokens += sentence_tokens
        
        # For very important single facts, create individual chunks
        sentence_entities = _simple_entities(sentence)
        if len(sentence_entities) == 1 and len(sentence.split()) <= 10:
            # This looks like a single important fact, isolate it
            if current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append(Chunk(
                    text=chunk_text,
                    entities=_simple_entities(chunk_text),
                    chunk_id=str(uuid.uuid4())
                ))
                current_chunk = []
                current_tokens = 0
    
    # Handle remaining content
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append(Chunk(
            text=chunk_text,
            entities=_simple_entities(chunk_text),
            chunk_id=str(uuid.uuid4())
        ))
    
    return chunks

def _embed_and_upsert(chunks: List[Chunk], images: List[bytes], doc_id: str, module_id: int, doc_title: str):
    """Embed chunks and images, then upsert to Qdrant"""
    valid_chunks = [c for c in chunks if c.text.strip()]
    if not valid_chunks and not images:
        return
    
    # Embed text chunks
    text_vectors = openai_embed([c.text for c in valid_chunks])
    points = []
    
    # Add text points
    for chunk, vector in zip(valid_chunks, text_vectors):
        if vector:  # Only add if embedding was successful
            points.append(qmodels.PointStruct(
                id=chunk.chunk_id,
                vector={"text": vector},
                payload={
                    "type": "text",
                    "text": chunk.text,
                    "ents": chunk.entities,
                    "doc_id": doc_id,
                    "doc_title": doc_title,
                    "module_id": module_id,
                },
            ))
    
    # Add image points
    for image_bytes in images:
        image_vector = clip_image_embed(image_bytes)
        if image_vector is not None:
            points.append(qmodels.PointStruct(
                id=str(uuid.uuid4()),
                vector={"image": image_vector},
                payload={
                    "type": "image",
                    "image": image_bytes.hex(),
                    "doc_id": doc_id,
                    "doc_title": doc_title,
                    "module_id": module_id,
                },
            ))
    
    # Upsert to Qdrant
    if points:
        qdrant.upsert(collection_name=COLL_NAME, points=points)

def ingest(file_path: str, doc_id: Optional[str] = None, module_id: int = 0, doc_title: Optional[str] = None):
    """Main ingestion function"""
    doc_id = doc_id or str(uuid.uuid4())
    # Use doc_title if provided, otherwise extract filename from path
    if doc_title is None:
        doc_title = pathlib.Path(file_path).name
    
    log.info(f"Ingesting {file_path} (doc_id={doc_id}, module={module_id}, title={doc_title})...")
    
    text, images = _extract_text_images(file_path)
    chunks = _sentence_chunk(text)
    _embed_and_upsert(chunks, images, doc_id, module_id, doc_title)
    
    log.info(f"Indexed {len(chunks)} chunks + {len(images)} images")

def _keyword_filter(query: str) -> qmodels.Filter | None:
    """Create entity-based filter for retrieval"""
    entities = _simple_entities(query)
    if not entities:
        return None
    return qmodels.Filter(
        should=[qmodels.FieldCondition(key="ents", match=qmodels.MatchAny(any=entities))]
    )

def retrieve(query: str, *, top_k: int = 5, module_id: int | None = None) -> List[Dict]:
    """Retrieve relevant chunks using multimodal search"""
    query = str(query).strip()
    
    # Get embeddings
    text_vector = openai_embed([query])[0]
    image_vector = clip_text_embed(query)  # Cross-modal: text query for images
    
    # Create filters
    entity_filter = _keyword_filter(query)
    if module_id is not None:
        module_condition = qmodels.FieldCondition(key="module_id", match=qmodels.MatchValue(value=int(module_id)))
        if entity_filter:
            final_filter = qmodels.Filter(must=[module_condition], should=entity_filter.should)
        else:
            final_filter = qmodels.Filter(must=[module_condition])
    else:
        final_filter = entity_filter
    
    # Search text space
    text_hits = []
    if text_vector:
        text_hits = qdrant.search(
            collection_name=COLL_NAME,
            query_vector=("text", text_vector),
            query_filter=final_filter,
            limit=top_k * 2,
            with_payload=True
        )
    
    # Search image space
    image_hits = []
    if image_vector is not None:
        image_hits = qdrant.search(
            collection_name=COLL_NAME,
            query_vector=("image", image_vector),
            query_filter=final_filter,
            limit=top_k * 2,
            with_payload=True
        )
    
    # Fuse results
    fused_results = {}
    for hit in text_hits:
        fused_results[hit.id] = {
            "score": ALPHA_TEXT * hit.score,
            "payload": hit.payload
        }
    
    for hit in image_hits:
        if hit.id in fused_results:
            fused_results[hit.id]["score"] += BETA_IMAGE * hit.score
        else:
            fused_results[hit.id] = {
                "score": BETA_IMAGE * hit.score,
                "payload": hit.payload
            }
    
    # Sort by fused score and return top-k
    sorted_results = sorted(fused_results.values(), key=lambda x: x["score"], reverse=True)
    return sorted_results[:top_k]

def _build_system_prompt(config: dict) -> str:
    """Build system prompt based on user configuration"""
    persona_map = {
        'Friendly': 'friendly and approachable',
        'Professional': 'professional and formal',
        'Creative': 'creative and engaging'
    }
    
    persona = persona_map.get(config.get('chat_persona', 'Friendly'), 'friendly and approachable')
    
    return f"""You are a helpful technical assistant with a {persona} tone.
You must answer strictly based on the provided context.
CRITICAL RULES:
1. Only use information from a SINGLE chunk to answer the question
2. Never combine or merge facts from different chunks 
3. Never infer relationships between entities unless they appear in the SAME chunk
4. If the exact answer is not in ONE chunk, respond: 'Sorry, I dont have enough information to provide the answer.'
5. Focus only on the chunk that DIRECTLY answers the question
6. NEVER include source information in your response - just provide the answer

Do not add extra symbols or characters. Only return the grounded factual answer from ONE chunk."""

def answer(query: str, *, top_k: int = 5, module_id: int | None = None, 
          user_config: dict | None = None, chat_history: list | None = None) -> str:
    """Answer questions using the multimodal RAG system"""
    query = str(query).strip()
    
    # Handle greetings
    if query.lower() in {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!'}:
        return "Hello! How can I help you today?"
    
    # Default configuration
    config = user_config or {
        'response_mode': 'concise',
        'show_source': 'Yes',
        'chat_persona': 'Friendly',
    }
    
    # Retrieve relevant chunks
    hits = retrieve(query, top_k=top_k, module_id=module_id)
    
    # Post-filter by entity match - be more strict
    query_entities = _simple_entities(query)
    if query_entities:
        query_entities_lower = [ent.lower() for ent in query_entities]
        filtered_hits = []
        for hit in hits:
            chunk_entities = hit['payload'].get('ents', [])
            chunk_entities_lower = [e.lower() for e in chunk_entities]
            # Check if the chunk actually contains the query entities in the text
            chunk_text = hit['payload'].get('text', '').lower()
            if any(ent in chunk_entities_lower and ent in chunk_text for ent in query_entities_lower):
                filtered_hits.append(hit)
        hits = filtered_hits
        
        # Additional filtering: prioritize chunks where the question entity appears early in the text
        if len(hits) > 1:
            scored_hits = []
            for hit in hits:
                chunk_text = hit['payload'].get('text', '').lower()
                # Score based on how early the entity appears in the chunk
                min_position = len(chunk_text)
                for ent in query_entities_lower:
                    pos = chunk_text.find(ent)
                    if pos != -1 and pos < min_position:
                        min_position = pos
                scored_hits.append((min_position, hit))
            
            # Sort by position and take top chunks
            scored_hits.sort(key=lambda x: x[0])
            hits = [hit for _, hit in scored_hits[:2]]  # Limit to top 2 most relevant
    
    if not hits:
        return "I don't know from the docs."
    
    # Build context
    context_parts = []
    source_docs = set()
    for i, hit in enumerate(hits):
        payload = hit['payload']
        # Try to get doc_title, fallback to a more descriptive name
        doc_title = payload.get('doc_title')
        if not doc_title:
            # If no doc_title, try to create a meaningful name from doc_id
            doc_id = payload.get('doc_id', 'Unknown')
            doc_title = _get_doc_title_from_db(str(doc_id))
        
        source_docs.add(doc_title)
        
        if payload['type'] == 'text':
            context_parts.append(f"[Chunk {i+1} | {doc_title}]\n{payload['text']}")
        else:
            context_parts.append(f"[Chunk {i+1} | {doc_title}]\n[Image context]")
    
    context = "\n\n".join(context_parts)[:6000]  # Limit context size
    
    # Build messages
    system_prompt = _build_system_prompt(config)
    messages = [{"role": "system", "content": system_prompt}]
    
    if chat_history:
        messages.extend(chat_history[-6:])  # Keep last 6 messages
    
    messages.append({
        "role": "user", 
        "content": f"Context:\n{context}\n\nQuestion: {query}"
    })
    
    # Generate response
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=400,
        )
        
        answer_text = response.choices[0].message.content.strip()
        
        # Add source information only if not already present
        if config.get('show_source') == 'Yes':
            source_list = [str(doc) for doc in source_docs]
            source_text = "\n\nSource: " + ", ".join(sorted(source_list))
            # Check if source is already in the answer to avoid duplication
            if "Source:" not in answer_text:
                answer_text += source_text
        
        return answer_text
        
    except Exception as e:
        log.error(f"ChatCompletion error: {e}")
        return "LLM generation failed."

# FastAPI compatibility functions
def answer_question(question: str, module_id: int | None = None) -> str:
    """Simple answer function for FastAPI compatibility (non-streaming)"""
    return answer(question, module_id=module_id)

def answer_question_stream(question: str, module_id: int | None = None, 
                          user_config: dict | None = None, chat_history: list | None = None):
    """Streaming answer function for FastAPI compatibility"""
    query = str(question).strip()
    
    # Handle greetings
    if query.lower() in {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!'}:
        yield "Hello! How can I help you today?"
        return
    
    # Default configuration
    config = user_config or {
        'response_mode': 'concise',
        'show_source': 'Yes',
        'chat_persona': 'Friendly',
    }
    
    # Retrieve relevant chunks
    hits = retrieve(query, top_k=5, module_id=module_id)
    
    # Post-filter by entity match - be more strict
    query_entities = _simple_entities(query)
    if query_entities:
        query_entities_lower = [ent.lower() for ent in query_entities]
        filtered_hits = []
        for hit in hits:
            chunk_entities = hit['payload'].get('ents', [])
            chunk_entities_lower = [e.lower() for e in chunk_entities]
            # Check if the chunk actually contains the query entities in the text
            chunk_text = hit['payload'].get('text', '').lower()
            if any(ent in chunk_entities_lower and ent in chunk_text for ent in query_entities_lower):
                filtered_hits.append(hit)
        hits = filtered_hits
        
        # Additional filtering: prioritize chunks where the question entity appears early in the text
        if len(hits) > 1:
            scored_hits = []
            for hit in hits:
                chunk_text = hit['payload'].get('text', '').lower()
                # Score based on how early the entity appears in the chunk
                min_position = len(chunk_text)
                for ent in query_entities_lower:
                    pos = chunk_text.find(ent)
                    if pos != -1 and pos < min_position:
                        min_position = pos
                scored_hits.append((min_position, hit))
            
            # Sort by position and take top chunks
            scored_hits.sort(key=lambda x: x[0])
            hits = [hit for _, hit in scored_hits[:2]]  # Limit to top 2 most relevant
    
    if not hits:
        yield "Sorry, I don't have enough information to answer that."
        return
    
    # Build context
    context_parts = []
    source_docs = set()
    for i, hit in enumerate(hits):
        payload = hit['payload']
        # Try to get doc_title, fallback to a more descriptive name
        doc_title = payload.get('doc_title')
        if not doc_title:
            # If no doc_title, try to create a meaningful name from doc_id
            doc_id = payload.get('doc_id', 'Unknown')
            doc_title = _get_doc_title_from_db(str(doc_id))
        
        source_docs.add(doc_title)
        
        if payload['type'] == 'text':
            context_parts.append(f"[Chunk {i+1} | {doc_title}]\n{payload['text']}")
        else:
            context_parts.append(f"[Chunk {i+1} | {doc_title}]\n[Image context]")
    
    context = "\n\n".join(context_parts)[:6000]  # Limit context size
    
    # Build messages
    system_prompt = _build_system_prompt(config)
    messages = [{"role": "system", "content": system_prompt}]
    
    if chat_history:
        messages.extend(chat_history[-6:])  # Keep last 6 messages
    
    messages.append({
        "role": "user", 
        "content": f"Context:\n{context}\n\nQuestion: {query}"
    })
    
    # Generate streaming response
    try:
        stream = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=400,
            stream=True,  # Enable streaming
        )
        
        answer_chunks = []
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                content = chunk.choices[0].delta.content
                answer_chunks.append(content)
                yield content
        
        # Add source information at the end, but only if not already present
        if config.get('show_source') == 'Yes':
            # Check if "Source:" is already in the full response
            full_response = "".join(answer_chunks)
            if "Source:" not in full_response:
                source_list = [str(doc) for doc in source_docs]
                source_text = "\n\nSource: " + ", ".join(sorted(source_list))
                yield source_text
        
    except Exception as e:
        log.error(f"Streaming ChatCompletion error: {e}")
        yield "LLM generation failed."

# CLI interface
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Multimodal RAG with OpenAI + OpenCLIP")
    parser.add_argument("--ingest", metavar="FILE", help="File to ingest (pdf/docx/txt)")
    parser.add_argument("--query", metavar="QUESTION", help="Ask a question")
    parser.add_argument("--module", type=int, default=0, help="Module ID (default: 0)")
    args = parser.parse_args()
    
    if args.ingest:
        if not pathlib.Path(args.ingest).exists():
            sys.exit("File not found")
        ingest(args.ingest, module_id=args.module)
    
    if args.query:
        result = answer(args.query, module_id=args.module)
        print(textwrap.fill(result, width=100))
    
    if not args.ingest and not args.query:
        print("Usage examples:")
        print("  python multimodal_rag.py --ingest document.pdf")
        print("  python multimodal_rag.py --query 'What is the main topic?'")
def _get_doc_title_from_db(doc_id: str) -> str:
    """Get document title from database using doc_id"""
    try:
        # Import here to avoid circular imports
        import sqlite3
        import pathlib
        
        db_path = pathlib.Path(__file__).parent / "DEV_USERS.db"
        if not db_path.exists():
            return f"Document_{doc_id}"
            
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Query for document title using doc_id
        cursor.execute("SELECT title FROM documents WHERE document_id = ?", (doc_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result and result['title']:
            return result['title']
        else:
            return f"Document_{doc_id}"
            
    except Exception as e:
        log.warning(f"Failed to get document title from database: {e}")
        return f"Document_{doc_id}"
"""
multimodal_rag_complete.py - Complete multimodal RAG with OpenAI + OpenCLIP
Fixed version addressing retrieval and filtering issues
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

def _enhanced_entities(text: str) -> List[str]:
    """Enhanced entity extraction with better patterns"""
    entities = set()
    
    # Original patterns - capitalized words and acronyms
    for match in re.finditer(r"[A-Z][a-z]+[A-Za-z0-9_]*|[A-Z0-9_]{2,}", text):
        entities.add(match.group(0))
    
    # Technical terms and endpoints
    for match in re.finditer(r"(?:GET|POST|PUT|DELETE|PATCH)\s+[/\w\-:]+", text):
        entities.add(match.group(0))
    
    # URLs and endpoints
    for match in re.finditer(r"/[/\w\-:]+", text):
        entities.add(match.group(0))
    
    # Technical keywords
    tech_keywords = [
        "endpoint", "endpoints", "API", "backend", "frontend", "database",
        "service", "server", "client", "authentication", "authorization",
        "register", "login", "profile", "update", "tech stack", "technology"
    ]
    
    text_lower = text.lower()
    for keyword in tech_keywords:
        if keyword.lower() in text_lower:
            entities.add(keyword)
    
    return list(entities)

def _sentence_chunk(text: str, max_tokens: int = 150) -> List[Chunk]:
    """Improved sentence-aware chunking with better context preservation"""
    lines = []
    
    # Split by paragraphs first
    paragraphs = text.split("\n")
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        
        # Check if paragraph contains endpoints or technical lists
        if any(keyword in paragraph.lower() for keyword in ["endpoint", "api", "post", "get", "put", "delete", "patch"]):
            # Keep technical sections together
            lines.append(paragraph)
        else:
            # Split into sentences for regular text
            sentences = [s.strip() for s in re.split(r"[.?!]", paragraph) if s.strip()]
            lines.extend(sentences)
    
    chunks = []
    current_chunk = []
    current_tokens = 0
    
    for line in lines:
        line_tokens = len(enc_tok.encode(line))
        
        # If adding this line would exceed max tokens, create a new chunk
        if current_tokens + line_tokens > max_tokens and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append(Chunk(
                text=chunk_text,
                entities=_enhanced_entities(chunk_text),
                chunk_id=str(uuid.uuid4())
            ))
            current_chunk = []
            current_tokens = 0
        
        current_chunk.append(line)
        current_tokens += line_tokens
    
    # Handle remaining content
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append(Chunk(
            text=chunk_text,
            entities=_enhanced_entities(chunk_text),
            chunk_id=str(uuid.uuid4())
        ))
    
    return chunks

def _embed_and_upsert(chunks: List[Chunk], images: List[bytes], doc_id: str, module_id: int, doc_title: str, team_id: int | None = None):
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
                    "team_id": team_id,
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
                    "team_id": team_id,
                },
            ))

    # Upsert to Qdrant
    if points:
        qdrant.upsert(collection_name=COLL_NAME, points=points)

def ingest(file_path: str, doc_id: Optional[str] = None, module_id: int = 0, doc_title: Optional[str] = None, team_id: int | None = None):
    """Main ingestion function"""
    doc_id = doc_id or str(uuid.uuid4())
    # Use doc_title if provided, otherwise extract filename from path
    if doc_title is None:
        doc_title = pathlib.Path(file_path).name
    
    # If team_id is not provided, try to get it from the database using module_id
    if team_id is None and module_id:
        try:
            from db import get_db_connection
            conn = get_db_connection()
            result = conn.execute("SELECT team_id FROM module WHERE module_id = ?", (module_id,)).fetchone()
            conn.close()
            if result:
                team_id = result["team_id"] if result["team_id"] is not None else None
                log.info(f"Retrieved team_id {team_id} for module_id {module_id}")
        except Exception as e:
            log.warning(f"Could not retrieve team_id for module_id {module_id}: {e}")
    
    log.info(f"Ingesting {file_path} (doc_id={doc_id}, module={module_id}, team={team_id}, title={doc_title})...")
    
    text, images = _extract_text_images(file_path)
    chunks = _sentence_chunk(text)
    _embed_and_upsert(chunks, images, doc_id, module_id, doc_title, team_id)
    
    log.info(f"Indexed {len(chunks)} chunks + {len(images)} images")

def _improved_keyword_filter(query: str) -> qmodels.Filter | None:
    """Improved keyword-based filter for retrieval"""
    entities = _enhanced_entities(query)
    
    # Add query words as potential keywords
    query_words = [word.lower() for word in query.split() if len(word) > 2]
    entities.extend(query_words)
    
    if not entities:
        return None
    
    return qmodels.Filter(
        should=[qmodels.FieldCondition(key="ents", match=qmodels.MatchAny(any=entities))]
    )

def retrieve(query: str, *, top_k: int = 8, module_id: int | None = None, 
            team_id: int | None = None, user_team_ids: list | None = None) -> List[Dict]:
    """Retrieve relevant chunks using multimodal search with improved filtering and strict team/module isolation"""
    query = str(query).strip()
    log.info(f"Retrieving for query: '{query}' with top_k={top_k}, module_id={module_id}, team_id={team_id}, user_team_ids={user_team_ids}")
    
    # Get embeddings
    text_vector = openai_embed([query])[0]
    image_vector = clip_text_embed(query)  # Cross-modal: text query for images
    
    # Create filters - make entity filter less restrictive
    entity_filter = _improved_keyword_filter(query)
    
    # Build access control filters - STRICT isolation for teams and modules
    access_conditions = []
    
    # STRICT MODULE ISOLATION: If module_id is specified, ONLY return results from that module
    if module_id is not None:
        access_conditions.append(qmodels.FieldCondition(key="module_id", match=qmodels.MatchValue(value=int(module_id))))
        log.info(f"STRICT module filter applied: module_id={module_id}")
    
    # STRICT TEAM ISOLATION: If team_id is specified, ONLY return results from that team
    elif team_id is not None:
        access_conditions.append(qmodels.FieldCondition(key="team_id", match=qmodels.MatchValue(value=int(team_id))))
        log.info(f"STRICT team filter applied: team_id={team_id}")
    
    # USER TEAM ISOLATION: For general queries, restrict to user's teams only
    elif user_team_ids is not None and len(user_team_ids) > 0:
        # Use MatchAny to search across multiple teams that the user belongs to
        team_values = [int(tid) for tid in user_team_ids]
        access_conditions.append(qmodels.FieldCondition(key="team_id", match=qmodels.MatchAny(any=team_values)))
        log.info(f"USER team filter applied: user_team_ids={team_values}")
    
    # Build final filter with mandatory access control
    if access_conditions:
        if entity_filter:
            final_filter = qmodels.Filter(must=access_conditions, should=entity_filter.should)
        else:
            final_filter = qmodels.Filter(must=access_conditions)
    else:
        final_filter = entity_filter
        log.warning("No module_id, team_id, or user_team_ids specified - searching across all accessible documents")
    
    # Search text space with higher limit
    text_hits = []
    if text_vector:
        text_hits = qdrant.search(
            collection_name=COLL_NAME,
            query_vector=("text", text_vector),
            query_filter=final_filter,
            limit=top_k * 3,  # Get more candidates
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
    
    # Broader search without entity filter if not enough results
    # BUT ALWAYS preserve ALL access control filters for strict team/module isolation
    if len(text_hits) < 3 and access_conditions:
        log.info("Trying broader search without entity filter but maintaining strict access control...")
        # ALWAYS preserve access control filters - NEVER remove team/module isolation
        broader_filter = qmodels.Filter(must=access_conditions)
        
        broader_hits = qdrant.search(
            collection_name=COLL_NAME,
            query_vector=("text", text_vector),
            query_filter=broader_filter,
            limit=top_k * 2,
            with_payload=True
        )
        
        # Merge results, avoiding duplicates
        existing_ids = {hit.id for hit in text_hits}
        for hit in broader_hits:
            if hit.id not in existing_ids:
                text_hits.append(hit)
    # If no access_conditions (no module/team specified), we already did the broadest possible search above
    
    log.info(f"Found {len(text_hits)} text hits and {len(image_hits)} image hits")
    
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
    
    explanation_map = {
        'beginner': 'Explain in simple terms with analogies or examples.',
        'intermediate': 'Explain clearly with moderate technical detail.',
        'expert': 'Use precise and technical language for an expert audience.'
    }
    
    tone_map = {
        'formal': 'Use a professional tone.',
        'casual': 'Use a relaxed and friendly tone.',
        'neutral': 'Use a balanced and neutral tone.'
    }
    
    persona = persona_map.get(config.get('chat_persona', 'Friendly'), 'friendly and approachable')
    explanation_level = explanation_map.get(config.get('explanation_level', 'intermediate'), 'Explain clearly with moderate technical detail.')
    language_tone = tone_map.get(config.get('language_tone', 'neutral'), 'Use a balanced and neutral tone.')
    
    # Build base prompt
    prompt_parts = [
        f"You are a helpful technical assistant with a {persona} tone.",
        "Answer questions based on the provided context from the document chunks.",
        "",
        "RULES:",
        "1. Use the information from the provided chunks to answer the question",
        "2. If you find relevant information in the chunks, provide a comprehensive answer",
        "3. If you can't find specific information in the chunks, say \"I don't have enough information to answer that question.\"",
        "4. Be accurate and don't make up information not present in the chunks",
        "5. You can combine information from multiple chunks if they're related to the same topic",
        "",
        f"EXPLANATION STYLE: {explanation_level}",
        f"TONE: {language_tone}"
    ]
    
    # Add step-by-step instruction if enabled
    if config.get('step_by_step_mode', 'Off') == 'On':
        prompt_parts.append("FORMATTING: Break down complex answers step by step.")
    
    # Add follow-up suggestions instruction if enabled
    if config.get('follow_up_suggestions', 'Disabled') == 'Enabled':
        prompt_parts.append("FOLLOW-UP: At the end of your answer, suggest 2-3 related follow-up questions the user might ask.")
    
    prompt_parts.append("\nFocus on providing helpful, accurate answers based on the document content.")
    
    return "\n".join(prompt_parts)

def answer(query: str, *, top_k: int = 8, module_id: int | None = None, team_id: int | None = None,
          user_config: dict | None = None, chat_history: list | None = None, 
          user_team_ids: list | None = None, use_general_llm: bool = False) -> str:
    """Answer questions using the multimodal RAG system with strict team/module isolation"""
    query = str(query).strip()
    log.info(f"Answering query: '{query}' for module_id: {module_id}, team_id: {team_id}, user_team_ids: {user_team_ids}, use_general_llm: {use_general_llm}")
    
    # Handle greetings
    if query.lower() in {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!'}:
        return "Hello! How can I help you today?"
    
    # Default configuration
    config = user_config or {
        'response_mode': 'concise',
        'show_source': 'Yes',
        'chat_persona': 'Friendly',
        'explanation_level': 'intermediate',
        'language_tone': 'neutral',
        'step_by_step_mode': 'Off',
        'follow_up_suggestions': 'Disabled',
    }
    
    # If user wants general LLM answer (bypassing document search), call LLM directly
    if use_general_llm:
        log.info("Using general LLM without document context as requested by user")
        return _call_general_llm(query, config, chat_history)
    
    # Retrieve relevant chunks with strict isolation
    hits = retrieve(query, top_k=top_k, module_id=module_id, team_id=team_id, user_team_ids=user_team_ids)
    log.info(f"Retrieved {len(hits)} chunks for query")
    
    # Define relevance thresholds
    MIN_CHUNK_COUNT = 1  # Minimum number of chunks needed
    MIN_RELEVANCE_SCORE = 0  # Minimum relevance score for chunks
    
    # Filter chunks by relevance score and count
    relevant_chunks = [hit for hit in hits if hit['score'] >= MIN_RELEVANCE_SCORE]
    log.info(f"Found {len(relevant_chunks)} chunks with relevance score >= {MIN_RELEVANCE_SCORE}")
    
    # Check if we have sufficient relevant chunks
    if len(relevant_chunks) < MIN_CHUNK_COUNT:
        filter_context = ""
        if module_id:
            filter_context = f" in the selected module"
        elif team_id or user_team_ids:
            filter_context = f" in the selected team"
        
        log.info(f"Insufficient relevant chunks ({len(relevant_chunks)}) for filtered query")
        return f"No relevant information found{filter_context} for your question. Would you like me to provide a general answer instead? (Please reply 'yes' if you want a general response)"
    
    # Less aggressive filtering - use semantic similarity and keyword matching
    query_lower = query.lower()
    query_keywords = set(query_lower.split())
    
    # Score chunks based on content relevance - use relevant_chunks instead of hits
    scored_hits = []
    for hit in relevant_chunks:
        payload = hit['payload']
        if payload['type'] == 'text':
            chunk_text = payload['text'].lower()
            
            # Calculate relevance score
            relevance_score = 0
            
            # Keyword matching
            for keyword in query_keywords:
                if keyword in chunk_text:
                    relevance_score += 1
            
            # Special scoring for technical terms
            if any(term in query_lower for term in ['endpoint', 'api', 'backend']) and \
               any(term in chunk_text for term in ['endpoint', 'api', 'post', 'get', 'put', 'delete', 'patch']):
                relevance_score += 3
            
            # Boost score with vector similarity
            final_score = hit['score'] + (relevance_score * 0.1)
            scored_hits.append((final_score, hit))
    
    # Sort by relevance and take top chunks
    scored_hits.sort(key=lambda x: x[0], reverse=True)
    hits = [hit for _, hit in scored_hits[:top_k]]
    
    if not hits:
        return "I don't have enough information to answer that question."
    
    # Build context
    context_parts = []
    source_docs = set()
    for i, hit in enumerate(hits):
        payload = hit['payload']
        doc_title = payload.get('doc_title', 'Unknown Document')
        source_docs.add(doc_title)
        
        if payload['type'] == 'text':
            context_parts.append(f"[Chunk {i+1}]\n{payload['text']}")
        else:
            context_parts.append(f"[Chunk {i+1}]\n[Image context]")
    
    context = "\n\n".join(context_parts)[:8000]  # Increase context limit
    
    # Build messages
    system_prompt = _build_system_prompt(config)
    messages = [{"role": "system", "content": system_prompt}]
    
    if chat_history:
        messages.extend(chat_history[-6:])  # Keep last 6 messages
    
    messages.append({
        "role": "user", 
        "content": f"Context from documents:\n{context}\n\nQuestion: {query}"
    })
    
    # Generate response
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.5,
            max_tokens=1000,
        )
        
        answer_text = response.choices[0].message.content.strip()
        
        # Add source information
        if config.get('show_source') == 'Yes' and answer_text != "I don't have enough information to answer that question.":
            source_list = [str(doc) for doc in source_docs]
            source_text = "\n\nSource: " + ", ".join(sorted(source_list))
            if "Source:" not in answer_text:
                answer_text += source_text
        
        return answer_text
        
    except Exception as e:
        log.error(f"ChatCompletion error: {e}")
        return "LLM generation failed."

def _call_general_llm(query: str, config: dict, chat_history: list | None = None) -> str:
    """Call LLM directly without document context for general questions"""
    try:
        # Build system prompt for general queries
        persona_map = {
            'Friendly': 'friendly and approachable',
            'Professional': 'professional and formal',
            'Creative': 'creative and engaging'
        }
        
        explanation_map = {
            'beginner': 'Explain in simple terms with analogies or examples.',
            'intermediate': 'Explain clearly with moderate technical detail.',
            'expert': 'Use precise and technical language for an expert audience.'
        }
        
        tone_map = {
            'formal': 'Use a professional tone.',
            'casual': 'Use a relaxed and friendly tone.',
            'neutral': 'Use a balanced and neutral tone.'
        }
        
        persona = persona_map.get(config.get('chat_persona', 'Friendly'), 'friendly and approachable')
        explanation_level = explanation_map.get(config.get('explanation_level', 'intermediate'), 'Explain clearly with moderate technical detail.')
        language_tone = tone_map.get(config.get('language_tone', 'neutral'), 'Use a balanced and neutral tone.')
        
        # Build system prompt
        prompt_parts = [
            f"You are a helpful assistant with a {persona} tone.",
            "Since no relevant information was found in the available documents, please provide a general answer to the user's question based on your knowledge.",
            "",
            f"EXPLANATION STYLE: {explanation_level}",
            f"TONE: {language_tone}"
        ]
        
        # Add step-by-step instruction if enabled
        if config.get('step_by_step_mode', 'Off') == 'On':
            prompt_parts.append("FORMATTING: Break down complex answers step by step.")
        
        # Add follow-up suggestions instruction if enabled
        if config.get('follow_up_suggestions', 'Disabled') == 'Enabled':
            prompt_parts.append("FOLLOW-UP: At the end of your answer, suggest 2-3 related follow-up questions the user might ask.")
        
        prompt_parts.append("\nIMPORTANT: Always mention that this answer is not based on the available documents but on general knowledge.")
        
        system_prompt = "\n".join(prompt_parts)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        if chat_history:
            messages.extend(chat_history[-6:])  # Keep last 6 messages
        
        messages.append({
            "role": "user", 
            "content": f"Question: {query}\n\nNote: No relevant information was found in the available documents. Please provide a general answer based on your knowledge."
        })
        
        response = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.3,  # Slightly higher temperature for general knowledge
            max_tokens=10000,
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        log.error(f"General LLM call error: {e}")
        return "I apologize, but I'm unable to provide an answer at the moment due to a technical issue."

def _call_general_llm_stream(query: str, config: dict, chat_history: list | None = None):
    """Stream general LLM response without document context"""
    try:
        # Build system prompt for general queries
        persona_map = {
            'Friendly': 'friendly and approachable',
            'Professional': 'professional and formal',
            'Creative': 'creative and engaging'
        }
        
        explanation_map = {
            'beginner': 'Explain in simple terms with analogies or examples.',
            'intermediate': 'Explain clearly with moderate technical detail.',
            'expert': 'Use precise and technical language for an expert audience.'
        }
        
        tone_map = {
            'formal': 'Use a professional tone.',
            'casual': 'Use a relaxed and friendly tone.',
            'neutral': 'Use a balanced and neutral tone.'
        }
        
        persona = persona_map.get(config.get('chat_persona', 'Friendly'), 'friendly and approachable')
        explanation_level = explanation_map.get(config.get('explanation_level', 'intermediate'), 'Explain clearly with moderate technical detail.')
        language_tone = tone_map.get(config.get('language_tone', 'neutral'), 'Use a balanced and neutral tone.')
        
        # Build system prompt
        prompt_parts = [
            f"You are a helpful assistant with a {persona} tone.",
            "Since no relevant information was found in the available documents, please provide a general answer to the user's question based on your knowledge.",
            "",
            f"EXPLANATION STYLE: {explanation_level}",
            f"TONE: {language_tone}"
        ]
        
        # Add step-by-step instruction if enabled
        if config.get('step_by_step_mode', 'Off') == 'On':
            prompt_parts.append("FORMATTING: Break down complex answers step by step.")
        
        # Add follow-up suggestions instruction if enabled
        if config.get('follow_up_suggestions', 'Disabled') == 'Enabled':
            prompt_parts.append("FOLLOW-UP: At the end of your answer, suggest 2-3 related follow-up questions the user might ask.")
        
        prompt_parts.append("\nIMPORTANT: Always mention that this answer is not based on the available documents but on general knowledge.")
        
        system_prompt = "\n".join(prompt_parts)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        if chat_history:
            messages.extend(chat_history[-6:])  # Keep last 6 messages
        
        messages.append({
            "role": "user", 
            "content": f"Question: {query}\n\nNote: No relevant information was found in the available documents. Please provide a general answer based on your knowledge."
        })
        
        stream = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.3,  # Slightly higher temperature for general knowledge
            max_tokens=500,
            stream=True,
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
        
    except Exception as e:
        log.error(f"General LLM streaming error: {e}")
        yield "I apologize, but I'm unable to provide an answer at the moment due to a technical issue."

# FastAPI compatibility functions
def answer_question(question: str, module_id: int | None = None, team_id: int | None = None, 
                   user_config: dict | None = None, chat_history: list | None = None,
                   user_team_ids: list | None = None, use_general_llm: bool = False) -> str:
    """Simple answer function for FastAPI compatibility (non-streaming) with strict team/module isolation"""
    return answer(question, module_id=module_id, team_id=team_id, user_config=user_config, 
                 chat_history=chat_history, user_team_ids=user_team_ids, use_general_llm=use_general_llm)

def answer_question_stream(question: str, module_id: int | None = None, team_id: int | None = None,
                          user_config: dict | None = None, chat_history: list | None = None, 
                          user_team_ids: list | None = None, use_general_llm: bool = False):
    """Streaming answer function for FastAPI compatibility with strict team/module isolation"""
    query = str(question).strip()
    log.info(f"Streaming answer for query: '{query}' for module_id: {module_id}, team_id: {team_id}, user_team_ids: {user_team_ids}, use_general_llm: {use_general_llm}")
    
    # Handle greetings
    if query.lower() in {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!'}:
        yield "Hello! How can I help you today?"
        return
    
    # Default configuration
    config = user_config or {
        'response_mode': 'concise',
        'show_source': 'Yes',
        'chat_persona': 'Friendly',
        'explanation_level': 'intermediate',
        'language_tone': 'neutral',
        'step_by_step_mode': 'Off',
        'follow_up_suggestions': 'Disabled',
    }
    
    # If user wants general LLM answer (bypassing document search), call LLM directly
    if use_general_llm:
        log.info("Using general LLM without document context as requested by user")
        yield from _call_general_llm_stream(query, config, chat_history)
        return
    
    # Retrieve relevant chunks with strict isolation
    hits = retrieve(query, top_k=8, module_id=module_id, team_id=team_id, user_team_ids=user_team_ids)
    log.info(f"Retrieved {len(hits)} chunks for streaming query")
    
    # Define relevance thresholds
    MIN_CHUNK_COUNT = 1  # Minimum number of chunks needed
    MIN_RELEVANCE_SCORE = 0  # Minimum relevance score for chunks
    
    # Filter chunks by relevance score and count
    relevant_chunks = [hit for hit in hits if hit['score'] >= MIN_RELEVANCE_SCORE]
    log.info(f"Found {len(relevant_chunks)} chunks with relevance score >= {MIN_RELEVANCE_SCORE}")
    
    # Check if we have sufficient relevant chunks
    if len(relevant_chunks) < MIN_CHUNK_COUNT:
        filter_context = ""
        if module_id:
            filter_context = f" in the selected module"
        elif team_id or user_team_ids:
            filter_context = f" in the selected team"
        
        log.info(f"Insufficient relevant chunks ({len(relevant_chunks)}) for filtered streaming query")
        yield f"No relevant information found{filter_context} for your question. Would you like me to provide a general answer instead? (Please reply 'yes' if you want a general response)"
        return
    
    # Less aggressive filtering - use semantic similarity and keyword matching
    query_lower = query.lower()
    query_keywords = set(query_lower.split())
    
    # Score chunks based on content relevance - use relevant_chunks instead of hits
    scored_hits = []
    for hit in relevant_chunks:
        payload = hit['payload']
        if payload['type'] == 'text':
            chunk_text = payload['text'].lower()
            
            # Calculate relevance score
            relevance_score = 0
            
            # Keyword matching
            for keyword in query_keywords:
                if keyword in chunk_text:
                    relevance_score += 1
            
            # Special scoring for technical terms
            if any(term in query_lower for term in ['endpoint', 'api', 'backend']) and \
               any(term in chunk_text for term in ['endpoint', 'api', 'post', 'get', 'put', 'delete', 'patch']):
                relevance_score += 3
            
            # Boost score with vector similarity
            final_score = hit['score'] + (relevance_score * 0.1)
            scored_hits.append((final_score, hit))
    
    # Sort by relevance and take top chunks
    scored_hits.sort(key=lambda x: x[0], reverse=True)
    hits = [hit for _, hit in scored_hits[:8]]
    
    if not hits:
        yield "I don't have enough information to answer that question."
        return
    
    # Build context
    context_parts = []
    source_docs = set()
    for i, hit in enumerate(hits):
        payload = hit['payload']
        doc_title = payload.get('doc_title', 'Unknown Document')
        source_docs.add(doc_title)
        
        if payload['type'] == 'text':
            context_parts.append(f"[Chunk {i+1}]\n{payload['text']}")
        else:
            context_parts.append(f"[Chunk {i+1}]\n[Image context]")
    
    context = "\n\n".join(context_parts)[:8000]  # Increase context limit
    
    # Build messages
    system_prompt = _build_system_prompt(config)
    messages = [{"role": "system", "content": system_prompt}]
    
    if chat_history:
        messages.extend(chat_history[-6:])  # Keep last 6 messages
    
    messages.append({
        "role": "user", 
        "content": f"Context from documents:\n{context}\n\nQuestion: {query}"
    })
    
    # Generate streaming response
    try:
        stream = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=500,
            stream=True,
        )
        
        answer_chunks = []
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                content = chunk.choices[0].delta.content
                answer_chunks.append(content)
                yield content
        
        # Add source information at the end
        if config.get('show_source') == 'Yes':
            full_response = "".join(answer_chunks)
            if "Source:" not in full_response and "I don't have enough information" not in full_response:
                source_list = [str(doc) for doc in source_docs]
                source_text = "\n\nSource: " + ", ".join(sorted(source_list))
                yield source_text
        
    except Exception as e:
        log.error(f"Streaming ChatCompletion error: {e}")
        yield "LLM generation failed."

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

def delete_document_embeddings(doc_id: int):
    """Delete all embeddings for a specific document from Qdrant"""
    try:
        client = _get_qdrant_client()
        
        # Delete all points where payload.doc_id matches this document
        client.delete(
            collection_name=COLL_NAME,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="doc_id",
                            match=qmodels.MatchValue(value=str(doc_id))
                        )
                    ]
                )
            )
        )
        log.info(f"Deleted embeddings for document {doc_id}")
        
    except Exception as e:
        log.error(f"Failed to delete embeddings for document {doc_id}: {e}")
        raise e

def delete_module_embeddings(module_id: int):
    """Delete all embeddings for all documents in a specific module from Qdrant"""
    try:
        client = _get_qdrant_client()
        
        # Delete all points where payload.module_id matches this module
        client.delete(
            collection_name=COLL_NAME,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="module_id",
                            match=qmodels.MatchValue(value=module_id)
                        )
                    ]
                )
            )
        )
        log.info(f"Deleted embeddings for module {module_id}")
        
    except Exception as e:
        log.error(f"Failed to delete embeddings for module {module_id}: {e}")
        raise e

def delete_team_embeddings(team_id: int):
    """Delete all embeddings for all documents in a specific team from Qdrant"""
    try:
        client = _get_qdrant_client()
        
        # Delete all points where payload.team_id matches this team
        client.delete(
            collection_name=COLL_NAME,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="team_id",
                            match=qmodels.MatchValue(value=team_id)
                        )
                    ]
                )
            )
        )
        log.info(f"Deleted embeddings for team {team_id}")
        
    except Exception as e:
        log.error(f"Failed to delete embeddings for team {team_id}: {e}")
        raise e

def get_module_stats(module_id: int):
    """Get embedding statistics for a specific module"""
    try:
        client = _get_qdrant_client()
        
        # Count embeddings for this module
        result = client.scroll(
            collection_name=COLL_NAME,
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="module_id",
                        match=qmodels.MatchValue(value=module_id)
                    )
                ]
            ),
            limit=1,  # We just want the count
            with_payload=False,
            with_vectors=False
        )
        
        # Get total count by scrolling through all points
        total_embeddings = 0
        next_page_offset = None
        
        while True:
            batch_result = client.scroll(
                collection_name=COLL_NAME,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="module_id",
                            match=qmodels.MatchValue(value=module_id)
                        )
                    ]
                ),
                limit=100,
                offset=next_page_offset,
                with_payload=False,
                with_vectors=False
            )
            
            total_embeddings += len(batch_result[0])
            next_page_offset = batch_result[1]
            
            if next_page_offset is None:
                break
        
        return {
            "module_id": module_id,
            "total_embeddings": total_embeddings,
            "status": "active" if total_embeddings > 0 else "empty"
        }
        
    except Exception as e:
        log.error(f"Failed to get stats for module {module_id}: {e}")
        return {
            "module_id": module_id,
            "total_embeddings": 0,
            "status": "error",
            "error": str(e)
        }

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
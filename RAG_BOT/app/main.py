import shutil
import os
from datetime import timedelta, datetime
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app import models, database, auth
from app.rag_pipeline import RAGPipeline

# Initialize DB
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="RAG-Based Knowledge Assistant (Pure Python)", version="3.0.0")

# Enable CORS for React Frontend (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Pipeline
try:
    rag_pipeline = RAGPipeline()
except Exception as e:
    print(f"Failed to initialize RAG Pipeline: {e}")
    rag_pipeline = None

# --- Pydantic Models for API ---
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class DocumentResponse(BaseModel):
    id: int
    filename: str
    user_id: int

class QueryRequest(BaseModel):
    text: str
    chat_history: List[List[str]] = []
    available_files: List[str] = []

class DeleteRequest(BaseModel):
    filename: str

# --- Auth Routes ---

@app.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(database.get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.username == user.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = auth.get_password_hash(user.password)
        new_user = models.User(username=user.username, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        access_token = auth.create_access_token(data={"sub": new_user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Return 500 with actual error detail for debugging
        raise HTTPException(status_code=500, detail=f"Registration crashed: {str(e)}")

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "username": current_user.username}

# --- Document Routes ---

@app.get("/documents", response_model=List[DocumentResponse])
def get_documents(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    return current_user.documents

from fastapi import BackgroundTasks

def background_ingest(file_location: str, filename: str, user_id: int, db: Session):
    """Refactored ingestion to run in background."""
    try:
        # 2. Ingest into RAG (Vectors + Summary)
        # Note: We need to re-init session or pass db carefully? 
        # Actually rag_pipeline is global.
        # But we need to save metadata *after*? No, we save it immediately so UI shows it.
        # But wait, if ingestion fails, we might have a broken file entry?
        # Better: Save metadata first as "Processing", then update?
        # For this simplicity: We do ingestion entirely in background.
        # But we previously returned 'chunks'. Now we won't.
        
        print(f"Background: Ingesting {filename}...")
        rag_pipeline.ingest_document(file_location)
        print(f"Background: Ingestion complete for {filename}.")
        
        # Cleanup
        if os.path.exists(file_location): 
            os.remove(file_location)
            
    except Exception as e:
        print(f"Background Ingestion Failed: {e}")
        # Ideally update DB status to Error
        if os.path.exists(file_location): 
            os.remove(file_location)

@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not rag_pipeline:
        raise HTTPException(status_code=500, detail="RAG Pipeline not initialized.")

    # Secure temp filename
    file_location = f"temp_{current_user.id}_{file.filename}"
    
    try:
        # 1. Save locally (Fast)
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Save Metadata to SQLite (Immediate Feedback)
        existing_doc = db.query(models.Document).filter(
            models.Document.filename == file.filename, 
            models.Document.user_id == current_user.id
        ).first()
        
        if not existing_doc:
            new_doc = models.Document(filename=file.filename, owner=current_user)
            db.add(new_doc)
            db.commit()
            
        # 3. Queue Background Processing (Slow NLP)
        # We pass the file path. Logic moves to background_ingest
        background_tasks.add_task(background_ingest, file_location, file.filename, current_user.id, db)
        
        return {"message": "Upload started. You can chat while we process.", "filename": file.filename}
        
    except Exception as e:
        if os.path.exists(file_location): os.remove(file_location)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/delete_document")
def delete_document_endpoint(
    request: DeleteRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    # 1. Remove from SQLite
    doc = db.query(models.Document).filter(
        models.Document.filename == request.filename,
        models.Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    db.delete(doc)
    db.commit()
    
    # 2. Remove from RAG (Vectors + Insights)
    if rag_pipeline:
        rag_pipeline.delete_document(request.filename)
        
    return {"message": f"Deleted {request.filename}"}

# --- Conversation Routes ---
class ConversationCreate(BaseModel):
    title: str = "New Chat"

class MessageModel(BaseModel):
    role: str
    content: str

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    
class ChatRequest(BaseModel):
    content: str
    available_files: List[str] = []

@app.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    # Return latest first
    return db.query(models.Conversation).filter(
        models.Conversation.user_id == current_user.id
    ).order_by(models.Conversation.created_at.desc()).all()

@app.post("/conversations", response_model=ConversationResponse)
def create_conversation(
    conversation: ConversationCreate, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    new_conv = models.Conversation(title=conversation.title, user_id=current_user.id)
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv

@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}

@app.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return conv.messages

@app.post("/conversations/{conversation_id}/messages")
async def chat_in_conversation(
    conversation_id: int,
    request: ChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    # 1. Validate Conversation
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not rag_pipeline:
        raise HTTPException(status_code=500, detail="RAG Pipeline not initialized.")

    # 2. Save User Message
    user_msg = models.Message(role="user", content=request.content, conversation_id=conv.id)
    db.add(user_msg)
    db.commit()
    
    # 3. Rename Conversation if it's the first real message and title is default
    if len(conv.messages) <= 1 and conv.title == "New Chat":
        # Generate simple title from first few words
        new_title = " ".join(request.content.split()[:5])
        conv.title = new_title
        db.commit()

    # 4. Fetch History for Context (Last 6 messages)
    # We fetch specifically for RAG context
    # LangChain expects [(user, ai), (user, ai)]
    # We need to reconstruct this from flat DB list.
    # Simple strategy: Fetch last 10 messages, pair them.
    # For now, let's just pass raw text history or let RAG handle it?
    # RAG pipeline expects `chat_history` as list of tuples.
    
    # Let's get all messages sorted by time
    all_msgs = db.query(models.Message).filter(
        models.Message.conversation_id == conv.id
    ).order_by(models.Message.created_at.asc()).all()
    
    # Construct tuples: (User, AI)
    history_tuples = []
    # Simple iterator to pair them up roughly. 
    # Or strict: (all_msgs[i], all_msgs[i+1]) if roles match?
    # Robust: Just collect all previous turn pairs.
    # Actually, RAGPipeline expects `[(query, answer), ...]`
    # We iterate and find pairs.
    temp_user_query = None
    for m in all_msgs: # Iterate all messages to build context
        if m.role == 'user':
             temp_user_query = m.content
        elif m.role == 'ai' and temp_user_query:
             history_tuples.append((temp_user_query, m.content))
             temp_user_query = None
    
    # Exclude the very last user message from context (since it's the current query)
    if len(history_tuples) > 0 and history_tuples[-1][0] == request.content:
         history_tuples.pop()
             
    # Clean implementation: Just take the last N messages (excluding current) raw if needed?
    # RAGPipeline.query signature: (query, chat_history_tuples, files)
    # Let's rebuild history correctly.
    
    # 5. Generate Response
    response = rag_pipeline.query(request.content, history_tuples[-5:], request.available_files)
    ai_text = response["answer"]
    
    # 6. Save AI Response
    ai_msg = models.Message(role="ai", content=ai_text, conversation_id=conv.id)
    db.add(ai_msg)
    db.commit()
    
    return {"id": ai_msg.id, "role": "ai", "content": ai_text, "sources": response.get("context", "")}

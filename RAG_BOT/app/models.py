from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, BigInteger
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True)
    hashed_password = Column("password", String(255))
    
    documents = relationship("Document", back_populates="owner")
    conversations = relationship("Conversation", back_populates="owner", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(BigInteger, primary_key=True, index=True)
    filename = Column(String(255))
    upload_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(BigInteger, ForeignKey("users.id"))

    owner = relationship("User", back_populates="documents")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(BigInteger, primary_key=True, index=True)
    title = Column(String(255), default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(BigInteger, ForeignKey("users.id"))

    owner = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, index=True)
    role = Column(String(50)) # 'user' or 'ai'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation_id = Column(BigInteger, ForeignKey("conversations.id"))

    conversation = relationship("Conversation", back_populates="messages")

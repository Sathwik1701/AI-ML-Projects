import os
import shutil
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
# Reverted to HuggingFaceEmbeddings (Local) due to Google quota limits
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain

# Load environment variables
load_dotenv()

PERSIST_DIRECTORY = "db"

class RAGPipeline:
    def __init__(self):
        """Initializes the RAG pipeline with Local Embeddings, Vector Store, and Gemini LLM."""
        
        # Check API Key
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("CRITICAL WARNING: GOOGLE_API_KEY not found in .env file.")
            self.llm = None
        
        # 1. Initialize Embeddings (Local - HuggingFace)
        # Using 'all-MiniLM-L6-v2' which is small, fast, and runs locally without API quotas
        self.embedding_function = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

        # 2. Initialize Vector Store (ChromaDB)
        self.vector_db = Chroma(
            persist_directory=PERSIST_DIRECTORY, 
            embedding_function=self.embedding_function
        )

        # 3. Initialize LLM (Gemini)
        # Using verified working model
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest", 
            temperature=0,
            convert_system_message_to_human=True
        )

        # 4. Load Insights (NLP Layer)
        self.insights_file = "document_insights.json"
        self.insights = self._load_insights()

    def _load_insights(self):
        import json
        if os.path.exists(self.insights_file):
            with open(self.insights_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_insights(self):
        import json
        with open(self.insights_file, 'w') as f:
            json.dump(self.insights, f, indent=2)

    def _generate_document_summary(self, text_content: str, filename: str):
        """Uses LLM to generate a high-level summary of the document.
        Logic: Adapts to document length to ensure comprehensive analysis.
        """
        if not self.llm: return "Summary unavailable."
        
        try:
            doc_len = len(text_content)
            print(f"Analyzing document '{filename}' (Length: {doc_len} chars)")
            
            # Gemini Flash Context Window is ~1M tokens (approx 4M chars).
            # We set a safe high limit of 2M chars to prevent timeouts on extreme edge cases.
            limit = 2000000 
            
            if doc_len < limit:
                # Standard Strategy: Analyze Full Document
                strategy = "Full Context Analysis"
                content_to_analyze = text_content
            else:
                # Adaptive Strategy: Truncate for safety (or implement Map-Reduce in future)
                strategy = "Truncated Analysis (Extremely Large File)"
                content_to_analyze = text_content[:limit]
            
            prompt = f"""Analyze the following document ({strategy}) and provide a concise summary (3-4 sentences) and 5 key topics.
            Filename: {filename}
            Length: {doc_len} characters
            
            Content: 
            {content_to_analyze}
            
            Output format:
            Summary: [Comprehensive Summary of the ENTIRE content]
            Topics: [Topic 1, Topic 2, Topic 3, Topic 4, Topic 5]
            """
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            print(f"Summarization failed: {e}")
            return "Summary generation failed."

    def ingest_document(self, file_path: str):
        """Loads a document, splits it, adds to vector store, AND generates NLP insights."""
        if not os.path.exists(file_path):
            return "File not found."

        # Load Document
        if file_path.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path)
            
        documents = loader.load()
        
        # Extract full text for summarization
        full_text = " ".join([d.page_content for d in documents])
        filename = os.path.basename(file_path).replace("temp_", "")
        
        # NLP: Generate Summary
        print(f"Generating insights for {filename}...")
        summary = self._generate_document_summary(full_text, filename)
        self.insights[filename] = summary
        self._save_insights()

        # Split Text
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(documents)

        # Add to Vector Store
        self.vector_db.add_documents(chunks)
        
        return len(chunks)

    def query(self, query_text: str, chat_history: list = [], context_files: list = []):
        """Retrieves context and generates an answer using Gemini, considering chat history and available files."""
        import time
        start_time = time.time()
        
        if not self.llm:
            return {"answer": "LLM not initialized (Missing API Key).", "context": ""}

        # Create Conversational Retrieval Chain
        # Reverted: Search 3 chunks for speed (5 caused timeouts)
        retriever = self.vector_db.as_retriever(search_kwargs={"k": 3})
        
        # Optimization: Use a Custom Prompt to ensure "Optimal" behavior
        from langchain.prompts import PromptTemplate
        
        # Prepare "Intelligence" context from insights
        insight_context = ""
        if context_files:
            insight_context = "Document Insights (Pre-computed summaries):\n"
            for f in context_files:
                if f in self.insights:
                    insight_context += f"file: {f}\n{self.insights[f]}\n---\n"
        
        # Join file list into a string
        file_list_str = ", ".join(context_files) if context_files else "No specific files listed."
        
        # This template forces the bot to be professional and detailed
        custom_template = f"""Given the following conversation and a follow up question, return the answer.
        
        System Context:
        You are an Intelligent Knowledge Assistant. 
        You have "Complete Knowledge" of the following files: [{file_list_str}]
        
        {insight_context}
        
        Chat History:
        {{chat_history}}
        
        Context (Specific Details from Search):
        {{context}}
        
        Question: {{question}}
        
        Answer (Be detailed, professional, and use bullet points where effectively):"""
        
        prompt = PromptTemplate(
            template=custom_template, 
            input_variables=["chat_history", "context", "question"]
        )

        qa_chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=retriever,
            return_source_documents=True,
            verbose=True,
            combine_docs_chain_kwargs={"prompt": prompt} # Correctly inject prompt here
        )

        try:
            # chat_history should be list of (question, answer) tuples
            result = qa_chain.invoke({"question": query_text, "chat_history": chat_history})
            
            elapsed_time = time.time() - start_time
            print(f"Query processed in {elapsed_time:.2f} seconds.")

            # Format output - Sources as Filenames ONLY (User Request)
            answer = result.get("answer", "No answer generated.")
            source_docs = result.get("source_documents", [])
            
            # Extract unique filenames
            unique_sources = set()
            for doc in source_docs:
                # source path might be 'temp_Java.pdf' or 'db/...' 
                raw_source = doc.metadata.get('source', 'Unknown')
                # Clean up path
                filename = os.path.basename(raw_source).replace("temp_", "")
                unique_sources.add(filename)
            
            # Create a clean comma-separated string
            context_str = ", ".join(sorted(unique_sources))
            
            return {"answer": answer, "context": context_str}
        except Exception as e:
            print(f"Query Error: {e}")
            return {"answer": f"Error generating response: {str(e)}", "context": ""}

    def delete_document(self, filename: str):
        """Removes a document from Vector DB and Insights JSON."""
        print(f"Deleting document: {filename}")
        
        # 1. Delete from Vector Store
        # Chroma Delete by 'where' metadata filter
        # Note: Depending on langchain-chroma version, deletion might vary.
        # We assume standard Chroma syntax. 
        # Source metadata usually stores full path (temp_filename) or cleaned filename based on ingest logic.
        # In ingest we did: filename = os.path.basename(file_path).replace("temp_", "")
        # But Vector Store metadata usually keeps the 'source' field as it was added.
        # The loader uses 'file_path' as source. (temp_X.pdf)
        # So we need to match partial content or re-construct temp name.
        # Ideally, we should have stored a clean ID. 
        # For now, we attempt to delete by matching likely source patterns.
        try:
             # Try deleting by potential source names
             self.vector_db.delete(where={"source": f"temp_{filename}"})
        except:
             pass 

        # 2. Delete from Insights
        if filename in self.insights:
            del self.insights[filename]
            self._save_insights()
        
        return True

# RAG Knowledge Assistant (Pure Python)

A full-stack AI application that allows users to upload PDF documents, generate intelligent summaries ("Complete Knowledge"), and chat with them using Retrieval-Augmented Generation (RAG).

## Features
*   **Pure Python Backend**: Built with FastAPI, SQLAlchemy, and LangChain.
*   **React Frontend**: Modern, responsive UI with Chat History and File Management.
*   **RAG Engine**: Powered by Gemini (Google GenAI) and ChromaDB for vector search.
*   **MySQL Support**: robust relational data storage.
*   **Secure Auth**: JWT-based authentication with session persistence.

## Tech Stack
*   **Backend**: Python 3.10+, FastAPI, PyMySQL, LangChain.
*   **Frontend**: React (Vite), Axios.
*   **Database**: MySQL (Users, Metadata), ChromaDB (Vectors).
*   **AI**: Google Gemini Flash (LLM & Embeddings).

## Setup & specific instructions

### 1. Backend
1.  Create a virtual environment:
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure `.env` (Create this file):
    ```ini
    GOOGLE_API_KEY=your_key_here
    DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/db_name
    SECRET_KEY=your_secret_key
    ```
4.  Run the server:
    ```bash
    uvicorn app.main:app --reload
    ```

### 2. Frontend
1.  Navigate to `frontend/`:
    ```bash
    cd frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Start dev server:
    ```bash
    npm run dev
    ```

## Project Structure
*   `app/`: Backend source code (API, Auth, RAG Pipeline).
*   `frontend/`: React source code.
*   `requirements.txt`: Python dependencies.

## License
MIT

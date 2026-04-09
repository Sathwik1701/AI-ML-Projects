import React, { useState } from 'react';
import axios from 'axios';
import Upload from './components/Upload';
import Chat from './components/Chat';
import Auth from './components/Auth';

import ChatHistory from './components/ChatHistory';

function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // To force refresh history on new chat

  // Restore session on mount
  React.useEffect(() => {
    // ... (existing auth logic unchanged) ...
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('http://127.0.0.1:8000/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setUser({ username: res.data.username, token: token });
        })
        .catch(err => {
          console.error("Session expired", err);
          localStorage.removeItem('token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#667eea', fontSize: '1.2rem' }}>Restoring Session...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      {/* Left: Files */}
      <Upload user={user} files={files} setFiles={setFiles} />

      {/* Center: Chat */}
      <div className="content-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 'calc(100% - 480px)' }}>
        <header className="app-header">
          <h3 style={{ margin: 0 }}>RAG Assistant</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span>{user.username}</span>
            <button onClick={() => setUser(null)} className="btn" style={{ fontSize: '0.8rem', padding: '5px 10px' }}>Logout</button>
          </div>
        </header>
        <Chat
          files={files}
          conversationId={currentConvId}
          setConversationId={setCurrentConvId}
          onMessageSent={() => setRefreshTrigger(p => p + 1)}
        />
      </div>

      {/* Right: History */}
      <ChatHistory
        user={user}
        currentConvId={currentConvId}
        setConvId={setCurrentConvId}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}

export default App;

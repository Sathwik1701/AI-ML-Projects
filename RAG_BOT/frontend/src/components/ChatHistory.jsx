import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageSquare, Plus, Trash2, MessageCircle } from 'lucide-react';

export default function ChatHistory({ user, currentConvId, setConvId, refreshTrigger }) {
    const [conversations, setConversations] = useState([]);

    const fetchConversations = () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        axios.get('http://127.0.0.1:8000/conversations', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => setConversations(res.data))
            .catch(err => console.error("Failed to fetch history", err));
    };

    useEffect(() => {
        fetchConversations();
    }, [user, currentConvId, refreshTrigger]); // Refresh when user changes or we select a chat

    const handleNewChat = () => {
        setConvId(null);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete this conversation forever?")) return;

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://127.0.0.1:8000/conversations/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // If we deleted the current one, switch to new
            if (currentConvId === id) setConvId(null);
            fetchConversations();
        } catch (err) {
            console.error(err);
            alert("Failed to delete.");
        }
    };

    return (
        <div className="history-sidebar" style={{
            width: '240px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '1rem'
        }}>
            <button
                onClick={handleNewChat}
                style={{
                    background: 'var(--accent)', color: 'white',
                    border: 'none', padding: '0.8rem', borderRadius: '0.5rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: 'bold', marginBottom: '1rem'
                }}
            >
                <Plus size={18} /> New Chat
            </button>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Recent Chats</h4>

                {conversations.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>No history yet.</p>
                )}

                {conversations.map(conv => (
                    <div
                        key={conv.id}
                        onClick={() => setConvId(conv.id)}
                        style={{
                            padding: '10px',
                            margin: '5px 0',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            background: currentConvId === conv.id ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                            border: currentConvId === conv.id ? '1px solid var(--accent)' : '1px solid transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            color: currentConvId === conv.id ? 'var(--accent)' : 'var(--text-primary)',
                            transition: 'all 0.2s'
                        }}
                        className="history-item"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <MessageCircle size={16} />
                            <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                {conv.title}
                            </span>
                        </div>
                        <Trash2
                            size={14}
                            className="delete-icon"
                            style={{ opacity: 0.6, cursor: 'pointer' }}
                            onClick={(e) => handleDelete(e, conv.id)}
                            onMouseOver={(e) => e.currentTarget.style.color = 'red'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

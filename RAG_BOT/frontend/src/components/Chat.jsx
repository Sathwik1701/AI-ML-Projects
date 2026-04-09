import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Chat({ files = [], conversationId, setConversationId, onMessageSent }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Fetch messages when conversation changes
    useEffect(() => {
        if (!conversationId) {
            setMessages([
                { role: 'ai', content: 'Hello! Start a new conversation by asking a question about your documents.' }
            ]);
            return;
        }

        setLoading(true);
        const token = localStorage.getItem('token');
        axios.get(`http://127.0.0.1:8000/conversations/${conversationId}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => {
                setMessages(res.data);
            })
            .catch(err => console.error("Failed to load messages", err))
            .finally(() => setLoading(false));

    }, [conversationId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const content = input;
        setInput('');

        // Optimistic UI update
        const tempUserMsg = { role: 'user', content: content };
        setMessages(prev => [...prev, tempUserMsg]);
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const availableFiles = files.map(f => f.name);
            let activeId = conversationId;

            // 1. Create Conversation if new
            if (!activeId) {
                const createRes = await axios.post('http://127.0.0.1:8000/conversations',
                    { title: "New Chat" },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                activeId = createRes.data.id;
                setConversationId(activeId);
                if (onMessageSent) onMessageSent(); // Trigger sidebar refresh
            }

            // 2. Send Message
            const response = await axios.post(`http://127.0.0.1:8000/conversations/${activeId}/messages`,
                { content: content, available_files: availableFiles },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Replace optimistic with real or just append AI response
            // The backend returns the AI message.
            const aiMsg = {
                role: 'ai',
                content: response.data.content,
                // sources: response.data.sources // backend returns sources in specific field if mapped
            };

            setMessages(prev => [...prev, aiMsg]);

            // Trigger refresh again if title changed? backend handles title. 
            // We might want to refresh sidebar if it was the first message.
            if (messages.length <= 1 && onMessageSent) onMessageSent();

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, connection failed.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main-content">
            <div className="chat-container">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user'}`}>
                        <div style={{
                            marginTop: '0.5rem',
                            color: msg.role === 'user' ? 'var(--text-secondary)' : 'var(--accent)'
                        }}>
                            {msg.role === 'user' ? <User size={24} /> : <Bot size={24} />}
                        </div>

                        <div className="message-content">
                            <div className="markdown-body">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="message assistant">
                        <Bot size={24} color="var(--accent)" />
                        <div className="message-content" style={{ display: 'flex', alignItems: 'center' }}>
                            <Loader2 className="animate-spin" size={20} />
                            <span style={{ marginLeft: '0.5rem' }}>Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
                <form onSubmit={handleSubmit} className="input-wrapper">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask away..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import axios from 'axios';
import { User, Lock, ArrowRight } from 'lucide-react';

export default function Auth({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                // Python FastAPI /token route expects x-www-form-urlencoded
                // We MUST use URLSearchParams, NOT FormData (which is multipart)
                const params = new URLSearchParams();
                params.append('username', username);
                params.append('password', password);

                const response = await axios.post('http://127.0.0.1:8000/token', params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                localStorage.setItem('token', response.data.access_token);
                // Pass user info (We need to fetch profile or parse token)
                // For simplicity, we just pass username
                onLogin({ username: username, token: response.data.access_token });

            } else {
                // Register expects JSON
                await axios.post('http://127.0.0.1:8000/register', { username, password });

                setIsLogin(true);
                alert("Registration successful! Please log in.");
            }
        } catch (err) {
            console.error("Auth Error:", err);
            // Handle FastAPI 422 Validation Errors (Array) or Simple Errors (String)
            const detail = err.response?.data?.detail;
            let msg = "Authentication failed";

            if (typeof detail === 'string') {
                msg = detail;
            } else if (Array.isArray(detail)) {
                msg = detail.map(d => d.msg).join(', ');
            }
            setError(msg);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Glass Container */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '3rem',
                borderRadius: '1.5rem',
                width: '100%',
                maxWidth: '420px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '60px', height: '60px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem auto'
                    }}>
                        <User size={32} color="white" />
                    </div>
                    <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
                        {isLogin ? 'Welcome Back' : 'Join Us'}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>
                        {isLogin ? 'Enter your credentials to access your workspace.' : 'Create your account to get started.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div className="input-group" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.8rem', padding: '0.8rem' }}>
                        <User size={20} color="rgba(255,255,255,0.8)" style={{ marginRight: '10px' }} />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{
                                background: 'transparent', border: 'none', outline: 'none',
                                color: 'white', width: '100%', fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div className="input-group" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.8rem', padding: '0.8rem' }}>
                        <Lock size={20} color="rgba(255,255,255,0.8)" style={{ marginRight: '10px' }} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                background: 'transparent', border: 'none', outline: 'none',
                                color: 'white', width: '100%', fontSize: '1rem'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{ background: 'rgba(255, 0, 0, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,0,0,0.3)' }}>
                            <p style={{ color: '#ffcccb', fontSize: '0.9rem', textAlign: 'center', margin: 0 }}>{error}</p>
                        </div>
                    )}

                    <button type="submit" style={{
                        background: 'white', color: '#764ba2',
                        padding: '1rem', borderRadius: '0.8rem',
                        border: 'none', fontWeight: 'bold', fontSize: '1rem',
                        cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
                        gap: '0.5rem', transition: 'transform 0.2s',
                        marginTop: '1rem'
                    }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={20} />
                    </button>
                </form>

                <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                    {isLogin ? "New here? " : "Already existing? "}
                    <span
                        style={{ color: 'white', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? 'Create Account' : 'Login'}
                    </span>
                </p>
            </div>
        </div>
    );
}

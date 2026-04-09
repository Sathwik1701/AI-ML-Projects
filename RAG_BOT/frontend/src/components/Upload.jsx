import React, { useState } from 'react';
import axios from 'axios';
import { Upload as UploadIcon, FileText, CheckCircle, Loader2, Trash2 } from 'lucide-react';

export default function Upload({ user, files, setFiles }) {
    const [uploading, setUploading] = useState(false);
    // const [files, setFiles] = useState([]); // State lifted to App.jsx

    // Fetch documents from Python Backend
    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get(`http://127.0.0.1:8000/documents`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    // Python returns [{id, filename, user_id, ...}]
                    // Map to UI format
                    const dbFiles = res.data.map(d => ({
                        id: d.id, // Store ID for delete
                        name: d.filename,
                        status: 'success'
                    }));
                    setFiles(dbFiles);
                })
                .catch(err => console.error("Failed to fetch documents", err));
        }
    }, [user, setFiles]);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const token = localStorage.getItem('token');

        try {
            // Unified Upload to Python (Ingest + Save Metadata)
            const res = await axios.post('http://127.0.0.1:8000/upload', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFiles(prev => [...prev, {
                id: Math.random(), // Temporary ID until refresh, or we could return ID from BE
                name: selectedFile.name,
                status: 'success'
            }]);
        } catch (error) {
            console.error("Upload failed", error);
            setFiles(prev => [...prev, { name: selectedFile.name, status: 'error' }]);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (!window.confirm(`Delete ${filename}?`)) return;

        const token = localStorage.getItem('token');
        try {
            await axios.post('http://127.0.0.1:8000/delete_document', { filename }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update UI
            setFiles(prev => prev.filter(f => f.name !== filename));
        } catch (err) {
            console.error("Delete failed", err);
            alert("Failed to delete document.");
        }
    };

    return (
        <div className="sidebar">
            <div style={{ marginBottom: '2rem' }}>
                <h2>Knowledge Base</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Upload PDFs to chat with them.
                </p>
            </div>

            <label className="upload-zone">
                <input type="file" hidden onChange={handleFileChange} accept=".pdf,.txt" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    {uploading ? (
                        <Loader2 className="animate-spin" color="var(--accent)" />
                    ) : (
                        <UploadIcon color="var(--text-secondary)" />
                    )}
                    <span style={{ color: 'var(--text-secondary)' }}>
                        {uploading ? 'Processing...' : 'Click or Drag PDF'}
                    </span>
                </div>
            </label>

            <div className="file-list">
                <h3>Uploaded Files</h3>
                {files.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        No files ingested yet.
                    </p>
                )}
                {files.map((file, idx) => (
                    <div key={idx} className="file-item" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={16} color="var(--accent)" />
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                        </div>
                        {file.status === 'success' ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <CheckCircle size={16} color="var(--success)" />
                                <button onClick={() => handleDelete(file.name)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                    <Trash2 size={16} color="#ff4444" />
                                </button>
                            </div>
                        ) : (
                            <span style={{ color: 'red', fontSize: '0.8rem' }}>Error</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

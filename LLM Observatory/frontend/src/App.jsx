// frontend/src/App.jsx
import React, { useState } from 'react';
import TokenizerComparison from './components/TokenizerComparison';
import AttentionHeatmap from './components/AttentionHeatmap';
import EmbeddingGeometry from './components/EmbeddingGeometry';
import SamplingDashboard from './components/SamplingDashboard';
import './App.css';

const features = [
  { id: 'tokenizer', label: 'Tokenizer', icon: '🔤' },
  { id: 'attention', label: 'Attention', icon: '🧠' },
  { id: 'embedding', label: 'Embeddings', icon: '📐' },
  { id: 'sampling', label: 'Sampling', icon: '🎲' }
];

const modelLogos = [
  { id: 'gemini', name: 'Gemini', color: '#4285F4' },
  { id: 'minimax', name: 'MiniMax', color: '#00C853' },
  { id: 'qwq', name: 'QwQ-32B', color: '#FF6D00' }
];

function App() {
  const [activeFeature, setActiveFeature] = useState('tokenizer');

  return (
    <div className="app">
      <header className="header">
        <h1>🔬 LLM Internals Observatory</h1>
        <p className="subtitle">Making the invisible visible — tokenization, attention, embeddings, and sampling</p>
        
        <div className="model-tags">
          {modelLogos.map(model => (
            <span 
              key={model.id} 
              className="model-tag"
              style={{ borderColor: model.color, color: model.color }}
            >
              {model.name}
            </span>
          ))}
        </div>
      </header>

      <nav className="nav-tabs">
        {features.map(feature => (
          <button
            key={feature.id}
            className={`tab ${activeFeature === feature.id ? 'active' : ''}`}
            onClick={() => setActiveFeature(feature.id)}
          >
            <span className="tab-icon">{feature.icon}</span>
            <span className="tab-label">{feature.label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {activeFeature === 'tokenizer' && <TokenizerComparison />}
        {activeFeature === 'attention' && <AttentionHeatmap />}
        {activeFeature === 'embedding' && <EmbeddingGeometry />}
        {activeFeature === 'sampling' && <SamplingDashboard />}
      </main>

      <footer className="footer">
        <p>Built with React + D3.js + FastAPI | Comparing Gemini, MiniMax-M2.5, and QwQ-32B</p>
      </footer>
    </div>
  );
}

export default App;

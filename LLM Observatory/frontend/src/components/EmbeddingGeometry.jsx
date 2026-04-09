// frontend/src/components/EmbeddingGeometry.jsx - FIXED
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const API_URL = 'http://localhost:8000';
const defaultWords = ['king', 'queen', 'man', 'woman', 'prince', 'princess'];

const models = [
  { id: 'gemini', name: 'Gemini 2.0', color: '#4285F4', embedDim: '768' },
  { id: 'minimax', name: 'MiniMax-M2.5', color: '#00C853', embedDim: '1024' },
  { id: 'qwq32b', name: 'QwQ-32B', color: '#FF6D00', embedDim: '4096' }
];

export default function EmbeddingGeometry() {
  const [textInput, setTextInput] = useState(defaultWords.join(', '));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [showPCA, setShowPCA] = useState(true);
  const svgRef = useRef(null);

  useEffect(() => { 
    if (result) {
      try {
        renderEmbeddings();
      } catch (err) {
        console.error("Render error:", err);
        setError("Error rendering embeddings");
      }
    }
  }, [result, selectedModel, showPCA]);

  const handleAnalyze = async () => {
    const texts = textInput.split(',').map(t => t.trim()).filter(t => t);
    if (texts.length < 2) {
      setError("Please enter at least 2 words");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, models: ['gemini', 'minimax', 'qwq32b'] })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Embed response:", data);
      setResult(data);
    } catch (err) {
      console.error("API error:", err);
      setError(err.message || "Failed to fetch embeddings");
    }
    setLoading(false);
  };

  const renderEmbeddings = () => {
    if (!result || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 650, height = 450, margin = { top: 60, right: 40, bottom: 40, left: 40 };
    const g = svg.attr('width', width).attr('height', height).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Safe data access
    const texts = result.texts || [];
    const pcaCoordinates = result.pca_coordinates || {};
    const similarityMatrices = result.cosine_similarity_matrices || {};
    
    // Find first available model with data
    let modelKey = null;
    for (const m of ['gemini', 'minimax', 'qwq32b']) {
      if (pcaCoordinates[m] && pcaCoordinates[m].length > 0) {
        modelKey = m;
        break;
      }
    }
    
    if (!modelKey) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .text('No embedding data available');
      return;
    }
    
    // If selected model doesn't have data, switch to available one
    if (!pcaCoordinates[selectedModel] || pcaCoordinates[selectedModel].length === 0) {
      modelKey = selectedModel;
    } else {
      modelKey = selectedModel;
    }
    
    const coords = pcaCoordinates[modelKey] || [];
    const similarity = similarityMatrices[modelKey] || [];
    
    if (coords.length === 0 || texts.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .text('No embedding data available');
      return;
    }

    const xExtent = d3.extent(coords, d => d[0]);
    const yExtent = d3.extent(coords, d => d[1]);
    const xScale = d3.scaleLinear().domain([xExtent[0] - 0.2, xExtent[1] + 0.2]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([yExtent[0] - 0.2, yExtent[1] + 0.2]).range([innerHeight, 0]);

    // Draw connections
    const numLinks = Math.min(texts.length, 10);
    for (let i = 0; i < numLinks; i++) {
      for (let j = i + 1; j < numLinks; j++) {
        const simRow = similarity[i];
        if (simRow && typeof simRow[j] === 'number' && simRow[j] > 0.2) {
          g.append('line')
            .attr('x1', xScale(coords[i][0])).attr('y1', yScale(coords[i][1]))
            .attr('x2', xScale(coords[j][0])).attr('y2', yScale(coords[j][1]))
            .attr('stroke', '#ccc').attr('stroke-width', Math.max(1, simRow[j] * 4))
            .attr('opacity', Math.min(0.8, simRow[j] + 0.2));
        }
      }
    }

    const modelColor = models.find(m => m.id === modelKey)?.color || '#4285F4';

    // Draw nodes
    const numNodes = Math.min(texts.length, 15);
    for (let i = 0; i < numNodes; i++) {
      g.append('circle')
        .attr('cx', xScale(coords[i][0]))
        .attr('cy', yScale(coords[i][1]))
        .attr('r', 12)
        .attr('fill', modelColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
        
      g.append('text')
        .attr('x', xScale(coords[i][0]))
        .attr('y', yScale(coords[i][1]) - 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(texts[i]);
    }

    // Title
    const modelInfo = models.find(m => m.id === modelKey);
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', modelColor)
      .text(`${modelInfo?.name || 'Model'} Embeddings`);
  };

  return (
    <div className="feature-container">
      <div className="feature-header">
        <h2>📐 Multi-Model Embedding Geometry</h2>
        <p>Compare semantic embeddings across Gemini, MiniMax-M2.5, and QwQ-32B</p>
      </div>

      <div className="input-section">
        <input 
          type="text" 
          value={textInput} 
          onChange={(e) => setTextInput(e.target.value)} 
          placeholder="Enter words..." 
          className="text-input wide" 
        />
        <button onClick={handleAnalyze} disabled={loading} className="run-button">
          {loading ? 'Embedding...' : '▶ Embed'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '8px', marginBottom: '15px' }}>
          Error: {error}
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <label>Select Model:</label>
          <div className="model-buttons">
            {models.map(model => (
              <button
                key={model.id}
                className={`toggle-btn ${selectedModel === model.id ? 'active' : ''}`}
                onClick={() => setSelectedModel(model.id)}
                style={selectedModel === model.id ? { 
                  background: model.color, 
                  color: '#fff', 
                  borderColor: model.color 
                } : {}}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label>Visualization:</label>
          <div className="toggle-buttons">
            <button className={`toggle-btn ${showPCA ? 'active' : ''}`} onClick={() => setShowPCA(true)}>PCA</button>
            <button className={`toggle-btn ${!showPCA ? 'active' : ''}`} onClick={() => setShowPCA(false)}>Force</button>
          </div>
        </div>
      </div>

      {result && (
        <div className="info-bar">
          <span>Words: {result.texts?.length || 0}</span>
          <span>Models loaded: {Object.keys(result.embeddings || {}).join(', ') || 'None'}</span>
        </div>
      )}

      <div className="visualization centered">
        <svg ref={svgRef}></svg>
      </div>

      <div className="insight-box">
        <h4>🧠 Why This Signals Internals Depth</h4>
        <ul>
          <li>You understand meaning = geometry in high-dimensional space</li>
          <li>Different models have different embedding dimensions</li>
          <li>PCA projection shows dimensionality reduction</li>
        </ul>
      </div>
    </div>
  );
}

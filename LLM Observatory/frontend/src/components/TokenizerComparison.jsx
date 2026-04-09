// frontend/src/components/TokenizerComparison.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const API_URL = 'http://localhost:8000';

export default function TokenizerComparison() {
  const [text, setText] = useState('The artificial intelligence system demonstrated remarkable reasoning');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => { 
    if (result) {
      try {
        renderTokenizers();
      } catch (err) {
        console.error("Render error:", err);
        setError("Error rendering visualization");
      }
    }
  }, [result]);

  const handleTokenize = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("API Response:", data); // Debug: Check the response
      setResult(data);
    } catch (err) {
      console.error("API error:", err);
      setError(err.message || "Failed to fetch data");
    }
    setLoading(false);
  };

  const renderTokenizers = () => {
    if (!result) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = 900 - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Safe access to result data - matching backend field names exactly
    const geminiTokens = result.gemini_tokens || [];
    const minimaxTokens = result.minimax_tokens || [];
    const qwqTokens = result.qwq_tokens || [];
    
    const maxTokens = Math.max(geminiTokens.length, minimaxTokens.length, qwqTokens.length, 1);

    const xScale = d3.scaleLinear().domain([0, maxTokens]).range([0, width]);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 50]);

    const yPositions = { gemini: 10, minimax: 80, qwq: 150 };
    const colors = { gemini: '#4285F4', minimax: '#00C853', qwq: '#FF6D00' };
    const labels = { gemini: 'Gemini', minimax: 'MiniMax', qwq: 'QwQ-32B' };

    const tokenData = [
      { key: 'gemini', data: geminiTokens },
      { key: 'minimax', data: minimaxTokens },
      { key: 'qwq', data: qwqTokens }
    ];

    tokenData.forEach(({ key, data }) => {
      const y = yPositions[key];
      
      g.selectAll(`.${key}-token`)
        .data(data.slice(0, Math.min(maxTokens, 50)))
        .enter()
        .append('rect')
        .attr('x', (d, i) => xScale(i))
        .attr('y', y)
        .attr('width', Math.max(3, width / maxTokens - 2))
        .attr('height', 30)
        .attr('fill', colors[key])
        .attr('rx', 4)
        .attr('opacity', 0.8);

      g.append('text')
        .attr('x', -10)
        .attr('y', y + 18)
        .attr('text-anchor', 'end')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('fill', colors[key])
        .text(labels[key]);
    });
  };

  // Safe cost formatting function
  const formatCost = (cost) => {
    if (cost === undefined || cost === null) return '0.0000';
    return typeof cost === 'number' ? cost.toFixed(4) : '0.0000';
  };

  // Safe token count function
  const getTokenCount = (tokens) => {
    if (!tokens || !Array.isArray(tokens)) return 0;
    return tokens.length;
  };

  return (
    <div className="feature-container">
      <div className="feature-header">
        <h2>🔤 Multi-Model Tokenizer Comparison</h2>
        <p>Compare how Gemini, MiniMax-M2.5, and QwQ-32B break down text into tokens</p>
      </div>

      <div className="input-section">
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Enter text..." 
          className="text-input" 
        />
        <button onClick={handleTokenize} disabled={loading} className="run-button">
          {loading ? 'Analyzing...' : '▶ Analyze'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '8px', marginBottom: '15px' }}>
          Error: {error}
        </div>
      )}

      {result && (
        <div className="results-grid">
          <div className="result-card gemini">
            <h3>🤖 Gemini 2.0</h3>
            <div className="stat">
              <span className="stat-value">{getTokenCount(result.gemini_tokens)}</span>
              <span className="stat-label">tokens</span>
            </div>
            <div className="stat">
              <span className="stat-value">${formatCost(result.gemini_cost)}</span>
              <span className="stat-label">cost</span>
            </div>
          </div>
          <div className="result-card minimax">
            <h3>⚡ MiniMax-M2.5</h3>
            <div className="stat">
              <span className="stat-value">{getTokenCount(result.minimax_tokens)}</span>
              <span className="stat-label">tokens</span>
            </div>
            <div className="stat">
              <span className="stat-value">${formatCost(result.minimax_cost)}</span>
              <span className="stat-label">cost</span>
            </div>
          </div>
          <div className="result-card qwq">
            <h3>🧠 QwQ-32B</h3>
            <div className="stat">
              <span className="stat-value">{getTokenCount(result.qwq_tokens)}</span>
              <span className="stat-label">tokens</span>
            </div>
            <div className="stat">
              <span className="stat-value">${formatCost(result.qwq_cost)}</span>
              <span className="stat-label">cost</span>
            </div>
          </div>
        </div>
      )}

      <div className="visualization">
        <svg ref={svgRef}></svg>
      </div>

      <div className="insight-box">
        <h4>🧠 Why This Signals Internals Depth</h4>
        <ul>
          <li>Tokenization is the first transformation — most engineers skip it entirely</li>
          <li>Each model has different BPE vocabularies trained on different data</li>
          <li>Token count differences directly affect API costs and context window usage</li>
        </ul>
      </div>
    </div>
  );
}

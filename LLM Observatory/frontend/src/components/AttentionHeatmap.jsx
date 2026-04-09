// frontend/src/components/AttentionHeatmap.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const API_URL = 'http://localhost:8000';

const models = [
  { id: 'gemini', name: 'Gemini 2.0', color: '#4285F4', layers: 28, heads: 18 },
  { id: 'minimax', name: 'MiniMax-M2.5', color: '#00C853', layers: 80, heads: 32 },
  { id: 'qwq32b', name: 'QwQ-32B', color: '#FF6D00', layers: 28, heads: 32 }
];

export default function AttentionHeatmap() {
  const [text, setText] = useState('The AI model processed the complex reasoning task');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('qwq32b');
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState(0);
  const svgRef = useRef(null);

  const currentModel = models.find(m => m.id === selectedModel);

  useEffect(() => { 
    setLayer(0);
    setHead(0);
  }, [selectedModel]);

  useEffect(() => { 
    if (result) {
      try {
        renderHeatmap();
      } catch (err) {
        console.error("Render error:", err);
        setError("Error rendering heatmap");
      }
    }
  }, [result, layer, head]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/attention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          model: selectedModel,
          layer, 
          head 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Attention response:", data);
      setResult(data);
    } catch (err) {
      console.error("API error:", err);
      setError(err.message || "Failed to fetch attention data");
    }
    setLoading(false);
  };

  const renderHeatmap = () => {
    if (!result || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 80, right: 30, bottom: 30, left: 80 };
    const width = 600 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Safe access to result data
    const tokens = result.tokens || [];
    const attentionWeights = result.attention_weights || [];
    const n = tokens.length;
    
    if (n === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No tokens to display');
      return;
    }

    const xScale = d3.scaleBand()
      .domain(tokens)
      .range([0, width])
      .padding(0.05);
    
    const yScale = d3.scaleBand()
      .domain(tokens)
      .range([0, height])
      .padding(0.05);
    
    // Safe max calculation
    let maxWeight = 0;
    attentionWeights.forEach(row => {
      if (row && Array.isArray(row)) {
        row.forEach(val => {
          if (val > maxWeight) maxWeight = val;
        });
      }
    });
    
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxWeight || 1]);

    // Create cells
    for (let i = 0; i < n; i++) {
      if (!attentionWeights[i] || !Array.isArray(attentionWeights[i])) continue;
      for (let j = 0; j < n; j++) {
        const weight = attentionWeights[i][j] || 0;
        g.append('rect')
          .attr('x', xScale(tokens[j]))
          .attr('y', yScale(tokens[i]))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale.bandwidth())
          .attr('fill', colorScale(weight))
          .attr('rx', 2);
      }
    }

    // Axes
    if (n <= 15) {
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

      g.append('g')
        .call(d3.axisLeft(yScale));
    }

    // Title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', currentModel.color)
      .text(`${result.model_name || 'Model'} — Layer ${layer}, Head ${head}`);
  };

  // Safe getter functions
  const getTokenCount = (arr) => {
    if (!arr || !Array.isArray(arr)) return 0;
    return arr.length;
  };

  return (
    <div className="feature-container">
      <div className="feature-header">
        <h2>🧠 Multi-Model Attention Visualization</h2>
        <p>Visualize attention patterns across Gemini, MiniMax-M2.5, and QwQ-32B</p>
      </div>

      <div className="controls" style={{ marginBottom: '15px' }}>
        <div className="control-group">
          <label style={{ marginBottom: '8px', display: 'block' }}>Select Model:</label>
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
      </div>

      <div className="input-section">
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Enter sentence to analyze..." 
          className="text-input" 
        />
        <button onClick={handleAnalyze} disabled={loading} className="run-button">
          {loading ? 'Computing...' : '▶ Analyze'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '8px', marginBottom: '15px' }}>
          Error: {error}
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <label>Layer: {layer} / {currentModel.layers - 1}</label>
          <input
            type="range"
            min="0"
            max={currentModel.layers - 1}
            value={layer}
            onChange={(e) => setLayer(parseInt(e.target.value))}
          />
        </div>
        <div className="control-group">
          <label>Head: {head} / {currentModel.heads - 1}</label>
          <input
            type="range"
            min="0"
            max={currentModel.heads - 1}
            value={head}
            onChange={(e) => setHead(parseInt(e.target.value))}
          />
        </div>
      </div>

      {result && (
        <div className="info-bar">
          <span style={{ color: currentModel.color, fontWeight: 'bold' }}>
            {result.model_name}
          </span>
          <span>Layers: {result.num_layers || 0}</span>
          <span>Heads: {result.num_heads || 0}</span>
          <span>Tokens: {getTokenCount(result.tokens)}</span>
        </div>
      )}

      <div className="visualization centered">
        <svg ref={svgRef}></svg>
      </div>

      <div className="insight-box">
        <h4>🧠 Why This Signals Internals Depth</h4>
        <ul>
          <li>You understand Q, K, V matrices — not just that attention exists</li>
          <li>Different models have different attention architectures</li>
          <li>Layer selection shows how attention evolves</li>
        </ul>
      </div>
    </div>
  );
}



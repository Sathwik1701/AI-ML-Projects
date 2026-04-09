// frontend/src/components/SamplingDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const API_URL = 'http://localhost:8000';

const models = [
  { id: 'qwq32b', name: 'QwQ-32B', color: '#FF6D00' },
  { id: 'gemini', name: 'Gemini 2.0', color: '#4285F4' },
  { id: 'minimax', name: 'MiniMax-M2.5', color: '#00C853' }
];

export default function SamplingDashboard() {
  const [prompt, setPrompt] = useState('Explain quantum computing in simple terms');
  const [selectedModel, setSelectedModel] = useState('qwq32b');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const barChartRef = useRef(null);
  const outputsRef = useRef(null);

  useEffect(() => { 
    if (result) {
      renderBarChart();
      renderOutputs();
    }
  }, [result]);

  const handleSample = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          model: selectedModel,
          temperature, 
          top_p: topP,
          max_tokens: 100
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Sample response:", data);
      setResult(data);
    } catch (err) {
      console.error("API error:", err);
      setError(err.message || "Failed to generate samples");
    }
    setLoading(false);
  };

  const renderBarChart = () => {
    if (!result || !barChartRef.current) return;

    const svg = d3.select(barChartRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = 700 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const firstTokenProbs = result.first_token_probs || [];
    const sortedProbs = [...firstTokenProbs].sort((a, b) => b.probability - a.probability).slice(0, 12);

    if (sortedProbs.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No probability data available');
      return;
    }

    const xScale = d3.scaleBand()
      .domain(sortedProbs.map(d => d.token))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(sortedProbs, d => d.probability) * 1.1])
      .range([height, 0]);

    const modelColor = models.find(m => m.id === selectedModel)?.color || '#4ECDC4';

    g.selectAll('rect')
      .data(sortedProbs)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.token))
      .attr('y', d => yScale(d.probability))
      .attr('width', xScale.bandwidth())
      .attr('height', d => height - yScale(d.probability))
      .attr('fill', modelColor)
      .attr('rx', 4);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.0%')));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text('Probability');

    g.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', modelColor)
      .text(`${result.model_name} — First Token Distribution`);
  };

  const renderOutputs = () => {
    if (!result || !outputsRef.current) return;

    const container = outputsRef.current;
    container.innerHTML = '';

    const outputs = result.outputs || [];
    outputs.forEach((output, i) => {
      const div = document.createElement('div');
      div.className = 'output-item';
      div.innerHTML = `
        <span class="output-index">${i + 1}</span>
        <span class="output-text">${output}</span>
      `;
      container.appendChild(div);
    });
  };

  const getTokenCount = (arr) => {
    if (!arr || !Array.isArray(arr)) return 0;
    return arr.length;
  };

  return (
    <div className="feature-container">
      <div className="feature-header">
        <h2>🎲 Multi-Model Sampling Dashboard</h2>
        <p>Compare how different models handle temperature and top-p sampling</p>
      </div>

      <div className="input-section">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt..."
          className="text-input"
        />
        <button onClick={handleSample} disabled={loading} className="run-button">
          {loading ? 'Sampling...' : '▶ Sample'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', padding: '10px', background: '#ffebee', borderRadius: '8px', marginBottom: '15px' }}>
          Error: {error}
        </div>
      )}

      <div className="controls wide">
        <div className="control-group">
          <label>Model:</label>
          <div className="model-buttons">
            {models.map(model => (
              <button
                key={model.id}
                className={`toggle-btn ${selectedModel === model.id ? 'active' : ''}`}
                onClick={() => setSelectedModel(model.id)}
                style={selectedModel === model.id ? { background: model.color, color: '#fff', borderColor: model.color } : {}}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label>Temperature: {temperature}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
          <span className="control-hint">
            {temperature === 0 ? 'Greedy' : temperature < 1 ? 'Focused' : 'Creative'}
          </span>
        </div>
        <div className="control-group">
          <label>Top-p: {topP}</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={topP}
            onChange={(e) => setTopP(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {result && (
        <div className="info-bar">
          <span>Model: {result.model_name}</span>
          <span>Temp: {result.settings?.temperature ?? temperature}</span>
          <span>Top-p: {result.settings?.top_p ?? topP}</span>
          <span>Runs: {getTokenCount(result.outputs)}</span>
        </div>
      )}

      <div className="visualization">
        <svg ref={barChartRef}></svg>
      </div>

      <div className="outputs-container">
        <h3>Parallel Samples ({getTokenCount(result?.outputs)} runs)</h3>
        <div ref={outputsRef} className="outputs-list"></div>
      </div>

      <div className="insight-box">
        <h4>🧠 Why This Signals Internals Depth</h4>
        <ul>
          <li>Most people know temperature exists — almost none can explain the probability distribution</li>
          <li>Showing parallel runs makes variance visible</li>
          <li>You understand inference as probabilistic sampling</li>
        </ul>
      </div>
    </div>
  );
}

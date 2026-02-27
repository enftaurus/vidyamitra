import { useState } from 'react';
import { api, apiError } from '../api';

export default function DomainSwitchPage() {
  const [targetDomain, setTargetDomain] = useState('Data Science');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onAnalyze = async (e) => {
    e.preventDefault();
    if (!targetDomain.trim()) {
      setError('Please enter a target domain.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/domain_switch/', {
        target_domain: targetDomain.trim(),
      });
      setResult(data || null);
    } catch (err) {
      setError(apiError(err, 'Domain switch analysis failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Domain Switch</h2>
      </div>

      <form onSubmit={onAnalyze} className="form compact">
        <label>Target Domain</label>
        <input
          type="text"
          value={targetDomain}
          onChange={(e) => setTargetDomain(e.target.value)}
          placeholder="e.g., Data Science, DevOps, AI/ML"
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <h3>Analysis Result</h3>
          <div className="metrics-grid">
            <div className="metric-card"><span>Target</span><strong>{result.target_domain}</strong></div>
            <div className="metric-card"><span>Recommended</span><strong>{result.is_switch_recommended ? 'Yes' : 'No'}</strong></div>
            <div className="metric-card"><span>Difficulty</span><strong>{result.transition_difficulty}</strong></div>
            <div className="metric-card"><span>Time</span><strong>{result.estimated_transition_time}</strong></div>
          </div>
          <div className="analysis-grid">
            <div><strong>Summary:</strong> {result.recommendation_summary}</div>
            <div><strong>Market Outlook:</strong> {result.market_outlook}</div>
            <div><strong>Final Guidance:</strong> {result.final_guidance}</div>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

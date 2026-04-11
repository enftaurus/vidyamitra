import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import RoadmapFlow from '../components/RoadmapFlow';

const EXAMPLE_TOPICS = [
  { label: 'Learn Docker', topic: 'Docker', context: 'skill' },
  { label: 'Build a REST API', topic: 'Build a REST API with FastAPI and PostgreSQL', context: 'project' },
  { label: 'Learn Machine Learning', topic: 'Machine Learning', context: 'skill' },
  { label: 'Build a Chat App', topic: 'Build a real-time chat application', context: 'project' },
  { label: 'Learn React', topic: 'React', context: 'skill' },
  { label: 'Learn System Design', topic: 'System Design fundamentals', context: 'skill' },
];

const CONTEXT_OPTIONS = [
  { value: 'skill', label: '📚 Learn a Skill', description: 'Step-by-step path to master a technology' },
  { value: 'project', label: '🛠 Build a Project', description: 'From idea to deployed product' },
  { value: 'custom', label: '🎯 Custom Goal', description: 'Any learning or building objective' },
];

export default function RoadmapPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [context, setContext] = useState(searchParams.get('context') || 'custom');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roadmap, setRoadmap] = useState(null);

  // Auto-generate if topic comes from URL (e.g. resume page redirect)
  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    const urlContext = searchParams.get('context');
    if (urlTopic) {
      setTopic(urlTopic);
      setContext(urlContext || 'skill');
      // Auto-trigger generation
      handleGenerate(urlTopic, urlContext || 'skill');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async (overrideTopic, overrideContext) => {
    const finalTopic = (overrideTopic ?? topic).trim();
    const finalContext = overrideContext ?? context;
    if (!finalTopic) { setError('Please enter a topic or goal.'); return; }

    setLoading(true);
    setError('');
    setRoadmap(null);

    try {
      const { data } = await api.post('/roadmap/generate', { topic: finalTopic, context: finalContext });
      setRoadmap(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to generate roadmap. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    navigate(`/roadmap?topic=${encodeURIComponent(topic)}&context=${context}`, { replace: true });
    handleGenerate();
  };

  return (
    <section className="panel" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Hero header ── */}
      <div style={{
        textAlign: 'center',
        padding: '2rem 1rem 1.5rem',
        background: 'linear-gradient(135deg, #6366f108, #818cf808)',
        borderRadius: '16px',
        marginBottom: '2rem',
        border: '1px solid #6366f120',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Roadmap Generator
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>
          Describe what you want to learn or build — get a personalized visual roadmap.
        </p>
      </div>

      {/* ── Input form ── */}
      <form onSubmit={onSubmit} style={{ marginBottom: '1.5rem' }}>
        {/* Context selector */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CONTEXT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setContext(opt.value)}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '10px',
                border: context === opt.value ? '2px solid #6366f1' : '1px solid #334155',
                background: context === opt.value ? 'linear-gradient(135deg, #6366f120, #818cf820)' : 'transparent',
                color: context === opt.value ? '#818cf8' : 'var(--text-muted)',
                fontWeight: context === opt.value ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Topic input */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
            placeholder={
              context === 'skill'   ? 'e.g. Docker, Kubernetes, Machine Learning, FastAPI...' :
              context === 'project' ? 'e.g. Build a real-time chat app with FastAPI and React...' :
                                     'e.g. Go from beginner to job-ready in AI/ML within 3 months'
            }
            rows={3}
            style={{
              flex: 1,
              padding: '0.9rem 1.1rem',
              borderRadius: '12px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#e2e8f0',
              fontSize: '0.95rem',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0 1.5rem',
              borderRadius: '12px',
              background: loading ? '#334155' : 'linear-gradient(135deg, #6366f1, #818cf8)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              minWidth: '130px',
            }}
          >
            {loading ? '⏳ Generating...' : '✨ Generate'}
          </button>
        </div>

        {/* Example chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Try:</span>
          {EXAMPLE_TOPICS.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setTopic(ex.topic); setContext(ex.context); }}
              style={{
                padding: '0.3rem 0.8rem',
                borderRadius: '20px',
                border: '1px solid #334155',
                background: 'transparent',
                color: '#64748b',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#6366f1'; e.target.style.color = '#818cf8'; }}
              onMouseLeave={e => { e.target.style.borderColor = '#334155'; e.target.style.color = '#64748b'; }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div style={{ padding: '0.9rem 1.1rem', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '10px', color: '#fca5a5', marginBottom: '1.5rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Loading shimmer ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>🗺️</div>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
            Crafting your personalised roadmap...
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
            {[0.1, 0.2, 0.3].map((delay, i) => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#6366f1',
                animation: `bounce 1.2s ${delay}s infinite ease-in-out`,
              }} />
            ))}
          </div>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
          `}</style>
        </div>
      )}

      {/* ── Roadmap display ── */}
      {roadmap && !loading && (
        <div>
          {/* Header card */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            <h2 style={{ margin: '0 0 0.5rem', color: '#f1f5f9', fontSize: '1.4rem' }}>{roadmap.title}</h2>
            <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.6 }}>{roadmap.summary}</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#6366f120', border: '1px solid #6366f140', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', color: '#a5b4fc' }}>
                📍 {roadmap.nodes?.length || 0} Steps
              </div>
              <div style={{ background: '#10b98120', border: '1px solid #10b98140', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', color: '#6ee7b7' }}>
                🔗 {roadmap.edges?.length || 0} Connections
              </div>
            </div>
          </div>

          {/* Node type legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {[
              { type: 'start', color: '#8b5cf6', label: 'Start' },
              { type: 'concept', color: '#3b82f6', label: 'Concept' },
              { type: 'step', color: '#10b981', label: 'Step' },
              { type: 'milestone', color: '#f59e0b', label: 'Milestone' },
              { type: 'resource', color: '#ec4899', label: 'Resource' },
              { type: 'end', color: '#34d399', label: 'Goal' },
            ].map(item => (
              <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#64748b' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          {/* React Flow chart */}
          <RoadmapFlow
            nodes={roadmap.nodes}
            edges={roadmap.edges}
            title={roadmap.title}
          />

          {/* Step list (text fallback below the chart) */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>📋 Step-by-Step Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {roadmap.nodes.map((node, i) => (
                <div key={node.id} style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>{node.label}</div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>{node.description}</div>
                    {node.estimated_time && (
                      <div style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '0.3rem' }}>⏱ {node.estimated_time}</div>
                    )}
                    {node.resources?.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {node.resources.map((r, j) => (
                          <div key={j} style={{ fontSize: '0.75rem', color: '#64748b' }}>→ {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

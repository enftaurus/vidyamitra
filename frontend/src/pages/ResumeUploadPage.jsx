import { useState } from 'react';
import { api, apiError } from '../api';
import ReactMarkdown from 'react-markdown';

export default function ResumeUploadPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedResult = result?.data || result || {};

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/resume/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data || null);
    } catch (err) {
      setError(apiError(err, 'Resume upload failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Resume Upload</h2>
      </div>

      <form onSubmit={onUpload} className="form compact">
        <label>Upload Resume (PDF)</label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload Resume'}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <h3>Resume Analysis</h3>

          {normalizedResult.resume_score !== undefined && normalizedResult.resume_score !== null && (
            <div className="metric-card">
              <span>Resume Score</span>
              <strong>{normalizedResult.resume_score}</strong>
            </div>
          )}

          <div className="analysis-cards">
            <article className="analysis-card">
              <h4>Analysis</h4>
              <div className="markdown-content">
                <ReactMarkdown>{String(normalizedResult.analysis || '-')}</ReactMarkdown>
              </div>
            </article>

            <article className="analysis-card">
              <h4>Skill Analysis</h4>
              <div className="markdown-content">
                <ReactMarkdown>{String(normalizedResult.skill_analysis || '-')}</ReactMarkdown>
              </div>
            </article>

            <article className="analysis-card">
              <h4>Suggested Projects</h4>
              <div className="markdown-content">
                <ReactMarkdown>{String(normalizedResult.suggested_projects || '-')}</ReactMarkdown>
              </div>
            </article>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

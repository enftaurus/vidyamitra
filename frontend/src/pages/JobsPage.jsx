import { useEffect, useState } from 'react';
import { api, apiError } from '../api';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredJobs = jobs.filter((job) => {
    if (!normalizedKeyword) return true;

    const haystack = [job.title, job.company, job.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const terms = normalizedKeyword.split(',').map((t) => t.trim()).filter(Boolean);
    return terms.every((term) => haystack.includes(term));
  });

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/jobs/');
        setJobs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(apiError(err, 'Unable to load jobs'));
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Jobs</h2>
        <p className="muted">Explore current openings.</p>
      </div>

      <form className="form compact" onSubmit={(e) => e.preventDefault()}>
        <label>Search by keyword</label>
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="Try: AI Engineer, Hyderabad, Data, Cloud..."
        />
      </form>

      {!loading && (
        <div className="hint">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      )}

      {loading ? (
        <div className="hint">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="hint">No jobs found.</div>
      ) : filteredJobs.length === 0 ? (
        <div className="hint">No matching jobs for "{searchKeyword}".</div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job, index) => (
            <article key={job.id ?? `${job.title || 'job'}-${index}`} className="job-card">
              <h4>{job.title || 'Untitled Role'}</h4>
              <p><strong>Company:</strong> {job.company || '-'}</p>
              <p><strong>Location:</strong> {job.location || '-'}</p>
              {job.apply_url ? (
                <a className="btn ghost" href={job.apply_url} target="_blank" rel="noreferrer" style={{ marginTop: '0.55rem', display: 'inline-block' }}>
                  Apply Now
                </a>
              ) : (
                <p><strong>Apply:</strong> Not available</p>
              )}
            </article>
          ))}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

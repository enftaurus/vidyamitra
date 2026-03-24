import { useEffect, useState } from 'react';
import { api, apiError } from '../api';
import { setInterviewUnlocked } from '../interviewFlow';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const isJobExternal = (value) => value === true || value === 'true' || value === 1;

  const filteredJobs = jobs.filter((job) => {
    if (!normalizedKeyword) return true;

    const haystack = [job.title, job.company, job.location, job.description]
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
            <article key={job.id ?? `${job.title || 'job'}-${index}`} className="job-card job-card-enhanced">
              <h4>{job.title || 'Untitled Role'}</h4>
              <p><strong>Company:</strong> {job.company || '-'}</p>
              <p><strong>Location:</strong> {job.location || '-'}</p>
              <p><strong>Description:</strong> {job.description || '-'}</p>

              {isJobExternal(job.is_external) ? (
                <div className="job-actions">
                  <a
                    className="btn ghost"
                    href={job.apply_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!job.apply_url) e.preventDefault();
                    }}
                  >
                    Apply
                  </a>
                  <button type="button" className="btn ghost">
                    Build Resume
                  </button>
                </div>
              ) : (
                <div className="job-actions">
                  <p className="job-source"><strong>Source:</strong> Vidyamitra</p>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={async () => {
                      if (!job.id) {
                        window.alert('Job id is missing. Unable to apply right now.');
                        return;
                      }

                      try {
                        await api.post('/jobs/quick-apply', { job_id: job.id });
                        setInterviewUnlocked(true);
                        window.alert('Quick Apply submitted. Interview rounds are unlocked for 5 minutes. Start any round within 5 minutes to keep access.');
                      } catch (err) {
                        window.alert(apiError(err, 'Unable to submit quick apply'));
                      }
                    }}
                  >
                    Quick Apply
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

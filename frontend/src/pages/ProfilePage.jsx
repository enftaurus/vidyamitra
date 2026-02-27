import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api';

const firstRecord = (payload) => {
  if (!payload) return {};
  if (Array.isArray(payload)) return payload[0] || {};
  return payload;
};

const toObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const readValue = (obj, keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return '';
};

const collectObjects = (root) => {
  const queue = [root];
  const seen = new Set();
  const out = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const obj = toObject(current);
    if (!obj || seen.has(obj)) continue;
    seen.add(obj);
    out.push(obj);

    Object.values(obj).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => queue.push(entry));
      } else {
        queue.push(value);
      }
    });
  }

  return out;
};

const readFromAny = (objects, keys) => {
  for (const obj of objects) {
    const value = readValue(obj, keys);
    if (value !== '') return value;
  }
  return '';
};

const normalizeArray = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
  }
  return [];
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

export default function ProfilePage() {
  const [profileRaw, setProfileRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/profile');
      setProfileRaw(data.data || null);
    } catch (err) {
      setError(apiError(err, 'Unable to load profile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = useMemo(() => {
    const row = firstRecord(profileRaw);
    const candidates = toObject(row?.candidates) || {};
    const resumeJson = toObject(candidates?.resume_json) || toObject(row?.resume_json) || {};
    const basicInfo = toObject(row?.basic_information) || toObject(row?.basic_info) || {};
    const searchableObjects = collectObjects({ ...row, candidates, resumeJson, basicInfo });

    return {
      name: readFromAny(searchableObjects, ['name', 'candidate_name', 'full_name', 'user_name']),
      place: readFromAny(searchableObjects, ['place', 'location', 'city', 'address']),
      bio: readFromAny(searchableObjects, ['bio', 'summary', 'about', 'profile_summary']),
      mobile: readFromAny(searchableObjects, ['phone', 'mobile', 'contact_number', 'phone_number']),
      skills: normalizeArray(row, ['skills']),
      projects: normalizeArray(row, ['projects']),
      education: normalizeArray(row, ['education']),
      certifications: normalizeArray(row, ['certificates', 'certifications']),
    };
  }, [profileRaw]);

  return (
    <section className="panel">
      <div className="panel-header between">
        <div>
          <h2>Profile</h2>
          <p className="muted">Structured candidate profile</p>
        </div>
        <button className="btn ghost" onClick={loadProfile} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!profileRaw && !error && <div className="hint">Loading profile...</div>}

      {profileRaw && (
        <div className="profile-sections">
          <article className="profile-card">
            <h3>Candidate</h3>
            <div className="kv-grid">
              <div><strong>Name:</strong> {formatValue(profile.name)}</div>
              <div><strong>Place:</strong> {formatValue(profile.place)}</div>
              <div><strong>Bio:</strong> {formatValue(profile.bio)}</div>
              <div><strong>Mobile Number:</strong> {formatValue(profile.mobile)}</div>
            </div>
          </article>

          <article className="profile-card">
            <h3>Skills</h3>
            <div className="chip-grid">
              {profile.skills.length > 0 ? profile.skills.map((skill, index) => {
                const skillText = typeof skill === 'object'
                  ? readValue(skill, ['skill', 'name', 'skill_name'])
                  : String(skill);
                return <span className="pill" key={`skill-${index}`}>{formatValue(skillText)}</span>;
              }) : <span>-</span>}
            </div>
          </article>

          <article className="profile-card">
            <h3>Projects</h3>
            <div className="profile-list">
              {profile.projects.length > 0 ? profile.projects.map((project, index) => (
                <div className="profile-item" key={`project-${index}`}>
                  <div><strong>Title:</strong> {formatValue(readValue(project, ['project_name', 'title', 'name']))}</div>
                  <div><strong>GitHub URL:</strong> {formatValue(readValue(project, ['project_link', 'github_url', 'url']))}</div>
                  <div><strong>Description:</strong> {formatValue(readValue(project, ['project_description', 'description']))}</div>
                </div>
              )) : <span>-</span>}
            </div>
          </article>

          <article className="profile-card">
            <h3>Education</h3>
            <div className="profile-list">
              {profile.education.length > 0 ? profile.education.map((edu, index) => (
                <div className="profile-item" key={`edu-${index}`}>
                  <div><strong>GPA:</strong> {formatValue(readValue(edu, ['gpa']))}</div>
                  <div><strong>College Name:</strong> {formatValue(readValue(edu, ['college_name']))}</div>
                  <div><strong>Field of Study:</strong> {formatValue(readValue(edu, ['field_of_study']))}</div>
                  <div><strong>Start Year:</strong> {formatValue(readValue(edu, ['start_year']))}</div>
                  <div><strong>End Year:</strong> {formatValue(readValue(edu, ['end_year']))}</div>
                </div>
              )) : <span>-</span>}
            </div>
          </article>

          <article className="profile-card">
            <h3>Certifications</h3>
            <div className="profile-list">
              {profile.certifications.length > 0 ? profile.certifications.map((cert, index) => (
                <div className="profile-item" key={`cert-${index}`}>
                  <div><strong>Name:</strong> {formatValue(readValue(cert, ['certificate_name', 'name']))}</div>
                  <div><strong>Issuer:</strong> {formatValue(readValue(cert, ['certificate_issuer', 'issuer']))}</div>
                  <div><strong>Issue Date:</strong> {formatValue(readValue(cert, ['certificate_date', 'issue_date']))}</div>
                </div>
              )) : <span>-</span>}
            </div>
          </article>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

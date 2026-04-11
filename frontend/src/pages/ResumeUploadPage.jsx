import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../api';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

/* ─────────────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'vidyamitra_resume_result';
const STORAGE_TTL = 30 * 60 * 1000; // 30 minutes

const emptyCertificate = { certificate_name: '', certificate_issuer: '', certificate_date: '' };
const emptyProject = { project_name: '', project_description: '', project_link: '' };
const emptyPlacement = { company: '', role: '', duration: '', description: '' };

const TEMPLATES = [
  { value: 'classic', label: 'Classic', accent: '#4361ee', bg: '#f8faff', sidebar: null },
  { value: 'minimal', label: 'Minimal', accent: '#111827', bg: '#ffffff', sidebar: null },
  { value: 'modern', label: 'Modern', accent: '#2c3e7c', bg: '#2c3e7c', sidebar: '#2c3e7c' },
];

const BUILD_SECTIONS = [
  { id: 'basics', label: 'Personal Info', icon: '👤' },
  { id: 'skills', label: 'Skills', icon: '⚡' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'experience', label: 'Experience', icon: '💼' },
  { id: 'projects', label: 'Projects', icon: '🛠' },
  { id: 'certifications', label: 'Certifications', icon: '📜' },
  { id: 'template', label: 'Template', icon: '🎨' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Live Resume Preview
───────────────────────────────────────────────────────────────────────────── */
function LiveResumePreview({ formData, selectedTemplate }) {
  const tpl = TEMPLATES.find(t => t.value === selectedTemplate) || TEMPLATES[0];
  const skillsList = formData.skills
    ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const fullName = `${formData.firstName} ${formData.lastName}`.trim() || 'Your Name';

  const isModern = selectedTemplate === 'modern';
  const isMinimal = selectedTemplate === 'minimal';

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      fontFamily: "'Georgia', serif",
      fontSize: '7.5px',
      color: '#1e293b',
      minHeight: '500px',
      transform: 'scale(1)',
      transformOrigin: 'top left',
    }}>
      {isModern ? (
        <div style={{ display: 'flex', minHeight: '500px' }}>
          {/* Sidebar */}
          <div style={{ background: tpl.bg, color: '#fff', width: '35%', padding: '18px 14px', flexShrink: 0 }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              {(formData.firstName || 'U')[0]?.toUpperCase()}
            </div>
            <div style={{ fontFamily: "'Arial', sans-serif", fontWeight: 700, fontSize: '10px', color: '#fff', marginBottom: '3px' }}>{fullName}</div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', marginBottom: '10px' }}>{formData.domain || 'Your Domain'}</div>
            {formData.email && <div style={{ fontSize: '6.5px', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>✉ {formData.email}</div>}
            {formData.phone && <div style={{ fontSize: '6.5px', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>📞 {formData.phone}</div>}
            {formData.location && <div style={{ fontSize: '6.5px', color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>📍 {formData.location}</div>}
            {skillsList.length > 0 && (
              <>
                <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Skills</div>
                {skillsList.slice(0, 8).map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '3px', padding: '2px 5px', marginBottom: '2px', fontSize: '6.5px', color: '#fff' }}>{s}</div>
                ))}
              </>
            )}
          </div>
          {/* Main */}
          <div style={{ flex: 1, padding: '18px 14px', background: '#fff' }}>
            {formData.bio && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${tpl.accent}30`, paddingBottom: '3px', marginBottom: '5px' }}>Summary</div>
                <div style={{ fontSize: '6.5px', color: '#475569', lineHeight: 1.5, marginBottom: '10px' }}>{formData.bio}</div>
              </>
            )}
            {formData.collegeName && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${tpl.accent}30`, paddingBottom: '3px', marginBottom: '5px' }}>Education</div>
                <div style={{ fontSize: '7px', fontWeight: 600, marginBottom: '1px' }}>{formData.degree || 'Degree'} {formData.fieldOfStudy ? `— ${formData.fieldOfStudy}` : ''}</div>
                <div style={{ fontSize: '6.5px', color: '#64748b' }}>{formData.collegeName}</div>
                <div style={{ fontSize: '6px', color: '#94a3b8', marginBottom: '8px' }}>{formData.startYear} — {formData.endYear}</div>
              </>
            )}
            {formData.projects.some(p => p.project_name) && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${tpl.accent}30`, paddingBottom: '3px', marginBottom: '5px' }}>Projects</div>
                {formData.projects.filter(p => p.project_name).slice(0, 2).map((p, i) => (
                  <div key={i} style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '7px', fontWeight: 600, color: '#1e293b' }}>{p.project_name}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', lineHeight: 1.4 }}>{p.project_description?.slice(0, 100)}{p.project_description?.length > 100 ? '…' : ''}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : isMinimal ? (
        <div style={{ padding: '20px 22px', background: '#fff' }}>
          <div style={{ fontFamily: "'Arial', sans-serif", fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{fullName}</div>
          <div style={{ fontSize: '7px', color: '#6b7280', marginBottom: '2px' }}>{formData.email}{formData.phone ? ` · ${formData.phone}` : ''}{formData.location ? ` · ${formData.location}` : ''}</div>
          {formData.domain && <div style={{ fontSize: '6.5px', color: '#9ca3af', marginBottom: '8px' }}>{formData.domain}</div>}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginBottom: '6px' }} />
          {formData.bio && (
            <>
              <div style={{ fontSize: '7px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Professional Summary</div>
              <div style={{ fontSize: '6.5px', color: '#4b5563', lineHeight: 1.5, marginBottom: '8px' }}>{formData.bio}</div>
            </>
          )}
          {skillsList.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '6px', marginBottom: '4px' }} />
              <div style={{ fontSize: '7px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
                {skillsList.slice(0, 12).map((s, i) => (
                  <span key={i} style={{ background: '#f3f4f6', borderRadius: '3px', padding: '1px 5px', fontSize: '6px', color: '#374151' }}>{s}</span>
                ))}
              </div>
            </>
          )}
          {formData.collegeName && (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '6px', marginBottom: '4px' }} />
              <div style={{ fontSize: '7px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Education</div>
              <div style={{ fontSize: '7px', fontWeight: 600 }}>{formData.degree} {formData.fieldOfStudy}</div>
              <div style={{ fontSize: '6.5px', color: '#6b7280' }}>{formData.collegeName} · {formData.startYear}–{formData.endYear}</div>
            </>
          )}
        </div>
      ) : (
        /* Classic */
        <div style={{ background: tpl.bg }}>
          <div style={{ background: tpl.accent, padding: '14px 18px', color: '#fff' }}>
            <div style={{ fontFamily: "'Arial', sans-serif", fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{fullName}</div>
            <div style={{ fontSize: '6.5px', opacity: 0.85 }}>
              {formData.email}{formData.phone ? ` | ${formData.phone}` : ''}{formData.location ? ` | ${formData.location}` : ''}
            </div>
            {formData.domain && <div style={{ fontSize: '6px', opacity: 0.7, marginTop: '1px' }}>{formData.domain}</div>}
          </div>
          <div style={{ padding: '12px 18px' }}>
            {formData.bio && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, borderLeft: `3px solid ${tpl.accent}`, paddingLeft: '6px', marginBottom: '4px' }}>SUMMARY</div>
                <div style={{ fontSize: '6.5px', color: '#475569', lineHeight: 1.5, marginBottom: '8px' }}>{formData.bio}</div>
              </>
            )}
            {skillsList.length > 0 && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, borderLeft: `3px solid ${tpl.accent}`, paddingLeft: '6px', marginBottom: '4px' }}>SKILLS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
                  {skillsList.slice(0, 10).map((s, i) => (
                    <span key={i} style={{ background: `${tpl.accent}15`, border: `1px solid ${tpl.accent}30`, borderRadius: '3px', padding: '1px 5px', fontSize: '6px', color: tpl.accent }}>{s}</span>
                  ))}
                </div>
              </>
            )}
            {formData.collegeName && (
              <>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: tpl.accent, borderLeft: `3px solid ${tpl.accent}`, paddingLeft: '6px', marginBottom: '4px' }}>EDUCATION</div>
                <div style={{ marginBottom: '2px', fontSize: '7px', fontWeight: 600 }}>{formData.degree} — {formData.fieldOfStudy}</div>
                <div style={{ fontSize: '6.5px', color: '#64748b' }}>{formData.collegeName} | {formData.startYear}–{formData.endYear}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────────────────────── */
export default function ResumeUploadPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [generatedResume, setGeneratedResume] = useState(null);
  const [saved, setSaved] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('basics');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', location: '', bio: '', domain: '', skills: '',
    linkedin: '', github: '', leetcode: '', codeforces: '', codechef: '',
    degree: '', fieldOfStudy: '', collegeName: '', universityName: '', gpa: '', startYear: '', endYear: '',
    certificates: [{ ...emptyCertificate }],
    projects: [{ ...emptyProject }],
    placements: [{ ...emptyPlacement }],
  });

  // ── sessionStorage persistence for analysis result ───────────────────────
  const [result, setResultState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > STORAGE_TTL) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  });

  const setResult = useCallback((data) => {
    setResultState(data);
    if (data) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } catch { /* storage full */ }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const normalizedResult = result?.data || result || {};

  // ── Form helpers ─────────────────────────────────────────────────────────
  const onFieldChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const updateListItem = (listKey, index, field, value) => {
    setFormData(prev => {
      const next = [...prev[listKey]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [listKey]: next };
    });
  };

  const addListItem = (listKey, emptyItem) =>
    setFormData(prev => ({ ...prev, [listKey]: [...prev[listKey], { ...emptyItem }] }));

  const removeListItem = (listKey, index) => {
    setFormData(prev => {
      const next = prev[listKey].filter((_, i) => i !== index);
      const fallback = listKey === 'certificates' ? emptyCertificate : listKey === 'projects' ? emptyProject : emptyPlacement;
      return { ...prev, [listKey]: next.length ? next : [{ ...fallback }] };
    });
  };

  // ── Build resume data ────────────────────────────────────────────────────
  const buildResumeData = () => ({
    basic: {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email, phone: formData.phone, location: formData.location,
      bio: formData.bio, domain: formData.domain,
      linkedin: formData.linkedin,
      github: formData.github,
      leetcode: formData.leetcode,
      codeforces: formData.codeforces,
      codechef: formData.codechef,
    },
    skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
    education: {
      degree: formData.degree, field_of_study: formData.fieldOfStudy,
      college_name: formData.collegeName, university_name: formData.universityName,
      gpa: formData.gpa, start_year: formData.startYear, end_year: formData.endYear,
    },
    certificates: formData.certificates.filter(item => Object.values(item).some(Boolean)),
    projects: formData.projects.filter(item => Object.values(item).some(Boolean)),
    placements: formData.placements.filter(item => Object.values(item).some(Boolean)),
  });

  const onBuildResume = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.email.trim()) {
      setError('Please fill in at least First Name and Email.');
      return;
    }
    setError('');
    setSaved(false);
    setGeneratedResume(buildResumeData());
    setActiveSection('template');
  };

  const onSaveBuiltResume = async () => {
    if (!generatedResume) return;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await api.post('/resume/build', generatedResume);
      setSaved(true);
    } catch (err) {
      setError(apiError(err, 'Unable to save resume details'));
    } finally {
      setLoading(false);
    }
  };

  // ── PDF download (unchanged logic) ───────────────────────────────────────
  const onDownloadPdf = () => {
    if (!generatedResume) return;
    const tplConfig = {
      classic:  { headingColor: [30,41,59],  bodyColor: [45,55,72],   accentColor: [67,97,238],  metaColor: [67,84,105] },
      minimal:  { headingColor: [17,24,39],  bodyColor: [31,41,55],   accentColor: [99,102,112], metaColor: [75,85,99] },
      modern:   { headingColor: [255,255,255], bodyColor: [39,49,71], accentColor: [44,62,124],  metaColor: [228,234,247] },
    }[selectedTemplate];

    const doc = new jsPDF('p','mm','a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 14;
    const cw = pw - m * 2;
    let y = 12;

    const ensureSpace = (req = 12) => { if (y + req > ph - 12) { doc.addPage(); y = 14; } };
    const addSection = (title) => {
      ensureSpace(12);
      doc.setDrawColor(...tplConfig.accentColor);
      doc.setLineWidth(0.6);
      doc.line(m, y+1.5, m+18, y+1.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(12);
      doc.setTextColor(...tplConfig.headingColor);
      doc.text(title, m+22, y+2.5);
      y += 9;
    };
    const addPara = (text, indent=0) => {
      const lines = doc.splitTextToSize(String(text||'-'), cw-indent);
      ensureSpace(lines.length*5.2+2);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
      doc.setTextColor(...tplConfig.bodyColor);
      doc.text(lines, m+indent, y);
      y += lines.length*5.2+2.2;
    };
    const addMeta = (l, r='') => {
      ensureSpace(7);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
      doc.setTextColor(...tplConfig.metaColor);
      doc.text(String(l||'-'), m, y);
      if (r) doc.text(String(r), pw-m, y, {align:'right'});
      y += 5.6;
    };
    const addBullets = (items=[]) => {
      items.forEach(item => {
        ensureSpace(7);
        doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(...tplConfig.bodyColor);
        doc.text('•', m+1.5, y);
        const lines = doc.splitTextToSize(String(item||'-'), cw-7);
        doc.text(lines, m+6, y);
        y += lines.length*5.2+1.6;
      });
    };

    // Header
    if (selectedTemplate === 'modern') {
      doc.setFillColor(...tplConfig.accentColor);
      doc.roundedRect(m,y-2,cw,32,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(...tplConfig.headingColor);
      doc.text(generatedResume.basic.name||'Candidate', m+4, y+9);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(...tplConfig.metaColor);
      doc.text(`${generatedResume.basic.email||'-'}  |  ${generatedResume.basic.phone||'-'}  |  ${generatedResume.basic.location||'-'}`, m+4, y+15);
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
      doc.text(`Domain: ${generatedResume.basic.domain||'-'}`, m+4, y+22);
    } else {
      doc.setFillColor(245,248,255);
      doc.roundedRect(m,y-2,cw,28,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(...tplConfig.headingColor);
      doc.text(generatedResume.basic.name||'Candidate', m+4, y+8);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(...tplConfig.metaColor);
      doc.text(`${generatedResume.basic.email||'-'}  |  ${generatedResume.basic.phone||'-'}  |  ${generatedResume.basic.location||'-'}`, m+4, y+14);
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...tplConfig.accentColor);
      doc.text(`Domain: ${generatedResume.basic.domain||'-'}`, m+4, y+20);
    }
    y += 33;

    addSection('Professional Summary'); addPara(generatedResume.basic.bio||'-');
    addSection('Skills'); addBullets(generatedResume.skills||[]);
    addSection('Education');
    addMeta(`${generatedResume.education.degree||'-'}${generatedResume.education.field_of_study?` (${generatedResume.education.field_of_study})`:''}`, `${generatedResume.education.start_year||'-'} - ${generatedResume.education.end_year||'-'}`);
    addMeta(generatedResume.education.college_name||'-', generatedResume.education.university_name||'-');
    if (generatedResume.education.gpa) addMeta(`GPA: ${generatedResume.education.gpa}`);

    if (generatedResume.placements?.length) {
      addSection('Experience');
      generatedResume.placements.forEach(item => { addMeta(`${item.role||'-'} — ${item.company||'-'}`, item.duration||''); addPara(item.description||'-', 2); });
    }
    if (generatedResume.projects?.length) {
      addSection('Projects');
      generatedResume.projects.forEach(item => { addMeta(item.project_name||'-'); addPara(item.project_description||'-', 2); if (item.project_link) addPara(`Link: ${item.project_link}`, 2); });
    }
    if (generatedResume.certificates?.length) {
      addSection('Certifications');
      generatedResume.certificates.forEach(item => { addMeta(item.certificate_name||'-', item.certificate_date||''); addPara(item.certificate_issuer||'-', 2); });
    }

    doc.setDrawColor(220,226,237); doc.line(m,ph-14,pw-m,ph-14);
    doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(107,114,128);
    doc.text(`Generated by Vidyamitra Resume Builder`, m, ph-9);
    doc.save(`${(generatedResume.basic.name||'resume').replace(/\s+/g,'_')}_${selectedTemplate}.pdf`);
  };

  // ── Upload handler ───────────────────────────────────────────────────────
  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a PDF file.'); return; }
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (formData.leetcode?.trim()) {
        form.append('leetcode_username', formData.leetcode.trim());
      }
      if (formData.codeforces?.trim()) {
        form.append('codeforces_handle', formData.codeforces.trim());
      }
      if (formData.codechef?.trim()) {
        form.append('codechef_username', formData.codechef.trim());
      }
      if (formData.github?.trim()) {
        form.append('github_username', formData.github.trim());
      }
      const { data } = await api.post('/resume/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data || null);
    } catch (err) {
      setError(apiError(err, 'Resume upload failed'));
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <section className="panel" style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div className="panel-header">
        <h2>Resume Builder</h2>
        <p className="muted">Build a stunning resume or upload yours for AI analysis</p>
        <div className="tabs" style={{ marginTop: '0.7rem' }}>
          {[
            { id: 'upload', label: '📄 Upload & Analyse' },
            { id: 'build',  label: '✏ Build Resume' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`tab ${mode === tab.id ? 'active' : ''}`}
              onClick={() => { setMode(tab.id); setError(''); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────── UPLOAD MODE ─────────────────────────── */}
      {mode === 'upload' && (
        <>
          <form onSubmit={onUpload} style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '2px dashed #334155',
            borderRadius: '16px',
            padding: '2.5rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📎</div>
            <h3 style={{ margin: '0 0 0.4rem', color: '#e2e8f0' }}>Upload Your Resume</h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>PDF format only · AI-powered analysis in ~30 seconds</p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.65rem',
              marginBottom: '1rem',
              textAlign: 'left',
            }}>
              <input
                value={formData.leetcode}
                onChange={e => onFieldChange('leetcode', e.target.value)}
                placeholder="LeetCode username / URL (optional)"
                style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }}
              />
              <input
                value={formData.codeforces}
                onChange={e => onFieldChange('codeforces', e.target.value)}
                placeholder="Codeforces handle / URL (optional)"
                style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }}
              />
              <input
                value={formData.github}
                onChange={e => onFieldChange('github', e.target.value)}
                placeholder="GitHub username / URL (optional)"
                style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }}
              />
              <input
                value={formData.codechef}
                onChange={e => onFieldChange('codechef', e.target.value)}
                placeholder="CodeChef username / URL (optional)"
                style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }}
              />
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: '#1e293b', border: '1px solid #475569',
              borderRadius: '10px', padding: '0.75rem 1.5rem',
              cursor: 'pointer', color: '#94a3b8', marginBottom: '1.25rem',
              transition: 'all 0.2s',
            }}>
              {file ? `✅ ${file.name}` : '📂 Choose PDF file'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            <br />
            <button type="submit" className="btn" disabled={loading} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
              {loading ? '⏳ Analysing...' : '🔍 Analyse Resume'}
            </button>
          </form>

          {error && <div className="error-box">{error}</div>}
        </>
      )}

      {/* ─────────────────────────── BUILD MODE ─────────────────────────── */}
      {mode === 'build' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Section sidebar */}
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '1rem',
            position: 'sticky',
            top: '80px',
          }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: '0.75rem', padding: '0 0.5rem' }}>Sections</p>
            {BUILD_SECTIONS.map(sec => {
              const done = (() => {
                if (sec.id === 'basics') return formData.firstName && formData.email;
                if (sec.id === 'skills') return formData.skills.trim().length > 0;
                if (sec.id === 'education') return formData.collegeName.trim().length > 0;
                if (sec.id === 'experience') return formData.placements.some(p => p.company);
                if (sec.id === 'projects') return formData.projects.some(p => p.project_name);
                if (sec.id === 'certifications') return formData.certificates.some(c => c.certificate_name);
                return false;
              })();
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    width: '100%', padding: '0.65rem 0.75rem',
                    borderRadius: '10px', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: '0.875rem',
                    background: activeSection === sec.id ? 'linear-gradient(135deg, #6366f120, #818cf820)' : 'transparent',
                    color: activeSection === sec.id ? '#818cf8' : '#64748b',
                    fontWeight: activeSection === sec.id ? 600 : 400,
                    transition: 'all 0.15s',
                    marginBottom: '2px',
                  }}
                >
                  <span>{sec.icon}</span>
                  <span style={{ flex: 1 }}>{sec.label}</span>
                  {done && <span style={{ fontSize: '0.65rem', color: '#22c55e' }}>✓</span>}
                </button>
              );
            })}
            <div style={{ borderTop: '1px solid #1e293b', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                style={{ width: '100%', padding: '0.65rem' }}
                onClick={onBuildResume}
              >
                ✨ Build Resume
              </button>
              {generatedResume && (
                <>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem' }}
                    disabled={loading}
                    onClick={onSaveBuiltResume}
                  >
                    {loading ? 'Saving…' : '💾 Save & Analyse'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem' }}
                    onClick={onDownloadPdf}
                  >
                    ⬇ Download PDF
                  </button>
                </>
              )}
            </div>
            {saved && <div style={{ fontSize: '0.8rem', color: '#22c55e', textAlign: 'center', marginTop: '0.5rem' }}>✅ Saved!</div>}
            {error && <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.5rem', padding: '0 0.25rem' }}>{error}</div>}
          </div>

          {/* Main form + preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── Live Preview ── */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>👁 Live Preview</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.value}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.value)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '8px',
                        border: selectedTemplate === tpl.value ? '2px solid #6366f1' : '1px solid #334155',
                        background: selectedTemplate === tpl.value ? '#6366f120' : 'transparent',
                        color: selectedTemplate === tpl.value ? '#818cf8' : '#64748b',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: selectedTemplate === tpl.value ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1.5rem', background: '#111827' }}>
                <div style={{ maxWidth: '100%', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                  <LiveResumePreview formData={formData} selectedTemplate={selectedTemplate} />
                </div>
              </div>
            </div>

            {/* ── Form sections ── */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.75rem' }}>
              <h3 style={{ margin: '0 0 1.25rem', color: '#e2e8f0', fontSize: '1rem' }}>
                {BUILD_SECTIONS.find(s => s.id === activeSection)?.icon}{' '}
                {BUILD_SECTIONS.find(s => s.id === activeSection)?.label}
              </h3>

              {/* Personal Info */}
              {activeSection === 'basics' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'First Name *', key: 'firstName', span: 1 },
                    { label: 'Last Name',    key: 'lastName',  span: 1 },
                    { label: 'Email *',      key: 'email',     span: 1 },
                    { label: 'Phone',        key: 'phone',     span: 1 },
                    { label: 'Location',     key: 'location',  span: 1 },
                    { label: 'Primary Domain (e.g. AI/ML, Web Dev)', key: 'domain', span: 1 },
                    { label: 'LinkedIn URL', key: 'linkedin',  span: 1 },
                    { label: 'GitHub Username / URL (optional)', key: 'github', span: 1 },
                    { label: 'LeetCode Username / URL (optional)', key: 'leetcode', span: 1 },
                    { label: 'Codeforces Handle / URL (optional)', key: 'codeforces', span: 1 },
                    { label: 'CodeChef Username / URL (optional)', key: 'codechef', span: 1 },
                  ].map(f => (
                    <div key={f.key} style={{ gridColumn: f.span === 2 ? '1 / -1' : 'auto' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>{f.label}</label>
                      <input
                        value={formData[f.key]}
                        onChange={e => onFieldChange(f.key, e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Professional Summary / Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={e => onFieldChange('bio', e.target.value)}
                      rows={4}
                      placeholder="A passionate software engineer with experience in..."
                      style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              )}

              {/* Skills */}
              {activeSection === 'skills' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Skills (comma separated)</label>
                  <textarea
                    value={formData.skills}
                    onChange={e => onFieldChange('skills', e.target.value)}
                    rows={4}
                    placeholder="Python, FastAPI, React, PostgreSQL, Docker, Machine Learning…"
                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  {formData.skills && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                      {formData.skills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                        <span key={i} style={{ background: '#6366f120', border: '1px solid #6366f140', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: '#a5b4fc' }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Education */}
              {activeSection === 'education' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Degree (e.g. B.Tech, B.E.)', key: 'degree' },
                    { label: 'Field of Study',              key: 'fieldOfStudy' },
                    { label: 'College / School Name',       key: 'collegeName' },
                    { label: 'University Name',             key: 'universityName' },
                    { label: 'GPA / Percentage',            key: 'gpa' },
                    { label: '',                            key: '_spacer' },
                    { label: 'Start Year',                  key: 'startYear' },
                    { label: 'End Year',                    key: 'endYear' },
                  ].map(f => (
                    f.key === '_spacer' ? <div key="_spacer" /> :
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>{f.label}</label>
                      <input
                        value={formData[f.key]}
                        onChange={e => onFieldChange(f.key, e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Experience */}
              {activeSection === 'experience' && (
                <div>
                  {formData.placements.map((pl, idx) => (
                    <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        {[
                          { label: 'Company',  key: 'company' },
                          { label: 'Role',     key: 'role' },
                          { label: 'Duration (e.g. Jun 2024 – Present)', key: 'duration' },
                        ].map(f => (
                          <div key={f.key} style={{ gridColumn: f.key === 'duration' ? '1 / -1' : 'auto' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{f.label}</label>
                            <input value={pl[f.key]} onChange={e => updateListItem('placements', idx, f.key, e.target.value)}
                              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Description / Responsibilities</label>
                      <textarea value={pl.description} onChange={e => updateListItem('placements', idx, 'description', e.target.value)} rows={3}
                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                      <button type="button" className="btn ghost" style={{ marginTop: '0.5rem', padding: '0.4rem 0.9rem', fontSize: '0.78rem' }} onClick={() => removeListItem('placements', idx)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => addListItem('placements', emptyPlacement)}>+ Add Experience</button>
                </div>
              )}

              {/* Projects */}
              {activeSection === 'projects' && (
                <div>
                  {formData.projects.map((proj, idx) => (
                    <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Project Name</label>
                      <input value={proj.project_name} onChange={e => updateListItem('projects', idx, 'project_name', e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Description</label>
                      <textarea value={proj.project_description} onChange={e => updateListItem('projects', idx, 'project_description', e.target.value)} rows={3}
                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '0.75rem' }} />
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>GitHub / Project Link</label>
                      <input value={proj.project_link} onChange={e => updateListItem('projects', idx, 'project_link', e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                      <button type="button" className="btn ghost" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem' }} onClick={() => removeListItem('projects', idx)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => addListItem('projects', emptyProject)}>+ Add Project</button>
                </div>
              )}

              {/* Certifications */}
              {activeSection === 'certifications' && (
                <div>
                  {formData.certificates.map((cert, idx) => (
                    <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {[
                          { label: 'Certificate Name', key: 'certificate_name' },
                          { label: 'Issuer / Platform', key: 'certificate_issuer' },
                          { label: 'Issue Date (YYYY-MM-DD)', key: 'certificate_date' },
                        ].map(f => (
                          <div key={f.key} style={{ gridColumn: f.key === 'certificate_name' ? '1 / -1' : 'auto' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{f.label}</label>
                            <input value={cert[f.key]} onChange={e => updateListItem('certificates', idx, f.key, e.target.value)}
                              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                      <button type="button" className="btn ghost" style={{ marginTop: '0.75rem', padding: '0.4rem 0.9rem', fontSize: '0.78rem' }} onClick={() => removeListItem('certificates', idx)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => addListItem('certificates', emptyCertificate)}>+ Add Certification</button>
                </div>
              )}

              {/* Template (after building) */}
              {activeSection === 'template' && (
                <div>
                  {generatedResume ? (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
                      <h3 style={{ color: '#e2e8f0', marginBottom: '0.25rem' }}>Resume Ready!</h3>
                      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Switch templates using the preview bar above. Then save or download.</p>
                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={onSaveBuiltResume} disabled={loading}>{loading ? 'Saving…' : '💾 Save & Get AI Analysis'}</button>
                        <button className="btn ghost" onClick={onDownloadPdf}>⬇ Download PDF</button>
                      </div>
                      {saved && <div style={{ color: '#22c55e', marginTop: '1rem' }}>✅ Saved! Check the AI Analysis below.</div>}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      <p>Fill in your details first, then click "✨ Build Resume".</p>
                      <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setActiveSection('basics')}>Start with Personal Info →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── AI ANALYSIS RESULT ──────────────────── */}
      {result && (
        <div className="result-card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Resume Analysis</h3>
            <button
              type="button"
              className="btn ghost"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
              onClick={() => setResult(null)}
            >
              ✕ Clear
            </button>
          </div>

          {normalizedResult.resume_score !== undefined && normalizedResult.resume_score !== null && (
            <div className="metric-card">
              <span>Resume Score</span>
              <strong>{normalizedResult.resume_score} / 100</strong>
            </div>
          )}

          <div className="analysis-cards">
            {/* Overall Analysis */}
            <article className="analysis-card">
              <h4>💬 Analysis</h4>
              <div className="markdown-content">
                <ReactMarkdown>{String(normalizedResult.analysis || '-')}</ReactMarkdown>
              </div>
            </article>

            {/* Skill Cards */}
            {(() => {
              const sa = normalizedResult.skill_analysis;
              if (!sa) return null;
              const skills = Array.isArray(sa.skills) ? sa.skills : [];
              const analysis = typeof sa.analysis === 'string' ? sa.analysis : typeof sa === 'string' ? sa : '';
              return (
                <article className="analysis-card" style={{ gridColumn: '1 / -1' }}>
                  <h4>🎯 Skills to Improve</h4>
                  {analysis && <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{analysis}</p>}
                  {skills.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {skills.map((skill, i) => (
                        <div key={i} style={{
                          background: 'linear-gradient(135deg, #6366f110, #818cf810)',
                          border: '1px solid #6366f130', borderRadius: '12px',
                          padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>⚡ {skill}</span>
                          <button className="btn" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                            onClick={() => navigate(`/roadmap?topic=${encodeURIComponent(skill)}&context=skill`)}>
                            Generate Roadmap →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#22c55e', fontWeight: 500 }}>✅ You are good to go!</p>
                  )}
                </article>
              );
            })()}

            {/* Project Cards */}
            {(() => {
              const sp = normalizedResult.suggested_projects;
              if (!sp) return null;
              const projects = Array.isArray(sp) ? sp : [];
              return (
                <article className="analysis-card" style={{ gridColumn: '1 / -1' }}>
                  <h4>🚀 Suggested Projects</h4>
                  {projects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                      {projects.map((proj, i) => (
                        <div key={i} style={{
                          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                          border: '1px solid #334155', borderRadius: '14px',
                          padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                        }}>
                          <h5 style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>🛠 {proj.name}</h5>
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5 }}>{proj.description}</p>
                          {Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {proj.tech_stack.map((t, j) => (
                                <span key={j} style={{ background: '#6366f120', border: '1px solid #6366f140', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#a5b4fc' }}>{t}</span>
                              ))}
                            </div>
                          )}
                          <button className="btn" style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', marginTop: '0.25rem' }}
                            onClick={() => navigate(`/roadmap?topic=${encodeURIComponent(proj.name)}&context=project`)}>
                            Generate Roadmap →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#22c55e', fontWeight: 500 }}>✅ Your projects are already strong — keep it up!</p>
                  )}
                </article>
              );
            })()}

            {/* Coding Profile Insights */}
            {(() => {
              const cpa = normalizedResult.coding_profiles_analysis;
              const cp = normalizedResult.coding_profiles;
              if (!cpa && !cp) return null;

              const leetcode = cp?.leetcode;
              const codeforces = cp?.codeforces;
              const github = cp?.github;
              const profileHandles = normalizedResult.coding_profile_usernames || {};
              const codechefHandle = typeof profileHandles.codechef === 'string' ? profileHandles.codechef.trim() : '';
              const cpaSuggestions = Array.isArray(cpa?.suggestions)
                ? cpa.suggestions.filter((item) => typeof item === 'string' && item.trim())
                : [];

              const lcSubmissionStats = leetcode?.submission_stats || {};
              const lcAllStats = lcSubmissionStats.all || {};
              const lcAcceptanceRate = lcAllStats.submissions > 0
                ? `${((lcAllStats.accepted / lcAllStats.submissions) * 100).toFixed(1)}%`
                : 'N/A';

              const consistencySignals = [];
              if (typeof leetcode?.streak_days === 'number') {
                consistencySignals.push(`LeetCode streak: ${leetcode.streak_days} days`);
              }
              if (typeof codeforces?.contests === 'number') {
                consistencySignals.push(`Codeforces contests played: ${codeforces.contests}`);
              }
              if (typeof github?.repo_count === 'number') {
                consistencySignals.push(`GitHub public repos: ${github.repo_count}`);
              }

              return (
                <article className="analysis-card" style={{ gridColumn: '1 / -1' }}>
                  <h4>📈 Detailed Coding Profile Analysis</h4>

                  {cpa?.analysis && (
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                      {cpa.analysis}
                    </p>
                  )}

                  {cpa?.overall_profile_signal && (
                    <div style={{ marginBottom: '0.8rem' }}>
                      <span style={{
                        background: '#0ea5e920',
                        border: '1px solid #0ea5e940',
                        borderRadius: '999px',
                        padding: '0.25rem 0.7rem',
                        fontSize: '0.8rem',
                        color: '#7dd3fc',
                      }}>
                        Signal: {cpa.overall_profile_signal}
                      </span>
                    </div>
                  )}

                  {consistencySignals.length > 0 && (
                    <div style={{
                      marginBottom: '0.9rem',
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      padding: '0.75rem',
                    }}>
                      <h5 style={{ margin: '0 0 0.45rem', color: '#e2e8f0', fontSize: '0.88rem' }}>
                        Consistency Snapshot
                      </h5>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                        {consistencySignals.join(' • ')}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.35rem', color: '#e2e8f0' }}>LeetCode</h5>
                      {leetcode ? (
                        <>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            @{leetcode.username}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Total Solved: {leetcode.total_solved} • E/M/H: {leetcode.easy}/{leetcode.medium}/{leetcode.hard}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Acceptance Rate: {lcAcceptanceRate}
                          </p>
                          {leetcode.contest_rating != null && (
                            <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                              Contest Rating: {leetcode.contest_rating}
                            </p>
                          )}
                          {leetcode.streak_days != null && (
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                              Current Streak: {leetcode.streak_days} days
                            </p>
                          )}
                        </>
                      ) : (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>No profile provided/fetched.</p>
                      )}
                      {cpa?.leetcode_insight && (
                        <p style={{ margin: '0.45rem 0 0', color: '#cbd5e1', fontSize: '0.82rem' }}>{cpa.leetcode_insight}</p>
                      )}
                    </div>

                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.35rem', color: '#e2e8f0' }}>Codeforces</h5>
                      {codeforces ? (
                        <>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            @{codeforces.handle}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Rating: {codeforces.rating} • Max: {codeforces.max_rating}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Rank: {codeforces.rank} • Peak Rank: {codeforces.max_rank}
                          </p>
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                            Contests: {codeforces.contests}
                          </p>
                        </>
                      ) : (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>No profile provided/fetched.</p>
                      )}
                      {cpa?.codeforces_insight && (
                        <p style={{ margin: '0.45rem 0 0', color: '#cbd5e1', fontSize: '0.82rem' }}>{cpa.codeforces_insight}</p>
                      )}
                    </div>

                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.35rem', color: '#e2e8f0' }}>GitHub</h5>
                      {github ? (
                        <>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            @{github.username}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Repos: {github.repo_count} • Stars: {github.total_stars}
                          </p>
                          <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Followers: {github.followers} • Following: {github.following}
                          </p>
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                            Top Languages: {(github.top_languages || []).join(', ') || 'none'}
                          </p>
                        </>
                      ) : (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>No profile provided/fetched.</p>
                      )}
                      {cpa?.github_insight && (
                        <p style={{ margin: '0.45rem 0 0', color: '#cbd5e1', fontSize: '0.82rem' }}>{cpa.github_insight}</p>
                      )}
                    </div>

                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.35rem', color: '#e2e8f0' }}>CodeChef</h5>
                      {codechefHandle ? (
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                          @{codechefHandle} (username saved)
                        </p>
                      ) : (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>No profile provided/fetched.</p>
                      )}
                    </div>
                  </div>

                  {cpaSuggestions.length > 0 && (
                    <div style={{ marginTop: '0.95rem' }}>
                      <h5 style={{ margin: '0 0 0.45rem', color: '#f1f5f9', fontWeight: 700 }}>Suggested Profile Actions</h5>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#f1f5f9', fontSize: '0.84rem', lineHeight: 1.55 }}>
                        {cpaSuggestions.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

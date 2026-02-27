import { useState } from 'react';
import { api, apiError } from '../api';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

const emptyCertificate = { certificate_name: '', certificate_issuer: '', certificate_date: '' };
const emptyProject = { project_name: '', project_description: '', project_link: '' };
const emptyPlacement = { company: '', role: '', duration: '', description: '' };

export default function ResumeUploadPage() {
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [generatedResume, setGeneratedResume] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    domain: '',
    skills: '',
    degree: '',
    fieldOfStudy: '',
    collegeName: '',
    universityName: '',
    gpa: '',
    startYear: '',
    endYear: '',
    certificates: [{ ...emptyCertificate }],
    projects: [{ ...emptyProject }],
    placements: [{ ...emptyPlacement }],
  });

  const normalizedResult = result?.data || result || {};

  const onFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const onBuildResume = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.email.trim()) {
      setError('Please provide at least First Name and Email to build the resume.');
      return;
    }

    setError('');
    setSaved(false);

    const built = {
      basic: {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        bio: formData.bio,
        domain: formData.domain,
      },
      skills: formData.skills
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      education: {
        degree: formData.degree,
        field_of_study: formData.fieldOfStudy,
        college_name: formData.collegeName,
        university_name: formData.universityName,
        gpa: formData.gpa,
        start_year: formData.startYear,
        end_year: formData.endYear,
      },
      certificates: formData.certificates.filter((item) => Object.values(item).some(Boolean)),
      projects: formData.projects.filter((item) => Object.values(item).some(Boolean)),
      placements: formData.placements.filter((item) => Object.values(item).some(Boolean)),
    };

    setGeneratedResume(built);
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
      setError(apiError(err, 'Unable to save generated resume details'));
    } finally {
      setLoading(false);
    }
  };

  const onDownloadPdf = () => {
    if (!generatedResume) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 12;

    const ensureSpace = (required = 12) => {
      if (y + required > pageHeight - 12) {
        doc.addPage();
        y = 14;
      }
    };

    const addSectionTitle = (title) => {
      ensureSpace(12);
      doc.setDrawColor(67, 97, 238);
      doc.setLineWidth(0.6);
      doc.line(margin, y + 1.5, margin + 18, y + 1.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(title, margin + 22, y + 2.5);
      y += 9;
    };

    const addParagraph = (text, options = {}) => {
      const { indent = 0, lineHeight = 5.2, spacing = 2.2 } = options;
      const printable = String(text || '-');
      const lines = doc.splitTextToSize(printable, contentWidth - indent);
      ensureSpace(lines.length * lineHeight + spacing + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(45, 55, 72);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + spacing;
    };

    const addMetaLine = (leftText, rightText = '') => {
      ensureSpace(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(71, 85, 105);
      doc.text(String(leftText || '-'), margin, y);
      if (rightText) {
        doc.text(String(rightText), pageWidth - margin, y, { align: 'right' });
      }
      y += 5.6;
    };

    const addBulletList = (items = []) => {
      if (!items.length) {
        addParagraph('-', { indent: 2 });
        return;
      }
      items.forEach((item) => {
        ensureSpace(7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(45, 55, 72);
        doc.text('•', margin + 1.5, y);
        const lines = doc.splitTextToSize(String(item || '-'), contentWidth - 7);
        doc.text(lines, margin + 6, y);
        y += lines.length * 5.2 + 1.6;
      });
    };

    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, y - 2, contentWidth, 28, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(generatedResume.basic.name || 'Candidate Name', margin + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(67, 84, 105);
    doc.text(
      `${generatedResume.basic.email || '-'}  |  ${generatedResume.basic.phone || '-'}  |  ${generatedResume.basic.location || '-'}`,
      margin + 4,
      y + 14
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(44, 62, 124);
    doc.text(`Primary Domain: ${generatedResume.basic.domain || '-'}`, margin + 4, y + 20);

    y += 33;

    addSectionTitle('Professional Summary');
    addParagraph(generatedResume.basic.bio || '-');

    addSectionTitle('Skills');
    addBulletList(generatedResume.skills || []);

    addSectionTitle('Education');
    addMetaLine(
      `${generatedResume.education.degree || '-'}${generatedResume.education.field_of_study ? ` (${generatedResume.education.field_of_study})` : ''}`,
      `${generatedResume.education.start_year || '-'} - ${generatedResume.education.end_year || '-'}`
    );
    addMetaLine(generatedResume.education.college_name || '-', generatedResume.education.university_name || '-');
    addMetaLine(`GPA: ${generatedResume.education.gpa || '-'}`);
    y += 1;

    addSectionTitle('Placements');
    if (generatedResume.placements?.length) {
      generatedResume.placements.forEach((item) => {
        addMetaLine(`${item.role || '-'} — ${item.company || '-'}`, item.duration || '');
        addParagraph(item.description || '-', { indent: 2, spacing: 2.8 });
      });
    } else {
      addParagraph('-');
    }

    addSectionTitle('Projects');
    if (generatedResume.projects?.length) {
      generatedResume.projects.forEach((item) => {
        addMetaLine(item.project_name || '-');
        addParagraph(item.project_description || '-', { indent: 2, spacing: 2.4 });
        if (item.project_link) {
          doc.setFont('helvetica', 'italic');
          addParagraph(`Link: ${item.project_link}`, { indent: 2, spacing: 3 });
        }
      });
    } else {
      addParagraph('-');
    }

    addSectionTitle('Certifications');
    if (generatedResume.certificates?.length) {
      generatedResume.certificates.forEach((item) => {
        addMetaLine(item.certificate_name || '-', item.certificate_date || '');
        addParagraph(item.certificate_issuer || '-', { indent: 2, spacing: 2.8 });
      });
    } else {
      addParagraph('-');
    }

    doc.setDrawColor(220, 226, 237);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated by Vidyamitra Resume Builder', margin, pageHeight - 9);

    doc.save(`${(generatedResume.basic.name || 'resume').replace(/\s+/g, '_')}.pdf`);
  };

  const updateListItem = (listKey, index, field, value) => {
    setFormData((prev) => {
      const next = [...prev[listKey]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [listKey]: next };
    });
  };

  const addListItem = (listKey, emptyItem) => {
    setFormData((prev) => ({ ...prev, [listKey]: [...prev[listKey], { ...emptyItem }] }));
  };

  const removeListItem = (listKey, index) => {
    setFormData((prev) => {
      const next = prev[listKey].filter((_, i) => i !== index);
      return { ...prev, [listKey]: next.length ? next : [{ ...(listKey === 'certificates' ? emptyCertificate : listKey === 'projects' ? emptyProject : emptyPlacement) }] };
    });
  };

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
        <p className="muted">Do you already have a resume?</p>
        <div className="tabs" style={{ marginTop: '0.7rem' }}>
          <button
            type="button"
            className={`tab ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => {
              setMode('upload');
              setError('');
            }}
          >
            Yes, I have resume
          </button>
          <button
            type="button"
            className={`tab ${mode === 'build' ? 'active' : ''}`}
            onClick={() => {
              setMode('build');
              setError('');
            }}
          >
            No, build for me
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <form onSubmit={onUpload} className="form compact">
          <label>Upload Resume (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload Resume'}
          </button>
        </form>
      ) : (
        <form onSubmit={onBuildResume} className="form compact">
          <h3>Candidate Basic Info</h3>
          <input placeholder="First Name" value={formData.firstName} onChange={(e) => onFieldChange('firstName', e.target.value)} />
          <input placeholder="Last Name" value={formData.lastName} onChange={(e) => onFieldChange('lastName', e.target.value)} />
          <input placeholder="Email" value={formData.email} onChange={(e) => onFieldChange('email', e.target.value)} />
          <input placeholder="Phone" value={formData.phone} onChange={(e) => onFieldChange('phone', e.target.value)} />
          <input placeholder="Location" value={formData.location} onChange={(e) => onFieldChange('location', e.target.value)} />
          <textarea placeholder="Professional Bio / Summary" rows={4} value={formData.bio} onChange={(e) => onFieldChange('bio', e.target.value)} />
          <input placeholder="Primary Domain (e.g., AI/ML, Web Development)" value={formData.domain} onChange={(e) => onFieldChange('domain', e.target.value)} />
          <input placeholder="Skills (comma separated)" value={formData.skills} onChange={(e) => onFieldChange('skills', e.target.value)} />

          <h3>Education</h3>
          <input placeholder="Degree" value={formData.degree} onChange={(e) => onFieldChange('degree', e.target.value)} />
          <input placeholder="Field of Study" value={formData.fieldOfStudy} onChange={(e) => onFieldChange('fieldOfStudy', e.target.value)} />
          <input placeholder="College Name" value={formData.collegeName} onChange={(e) => onFieldChange('collegeName', e.target.value)} />
          <input placeholder="University Name" value={formData.universityName} onChange={(e) => onFieldChange('universityName', e.target.value)} />
          <input placeholder="GPA" value={formData.gpa} onChange={(e) => onFieldChange('gpa', e.target.value)} />
          <input placeholder="Start Year" value={formData.startYear} onChange={(e) => onFieldChange('startYear', e.target.value)} />
          <input placeholder="End Year" value={formData.endYear} onChange={(e) => onFieldChange('endYear', e.target.value)} />

          <h3>Placements</h3>
          {formData.placements.map((placement, index) => (
            <div key={`placement-${index}`} className="detail-block">
              <input placeholder="Company" value={placement.company} onChange={(e) => updateListItem('placements', index, 'company', e.target.value)} />
              <input placeholder="Role" value={placement.role} onChange={(e) => updateListItem('placements', index, 'role', e.target.value)} />
              <input placeholder="Duration" value={placement.duration} onChange={(e) => updateListItem('placements', index, 'duration', e.target.value)} />
              <textarea placeholder="Placement Description" rows={3} value={placement.description} onChange={(e) => updateListItem('placements', index, 'description', e.target.value)} />
              <button type="button" className="btn ghost" onClick={() => removeListItem('placements', index)}>Remove Placement</button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => addListItem('placements', emptyPlacement)}>+ Add Placement</button>

          <h3>Certifications</h3>
          {formData.certificates.map((cert, index) => (
            <div key={`cert-${index}`} className="detail-block">
              <input placeholder="Certificate Name" value={cert.certificate_name} onChange={(e) => updateListItem('certificates', index, 'certificate_name', e.target.value)} />
              <input placeholder="Certificate Issuer" value={cert.certificate_issuer} onChange={(e) => updateListItem('certificates', index, 'certificate_issuer', e.target.value)} />
              <input placeholder="Certificate Date (YYYY-MM-DD)" value={cert.certificate_date} onChange={(e) => updateListItem('certificates', index, 'certificate_date', e.target.value)} />
              <button type="button" className="btn ghost" onClick={() => removeListItem('certificates', index)}>Remove Certification</button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => addListItem('certificates', emptyCertificate)}>+ Add Certification</button>

          <h3>Projects</h3>
          {formData.projects.map((project, index) => (
            <div key={`project-${index}`} className="detail-block">
              <input placeholder="Project Name" value={project.project_name} onChange={(e) => updateListItem('projects', index, 'project_name', e.target.value)} />
              <textarea placeholder="Project Description" rows={4} value={project.project_description} onChange={(e) => updateListItem('projects', index, 'project_description', e.target.value)} />
              <input placeholder="Project Link" value={project.project_link} onChange={(e) => updateListItem('projects', index, 'project_link', e.target.value)} />
              <button type="button" className="btn ghost" onClick={() => removeListItem('projects', index)}>Remove Project</button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => addListItem('projects', emptyProject)}>+ Add Project</button>

          <div className="between">
            <button type="submit" className="btn">Build Resume</button>
            {generatedResume && <button type="button" className="btn" onClick={onSaveBuiltResume} disabled={loading}>{loading ? 'Saving...' : 'Save Resume Details'}</button>}
            {generatedResume && <button type="button" className="btn ghost" onClick={onDownloadPdf}>Download PDF</button>}
          </div>
        </form>
      )}

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

      {mode === 'build' && generatedResume && (
        <div className="result-card">
          <h3>Generated Resume Preview</h3>
          {saved && <div className="success-box">Resume details saved successfully.</div>}

          <div className="analysis-cards">
            <article className="analysis-card">
              <h4>{generatedResume.basic.name || '-'}</h4>
              <p>{generatedResume.basic.email || '-'} | {generatedResume.basic.phone || '-'}</p>
              <p>{generatedResume.basic.location || '-'}</p>
              <p><strong>Domain:</strong> {generatedResume.basic.domain || '-'}</p>
            </article>

            <article className="analysis-card">
              <h4>Professional Summary</h4>
              <p>{generatedResume.basic.bio || '-'}</p>
            </article>

            <article className="analysis-card">
              <h4>Education</h4>
              <p><strong>{generatedResume.education.degree || '-'}</strong> {generatedResume.education.field_of_study ? `(${generatedResume.education.field_of_study})` : ''}</p>
              <p>{generatedResume.education.college_name || '-'} | {generatedResume.education.university_name || '-'}</p>
              <p>{generatedResume.education.start_year || '-'} - {generatedResume.education.end_year || '-'} {generatedResume.education.gpa ? `| GPA: ${generatedResume.education.gpa}` : ''}</p>
            </article>

            <article className="analysis-card">
              <h4>Placements</h4>
              {(generatedResume.placements || []).length > 0 ? generatedResume.placements.map((item, idx) => (
                <div key={`preview-placement-${idx}`}>
                  <p><strong>{item.role || '-'}</strong> — {item.company || '-'}</p>
                  <p>{item.duration || '-'}</p>
                  <p>{item.description || '-'}</p>
                </div>
              )) : <p>-</p>}
            </article>

            <article className="analysis-card">
              <h4>Projects</h4>
              {(generatedResume.projects || []).length > 0 ? generatedResume.projects.map((item, idx) => (
                <div key={`preview-project-${idx}`}>
                  <p><strong>{item.project_name || '-'}</strong></p>
                  <p>{item.project_description || '-'}</p>
                  {item.project_link && <p><strong>Link:</strong> {item.project_link}</p>}
                </div>
              )) : <p>-</p>}
            </article>

            <article className="analysis-card">
              <h4>Certifications</h4>
              {(generatedResume.certificates || []).length > 0 ? generatedResume.certificates.map((item, idx) => (
                <div key={`preview-cert-${idx}`}>
                  <p><strong>{item.certificate_name || '-'}</strong></p>
                  <p>{item.certificate_issuer || '-'}</p>
                  <p>{item.certificate_date || '-'}</p>
                </div>
              )) : <p>-</p>}
            </article>

            <article className="analysis-card">
              <h4>Skills</h4>
              <p>{generatedResume.skills.length ? generatedResume.skills.join(', ') : '-'}</p>
            </article>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}

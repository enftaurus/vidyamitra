import { useState } from 'react';
import DynamicHeadline from '../components/DynamicHeadline';

const CHART_COLORS = [
  '#5b74e6', '#e6735b', '#5be6a0', '#e6c75b', '#b05be6',
  '#5bc8e6', '#e65ba0', '#8be65b', '#e6985b', '#5b5be6',
  '#c85be6', '#5be6d4',
];

const domains = ['Data Science', 'Web Development', 'Cloud / DevOps', 'Cybersecurity', 'AI / ML', 'Mobile Development'];

const marketData = {
  'Data Science': {
    totalJobs: 12480,
    avgSalary: '₹12.5 LPA',
    growth: '+18%',
    competition: 'High',
    topCompanies: [
      { name: 'Accenture', pct: 15.9 },
      { name: 'Amazon', pct: 14.0 },
      { name: 'Apple', pct: 12.2 },
      { name: 'Google', pct: 8.4 },
      { name: 'Facebook', pct: 9.3 },
      { name: 'Microsoft', pct: 8.4 },
      { name: 'Intel', pct: 6.4 },
      { name: 'Twitter', pct: 8.4 },
      { name: 'Oracle', pct: 7.5 },
      { name: 'PayPal', pct: 7.1 },
      { name: 'Others', pct: 2.4 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 5.2 },
      { label: '1-3 yr', value: 8.4 },
      { label: '3-5 yr', value: 12.8 },
      { label: '5-7 yr', value: 18.5 },
      { label: '7-10 yr', value: 24.0 },
      { label: '10+ yr', value: 32.5 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 28.5 },
      { city: 'Hyderabad', pct: 18.2 },
      { city: 'Pune', pct: 14.1 },
      { city: 'Mumbai', pct: 11.8 },
      { city: 'Chennai', pct: 9.4 },
      { city: 'Delhi NCR', pct: 8.6 },
      { city: 'Kolkata', pct: 4.2 },
      { city: 'Others', pct: 5.2 },
    ],
    jobRoles: [
      { role: 'Data Scientist', count: 3200 },
      { role: 'Senior Data Scientist', count: 2100 },
      { role: 'Data Analyst', count: 2800 },
      { role: 'ML Engineer', count: 1950 },
      { role: 'Data Engineer', count: 1380 },
      { role: 'Lead Data Scientist', count: 520 },
      { role: 'Principal Scientist', count: 280 },
      { role: 'Associate Analyst', count: 250 },
    ],
    skills: [
      { name: 'Python', demand: 92 },
      { name: 'SQL', demand: 85 },
      { name: 'Machine Learning', demand: 78 },
      { name: 'TensorFlow', demand: 62 },
      { name: 'Spark', demand: 55 },
      { name: 'Tableau', demand: 48 },
      { name: 'AWS', demand: 44 },
      { name: 'Docker', demand: 38 },
    ],
  },
  'Web Development': {
    totalJobs: 18340,
    avgSalary: '₹10.8 LPA',
    growth: '+22%',
    competition: 'Very High',
    topCompanies: [
      { name: 'TCS', pct: 14.2 },
      { name: 'Infosys', pct: 12.8 },
      { name: 'Wipro', pct: 9.5 },
      { name: 'Amazon', pct: 8.1 },
      { name: 'Flipkart', pct: 7.4 },
      { name: 'Paytm', pct: 6.2 },
      { name: 'Google', pct: 5.8 },
      { name: 'Microsoft', pct: 5.5 },
      { name: 'Zoho', pct: 5.0 },
      { name: 'Swiggy', pct: 4.5 },
      { name: 'Others', pct: 21.0 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 4.0 },
      { label: '1-3 yr', value: 7.2 },
      { label: '3-5 yr', value: 11.5 },
      { label: '5-7 yr', value: 16.0 },
      { label: '7-10 yr', value: 22.0 },
      { label: '10+ yr', value: 30.0 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 32.0 },
      { city: 'Hyderabad', pct: 16.5 },
      { city: 'Pune', pct: 13.8 },
      { city: 'Mumbai', pct: 10.2 },
      { city: 'Chennai', pct: 8.8 },
      { city: 'Delhi NCR', pct: 9.4 },
      { city: 'Jaipur', pct: 4.1 },
      { city: 'Others', pct: 5.2 },
    ],
    jobRoles: [
      { role: 'Full Stack Developer', count: 5200 },
      { role: 'Frontend Developer', count: 4100 },
      { role: 'Backend Developer', count: 3600 },
      { role: 'React Developer', count: 2200 },
      { role: 'Node.js Developer', count: 1500 },
      { role: 'UI/UX Developer', count: 980 },
      { role: 'Lead Engineer', count: 460 },
      { role: 'DevOps Engineer', count: 300 },
    ],
    skills: [
      { name: 'JavaScript', demand: 95 },
      { name: 'React', demand: 88 },
      { name: 'Node.js', demand: 76 },
      { name: 'TypeScript', demand: 68 },
      { name: 'CSS/Tailwind', demand: 65 },
      { name: 'MongoDB', demand: 52 },
      { name: 'PostgreSQL', demand: 48 },
      { name: 'Docker', demand: 40 },
    ],
  },
  'Cloud / DevOps': {
    totalJobs: 9820,
    avgSalary: '₹14.2 LPA',
    growth: '+28%',
    competition: 'Medium',
    topCompanies: [
      { name: 'Amazon (AWS)', pct: 18.5 },
      { name: 'Microsoft', pct: 14.2 },
      { name: 'Google', pct: 10.0 },
      { name: 'TCS', pct: 8.8 },
      { name: 'Infosys', pct: 7.5 },
      { name: 'Wipro', pct: 6.2 },
      { name: 'IBM', pct: 5.8 },
      { name: 'Accenture', pct: 5.5 },
      { name: 'HCL', pct: 5.0 },
      { name: 'Deloitte', pct: 4.5 },
      { name: 'Others', pct: 14.0 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 5.5 },
      { label: '1-3 yr', value: 9.0 },
      { label: '3-5 yr', value: 14.0 },
      { label: '5-7 yr', value: 20.5 },
      { label: '7-10 yr', value: 28.0 },
      { label: '10+ yr', value: 38.0 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 30.0 },
      { city: 'Hyderabad', pct: 20.5 },
      { city: 'Pune', pct: 12.0 },
      { city: 'Mumbai', pct: 10.5 },
      { city: 'Chennai', pct: 9.0 },
      { city: 'Delhi NCR', pct: 10.0 },
      { city: 'Kolkata', pct: 3.5 },
      { city: 'Others', pct: 4.5 },
    ],
    jobRoles: [
      { role: 'DevOps Engineer', count: 2800 },
      { role: 'Cloud Architect', count: 1600 },
      { role: 'SRE', count: 1400 },
      { role: 'AWS Engineer', count: 1200 },
      { role: 'Platform Engineer', count: 1100 },
      { role: 'Cloud Engineer', count: 950 },
      { role: 'Infrastructure Lead', count: 420 },
      { role: 'Solutions Architect', count: 350 },
    ],
    skills: [
      { name: 'AWS', demand: 90 },
      { name: 'Docker', demand: 85 },
      { name: 'Kubernetes', demand: 80 },
      { name: 'Terraform', demand: 72 },
      { name: 'Linux', demand: 70 },
      { name: 'CI/CD', demand: 68 },
      { name: 'Python', demand: 55 },
      { name: 'Azure', demand: 50 },
    ],
  },
  'Cybersecurity': {
    totalJobs: 6540,
    avgSalary: '₹15.8 LPA',
    growth: '+32%',
    competition: 'Low',
    topCompanies: [
      { name: 'Deloitte', pct: 14.0 },
      { name: 'EY', pct: 11.5 },
      { name: 'PwC', pct: 9.8 },
      { name: 'IBM', pct: 9.2 },
      { name: 'Cisco', pct: 8.5 },
      { name: 'Palo Alto', pct: 7.8 },
      { name: 'CrowdStrike', pct: 6.5 },
      { name: 'TCS', pct: 6.0 },
      { name: 'Infosys', pct: 5.5 },
      { name: 'Wipro', pct: 5.2 },
      { name: 'Others', pct: 16.0 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 6.0 },
      { label: '1-3 yr', value: 10.0 },
      { label: '3-5 yr', value: 16.0 },
      { label: '5-7 yr', value: 23.0 },
      { label: '7-10 yr', value: 32.0 },
      { label: '10+ yr', value: 42.0 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 26.0 },
      { city: 'Hyderabad', pct: 18.0 },
      { city: 'Pune', pct: 15.0 },
      { city: 'Mumbai', pct: 12.5 },
      { city: 'Delhi NCR', pct: 12.0 },
      { city: 'Chennai', pct: 8.5 },
      { city: 'Kolkata', pct: 3.5 },
      { city: 'Others', pct: 4.5 },
    ],
    jobRoles: [
      { role: 'Security Analyst', count: 1800 },
      { role: 'SOC Analyst', count: 1200 },
      { role: 'Penetration Tester', count: 900 },
      { role: 'Security Engineer', count: 850 },
      { role: 'CISO', count: 320 },
      { role: 'Incident Responder', count: 520 },
      { role: 'AppSec Engineer', count: 480 },
      { role: 'GRC Analyst', count: 470 },
    ],
    skills: [
      { name: 'Network Security', demand: 88 },
      { name: 'SIEM', demand: 78 },
      { name: 'Python', demand: 72 },
      { name: 'Pen Testing', demand: 68 },
      { name: 'Cloud Security', demand: 65 },
      { name: 'Linux', demand: 62 },
      { name: 'Incident Response', demand: 58 },
      { name: 'Compliance (ISO)', demand: 50 },
    ],
  },
  'AI / ML': {
    totalJobs: 8960,
    avgSalary: '₹16.4 LPA',
    growth: '+35%',
    competition: 'Medium',
    topCompanies: [
      { name: 'Google', pct: 15.2 },
      { name: 'Microsoft', pct: 13.0 },
      { name: 'Amazon', pct: 11.5 },
      { name: 'NVIDIA', pct: 8.8 },
      { name: 'Meta', pct: 7.5 },
      { name: 'OpenAI', pct: 5.2 },
      { name: 'Samsung', pct: 4.8 },
      { name: 'TCS', pct: 6.5 },
      { name: 'Infosys', pct: 5.5 },
      { name: 'Flipkart', pct: 4.0 },
      { name: 'Others', pct: 18.0 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 6.5 },
      { label: '1-3 yr', value: 11.0 },
      { label: '3-5 yr', value: 17.5 },
      { label: '5-7 yr', value: 25.0 },
      { label: '7-10 yr', value: 35.0 },
      { label: '10+ yr', value: 48.0 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 34.0 },
      { city: 'Hyderabad', pct: 17.0 },
      { city: 'Pune', pct: 11.5 },
      { city: 'Mumbai', pct: 10.0 },
      { city: 'Delhi NCR', pct: 11.0 },
      { city: 'Chennai', pct: 8.0 },
      { city: 'Kolkata', pct: 3.5 },
      { city: 'Others', pct: 5.0 },
    ],
    jobRoles: [
      { role: 'ML Engineer', count: 2800 },
      { role: 'AI Engineer', count: 2100 },
      { role: 'Research Scientist', count: 1200 },
      { role: 'NLP Engineer', count: 850 },
      { role: 'Computer Vision Eng.', count: 720 },
      { role: 'MLOps Engineer', count: 580 },
      { role: 'AI Product Manager', count: 380 },
      { role: 'Data Scientist (AI)', count: 330 },
    ],
    skills: [
      { name: 'Python', demand: 95 },
      { name: 'PyTorch', demand: 82 },
      { name: 'TensorFlow', demand: 75 },
      { name: 'LLMs / GenAI', demand: 72 },
      { name: 'Deep Learning', demand: 70 },
      { name: 'MLOps', demand: 58 },
      { name: 'NLP', demand: 55 },
      { name: 'Computer Vision', demand: 48 },
    ],
  },
  'Mobile Development': {
    totalJobs: 7240,
    avgSalary: '₹11.5 LPA',
    growth: '+15%',
    competition: 'High',
    topCompanies: [
      { name: 'Google', pct: 12.0 },
      { name: 'Samsung', pct: 10.5 },
      { name: 'Flipkart', pct: 9.0 },
      { name: 'Paytm', pct: 8.2 },
      { name: 'Swiggy', pct: 7.5 },
      { name: 'PhonePe', pct: 7.0 },
      { name: 'CRED', pct: 5.8 },
      { name: 'Zomato', pct: 5.5 },
      { name: 'TCS', pct: 5.0 },
      { name: 'Infosys', pct: 4.5 },
      { name: 'Others', pct: 25.0 },
    ],
    salaryByExp: [
      { label: '0-1 yr', value: 4.5 },
      { label: '1-3 yr', value: 7.8 },
      { label: '3-5 yr', value: 12.0 },
      { label: '5-7 yr', value: 17.5 },
      { label: '7-10 yr', value: 24.0 },
      { label: '10+ yr', value: 32.0 },
    ],
    topLocations: [
      { city: 'Bengaluru', pct: 35.0 },
      { city: 'Hyderabad', pct: 14.0 },
      { city: 'Pune', pct: 12.5 },
      { city: 'Mumbai', pct: 11.0 },
      { city: 'Delhi NCR', pct: 10.5 },
      { city: 'Chennai', pct: 8.0 },
      { city: 'Noida', pct: 4.5 },
      { city: 'Others', pct: 4.5 },
    ],
    jobRoles: [
      { role: 'Android Developer', count: 2400 },
      { role: 'iOS Developer', count: 1600 },
      { role: 'React Native Dev', count: 1200 },
      { role: 'Flutter Developer', count: 980 },
      { role: 'Mobile Lead', count: 420 },
      { role: 'Mobile Architect', count: 280 },
      { role: 'QA (Mobile)', count: 220 },
      { role: 'Mobile DevOps', count: 140 },
    ],
    skills: [
      { name: 'Kotlin', demand: 85 },
      { name: 'Swift', demand: 78 },
      { name: 'React Native', demand: 72 },
      { name: 'Flutter/Dart', demand: 68 },
      { name: 'Firebase', demand: 60 },
      { name: 'REST APIs', demand: 58 },
      { name: 'CI/CD Mobile', demand: 45 },
      { name: 'GraphQL', demand: 38 },
    ],
  },
};

function PieChart({ data, size = 220 }) {
  let cumulative = 0;
  const segments = data.map((item, i) => {
    const start = cumulative;
    cumulative += item.pct;
    return { ...item, start, end: cumulative, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const gradient = segments
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(', ');

  return (
    <div className="jm-pie-wrap">
      <div
        className="jm-pie"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradient})`,
        }}
      />
      <div className="jm-pie-legend">
        {segments.map((s) => (
          <div key={s.name || s.city} className="jm-legend-item">
            <span className="jm-legend-dot" style={{ background: s.color }} />
            <span>{s.name || s.city}</span>
            <strong>{s.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, label, unit = '' }) {
  const maxVal = Math.max(...data.map((d) => d.value || d.count || d.demand || 0));
  return (
    <div className="jm-bar-chart">
      {data.map((item, i) => {
        const val = item.value || item.count || item.demand || 0;
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        return (
          <div key={item.label || item.role || item.name} className="jm-bar-row">
            <span className="jm-bar-label">{item.label || item.role || item.name}</span>
            <div className="jm-bar-track">
              <div
                className="jm-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
            <span className="jm-bar-value">{unit}{val.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="jm-stat-card">
      <div className="jm-stat-value">{value}</div>
      <div className="jm-stat-label">{label}</div>
      {sub && <div className="jm-stat-sub">{sub}</div>}
    </div>
  );
}

export default function JobMarketPage() {
  const [selectedDomain, setSelectedDomain] = useState(domains[0]);
  const data = marketData[selectedDomain];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Job Market Trend Analysis</h2>
        <p className="muted">Explore current hiring trends, salaries, top companies and in-demand skills across domains.</p>
      </div>

      <div className="jm-domain-tabs">
        {domains.map((d) => (
          <button
            key={d}
            className={`jm-tab ${selectedDomain === d ? 'active' : ''}`}
            onClick={() => setSelectedDomain(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="jm-stats-row">
        <StatCard label="Total Jobs" value={data.totalJobs.toLocaleString()} />
        <StatCard label="Avg Salary" value={data.avgSalary} />
        <StatCard label="YoY Growth" value={data.growth} />
        <StatCard label="Competition" value={data.competition} />
      </div>

      <div className="jm-charts-grid">
        <div className="jm-chart-card">
          <h3>Top Hiring Companies</h3>
          <PieChart data={data.topCompanies} />
        </div>

        <div className="jm-chart-card">
          <h3>Salary by Experience (LPA)</h3>
          <BarChart data={data.salaryByExp} unit="₹" />
        </div>

        <div className="jm-chart-card">
          <h3>Job Locations</h3>
          <PieChart data={data.topLocations} size={200} />
        </div>

        <div className="jm-chart-card">
          <h3>Popular Job Roles</h3>
          <BarChart data={data.jobRoles} />
        </div>
      </div>

      <div className="jm-chart-card" style={{ marginTop: '1rem' }}>
        <h3>In-Demand Skills (% of job postings)</h3>
        <BarChart data={data.skills} unit="" />
      </div>

      <p className="muted" style={{ marginTop: '1rem', fontSize: '0.78rem' }}>
        Data is illustrative (MVP). Source: aggregated estimates for the Indian tech market, 2025-26.
      </p>
    </section>
  );
}

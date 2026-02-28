import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import MarqueeText from '../components/MarqueeText';

const heroWords = [
  'Real Interviews',
  'Coding Rounds',
  'Behavioral Prep',
  'Career Growth',
];

const badges = ['Free to start', 'No scheduling', 'Instant feedback', 'All round types'];

const problems = [
  {
    title: 'You freeze under pressure',
    body: 'You can solve the problem at home. But when someone is watching, the logic dissolves. Real interviews demand performance under pressure — a skill that requires deliberate practice, not more problem grinding.',
    color: '#e6735b',
  },
  {
    title: 'Communication is evaluated, not just code',
    body: 'Interviewers at top companies score you on how clearly you think out loud, how you handle ambiguity, and whether you explain trade-offs — none of which LeetCode trains.',
    color: '#5b74e6',
  },
  {
    title: 'Human mock interviews cost ₹15,000+ per session',
    body: 'Building real interview confidence takes 10–20 sessions. That is ₹1,50,000+ that most candidates cannot justify. Scheduling constraints mean practice happens too rarely to build muscle memory.',
    color: '#b05be6',
  },
  {
    title: 'No feedback loop in solo practice',
    body: 'You pass the test case and move on. You never know if your approach was optimal, whether your explanation was clear, or what a real interviewer would have followed up with.',
    color: '#5be6a0',
  },
];

const features = [
  {
    icon: '🤖',
    title: 'Adaptive AI Interviewer',
    body: 'Follows up on your specific answers. Probes your reasoning when you are vague. Adapts question difficulty to your level — the same way a senior engineer would in a real loop.',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    icon: '⚡',
    title: 'Instant Performance Feedback',
    body: 'After each session, you get a detailed report covering code correctness, time and space complexity, communication clarity, problem-solving structure, and a prioritized improvement roadmap.',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    icon: '🎯',
    title: 'All Interview Rounds Covered',
    body: 'Technical, Coding, Manager, and HR rounds — practice all of them with domain-specific questions, proctoring, and a strict interview flow that mirrors real hiring pipelines.',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    icon: '🔒',
    title: 'Real Proctoring Environment',
    body: 'Camera monitoring, face detection, tab-switch detection. Build the discipline to perform under surveillance — because that is exactly what real online assessments demand.',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  {
    icon: '📊',
    title: 'Job Market Intelligence',
    body: 'Explore hiring trends, salary benchmarks, in-demand skills, and top companies for your domain — all in one dashboard to align your preparation with market reality.',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
  {
    icon: '🚀',
    title: 'Domain Switch Analysis',
    body: 'Planning a career pivot? Get a data-driven readiness score, skill gap analysis, and a personalized transition roadmap from your current role to your target domain.',
    gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  },
];

const stats = [
  { value: '4', label: 'Interview Rounds' },
  { value: '6+', label: 'Domains Covered' },
  { value: 'AI', label: 'Powered Feedback' },
  { value: '∞', label: 'Practice Sessions' },
];

function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || isNaN(target)) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 16);
    return () => clearInterval(id);
  }, [started, target, duration]);

  return [val, ref];
}

function AnimatedStat({ value, label }) {
  const isNum = !isNaN(parseInt(value));
  const [count, ref] = useCountUp(isNum ? parseInt(value) : 0);
  return (
    <div className="landing-stat" ref={ref}>
      <span className="landing-stat-value">{isNum ? count : value}</span>
      <span className="landing-stat-label">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const [visibleProblems, setVisibleProblems] = useState(new Set());
  const [visibleFeatures, setVisibleFeatures] = useState(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = e.target.dataset.idx;
            const type = e.target.dataset.type;
            if (type === 'problem') setVisibleProblems((s) => new Set(s).add(idx));
            if (type === 'feature') setVisibleFeatures((s) => new Set(s).add(idx));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-anim]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      {/* ─── TOP NAV (HackerRank style) ─── */}
      <nav className="landing-topnav">
        <div className="landing-topnav-left">
          <Link to="/" className="landing-brand">
            VidyaMitra<span className="landing-brand-dot">■</span>
          </Link>
          <a href="#how-it-works">Features</a>
          <a href="#flow-section">How it Works</a>
        </div>
        <div className="landing-topnav-right">
          <Link to="/auth" className="landing-nav-link">Log In</Link>
          <Link to="/admin" className="landing-nav-btn">For Enterprise</Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <span className="landing-overline">FREE AI MOCK INTERVIEW SIMULATOR</span>
        <HeroTitle words={heroWords} />
        <p className="landing-hero-sub">
          We help thousands of candidates ace interviews and upskill with AI-powered practice, and enterprises to evaluate talent — all in one platform.
        </p>
        <div className="landing-hero-cta">
          <Link className="landing-btn primary" to="/auth">
            For Developers <span className="arrow">→</span>
          </Link>
          <Link className="landing-btn outline-dark" to="/admin">
            For Enterprise
          </Link>
        </div>
        <div className="landing-badges">
          {badges.map((b) => (
            <span key={b} className="landing-badge">{b}</span>
          ))}
        </div>
        <MarqueeText
          items={['Coding Round', 'Technical Interview', 'Manager Round', 'HR Behavioral', 'Proctored Environment', 'Performance Report', 'Domain Analysis', 'Job Market Trends']}
        />
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="landing-stats-bar">
        {stats.map((s) => (
          <AnimatedStat key={s.label} value={s.value} label={s.label} />
        ))}
      </section>

      {/* ─── PROBLEM SECTION ─── */}
      <section className="landing-section" id="how-it-works">
        <h2 className="landing-section-title">
          Why Interview Candidates Fail —<br />
          <span className="gradient-text">Even After Months of Preparation</span>
        </h2>
        <p className="landing-section-sub">
          Most engineers spend their preparation time solving problems in isolation. The actual interview tests something different: the ability to perform under pressure, communicate continuously, and handle questions you have never seen before.
        </p>
        <div className="landing-problems-grid">
          {problems.map((p, i) => (
            <article
              key={i}
              className={`landing-problem-card ${visibleProblems.has(String(i)) ? 'visible' : ''}`}
              data-anim
              data-type="problem"
              data-idx={i}
              style={{ '--accent-card': p.color, animationDelay: `${i * 0.12}s` }}
            >
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="landing-section">
        <h2 className="landing-section-title">
          What Is <span className="gradient-text">VidyaMitra</span>?
        </h2>
        <p className="landing-section-sub">
          An <strong>AI mock interview simulator</strong> that conducts realistic practice interviews using artificial intelligence — asking questions, evaluating your responses, issuing follow-ups, and generating structured feedback. Unlike passive coding practice, it simulates the actual conversational dynamics of a technical interview.
        </p>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <article
              key={i}
              className={`landing-feature-card ${visibleFeatures.has(String(i)) ? 'visible' : ''}`}
              data-anim
              data-type="feature"
              data-idx={i}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="landing-feature-icon" style={{ background: f.gradient }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── FLOW SECTION ─── */}
      <section className="landing-section">
        <h2 className="landing-section-title">
          How a Session <span className="gradient-text">Works</span>
        </h2>
        <div className="landing-flow" id="flow-section">
          {[
            { step: '01', title: 'Sign Up & Upload Resume', desc: 'Create an account and upload your resume. AI extracts your skills and domain.' },
            { step: '02', title: 'Start Interview Round', desc: 'Choose Coding, Technical, Manager, or HR — the AI adapts to your domain.' },
            { step: '03', title: 'Real-Time Proctoring', desc: 'Camera + face detection + tab monitoring. Just like a real online assessment.' },
            { step: '04', title: 'Get Instant Analysis', desc: 'Score, strengths, weaknesses, and a prioritized improvement plan after every round.' },
          ].map((s, i) => (
            <div key={i} className="landing-flow-step">
              <span className="landing-flow-num">{s.step}</span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="landing-cta-section">
        <h2>Ready to Ace Your Next Interview?</h2>
        <p>Start practicing now — it's free, instant, and powered by AI.</p>
        <Link className="landing-btn primary large" to="/auth">
          Get Started Free <span className="arrow">→</span>
        </Link>
      </section>
    </div>
  );
}

function HeroTitle({ words }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(t);
  }, [words]);
  return (
    <h1 className="landing-hero-title">
      AI Interview Practice That Prepares You for{' '}
      <span className="landing-hero-rotate" key={idx}>{words[idx]}</span>{' '}
      — Not Just LeetCode.
    </h1>
  );
}

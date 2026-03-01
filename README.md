# VidyaMitra — AI-Powered Interview Preparation Platform

VidyaMitra is a full-stack, AI-driven mock interview and career preparation platform that simulates a real-world hiring pipeline. It guides candidates through a structured, multi-round interview process — from resume analysis to coding challenges to adaptive conversational interviews — all powered by Google Gemini AI and monitored with real-time proctoring.

---

## Research-Oriented Overview

### Abstract

VidyaMitra is a stateful multi-agent interview simulation system designed to model real-world hiring pipelines using structured LLM orchestration and adaptive evaluation mechanisms. The system integrates multi-turn conversational agents, Redis-backed session persistence, structured LLM outputs, and computer vision-based proctoring to simulate end-to-end technical interviews.

### Research-Oriented Highlights

- Designed a stateful multi-agent architecture using LangGraph `StateGraph` to model multi-round interview workflows.
- Implemented adaptive question difficulty routing based on structured LLM evaluation outputs.
- Enforced deterministic response schemas using Pydantic-based structured LLM outputs.
- Built a Redis-backed session persistence layer for multi-turn conversational state tracking.
- Integrated computer vision-based proctoring using MediaPipe + OpenCV with streak-based violation logic.
- Developed a rubric-based coding evaluation system with weighted scoring components.
- Implemented sequential gating logic to model real-world hiring constraints.

### System Architecture Perspective

#### 1) Multi-Agent State Machine Design

Each interview round is modeled as a directed graph:

1. initialize
2. generate_question
3. record_answer
4. analyze_answer
5. route_next_turn
6. END

State transitions depend on:

- Evaluation score
- Topic coverage constraints
- Max question limit
- Mandatory domain enforcement (CN, DBMS, OOP)

This creates a deterministic flow on top of non-deterministic LLM outputs.

#### 2) Adaptive Difficulty Mechanism

Difficulty is adjusted based on:

- Score thresholds from previous answer analysis
- Confidence rating returned by structured LLM output
- Topic mastery tracking across session state

This creates feedback-driven question generation instead of static prompting.

#### 3) Deterministic LLM Control

To reduce hallucination and ensure evaluability:

- All LLM outputs follow strict Pydantic schemas
- Scoring ranges are bounded
- Evaluation rubric is explicitly defined
- Resume extraction is constrained to observed content only

This ensures structured output rather than free-form generation.

#### 4) Interview State Persistence

State hierarchy:

- Redis (primary store)
- In-memory fallback
- Session fallback

Tracked elements include:

- Current round
- Question count
- Topic coverage
- Difficulty level
- Previous evaluations

This allows multi-turn persistence even across page reloads.

#### 5) Proctoring System Logic

The proctoring system integrates:

- Face detection via MediaPipe
- OpenCV fallback detection
- Brightness and blur quality checks
- Tab switch detection
- Fullscreen enforcement
- Streak-based violation tracking

Violation threshold logic:

- Warning counter
- Automatic reset after threshold breach

This models examination integrity enforcement.

### Research Value

This project explores:

- Controlled orchestration of LLM-based agents
- Hybrid deterministic-probabilistic system design
- Multi-agent state modeling
- Adaptive evaluation frameworks
- Integration of CV pipelines with LLM-driven systems

It can be extended toward:

- Reinforcement learning for difficulty calibration
- Human-in-the-loop evaluation benchmarking
- Bias analysis in automated interview scoring
- Comparative evaluation of different LLMs
- Fairness-aware scoring models


---

## Table of Contents

- [Research-Oriented Overview](#research-oriented-overview)
  - [Abstract](#abstract)
  - [Research-Oriented Highlights](#research-oriented-highlights)
  - [System Architecture Perspective](#system-architecture-perspective)
  - [Research Value](#research-value)
  - [Why This Version Is Better For IITH](#why-this-version-is-better-for-iith)
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Interview Pipeline](#interview-pipeline)
- [Detailed Feature Breakdown](#detailed-feature-breakdown)
  - [Authentication](#1-authentication)
  - [Resume Intelligence](#2-resume-intelligence)
  - [Coding Round](#3-coding-round)
  - [Technical Interview Round](#4-technical-interview-round)
  - [Manager Interview Round](#5-manager-interview-round)
  - [HR Interview Round](#6-hr-interview-round)
  - [Real-Time Proctoring](#7-real-time-proctoring)
  - [Domain Switch Advisor](#8-domain-switch-advisor)
  - [Skill Quiz](#9-skill-quiz)
  - [Job Board & Market Intelligence](#10-job-board--market-intelligence)
  - [Admin Portal](#11-admin-portal)
- [Frontend Details](#frontend-details)
- [Backend API Reference](#backend-api-reference)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Overview

VidyaMitra ("विद्यामित्र" — meaning "Knowledge Friend") is designed to prepare candidates for technical job interviews by simulating the entire hiring process end-to-end. Unlike simple quiz apps, VidyaMitra uses **adaptive AI interviewers** that dynamically adjust question difficulty based on candidate responses, **LangGraph state machines** for multi-turn conversational interviews, and **computer vision-based proctoring** to enforce exam integrity.

The platform covers every stage a candidate encounters in real hiring:

1. Resume submission and AI-powered analysis
2. Competitive programming (coding round)
3. Technical interview (CS fundamentals + resume-based questions)
4. Managerial interview (project depth, design decisions, leadership)
5. HR/behavioral interview (communication, cultural fit, soft skills)

Each round is gated — candidates must complete them sequentially, just like a real interview process.

---

## Key Features

| Feature | Description |
|---|---|
| **Adaptive AI Interviews** | Google Gemini 2.5 Flash dynamically adjusts difficulty and follow-up questions based on candidate responses |
| **LangGraph State Machines** | Multi-turn interview conversations modeled as directed graphs with persistent state |
| **Resume AI Analysis** | Upload a PDF resume and receive structured extraction, scoring (0–100), skill gap analysis, and project suggestions |
| **Resume Builder** | Build a resume from scratch with 3 professional PDF templates (Classic, Minimal, Modern) |
| **Coding Environment** | Monaco Editor (VS Code's editor) with 5 language support, IntelliSense, and strict one-submission evaluation |
| **Real-Time Proctoring** | Webcam face detection (MediaPipe + OpenCV), fullscreen enforcement, tab-switch detection, copy/paste blocking |
| **Text-to-Speech** | Browser TTS with neural voice preference scoring, adjustable rate/pitch, word-level highlighting during readout |
| **Speech-to-Text** | Web Speech API voice input for hands-free interview responses |
| **Domain Switch Advisor** | AI-powered career transition analysis with roadmaps, skill gaps, and job market data |
| **Skill Quiz** | Timed 10-question MCQ from 140+ questions across 14 tech topics, with AI-generated performance analysis |
| **Job Board** | Browse job listings with keyword search and direct apply links |
| **Job Market Dashboard** | Visual analytics (pie/bar charts) for 6 tech domains with salary, demand, and hiring company data |
| **Admin Portal** | Enterprise dashboard for managing job postings and browsing candidate profiles with skill-based filtering |
| **Dark/Light Theme** | Full theme support with CSS variables and persistent preference |
| **Sequential Round Flow** | Enforced progression: Coding → Technical → Manager → HR, with automatic reset after cycle completion |

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance async Python web framework |
| **Google Gemini 2.5 Flash** | Large language model for all AI features (interview questions, evaluation, resume analysis) |
| **LangChain + LangGraph** | Orchestration framework for multi-turn conversational AI with stateful directed graphs |
| **Supabase (PostgreSQL)** | Cloud database for user data, profiles, resumes, and job postings |
| **Redis** | In-memory state store for interview sessions, round flow tracking, and question persistence |
| **OpenCV + MediaPipe** | Computer vision for real-time face detection during proctored interviews |
| **bcrypt** | Secure password hashing |
| **PyPDFLoader** | PDF text extraction for resume parsing |
| **Pydantic** | Data validation and structured AI output schemas |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | Component-based UI framework |
| **Vite** | Fast development server and build tool |
| **React Router v6** | Client-side routing for SPA navigation |
| **Monaco Editor** | VS Code's code editor for the coding round |
| **Axios** | HTTP client with cookie-based authentication |
| **jsPDF** | Client-side PDF generation for resume builder |
| **react-markdown** | Markdown rendering for AI analysis results |
| **Web Speech API** | Browser-native TTS and STT for voice interaction |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                     │
│  (Vite + React Router + Monaco + Web Speech API)     │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (Axios, cookies)
                      ▼
┌─────────────────────────────────────────────────────┐
│                  FastAPI Backend                      │
│         (15 route modules, session middleware)        │
├──────────┬──────────┬──────────┬────────────────────┤
│ LangGraph│  Gemini  │ OpenCV/  │    Supabase RPC    │
│  State   │  2.5     │ MediaPipe│    (Postgres)      │
│  Graphs  │  Flash   │ Face Det.│                    │
├──────────┴──────────┴──────────┴────────────────────┤
│                    Redis                             │
│  (Interview state, round flow, question tracking)    │
└─────────────────────────────────────────────────────┘
```

### State Management Flow

- **Authentication**: Cookie-based sessions (`user_id` httponly cookie)
- **Interview State**: Redis primary → in-memory dict fallback → session fallback
- **Round Flow**: Redis-backed sequential gate (coding → technical → manager → hr)
- **Frontend Round Status**: `localStorage` cache + server-fetched status

---

## Interview Pipeline

The platform enforces a strict sequential interview pipeline that mirrors real hiring processes:

```
Register/Login
      │
      ▼
Resume Upload (PDF or Manual Build)
      │
      ▼
┌─────────────────┐
│  CODING ROUND   │  Solve 1 competitive programming problem
│  Score: 0–100   │  (Correctness 40% + Complexity 25% + Edge Cases 15% + Quality 15% + Optimization 5%)
└────────┬────────┘
         ▼
┌─────────────────┐
│ TECHNICAL ROUND │  3 adaptive questions (CS fundamentals + resume-based)
│  Score: 0–10    │  Enforces CN/DBMS/OOPS coverage
└────────┬────────┘
         ▼
┌─────────────────┐
│ MANAGER ROUND   │  3 adaptive questions (project depth, design, ownership)
│  Score: 0–10    │  Focuses on decision-making and stakeholder thinking
└────────┬────────┘
         ▼
┌─────────────────┐
│    HR ROUND     │  3 adaptive questions (behavioral, communication, culture)
│  Score: 0–10    │  Resets entire pipeline on completion
└─────────────────┘
```

After completing the HR round, the entire pipeline resets automatically, allowing candidates to start a new interview cycle.

---

## Detailed Feature Breakdown

### 1. Authentication

- **Registration**: Name + email + password → bcrypt-hashed password → stored in Supabase `users` table
- **Login**: Email + password verification → sets `user_id` httponly cookie
- **Logout**: Clears the authentication cookie
- **Session**: Starlette `SessionMiddleware` for server-side session state

### 2. Resume Intelligence

#### PDF Upload & AI Analysis
- Upload a PDF resume → `PyPDFLoader` extracts text → sent to Gemini 2.5 Flash with structured output
- AI extracts: basic info, education, certifications, projects, skills, domain classification (18 predefined domains)
- Returns: resume score (0–100), detailed analysis, skill gap analysis, and suggested projects
- Strict prompt engineering prevents AI hallucination — only extracts data actually present in the resume

#### Resume Builder
- Manual form entry: basic info, education, work experience, certifications, projects, skills
- 3 professional PDF templates with live previews:
  - **Classic**: Blue accent headers with underlines
  - **Minimal**: Clean divider-based layout
  - **Modern**: Colored header banner with sidebar accent
- Client-side PDF generation via jsPDF with proper typography and formatting

### 3. Coding Round

- **Question Bank**: 5 competitive programming problems (Codeforces-style) with problem statements, I/O specs, and sample cases
- **Code Editor**: Monaco Editor (primary) with fallback textarea featuring custom autocomplete, smart indentation, and bracket auto-closing
- **Languages**: Python, JavaScript, TypeScript, Java, C++
- **One-Submission Policy**: Code submission is final per question, with confirmation dialog
- **AI Evaluation** (100-point rubric):
  - Correctness: 40 points
  - Time/Space Complexity: 25 points
  - Edge Case Handling: 15 points
  - Code Quality & Style: 15 points
  - Optimization Approach: 5 points
- Returns detailed breakdown: code analysis, improvement suggestions, and tips

### 4. Technical Interview Round

- **Engine**: LangGraph `StateGraph` with nodes: `initialise → route_turn → record_answer | generate_question → analyse | END`
- **Adaptive Difficulty**: AI raises/lowers question difficulty based on answer quality
- **Mandatory Coverage**: Enforces minimum 2 questions from core CS topics (Computer Networks, DBMS, OOPs)
- **Multi-Turn**: Up to 3 questions per session with persistent state across turns
- **Final Analysis**: Score (0–10), strengths, weaknesses, areas to focus, hiring recommendation, and personalized tips

### 5. Manager Interview Round

- Same LangGraph architecture as the Technical round
- **Focus Areas**: Project explanation, design decisions, ownership, tradeoffs, problem-solving, stakeholder thinking
- **Adaptive**: Questions evolve based on the depth and quality of project discussion
- **Evaluation**: Prioritizes project depth, decision-making rationale, and leadership qualities

### 6. HR Interview Round

- Same LangGraph architecture as the Technical round
- **Focus Areas**: Personality assessment, behavioral maturity, communication skills, teamwork, ownership mindset, cultural alignment
- **Pipeline Reset**: On completion, automatically resets the entire round flow, enabling a new interview cycle

### 7. Real-Time Proctoring

Active during Coding, Technical, Manager, and HR rounds:

| Check | Implementation |
|---|---|
| **Face Detection** | MediaPipe (primary) + OpenCV Haar cascades (fallback), dual-pass: lenient + strict |
| **Face Count Monitoring** | Webcam frames captured every 1.8s → API analysis → streak-based warnings |
| **Fullscreen Lock** | Auto-requests fullscreen; blocks interaction when exited |
| **Tab-Switch Detection** | First violation = warning; second violation = all rounds reset + redirect |
| **Copy/Paste Block** | Intercepts Ctrl+C/V and clipboard events |
| **Warning System** | 30 total warnings allowed before automatic round reset |
| **Frame Quality** | Analyzes brightness and blur to ensure adequate camera feed |

### 8. Domain Switch Advisor

- Input a target career domain → AI analyzes the candidate's current profile against the target
- Returns a comprehensive `DomainSwitchAnalysis`:
  - Whether the switch is recommended (with confidence)
  - Current strengths and transferable skills
  - Skills to develop (each with importance level and learning resources)
  - Step-by-step learning roadmap with time estimates
  - Target job roles with salary ranges and market demand

### 9. Skill Quiz

- **Question Bank**: 140+ hardcoded MCQs across 14 topics: Python, JavaScript, React, Java, SQL, HTML, CSS, Node.js, MongoDB, C++, Machine Learning, Data Structures, TypeScript, Git, Docker
- **Personalized**: Questions selected based on skills extracted from the candidate's resume
- **Timed**: 10-minute countdown with auto-submit on expiry
- **AI Evaluation**: Gemini generates per-skill breakdowns, overall rating, strengths, weaknesses, and learning recommendations
- **Rich Results**: SVG score ring, answer review with correct/incorrect highlighting

### 10. Job Board & Market Intelligence

#### Job Board
- Browse job listings from Supabase `jobs` table
- Client-side comma-separated keyword search across title, company, and location
- Direct apply links to external job postings

#### Job Market Dashboard
- Static analytics dashboard covering 6 tech domains: Data Science, Web Development, Cloud/DevOps, Cybersecurity, AI/ML, Mobile Development
- Visual charts: CSS pie charts (conic-gradient) for top hiring companies and locations; horizontal bar charts for salaries, roles, and skills demand
- Indian market focused (Bengaluru, Hyderabad, Pune; salaries in LPA)

### 11. Admin Portal

- **Dedicated UI**: Separate branded layout ("VidyaMitra Enterprise") with its own authentication
- **Job Management**: Create new job postings (title, company, location, apply URL) and delete existing ones
- **User Browser**: View all registered users with enriched profile data (skills, domain, bio)
- **Search & Filter**: Comma-separated keyword search + clickable skill chip filters for faceted browsing
- **Profile Deep View**: Click any user to view their full structured candidate profile

---

## Frontend Details

### Voice Interaction System

The platform features a sophisticated voice interaction system:

- **Text-to-Speech (TTS)**: Automatic voice scoring selects the best available browser voice (prefers Neural/Premium voices). Supports Premium/Standard mode, adjustable rate and pitch, language selection (en-US, en-IN, hi-IN), and **word-level highlighting** during readout using `SpeechSynthesisUtterance.onboundary` events with binary search for character-to-word mapping
- **Speech-to-Text (STT)**: Web Speech API continuous recognition with interim results. Start/stop toggle. Graceful fallback to manual text input if the browser doesn't support STT

### Theming

- Full light/dark mode support via CSS `data-theme` attribute
- Theme preference persisted in `localStorage`
- CSS variable-based theming for consistent color propagation
- Glassmorphic top bar with `backdrop-filter: blur`

### Responsive Design

- Grid-based layouts with 960px breakpoint
- Card-based UI patterns throughout (`.panel`, `.status-card`, `.hub-card`, `.profile-card`, `.job-card`)
- CSS animations: `fadeInUp`, `marqueeMove`, `pulseWord`, staggered reveals

---

## Backend API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/login/` | Login with email + password |
| POST | `/register/` | Create new account |
| POST | `/logout/` | End session |

### Profile & Resume
| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get authenticated user's profile |
| POST | `/resume/` | Upload PDF resume for AI analysis |
| POST | `/resume/build` | Save manually built resume |

### Interview Rounds
| Method | Endpoint | Description |
|---|---|---|
| GET | `/coding_round/get_question` | Get coding problem |
| POST | `/coding_round/submit_solution` | Submit code for evaluation |
| GET | `/interview/start` | Start technical round |
| POST | `/interview/answer` | Submit technical answer |
| GET | `/manager_round/start` | Start manager round |
| POST | `/manager_round/answer` | Submit manager answer |
| GET | `/hr_round/start` | Start HR round |
| POST | `/hr_round/answer` | Submit HR answer |

### Interview Flow
| Method | Endpoint | Description |
|---|---|---|
| GET | `/interview_flow/status` | Get all round statuses |
| POST | `/interview_flow/reset` | Reset all rounds |

### Other Features
| Method | Endpoint | Description |
|---|---|---|
| POST | `/domain_switch/` | Get domain transition analysis |
| POST | `/proctoring/face-check` | Analyze webcam frame for faces |
| GET | `/skill-quiz/questions/{user_id}` | Get skill quiz questions |
| POST | `/skill-quiz/evaluate` | Evaluate quiz answers |
| GET | `/jobs/` | List all job postings |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| GET | `/admin/profile/{user_id}` | Get user profile |
| POST | `/admin/jobs` | Create job posting |
| DELETE | `/admin/jobs/{job_id}` | Delete job posting |

---

## Project Structure

```
vidyamitra/
├── backend server/
│   ├── server.py                  # FastAPI app entry point
│   ├── requirements.txt           # Python dependencies
│   ├── models/                    # Pydantic data models
│   │   ├── login.py               # Login request model
│   │   ├── register.py            # Registration request model
│   │   ├── coding_round.py        # Code submission & analysis models
│   │   ├── technical_round.py     # Interview state, analysis, model result
│   │   ├── manager_round.py       # Manager interview state models
│   │   ├── hr_round.py            # HR interview state models
│   │   ├── domain_switch.py       # Domain switch analysis models
│   │   └── upload_resume.py       # Resume extraction schema models
│   ├── routes/                    # API route handlers (15 modules)
│   │   ├── login.py               # POST /login/
│   │   ├── register.py            # POST /register/
│   │   ├── logout.py              # POST /logout/
│   │   ├── resume_upload.py       # POST /resume/, /resume/build
│   │   ├── coding_round.py        # GET/POST coding round endpoints
│   │   ├── technical_round.py     # GET/POST technical interview (LangGraph)
│   │   ├── manager_round.py       # GET/POST manager interview (LangGraph)
│   │   ├── hr_round.py            # GET/POST HR interview (LangGraph)
│   │   ├── domain_switch.py       # POST /domain_switch/
│   │   ├── interview_flow.py      # GET/POST round flow management
│   │   ├── proctoring.py          # POST /proctoring/face-check
│   │   ├── jobs.py                # GET /jobs/
│   │   ├── admin.py               # Admin CRUD endpoints
│   │   ├── skill_quiz.py          # Skill quiz endpoints (140+ MCQs)
│   │   └── profile.py             # GET /profile
│   └── services/                  # Shared services
│       ├── db_client.py           # Supabase client initialization
│       ├── redis.py               # Redis client initialization
│       ├── questions.py           # Coding round question bank
│       ├── round_flow.py          # Sequential round flow enforcement
│       └── ap_scheduler.py        # Scheduler stub (placeholder)
├── frontend/
│   ├── index.html                 # Vite entry point
│   ├── package.json               # Node.js dependencies
│   ├── vite.config.js             # Vite configuration
│   └── src/
│       ├── App.jsx                # Root component with routing
│       ├── main.jsx               # React entry point
│       ├── api.js                 # Axios HTTP client config
│       ├── interviewFlow.js       # Round sequencing logic
│       ├── audioControl.js        # Audio/video stop utility
│       ├── roundStatus.js         # localStorage round status cache
│       ├── styles.css             # Complete application stylesheet (4000+ lines)
│       ├── components/
│       │   ├── Layout.jsx         # App shell with nav bar & theme toggle
│       │   ├── InterviewConsole.jsx  # Core interview Q&A engine (TTS/STT)
│       │   ├── SpeechControls.jsx # Speech-to-text input component
│       │   ├── DynamicHeadline.jsx # Rotating headline animation
│       │   └── MarqueeText.jsx    # Scrolling ticker component
│       └── pages/
│           ├── LandingPage.jsx    # Marketing landing page
│           ├── AuthPage.jsx       # Login/Register
│           ├── DashboardPage.jsx  # Central dashboard
│           ├── ProfilePage.jsx    # Candidate profile view
│           ├── ResumeUploadPage.jsx # Resume upload + builder
│           ├── InterviewHubPage.jsx # Round selection hub
│           ├── InterviewPage.jsx  # Proctored interview wrapper
│           ├── CodingRoundPage.jsx # Coding challenge + editor
│           ├── DomainSwitchPage.jsx # Career transition advisor
│           ├── JobsPage.jsx       # Job listings browser
│           ├── JobMarketPage.jsx  # Market analytics dashboard
│           ├── AdminPortalPage.jsx # Enterprise admin portal
│           └── SkillQuizPage.jsx  # Timed skill assessment
└── myenv/                         # Python virtual environment
```

---

## Setup & Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Redis** server running on `localhost:6379`
- **Supabase** project with required tables and RPCs
- **Google AI API key** (Gemini 2.5 Flash access)

### Backend Setup

```bash
# Navigate to backend
cd "backend server"

# Create virtual environment
python -m venv ../myenv

# Activate virtual environment
# Windows:
..\myenv\Scripts\Activate.ps1
# macOS/Linux:
source ../myenv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (see Environment Variables section)

# Start the server
uvicorn server:app --reload --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file
echo VITE_API_BASE_URL=http://localhost:8000 > .env

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

## Environment Variables

### Backend (`.env`)

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# Google AI
GOOGLE_API_KEY=your_google_ai_api_key

# Session
SESSION_SECRET=your_session_secret_key

# CORS (optional, defaults to localhost origins)
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Database Requirements

The backend relies on the following Supabase resources:

### Tables
- `users` — User accounts (name, email, hashed password)
- `jobs` — Job postings (title, company, location, apply_url)

### RPCs (Remote Procedure Calls)
- `upsert_full_resume` — Insert/update complete candidate resume data
- `get_full_candidate_profile` — Retrieve enriched candidate profile with all resume data

---

## Browser Compatibility

- **Recommended**: Chromium-based browsers (Chrome, Edge, Brave) for full Speech Recognition support
- **TTS**: Works across all modern browsers
- **STT**: Best in Chrome/Edge; Firefox has limited support
- **Proctoring**: Requires webcam permission and fullscreen API support

---


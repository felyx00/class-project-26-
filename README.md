# SITS — Student Industrial Attachment Tracking System

A full-stack web application for managing student industrial attachments (internships) at Zetech University. Students log daily/weekly entries, supervisors review and provide feedback, and administrators manage placements.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Node.js, Express.js
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (entry attachments)

## Project Structure

```
SITS/
├── index.html              # Main SPA frontend
├── style.css               # Complete stylesheet (light/dark mode)
├── script.js               # Client-side application logic
├── supabase.js             # Supabase client module
├── .env.example            # Environment variable template
├── sql-schema.sql          # Complete SQL schema + RLS policies
├── README.md
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
└── server/
    ├── server.js            # Express entry point
    ├── package.json
    ├── config/
    │   ├── index.js         # Environment configuration
    │   └── supabase.js      # Supabase client (anon + admin)
    ├── middleware/
    │   ├── auth.js          # JWT authentication + role authorization
    │   ├── errorHandler.js  # Global error handler
    │   └── validate.js      # Request validation
    ├── controllers/
    │   ├── authController.js
    │   ├── entriesController.js
    │   ├── placementsController.js
    │   ├── evaluationsController.js
    │   ├── feedbackController.js
    │   └── profilesController.js
    └── routes/
        ├── auth.js
        ├── entries.js
        ├── placements.js
        ├── evaluations.js
        ├── feedback.js
        └── profiles.js
```

## Features

- **Authentication:** Sign up, sign in, forgot/reset password, session persistence
- **Role-based access:** Student, Supervisor (university/industry), Admin
- **Student Dashboard:** Overview stats, logbook CRUD, feedback viewing, evaluations, profile editing, PDF report export
- **Supervisor Dashboard:** Pending review queue, reviewed entries, student list, milestone evaluations (mid-term/final), flagging stale entries
- **Admin Dashboard:** Overview stats, placement assignment, all students table, all entries view, system-wide flags
- **Dark mode:** Persistent theme toggle across sessions
- **File attachments:** Upload images/PDFs to Supabase Storage with entry submission
- **PDF export:** Generate comprehensive attachment reports per student
- **Responsive:** Mobile-first design, adaptive sidebar, touch-friendly interactions

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends `auth.users`) |
| `placements` | Student-to-organisation assignments |
| `logbook_entries` | Daily/weekly student log entries |
| `feedback` | Supervisor reviews per entry |
| `entry_attachments` | File references for entry evidence |
| `evaluations` | Mid-term and final appraisals |

## Setup Instructions

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run the entire contents of `sql-schema.sql`
3. Go to **Authentication > Settings** and enable email/password sign-up
4. Go to **Storage** and create a bucket named `entry-attachments` (public)
5. Go to **Storage > Policies** and add:
   - `SELECT` for all authenticated users on `entry-attachments`
   - `INSERT` where `auth.uid()` matches the folder name (user ID)
   - `DELETE` where `auth.uid()` matches the folder name

### 2. Frontend (No Build Required)

The frontend is a single-page application that loads directly in the browser.

1. Open `index.html` and verify the Supabase credentials at the top of `script.js` are correct:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

2. Serve the files using any static server:

```bash
npx http-server . -p 5500
```

Or use VS Code Live Server extension.

### 3. Backend (Optional — for API access)

```bash
cd server
cp ../.env.example ../.env
# Edit .env with your Supabase credentials
npm install
npm run dev
```

The API will be available at `http://localhost:3000/api/`.

### 4. Environment Variables (`.env`)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ATTACHMENTS_BUCKET=entry-attachments
PORT=3000
NODE_ENV=development
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:5500
SESSION_EXPIRY=7d
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/signup` | No | Create account |
| POST   | `/api/auth/signin` | No | Sign in |
| POST   | `/api/auth/signout` | Yes | Sign out |
| GET    | `/api/auth/me` | Yes | Get current user |
| POST   | `/api/auth/forgot-password` | No | Send reset email |
| POST   | `/api/auth/reset-password` | No | Reset password |
| GET    | `/api/entries` | Yes | List entries (filtered by role) |
| GET    | `/api/entries/:id` | Yes | Get single entry |
| POST   | `/api/entries` | Yes | Create entry (student) |
| PUT    | `/api/entries/:id` | Yes | Update entry |
| DELETE | `/api/entries/:id` | Yes | Delete entry |
| GET    | `/api/placements` | Yes | List placements |
| POST   | `/api/placements` | Admin | Create placement |
| PUT    | `/api/placements/:id` | Admin | Update placement |
| DELETE | `/api/placements/:id` | Admin | Delete placement |
| GET    | `/api/evaluations` | Yes | List evaluations |
| POST   | `/api/evaluations` | Supervisor/Admin | Create evaluation |
| GET    | `/api/feedback/entry/:entryId` | Yes | Get feedback for entry |
| POST   | `/api/feedback` | Supervisor/Admin | Submit feedback |
| GET    | `/api/profiles/students` | Supervisor/Admin | List all students |
| GET    | `/api/profiles/supervisors` | Admin | List all supervisors |
| GET    | `/api/profiles/:id` | Yes | Get profile |
| PUT    | `/api/profiles/:id` | Yes | Update profile |
| GET    | `/api/health` | No | Health check |

## Deployment

### Frontend

Deploy to any static host (Vercel, Netlify, GitHub Pages, etc.):

```bash
# Just push the repo; the static files serve directly
```

Ensure your Supabase project's **Authentication > Settings > Site URL** matches your deployed domain.

### Backend

Deploy to Railway, Render, Fly.io, or any Node.js host:

```bash
cd server
npm install
npm start
```

Set all environment variables in the hosting dashboard.

## Row Level Security (RLS)

All tables have RLS enabled:

- **Students** can only read/update their own profile and entries
- **Supervisors** can read entries/placements assigned to them
- **Admins** have full read/write access across all tables
- **Triggers** auto-create profiles on user signup and update `updated_at` timestamps

## License

MIT — Department of ICT & Engineering, Zetech University

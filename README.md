# MarketDay — Flea Market Management Platform

A full-stack web app for managing flea market events, merchant registrations, POS transactions, and organizer reporting.

---

## Stack

- **Frontend:** React 18, React Router 6, Recharts, Lucide React
- **Backend/DB:** Supabase (Postgres + RLS)
- **Hosting:** Vercel

---

## Quick Start

### 1. Set up Supabase

1. Go to your [Supabase dashboard](https://supabase.com/dashboard)
2. Open your project → **SQL Editor**
3. Paste the entire contents of `supabase/schema.sql` and click **Run**
4. Go to **Project Settings → API** and copy your **Project URL** and **anon/public key**

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your values:

```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and run locally

```bash
npm install
npm start
```

App runs at `http://localhost:3000`

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

When prompted, set these environment variables:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

### Option B — GitHub + Vercel Dashboard

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Under **Environment Variables**, add:
   - `REACT_APP_SUPABASE_URL` → your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your anon key
4. Click **Deploy**

---

## How It Works

### For Organizers

1. Open the app and choose **Organizer Access**
2. Enter your organizer PIN (set during event creation)
3. From the Admin Panel:
   - View all merchant applications and approve/reject them
   - Monitor real-time revenue and commission breakdown
   - Broadcast announcements to all merchants
   - Export settlement reports as CSV
   - Create new events from the Settings tab
   - Copy the **Event ID** to share with merchants

> **First event:** Use the Settings tab inside the Admin Panel to create your first event. You'll need to log in with the PIN you create there.

### For Merchants

1. Get the **Event ID** from your organizer
2. Click **New merchant? Register here** on the landing page
3. Complete the registration form (profile, inventory, equipment, income split)
4. Wait for organizer approval
5. Once approved, log in with your merchant PIN to access:
   - **Point of Sale** — tap items to add to cart, confirm sales, undo within 10 min
   - **Inventory** — add, edit, or remove items at any time
   - **Sales Log** — full transaction history
   - **Overview Dashboard** — revenue stats, hourly chart, stock alerts, top sellers

---

## Commission Rules

- Merchants can propose an income share between **20% and 50%** (configurable per event)
- The organizer receives the remainder
- All splits are calculated and displayed in real time on both merchant and admin dashboards

---

## Project Structure

```
src/
├── components/
│   └── shared/
│       └── ProtectedRoute.jsx   # Role-based route guard
├── hooks/
│   └── useAuth.jsx              # Auth context (session stored in localStorage)
├── lib/
│   └── supabase.js              # Supabase client + audit logger
├── pages/
│   ├── Landing.jsx              # Login page (organizer + merchant)
│   ├── Registration.jsx         # Multi-step merchant registration
│   ├── Dashboard.jsx            # Merchant dashboard + POS + inventory
│   └── AdminPanel.jsx           # Organizer admin panel
├── styles/
│   └── global.css               # Design system (dark theme, CSS variables)
├── App.jsx                      # Router
└── index.js                     # Entry point

supabase/
└── schema.sql                   # Full DB schema — run this in Supabase SQL Editor

public/
└── index.html
```

---

## Database Tables

| Table | Description |
|---|---|
| `fm_events` | Flea market events |
| `fm_merchants` | Merchant registrations per event |
| `fm_equipment` | Equipment each merchant is bringing |
| `fm_items` | Inventory items per merchant |
| `fm_sales` | Sales transactions |
| `fm_announcements` | Organizer broadcasts |
| `fm_audit_log` | Immutable action log |

---

## Notes

- Authentication is PIN-based (no email/password). Sessions are stored in `localStorage`.
- The `.env` file is gitignored — never commit your keys.
- For production, consider enabling Supabase Auth for stronger security.
- The undo window for sales is **10 minutes** from transaction time.

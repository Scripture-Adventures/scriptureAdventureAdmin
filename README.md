# Scripture Adventure Admin Panel

A modern admin panel for managing Scripture Adventure platform members and their cohorts.

## Features

- 🔐 Secure authentication with Supabase
- 👥 Member management with search functionality
- 📊 Dashboard with member statistics
- ✏️ Inline editing of member cohorts
- 📱 Responsive design
- 🎨 Modern UI with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Authentication

The admin panel uses Supabase authentication. You'll need to:

1. Set up admin users in your Supabase dashboard
2. Configure Row Level Security (RLS) policies for the `members_v3` table
3. Ensure admin users have the necessary permissions

## Database Schema

The application expects a `members_v3` table with the following structure:

```sql
CREATE TABLE members_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_cohort TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment

The Supabase configuration is already set up with:
- URL: `https://rpnwvaptbtpkislfxcbh.supabase.co`
- Anon Key: Configured in `src/lib/supabase.ts`

## Features Overview

### Dashboard
- View all members in a table format
- Search members by name or email
- See statistics: total members, members with cohorts, members without cohorts

### Member Management
- Edit member cohorts inline
- Real-time updates to the database
- Responsive table design

### Security
- Protected routes requiring authentication
- Secure sign-in/sign-out functionality
- Session management with Supabase Auth

## Development

- Built with React 18 and TypeScript
- Styled with Tailwind CSS
- Uses Vite for fast development
- Supabase for backend services

## Deployment

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

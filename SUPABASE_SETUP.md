# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose an organization and project name
4. Set a database password (save this securely)
5. Choose a region close to your users
6. Click "Create new project"

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 3. Configure Environment Variables

Update your `.env.local` file with your actual Supabase credentials:

```env
# OpenAI API Configuration  
OPENAI_API_KEY=your_actual_openai_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Development Configuration
NODE_ENV=development
```

## 4. Set Up Database Schema

In your Supabase dashboard, go to **SQL Editor** and run this SQL:

```sql
-- Create shopping_lists table
CREATE TABLE shopping_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  original_list text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create processed_results table  
CREATE TABLE processed_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  result_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shopping_lists
CREATE POLICY "Users can view own shopping lists" ON shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping lists" ON shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping lists" ON shopping_lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping lists" ON shopping_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for processed_results
CREATE POLICY "Users can view own processed results" ON processed_results
  FOR SELECT USING (
    auth.uid() = (
      SELECT user_id FROM shopping_lists WHERE shopping_lists.id = processed_results.list_id
    )
  );

CREATE POLICY "Users can insert own processed results" ON processed_results
  FOR INSERT WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM shopping_lists WHERE shopping_lists.id = processed_results.list_id
    )
  );
```

## 5. Configure Authentication

1. In Supabase dashboard, go to **Authentication** > **Settings**
2. **Site URL**: Set to `http://localhost:3002` (or your domain)
3. **Redirect URLs**: Add `http://localhost:3002/**` for development
4. Make sure **Enable email confirmations** is enabled
5. Configure email templates if desired

## 6. Test the Setup

1. Restart your development server: `npm run dev`
2. Go to `http://localhost:3002`
3. Try signing up with an email
4. Check your email for confirmation link
5. After confirming, you should be able to sign in

## 7. Optional: Set Up Email Provider

For production, configure a proper email provider:

1. Go to **Authentication** > **Settings** > **SMTP Settings**
2. Configure with your email provider (SendGrid, Mailgun, etc.)
3. Test email delivery

## Troubleshooting

- **Invalid URL Error**: Make sure your Supabase URL doesn't have trailing slashes
- **Authentication Issues**: Check that your Site URL and Redirect URLs are correct
- **Database Access**: Ensure RLS policies are set up correctly
- **Email Issues**: Check spam folder, configure SMTP for production

## Next Steps

Once Supabase is configured:
1. The authentication system will work automatically
2. Users can sign up/login with email and password
3. Shopping lists can be saved and loaded (features coming soon)
4. Protected routes will work properly
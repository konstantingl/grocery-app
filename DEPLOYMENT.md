# Deployment Guide

## Prerequisites

1. **GitHub Account**: Create a repository for your code
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Supabase Account**: Set up your database at [supabase.com](https://supabase.com)
4. **OpenAI API Key**: Get your API key from [OpenAI](https://openai.com)

## Step 1: Push to GitHub

1. Create a new repository on GitHub (e.g., `grocery-app`)
2. Add the remote origin:
   ```bash
   git remote add origin https://github.com/yourusername/grocery-app.git
   ```
3. Push your code:
   ```bash
   git add .
   git commit -m "Initial deployment setup"
   git push -u origin main
   ```

## Step 2: Configure Supabase

Follow the instructions in `SUPABASE_SETUP.md` to:
1. Create a new Supabase project
2. Set up the database schema
3. Configure Row Level Security (RLS)
4. Get your environment variables

## Step 3: Deploy to Vercel

1. **Connect GitHub Repository:**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables:**
   In your Vercel project settings, add these environment variables:
   
   ```
   OPENAI_API_KEY=sk-...
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

3. **Deploy:**
   - Vercel will automatically build and deploy your app
   - Your app will be available at `https://your-app-name.vercel.app`

## Step 4: Verify Deployment

1. **Test Authentication:**
   - Visit your deployed app
   - Try signing up/logging in

2. **Test Grocery Search:**
   - Input a sample grocery list
   - Verify products are found correctly

3. **Check Logs:**
   - Monitor Vercel function logs for any errors
   - Check Supabase logs for database operations

## Environment Variables Reference

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `OPENAI_API_KEY` | OpenAI API key for LLM processing | OpenAI Platform → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin) | Supabase → Settings → API |

## Troubleshooting

### Build Errors
- Check Vercel build logs in the dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript types are correct

### Runtime Errors
- Check Vercel function logs
- Verify environment variables are set correctly
- Test API endpoints individually

### Database Issues
- Check Supabase logs
- Verify RLS policies are correctly configured
- Test database connections

## Automatic Deployments

Once connected to GitHub, Vercel will automatically:
- Deploy on every push to `main` branch
- Run preview deployments for pull requests
- Show deployment status in GitHub

## Custom Domain (Optional)

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions
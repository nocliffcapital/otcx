# Project Request Form Setup

The project request form submits to `/api/request-project` which handles submissions using **Web3Forms** - a free, simple email service.

## Current Behavior

- ✅ **Without email configured**: Requests are logged to server console
- ✅ **With email configured**: Requests are sent via email automatically

## Setup Email Notifications (Recommended)

### Step 1: Get Web3Forms Access Key
1. Go to https://web3forms.com
2. Enter your email address
3. Click "Get Your Access Key"
4. Copy the access key (it will be emailed to you)

**That's it!** No signup, no credit card, completely free.

### Step 2: Configure Environment Variable

Add to your `frontend/.env.local`:

```env
WEB3FORMS_ACCESS_KEY=your_access_key_here
```

### Step 3: Done!

After adding the environment variable, all project requests will be automatically emailed to the email address you used to get the access key.

## How It Works

- Web3Forms is a free service (250 submissions/month on free tier)
- No signup required - just enter your email
- The email address you use to get the access key is where requests will be sent
- Works immediately after adding the access key to `.env.local`

## Viewing Requests

- **With email configured**: Check your email inbox
- **Without email**: Check server logs (console output)
- **Local development**: Requests appear in terminal/console when running `npm run dev`

## Need More Submissions?

Web3Forms free tier includes 250 submissions/month. If you need more, check their pricing at https://web3forms.com/pricing


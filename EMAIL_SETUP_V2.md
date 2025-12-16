# Email Setup Guide V2: MailerSend API Integration

## Overview
This guide documents the migration from Office 365 SMTP (via nodemailer) to MailerSend Email API for the Lincoln EMS Truck Tracker maintenance alert system. This migration improves email deliverability and avoids SPF conflicts by using a dedicated subdomain for automated emails.

**Migration Date:** December 2024  
**Previous System:** Office 365 SMTP (nodemailer)  
**New System:** MailerSend Email API

---

## Table of Contents
1. [Why MailerSend?](#why-mailersend)
2. [Prerequisites](#prerequisites)
3. [MailerSend Account Setup](#mailersend-account-setup)
4. [Domain Verification](#domain-verification)
5. [Firebase Secrets Configuration](#firebase-secrets-configuration)
6. [Code Implementation](#code-implementation)
7. [Deployment](#deployment)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Adding Additional Recipients](#adding-additional-recipients)

---

## Why MailerSend?

### Benefits
- **Better Deliverability:** Professional email API service with high inbox placement rates
- **SPF/DKIM Management:** Automatic DNS record management for email authentication
- **Dedicated Subdomain:** Use `alerts@trucks.lincolnems.com` to avoid conflicts with main domain
- **No SMTP Issues:** Eliminates Office 365 authentication problems from Google Cloud IPs
- **API-Based:** More reliable than SMTP connections
- **Analytics:** Built-in email tracking and delivery reports

### Email Configuration
- **From Address:** `alerts@trucks.lincolnems.com`
- **From Name:** `Lincoln EMS Truck Alerts`
- **Reply-To:** `maintenance@lincolnems.com`
- **Current Recipient:** `john.browning@lincolnems.com` (temporarily limited for testing)

---

## Prerequisites

### 1. MailerSend Account
- Sign up at https://www.mailersend.com
- Obtain API token from MailerSend dashboard
- Account must support custom domain verification

### 2. DNS Access
- Access to DNS records for `lincolnems.com`
- Ability to add CNAME and TXT records for `trucks.lincolnems.com` subdomain

### 3. Firebase Project
- Firebase project with Functions enabled
- Firebase CLI installed and authenticated
- Node.js 20 runtime (already configured)

### 4. Domain Requirements
- Subdomain `trucks.lincolnems.com` must be available
- DNS access to add MailerSend verification records

---

## MailerSend Account Setup

### Step 1: Create MailerSend Account
1. Go to https://www.mailersend.com
2. Sign up for an account
3. Verify your email address
4. Complete account setup

### Step 2: Get API Token
1. Log into MailerSend dashboard
2. Navigate to **Settings** → **API Tokens**
3. Click **Create API Token**
4. Name it: `Lincoln EMS Truck Tracker`
5. Copy the token (you'll need it for Firebase Secrets)
6. **Important:** Store this token securely - you won't be able to see it again

---

## Domain Verification

### Step 3: Add Sending Domain in MailerSend
1. In MailerSend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter: `trucks.lincolnems.com` (subdomain, not root domain)
4. Click **Add Domain**

### Step 4: Get DNS Records from MailerSend
MailerSend will provide DNS records that need to be added:

**Example DNS Records (MailerSend will provide exact values):**
```
Type: CNAME
Name: ms._domainkey.trucks
Value: ms1234567._domainkey.mailersend.net

Type: CNAME
Name: ms2._domainkey.trucks
Value: ms1234567._domainkey.mailersend.net

Type: CNAME
Name: return.trucks
Value: return.mailersend.net

Type: TXT
Name: trucks
Value: v=spf1 include:mailersend.net ~all
```

**Important Notes:**
- Only ONE SPF TXT record per DNS zone
- If you already have an SPF record for `lincolnems.com`, you may need to modify it
- MailerSend will provide exact values - use those, not the examples above

### Step 5: Add DNS Records
1. Log into your DNS provider (where `lincolnems.com` is hosted)
2. Add the CNAME and TXT records provided by MailerSend
3. Wait for DNS propagation (can take up to 48 hours, usually much faster)

### Step 6: Verify Domain in MailerSend
1. Return to MailerSend dashboard
2. Click **Verify** on the `trucks.lincolnems.com` domain
3. Wait for verification (may take a few minutes after DNS propagates)
4. Status should change to **Verified** ✅

---

## Firebase Secrets Configuration

### Step 7: Set MailerSend API Key as Firebase Secret

Firebase Functions Gen 2 uses secrets for sensitive data. This is more secure than environment variables.

**From your project root directory:**

```bash
cd functions
firebase functions:secrets:set MAILERSEND_API_KEY
```

When prompted, paste your MailerSend API token and press Enter.

**Verify the secret was set:**
```bash
firebase functions:secrets:access MAILERSEND_API_KEY
```

**Note:** The secret is now stored securely in Google Cloud Secret Manager and will be automatically injected into your functions at runtime.

---

## Code Implementation

### What Changed

#### 1. New File: `functions/mailersend.js`
- Replaces `functions/mailer.js` (nodemailer module)
- Implements MailerSend API calls using built-in `fetch` (Node 20)
- Handles API authentication and error responses
- Returns message ID for logging

#### 2. Updated: `functions/index.js`
- Removed nodemailer imports
- Added Firebase Secrets import: `defineSecret`
- Updated `sendMaintenanceAlert` function:
  - Uses MailerSend API instead of SMTP
  - From: `alerts@trucks.lincolnems.com`
  - Reply-To: `maintenance@lincolnems.com`
  - Recipient: `john.browning@lincolnems.com` (only)
- Updated `dailyMaintenanceCheck` function:
  - Same MailerSend changes as above
- Both functions bind `MAILERSEND_API_KEY` secret

#### 3. Updated: `functions/package.json`
- Removed `nodemailer` dependency
- No new dependencies needed (using built-in `fetch`)

#### 4. Unchanged
- All maintenance checking logic
- HTML email templates
- Firestore update logic
- Function scheduling
- Error handling structure

### Code Structure

**MailerSend Helper (`mailersend.js`):**
```javascript
sendWithMailerSend({
  apiKey: MAILERSEND_API_KEY.value(),
  fromEmail: 'alerts@trucks.lincolnems.com',
  fromName: 'Lincoln EMS Truck Alerts',
  toEmail: 'john.browning@lincolnems.com',
  replyTo: 'maintenance@lincolnems.com',
  subject: '...',
  html: '...'
})
```

**Firebase Secret Usage:**
```javascript
const { defineSecret } = require('firebase-functions/params');
const MAILERSEND_API_KEY = defineSecret('MAILERSEND_API_KEY');

// In function definition:
secrets: [MAILERSEND_API_KEY]

// In function code:
apiKey: MAILERSEND_API_KEY.value()
```

---

## Deployment

### Step 8: Install Dependencies
```bash
cd functions
npm install
```

This will remove `nodemailer` from `node_modules` since it's no longer in `package.json`.

### Step 9: Deploy Functions
```bash
# From project root
firebase deploy --only functions
```

**Expected Output:**
```
✔  functions[sendMaintenanceAlert(us-central1)] Successful update operation.
✔  functions[dailyMaintenanceCheck(us-central1)] Successful update operation.
✔  functions[health(us-central1)] Successful update operation.

Function URL (sendMaintenanceAlert): https://sendmaintenancealert-xxxxx-uc.a.run.app
```

### Step 10: Verify Deployment
1. Go to Firebase Console → Functions
2. Verify all functions are deployed
3. Check that `sendMaintenanceAlert` and `dailyMaintenanceCheck` show as active
4. Verify secret binding (should show `MAILERSEND_API_KEY` in function details)

---

## Testing

### Step 11: Test HTTP Endpoint

**Using curl:**
```bash
curl -X POST https://sendmaintenancealert-xxxxx-uc.a.run.app
```

**Expected Response (if maintenance due):**
```json
{
  "ok": true,
  "message": "Email sent successfully",
  "trucksWithMaintenance": 2,
  "messageId": "xxxxx-xxxxx-xxxxx",
  "accepted": ["john.browning@lincolnems.com"],
  "rejected": []
}
```

**Expected Response (if no maintenance due):**
```json
{
  "message": "No maintenance due",
  "trucksChecked": 0
}
```

### Step 12: Check Email Delivery

1. Check `john.browning@lincolnems.com` inbox
2. Verify email arrived (check spam folder if not in inbox)
3. Check email headers:
   - **From:** `alerts@trucks.lincolnems.com`
   - **Reply-To:** `maintenance@lincolnems.com`
   - **Subject:** Should match expected format
4. Verify HTML formatting is correct
5. Check MailerSend dashboard for delivery status

### Step 13: Test Scheduled Function

The scheduled function runs daily at 8:00 AM ET. To test immediately:

1. Go to Google Cloud Console
2. Navigate to **Cloud Scheduler**
3. Find `dailyMaintenanceCheck` job
4. Click **Run Now** to trigger manually
5. Check function logs in Firebase Console
6. Verify email delivery

### Step 14: Monitor Function Logs

```bash
# View recent logs
firebase functions:log

# View logs for specific function
firebase functions:log --only sendMaintenanceAlert
```

**Look for:**
- `Sending email via MailerSend: ...`
- `MailerSend email sent successfully: ...`
- Any error messages

---

## Troubleshooting

### Issue 1: Domain Verification Fails

**Symptoms:**
- MailerSend shows domain as "Pending" or "Failed"
- DNS records not recognized

**Solutions:**
1. Verify DNS records are exactly as MailerSend provided
2. Wait for DNS propagation (up to 48 hours)
3. Use DNS checker tool to verify records are live
4. Ensure only ONE SPF TXT record exists
5. Contact MailerSend support if still failing after 48 hours

### Issue 2: API Authentication Error

**Symptoms:**
- Function logs show: `MailerSend API error 401`
- Email sending fails

**Solutions:**
1. Verify API token is correct in Firebase Secret:
   ```bash
   firebase functions:secrets:access MAILERSEND_API_KEY
   ```
2. Check token hasn't expired in MailerSend dashboard
3. Regenerate token if needed and update secret
4. Ensure secret is bound to functions (check `secrets: [MAILERSEND_API_KEY]`)

### Issue 3: Email Not Delivered

**Symptoms:**
- Function succeeds but email doesn't arrive
- No error in logs

**Solutions:**
1. Check MailerSend dashboard → **Activity** for delivery status
2. Check spam folder
3. Verify recipient email address is correct
4. Check MailerSend account limits/quota
5. Verify domain is verified in MailerSend
6. Check email headers for SPF/DKIM pass status

### Issue 4: Function Deployment Fails

**Symptoms:**
- `firebase deploy --only functions` fails
- Error about missing secret

**Solutions:**
1. Ensure secret is set:
   ```bash
   firebase functions:secrets:set MAILERSEND_API_KEY
   ```
2. Verify secret name matches exactly: `MAILERSEND_API_KEY`
3. Check function code has `secrets: [MAILERSEND_API_KEY]` in options
4. Redeploy after setting secret

### Issue 5: "From" Address Rejected

**Symptoms:**
- MailerSend API returns error about from address
- Email not sent

**Solutions:**
1. Verify domain `trucks.lincolnems.com` is verified in MailerSend
2. Ensure using exact address: `alerts@trucks.lincolnems.com`
3. Check MailerSend allows sending from this address
4. Verify DNS records are correct and verified

### Issue 6: CORS Errors from Frontend

**Symptoms:**
- Frontend can't call function
- CORS policy errors in browser

**Solutions:**
- CORS is already configured in `sendMaintenanceAlert`
- Verify function URL is correct
- Check function has `cors: true` in options
- Ensure `invoker: 'public'` is set

---

## Adding Additional Recipients

Once testing is complete and everything works correctly, you can add more recipients.

### Option 1: Multiple Recipients in Single Email (Recommended)

Update `functions/index.js` to send to multiple recipients:

```javascript
// In both sendMaintenanceAlert and dailyMaintenanceCheck functions
const recipients = [
  'john.browning@lincolnems.com',
  'tw4001@aol.com',
  'deathlikesnake6@gmail.com',
  'sergentlatosha@gmail.com',
  'charley.egnor@lincolnems.com'
];

// Send to each recipient
for (const recipient of recipients) {
  await sendWithMailerSend({
    apiKey: MAILERSEND_API_KEY.value(),
    fromEmail: 'alerts@trucks.lincolnems.com',
    fromName: 'Lincoln EMS Truck Alerts',
    toEmail: recipient,
    replyTo: 'maintenance@lincolnems.com',
    subject: `Maintenance Due Alert - ${trucksWithMaintenance.length} Truck(s) Require Attention`,
    html: htmlContent,
  });
}
```

### Option 2: Use MailerSend's Multiple Recipients

MailerSend supports multiple recipients in a single API call:

```javascript
const payload = {
  from: { email: 'alerts@trucks.lincolnems.com', name: 'Lincoln EMS Truck Alerts' },
  to: [
    { email: 'john.browning@lincolnems.com' },
    { email: 'tw4001@aol.com' },
    { email: 'deathlikesnake6@gmail.com' },
    // ... more recipients
  ],
  reply_to: { email: 'maintenance@lincolnems.com' },
  subject: '...',
  html: '...'
};
```

**Note:** You'll need to update `mailersend.js` to support multiple recipients if using Option 2.

---

## Migration Checklist

Use this checklist to ensure complete migration:

### Pre-Migration
- [ ] MailerSend account created
- [ ] API token obtained
- [ ] DNS access confirmed
- [ ] Subdomain `trucks.lincolnems.com` available

### Domain Setup
- [ ] Domain added to MailerSend
- [ ] DNS records added to DNS provider
- [ ] DNS records verified (using DNS checker)
- [ ] Domain verified in MailerSend dashboard

### Firebase Setup
- [ ] MailerSend API key set as Firebase Secret
- [ ] Secret verified with `firebase functions:secrets:access`
- [ ] Code updated to use MailerSend
- [ ] `nodemailer` removed from `package.json`
- [ ] Dependencies installed (`npm install`)

### Deployment
- [ ] Functions deployed successfully
- [ ] Functions show as active in Firebase Console
- [ ] Secret binding verified in function details

### Testing
- [ ] HTTP endpoint tested manually
- [ ] Email received at `john.browning@lincolnems.com`
- [ ] Email headers verified (From, Reply-To)
- [ ] HTML formatting correct
- [ ] Scheduled function tested (or verified in Cloud Scheduler)
- [ ] Function logs reviewed for errors

### Post-Migration
- [ ] Old `.env` file removed (if no longer needed)
- [ ] `mailer.js` file can be deleted (kept for reference)
- [ ] Documentation updated
- [ ] Team notified of email address change

---

## Rollback Plan

If something goes wrong and you need to rollback:

1. **Revert Code Changes:**
   ```bash
   git checkout HEAD -- functions/index.js functions/package.json
   git checkout HEAD -- functions/mailer.js  # if deleted
   ```

2. **Restore nodemailer:**
   ```bash
   cd functions
   npm install nodemailer@^6.9.14
   ```

3. **Restore .env file** (if you have SMTP credentials)

4. **Redeploy:**
   ```bash
   firebase deploy --only functions
   ```

5. **Remove MailerSend secret** (optional):
   ```bash
   firebase functions:secrets:destroy MAILERSEND_API_KEY
   ```

---

## Key Differences from V1

| Aspect | V1 (Office 365 SMTP) | V2 (MailerSend API) |
|--------|---------------------|---------------------|
| **Transport** | SMTP (nodemailer) | REST API (fetch) |
| **From Address** | `noreply@lincolnems.com` | `alerts@trucks.lincolnems.com` |
| **Reply-To** | Not set | `maintenance@lincolnems.com` |
| **Credentials** | `.env` file | Firebase Secrets |
| **Dependencies** | `nodemailer` | None (built-in fetch) |
| **Domain Setup** | Office 365 config | MailerSend DNS records |
| **Deliverability** | Variable (SPF conflicts) | High (managed DNS) |

---

## Additional Resources

- [MailerSend API Documentation](https://developers.mailersend.com/api/v1/email.html)
- [MailerSend Domain Setup Guide](https://www.mailersend.com/help/verify-your-domain)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Firebase Functions Gen 2](https://firebase.google.com/docs/functions/beta/overview)

---

## Support

If you encounter issues not covered in this guide:

1. Check MailerSend dashboard for delivery status
2. Review Firebase Functions logs
3. Check Google Cloud Console for errors
4. Contact MailerSend support for API/domain issues
5. Refer to original `EMAIL_SETUP_DETAILS.md` for SMTP reference

---

**Document Version:** 2.0  
**Last Updated:** December 2024  
**Project:** Lincoln EMS Truck Tracker  
**Migration From:** Office 365 SMTP (nodemailer)  
**Migration To:** MailerSend Email API


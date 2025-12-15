# Email Setup Guide: Firebase Cloud Functions with Office 365 SMTP

## Overview
This guide documents every step taken to implement automated maintenance alert emails in the Lincoln EMS Truck Tracker application. This setup uses Firebase Cloud Functions (Gen 2) with Office 365 SMTP to send scheduled and on-demand emails.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Email Account Setup](#email-account-setup)
3. [Project Structure](#project-structure)
4. [Environment Configuration](#environment-configuration)
5. [Email Module Setup](#email-module-setup)
6. [Firebase Functions Implementation](#firebase-functions-implementation)
7. [Firebase Project Configuration](#firebase-project-configuration)
8. [Deployment](#deployment)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Important Lessons Learned](#important-lessons-learned)

---

## Prerequisites

### 1. Firebase Project Setup
- Firebase project already created (in our case: `trucks-af093`)
- Firebase CLI installed globally: `npm install -g firebase-tools`
- Authenticated with Firebase: `firebase login`

### 2. Node.js Version
- **Critical**: Use Node.js 20 for Firebase Functions Gen 2
- Check version: `node --version`
- If needed, use nvm to switch: `nvm use 20`

### 3. Email Account Requirements
- Office 365 email account with SMTP access enabled
- Email address (we used: `noreply@lincolnems.com`)
- Email password
- SMTP server details for Office 365:
  - **Host**: `smtp.office365.com`
  - **Port**: `587`
  - **Secure**: `false` (use STARTTLS)

---

## Email Account Setup

### Step 1: Verify Office 365 SMTP Settings
1. Log into Office 365 admin panel
2. Navigate to the email account settings
3. Ensure SMTP authentication is enabled
4. Note the following details:
   - SMTP server: `smtp.office365.com`
   - Port: `587`
   - Authentication: Required
   - TLS/STARTTLS: Enabled

### Step 2: Test SMTP Credentials Locally (Optional but Recommended)
Before implementing in Firebase, test credentials locally to ensure they work:

```javascript
// test-smtp.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@lincolnems.com',
    pass: 'YOUR_PASSWORD_HERE'
  }
});

transporter.sendMail({
  from: '"Lincoln EMS" <noreply@lincolnems.com>',
  to: 'test@example.com',
  subject: 'Test Email',
  text: 'This is a test'
}, (error, info) => {
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Email sent:', info.messageId);
  }
});
```

Run with: `node test-smtp.js`

---

## Project Structure

### Step 3: Initialize Firebase Functions Directory
Navigate to your project root and initialize functions:

```bash
cd /path/to/your/project
firebase init functions
```

When prompted:
- Select **JavaScript** (not TypeScript in our case)
- **Do not** overwrite existing files if you have any
- Install dependencies with npm: **Yes**

This creates:
```
your-project/
├── functions/
│   ├── node_modules/
│   ├── .gitignore
│   ├── index.js          # Main functions file
│   ├── package.json      # Dependencies
│   └── .eslintrc.js      # Linter config (or eslint.config.js for v9+)
```

---

## Environment Configuration

### Step 4: Create .env File for Local Development

**IMPORTANT**: Firebase Functions Gen 2 no longer supports `functions.config()`. Use environment variables instead.

Create `/functions/.env` file:

```bash
cd functions
touch .env
```

Add your SMTP credentials to `.env`:

```env
# SMTP Configuration for Office 365
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@lincolnems.com
SMTP_PASS=YOUR_ACTUAL_PASSWORD_HERE
SMTP_FROM_NAME=Lincoln EMS Fleet Maintenance
```

### Step 5: Secure the .env File

Ensure `.env` is in your `.gitignore`:

```bash
# In /functions/.gitignore, add:
.env
node_modules/
```

**Never commit the .env file to version control!**

---

## Email Module Setup

### Step 6: Install Nodemailer

In the `/functions` directory, install nodemailer:

```bash
cd functions
npm install nodemailer
```

### Step 7: Create Email Module (mailer.js)

Create `/functions/mailer.js` to encapsulate email logic:

```javascript
// mailer.js
const nodemailer = require('nodemailer');

/**
 * Create and configure the SMTP transporter
 * @returns {nodemailer.Transporter} Configured email transporter
 */
function createTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = process.env.SMTP_USER || 'noreply@lincolnems.com';
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpPass) {
    throw new Error('SMTP_PASS environment variable is required');
  }

  const transportConfig = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // false for port 587, true for 465
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    logger: true,  // Enable logging for debugging
    debug: true,   // Enable debug output
  };

  console.log('Creating SMTP transporter with config:', {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
  });

  return nodemailer.createTransport(transportConfig);
}

/**
 * Get formatted from address with name
 * @returns {string} Formatted email address
 */
function fromAddress() {
  const fromName = process.env.SMTP_FROM_NAME || 'Lincoln EMS Fleet Maintenance';
  const fromEmail = process.env.SMTP_USER || 'noreply@lincolnems.com';
  return `"${fromName}" <${fromEmail}>`;
}

module.exports = {
  createTransporter,
  fromAddress,
};
```

**Key Points:**
- Uses `process.env` to read environment variables
- Provides sensible defaults
- Includes error checking for required variables
- Enables logging for troubleshooting
- Exports reusable functions

---

## Firebase Functions Implementation

### Step 8: Update package.json

Ensure `/functions/package.json` has the correct configuration:

```json
{
  "name": "functions",
  "description": "Firebase Cloud Functions for Lincoln EMS Truck Tracker email notifications",
  "scripts": {
    "lint": "eslint .",
    "serve": "firebase emulators:start --only functions",
    "shell": "firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "20"
  },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.5.0",
    "firebase-functions": "^4.9.0",
    "nodemailer": "^6.9.8"
  },
  "devDependencies": {
    "eslint": "^8.57.0"
  },
  "private": true
}
```

**Critical Settings:**
- `"node": "20"` - Must use Node 20 for Gen 2 functions
- `firebase-functions: "^4.9.0"` - Gen 2 compatible version
- `firebase-admin: "^12.5.0"` - Latest admin SDK

Install dependencies:
```bash
npm install
```

### Step 9: Create ESLint Configuration

For ESLint v9+ (flat config), create `/functions/eslint.config.js`:

```javascript
module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      'no-restricted-globals': ['error', 'name', 'length'],
      'prefer-arrow-callback': 'error',
      'quotes': ['error', 'single', { avoidEscape: true }],
      'no-unused-vars': ['warn'],
    },
  },
];
```

### Step 10: Implement Cloud Functions (index.js)

Create `/functions/index.js` with the following structure:

```javascript
// ===== PART 1: IMPORTS AND INITIALIZATION =====

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

// Import Firebase Functions v2
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Import email utilities
const { createTransporter, fromAddress } = require('./mailer');

// ===== PART 2: HELPER FUNCTIONS =====

/**
 * Format date for email display
 * @param {Date|Timestamp} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  if (date.toDate) { // Firestore Timestamp
    return date.toDate().toLocaleDateString('en-US');
  }
  return new Date(date).toLocaleDateString('en-US');
};

// ===== PART 3: EMAIL TEMPLATE GENERATION =====

/**
 * Generate HTML for a single truck's maintenance section
 * @param {Object} truck - Truck data
 * @param {Array} maintenanceAlerts - Array of maintenance alerts
 * @returns {string} HTML string
 */
const generateTruckMaintenanceHtml = (truck, maintenanceAlerts) => {
  let alertsHtml = '';
  
  // Add Out of Service status if applicable
  if (truck.status === 'out-of-service') {
    alertsHtml += `
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #dc2626; font-weight: bold;">
          ⚠️ OUT OF SERVICE
        </p>
        <p style="margin: 0; font-size: 14px; color: #991b1b;">
          <strong>Reason:</strong> ${truck.outOfServiceReason || 'No reason specified'}
        </p>
      </div>
    `;
  }
  
  // Add maintenance alerts
  maintenanceAlerts.forEach(alert => {
    const colorClass = alert.priority === 'overdue' ? '#dc3545' : '#f59e0b';
    alertsHtml += `
      <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colorClass};">
        <strong>${alert.type}:</strong> ${alert.message}
      </p>
    `;
  });

  return `
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #ffffff;">
      <h3 style="color: #0056b3; margin-top: 0;">🚛 Unit ${truck.unitNumber} - ${truck.vehicleYear} ${truck.vehicleType}</h3>
      <p style="margin: 0 0 5px 0; font-size: 14px;"><strong>VIN:</strong> ${truck.vin}</p>
      <p style="margin: 0 0 5px 0; font-size: 14px;"><strong>Current Mileage:</strong> ${truck.mileage.toLocaleString()}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Last Updated:</strong> ${formatDate(truck.mileageLastUpdated || truck.updatedAt)}</p>
      ${alertsHtml}
    </div>
  `;
};

/**
 * Create full HTML email template
 * @param {Array} trucksWithMaintenance - Array of trucks needing maintenance
 * @returns {string} Complete HTML email
 */
const createMaintenanceEmailHTML = (trucksWithMaintenance) => {
  const trucksHtml = trucksWithMaintenance.map(truck => 
    generateTruckMaintenanceHtml(truck, truck.alerts)
  ).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maintenance Due Alert - Lincoln EMS</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="color: #dc2626; margin: 0; font-size: 28px;">🚛 Maintenance Due Alert</h1>
      <p style="color: #666; margin: 10px 0 0 0;">Lincoln EMS Fleet Maintenance System</p>
      <p style="font-weight: bold; margin: 10px 0 0 0;"><strong>${trucksWithMaintenance.length}</strong> truck(s) require attention</p>
    </div>

    ${trucksHtml}

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 14px;">
      <p>This is an automated notification from the <strong>Lincoln EMS Fleet Maintenance System</strong>.</p>
      <p>Please update the system once maintenance has been completed.</p>
      <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    </div>
  </div>
</body>
</html>
  `;
};

// ===== PART 4: MAINTENANCE CHECKING LOGIC =====

/**
 * Check all trucks for maintenance due and overdue
 * @returns {Promise<Array>} Array of trucks needing maintenance
 */
const checkMaintenanceDue = async () => {
  try {
    // Get all trucks from Firestore
    const trucksSnapshot = await db.collection('trucks').get();
    const trucks = trucksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const trucksWithMaintenance = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const truck of trucks) {
      // Skip if already alerted within the last 7 days
      if (truck.lastMaintenanceAlertSent) {
        const lastAlertDate = truck.lastMaintenanceAlertSent.toDate ? 
          truck.lastMaintenanceAlertSent.toDate() : 
          new Date(truck.lastMaintenanceAlertSent);
        
        if (lastAlertDate > sevenDaysAgo) {
          console.log(`Skipping truck ${truck.unitNumber} - already alerted on ${lastAlertDate.toDateString()}`);
          continue;
        }
      }
      
      const maintenanceAlerts = [];
      let hasOverdue = false;
      
      // OIL CHANGE CHECK (every 5000 miles)
      const nextOilChangeMileage = (truck.lastOilChangeMileage || 0) + 5000;
      if (truck.mileage >= nextOilChangeMileage) {
        const milesOverdue = truck.mileage - nextOilChangeMileage;
        maintenanceAlerts.push({
          type: '🛢️ Oil Change',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        hasOverdue = true;
      } else if (truck.mileage >= nextOilChangeMileage - 500) {
        maintenanceAlerts.push({
          type: '🛢️ Oil Change',
          message: `Due in ${nextOilChangeMileage - truck.mileage} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // WV INSPECTION CHECK (30 days warning)
      if (truck.inspectionStickerExpiry) {
        const inspectionDate = truck.inspectionStickerExpiry.toDate ? 
          truck.inspectionStickerExpiry.toDate() : 
          new Date(truck.inspectionStickerExpiry);
        const daysUntilExpiry = Math.ceil((inspectionDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 0) {
          maintenanceAlerts.push({
            type: '📋 WV Inspection',
            message: `Expired on ${formatDate(truck.inspectionStickerExpiry)}.`,
            priority: 'overdue'
          });
          hasOverdue = true;
        } else if (daysUntilExpiry <= 30) {
          maintenanceAlerts.push({
            type: '📋 WV Inspection',
            message: `Expires in ${daysUntilExpiry} days on ${formatDate(truck.inspectionStickerExpiry)}.`,
            priority: 'due-soon'
          });
        }
      }
      
      // OEMS INSPECTION CHECK (30 days warning)
      if (truck.oemsInspectionExpiry) {
        const oemsDate = truck.oemsInspectionExpiry.toDate ? 
          truck.oemsInspectionExpiry.toDate() : 
          new Date(truck.oemsInspectionExpiry);
        const daysUntilOemsExpiry = Math.ceil((oemsDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilOemsExpiry <= 0) {
          maintenanceAlerts.push({
            type: '🏥 OEMS Inspection',
            message: `Expired on ${formatDate(truck.oemsInspectionExpiry)}.`,
            priority: 'overdue'
          });
          hasOverdue = true;
        } else if (daysUntilOemsExpiry <= 30) {
          maintenanceAlerts.push({
            type: '🏥 OEMS Inspection',
            message: `Expires in ${daysUntilOemsExpiry} days on ${formatDate(truck.oemsInspectionExpiry)}.`,
            priority: 'due-soon'
          });
        }
      }
      
      // BRAKE CHANGE CHECK (every 25000 miles)
      const nextBrakeChangeMileage = (truck.lastBrakeChangeMileage || 0) + 25000;
      if (truck.mileage >= nextBrakeChangeMileage) {
        const milesOverdue = truck.mileage - nextBrakeChangeMileage;
        maintenanceAlerts.push({
          type: '🛑 Brake Service',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        if (milesOverdue > 1000) hasOverdue = true;
      } else if (truck.mileage >= nextBrakeChangeMileage - 2500) {
        maintenanceAlerts.push({
          type: '🛑 Brake Service',
          message: `Due in ${nextBrakeChangeMileage - truck.mileage} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // TIRE CHANGE CHECK (every 40000 miles)
      const nextTireChangeMileage = (truck.lastTireChangeMileage || 0) + 40000;
      if (truck.mileage >= nextTireChangeMileage) {
        const milesOverdue = truck.mileage - nextTireChangeMileage;
        maintenanceAlerts.push({
          type: '🛞 Tire Service',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        if (milesOverdue > 2000) hasOverdue = true;
      } else if (truck.mileage >= nextTireChangeMileage - 4000) {
        maintenanceAlerts.push({
          type: '🛞 Tire Service',
          message: `Due in ${nextTireChangeMileage - truck.mileage} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // Add truck if it has alerts OR is out of service
      if (maintenanceAlerts.length > 0 || truck.status === 'out-of-service') {
        trucksWithMaintenance.push({
          ...truck,
          alerts: maintenanceAlerts,
          hasOverdue
        });
      }
    }
    
    return trucksWithMaintenance;
    
  } catch (error) {
    console.error('Error checking maintenance:', error);
    throw error;
  }
};

// ===== PART 5: HTTP ENDPOINT FOR MANUAL TRIGGERING =====

/**
 * HTTP endpoint to manually send maintenance alerts
 * Can be called from frontend or via direct HTTP request
 */
exports.sendMaintenanceAlert = onRequest(
  {
    region: 'us-central1',
    cors: true,
    invoker: 'public', // Allow unauthenticated access
  },
  async (req, res) => {
    try {
      // Set CORS headers
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      
      // Handle OPTIONS preflight request
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      console.log('Manual maintenance check triggered...');
      
      // Check which trucks need maintenance
      const trucksWithMaintenance = await checkMaintenanceDue();
      
      if (trucksWithMaintenance.length === 0) {
        return res.status(200).json({ 
          message: 'No maintenance due', 
          trucksChecked: trucksWithMaintenance.length 
        });
      }
      
      console.log(`Found ${trucksWithMaintenance.length} trucks with maintenance due`);
      
      // Create email content
      const htmlContent = createMaintenanceEmailHTML(trucksWithMaintenance);
      
      // Send email
      const transporter = createTransporter();
      const info = await transporter.sendMail({
        from: fromAddress(),
        to: 'john.browning@lincolnems.com, tw4001@aol.com',
        subject: `Maintenance Due Alert - ${trucksWithMaintenance.length} Truck(s) Require Attention`,
        html: htmlContent,
      });

      console.log('Email sent successfully:', info.messageId);

      // Update lastMaintenanceAlertSent timestamp for all alerted trucks
      const updatePromises = trucksWithMaintenance.map(truck => 
        db.collection('trucks').doc(truck.id).update({
          lastMaintenanceAlertSent: new Date()
        })
      );
      await Promise.all(updatePromises);
      console.log(`Updated lastMaintenanceAlertSent for ${trucksWithMaintenance.length} trucks`);

      return res.status(200).json({
        ok: true,
        message: 'Email sent successfully',
        trucksWithMaintenance: trucksWithMaintenance.length,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      });
    } catch (err) {
      console.error('sendMaintenanceAlert error:', err);
      
      let errorMessage = String(err);
      if (err.code === 'EAUTH') {
        errorMessage = 'SMTP Authentication failed. Please check email credentials.';
      }
      
      return res.status(500).json({ ok: false, error: errorMessage, details: err.message });
    }
  }
);

// ===== PART 6: SCHEDULED FUNCTION FOR DAILY CHECKS =====

/**
 * Scheduled function to check maintenance daily at 8:00 AM ET
 * Automatically sends emails if maintenance is due
 */
exports.dailyMaintenanceCheck = onSchedule(
  {
    schedule: '0 8 * * *', // Cron format: minute hour day month dayOfWeek
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async () => {
    try {
      console.log('Running daily maintenance check...');
      
      const trucksWithMaintenance = await checkMaintenanceDue();
      
      if (trucksWithMaintenance.length === 0) {
        console.log('No maintenance due - no email sent');
        return;
      }
      
      console.log(`Found ${trucksWithMaintenance.length} trucks with maintenance due`);
      
      const htmlContent = createMaintenanceEmailHTML(trucksWithMaintenance);
      
      const transporter = createTransporter();
      await transporter.sendMail({
        from: fromAddress(),
        to: 'john.browning@lincolnems.com, tw4001@aol.com',
        subject: `Daily Maintenance Alert - ${trucksWithMaintenance.length} Truck(s) Require Attention`,
        html: htmlContent,
      });
      
      console.log('Daily maintenance email sent successfully');
      
      // Update timestamps
      const updatePromises = trucksWithMaintenance.map(truck => 
        db.collection('trucks').doc(truck.id).update({
          lastMaintenanceAlertSent: new Date()
        })
      );
      await Promise.all(updatePromises);
      console.log(`Updated lastMaintenanceAlertSent for ${trucksWithMaintenance.length} trucks`);
    } catch (err) {
      console.error('dailyMaintenanceCheck error:', err);
    }
  }
);

// ===== PART 7: HEALTH CHECK ENDPOINT =====

/**
 * Simple health check endpoint to verify functions are running
 */
exports.health = onRequest({ region: 'us-central1' }, (_req, res) => {
  res.status(200).send('ok');
});
```

**Key Implementation Points:**
1. Use Firebase Functions Gen 2 (`onRequest`, `onSchedule` from v2)
2. Read environment variables with `process.env`
3. Two functions: HTTP endpoint for manual triggers, scheduled function for automation
4. CORS enabled for frontend calls
5. Error handling with helpful messages
6. Logging for debugging
7. Updates Firestore after sending emails to track alert history

---

## Firebase Project Configuration

### Step 11: Update Firebase.json (Optional)

If you want to configure functions region or other settings, update `firebase.json`:

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ]
    }
  ]
}
```

### Step 12: Enable Required Google Cloud APIs

Firebase Functions Gen 2 requires several Google Cloud APIs. These are usually enabled automatically, but verify:

1. Cloud Functions API
2. Cloud Build API
3. Cloud Scheduler API (for scheduled functions)
4. Eventarc API
5. Pub/Sub API
6. Cloud Run API

Firebase CLI will prompt you to enable these during deployment if needed.

---

## Deployment

### Step 13: Deploy Functions

From your project root directory:

```bash
# Navigate to project root
cd /path/to/your/project

# Deploy only functions
firebase deploy --only functions
```

The deployment process will:
1. Lint your code (fix any ESLint errors first)
2. Load environment variables from `.env`
3. Package your code
4. Upload to Google Cloud
5. Create/update Cloud Functions
6. Create Cloud Scheduler job (for scheduled function)
7. Generate function URLs

**Expected Output:**
```
✔  functions[health(us-central1)] Successful update operation.
✔  functions[dailyMaintenanceCheck(us-central1)] Successful update operation.
✔  functions[sendMaintenanceAlert(us-central1)] Successful update operation.

Function URL (sendMaintenanceAlert): https://sendmaintenancealert-xxxxx-uc.a.run.app
Function URL (health): https://health-xxxxx-uc.a.run.app
```

**Save the function URLs** - you'll need them for testing and frontend integration.

### Step 14: Verify Deployment

Check the Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project
3. Navigate to Functions
4. Verify all three functions are deployed:
   - `sendMaintenanceAlert` (HTTP)
   - `dailyMaintenanceCheck` (Scheduled)
   - `health` (HTTP)

### Step 15: Check Cloud Scheduler

For the scheduled function:
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to Cloud Scheduler
3. Verify `dailyMaintenanceCheck` job exists
4. Check schedule: `0 8 * * *` (8 AM daily)
5. Check timezone: `America/New_York`

---

## Testing

### Step 16: Test with curl (Command Line)

Test the HTTP endpoint from terminal:

```bash
curl -X POST https://sendmaintenancealert-xxxxx-uc.a.run.app
```

Expected response if no maintenance due:
```json
{
  "message": "No maintenance due",
  "trucksChecked": 0
}
```

Expected response if maintenance due:
```json
{
  "ok": true,
  "message": "Email sent successfully",
  "trucksWithMaintenance": 2,
  "messageId": "xxxxx",
  "accepted": ["john.browning@lincolnems.com", "tw4001@aol.com"],
  "rejected": []
}
```

### Step 17: Test from Frontend (Optional)

Add a test button to your React app:

```javascript
const handleTestEmail = async () => {
  try {
    const functionUrl = 'https://sendmaintenancealert-xxxxx-uc.a.run.app';
    const response = await fetch(functionUrl, { method: 'POST' });
    const data = await response.json();
    
    if (data.ok) {
      alert(`✅ Email sent to ${data.trucksWithMaintenance} trucks!`);
    } else {
      alert(`ℹ️ ${data.message}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error sending email');
  }
};
```

### Step 18: Check Email Inbox

1. Check both recipient inboxes:
   - john.browning@lincolnems.com
   - tw4001@aol.com

2. Verify email contains:
   - Professional HTML formatting
   - All trucks with maintenance due
   - Out-of-service trucks (if any)
   - Truck details (VIN, mileage, etc.)
   - Specific maintenance alerts

3. Check spam folder if email doesn't arrive

### Step 19: View Function Logs

Monitor logs for debugging:

```bash
# View all function logs
firebase functions:log

# Or view in Firebase Console
# Go to Functions > Select function > Logs tab
```

Look for:
- "Manual maintenance check triggered..."
- "Found X trucks with maintenance due"
- "Email sent successfully: [messageId]"
- "Updated lastMaintenanceAlertSent for X trucks"

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Error (EAUTH)
**Symptom:** Error: Invalid login: 535 5.7.139 Authentication unsuccessful

**Solutions:**
- Verify SMTP credentials in `.env` file
- Ensure password is correct (no typos)
- Check that SMTP is enabled on the email account
- Office 365 may block Google Cloud IPs - use `.env` instead of Firebase Secrets
- Try testing credentials locally first (see Step 2)

#### 2. ESLint Errors During Deployment
**Symptom:** Functions deployment fails with linting errors

**Solutions:**
- Create proper `eslint.config.js` for ESLint v9+
- Fix any unused variables warnings
- Run `npm run lint` in `/functions` to check locally
- Add `/* eslint-disable */` comments if needed for specific lines

#### 3. Functions Config Not Available Error
**Symptom:** Error: functions.config() is no longer available

**Solution:**
- **DO NOT** use `functions.config()` in Gen 2
- Use `process.env.VARIABLE_NAME` instead
- Create `.env` file in `/functions` directory
- Ensure Node 20 runtime

#### 4. CORS Errors from Frontend
**Symptom:** CORS policy blocking frontend requests

**Solutions:**
- Add `cors: true` to `onRequest` options
- Add `invoker: 'public'` for unauthenticated access
- Set CORS headers manually in function:
  ```javascript
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  ```
- Handle OPTIONS preflight requests

#### 5. Scheduled Function Not Running
**Symptom:** Daily emails not being sent

**Solutions:**
- Check Cloud Scheduler in Google Cloud Console
- Verify timezone is correct
- Check function logs for errors
- Ensure Cloud Scheduler API is enabled
- Test with manual trigger first

#### 6. Emails Going to Spam
**Symptom:** Emails arrive in spam folder

**Solutions:**
- Use professional email domain (not Gmail)
- Set proper `From` name: `"Your Company Name" <email@domain.com>`
- Use HTML templates (not plain text)
- Avoid spam trigger words in subject
- Consider SPF/DKIM records for your domain

#### 7. Node Version Mismatch
**Symptom:** Deployment fails with Node version errors

**Solutions:**
- Update `/functions/package.json`: `"node": "20"`
- Update Firebase Functions: `"firebase-functions": "^4.9.0"`
- Update Firebase Admin: `"firebase-admin": "^12.5.0"`
- Run `npm install` in `/functions`

---

## Important Lessons Learned

### 1. Firebase Secrets vs .env Files
**Issue:** Firebase Secrets caused Office 365 authentication to fail from Google Cloud IPs.

**Solution:** Use `.env` file in `/functions` directory instead. Firebase automatically loads this during deployment.

**Why it matters:** Office 365 may have conditional access policies that block Google Cloud IPs. Using `.env` somehow circumvented this issue (likely related to how environment variables are injected).

### 2. Firebase Functions Gen 2 Changes
Firebase Functions Gen 2 has significant breaking changes from Gen 1:

**Gen 1 (Old - DON'T USE):**
```javascript
const functions = require('firebase-functions');
functions.config().smtp.password
functions.https.onRequest()
functions.pubsub.schedule()
```

**Gen 2 (New - USE THIS):**
```javascript
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
process.env.SMTP_PASS
// Node 20 required
```

### 3. SMTP Settings for Office 365
The exact configuration that works:

```javascript
{
  host: 'smtp.office365.com',
  port: 587,
  secure: false,  // IMPORTANT: false for port 587
  auth: {
    user: 'noreply@lincolnems.com',
    pass: process.env.SMTP_PASS
  }
}
```

**Do NOT add:**
- `tls` configuration (let nodemailer handle it)
- `requireTLS: true` (causes issues)
- Custom `secureConnection` settings

### 4. Testing Locally vs Cloud
SMTP authentication may work locally but fail in Firebase Functions due to:
- Google Cloud IP addresses
- Different network routing
- Security policies on email provider

**Always test in production** after local testing succeeds.

### 5. Weekly Alert Frequency Implementation
To prevent daily spam, track last alert sent:

1. Add `lastMaintenanceAlertSent` field to Firestore truck documents
2. Check this field before including truck in email:
   ```javascript
   const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
   if (lastAlertDate > sevenDaysAgo) {
     continue; // Skip this truck
   }
   ```
3. Update the field after sending email successfully

### 6. Modularization is Key
Separate concerns into different files:
- `mailer.js` - Email configuration and transporter
- `index.js` - Business logic and Cloud Functions
- `.env` - Configuration variables

This makes code more maintainable and reusable.

### 7. Logging is Essential
Add extensive logging throughout:
```javascript
console.log('Manual maintenance check triggered...');
console.log(`Found ${count} trucks with maintenance due`);
console.log('Email sent successfully:', messageId);
```

Helps tremendously with debugging in production.

---

## Summary Checklist

Use this checklist for future email implementations:

- [ ] Office 365 (or other) email account with SMTP access
- [ ] SMTP credentials (host, port, user, password)
- [ ] Firebase project with Blaze (pay-as-you-go) plan
- [ ] Node.js 20 installed
- [ ] Firebase CLI installed and authenticated
- [ ] Create `/functions/.env` file with SMTP credentials
- [ ] Add `.env` to `.gitignore`
- [ ] Install nodemailer: `npm install nodemailer`
- [ ] Create `mailer.js` module
- [ ] Update `package.json` with Node 20 and correct dependencies
- [ ] Create `eslint.config.js` for linting
- [ ] Implement functions in `index.js` using Gen 2 syntax
- [ ] Test SMTP credentials locally first
- [ ] Deploy: `firebase deploy --only functions`
- [ ] Test HTTP endpoint with curl or frontend
- [ ] Verify scheduled function in Cloud Scheduler
- [ ] Check email inbox (including spam)
- [ ] Monitor function logs for errors
- [ ] Update documentation

---

## Additional Resources

- [Firebase Functions Gen 2 Docs](https://firebase.google.com/docs/functions/beta/overview)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Office 365 SMTP Settings](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)
- [Cloud Scheduler Cron Format](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules)
- [Firebase Environment Variables](https://firebase.google.com/docs/functions/config-env)

---

## Questions?

If implementing in a different app, consider:
1. What triggers the email? (scheduled, event-based, manual?)
2. What data needs to be included in the email?
3. Who should receive the emails?
4. What's the email frequency? (prevent spam)
5. How will you track email history?
6. What HTML template design fits your brand?

Adapt this guide to your specific needs, but the core implementation remains the same.

---

**Document Version:** 1.0  
**Last Updated:** October 16, 2025  
**Project:** Lincoln EMS Truck Tracker  
**Author:** Development Team


# Lincoln EMS Truck Tracker - Email Notifications

This Firebase Cloud Functions project provides automated email notifications for maintenance due alerts.

## Features

- **Daily Maintenance Checks**: Automatically runs every day at 8 AM EST
- **Professional Email Templates**: HTML-formatted emails with responsive design
- **Comprehensive Maintenance Alerts**:
  - Oil changes (every 5,000 miles)
  - WV Inspections (30-day warning)
  - OEMS Inspections (30-day warning)
  - Brake service (every 25,000 miles)
  - Tire service (every 40,000 miles)
- **Manual Trigger**: Test function available via HTTPS endpoint

## Setup Instructions

### 1. Configure SMTP Credentials

Set your GoDaddy email password in Firebase config:

```bash
firebase functions:config:set smtp.password="your-email-password"
```

### 2. Deploy Functions

```bash
cd functions
npm run deploy
```

### 3. Test the Function

You can test the email notification manually by calling:
```
https://us-central1-trucks-af093.cloudfunctions.net/sendMaintenanceAlert
```

## Email Configuration

The system sends emails from `noreply@lincolnems.com` to `john.browning@lincolnems.com` with:

- **Professional HTML formatting**
- **Responsive design** for mobile devices
- **Clear maintenance alerts** with due dates and mileage
- **Truck information** including unit number, vehicle details, and current status
- **Priority indicators** for overdue vs. due soon items

## Maintenance Rules

- **Oil Change**: Every 5,000 miles (overdue if >500 miles past due)
- **WV Inspection**: Warning at 30 days, urgent at 7 days
- **OEMS Inspection**: Warning at 30 days, urgent at 7 days  
- **Brake Service**: Every 25,000 miles (overdue if >1,000 miles past due)
- **Tire Service**: Every 40,000 miles (overdue if >2,000 miles past due)

## Functions

### `checkMaintenanceDaily`
- **Trigger**: Scheduled daily at 8 AM EST
- **Purpose**: Automatically check all trucks and send email if maintenance is due

### `sendMaintenanceAlert`
- **Trigger**: Manual HTTPS request
- **Purpose**: Test function to manually trigger maintenance check and email

## Email Recipients

Currently configured to send to: `john.browning@lincolnems.com`

To add more recipients, modify the `to` field in the `mailOptions` object in `index.js`.


// Firebase Admin & Functions (Gen 2)
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { sendWithMailerSend } = require('./mailersend');

// Define MailerSend API key secret
const MAILERSEND_API_KEY = defineSecret('MAILERSEND_API_KEY');

// Helper to format date for display
const formatDate = (date) => {
  if (!date) return 'N/A';
  if (date.toDate) { // Firestore Timestamp
    return date.toDate().toLocaleDateString('en-US');
  }
  return new Date(date).toLocaleDateString('en-US');
};

// Function to generate HTML for a single truck's maintenance
const generateTruckMaintenanceHtml = (truck, maintenanceAlerts) => {
  let alertsHtml = '';
  
  // Add Out of Service status at the top if applicable
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

// Function to check maintenance due dates
const checkMaintenanceDue = async (testMode = false) => {
  try {
    // Get all trucks
    const trucksSnapshot = await db.collection('trucks').get();
    const trucks = trucksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const trucksWithMaintenance = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const truck of trucks) {
      // Skip this truck if it was alerted within the last 7 days (unless in test mode)
      if (!testMode && truck.lastMaintenanceAlertSent) {
        const lastAlertDate = truck.lastMaintenanceAlertSent.toDate ? truck.lastMaintenanceAlertSent.toDate() : new Date(truck.lastMaintenanceAlertSent);
        if (lastAlertDate > sevenDaysAgo) {
          console.log(`Skipping truck ${truck.unitNumber} - already alerted on ${lastAlertDate.toDateString()}`);
          continue; // Skip this truck
        }
      }
      
      // Helper to check if alert was cleared recently
      const isAlertClearedRecently = (alertType) => {
        const alertsCleared = truck.alertsCleared || {};
        const clearedDate = alertsCleared[alertType];
        if (!clearedDate) return false;
        
        const cleared = clearedDate.toDate ? clearedDate.toDate() : new Date(clearedDate);
        return cleared > sevenDaysAgo;
      };
      
      const maintenanceAlerts = [];
      let hasOverdue = false;
      
      // Oil Change Check (every 5000 miles)
      const nextOilChangeMileage = (truck.lastOilChangeMileage || 0) + 5000;
      if (truck.mileage >= nextOilChangeMileage && !isAlertClearedRecently('oilChange')) {
        const milesOverdue = truck.mileage - nextOilChangeMileage;
        maintenanceAlerts.push({
          type: '🛢️ Oil Change',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        hasOverdue = true;
      } else if (truck.mileage >= nextOilChangeMileage - 500 && !isAlertClearedRecently('oilChange')) {
        maintenanceAlerts.push({
          type: '🛢️ Oil Change',
          message: `Due in ${nextOilChangeMileage - truck.mileage} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // WV Inspection Check (30 days warning)
      if (truck.inspectionStickerExpiry && !isAlertClearedRecently('inspection')) {
        const inspectionDate = truck.inspectionStickerExpiry.toDate ? truck.inspectionStickerExpiry.toDate() : new Date(truck.inspectionStickerExpiry);
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
      
      // OEMS Inspection Check (30 days warning)
      if (truck.oemsInspectionExpiry && !isAlertClearedRecently('oemsInspection')) {
        const oemsDate = truck.oemsInspectionExpiry.toDate ? truck.oemsInspectionExpiry.toDate() : new Date(truck.oemsInspectionExpiry);
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
      
      // Brake Change Check (every 25000 miles)
      const nextBrakeChangeMileage = (truck.lastBrakeChangeMileage || 0) + 25000;
      if (truck.mileage >= nextBrakeChangeMileage && !isAlertClearedRecently('brakeChange')) {
        const milesOverdue = truck.mileage - nextBrakeChangeMileage;
        maintenanceAlerts.push({
          type: '🛑 Brake Service',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        if (milesOverdue > 1000) hasOverdue = true;
      } else if (truck.mileage >= nextBrakeChangeMileage - 2500 && !isAlertClearedRecently('brakeChange')) {
        maintenanceAlerts.push({
          type: '🛑 Brake Service',
          message: `Due in ${nextBrakeChangeMileage - truck.mileage} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // Tire Change Check (every 40000 miles)
      const nextTireChangeMileage = (truck.lastTireChangeMileage || 0) + 40000;
      if (truck.mileage >= nextTireChangeMileage && !isAlertClearedRecently('tireChange')) {
        const milesOverdue = truck.mileage - nextTireChangeMileage;
        maintenanceAlerts.push({
          type: '🛞 Tire Service',
          message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
          priority: 'overdue'
        });
        if (milesOverdue > 2000) hasOverdue = true;
      } else if (truck.mileage >= nextTireChangeMileage - 4000 && !isAlertClearedRecently('tireChange')) {
        maintenanceAlerts.push({
          type: '🛞 Tire Service',
          message: `Due in ${nextTireChangeMileage - truck.mileage} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
          priority: 'due-soon'
        });
      }
      
      // If truck has any maintenance alerts OR is out of service, add it to the list
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

// Create full HTML email template
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

// ===== HTTP endpoint to send maintenance alert =====
exports.sendMaintenanceAlert = onRequest(
  {
    region: 'us-central1',
    cors: true,
    invoker: 'public', // Allow unauthenticated access
    secrets: [MAILERSEND_API_KEY], // Bind MailerSend API key secret
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
      
      // Check for test mode (bypass 7-day check for testing)
      const testMode = req.query.test === 'true' || (req.body && req.body.test === true);
      
      const trucksWithMaintenance = await checkMaintenanceDue(testMode);
      
      if (trucksWithMaintenance.length === 0) {
        return res.status(200).json({ 
          message: 'No maintenance due', 
          trucksChecked: trucksWithMaintenance.length 
        });
      }
      
      console.log(`Found ${trucksWithMaintenance.length} trucks with maintenance due`);
      
      // Create email content
      const htmlContent = createMaintenanceEmailHTML(trucksWithMaintenance);
      
      // Send email via MailerSend to multiple recipients with personalized names
      // Note: MailerSend has limits on recipients per call, so we send individually
      const recipients = [
        { email: 'john.browning@lincolnems.com', name: 'John Browning' },
        { email: 'deathlikesnake6@gmail.com', name: 'William Frazier' },
        { email: 'tw4001@aol.com', name: 'Trish Watson' },
        { email: 'sergentlatosha@gmail.com', name: 'LaTosha Sergent' },
        { email: 'charley.egnor@lincolnems.com', name: 'Charley Egnor' }
      ];
      
      const sendPromises = recipients.map(recipient => 
        sendWithMailerSend({
          apiKey: MAILERSEND_API_KEY.value(),
          fromEmail: 'alerts@trucks.lincolnems.com',
          fromName: 'Lincoln EMS Truck Alerts',
          toEmail: recipient.email,
          toName: recipient.name,
          replyTo: 'maintenance@lincolnems.com',
        subject: `Maintenance Due Alert - ${trucksWithMaintenance.length} Truck(s) Require Attention`,
        html: htmlContent,
        })
      );

      const results = await Promise.all(sendPromises);
      console.log(`Emails sent successfully via MailerSend to ${results.length} recipients:`, 
        results.map(r => r.messageId).join(', '));

      // Send response immediately to prevent Cloud Run retries
      res.status(200).json({
        ok: true,
        message: 'Emails sent successfully',
        trucksWithMaintenance: trucksWithMaintenance.length,
        recipients: recipients.length,
        recipientEmails: recipients.map(r => r.email),
        messageIds: results.map(r => r.messageId),
        accepted: results.flatMap(r => r.accepted),
        rejected: results.flatMap(r => r.rejected),
      });

      // Update lastMaintenanceAlertSent in background (after response sent)
      // This prevents delays that could cause Cloud Run to retry
      const updatePromises = trucksWithMaintenance.map(truck => 
        db.collection('trucks').doc(truck.id).update({
          lastMaintenanceAlertSent: new Date()
        })
      );
      Promise.all(updatePromises).then(() => {
      console.log(`Updated lastMaintenanceAlertSent for ${trucksWithMaintenance.length} trucks`);
      }).catch(err => {
        console.error('Error updating lastMaintenanceAlertSent:', err);
      });
    } catch (err) {
      console.error('sendMaintenanceAlert error:', err);
      
      // Provide more helpful error messages
      let errorMessage = String(err);
      if (err.message && err.message.includes('MailerSend')) {
        errorMessage = `MailerSend API error: ${err.message}`;
      }
      
      return res.status(500).json({ ok: false, error: errorMessage, details: err.message });
    }
  }
);

// ===== Scheduled maintenance check daily at 8:00 AM ET =====
exports.dailyMaintenanceCheck = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
    secrets: [MAILERSEND_API_KEY], // Bind MailerSend API key secret
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
      
      // Send email via MailerSend to multiple recipients with personalized names
      // Note: MailerSend may have limits on recipients per call, so we send individually
      const recipients = [
        { email: 'john.browning@lincolnems.com', name: 'John Browning' },
        { email: 'deathlikesnake6@gmail.com', name: 'William Frazier' },
        { email: 'tw4001@aol.com', name: 'Trish Watson' },
        { email: 'sergentlatosha@gmail.com', name: 'LaTosha Sergent' },
        { email: 'charley.egnor@lincolnems.com', name: 'Charley Egnor' }
      ];
      
      const sendPromises = recipients.map(recipient => 
        sendWithMailerSend({
          apiKey: MAILERSEND_API_KEY.value(),
          fromEmail: 'alerts@trucks.lincolnems.com',
          fromName: 'Lincoln EMS Truck Alerts',
          toEmail: recipient.email,
          toName: recipient.name,
          replyTo: 'maintenance@lincolnems.com',
        subject: `Daily Maintenance Alert - ${trucksWithMaintenance.length} Truck(s) Require Attention`,
        html: htmlContent,
        })
      );
      
      const results = await Promise.all(sendPromises);
      console.log(`Daily maintenance emails sent successfully via MailerSend to ${results.length} recipients:`, 
        results.map(r => r.messageId).join(', '));
      
      // Update lastMaintenanceAlertSent for all trucks that were included in the alert
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

// ===== Health check endpoint =====
exports.health = onRequest({ region: 'us-central1' }, (_req, res) => {
  res.status(200).send('ok');
});

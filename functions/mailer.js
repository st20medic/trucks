const nodemailer = require('nodemailer');

// Load environment variables from .env file
const {
  SMTP_HOST = 'smtp.office365.com',
  SMTP_PORT = '587',
  SMTP_USER = 'noreply@lincolnems.com',
  SMTP_PASS = '',
  SMTP_FROM_NAME = 'Lincoln EMS Fleet Maintenance',
} = process.env;

// Export a factory to build a transporter
function createTransporter() {
  const password = SMTP_PASS;
  
  const config = {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: false, // use STARTTLS
    auth: {
      user: SMTP_USER,
      pass: password,
    },
    // Add logging for debugging
    logger: true,
    debug: true,
  };
  
  console.log('Creating transporter with config:', {
    host: config.host,
    port: config.port,
    user: config.auth.user,
    passLength: password ? password.length : 0
  });
  
  return nodemailer.createTransport(config);
}

// Helper to format "From"
function fromAddress() {
  const user = SMTP_USER || 'noreply@lincolnems.com';
  return `"${SMTP_FROM_NAME}" <${user}>`;
}

module.exports = {
  createTransporter,
  fromAddress,
};


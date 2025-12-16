/**
 * MailerSend Email API Helper
 * Replaces nodemailer/SMTP with MailerSend API for better deliverability
 */

/**
 * Send email using MailerSend API
 * Supports both single recipient and multiple recipients in a single API call
 * @param {Object} params - Email parameters
 * @param {string} params.apiKey - MailerSend API key
 * @param {string} params.fromEmail - From email address
 * @param {string} [params.fromName] - From name (optional)
 * @param {string|Array<string>} params.toEmail - Recipient email address(es) - can be a string or array of strings
 * @param {string|Array<string>} [params.toName] - Recipient name(s) - optional, can be string or array matching toEmail
 * @param {string} [params.replyTo] - Reply-to email address (optional)
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain text version (optional)
 * @param {string} [params.html] - HTML version (required for our use case)
 * @returns {Promise<Object>} Response with messageId and status
 */
async function sendWithMailerSend(params) {
  const {
    apiKey,
    fromEmail,
    fromName = 'Lincoln EMS Truck Alerts',
    toEmail,
    toName,
    replyTo,
    subject,
    text,
    html,
  } = params;

  if (!apiKey) {
    throw new Error('MailerSend API key is required');
  }

  if (!fromEmail || !toEmail || !subject) {
    throw new Error('fromEmail, toEmail, and subject are required');
  }

  // Normalize toEmail to array format
  const toEmailsArray = Array.isArray(toEmail) ? toEmail : [toEmail];
  const toNamesArray = toName ? (Array.isArray(toName) ? toName : [toName]) : [];

  // Build recipients array for MailerSend API
  const toRecipients = toEmailsArray.map((email, index) => {
    const recipient = { email: email };
    if (toNamesArray[index]) {
      recipient.name = toNamesArray[index];
    }
    return recipient;
  });

  // Build MailerSend API payload
  const payload = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: toRecipients,
    subject: subject,
    ...(html && { html: html }),
    ...(text && { text: text }),
    ...(replyTo && {
      reply_to: {
        email: replyTo,
      },
    }),
  };

  console.log('Sending email via MailerSend:', {
    from: fromEmail,
    to: toEmailsArray,
    recipientCount: toEmailsArray.length,
    subject: subject,
    hasHtml: !!html,
    hasReplyTo: !!replyTo,
  });

  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // MailerSend returns message ID in X-Message-Id header
    const messageId = response.headers.get('x-message-id');
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `MailerSend API error ${response.status}`;
      try {
        const errorBody = JSON.parse(responseText);
        errorMessage = errorBody.message || errorMessage;
      } catch (_parseError) {
        // If JSON parsing fails, use the raw response text
        errorMessage = `${errorMessage}: ${responseText}`;
      }
      throw new Error(errorMessage);
    }

    console.log('MailerSend email sent successfully:', {
      messageId: messageId,
      status: response.status,
    });

    return {
      messageId: messageId,
      status: response.status,
      accepted: toEmailsArray,
      rejected: [],
    };
  } catch (error) {
    console.error('MailerSend API error:', error);
    throw error;
  }
}

module.exports = {
  sendWithMailerSend,
};


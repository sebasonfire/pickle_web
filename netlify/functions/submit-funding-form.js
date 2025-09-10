// Versión Final: 3.0
const { Resend } = require('resend');

exports.handler = async function(event) {
  console.log("--- Clean Re-deploy: Function invoked (v3.0) ---");

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const payload = JSON.parse(event.body);
    const { fields, files, signatureDataUrl } = payload;

    const fromAddress = 'Pickle Funding App <no-reply@picklefunding.com>';

    if (!fields) {
      console.error("Validation Error: Missing 'fields' from payload.");
      return { statusCode: 400, body: JSON.stringify({ message: "Bad Request: Missing form fields." }) };
    }

    let emailHtml = `<h1>New Funding Application</h1><h2>${fields['legal_company_name'] || ''}</h2><hr>`;
    for (const [key, value] of Object.entries(fields)) {
      if (value) {
        const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        emailHtml += `<p><strong>${fieldName}:</strong> ${value}</p>`;
      }
    }

    const attachments = [];
    if (files && files.length > 0) {
      files.forEach(file => {
        attachments.push({ filename: file.name, content: file.base64.split("base64,")[1] });
      });
    }
    if (signatureDataUrl) {
      attachments.push({ filename: 'signature.png', content: signatureDataUrl.split("base64,")[1] });
    }
    
    console.log(`Sending email with ${attachments.length} attachments to subs@picklefunding.com.`);

    const data = await resend.emails.send({
      from: fromAddress,
      to: ['subs@picklefunding.com'],
      subject: fields['legal_company_name'] ? `Web Application — ${fields['legal_company_name']}` : 'New Web Application',
      html: emailHtml,
      attachments: attachments,
    });

    if (data.error) {
      console.error("!!! RESEND API ERROR !!!", data.error);
      throw new Error(data.error.message);
    }

    console.log("--- Email sent successfully! ---", data.id);
    return { statusCode: 200, body: JSON.stringify({ id: data.id }) };

  } catch (error) {
    console.error("!!! CRITICAL FUNCTION ERROR !!!", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};
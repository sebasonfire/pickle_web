const { Resend } = require('resend');

exports.handler = async function(event) {
  // LOG INICIAL: Para confirmar que la función se está ejecutando
  console.log("--- Function send-funding-email invoked ---");

  if (event.httpMethod !== 'POST') {
    console.log("Method not allowed:", event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const payload = JSON.parse(event.body);
    const { to, subject, fields, files, signatureDataUrl } = payload;

    // --- ¡¡¡ACCIÓN REQUERIDA!!! ---
    // Cambia la siguiente línea por un email de un dominio que hayas
    // verificado en tu cuenta de Resend.com
    const fromAddress = 'Pickle Funding <no-reply@tu-dominio-verificado.com>';
    // Por ejemplo: 'Pickle Funding <applications@picklefunding.com>'

    console.log(`Preparing to send email from: ${fromAddress} to: ${to}`);

    if (!to || !subject || !fields) {
      console.error("Validation Error: Missing 'to', 'subject', or 'fields'");
      return { statusCode: 400, body: "Bad Request: Missing required email fields." };
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
    
    console.log(`Sending email with ${attachments.length} attachments.`);


const data = await resend.emails.send({
  from: fromAddress, // La dirección 'from' que configuraste arriba
  to: ['sdgraphicsonfire@gmail.com'], // ¡Aquí pones tu email para la prueba!
  subject: subject,
  html: emailHtml,
  attachments: attachments,
});


    console.log("--- Email sent successfully! ---", data);
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error("!!! CRITICAL ERROR !!!", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};  
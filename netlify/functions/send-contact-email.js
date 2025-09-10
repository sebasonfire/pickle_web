// Función para el formulario de Contacto
const { Resend } = require('resend');

exports.handler = async function(event) {
  console.log("--- Function send-contact-email invoked ---");

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Parseamos los datos que nos envía el formulario desde el JavaScript
    const fields = JSON.parse(event.body);

    // ¡IMPORTANTE! Usamos tu dominio verificado para el envío
    const fromAddress = 'Pickle Funding Contact <no-reply@picklefunding.com>';

    // El destino que solicitaste
    const toAddress = 'subs@picklefunding.com';

    console.log(`Preparing to send contact email to: ${toAddress}`);

    // Construimos un email bonito en HTML
    let emailHtml = `<h1>New Contact Form Submission</h1><hr>`;
    emailHtml += `<p><strong>Name:</strong> ${fields.name || 'Not provided'}</p>`;
    emailHtml += `<p><strong>Email:</strong> ${fields.email || 'Not provided'}</p>`;
    emailHtml += `<p><strong>Phone:</strong> ${fields.phone || 'Not provided'}</p>`;
    emailHtml += `<p><strong>Subject:</strong> ${fields.subject || 'Not provided'}</p>`;
    emailHtml += `<hr><p><strong>Message:</strong></p><p>${fields.message || 'Not provided'}</p>`;
    
    const data = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: `New Contact Message: ${fields.subject || 'No Subject'}`,
      html: emailHtml,
    });

    if (data.error) {
      console.error("!!! RESEND API ERROR !!!", data.error);
      throw new Error(data.error.message);
    }

    console.log("--- Contact email sent successfully! ---", data.id);
    return { statusCode: 200, body: JSON.stringify({ id: data.id }) };

  } catch (error) {
    console.error("!!! CRITICAL FUNCTION ERROR !!!", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};
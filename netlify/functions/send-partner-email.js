// Función para el formulario "Partner With Us"
const { Resend } = require('resend');

exports.handler = async function(event) {
  console.log("--- Function send-partner-email invoked ---");

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fields = JSON.parse(event.body);

    // Usamos tu dominio verificado para el envío
    const fromAddress = 'Pickle Funding Partners <no-reply@picklefunding.com>';

    // El destino que solicitaste
    const toAddress = 'partners@picklefunding.com';

    console.log(`Preparing to send partner email to: ${toAddress}`);

    // Construimos el email en HTML con todos los campos del formulario
    let emailHtml = `<h1>New "Partner With Us" Submission</h1>`;
    emailHtml += `<h2>Company: ${fields.company_name || 'N/A'}</h2><hr>`;
    emailHtml += `<p><strong>Full Name:</strong> ${fields.full_name || ''}</p>`;
    emailHtml += `<p><strong>Phone:</strong> ${fields.phone || ''}</p>`;
    emailHtml += `<p><strong>Email:</strong> ${fields.email || ''}</p>`;
    emailHtml += `<p><strong>Company Name:</strong> ${fields.company_name || ''}</p>`;
    emailHtml += `<p><strong>Direct Lender?:</strong> ${fields.direct_lender || ''}</p>`;
    emailHtml += `<p><strong>Number of Employees:</strong> ${fields.employees || ''}</p>`;
    emailHtml += `<p><strong>Avg. Units Funded Monthly:</strong> ${fields.avg_units || ''}</p>`;
    emailHtml += `<p><strong>Years in Business:</strong> ${fields.years_in_business || ''}</p>`;
    emailHtml += `<p><strong>Avg. Monthly Funding Volume:</strong> ${fields.avg_monthly_volume || ''}</p>`;
    emailHtml += `<p><strong>Top 3 Lenders:</strong> ${fields.top_lenders || ''}</p>`;
    emailHtml += `<hr><p><strong>Message:</strong></p><p>${fields.message || 'No message provided.'}</p>`;
    
    const data = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: `New Partner Submission: ${fields.company_name || fields.full_name}`,
      html: emailHtml,
    });

    if (data.error) {
      console.error("!!! RESEND API ERROR !!!", data.error);
      throw new Error(data.error.message);
    }

    console.log("--- Partner email sent successfully! ---", data.id);
    return { statusCode: 200, body: JSON.stringify({ id: data.id }) };

  } catch (error) {
    console.error("!!! CRITICAL FUNCTION ERROR !!!", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};
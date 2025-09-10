exports.handler = async function(event) {
  // Si vemos este log, ¡sabremos que el problema es Resend!
  console.log("--- ¡Hola Mundo! La función de prueba se está ejecutando. ---");

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log("Payload recibido:", payload.fields);

    // Simulamos un éxito sin enviar email
    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: "Prueba exitosa, no se envió email." }) 
    };

  } catch (error) {
    console.error("!!! ERROR EN LA FUNCIÓN DE PRUEBA !!!", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
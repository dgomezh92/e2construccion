const { app, output } = require('@azure/functions');

// Definimos que el resultado de esta función irá directo a la cola de Service Bus
const serviceBusOutput = output.serviceBusQueue({
    queueName: 'events-queue',
    connection: 'ServiceBusConnection' // Usa la misma identidad administrada configurada
});

app.http('recibirDatosWeb', {
    methods: ['POST'],
    authLevel: 'anonymous', // Permite que cualquiera llame a la URL sin token extra
    extraOutputs: [serviceBusOutput],
    handler: async (request, context) => {
        context.log('[START] Petición HTTP recibida para enviar al Service Bus');

        try {
            // Leer el cuerpo de la petición (JSON)
            const body = await request.json();
            
            // Ponemos el mensaje en la cola
            context.extraOutputs.set(serviceBusOutput, body);

            context.log('[SUCCESS] Mensaje encolado correctamente en Service Bus');
            
            return { 
                status: 202, 
                body: JSON.stringify({ 
                    mensaje: "Datos recibidos y encolados exitosamente",
                    datos: body
                }) 
            };
        } catch (error) {
            context.log.error("[ERROR] Procesando petición HTTP:", error);
            return { 
                status: 400, 
                body: JSON.stringify({ error: "El cuerpo de la petición debe ser un JSON válido." }) 
            };
        }
    }
});

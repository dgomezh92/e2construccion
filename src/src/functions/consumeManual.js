const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const { DefaultAzureCredential } = require('@azure/identity');

// Obtenemos la URL de tu Service Bus desde las variables de entorno
const fullyQualifiedNamespace = process.env.ServiceBusConnection__fullyQualifiedNamespace;

// Creamos un cliente manual de Service Bus usando tu Managed Identity
const sbClient = new ServiceBusClient(fullyQualifiedNamespace, new DefaultAzureCredential());

app.http('consumirManual', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('[START] Petición web para extraer un mensaje de la cola manualmente.');

        try {
            // Nos conectamos a la cola como receptores
            const receiver = sbClient.createReceiver('events-queue');
            
            // Intentamos recibir 1 mensaje, esperando un máximo de 5 segundos
            const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 5000 });

            if (messages.length === 0) {
                await receiver.close();
                return { 
                    status: 200, 
                    body: JSON.stringify({ 
                        mensaje: "No hay mensajes en la cola.",
                        nota_importante: "Recuerda que tienes la función automática 'processQueue' activa. Si envías un mensaje, la automática es tan rápida que se lo 'roba' en milisegundos antes de que alcances a correr esta función manual."
                    }) 
                };
            }

            const mensajeExtraido = messages[0];
            
            // Al completarlo, lo borramos de la cola de forma segura
            await receiver.completeMessage(mensajeExtraido);
            await receiver.close();

            context.log('[SUCCESS] Mensaje consumido manualmente de Service Bus.');

            return { 
                status: 200, 
                body: JSON.stringify({ 
                    mensaje: "Mensaje extraído y borrado de la cola exitosamente (Modo Manual)",
                    datos: mensajeExtraido.body
                }) 
            };
        } catch (error) {
            context.log.error("[ERROR] Fallo al extraer mensaje manual:", error);
            return { 
                status: 500, 
                body: JSON.stringify({ error: error.message }) 
            };
        }
    }
});

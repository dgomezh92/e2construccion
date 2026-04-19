const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Configuraciones desde variables de entorno
const fullyQualifiedNamespace = process.env.ServiceBusConnection__fullyQualifiedNamespace;
const cosmosEndpoint = process.env.CosmosDbConnection__accountEndpoint;
const credencial = new DefaultAzureCredential();

// Inicializamos clientes globalmente para reutilizar conexiones
const sbClient = new ServiceBusClient(fullyQualifiedNamespace, credencial);
const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credencial });
const database = cosmosClient.database('events-db');
const container = database.container('events');

app.http('consumirManual', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('[START] Petición web para extraer un mensaje de la cola manualmente.');

        try {
            const receiver = sbClient.createReceiver('events-queue');
            const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 5000 });

            if (messages.length === 0) {
                await receiver.close();
                return { 
                    status: 200, 
                    body: JSON.stringify({ mensaje: "No hay mensajes en la cola actualmente." }) 
                };
            }

            const mensajeExtraido = messages[0];
            const payload = mensajeExtraido.body;
            
            // 1. Borramos el mensaje de la cola
            await receiver.completeMessage(mensajeExtraido);
            await receiver.close();
            context.log('[SUCCESS] Mensaje consumido de Service Bus.');

            // 2. Lo guardamos en Cosmos DB para no perder la información
            const documentToInsert = {
                id: context.invocationId,
                payload: payload,
                processedAt: new Date().toISOString(),
                status: 'processed_manually',
                source: 'ServiceBusManualExtraction'
            };
            
            const { resource: createdItem } = await container.items.create(documentToInsert);
            context.log(`[SUCCESS] Mensaje guardado en Cosmos DB exitosamente con id: ${createdItem.id}`);

            return { 
                status: 200, 
                body: JSON.stringify({ 
                    mensaje: "Mensaje extraído de la cola y guardado en Cosmos DB de forma manual.",
                    cosmos_id: createdItem.id,
                    datos: payload
                }) 
            };
        } catch (error) {
            context.log.error("[ERROR] Fallo en el flujo manual:", error);
            return { 
                status: 500, 
                body: JSON.stringify({ error: error.message }) 
            };
        }
    }
});

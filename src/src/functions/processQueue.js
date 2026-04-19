const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Inicializar cliente Cosmos DB con Managed Identity
const endpoint = process.env.CosmosDbConnection__accountEndpoint;
const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential()
});

app.serviceBusQueue('processQueueMessage', {
    connection: 'ServiceBusConnection',
    queueName: 'events-queue',
    handler: async (message, context) => {
        context.log('Mensaje recibido de Service Bus:', message);

        try {
            const database = client.database('events-db');
            const container = database.container('events');
            
            // Insertar el mensaje procesado en Cosmos DB
            const { resource: createdItem } = await container.items.create({
                id: context.invocationId, // id aleatorio o basado en el invocationId
                message: message,
                processedAt: new Date().toISOString()
            });

            context.log(`Mensaje guardado en Cosmos DB exitosamente con id: ${createdItem.id}`);
        } catch (error) {
            context.log.error('Error al guardar en Cosmos DB:', error.message);
            // Si el handler tira error, Service Bus reintentará el mensaje 
            // basado en el max_delivery_count (configurado a 3)
            throw error;
        }
    }
});

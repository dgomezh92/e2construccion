const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Inicializar cliente Cosmos DB con Managed Identity
const endpoint = process.env.CosmosDbConnection__accountEndpoint;

if (!endpoint) {
    console.error('FATAL ERROR: La variable de entorno CosmosDbConnection__accountEndpoint no está definida.');
}

const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential()
});

// BEST PRACTICE: Inicializar base de datos y contenedor fuera del handler
// Esto permite reutilizar la conexión en múltiples ejecuciones y ahorra memoria/tiempo.
const database = client.database('events-db');
const container = database.container('events');

/*
========================================================
CONSUMIDOR AUTOMÁTICO DESHABILITADO POR PETICIÓN DEL USUARIO
========================================================
Si en el futuro quieres que la lectura vuelva a ser automática
solo quita los comentarios de abajo.

app.serviceBusQueue('processQueueMessage', {
    connection: 'ServiceBusConnection',
    queueName: 'events-queue',
    handler: async (message, context) => {
        context.log(`[START] Iniciando procesamiento de mensaje. InvocationId: ${context.invocationId}`);
        
        try {
            // Enriquecer el documento con más metadatos útiles
            const documentToInsert = {
                id: context.invocationId,
                payload: message,
                processedAt: new Date().toISOString(),
                status: 'processed',
                source: 'ServiceBusQueue'
            };
            
            // Insertar el mensaje procesado en Cosmos DB
            const { resource: createdItem } = await container.items.create(documentToInsert);

            context.log(`[SUCCESS] Mensaje guardado en Cosmos DB exitosamente con id: ${createdItem.id}`);
        } catch (error) {
            context.log.error(`[ERROR] Fallo al guardar en Cosmos DB:`, error.message);
            // Si el handler lanza un error, Service Bus no marcará el mensaje como completado
            // y lo reintentará según la configuración de max_delivery_count (ej: 3 veces)
            throw error;
        }
    }
});
*/

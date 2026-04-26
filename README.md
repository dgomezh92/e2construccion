# Arquitectura Serverless y Dirigida por Eventos en Azure

Este repositorio contiene la implementación de una arquitectura Serverless en Azure utilizando **Azure Functions**, **Service Bus**, y **Cosmos DB**. Todo el despliegue está automatizado bajo las mejores prácticas usando **Terraform** y **GitHub Actions**.

## Flujo de Datos Actual (Desacoplado)

Actualmente, el sistema está configurado para demostrar un flujo de escritura y lectura desacoplado usando colas de mensajería asíncrona:

1. **Escritura en la cola (`httpToBus.js`)**: Una función *HTTP Trigger* recibe un JSON mediante una petición POST (vía web/Postman) y lo encola de forma segura en Azure Service Bus.
2. **Cola de Retención (`events-queue`)**: El Service Bus retiene los mensajes de forma segura hasta que un consumidor decida procesarlos.
3. **Lectura Manual y Persistencia (`consumeManual.js`)**: Otra función *HTTP Trigger* que, al ser invocada, se conecta manualmente al Service Bus, extrae un (1) mensaje de la cola, lo borra para que no se duplique, y lo guarda permanentemente en la base de datos Serverless (Cosmos DB).
4. **Lectura Automática (`processQueue.js`)**: *(Actualmente comentada/deshabilitada por el usuario)*. Si se le quitan los comentarios, esta función reacciona instantáneamente a cualquier mensaje nuevo en la cola y lo procesa hacia Cosmos DB en milisegundos de forma ininterrumpida.

## Estructura del Proyecto

```text
.
├── infra/                  # Código de Infraestructura como Código (Terraform)
│   ├── main.tf             # Recursos: Resource Group, Function App, Service Bus, Cosmos DB, etc.
│   ├── variables.tf        # Variables de configuración
│   └── outputs.tf          # Nombres y endpoints generados
├── .github/workflows/      # Pipelines CI/CD profesional (Flujos separados)
│   ├── deploy.yml          # Pipeline para Infraestructura (Solo corre al tocar /infra)
│   └── deploy-app.yml      # Pipeline para la Aplicación (Solo corre al tocar /src)
└── src/                    # Código de las Azure Functions (Node.js v4)
    ├── package.json        # Dependencias (@azure/service-bus, @azure/cosmos, etc.)
    └── src/functions/
        ├── httpToBus.js      # Función HTTP -> Service Bus
        ├── consumeManual.js  # Función HTTP -> Extrae de Service Bus -> Cosmos DB
        └── processQueue.js   # Función Service Bus Trigger (Automática - Deshabilitada)
```

## Solución de Nombres Globales (Terraform)
Para evitar errores de "Nombre ya en uso" (muy comunes en Storage Accounts y Cosmos DB), la infraestructura implementa un recurso `random_string` en `main.tf`. Esto asegura que cada despliegue genere un sufijo único (ej. `e6dg-ocru`), garantizando que la infraestructura se despliegue y escale sin colisiones a nivel global.

## Seguridad y Acceso (Managed Identities y RBAC)
La arquitectura está diseñada con los más altos estándares de seguridad en la nube, eliminando por completo el uso de *Connection Strings* visibles en el código:
- La Azure Function tiene habilitada una **System Assigned Managed Identity**.
- Los clientes de base de datos (`CosmosClient` y `ServiceBusClient`) utilizan `DefaultAzureCredential()` del SDK `@azure/identity` para conectarse usando permisos silenciosos de Azure Entra ID.
- **Asignaciones de Terraform**: 
  - `Azure Service Bus Data Receiver` (Para leer de la cola de forma automática).
  - `Cosmos DB Built-in Data Contributor` (Para escribir en la base de datos).
- **Asignación Manual (Portal/CLI)**: El rol `Propietario de los datos de Azure Service Bus` (Owner/Sender) se asignó manualmente desde el portal de Azure a la Function App para permitirle a la función HTTP escribir nuevos mensajes en la cola.

## Cómo Probar el Ciclo Completo (Testing)

1. **Enviar un dato:** Obtén la URL de la función `recibirDatosWeb` en el portal y hazle una petición HTTP `POST` enviando cualquier JSON en el cuerpo. Recibirás un `202 Accepted`.
2. **Verificar la retención:** Ve al portal de Azure, entra a tu Service Bus -> Colas -> `events-queue`. Verás en las gráficas que hay mensajes "Activos" esperando en la cola.
3. **Consumir y Guardar:** Obtén la URL de la función `consumirManual` y ábrela en tu navegador o mediante un GET en Postman. La respuesta te mostrará el mensaje que extrajo y te confirmará que fue guardado con éxito. Si vas de nuevo al portal del Service Bus, verás que el contador de la cola bajó en 1.
4. **Verificar la Base de Datos:** Ve a tu Cosmos DB -> Data Explorer -> `events-db` -> `events` -> Items y verás tus datos persistidos permanentemente y listos para ser consumidos por cualquier otra aplicación.

# Serverless & Event-Driven Architecture en Azure

Este repositorio contiene la implementación de una arquitectura Serverless y dirigida por eventos en Azure, automatizada mediante Terraform y GitHub Actions.

## Estructura del Proyecto

```text
.
├── infra/                  # Código de Infraestructura como Código (Terraform)
│   ├── main.tf             # Definición de recursos (Resource Group, Function App, Service Bus, Cosmos DB, etc.)
│   ├── variables.tf        # Variables de entrada para Terraform
│   └── outputs.tf          # Variables de salida (endpoints, nombres de recursos)
├── .github/workflows/      # Pipelines CI/CD
│   ├── infra-deploy.yml    # Pipeline para desplegar Terraform automáticamente
│   └── code-deploy.yml     # Pipeline para desplegar la Azure Function
└── src/                    # Código fuente de la Azure Function (Node.js v4)
    ├── host.json           # Configuración global de la función
    ├── package.json        # Dependencias de Node.js
    └── src/functions/
        └── processQueue.js # Lógica de la función (Service Bus Trigger)
```

## Configuración de GitHub Actions (Secrets)

Para que los despliegues funcionen automáticamente, debes configurar los siguientes **Secrets** en tu repositorio de GitHub (en *Settings > Secrets and variables > Actions*):

1. **Autenticación con Azure (Service Principal)**:
   Debes crear un Service Principal en Azure con permisos de `Contributor` sobre tu suscripción:
   ```bash
   az ad sp create-for-rbac --name "github-actions-sp" --role contributor --scopes /subscriptions/<TU_SUBSCRIPTION_ID> --sdk-auth
   ```
   Copia el JSON resultante y guárdalo como un secret llamado `AZURE_CREDENTIALS`.
   
2. **Variables de Entorno para Terraform**:
   Del JSON anterior, extrae los siguientes valores y guárdalos como secretos individuales para Terraform:
   - `ARM_CLIENT_ID` (corresponde a `clientId`)
   - `ARM_CLIENT_SECRET` (corresponde a `clientSecret`)
   - `ARM_SUBSCRIPTION_ID` (corresponde a `subscriptionId`)
   - `ARM_TENANT_ID` (corresponde a `tenantId`)

## Seguridad y Acceso (Managed Identities)

La arquitectura está diseñada para funcionar **sin connection strings** en el código por razones de seguridad:
- La Azure Function tiene habilitada una **System Assigned Managed Identity**.
- En Terraform, se le ha asignado el rol `Azure Service Bus Data Receiver` para poder leer de la cola.
- Igualmente, se le asignó el rol `Cosmos DB Built-in Data Contributor` para poder insertar datos en la base de datos Serverless.

En el código (`processQueue.js`), utilizamos el SDK `@azure/identity` con `DefaultAzureCredential` para obtener el token en tiempo de ejecución.

## Manejo de Errores y Reintentos (Dead-Letter Queue)

La cola de Service Bus (`events-queue`) está configurada con la propiedad `max_delivery_count = 3`. 
Esto forma nuestra estrategia de reintentos:
1. Cuando la Azure Function recibe un mensaje, intenta procesarlo y guardarlo en Cosmos DB.
2. Si ocurre un error (por ejemplo, base de datos no disponible), la función lanza una excepción.
3. Azure Service Bus detecta que el mensaje no se completó exitosamente y lo reintenta **automáticamente**.
4. Si el mensaje falla repetidamente y alcanza el límite de `max_delivery_count` (3 veces), el Service Bus lo mueve automáticamente a la **Dead-Letter Queue (DLQ)**. 
5. Los mensajes en la DLQ pueden ser analizados posteriormente para identificar por qué fallaron, sin perder la información.

## Despliegue Secuencial
El pipeline de código (`code-deploy.yml`) utiliza el evento `workflow_run` para ejecutarse automáticamente solo cuando el pipeline de infraestructura (`infra-deploy.yml`) termina exitosamente. Esto asegura que la Function App y la cola siempre existan antes de intentar desplegar el código.

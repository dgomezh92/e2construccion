terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.prefix}-entrega2-dev"
  location = var.location
}

# Storage Account para la Function App
resource "azurerm_storage_account" "sa" {
  name                     = "st${var.prefix}funcdev"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# Application Insights
resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${var.prefix}-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "appinsights" {
  name                = "appi-${var.prefix}-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"
}

# Service Bus
resource "azurerm_servicebus_namespace" "sb" {
  name                = "sb-${var.prefix}-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Basic"
}

resource "azurerm_servicebus_queue" "sbq" {
  name         = "events-queue"
  namespace_id = azurerm_servicebus_namespace.sb.id

  # Manejo de errores: Max delivery count antes de ser descartado/Dead-Letter
  # Nota: Basic SKU soporta max_delivery_count para reintentos locales
  max_delivery_count = 3
}

# Cosmos DB - Modo Serverless
resource "azurerm_cosmosdb_account" "cosmos" {
  name                = "cosmos-${var.prefix}-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level       = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "db" {
  name                = "events-db"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
}

resource "azurerm_cosmosdb_sql_container" "container" {
  name                = "events"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  database_name       = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths = ["/id"]
}

# App Service Plan (Consumption)
resource "azurerm_service_plan" "plan" {
  name                = "asp-${var.prefix}-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "Y1" # Plan de Consumo
}

# Function App
resource "azurerm_linux_function_app" "function" {
  name                       = "func-${var.prefix}-dev"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  service_plan_id            = azurerm_service_plan.plan.id
  storage_account_name       = azurerm_storage_account.sa.name
  storage_account_access_key = azurerm_storage_account.sa.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
    application_insights_key               = azurerm_application_insights.appinsights.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "node"
    
    # Conexión usando Managed Identity a Service Bus
    "ServiceBusConnection__fullyQualifiedNamespace" = "${azurerm_servicebus_namespace.sb.name}.servicebus.windows.net"
    
    # Endpoint para Cosmos DB
    "CosmosDbConnection__accountEndpoint" = azurerm_cosmosdb_account.cosmos.endpoint
  }
}

# Role Assignments (RBAC) para Managed Identity

# Para Service Bus: Azure Service Bus Data Receiver
resource "azurerm_role_assignment" "sb_receiver" {
  scope                = azurerm_servicebus_namespace.sb.id
  role_definition_name = "Azure Service Bus Data Receiver"
  principal_id         = azurerm_linux_function_app.function.identity[0].principal_id
}

# Para Cosmos DB: Cosmos DB Built-in Data Contributor E2
resource "azurerm_cosmosdb_sql_role_assignment" "cosmos_contributor" {
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  role_definition_id  = "${azurerm_cosmosdb_account.cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = azurerm_linux_function_app.function.identity[0].principal_id
  scope               = azurerm_cosmosdb_account.cosmos.id
}

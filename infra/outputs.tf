output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "function_app_name" {
  value = azurerm_linux_function_app.function.name
}

output "servicebus_namespace" {
  value = azurerm_servicebus_namespace.sb.name
}

output "cosmosdb_endpoint" {
  value = azurerm_cosmosdb_account.cosmos.endpoint
}

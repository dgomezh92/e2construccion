variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "slsarch"
}

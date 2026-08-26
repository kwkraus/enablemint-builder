targetScope = 'subscription'

@description('The azd environment name used in resource names and tags.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Resource group name. Defaults to an azd environment-specific name.')
param resourceGroupName string = 'rg-${environmentName}'

@description('Microsoft Entra tenant ID for the application registration and Azure SQL administrator.')
param azureAdTenantId string

@description('Application (client) ID used by the frontend and API.')
param azureAdClientId string

@secure()
@description('Application registration client secret used by NextAuth and the Graph photo route.')
param azureAdClientSecret string

@secure()
@description('Secret used by NextAuth to sign session tokens.')
param nextAuthSecret string

@description('Optional Microsoft Entra domain hint used by the frontend sign-in experience.')
param azureAdDomainHint string = ''

@description('Display name or UPN of the Microsoft Entra user that administers Azure SQL.')
param sqlAdministratorLogin string

@description('Object ID of the Microsoft Entra user that administers Azure SQL.')
param sqlAdministratorObjectId string

@description('SKU for the Linux App Service plan.')
param appServicePlanSkuName string = 'B1'

@description('SKU for the development Azure SQL database.')
param sqlDatabaseSkuName string = 'Basic'

type ResourceNames = {
  appInsights: string
  appServicePlan: string
  apiApp: string
  frontendApp: string
  logAnalytics: string
  sqlDatabase: string
  sqlServer: string
  virtualNetwork: string
  sqlPrivateEndpoint: string
}

var suffix = toLower(uniqueString(subscription().id, resourceGroupName, environmentName))
var names ResourceNames = {
  appInsights: 'appi-enb-${suffix}'
  appServicePlan: 'plan-enb-${suffix}'
  apiApp: 'api-enb-${suffix}'
  frontendApp: 'web-enb-${suffix}'
  logAnalytics: 'log-enb-${suffix}'
  sqlDatabase: 'enablemint'
  sqlServer: take('sqlenb${suffix}', 63)
  virtualNetwork: 'vnet-enb-${suffix}'
  sqlPrivateEndpoint: 'pep-sql-enb-${suffix}'
}
var tags = {
  'azd-env-name': environmentName
  application: 'enablemint-builder'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources './resources.bicep' = {
  scope: resourceGroup
  params: {
    appServicePlanSkuName: appServicePlanSkuName
    azureAdClientId: azureAdClientId
    azureAdClientSecret: azureAdClientSecret
    azureAdDomainHint: azureAdDomainHint
    azureAdTenantId: azureAdTenantId
    location: location
    names: names
    nextAuthSecret: nextAuthSecret
    sqlAdministratorLogin: sqlAdministratorLogin
    sqlAdministratorObjectId: sqlAdministratorObjectId
    sqlDatabaseSkuName: sqlDatabaseSkuName
    tags: tags
  }
}

output API_APP_NAME string = resources.outputs.apiAppName
output API_ENDPOINT string = resources.outputs.apiEndpoint
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.applicationInsightsConnectionString
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_SQL_DATABASE_NAME string = resources.outputs.sqlDatabaseName
output AZURE_SQL_SERVER_NAME string = resources.outputs.sqlServerName
output AZURE_VNET_NAME string = resources.outputs.virtualNetworkName
output BACKEND_API_BASE_URL string = resources.outputs.apiEndpoint
output FRONTEND_APP_NAME string = resources.outputs.frontendAppName
output FRONTEND_ENDPOINT string = resources.outputs.frontendEndpoint
output NEXT_PUBLIC_BACKEND_API_BASE_URL string = resources.outputs.apiEndpoint

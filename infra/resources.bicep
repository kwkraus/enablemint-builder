param location string
param appServicePlanSkuName string
param sqlDatabaseSkuName string
param azureAdTenantId string
param azureAdClientId string
@secure()
param azureAdClientSecret string
@secure()
param nextAuthSecret string
param azureAdDomainHint string
param sqlAdministratorLogin string
param sqlAdministratorObjectId string

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

param names ResourceNames
param tags object

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.16.1' = {
  params: {
    location: location
    name: names.logAnalytics
    dataRetention: 30
    tags: tags
  }
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2025-07-01' existing = {
  name: names.logAnalytics
  dependsOn: [logAnalytics]
}

module applicationInsights 'br/public:avm/res/insights/component:0.8.0' = {
  params: {
    location: location
    name: names.appInsights
    tags: tags
    workspaceResourceId: logAnalyticsWorkspace.id
  }
}

resource appInsightsResource 'Microsoft.Insights/components@2020-02-02' existing = {
  name: names.appInsights
  dependsOn: [applicationInsights]
}

module appServicePlan 'br/public:avm/res/web/serverfarm:0.7.0' = {
  params: {
    kind: 'linux'
    location: location
    name: names.appServicePlan
    reserved: true
    skuCapacity: 1
    skuName: appServicePlanSkuName
    tags: tags
    zoneRedundant: false
  }
}

resource appServicePlanResource 'Microsoft.Web/serverfarms@2025-03-01' existing = {
  name: names.appServicePlan
  dependsOn: [appServicePlan]
}

// This subscription enforces public network access = Disabled on Azure SQL logical servers
// (confirmed: explicit publicNetworkAccess='Enabled' is silently reverted by the platform).
// SQL is reachable only through a private endpoint; the API App Service reaches it via
// regional VNet integration on the same virtual network.
module virtualNetwork 'br/public:avm/res/network/virtual-network:0.10.2' = {
  params: {
    name: names.virtualNetwork
    location: location
    addressPrefixes: ['10.20.0.0/23']
    subnets: [
      {
        name: 'snet-appservice'
        addressPrefix: '10.20.0.0/24'
        delegation: 'Microsoft.Web/serverFarms'
      }
      {
        name: 'snet-privateendpoints'
        addressPrefix: '10.20.1.0/24'
        privateEndpointNetworkPolicies: 'Disabled'
      }
    ]
    tags: tags
  }
}

resource virtualNetworkResource 'Microsoft.Network/virtualNetworks@2024-05-01' existing = {
  name: names.virtualNetwork
  dependsOn: [virtualNetwork]
}

var sqlPrivateDnsZoneName = 'privatelink${environment().suffixes.sqlServerHostname}'

module sqlPrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    name: sqlPrivateDnsZoneName
    virtualNetworkLinks: [
      {
        virtualNetworkResourceId: virtualNetworkResource.id
        registrationEnabled: false
      }
    ]
    tags: tags
  }
}

module sqlServer 'br/public:avm/res/sql/server:0.22.0' = {
  params: {
    administrators: {
      azureADOnlyAuthentication: true
      login: sqlAdministratorLogin
      principalType: 'User'
      sid: sqlAdministratorObjectId
      tenantId: azureAdTenantId
    }
    databases: [
      {
        availabilityZone: -1
        maxSizeBytes: sqlDatabaseSkuName == 'Basic' ? 2147483648 : 34359738368
        name: names.sqlDatabase
        sku: {
          name: sqlDatabaseSkuName
          tier: sqlDatabaseSkuName == 'Basic' ? 'Basic' : 'Standard'
        }
        zoneRedundant: false
      }
    ]
    firewallRules: []
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: names.sqlServer
    publicNetworkAccess: 'Disabled'
    tags: tags
  }
}

resource sqlServerResource 'Microsoft.Sql/servers@2025-01-01' existing = {
  name: names.sqlServer
  dependsOn: [sqlServer]
}

module sqlPrivateEndpoint 'br/public:avm/res/network/private-endpoint:0.12.1' = {
  params: {
    name: names.sqlPrivateEndpoint
    location: location
    subnetResourceId: '${virtualNetworkResource.id}/subnets/snet-privateendpoints'
    privateLinkServiceConnections: [
      {
        name: 'sqlServer'
        properties: {
          privateLinkServiceId: sqlServerResource.id
          groupIds: ['sqlServer']
        }
      }
    ]
    privateDnsZoneGroup: {
      privateDnsZoneGroupConfigs: [
        {
          name: 'sqlServer'
          privateDnsZoneResourceId: sqlPrivateDnsZone.outputs.resourceId
        }
      ]
    }
    tags: tags
  }
}

module frontendApp 'br/public:avm/res/web/site:0.24.0' = {
  params: {
    configs: [
      {
        name: 'appsettings'
        properties: {
          APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsResource.properties.ConnectionString
          AZURE_AD_CLIENT_ID: azureAdClientId
          AZURE_AD_CLIENT_SECRET: azureAdClientSecret
          AZURE_AD_DOMAIN_HINT: azureAdDomainHint
          AZURE_AD_TENANT_ID: azureAdTenantId
          BACKEND_API_BASE_URL: 'https://${names.apiApp}.azurewebsites.net'
          NEXTAUTH_SECRET: nextAuthSecret
          NEXTAUTH_URL: 'https://${names.frontendApp}.azurewebsites.net'
          NEXT_PUBLIC_BACKEND_API_BASE_URL: 'https://${names.apiApp}.azurewebsites.net'
          SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
          WEBSITE_NODE_DEFAULT_VERSION: '~20'
        }
      }
    ]
    httpsOnly: true
    kind: 'app,linux'
    location: location
    name: names.frontendApp
    serverFarmResourceId: appServicePlanResource.id
    siteConfig: {
      alwaysOn: false
      linuxFxVersion: 'NODE|20-lts'
    }
    tags: union(tags, { 'azd-service-name': 'frontend' })
  }
}

module apiApp 'br/public:avm/res/web/site:0.24.0' = {
  params: {
    configs: [
      {
        name: 'appsettings'
        properties: {
          APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsResource.properties.ConnectionString
          AzureAd__Audience: 'api://${azureAdClientId}'
          AzureAd__ClientId: azureAdClientId
          AzureAd__Instance: environment().authentication.loginEndpoint
          AzureAd__TenantId: azureAdTenantId
          Cors__AllowedOrigins__0: 'https://${names.frontendApp}.azurewebsites.net'
          ConnectionStrings__DefaultConnection: 'Server=tcp:${names.sqlServer}.${environment().suffixes.sqlServerHostname},1433;Initial Catalog=${names.sqlDatabase};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;'
        }
      }
    ]
    httpsOnly: true
    kind: 'app,linux'
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: names.apiApp
    serverFarmResourceId: appServicePlanResource.id
    siteConfig: {
      alwaysOn: false
      healthCheckPath: '/health'
      linuxFxVersion: 'DOTNETCORE|10.0'
      vnetRouteAllEnabled: true
    }
    virtualNetworkSubnetResourceId: '${virtualNetworkResource.id}/subnets/snet-appservice'
    tags: union(tags, { 'azd-service-name': 'api' })
  }
  dependsOn: [
    sqlPrivateEndpoint
  ]
}

resource frontendAppResource 'Microsoft.Web/sites@2025-03-01' existing = {
  name: names.frontendApp
  dependsOn: [frontendApp]
}

resource apiAppResource 'Microsoft.Web/sites@2025-03-01' existing = {
  name: names.apiApp
  dependsOn: [apiApp]
}

output apiAppName string = apiAppResource.name
output apiEndpoint string = 'https://${apiAppResource.properties.defaultHostName}'
output applicationInsightsConnectionString string = appInsightsResource.properties.ConnectionString
output frontendAppName string = frontendAppResource.name
output frontendEndpoint string = 'https://${frontendAppResource.properties.defaultHostName}'
output sqlDatabaseName string = names.sqlDatabase
output sqlServerName string = sqlServerResource.name

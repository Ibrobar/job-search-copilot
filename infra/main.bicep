targetScope = 'subscription'

@description('Environment name, e.g. dev, staging, prod. Used in resource names.')
param environmentName string

param location string = 'eastus2'

@description('Object id of a user or group that gets data-plane access (local development).')
param developerPrincipalId string = ''

var tags = { app: 'job-search-copilot', env: environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-jsc-${environmentName}'
  location: location
  tags: tags
}

module openai 'modules/openai.bicep' = {
  scope: rg
  name: 'openai'
  params: {
    name: 'oai-jsc-${environmentName}-${uniqueString(subscription().id, environmentName)}'
    location: location
    tags: tags
    developerPrincipalId: developerPrincipalId
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_OPENAI_ENDPOINT string = openai.outputs.endpoint
output AZURE_OPENAI_CHAT_DEPLOYMENT string = openai.outputs.chatDeployment
output AZURE_OPENAI_EMBEDDING_DEPLOYMENT string = openai.outputs.embeddingDeployment

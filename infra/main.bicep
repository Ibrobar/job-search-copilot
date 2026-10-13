targetScope = 'subscription'

@description('Environment name, e.g. dev, staging, prod. Used in resource names.')
param environmentName string

param location string = 'eastus2'

@description('Object id of a user or group that gets data-plane access (local development).')
param developerPrincipalId string = ''

@description('OIDC subject prefix for this repo. GitHub uses immutable ids (owner@id/repo@id), so a renamed or transferred repo cannot inherit this trust. Get it from: gh api repos/OWNER/REPO/actions/oidc/customization/sub')
param githubSubjectPrefix string = 'repo:Ibrobar@143564524/job-search-copilot@1408185261'

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

module ciIdentity 'modules/ci-identity.bicep' = {
  scope: rg
  name: 'ci-identity'
  params: {
    name: 'id-jsc-${environmentName}-github'
    location: location
    tags: tags
    githubSubjectPrefix: githubSubjectPrefix
    openAiAccountName: openai.outputs.name
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_OPENAI_ENDPOINT string = openai.outputs.endpoint
output AZURE_OPENAI_CHAT_DEPLOYMENT string = openai.outputs.chatDeployment
output AZURE_OPENAI_EMBEDDING_DEPLOYMENT string = openai.outputs.embeddingDeployment
output AZURE_OPENAI_JUDGE_DEPLOYMENT string = openai.outputs.judgeDeployment
output AZURE_CI_CLIENT_ID string = ciIdentity.outputs.clientId

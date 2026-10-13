param name string
param location string
param tags object
param developerPrincipalId string

@description('Thousands of tokens per minute per deployment. A rate limit, not a cost: billing is per token.')
param chatCapacity int = 200
param embeddingCapacity int = 50

@description('Judge model for evals only (faithfulness checks, second-opinion scores). Not used by the app.')
param judgeCapacity int = 100

resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: name
    // Keys are disabled: callers authenticate with Entra ID (managed identity in Azure, az login locally).
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource chat 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: 'gpt-5-mini'
  sku: { name: 'GlobalStandard', capacity: chatCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5-mini', version: '2025-08-07' }
    // Pinned: an automatic model upgrade would silently change eval results.
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

resource embedding 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: 'text-embedding-3-small'
  sku: { name: 'GlobalStandard', capacity: embeddingCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'text-embedding-3-small', version: '1' }
    // Pinned: an automatic model upgrade would silently change eval results.
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [chat] // deployments on one account must be created one at a time
}

resource judge 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: 'gpt-5.4'
  sku: { name: 'GlobalStandard', capacity: judgeCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5.4', version: '2026-03-05' }
    // Pinned: an automatic model upgrade would silently change eval results.
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [embedding]
}

// Cognitive Services OpenAI User: call models, no management rights.
var openAiUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource developerAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(developerPrincipalId)) {
  scope: account
  name: guid(account.id, developerPrincipalId, openAiUserRole)
  properties: {
    roleDefinitionId: openAiUserRole
    principalId: developerPrincipalId
    principalType: 'User'
  }
}

output name string = account.name
output endpoint string = account.properties.endpoint
output chatDeployment string = chat.name
output embeddingDeployment string = embedding.name
output judgeDeployment string = judge.name

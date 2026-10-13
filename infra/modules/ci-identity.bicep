// Identity GitHub Actions signs in as, via OIDC. No client secret exists anywhere:
// Azure trusts tokens GitHub issues for this repo, scoped by the subjects below.
param name string
param location string
param tags object
@description('GitHub repo as owner/name.')
param githubRepo string
param openAiAccountName string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: name
  location: location
  tags: tags
}

// PR runs (same-repo branches only: GitHub never issues OIDC tokens to fork PRs) and pushes to main.
var subjects = {
  'github-pr': 'repo:${githubRepo}:pull_request'
  'github-main': 'repo:${githubRepo}:ref:refs/heads/main'
}

@batchSize(1) // federated credentials on one identity must be written one at a time
resource federated 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = [
  for s in items(subjects): {
    parent: identity
    name: s.key
    properties: {
      issuer: 'https://token.actions.githubusercontent.com'
      subject: s.value
      audiences: ['api://AzureADTokenExchange']
    }
  }
]

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: openAiAccountName
}

// CI can call models (evals) and nothing else.
var openAiUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource ciOpenAiAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openAi
  name: guid(openAi.id, identity.id, openAiUserRole)
  properties: {
    roleDefinitionId: openAiUserRole
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output clientId string = identity.properties.clientId

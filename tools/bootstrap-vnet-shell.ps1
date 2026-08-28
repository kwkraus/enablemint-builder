<#
.SYNOPSIS
Creates a disposable, interactive Azure Container Instance inside the deployed VNet for one-time
manual bootstrap tasks that require network line-of-sight to the private Azure SQL endpoint.

.DESCRIPTION
Use this once per environment to run tools/grant-migration-identity-access.ps1 (and, if needed,
tools/grant-api-sql-database-access.ps1) without standing up a Bastion host or jump box. It creates
a short-lived container in the existing snet-container subnet, attaches an interactive shell so you
can authenticate as yourself (az login --use-device-code) and run sqlcmd, then deletes the container
when you're done.

This script does not touch Azure SQL's public network access setting. It runs entirely inside the
VNet using the container subnet that already exists for the EF Core migration job.

.EXAMPLE
.\tools\bootstrap-vnet-shell.ps1 -ResourceGroup $env:AZURE_RESOURCE_GROUP -VnetName $env:AZURE_VNET_NAME
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ResourceGroup,

    [Parameter(Mandatory)]
    [string]$VnetName,

    [Parameter()]
    [string]$SubnetName = 'snet-container',

    [Parameter()]
    [string]$ImageName = 'mcr.microsoft.com/azure-cli:latest',

    [Parameter()]
    [string]$ContainerGroupName
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ContainerGroupName)) {
    $ContainerGroupName = "aci-bootstrap-shell-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
}

if (-not (Get-Command 'az' -ErrorAction SilentlyContinue)) {
    throw "Required command 'az' was not found. Install Azure CLI and try again."
}

Write-Host "Creating disposable shell container '$ContainerGroupName' in subnet '$SubnetName'..." -ForegroundColor Cyan

az container create `
    --resource-group $ResourceGroup `
    --name $ContainerGroupName `
    --image $ImageName `
    --vnet $VnetName `
    --subnet $SubnetName `
    --command-line "sleep 3600" `
    --restart-policy Never `
    --output none

if ($LASTEXITCODE -ne 0) {
    throw "Failed to create disposable shell container '$ContainerGroupName'."
}

try {
    Write-Host "Attaching interactive shell. Inside the container, run:" -ForegroundColor Yellow
    Write-Host "  az login --use-device-code" -ForegroundColor Yellow
    Write-Host "  curl -sSL -O https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb && dpkg -i packages-microsoft-prod.deb && apt-get update && ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev" -ForegroundColor Yellow
    Write-Host "Then run the grant scripts' sqlcmd logic directly, or copy files in with 'az container exec'." -ForegroundColor Yellow

    az container exec --resource-group $ResourceGroup --name $ContainerGroupName --exec-command "/bin/bash"
}
finally {
    Write-Host "Cleaning up disposable shell container '$ContainerGroupName'..." -ForegroundColor Cyan
    az container delete --resource-group $ResourceGroup --name $ContainerGroupName --yes --output none
    Write-Host "Cleanup complete." -ForegroundColor Green
}

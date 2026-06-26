# Ensure aws/sam are on PATH (common after winget install without restarting the terminal).
function Initialize-DeployTools {
    param(
        [switch]$RequireSam
    )

    $pathsToPrepend = @()

    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        $awsDir = "C:\Program Files\Amazon\AWSCLIV2"
        if (Test-Path "$awsDir\aws.exe") {
            $pathsToPrepend += $awsDir
        }
    }

    if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
        $samCandidates = @(
            "$env:ProgramFiles\Amazon\AWSSAMCLI\bin",
            "${env:ProgramFiles(x86)}\Amazon\AWSSAMCLI\bin",
            "$env:LOCALAPPDATA\Programs\Amazon\AWSSAMCLI\bin"
        )
        foreach ($dir in $samCandidates) {
            if (Test-Path "$dir\sam.cmd") {
                $pathsToPrepend += $dir
                break
            }
        }
    }

    if ($pathsToPrepend.Count -gt 0) {
        $env:Path = (($pathsToPrepend + $env:Path) -join ";")
    }

    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        Write-Error "AWS CLI not found. Install: winget install Amazon.AWSCLI — then restart the terminal."
    }

    if ($RequireSam -and -not (Get-Command sam -ErrorAction SilentlyContinue)) {
        Write-Error "AWS SAM CLI not found. Install: winget install Amazon.SAM-CLI — then restart the terminal."
    }
}

---
demand: SALEXT-0002
project: Salesforce Extensions
repo: Salesforce Compare
status: done
started: 2026-09-01
notion: "https://app.notion.com/p/3cea6e0e45cf81ea8bcefeb479e64b84"
jira: ""
work_days:
  - date: 2026-09-01
    minutes: 120
    summary: Publicação VS Marketplace v0.1.1, ícone, scripts .env/publish, guia e sync Git/Notion
    source: etapa
---

# SALEXT-0002 - Resumo da Demanda

## Informações Gerais
- **Demanda:** SALEXT-0002
- **Data de Início:** 01/09/2026
- **Status:** Concluída
- **Última Atualização:** 01/09/2026
- **Projeto Notion:** [Salesforce Extensions](https://app.notion.com/p/3cea6e0e45cf81ad80a3cdf9430dacbe)
- **Card Notion:** [SALEXT-0002](https://app.notion.com/p/3cea6e0e45cf81ea8bcefeb479e64b84)
- **GitHub:** https://github.com/lucasefr/salesforce-compare
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare
- **Guia de publicação:** [PUBLISH_MARKETPLACE.md](../PUBLISH_MARKETPLACE.md)

## Objetivo
Publicar a extensão **Salesforce Compare** (`LeftConsult.salesforce-compare`) no [Visual Studio Marketplace](https://marketplace.visualstudio.com/), com publisher `LeftConsult`, versão inicial `0.1.1`, e automatizar republicações futuras via `.env` + script PowerShell.

## Arquivos Modificados
| Arquivo | Caminho Completo | Tipo de Alteração | Última Modificação |
|---------|-------------------|-------------------|--------------------|
| PUBLISH_MARKETPLACE.md | document/PUBLISH_MARKETPLACE.md | Novo | 01/09/2026 |
| SALEXT-0002_resume.md | document/SALEXT-0002/SALEXT-0002_resume.md | Novo | 01/09/2026 |
| package.json | package.json | Modificado | 01/09/2026 |
| README.md | README.md | Modificado | 01/09/2026 |
| .gitignore | .gitignore | Modificado | 01/09/2026 |
| .vscodeignore | .vscodeignore | Modificado | 01/09/2026 |
| .env.example | .env.example | Novo | 01/09/2026 |
| icon.png | images/icon.png | Novo | 01/09/2026 |
| publish-marketplace.ps1 | scripts/publish-marketplace.ps1 | Novo | 01/09/2026 |
| load-env.ps1 | scripts/load-env.ps1 | Novo | 01/09/2026 |
| check-env.ps1 | scripts/check-env.ps1 | Novo | 01/09/2026 |
| test-pat.ps1 | scripts/test-pat.ps1 | Novo | 01/09/2026 |
| test-marketplace-api.ps1 | scripts/test-marketplace-api.ps1 | Novo | 01/09/2026 |

## Etapas Realizadas

### Etapa 1 - Planejamento e guia de publicação
- **Data:** 01/09/2026
- **O que foi solicitado:** Passo a passo para publicar na loja VS Code; separar o que o agente faz vs. o que o usuário faz.
- **O que foi analisado:** `package.json`, README, CHANGELOG, LICENSE, `.vscodeignore`, scripts `vsce`.
- **O que foi realizado:** Guia em `document/PUBLISH_MARKETPLACE.md`; validação VSIX `0.1.1`.
- **Arquivos afetados:** `document/PUBLISH_MARKETPLACE.md`, `document/SALEXT-0002/SALEXT-0002_resume.md`

### Etapa 2 - Publisher confirmado
- **Data:** 01/09/2026
- **O que foi realizado:** Publisher **Left Consult** (`LeftConsult`) no Marketplace; `package.json` alinhado (`publisher: LeftConsult`).

### Etapa 3 - Ícone, PAT e automação de publish
- **Data:** 01/09/2026
- **O que foi realizado:** Ícone `images/icon.png` (128×128); README com link Marketplace; `.env` / `.env.example`; scripts `load-env.ps1`, `publish-marketplace.ps1`, `npm run publish:marketplace`; `.env` e scripts excluídos do VSIX via `.vscodeignore`.

### Etapa 4 - Publicação concluída
- **Data:** 01/09/2026
- **O que foi realizado:** `LeftConsult.salesforce-compare v0.1.1` publicada via `npm run publish:marketplace`.
- **URLs:** [Marketplace](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare) | [Hub](https://marketplace.visualstudio.com/manage/publishers/LeftConsult/extensions/salesforce-compare/hub)

### Etapa 5 - Git e Notion
- **Data:** 01/09/2026
- **O que foi solicitado:** Atualizar repositório `main`, card Notion e WorkLog.
- **O que foi realizado:** Commit/push dos artefatos de publicação; sync demand-hub (Tarefa + WorkLog).

## Modificações em Arquivos (registro cronológico)

- 01/09/2026 — Criado `document/PUBLISH_MARKETPLACE.md`.
- 01/09/2026 — Validado build VSIX `0.1.1`.
- 01/09/2026 — Publisher `LeftConsult` confirmado; `package.json` atualizado.
- 01/09/2026 — Ícone, README Marketplace, scripts `.env` e publish.
- 01/09/2026 — Publicada `LeftConsult.salesforce-compare v0.1.1`.
- 01/09/2026 — Push `main` + sync Notion SALEXT-0002.

## Observações

- Publisher: `LeftConsult` — ID na loja: `LeftConsult.salesforce-compare`.
- `.env` com `VSCE_PAT` está no `.gitignore` — nunca commitar.
- Republicar: `npm run publish:marketplace` (após bump de versão).

## Checklist de publicação

| # | Item | Status |
|---|------|--------|
| 0 | Nome demanda SALEXT-0002 | ✅ |
| 1 | Conta Azure DevOps | ✅ |
| 2 | Publisher `LeftConsult` | ✅ |
| 3 | PAT Marketplace Manage | ✅ |
| 4 | Ícone + metadados | ✅ |
| 5 | VSIX válido | ✅ 0.1.1 |
| 6 | `vsce publish` | ✅ v0.1.1 publicada |
| 7 | Conferir na loja | ✅ |
| 8 | Git main + Notion | ✅ |

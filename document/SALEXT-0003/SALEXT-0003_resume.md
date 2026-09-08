---
demand: SALEXT-0003
project: Salesforce Extensions
repo: Salesforce Compare
status: in_progress
started: 2026-09-07
notion: ""
jira: ""
work_days:
  - date: 2026-09-07
    minutes: 75
    summary: XML metadata eligibility + background compare queue; Equal/Different UI start
    source: etapa
  - date: 2026-09-08
    minutes: 40
    summary: Equal/Different toast+status bar; README/CHANGELOG/package docs for v0.1.2 release
    source: etapa
---

# SALEXT-0003 - Resumo da Demanda

## Informações Gerais
- **Demanda:** SALEXT-0003
- **Data de Início:** 07/09/2026
- **Status:** Em andamento (código validado; docs/release notes alinhados para v0.1.2)
- **Última Atualização:** 08/09/2026
- **Versão alvo:** `0.1.2`

## Objetivo
Atualizar a extensão Salesforce Compare para: (1) aceitar metadados `.xml`; (2) compares em background sem cancelar ao trocar de arquivo; (3) UI clara Equal/Different; (4) documentar a release.

## Arquivos Modificados
| Arquivo | Caminho Completo | Tipo de Alteração | Última Modificação |
|---------|-------------------|-------------------|--------------------|
| SalesforcePathMapper.ts | src/util/SalesforcePathMapper.ts | Modificado | 07/09/2026 |
| constants.ts | src/util/constants.ts | Modificado | 07/09/2026 |
| CompareService.ts | src/services/CompareService.ts | Modificado | 08/09/2026 |
| StatusBarController.ts | src/ui/StatusBarController.ts | Modificado | 08/09/2026 |
| showLastCheck.ts | src/commands/showLastCheck.ts | Modificado | 08/09/2026 |
| package.json | package.json | Modificado (v0.1.2 + description/keywords/command title) | 08/09/2026 |
| CHANGELOG.md | CHANGELOG.md | Modificado (release 0.1.2) | 08/09/2026 |
| README.md | README.md | Modificado (What's new + status table) | 08/09/2026 |

## Etapas Realizadas

### Etapa 1 - Análise da restrição de elegibilidade
- **Data:** 07/09/2026
- **O que foi realizado:** Causa raiz: filtro rejeitava quase todos os `*-meta.xml`.

### Etapa 2 - Correção de elegibilidade XML
- **Data:** 07/09/2026
- **O que foi realizado:** Aceita metadata standalone; ignora companions.

### Etapa 3 - Fila de compare em background
- **Data:** 07/09/2026
- **O que foi realizado:** Fila FIFO + `maxConcurrentCompares`; sem cancelamento ao trocar arquivo.

### Etapa 4 - Resultado Equal/Different no toast e status bar
- **Data:** 08/09/2026
- **O que foi realizado:** Labels Equal/Different; toast com severidade; status bar colorida; validado pelo usuário.

### Etapa 5 - Documentação da atualização v0.1.2
- **Data:** 08/09/2026
- **O que foi solicitado:** Atualizar README e o necessário para identificar a atualização.
- **O que foi realizado:**
  - README com **What's new in 0.1.2**, tabela de status, features e comando renomeado
  - CHANGELOG com seção datada `0.1.2 — 2026-09-08` (Added/Fixed)
  - `package.json`: description, keywords (`metadata`, `xml`, `apex`), comando **Show Compare Result**
- **Arquivos afetados:** `README.md`, `CHANGELOG.md`, `package.json`

## Modificações em Arquivos (registro cronológico)

- 07/09/2026 — elegibilidade XML + fila background
- 08/09/2026 — Equal/Different UI
- 08/09/2026 — README / CHANGELOG / package.json para identificar v0.1.2

## Observações
Código validado pelo usuário. Publicação no Marketplace (`npm run publish:marketplace`) ainda pendente, se desejada.

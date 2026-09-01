---
demand: SALEXT-0001
project: Salesforce Extensions
repo: Salesforce Compare
status: done
started: 2026-08-31
notion: "https://app.notion.com/p/3cea6e0e45cf81b0a969edf4dfaae478"
jira: ""
work_days:
  - date: 2026-08-31
    minutes: 180
    summary: Planejamento, scaffold TypeScript, CompareService, UI (flags/diff/status bar), VSIX 0.1.0
    source: etapa
  - date: 2026-09-01
    minutes: 120
    summary: Fix sync pós-deploy/retrieve (0.1.1), publicação GitHub lucasefr/salesforce-compare, documentação Hub
    source: etapa
---

# SALEXT-0001 - Resumo da Demanda

## Informações Gerais
- **Demanda:** SALEXT-0001
- **Data de Início:** 31/08/2026
- **Status:** Concluída
- **Última Atualização:** 01/09/2026
- **Projeto Notion:** [Salesforce Extensions](https://app.notion.com/p/3cea6e0e45cf81ad80a3cdf9430dacbe)
- **Card Notion:** [SALEXT-0001](https://app.notion.com/p/3cea6e0e45cf81b0a969edf4dfaae478)
- **GitHub:** https://github.com/lucasefr/salesforce-compare

## Objetivo
Criar uma extensão VS Code/Cursor que compara arquivos Salesforce locais com a versão na Org conectada (retrieve-only), sinalizando sync nas abas, oferecendo diff estilo Git e atualizando status após save, deploy e retrieve.

Documentação criada retroativamente em 01/09/2026.

## Arquivos Modificados
| Arquivo | Caminho Completo | Tipo de Alteração | Última Modificação |
|---------|-------------------|-------------------|--------------------|
| extension.ts | src/extension.ts | Novo | 01/09/2026 |
| CompareService.ts | src/services/CompareService.ts | Novo | 01/09/2026 |
| DeployWatcher.ts | src/services/DeployWatcher.ts | Novo | 01/09/2026 |
| FileStatusStore.ts | src/services/FileStatusStore.ts | Novo | 31/08/2026 |
| OrgResolver.ts | src/services/OrgResolver.ts | Novo | 31/08/2026 |
| SfCliAdapter.ts | src/infrastructure/SfCliAdapter.ts | Novo | 31/08/2026 |
| OrgSnapshotCache.ts | src/infrastructure/OrgSnapshotCache.ts | Novo | 31/08/2026 |
| ContentHashUtil.ts | src/infrastructure/ContentHashUtil.ts | Novo | 31/08/2026 |
| OrgContentProvider.ts | src/providers/OrgContentProvider.ts | Novo | 31/08/2026 |
| StatusDecorationProvider.ts | src/providers/StatusDecorationProvider.ts | Novo | 31/08/2026 |
| StatusBarController.ts | src/ui/StatusBarController.ts | Novo | 31/08/2026 |
| diffWithOrg.ts | src/commands/diffWithOrg.ts | Novo | 31/08/2026 |
| recheckFile.ts | src/commands/recheckFile.ts | Novo | 31/08/2026 |
| showLastCheck.ts | src/commands/showLastCheck.ts | Novo | 31/08/2026 |
| SalesforcePathMapper.ts | src/util/SalesforcePathMapper.ts | Novo | 31/08/2026 |
| constants.ts | src/util/constants.ts | Novo | 01/09/2026 |
| package.json | package.json | Novo | 01/09/2026 |
| README.md | README.md | Novo | 31/08/2026 |

## Etapas Realizadas

### Etapa 1 - Planejamento e arquitetura
- **Data:** 31/08/2026
- **O que foi solicitado:** Planejar extensão de compare local vs Org antes de desenvolver (linguagem, arquitetura, fluxos).
- **O que foi analisado:** Opções de integração (CLI / SF Pack / ambos) e detecção de deploy; workspace vazio (greenfield).
- **O que foi realizado:** Plano aprovado — TypeScript, `sf` + org default da Extension Pack, FileDecorationProvider, retrieve-only, deploy watcher.
- **Arquivos afetados:** plano (Cursor plans)

### Etapa 2 - Implementação da extensão (MVP 0.1.0)
- **Data:** 31/08/2026
- **O que foi solicitado:** Implementar o plano completo.
- **O que foi analisado:** APIs VS Code (decorations, diff, content provider), retrieve via `sf project retrieve start` em projeto temp.
- **O que foi realizado:** Scaffold + serviços + UI + comandos + VSIX; Node.js LTS instalado no ambiente.
- **Arquivos afetados:** todo o `src/`, `package.json`, `README.md`, `esbuild.js`

### Etapa 3 - Correção sync pós-deploy e pós-retrieve (0.1.1)
- **Data:** 01/09/2026
- **O que foi solicitado:** Status verde após deploy; status verde após retrieve da Org.
- **O que foi analisado:** Cache de snapshot ficava stale; detecção de deploy frágil.
- **O que foi realizado:** `syncLocalWithOrgSnapshot`, DeployWatcher ampliado (comandos SF, tasks, terminal, artifacts, mudanças externas), listeners em `extension.ts`.
- **Arquivos afetados:** `CompareService.ts`, `DeployWatcher.ts`, `extension.ts`, `constants.ts`

### Etapa 4 - Publicação no GitHub
- **Data:** 01/09/2026
- **O que foi solicitado:** Subir o repositório para o GitHub.
- **O que foi analisado:** Repo local sem git; `gh` instalado; auth via device flow.
- **O que foi realizado:** Commit inicial + repo público `lucasefr/salesforce-compare` + push `main`.
- **Arquivos afetados:** `.gitignore`, `scripts/publish-github.ps1`, remote origin

### Etapa 5 - Documentação Demand Tracker + Hub Notion
- **Data:** 01/09/2026
- **O que foi solicitado:** Projeto Notion "Salesforce Extensions", card SALEXT-0001, demand-tracker + demand-hub-sync.
- **O que foi analisado:** Estrutura `document/` inexistente; schemas Projetos/Tarefas/WorkLogs.
- **O que foi realizado:** Resume + compares `_dev` (arquivos novos); projeto e tarefa no Notion; WorkLogs.
- **Arquivos afetados:** `document/SALEXT-0001/**`

## Modificações em Arquivos (registro cronológico)

```
package.json - 08/31/2026 - 8:40 PM
extension.ts - 08/31/2026 - 8:50 PM
CompareService.ts - 08/31/2026 - 8:55 PM
DeployWatcher.ts - 08/31/2026 - 9:00 PM
CompareService.ts - 08/31/2026 - 9:15 PM
DeployWatcher.ts - 08/31/2026 - 9:15 PM
extension.ts - 08/31/2026 - 9:15 PM
constants.ts - 08/31/2026 - 9:15 PM
publish-github.ps1 - 09/01/2026 - 12:10 AM
SALEXT-0001_resume.md - 09/01/2026 - 12:20 AM
```

## Observações
- Extensão **nunca** executa deploy; apenas retrieve para comparação e sync de status.
- Versão atual empacotada: `salesforce-compare-0.1.1.vsix`.
- Renomear o chat do Cursor para `SALEXT-0001` (Rename / `composer.renameChat`).

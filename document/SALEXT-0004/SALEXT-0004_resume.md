---
demand: SALEXT-0004
project: Salesforce Extensions
repo: Salesforce Compare
status: in_progress
started: 2026-09-08
notion: "https://app.notion.com/p/3d8a6e0e45cf8138906cfaa18152fd01"
jira: ""
work_days:
  - date: 2026-09-08
    minutes: 90
    summary: Multi-Org Local↔Other Org; Connected Orgs sidebar; Login/Connect; v0.2.0
    source: etapa
  - date: 2026-09-10
    minutes: 60
    summary: Auth UX (progress/error); sidebar red + Reconnect Org; Notion card created
    source: etapa
  - date: 2026-09-11
    minutes: 255
    summary: Multi-Org polish; bump release version to 1.0.0 for Marketplace/Open VSX
    source: etapa
---

# SALEXT-0004 - Resumo da Demanda

## Informações Gerais
- **Demanda:** SALEXT-0004
- **Data de Início:** 08/09/2026
- **Status:** Em andamento
- **Última Atualização:** 11/09/2026
- **Branch:** `SALEXT-0004`
- **Versão:** `1.0.0`
- **Card Notion:** [SALEXT-0004](https://app.notion.com/p/3d8a6e0e45cf8138906cfaa18152fd01)
- **Projeto Notion:** [Salesforce Extensions](https://app.notion.com/p/3cea6e0e45cf81ad80a3cdf9430dacbe)

## Objetivo
Permitir comparar um arquivo local com Orgs adicionais (Local ↔ Outra Org), conectando várias Orgs no mesmo projeto. A primeira/resolvida é a **Original** (auto-check Equal/Different); as demais são só para comparativo via retrieve. Sidebar na Activity Bar para conectar/visualizar Orgs; comando de contexto Diff with Other Org; nunca deploy.

## Arquivos Modificados
| Arquivo | Caminho Completo | Tipo de Alteração | Última Modificação |
|---------|-------------------|-------------------|--------------------|
| package.json | package.json | Modificado (v1.0.0 release) | 11/09/2026 |
| package-lock.json | package-lock.json | Modificado (versão raiz 1.0.0) | 11/09/2026 |
| constants.ts | src/util/constants.ts | Modificado | 08/09/2026 |
| SfCliAdapter.ts | src/infrastructure/SfCliAdapter.ts | Modificado (listOrgs, login) | 08/09/2026 |
| OrgSnapshotCache.ts | src/infrastructure/OrgSnapshotCache.ts | Modificado (cache por Org) | 08/09/2026 |
| OrgContentProvider.ts | src/providers/OrgContentProvider.ts | Modificado (URI com org) | 08/09/2026 |
| CompareService.ts | src/services/CompareService.ts | Modificado (ensureOrgContentForOrg) | 08/09/2026 |
| extension.ts | src/extension.ts | Modificado (wiring sidebar/comandos) | 08/09/2026 |
| ConnectedOrgsStore.ts | src/services/ConnectedOrgsStore.ts | Criado | 08/09/2026 |
| OrgConnectionService.ts | src/services/OrgConnectionService.ts | Modificado (auto-list após Authorize) | 11/09/2026 |
| ConnectedOrgsTreeProvider.ts | src/ui/ConnectedOrgsTreeProvider.ts | Modificado (não ocultar por username) | 11/09/2026 |
| diffWithOtherOrg.ts | src/commands/diffWithOtherOrg.ts | Criado | 08/09/2026 |
| CHANGELOG.md | CHANGELOG.md | Modificado (entrada 1.0.0) | 11/09/2026 |
| README.md | README.md | Modificado (versão 1.0.0) | 11/09/2026 |

## Etapas Realizadas

### Etapa 1 - Setup do ambiente e branch
- **Data:** 08/09/2026
- **O que foi solicitado:** Clonar o projeto e criar branch `SALEXT-0004`
- **O que foi realizado:** Clone; branch criada; tracker inicializado
- **Arquivos afetados:** `document/SALEXT-0004/`

### Etapa 2 - Feature Multi-Org (Local ↔ Outra Org)
- **Data:** 08/09/2026
- **O que foi solicitado:** Conectar várias Orgs; sidebar com Original; Diff with Other Org no contexto; Login; persistência por workspace; retrieve-only
- **Decisões:** Diff = Local ↔ Outra Org (não Original↔Outra); badges continuam só vs Original
- **O que foi realizado:** Store/serviço de conexão; TreeView; listOrgs + login via terminal; cache/provider scoped por Org; comando `diffWithOtherOrg`; package.json v0.2.0; docs
- **Arquivos afetados:** ver tabela acima
- **Nota build:** Node/npm não estão no PATH desta máquina — `npm run compile` não pôde ser executado aqui; validar localmente com F5 / compile

### Etapa 3 - Org não aparecia na sidebar após Authorize
- **Data:** 11/09/2026
- **O que foi solicitado:** Após autorizar, a Org deve aparecer automaticamente em Connected Orgs
- **Causa raiz:** Após Authorize, `ensureOrgListedInSidebar` chamava `sf org list` **antes** de gravar no store. No ambiente do usuário esse comando demora ~70s (checagem de conexão) — a inclusão nunca acontecia a tempo / parecia falhar. Bundle `dist` também estava desatualizado em testes anteriores.
- **Correção:** Gravar no store **imediatamente** (antes de qualquer list); `listOrgs` com `--skip-connection-status` + parse de banner; incluir `sandboxes`/`devHubs`; focar a view Connected Orgs; não ocultar duplicatas na tree
- **Arquivos afetados:** `OrgConnectionService.ts`, `SfCliAdapter.ts`, `ConnectedOrgsTreeProvider.ts`, `dist/extension.js`

## Modificações em Arquivos (registro cronológico)

package.json - 08/09/2026 - 6:00 PM
constants.ts - 08/09/2026 - 6:00 PM
SfCliAdapter.ts - 08/09/2026 - 6:00 PM
OrgSnapshotCache.ts - 08/09/2026 - 6:05 PM
OrgContentProvider.ts - 08/09/2026 - 6:05 PM
CompareService.ts - 08/09/2026 - 6:05 PM
ConnectedOrgsStore.ts - 08/09/2026 - 6:05 PM
OrgConnectionService.ts - 08/09/2026 - 6:05 PM
ConnectedOrgsTreeProvider.ts - 08/09/2026 - 6:10 PM
diffWithOtherOrg.ts - 08/09/2026 - 6:10 PM
extension.ts - 08/09/2026 - 6:10 PM
CHANGELOG.md - 08/09/2026 - 6:15 PM
README.md - 08/09/2026 - 6:15 PM
package.json - 11/09/2026 - 4:28 PM
package-lock.json - 11/09/2026 - 4:28 PM
CHANGELOG.md - 11/09/2026 - 4:28 PM
README.md - 11/09/2026 - 4:28 PM

### Etapa 4 - Bump de versão para 1.0.0 (Marketplace / Open VSX)
- **Data:** 11/09/2026
- **O que foi solicitado:** Preparar o projeto para publicar a nova versão nos marketplaces do VS Code e Cursor com versão de subida **1.0.0**
- **O que foi realizado:** Atualizado `version` em `package.json` e `package-lock.json`; entrada `1.0.0` no `CHANGELOG.md`; README alinhado (versão atual, What’s new, nome do VSIX)
- **Arquivos afetados:** `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`

## Observações
- Repositório: https://github.com/lucasefr/salesforce-compare
- Chat: **SALEXT-0004** (renomear no Cursor: botão direito → Rename)
- Sem commit ainda (aguardando usuário)

### Etapa 3 - Clareza multi-Org (temp file + azul)
- **Data:** 08/09/2026
- **O que foi solicitado:** Deixar claro qual lado é de qual Org; criar arquivo temporário da outra Org; nome em azul no temp e no comparativo
- **O que foi realizado:** `ComparisonTempFileService` grava `File.__from__OrgAlias.ext` fora do projeto; abre o temp + diff com título `LOCAL ↔ COMPARISON ORG "alias"`; decoração azul `salesforceCompare.comparisonOrg`; título do Diff with Org também mostra ORIGINAL ORG
- **Arquivos afetados:** ComparisonTempFileService.ts, ComparisonFileDecorationProvider.ts, diffWithOtherOrg.ts, diffWithOrg.ts, OrgContentProvider.ts, extension.ts, package.json, CHANGELOG.md

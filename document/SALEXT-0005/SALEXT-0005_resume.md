---
demand: SALEXT-0005
project: Salesforce Extensions
repo: Salesforce Compare
status: in_progress
started: 2026-09-14
notion: ""
jira: ""
work_days:
  - date: 2026-09-14
    minutes: 15
    summary: Diff with Org — local à esquerda, Org Original à direita
    source: etapa
  - date: 2026-09-15
    minutes: 120
    summary: Diff UX (ordem + missing empty); docs/release bump 1.1.0
    source: etapa
---

# SALEXT-0005 - Resumo da Demanda

## Informações Gerais
- **Demanda:** SALEXT-0005
- **Data de Início:** 14/09/2026
- **Status:** Em andamento
- **Última Atualização:** 15/09/2026
- **Branch:** `SALEXT-0005`
- **Versão:** `1.1.0`

## Objetivo
1) Diff with Org (Original): local à esquerda, Org à direita.
2) Diff with Other Org: se o arquivo não existir na Org de comparação, o lado da Org no diff lado a lado deve aparecer **vazio** (não reutilizar o seed local / buffer antigo).

## Arquivos Modificados
| Arquivo | Caminho Completo | Tipo de Alteração | Última Modificação |
|---------|-------------------|-------------------|--------------------|
| diffWithOrg.ts | src/commands/diffWithOrg.ts | Modificado (ordem vscode.diff) | 14/09/2026 |
| SfCliAdapter.ts | src/infrastructure/SfCliAdapter.ts | Modificado (missing → empty) | 15/09/2026 |
| diffWithOtherOrg.ts | src/commands/diffWithOtherOrg.ts | Modificado (empty untitled side) | 15/09/2026 |
| ComparisonTempFileService.ts | src/services/ComparisonTempFileService.ts | Modificado (sync buffer / MISSING) | 15/09/2026 |
| ComparisonFileDecorationProvider.ts | src/providers/ComparisonFileDecorationProvider.ts | Modificado (.MISSING parse) | 15/09/2026 |
| explanatio.md | explanatio.md | Modificado (§7.3 / §7.4 / 1.1.0) | 15/09/2026 |
| package.json | package.json | Versão 1.1.0 | 15/09/2026 |
| package-lock.json | package-lock.json | Versão 1.1.0 | 15/09/2026 |
| CHANGELOG.md | CHANGELOG.md | Entrada 1.1.0 | 15/09/2026 |
| README.md | README.md | What's new / Features / Commands 1.1.0 | 15/09/2026 |
| extension.js | dist/extension.js | Rebuild | 15/09/2026 |

## Etapas Realizadas

### Etapa 1 - Criação da branch
- **Data:** 14/09/2026
- **O que foi solicitado:** Criar a branch (nome inicial informado incorretamente)
- **O que foi analisado:** Repositório em `main`, working tree limpa
- **O que foi realizado:** Branch criada a partir de `main`; estrutura de documentação inicializada
- **Arquivos afetados:** `document/SALEXT-0005/SALEXT-0005_resume.md`

### Etapa 2 - Correção do nome da branch e da demanda
- **Data:** 14/09/2026
- **O que foi solicitado:** Corrigir o nome da branch e da demanda para `SALEXT-0005`
- **O que foi analisado:** Branch e pasta estavam como `SALEEXT-0005` (typo)
- **O que foi realizado:** Branch renomeada com `git branch -m`; pasta/documentação migrada para `document/SALEXT-0005/`; sessão ativa atualizada
- **Arquivos afetados:** `document/SALEXT-0005/SALEXT-0005_resume.md` (pasta `document/SALEEXT-0005/` removida)

### Etapa 3 - Ordem do Diff with Org (local | Org)
- **Data:** 14/09/2026
- **O que foi solicitado:** No compare com a Org local/Original, o arquivo aberto na IDE à esquerda e o da Org à direita
- **O que foi analisado:** `diffWithOrg` chamava `vscode.diff(orgUri, target)` (Org esquerda, local direita). `diffWithOtherOrg` já usava `vscode.diff(target, temp)` (local esquerda, Org direita)
- **O que foi realizado:** Invertida a ordem em `diffWithOrg` para `vscode.diff(target, orgUri, title)`; docstring atualizada; `explanatio.md` §7.3 alinhado
- **Arquivos afetados:** `src/commands/diffWithOrg.ts`, `explanatio.md`

### Etapa 4 - Rebuild do bundle (causa do “ainda não funciona”)
- **Data:** 15/09/2026
- **O que foi solicitado:** Usuário reportou que local ainda aparecia à direita
- **O que foi analisado:** `src/commands/diffWithOrg.ts` já estava correto (`vscode.diff(target, orgUri)`), mas `dist/extension.js` (main da extensão) estava desatualizado desde 11/09/2026 com `vscode.diff(orgUri, local)`
- **O que foi realizado:** `npm run build` — bundle agora com `executeCommand("vscode.diff", local, orgUri)`
- **Arquivos afetados:** `dist/extension.js`

### Etapa 5 - Arquivo ausente na Org de comparação → lado Org vazio
- **Data:** 15/09/2026
- **O que foi solicitado:** Ao comparar com outra Org, se o arquivo não existir nela, o diff deve mostrar o lado da Org vazio (hoje parecia que a Org tinha o arquivo)
- **O que foi analisado:** `retrieveMetadataToTemp` copia o local como seed no temp project; quando o metadata não existe na Org, o CLI costuma deixar o seed intacto e o código lia esse conteúdo como se fosse da Org
- **O que foi realizado:** Detecção de missing (mensagem CLI + JSON sem file retrieve / failed); retorno de `content: ''`; toast informativo em `diffWithOtherOrg`; rebuild + typecheck
- **Arquivos afetados:** `src/infrastructure/SfCliAdapter.ts`, `src/commands/diffWithOtherOrg.ts`, `explanatio.md`, `dist/extension.js`

### Etapa 7 - Documentação e bump 1.1.0
- **Data:** 15/09/2026
- **O que foi solicitado:** Atualizar o necessário para explicar as duas novas funcionalidades; release como **1.1.0**
- **O que foi analisado:** README/CHANGELOG/`package.json`/`explanatio.md` ainda em 1.0.0 / docs de Diff desatualizados
- **O que foi realizado:** Bump `1.1.0`; CHANGELOG 1.1.0 (ordem Local|Org + missing empty side); README What's new / Features / Commands / VSIX; explanatio versão + §1/§7.3/§7.4/histórico SALEXT-0005; `package-lock` + rebuild
- **Arquivos afetados:** `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`, `explanatio.md`, `dist/extension.js`

## Modificações em Arquivos (registro cronológico)

SALEXT-0005_resume.md - 14/09/2026 - 11:37 PM (criado como SALEEXT-0005)
SALEXT-0005_resume.md - 14/09/2026 - 11:40 PM (renomeado / corrigido para SALEXT-0005)
diffWithOrg.ts - 14/09/2026 - 11:44 PM
explanatio.md - 14/09/2026 - 11:44 PM
extension.js - 15/09/2026 - 12:25 AM (rebuild)
SfCliAdapter.ts - 15/09/2026 - 12:35 AM
diffWithOtherOrg.ts - 15/09/2026 - 12:35 AM
explanatio.md - 15/09/2026 - 12:35 AM
extension.js - 15/09/2026 - 12:35 AM (rebuild)
diffWithOtherOrg.ts - 15/09/2026 - 12:56 AM (untitled empty side)
ComparisonTempFileService.ts - 15/09/2026 - 12:56 AM
ComparisonFileDecorationProvider.ts - 15/09/2026 - 12:56 AM
extension.js - 15/09/2026 - 12:56 AM (rebuild)
package.json - 15/09/2026 - 8:48 AM (1.1.0)
package-lock.json - 15/09/2026 - 8:48 AM
CHANGELOG.md - 15/09/2026 - 8:48 AM
README.md - 15/09/2026 - 8:48 AM
explanatio.md - 15/09/2026 - 8:48 AM
extension.js - 15/09/2026 - 8:48 AM (rebuild)

## Observações
A extensão carrega `./dist/extension.js` — após mudanças em `src/`, sempre `npm run build` + Reload Window / F5. Quando missing, o título do Diff fica `FILE — LOCAL x ALIAS (missing in Org)` e o painel direito é um documento vazio novo. Release marketplace: gerar VSIX `salesforce-compare-1.1.0.vsix` e publicar Marketplace + Open VSX.

# Publicação no Visual Studio Marketplace — Salesforce Compare

Guia passo a passo. Em cada etapa: **VOCÊ** = ação manual na conta Microsoft; **AGENTE** = o que o assistente pode fazer no projeto.

Publisher: `LeftConsult` (Left Consult)  
Extensão: `salesforce-compare`  
ID na loja: `LeftConsult.salesforce-compare`

---

## Passo 0 — Nome da demanda ✅

**Demanda:** `SALEXT-0002` — Publicação Salesforce Compare no Visual Studio Marketplace.

Renomeie o chat no Cursor para `SALEXT-0002` (menu do chat → Rename).

---

## Passo 1 — Conta Microsoft / Azure DevOps (VOCÊ)

1. Abra: https://dev.azure.com/
2. Entre com a conta Microsoft da **Left Consult** (ou a que será dona do publisher).
3. Se não tiver organização, crie uma (pode ser pessoal, só para Marketplace).

Documentação: https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/create-organization

---

## Passo 2 — Criar o Publisher ✅

Publisher existente: **Left Consult** (`LeftConsult`) — já gerencia extensões (ex.: Easy Debugger).

O `"publisher"` em `package.json` foi alinhado a `LeftConsult`.

Docs: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher

---

## Passo 3 — Personal Access Token (PAT) ✅

PAT criado com scope **Marketplace → Manage**. Não compartilhe o token no chat.

Docs: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token

---

## Passo 4 — Ícone e metadados da loja ✅

**Concluído:**
- `images/icon.png` (128×128)
- `"icon": "images/icon.png"` em `package.json`
- README com instalação via Marketplace

---

## Passo 5 — Build e validação do `.vsix` (AGENTE)

No projeto:

```powershell
npm install
npm run compile
npm run package
```

O agente confere avisos do `vsce` (ícone, README, arquivos incluídos/excluídos).

---

## Passo 6 — Publicação automatizada ✅

Publicado: **LeftConsult.salesforce-compare v0.1.1**

- Marketplace: https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare
- Hub: https://marketplace.visualstudio.com/manage/publishers/LeftConsult/extensions/salesforce-compare/hub

Para futuras versões: atualize `version` + `CHANGELOG.md`, depois `npm run publish:marketplace`.

---

## Passo 7 — Verificar na loja (VOCÊ)

1. Painel: https://marketplace.visualstudio.com/manage/publishers/LeftConsult
2. Página pública (quando aprovada):  
   https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare
3. No VS Code: Extensions → buscar **Salesforce Compare** → Install

---

## Passo 8 — Open VSX / Cursor marketplace ✅ (fluxo)

O Cursor **não** usa o Visual Studio Marketplace da Microsoft para extensões de terceiros.
Ele usa o **Open VSX** (com proxy `marketplace.cursorapi.com`).

### VOCÊ — token Open VSX (uma vez)

1. Entre em https://open-vsx.org/ com GitHub (conta Left Consult / lucasefr).
2. Acesse https://open-vsx.org/user-settings/tokens → **Generate New Token**.
3. Cole o valor em `.env` como `OVSX_PAT=` (nunca commitar).
4. Se a Eclipse pedir, assine o Contributor Agreement.

### AGENTE / republicação

```powershell
npm run publish:openvsx
```

Isso cria o namespace `LeftConsult` (se ainda não existir) e publica o `.vsix` no Open VSX.

- Open VSX: https://open-vsx.org/extension/LeftConsult/salesforce-compare
- No Cursor: Extensions → buscar **Salesforce Compare** → Install (pode levar alguns minutos)

Para publicar nas duas lojas de uma vez: `npm run publish:all`.

Verificação opcional no Cursor (badge verified): https://cursor.com/help/customization/extensions#how-do-i-get-my-extension-verified

---

## Atualizações futuras (versão nova)

1. Alterar `version` em `package.json` e entrada em `CHANGELOG.md`
2. `npx @vscode/vsce publish` de novo (ou `publish minor` / `publish patch`)

---

## Checklist rápido

| # | Item | Quem |
|---|------|------|
| 0 | Nome da demanda | VOCÊ |
| 1 | Conta Azure DevOps | VOCÊ |
| 2 | Publisher `LeftConsult` | ✅ |
| 3 | PAT Marketplace Manage | ✅ |
| 4 | Ícone + metadados | ✅ |
| 5 | Build / `.vsix` válido | AGENTE |
| 6 | `vsce publish` | VOCÊ (token) + AGENTE (comandos) |
| 7 | Conferir URL na loja | VOCÊ |
| 8 | Open VSX (opcional) | VOCÊ |

---

## Links úteis

| Recurso | URL |
|---------|-----|
| Publishing extensions | https://code.visualstudio.com/api/working-with-extensions/publishing-extension |
| Manage publishers & extensions | https://marketplace.visualstudio.com/manage |
| Azure DevOps | https://dev.azure.com/ |
| PATs | https://dev.azure.com/_usersSettings/tokens |
| vsce (CLI) | https://github.com/microsoft/vscode-vsce |
| Open VSX | https://open-vsx.org/ |

# Quatreros AI

This Claude Platform agent quickstart's setup as declarative files for the
`ant` CLI:

- `agents/quatreros-ai.md`: the agent. Its YAML frontmatter is the body of `POST /v1/agents`; the Markdown under it is the system prompt.
- `environments/quatreros-ai-env.yml`: the environment its sessions run in (`POST /v1/environments`).

Install the `ant` CLI (https://platform.claude.com/docs/en/cli-sdks-libraries/cli/quickstart), preview the plan, then apply it (https://platform.claude.com/docs/en/cli-sdks-libraries/cli/scripting#version-controlling-api-resources):

```sh
cd quatreros-ai
ant apply --dry-run .
ant apply .
```

> Antes de `ant apply`, pega `ANTHROPIC_API_KEY` en el `.env` del backend y verifica que `ANTHROPIC_AGENT_ID` y `ANTHROPIC_ENVIRONMENT_ID` coincidan con `claude-lock.json`.

`claude-lock.json` already holds the IDs of what the quickstart created, so the first apply adopts those resources (one update each, stamping them as managed by `ant`) and later runs keep them in sync with these files. To create fresh copies instead — in another organization or workspace, say — delete `claude-lock.json` first.

Keep `claude-lock.json` next to these files, and the file names as they are (the IDs are keyed by path). Vault credentials aren't included; a credential typed into the agent config itself (an MCP server's `authorization_token`) is, so move it to a vault before committing these files.

## Herramientas del agente

Las herramientas `custom` viven en `agents/tools/*.json` y el agente las incluye con `- ./tools/*.json`. Están declaradas, pero **no se publican solas**:

- 9 lecturas: existencias, lotes por vencer, trazabilidad, productos, materias primas, pedidos, clientes, saldo de cliente y cartera vencida.
- 2 escrituras preparadas: materia prima y receta inicial. El backend solo crea una propuesta; la ejecución ocurre cuando el humano confirma en el ERP.

Orden obligatorio: el backend con sus manejadores ya está desplegado; después se ejecuta `ant apply` con autorización del responsable. No ejecutes `ant apply` sin esa autorización ni edites el agente en la consola.

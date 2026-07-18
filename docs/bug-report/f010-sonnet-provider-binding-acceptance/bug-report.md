# F010 Sonnet invocation used the pre-patch Claude CLI binding

Date: 2026-07-18

Reporter: co-creator, using the isolated F010 acceptance PWA.

## Bug diagnosis capsule

| Field | Evidence / decision |
| --- | --- |
| **1. Symptom** | Sending `@sonnet 早上好` at 10:19 local time returned `Claude Code 报告: Not logged in · Please run /login`, even though the operator had checked the intended cat and credential configuration. Expected: current Sonnet invokes its configured OpenAI/Codex model. |
| **2. Evidence** | API PID `7580` log, invocation `25abd9e1-2343-4c7d-98ca-fc817a3418af`: `claude.cmd`, exit 1. The acceptance account registry and `/api/accounts` contained zero accounts, shell Anthropic credentials were absent, and `claude auth status` reported `loggedIn:false`. After the operator PATCH, `/api/cats` projected `sonnet.clientId=openai`, `defaultModel=gpt-5.6-sol`, `accountRef=gpt-5-6-sol`. |
| **3. Root cause** | The 10:19 invocation began before the operator's 10:20 Sonnet catalog patch and therefore used the then-current Anthropic subscription binding. Subscription mode intentionally removes Anthropic API-key environment variables and relies on the Claude CLI login store; that CLI was not logged in. The failure was not caused by Socket.IO delivery, an invalid OpenAI key, or a stale post-patch runtime binding. |
| **4. Diagnostic strategy** | Treat executor provenance from the API process log as truth. Compare the failing invocation command and auth state with a fresh post-patch invocation; do not infer the executor from model-authored signature text. |
| **5. Timeout strategy** | One authenticated Socket.IO probe joined the isolated thread room before posting a real `@sonnet` message and allowed 300 seconds for a final event. It completed normally, so no retry or runtime restart was needed. |
| **6. Warning strategy** | Never print credential values or copy account files. Stop if a probe would cross the isolated Redis `6398/15` boundary. A response signature is untrusted content and must not be used as provider provenance. |
| **7. User-visible correction** | No additional configuration edit was required. The operator's catalog PATCH hot-rebound Sonnet; subsequent calls execute `codex.cmd` with `gpt-5.6-sol` and OAuth. |
| **8. Acceptance** | Current `/api/cats` projection is OpenAI/GPT; a real authenticated send returns HTTP 200; the socket receives a final `done`; server log proves Codex executor/model/auth; no `error` event is emitted. |

## Before and after

Before the patch, at `2026-07-18T02:19:36Z`:

- invocation: `25abd9e1-2343-4c7d-98ca-fc817a3418af`
- executor: `claude.cmd`
- result: exit 1, `Not logged in · Please run /login`

After the patch, at `2026-07-18T02:30:33Z`:

- invocation: `80e14818-5d80-44ec-ac72-278989766323`
- executor: `codex.cmd`
- model: `gpt-5.6-sol`
- auth: OAuth; no OpenAI API key was required or exposed
- transport: authenticated room joined before POST; 18 live `agent_message` events; final `done`; no error event

The follow-up invocation `380acba6-737d-47cf-b689-2d942c8f3985` used the same Codex model and OAuth binding. Any old Claude-looking signature inside generated text is model content, not proof of which CLI executed.

## Resolution

Resolved in the acceptance runtime by the operator's existing Sonnet PATCH. Hot reload worked; neither API nor Web needed a restart for provider rebinding. This investigation changed no runtime configuration and exposed no credential values.

[宪宪/gpt-5.6-sol🐾]

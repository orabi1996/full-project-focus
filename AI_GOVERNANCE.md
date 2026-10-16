# MADARX ENTERPRISE WORKFORCE PLATFORM
# AI GOVERNANCE & ETHICS CHARTER

## 1. Principles of Responsible Enterprise AI
1. **Human-in-the-Loop Supremacy:** AI acts exclusively as an assistive decision-support copilot. AI is prohibited from independently deciding hiring, termination, salary adjustments, disciplinary guilt, or performance ratings.
2. **Grounding in Authoritative System Truth:** MadarX AI never hallucinates or fabricates employee records, attendance stats, leave balances, or financial figures. If a data point is unrecorded, the copilot explicitly declares it unavailable.
3. **Strict Verifiable Citations:** Responses to policy or legal inquiries must cite verifiable document titles, versions, and sections.
4. **Explainability:** All predictive or analytical outputs (such as skills matching or succession candidate comparisons) rely on transparent, factual criteria rather than arbitrary score generation.

## 2. Governed Tool Contracts
- Invocations are restricted to the 16 approved tools in `GOVERNED_AI_TOOLS`.
- Every tool invocation validates the active user's RBAC role and tenant boundaries before fetching data.
- Read tools (`employee.search`, `leave.get_balance`, `payroll.get_summary`, `knowledge.search`) execute immediately.
- Mutation tools (`tasks.create`, `notifications.send_reminder`, `leaves.create_request`) generate an interactive confirmation card in the chat window, preventing silent database alterations.

# dp-ring Mainline Research Refinement

## 2026-04-18 17:23 +08:00

### Current mainline context
Canonical spine:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase:
- Phase 1: governance kernel

Current observed gap in repo:
- `workflow_tightness` / `oversight_strength` / `branch_budget` / `adoption_status` already affect runtime behavior
- but `divergence` / `composability` / `effective_force` / `governance_pressure` do not yet exist as first-class metrics in `ring/lib/*` or `tests/ring/*`
- the system already consumes lineage, but still lacks a sharper theory for how governance should tighten, loosen, isolate, or synthesize branches

### Sources reviewed

1. Bryan Horling, Victor Lesser, “A survey of multi-agent organizational paradigms”
   - Primary source URL: https://www.cambridge.org/core/journals/knowledge-engineering-review/article/abs/survey-of-multiagent-organizational-paradigms/A07BCCB1379F001DE995F3E5476EE4AB
   - DOI: https://doi.org/10.1017/S0269888905000317
   - Evidence captured from Cambridge abstract page.

2. Konstantinos Karasavvas, Albert Burger, Richard Baldock, “A Multi-agent Bioinformatics Integration System with Adjustable Autonomy”
   - Primary source URL: https://link.springer.com/chapter/10.1007/3-540-45683-X_53
   - DOI: https://doi.org/10.1007/3-540-45683-X_53
   - Evidence captured from Springer abstract page.

3. Repo inspection for current code reality
   - `ring/lib/session-runner.mjs`
   - `ring/lib/orchestrator.mjs`
   - `tests/ring/*`
   - Current search result: no occurrences of `divergence`, `composability`, `effective_force`, or `governance_pressure`

### Findings

#### Finding 1: Organizational form is a real performance variable, not just presentation vocabulary
Horling & Lesser explicitly state that organizational design has a “significant, quantitative effect” on system performance, and survey multiple forms including hierarchies, holarchies, coalitions, teams, congregations, societies, federations, markets, and matrix organizations.

Implication for dp-ring:
- dp-ring should not hard-code one static organization pattern into all runs.
- The current `workflow_tightness` / `oversight_strength` axis is directionally right, but it is still too thin if it only behaves like a generic strictness knob.
- The mainline should treat branch governance as organizational structure selection pressure: when to centralize, when to federate, when to isolate, when to synthesize.

Refinement to the mainline:
- Phase 1 should not just add branch metrics mechanically.
- Phase 1 branch metrics should be chosen so they help decide organizational moves, especially:
  - whether a branch should stay locally exploratory
  - whether work should be pulled back into tighter supervision
  - whether a branch should remain isolated
  - whether multiple branches are composable enough to synthesize

#### Finding 2: Adjustable autonomy is fundamentally about intervention policy, not just “more or less freedom”
The Springer abstract is especially useful because it ties adjustable autonomy to trust, explanation, and user intervention in critical decisions according to user preferences.

Quoted substance from the abstract:
- the system increases user trust with an explanation facility
- this is especially useful when users want to “take control of critical-decisions, i.e. adjust the system’s autonomy”
- adjustment is accomplished by interacting with users and asking for intervention “according to their own preferences”

Implication for dp-ring:
- `workflow_tightness` and `oversight_strength` should not be treated as passive labels only.
- They should govern:
  - when explanation is required
  - when evidence quality is insufficient for autonomous continuation
  - when supervisor intervention is mandatory
  - when a branch may continue locally without escalation
- In other words, adjustable autonomy in dp-ring should be formalized as transfer-of-control / escalation policy.

Refinement to the mainline:
- Phase 1 `governance-policy` should explicitly include escalation semantics, not only branch reuse/blocking semantics.
- A future branch metric set should help determine when to escalate, not only when to reuse or discard.

#### Finding 3: Current repo state is strong on lineage fields but weak on explicit governance measurements
Repo inspection confirms:
- `workflow_tightness`, `oversight_strength`, `branch_budget`, and `adoption_status` already appear in runtime/orchestrator code
- but the planned metrics layer does not yet exist
- therefore the project currently has governance state fields without a sufficiently explicit measurement model behind them

Implication for dp-ring:
- the immediate research value is not more abstract ambition; it is sharper metric design for Phase 1.
- Otherwise governance risks staying a collection of special-case rules instead of becoming a reusable policy layer.

### Implications for the mainline

#### Mainline strengthened
The canonical 3-phase spine still looks correct:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This research pass strengthens Phase 1 rather than changing the spine.

#### Mainline refined
Phase 1 should now be read more precisely as:
- unify governance policy
- add branch metrics
- make 聚散离合 actions explicit
- harden invariants and round-trip semantics
- explicitly define escalation / intervention semantics for adjustable autonomy

In practical terms, Phase 1 branch metrics should help answer:
- when to let a branch continue locally
- when to tighten supervision
- when to isolate a branch
- when branches are mature enough to synthesize
- when explanation/evidence is strong enough to avoid supervisor escalation

#### Proposed metric hypotheses for the next pass
These are research hypotheses, not final definitions yet:
- `divergence`: distance between active branch outputs/evidence trajectories and current mainline assumptions
- `composability`: likelihood that two or more branches can be synthesized without semantic conflict
- `effective_force`: practical forward pressure of a branch, combining progress rate, evidence accumulation, and low replay friction
- `governance_pressure`: combined need for intervention, driven by conflict, low evidence quality, repeated replay, or low trust/explainability

### Recommended next research slice
Next pass should target the missing substrate behind today’s findings:

1. blackboard / shared-truth architecture
   - to sharpen how external truth should be represented beyond ad hoc artifact storage
2. typed graph / tree rewriting formalisms
   - to sharpen how `continue / fork / adopt / discard / synthesize` should be modeled structurally
3. metric design grounded in observable runtime signals
   - especially evidence disagreement, replay frequency, adoption latency, branch conflict, and intervention rate

### Recommended immediate effect on planning
For future dp-ring planning and implementation selection:
- keep the active phase on Phase 1
- prioritize `governance-policy` and branch-metrics before heterogeneous node expansion
- treat explanation / trust / intervention hooks as part of adjustable autonomy, not as later UI garnish
- do not move to UI or Rust projection work until the Phase 1 measurement and escalation model is clearer

## 2026-04-18 18:26 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/node-capsule.mjs` already defines the capsule as a runtime facade for “leases, heartbeats, semantic checkpoints, evidence references, and replay.”
- `ring/lib/checkpoint-tree.mjs` already exports explicit checkpoint-tree operations: `continueFromCheckpoint`, `forkCheckpoint`, `adoptBranch`, `discardBranch`, and `synthesizeCheckpoint`.
- `.ring/schemas/node.schema.json` already encodes a tree-facing node contract with `boundary_mode: contract_projection`, explicit capsule replay/journal structure, and RAG boundary metadata that keeps retrieval internals outside the global contract.
- The remaining gap is no longer basic artifact vocabulary. It is the lack of a sharper control-shell theory, deterministic replay discipline for governance choices, and typed guard semantics for branch operations.

### Sources reviewed

1. H. Penny Nii, “The Blackboard Model of Problem Solving and the Evolution of Blackboard Architectures”
   - Official source URL: https://doi.org/10.1609/aimag.v7i2.537
   - Readable fallback used after direct page discovery: https://r.jina.ai/http://ojs.aaai.org/aimagazine/index.php/aimagazine/article/view/537
   - Access note: direct AI Magazine page was reachable; `r.jina.ai` was used only to extract a clean text abstract.
   - Key evidence: the abstract says the article defines blackboard systems, introduces “the blackboard framework,” and includes “a detailed description of the model's components and their behavior.”

2. Microsoft Learn, “Durable orchestrator code constraints”
   - Official source URL: https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-code-constraints
   - Direct markdown used: https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-code-constraints?accept=text/markdown
   - Access note: official page and markdown were directly reachable.
   - Key evidence: “Orchestrators use event sourcing to ensure reliable execution and to maintain local variable state,” and “orchestrators must be deterministic.”

3. Hartmut Ehrig, Karsten Ehrig, Ulrike Prange, Gabriele Taentzer, “Fundamentals of Algebraic Graph Transformation”
   - Official source URL: https://doi.org/10.1007/3-540-31188-2
   - Readable fallback used after direct page discovery: https://r.jina.ai/http://link.springer.com/book/10.1007/3-540-31188-2
   - Access note: direct Springer page was reachable but verbose and terminated with an SSL EOF after returning HTML; `r.jina.ai` was used for a readable overview.
   - Key evidence: Springer describes graph transformation as “the rule-based manipulation of graphs,” and notes that the book covers “graph and typed graph transformation” plus typed attributed graph transformation.

### Findings

#### Finding 1: Blackboard-style coordination strengthens the node-centered / external-truth line
Nii’s abstract does not just validate a vague “shared context” idea. It explicitly frames blackboard systems as a model plus framework with named components and behavior. That matters because dp-ring already has the beginnings of a stable outer contract for nodes and capsules, but still needs a sharper theory of how control should sit above local node internals.

Implication for dp-ring:
- External artifacts should remain the coordination surface; node-local internals should not become the global truth model.
- The current node contract direction is validated: specialized local subsystems can stay heterogeneous behind a stable tree-facing boundary.
- What still needs sharpening is the control shell: when a node may publish, when it must wait, when evidence is sufficient, and when supervision must intervene.

Comparison against the canonical mainline:
- **Strengthens Phase 2** by validating “heterogeneous node ecology / rich-node proof” as knowledge-source heterogeneity behind a shared external substrate.
- **Refines Phase 1** by implying the governance kernel must act like a control layer over shared artifacts, not merely a bag of policy flags.
- **Rejects** any future drift toward agent-to-agent conversational state as the primary system truth.

Repo-specific consequence:
- The existing `contract_projection` boundary and RAG metadata in `node.schema.json` are directionally correct.
- The next missing piece is an explicit control-shell / publication policy, not more elaborate node internals.

#### Finding 2: Durable execution sharpens semantic checkpointing into deterministic replay discipline
The Microsoft source is unusually direct: durable orchestration is reliable because of event sourcing and replay, and replay imposes deterministic code constraints. For dp-ring, this is stronger than the current general principle that recovery should be semantic rather than OS-level. It says the governance kernel itself should be designed so that replay reconstructs decisions without trusting ambient process state.

Implication for dp-ring:
- Journal and replay state should be authoritative for recovery; tmux sessions, worker liveness, and host memory should be treated as disposable caches.
- Governance decisions that matter for replay should not depend on ambient wall-clock time, randomness, or implicit process-local state unless those values are journaled first.
- Branch decisions, escalation triggers, and synthesis choices should be durable events with replay-safe inputs.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving a primary-source justification for semantic checkpointing and replay-first recovery.
- **Refines Phase 1** by adding a determinism requirement for governance/orchestration logic, not just a general replay aspiration.
- **Rejects** any plan variant that treats process existence, shell state, or unrecorded supervisor choices as durable state.

Repo-specific consequence:
- `node-capsule.mjs`, `checkpoint-tree.mjs`, and the workflow-run schema already carry replay and journal fields, so the architecture is aligned.
- The missing refinement is to make governance choices themselves more explicitly replay-safe and journal-accountable.

#### Finding 3: Algebraic graph transformation suggests branch operations should become typed rewrite rules with guards
The Springer overview matters because it frames graph transformation as rule-based and explicitly typed, rather than ad hoc mutation. dp-ring already has checkpoint-tree operations in code, but the current functions still behave more like helper transformations than a principled typed rewrite system with application conditions and conflict semantics.

Implication for dp-ring:
- `continue / fork / adopt / discard / synthesize` should be treated as named rewrite primitives over a typed checkpoint structure.
- The global tree should stay tree-first, while non-structural relationships remain typed references rather than unrestricted structural merge.
- `synthesize` should remain constructive: create a new checkpoint with typed provenance inputs, not destructively merge branch structure.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by reinforcing checkpoint-tree governance over free-form graph growth.
- **Refines Phase 1** by pushing branch operations toward typed guards, invariants, and explicit branch-event semantics.
- **Rejects** unrestricted merge semantics as the long-term kernel basis.

Repo-specific consequence:
- `checkpoint-tree.mjs` already exports the right operation names.
- The next research-to-design step is to specify explicit preconditions, no-cycle/one-parent invariants, tombstone vs discard semantics, and typed provenance rules for synthesis/adoption.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks correct:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does not change the spine. It narrows the meaning of the first two phases and makes Phase 3 even more clearly downstream.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by durable-execution evidence and typed rewrite evidence. The kernel should be journal-authoritative, replay-safe, and explicit about branch operations.
- **Phase 2 / Heterogeneous node ecology** is strengthened by blackboard-style reasoning plus the current node contract substrate. The mainline should keep rich local nodes and simple global governance rather than flattening everything into one graph model.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a blackboard-like control shell over external artifacts and checkpoints
- make journal/replay state authoritative for recovery and governance re-entry
- make branch operations explicit as typed rewrite primitives with guards
- add branch metrics only after they are attached to replay-safe control decisions
- keep `workflow_tightness` / `oversight_strength` meaningful by tying them to concrete publication, escalation, isolation, and synthesis rules

Phase 2 should now be read more precisely as:
- prove that executor, verifier, and RAG-like advisor nodes can remain locally rich behind `contract_projection`
- expose only tree-facing contract outputs, evidence refs, health summaries, and governance-relevant metadata
- avoid promoting local retrieval/planning internals into the global tree model

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize a control-shell / branch-guard / replay-determinism spec before adding more node varieties
- treat the existing node capsule and checkpoint-tree code as the substrate to refine, not as something to replace with a new architecture this week
- keep Rust control-plane, UI surfaces, and broader product projection as downstream work

### Recommended next research slice
The next pass should target the missing measurement and policy layer that this pass exposed more clearly:

1. **branch-metric grounding from observable signals**
   - map `divergence`, `composability`, `effective_force`, and `governance_pressure` to concrete runtime observations such as evidence disagreement, replay requests, adoption latency, branch-budget exhaustion, heartbeat churn, and supervisor escalation frequency
2. **transfer-of-control policy under replay constraints**
   - sharpen when a branch may continue autonomously, when it must escalate, and what explanation/evidence thresholds are required for safe continuation
3. **typed guard tables for checkpoint-tree operations**
   - turn `continue / fork / adopt / discard / synthesize` into a guardable policy table with explicit invariants, replay notes, and auditable branch-event outcomes

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- do not add more architecture narrative or product-surface work ahead of the control-shell and branch-guard layer
- do not treat replay/journal fields as “good enough” just because they already exist in schemas; the deterministic governance semantics are still underspecified
- do not treat current checkpoint-tree helper functions as the final abstraction; they should become the kernel’s typed governance operations
- preserve the current node-centered boundary discipline: local richness, global simplicity

## 2026-04-18 19:44 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- Search across `ring/lib/*.mjs` still finds no first-class `divergence`, `composability`, `effective_force`, or `governance_pressure` symbols.
- Existing governance-control fields remain the active runtime surface: `workflow_tightness`, `oversight_strength`, `branch_budget`, and `adoption_status`.
- `.ring/schemas/node.schema.json` still explicitly says that “RAG is a valid node profile, not a required global architecture” and keeps `boundary_mode: contract_projection` available for rich local nodes.
- The repo is therefore still aligned with the mainline direction, but the open gap is now clearest at the control/message layer: how supervision enters, how branch events are committed, and how rich nodes publish governance-relevant outputs without leaking internals.

### Sources reviewed

1. P. Scerri, D. V. Pynadath, M. Tambe, “Towards Adjustable Autonomy for the Real World”
   - Primary source URL: https://jair.org/index.php/jair/article/view/10312
   - DOI: https://doi.org/10.1613/jair.1037
   - Access note: direct primary page was reachable; abstract was read from the official JAIR article page.
   - Key evidence: the abstract says prior work relies on “rigid one-shot transfers of control” and ignores team costs, then proposes a “transfer-of-control strategy” as a conditional sequence of control-transfer actions plus actions that change coordination constraints.

2. Temporal documentation, “Temporal Workflow message passing - Signals, Queries, & Updates”
   - Official source URL: https://docs.temporal.io/encyclopedia/workflow-message-passing
   - Access note: direct official docs page was reachable in browser automation.
   - Key evidence: the page says “Signals are asynchronous write requests,” “Queries are read requests,” and “Updates are synchronous, tracked write requests,” adding that Updates can be validated before being accepted into Workflow Event History.

3. Patrick Lewis et al., “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks”
   - Primary source URL: https://arxiv.org/abs/2005.11401
   - DOI: https://doi.org/10.48550/arXiv.2005.11401
   - Access note: direct arXiv abstract page was reachable.
   - Key evidence: the abstract says provenance and updating world knowledge remain open problems, and defines RAG as combining a pre-trained seq2seq model with a non-parametric memory implemented as a dense vector index accessed by a retriever.

### Findings

#### Finding 1: Adjustable autonomy should be a strategy language, not a one-shot escalation toggle
The JAIR paper sharpens the governance problem considerably. Its key move is not merely “sometimes escalate to a human.” It says the right abstraction is a transfer-of-control strategy: a conditional sequence that can both move decision authority and alter coordination constraints to reduce team-level miscoordination.

Implication for dp-ring:
- `workflow_tightness` and `oversight_strength` should not collapse into a single strictness knob.
- The governance kernel should support strategy-like policy moves such as:
  - escalate to supervisor now
  - delay escalation while relaxing coordination constraints
  - tighten coordination and force acknowledgement before continuation
  - isolate a branch to reduce team-wide disruption
- `governance_pressure` should be framed partly as expected coordination loss from leaving a branch autonomous versus transferring control.
- `effective_force` should not mean raw progress velocity alone; it should be discounted by coordination disruption, replay friction, and escalation debt.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving a direct primary-source reason to model governance as transfer-of-control policy rather than generic strictness.
- **Refines Phase 1** by implying that branch metrics should estimate decision quality and coordination cost together.
- **Rejects** any Phase 1 design that treats autonomy shifts as a one-shot binary escalation with no explicit coordination-constraint semantics.

#### Finding 2: Supervisor interaction should use typed message classes with distinct durability semantics
The Temporal page is valuable because it cleanly separates read-only observation (`Query`), asynchronous write intent (`Signal`), and synchronous tracked mutation (`Update`). That distinction is immediately useful for dp-ring’s checkpoint tree and governance shell.

Implication for dp-ring:
- Branch governance should not treat every intervention as the same kind of event.
- A useful branch-event taxonomy should distinguish at least:
  - **observe/query-style events**: read-only inspection that does not mutate checkpoint state
  - **advise/signal-style events**: asynchronous nudges or recommendations that may influence local execution without requiring immediate acknowledgement
  - **commit/update-style events**: synchronous, validated governance decisions such as `adopt`, `discard`, `synthesize`, `tighten`, `loosen`, or `escalate`
- Strong oversight should require update-style acknowledgement for state-changing governance moves.
- Low-latency exploratory work can remain signal-like until a branch reaches a decision boundary that requires a tracked commitment.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making branch events and supervisory intervention more concrete.
- **Refines Phase 1** by suggesting that semantic checkpoints should record different event classes with different replay and validation rules.
- **Rejects** any design where supervisor decisions live as ambient chat/context without a typed, auditable commit path.

Repo-specific consequence:
- The next planning artifact should likely be a `branch-event` / governance-message spec before more runtime variety is introduced.
- The current gap is not vocabulary (`continue`, `fork`, `adopt`, `discard`, `synthesize` already exist) but typed entry paths and commit semantics for those moves.

#### Finding 3: The original RAG formulation validates rich local nodes with explicit provenance duties
The RAG paper is useful not because dp-ring should become “a RAG system,” but because it gives a clean example of a locally rich composite: parametric memory + non-parametric memory + retriever + generator. It also directly highlights provenance and knowledge updating as hard problems.

Implication for dp-ring:
- A RAG-like advisor node is naturally a Phase 2 rich-node proof under one outer node contract.
- The node should keep embeddings, index/cache state, reranker traces, and prompt internals local.
- The node should export only governance-relevant projections such as:
  - output artifact refs
  - cited evidence refs / provenance summaries
  - freshness / confidence summaries
  - node-health metadata relevant to replay or supervision
- This supports `contract_projection`: global simplicity, local richness.

Comparison against the canonical mainline:
- **Strengthens Phase 2** by validating “heterogeneous node ecology / rich-node proof” with a concrete, non-trivial node type.
- **Refines Phase 2** by making provenance-carrying output a core contract requirement for RAG-like nodes.
- **Rejects** any architecture drift toward making a shared retrieval substrate or vector index the global system model.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks correct:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current mainline rather than changing it.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by strategy-based adjustable autonomy and typed message semantics. Governance now looks less like a set of flags and more like a replayable transfer-of-control and commit protocol.
- **Phase 2 / Heterogeneous node ecology** is strengthened by the original RAG formulation, which cleanly demonstrates why rich local composition should sit behind a narrow external contract.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a branch-event / governance-message taxonomy
- treat `workflow_tightness` and `oversight_strength` as parameters of transfer-of-control strategy, not just labels
- connect branch metrics to coordination cost, replay friction, and escalation need
- require state-changing governance decisions to pass through validated, update-style commit paths
- keep observational reads and advisory nudges distinct from durable checkpoint mutations

Phase 2 should now be read more precisely as:
- prove a rich-node contract using an executor/verifier/RAG-like split
- require provenance-bearing outputs from rich nodes
- preserve local ownership of retrieval/index/rerank/prompt internals
- export only tree-facing artifacts, evidence refs, health summaries, and governance-relevant metadata

#### Refined metric hypotheses after this pass
These remain hypotheses, but the sources sharpen their meaning:
- `divergence`: distance between a branch’s evidence/assumption trajectory and the mainline or sibling branches
- `composability`: expected conflict rate or synthesis friction if two branches are combined under a single checkpoint
- `effective_force`: net forward usefulness after discounting coordination disruption, replay friction, and unresolved escalation debt
- `governance_pressure`: expected value of intervention or coordination-constraint change, given evidence weakness, conflict, latency, and supervisory risk

### Recommended next research slice
The next pass should target the new design seam exposed here:

1. **branch-event / governance-message spec**
   - define query-style, signal-style, and update-style governance events
   - map which ones enter durable journal state and which remain observational
2. **transfer-of-control policy table**
   - map `workflow_tightness × oversight_strength × branch metrics` to `continue / fork / tighten / loosen / isolate / escalate / adopt / synthesize`
3. **RAG-like node contract sketch**
   - specify the minimal exported provenance/evidence/health surface and the explicit local-only internals

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- keep the active focus on **Phase 1**
- prioritize a docs-level `branch-event` / governance-message spec before new runtime or product work
- treat transfer-of-control strategy as the next missing kernel concept behind 聚散离合 operations
- keep the first rich-node proof narrow: one RAG-like advisor node that demonstrates local-rich / global-clean boundaries without forcing global graph complexity
- do not globalize retrieval infrastructure or let RAG internals leak into checkpoint-tree semantics

## 2026-04-18 — Research pass 6

### Sources reviewed

1. Raj Reddy et al., “The Hearsay-II speech-understanding system”
   - Official source URL: https://doi.org/10.1121/1.2005841
   - Access note: the official AIP page was blocked by Cloudflare bot protection in browser automation (`Just a moment...`), so Crossref abstract metadata was used as the primary-source fallback.
   - Key evidence: the abstract says the system uses “independent knowledge sources which work opportunistically on a global data-base called a blackboard,” is “based on hypotheses and evidence,” and is “controlled in an opportunistic, data-directed manner.”

2. Jay R. Galbraith, “Organization Design: An Information Processing View”
   - Official source URL: https://doi.org/10.1287/inte.4.3.28
   - Access note: the official INFORMS page was blocked by Cloudflare bot protection in browser automation (`Just a moment...`), so Crossref abstract metadata was used as the primary-source fallback.
   - Key evidence: the abstract says organizations can “increase their information processing capability to deal with uncertainty” by creating “slack resources,” “self-contained tasks,” “vertical information systems,” and “lateral relations.”

3. Kiraku Shintani and Nao Hirokawa, “Compositional Confluence Criteria”
   - Official source URL: https://doi.org/10.46298/lmcs-20(1:6)2024
   - Direct article page used: https://lmcs.episciences.org/12929
   - Access note: the official LMCS page was directly reachable.
   - Key evidence: the official abstract says confluence criteria are generalized into ones “composable with other criteria,” and recasts orthogonality, rule labeling, and critical-pair systems into “composable forms.”

### Findings

#### Finding 1: The original blackboard formulation sharpens dp-ring’s external-truth and node-centered control model
The earlier blackboard line in the memo is reinforced by going back to Hearsay-II itself. The important point is not just “shared context.” The system’s knowledge sources are independent, they operate opportunistically, and they coordinate through a global blackboard of hypotheses and evidence rather than through direct peer-to-peer conversational coupling.

Implication for dp-ring:
- The checkpoint tree plus external artifacts should be treated as the system blackboard.
- Nodes should publish typed hypotheses, evidence, and commitments against that external substrate rather than leaking agent-local reasoning as global truth.
- Supervisory logic should react to data availability and evidence quality, not to agent identity.
- This further validates “execution capsule faces node, not agent”: the global system schedules and governs semantic node outputs, while internal local machinery remains replaceable.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding the governance kernel in a data-directed control shell over external state.
- **Strengthens Phase 2** by validating heterogeneous local knowledge sources behind a shared outer publication surface.
- **Rejects** any design drift toward agent-to-agent chat state or implicit local deliberation as the authoritative global substrate.

#### Finding 2: Information-processing organization theory gives operational meaning to governance pressure and node encapsulation
Galbraith is highly useful here because it offers concrete organizational responses to uncertainty rather than abstract “better coordination” language. The listed mechanisms map well onto the dp-ring mainline and help define what the governance kernel is actually adjusting.

Implication for dp-ring:
- **slack resources** map naturally to branch budget, exploration allowance, or tolerated ambiguity before intervention.
- **self-contained tasks** map to node encapsulation and branch isolation: keep work locally complete when possible to reduce coordination burden.
- **vertical information systems** map to checkpoint summaries, evidence journals, escalation packets, and supervisor-facing read models.
- **lateral relations** map to typed references across branches or nodes — useful, but controlled, and not a license for free-form structural merge.
- `workflow_tightness` and `oversight_strength` should therefore be interpreted as information-processing design choices under uncertainty, not just as stylistic strictness labels.
- `governance_pressure` becomes the pressure to increase coordination, reporting, or branch isolation when uncertainty and conflict exceed the current information-processing capacity.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving a principled interpretation of the 聚散离合 control axes.
- **Refines Phase 2** by supporting the “global homogeneity, local heterogeneity” rule through self-contained task design.
- **Rejects** any one-dimensional policy model where stronger governance means only “more approval” rather than changing the organization’s information-processing structure.

#### Finding 3: `synthesize` should be governed by compositional convergence criteria, not by arbitrary merge
The LMCS paper is valuable because it pushes beyond plain confluence and into criteria that are explicitly composable with other criteria. For dp-ring, that is the right lens for `composability`: the question is not merely whether two branches differ, but whether their interaction can be shown to compose under explicit conflict-handling rules.

Implication for dp-ring:
- `synthesize` should require a conflict summary and an explicit compatibility rationale, not just a human or model deciding to combine branches because the outputs “look mergeable.”
- `composability` should be treated as a first-class branch metric tied to expected conflict structure, not as a vague synonym for similarity.
- `adopt` and `synthesize` should remain distinct:
  - use **adopt** when one branch supersedes another cleanly
  - use **synthesize** when multiple branches can be combined under an explicit convergence story with typed provenance
- This further supports tree-first governance: synthesis creates a new checkpoint with auditable inputs rather than flattening branches into unrestricted graph rewrites.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making branch operations more like guarded rewrite moves with explicit convergence obligations.
- **Refines Phase 1** by sharpening the meaning of `composability` and by suggesting a future `synthesize_readiness` gate.
- **Rejects** any architecture where branch merge is mainly informal, ad hoc, or hidden inside a strong model’s undocumented judgment.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by the combination of blackboard-style data-directed control, information-processing governance, and compositional convergence. The kernel now looks more clearly like an external-truth control shell that modulates coordination structure and enforces guarded branch synthesis.
- **Phase 2 / Heterogeneous node ecology** is strengthened by the self-contained-task interpretation: nodes should remain locally rich and locally complete where possible, while cross-node interaction stays typed and governance-visible.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define the checkpoint tree plus artifact store as the governed blackboard
- make publication classes explicit: hypothesis, evidence, advisory signal, durable commitment
- interpret `workflow_tightness` / `oversight_strength` as information-processing policy knobs under uncertainty
- make `synthesize` conditional on explicit branch-composability / convergence evidence
- keep typed lateral relations available, but secondary to the tree and never a substitute for governed checkpoint operations

Phase 2 should now be read more precisely as:
- design nodes as self-contained task capsules whenever possible
- keep local planning, retrieval, verification, and prompt internals inside the node boundary
- export only tree-facing outputs, evidence refs, health summaries, and governance-relevant metadata
- use typed cross-node references only when the information-processing benefit is clear and auditable

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources tighten their meaning:
- `divergence`: not just textual difference, but conflict between branch hypothesis/evidence structures on the blackboard
- `composability`: expected ease of constructing an auditable convergence story for `synthesize` without unresolved critical conflicts
- `effective_force`: net progress after accounting for uncertainty reduction, coordination cost, and whether the branch remains self-contained
- `governance_pressure`: pressure to increase information-processing capacity via tighter oversight, better summaries, more isolation, or stronger coordination mechanisms

### Recommended next research slice
The next pass should focus on the seam this research exposed most clearly:

1. **branch publication and evidence-state taxonomy**
   - sharpen the blackboard-facing classes: hypothesis, evidence, claim, commitment, and synthesis input
   - define which classes are local-only versus globally journaled
2. **branch composability / synthesize-readiness criteria**
   - research concrete confluence, conflict, or compatibility tests that can be approximated for checkpoint branches
   - turn `composability` into something that can be scored and audited before `synthesize`
3. **information-processing policy table for 聚散离合**
   - map uncertainty/conflict/load signals to `tighten / loosen / isolate / escalate / adopt / synthesize`
   - make explicit which moves add slack, which increase reporting, and which reduce coordination surface

## 2026-04-18 22:31 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/workflow-run.schema.json` already carry `evidence_refs`, `branch_event_ids`, `last_accepted_evidence_refs`, replay state, and journals.
- `.ring/schemas/branch-event.schema.json` already records coarse lineage operations (`checkpoint_created`, `branch_forked`, `branch_adopted`, `branch_discarded`, `checkpoint_synthesized`) but still uses a largely generic `details` object.
- `.ring/schemas/node.schema.json` already requires an `evidence_schema` and allows `contract_projection`, so the node-facing substrate is ready for richer published provenance without leaking local internals.
- The missing gap is now clearer at the semantics layer: dp-ring still lacks an explicit publication/provenance/context model beyond raw `evidence_refs`, coarse branch events, and lineage/adoption fields.

### Sources reviewed

1. W3C, “PROV-DM: The PROV Data Model”
   - Official source URL: https://www.w3.org/TR/prov-dm/
   - Access note: direct official W3C page was reachable.
   - Key evidence: the abstract says provenance is information about “entities, activities, and people” that can support assessments of “quality, reliability or trustworthiness,” and says PROV-DM includes derivations, agents, and “a notion of bundle, a mechanism to support provenance of provenance.”

2. Oskar Dressler, “Assumption-based Truth Maintenance”
   - Primary source URL: https://doi.org/10.1007/978-3-642-73385-7_3
   - Direct official abstract page used: https://link.springer.com/chapter/10.1007/978-3-642-73385-7_3
   - Access note: direct Springer abstract page was reachable.
   - Key evidence: the abstract says TMS separated domain rules from search-state recording, and that ATMS “introduced the capability to handle multiple contexts simultaneously.”

3. David Gelernter, “Generative communication in Linda”
   - Primary source URL: https://doi.org/10.1145/2363.2433
   - Fallback source used for abstract-level evidence after direct page block: https://api.crossref.org/works/10.1145/2363.2433
   - Access note: the official ACM page was blocked by Cloudflare bot protection (`Just a moment...`), so Crossref abstract metadata was used as the primary-source fallback.
   - Key evidence: the abstract says messages are added in “tuple-structured form to the computation environment,” where they exist as “named, independent entities” until received, and that Linda is distributed in both space and time.

### Findings

#### Finding 1: PROV-style provenance should become dp-ring’s publication vocabulary, not just an annotation layer
PROV-DM is useful here because it is not just “add metadata.” It frames provenance as the basis for assessing trustworthiness and decomposes it into a small set of roles: entities, activities, agents, derivations, and bundles. That is exactly the kind of vocabulary dp-ring currently lacks between raw `evidence_refs` and full tree-level commitments.

Implication for dp-ring:
- `evidence_refs` are directionally correct but too thin as the long-term publication model.
- Durable publications should carry at least a PROV-like story: what entity was produced, by what activity, under whose responsibility, derived from which prior entities/evidence.
- `adopt` and `synthesize` should emit provenance bundles that explain not only the result checkpoint, but the provenance of the decision package itself.
- Rich nodes such as RAG-like advisors should export provenance-bearing outputs and derivation summaries rather than exposing local retrieval internals.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the governed blackboard into a provenance-aware publication layer.
- **Refines Phase 2** by making provenance-bearing outputs a hard requirement for rich nodes under one outer contract.
- **Rejects** any plan where opaque `details` blobs or bare evidence pointers are treated as sufficient system truth.

Repo-specific consequence:
- The current checkpoint/workflow-run/node schemas already have the hook points (`evidence_refs`, `last_accepted_evidence_refs`, `evidence_schema`).
- The next missing step is not more storage fields; it is a docs-level publication/provenance spec that defines what those fields actually mean.

#### Finding 2: ATMS suggests checkpoint branches should be treated as simultaneous contexts with support sets, not only lineage labels
Dressler’s ATMS abstract is the strongest source in this pass for branch semantics. The key point is not merely “keep a consistent database.” ATMS extends that model to multiple contexts at once. That maps closely to dp-ring’s branch structure and gives a better lens for branch validity, isolation, and synthesis than lineage alone.

Implication for dp-ring:
- A branch should eventually be describable as a context with assumptions, justifications, and support, not just a `branch_id` plus `adoption_status`.
- `divergence` should partly measure support-set or assumption conflict, not only surface output difference.
- `composability` can be reframed as whether two contexts can be combined into a justified derived context without unresolved support conflicts.
- `discard` / `isolate` start to look like context quarantine or retraction moves; `adopt` becomes commitment of a sufficiently supported context into the mainline.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding branch governance in explicit context management rather than only lineage operations.
- **Refines Phase 1** by giving sharper semantics to `divergence`, `composability`, and future `synthesize` guards.
- **Rejects** any Phase 1 design where synthesis is based mainly on surface similarity or where all branches are treated as one undifferentiated consistency space.

Repo-specific consequence:
- The current schemas track lineage, replay, and branch events, but they do not yet encode assumptions, justifications, or support sets.
- That missing context layer now looks like the most important semantic gap behind branch metrics.

#### Finding 3: Linda reinforces environment-mediated coordination, but dp-ring should adapt it under tree-first governance
Linda matters because it gives a crisp coordination primitive: named independent tuples live in a shared computation environment until consumed. That is a strong stigmergic / blackboard analogue for dp-ring. But the adaptation matters: dp-ring should borrow the environment-mediated coordination idea without turning the whole architecture into an unconstrained tuple space.

Implication for dp-ring:
- The blackboard-facing API should prefer publish/query/acknowledge/commit semantics over direct agent-to-agent coupling.
- Useful publication classes now look clearer: hypothesis publication, evidence publication, advisory signal, durable commitment, synthesis proposal.
- Not every publication should immediately mutate checkpoint state; exploratory or advisory publications can remain blackboard-visible without becoming durable tree transitions yet.
- The checkpoint tree must remain the primary governance structure; tuple-like publications should attach to checkpoints/branches as typed artifacts, not replace the tree with a free-form shared graph.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by reinforcing stigmergic / blackboard coordination under a governed substrate.
- **Refines Phase 1** by suggesting a publication API beneath node capsules and above raw artifact storage.
- **Rejects** both direct agent-to-agent conversational coupling as the main coordination model and unrestricted free-space mutation as the global structure.

Repo-specific consequence:
- The current `branch-event` schema is already append-only, but its event taxonomy is still too coarse to separate publication classes from durable branch-commit events.
- A future spec should distinguish observational/advisory publications from tracked checkpoint-mutating commitments.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. The biggest effect is to sharpen the semantic content of Phase 1.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by the combination of PROV-style provenance, ATMS-style context management, and Linda-style environment-mediated publication. The kernel now looks more clearly like a provenance-aware blackboard with explicit context and commitment semantics.
- **Phase 2 / Heterogeneous node ecology** is strengthened by the requirement that rich local nodes publish derivation/provenance-aware outputs while keeping local internals encapsulated behind `contract_projection`.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a branch publication taxonomy such as `hypothesis`, `evidence`, `derived_claim`, `advisory_signal`, `commitment`, and `synthesis_bundle`
- attach PROV-like roles to durable publications: entity, activity, agent, derivation, and bundle
- model branches as explicit contexts/support sets rather than lineage labels alone
- keep checkpoint-tree mutation as a validated commitment path while allowing non-mutating publications to accumulate on the governed blackboard
- make branch metrics partly about support/conflict/provenance quality, not only output resemblance

Phase 2 should now be read more precisely as:
- require rich nodes to emit provenance-bearing outputs and evidence schemas
- keep local retrieval/planning/verification internals hidden unless deliberately summarized
- use provenance bundles for supervisor-facing synthesis/adoption explanations
- preserve the current node-centered rule: local richness, global semantic simplicity

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources tighten their meaning:
- `divergence`: conflict between branch support sets, derivation paths, or evidence bundles relative to the current mainline
- `composability`: ability to produce a justified merged context / provenance bundle without unresolved support conflicts
- `effective_force`: net forward usefulness after weighting support stability, derivation quality, uncertainty reduction, and publication quality
- `governance_pressure`: pressure to tighten oversight when support weakens, provenance gaps appear, or publication backlog exceeds safe commitment capacity

### Recommended next research slice
The next pass should turn this seam into a more concrete spec:

1. **PROV-aligned branch publication / provenance-bundle spec**
   - map checkpoint outputs and branch events to entity/activity/agent/derivation/bundle shapes
   - decide the minimal durable fields versus node-local-only details
2. **ATMS-inspired context/support model for branches**
   - define assumptions, justifications, support sets, and retraction/isolation semantics for checkpoint branches
   - use that model to sharpen `divergence`, `composability`, and `synthesize` guards
3. **Blackboard operation table under tree-first governance**
   - specify which publications are query-like or observational, which are advisory, and which are durable commitments that can mutate tree state
   - keep tuple-like environment mediation subordinate to checkpoint-tree invariants

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `publication / provenance / context` spec before expanding runtime branch heuristics or adding more node varieties
- keep the current checkpoint/tree/node substrate and refine semantics instead of broadening artifact sprawl
- make future `branch-event` work narrower and stronger: separate publication classes from commitment events
- keep the first rich-node proof scoped to provenance-bearing outputs, not shared retrieval infrastructure

## 2026-04-18 23:45 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `.ring/schemas/branch-event.schema.json` still records coarse lineage operations under `event_type` but keeps most semantics inside a generic `details` object.
- `.ring/schemas/node.schema.json` already has the right outer shell for node-centered governance (`evidence_schema`, `checkpoint_policy`, `governance_profile.escalation_policy`, `runtime.boundary_mode`, capsule replay/journal state).
- `checkpoint.schema.json`, `workflow-run.schema.json`, and `node.schema.json` still expose evidence refs and replay state, but local repo search still finds no first-class `assumption`, `justification`, `support_set`, `hypothesis`, `derived_claim`, `advisory_signal`, `commitment`, or `synthesis_bundle` vocabulary in `.ring/schemas/*.json`.
- The semantic gap is therefore narrower and clearer: dp-ring has lineage/replay substrate, but not yet an explicit assumption ledger, attack/support model, or declarative constraint shell for 聚散离合 policy.

### Sources reviewed

1. James A. Dewar, *Assumption-Based Planning: A Tool for Reducing Avoidable Surprises*
   - Official source URL: https://www.cambridge.org/core/product/identifier/9780511606472/type/book
   - Direct official page used: https://www.cambridge.org/core/books/assumptionbased-planning/CEB920081B04403472F14DD77E66E2C9
   - Access note: the official Cambridge page was directly reachable in terminal; evidence was extracted from the official `citation_abstract` / book blurb metadata and cross-checked against Crossref metadata.
   - Key evidence: the official page says ABP identifies “the assumptions underlying the plans of an organization,” surfaces “vulnerable, crucial assumptions,” and includes “steps for monitoring all the vulnerable assumptions of a plan” plus actions to control them or prepare for their failure.

2. Dorian Gaertner and Francesca Toni, “Computing Arguments and Attacks in Assumption-Based Argumentation”
   - Official source URL: https://doi.org/10.1109/MIS.2007.105
   - Readable fallback used after direct discovery: https://r.jina.ai/http://ieeexplore.ieee.org/document/4397207/
   - Access note: IEEE Xplore content was easier to read through the `r.jina.ai` mirror.
   - Key evidence: the abstract says assumption-based argumentation “defines [arguments] as backward deductions ... supported by sets of assumptions” and “reduces the notion of an attack against an argument to that of deduction of a contrary of an assumption.”

3. Maja Pesic, Helen Schonenberg, Wil M.P. van der Aalst, “DECLARE: Full Support for Loosely-Structured Processes”
   - Official source URL: https://doi.org/10.1109/EDOC.2007.14
   - Readable fallback used after direct IEEE block: https://r.jina.ai/http://ieeexplore.ieee.org/document/4384001/
   - Access note: direct IEEE requests returned an anti-bot `418`; the `r.jina.ai` mirror exposed the official IEEE abstract text.
   - Key evidence: the abstract says traditional WFMSs are “not flexible enough to support loosely-structured processes,” and that DECLARE uses “a constraint-based process modeling language” to support such processes “without sacrificing” user support, model verification, analysis of past executions, and changing models at run-time.

### Findings

#### Finding 1: Assumption ledgers should become a first-class branch semantic, not just an implementation detail hidden inside prompts
Dewar is valuable because it turns a vague “branch context” idea into something operational: plans should expose their assumptions, identify which assumptions are vulnerable, monitor them, and prepare control actions when they fail. That maps almost directly onto dp-ring’s unresolved branch/context seam.

Implication for dp-ring:
- A checkpoint branch should eventually carry an explicit assumption surface: the assumptions it is relying on, which of them are vulnerable, and what observations would count as assumption failure.
- `governance_pressure` should partly measure assumption fragility and monitoring backlog, not only failure count or replay count.
- `divergence` should partly mean divergence in assumption sets and failure expectations, not just output/content mismatch.
- `discard`, `isolate`, `tighten`, or `escalate` should be explainable in terms of assumption stress: e.g. assumptions weakened, assumptions contradicted, monitoring unresolved, contingency required.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making branch context concrete: contexts are not just lineage labels but governed bundles of assumptions and monitors.
- **Refines Phase 1** by implying that branch metrics need an assumption-risk component.
- **Rejects** any design where branches are compared only by output similarity while hidden assumptions remain implicit.

Repo-specific consequence:
- The current schemas already have places for evidence and replay, but there is still no first-class assumption ledger in `.ring/schemas/*.json`.
- The next docs-level spec should define durable branch assumptions, vulnerable-assumption monitors, and assumption-failure consequences before more heuristics are added.

#### Finding 2: Branch conflict and synthesis should be modeled as support/attack relations over assumptions
Gaertner and Toni sharpen the ATMS line by giving a very crisp semantic unit: arguments are deductions supported by assumptions, and attacks are deductions of contraries to those assumptions. For dp-ring, that is a much better kernel language for `divergence`, `composability`, `adopt`, and `synthesize` than vague branch similarity.

Implication for dp-ring:
- A branch should be describable as at least a provisional support set: assumptions, derived claims, and attacks/counterevidence against those assumptions.
- `divergence` should partly score support-set conflict or contrary relations between branches and the current mainline.
- `composability` should partly mean whether two branches can be combined without unresolved attacks on each other’s assumption base.
- `adopt` should mean that one branch’s supported claims are accepted into mainline under current attack/support conditions.
- `synthesize` should create a new checkpoint with explicit provenance and support rationale, not flatten two branches together because they look compatible at the surface.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving a formal conflict model underneath checkpoint-tree governance.
- **Refines Phase 1** by suggesting that branch events need support/attack payloads, not just coarse lineage event names.
- **Strengthens Phase 2** because rich nodes can remain locally heterogeneous as long as they project outward into a common support/attack vocabulary.
- **Rejects** free-form synthesis or adoption driven mainly by opaque model judgment.

Repo-specific consequence:
- The current `branch-event` schema is too coarse for this line: `event_type` exists, but `details` does not yet force assumption/support/attack structure.
- A future docs spec should probably define branch-event subclasses or typed payloads for assumption publication, contrary detection, defended acceptance, and synthesis rationale.

#### Finding 3: `workflow_tightness` should be interpreted as a declarative constraint envelope, not as an informal strictness knob
DECLARE matters because it shows that loosely structured work can still be formally governed through constraints, verification, run-history analysis, and even runtime model change. That is very close to what dp-ring needs for 聚散离合: tightness should mean the active constraint shell around branch behavior, not just “the supervisor is stricter now.”

Implication for dp-ring:
- `workflow_tightness` should eventually map to a set of active declarative constraints or required acknowledgements, not just a label stored in policy snapshots.
- `loosen` / `tighten` should be explicit governance moves that change allowed branch actions, review gates, or publication requirements.
- `oversight_strength` should determine which constraints require synchronous commitment (`update`-like) versus advisory or asynchronous signaling.
- Branch replay and audit should be able to explain which constraints were active when a branch continued, forked, escalated, or synthesized.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making governance policy more like a constraint system than a pile of special-case if-statements.
- **Refines Phase 1** by giving operational content to 聚散离合: loose vs tight is partly a change in permitted/required constraints.
- **Rejects** any path where loosely structured exploration means abandoning formal verification or auditable policy.

Repo-specific consequence:
- Current code and schemas already preserve policy snapshots, but they do not yet define the actual declarative constraint vocabulary behind those snapshots.
- The next docs-level kernel artifact should include a constraint table or policy matrix tying `workflow_tightness × oversight_strength × branch state` to allowed branch operations and required evidence/acknowledgement.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. It narrows the unresolved Phase 1 gap much further.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by adding three sharper layers beneath the existing checkpoint tree: assumption ledgers, support/attack semantics, and declarative constraint envelopes.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can stay locally diverse if they export governed assumptions, evidence, and support/conflict summaries rather than raw internals.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define branch contexts as explicit assumption bundles with vulnerability/monitoring semantics
- define support/attack semantics so adoption and synthesis become defended, auditable moves
- interpret `workflow_tightness` as active declarative constraints rather than a vague strictness label
- make `tighten / loosen / isolate / escalate / adopt / synthesize` explicit policy actions over assumptions, attacks, and constraints
- keep the checkpoint tree primary while attaching assumption/support/constraint artifacts to checkpoints and branch events

Phase 2 should now be read more precisely as:
- require rich nodes to publish outward-facing assumptions, evidence, and support/conflict summaries when governance needs them
- keep local retrieval/planning/verification internals encapsulated behind node boundaries
- prove one RAG-like advisor node only after the Phase 1 assumption/support/constraint vocabulary is stable enough to govern it cleanly

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources tighten their meaning:
- `divergence`: conflict between branch assumption sets, support relations, or active constraint footprints relative to mainline
- `composability`: ability to construct a defended combined support set without unresolved attacks or constraint incompatibilities
- `effective_force`: net branch usefulness after accounting for progress, assumption stability, attack pressure, and constraint overhead
- `governance_pressure`: pressure to intervene because assumptions are vulnerable, attacks are unresolved, or the current constraint shell is too loose/tight for safe continuation

### Recommended next research slice
The next pass should convert this into a concrete kernel-facing spec:

1. **assumption / support-set branch spec**
   - define durable fields for branch assumptions, vulnerable assumptions, monitors, contraries, and defended claims
   - decide what remains node-local versus what must be published to the checkpoint tree / artifact layer
2. **branch-event typed payload table**
   - separate coarse lineage moves from assumption publication, support update, attack detection, defended acceptance, and synthesis rationale
   - replace generic `details` blobs with stronger typed event payload classes at the spec level
3. **declarative constraint policy table for 聚散离合**
   - define what `workflow_tightness` actually changes: allowed moves, required acknowledgements, evidence thresholds, supervisor gates, and replay expectations
   - connect `oversight_strength` to advisory vs commit-style governance moves

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `assumptions / support / constraints` spec before adding more runtime heuristics or more node varieties
- treat assumption vulnerability and attack/support structure as the next missing semantic layer behind branch metrics
- keep `workflow_tightness` / `oversight_strength` in the mainline, but stop treating them as sufficiently specified until a declarative constraint table exists
- narrow future `branch-event` work toward typed governance payloads instead of expanding generic `details`
- keep the first rich-node proof downstream of this kernel vocabulary so Phase 2 proves local-rich/global-clean boundaries rather than compensating for an underspecified governance model

## 2026-04-19 00:56 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `.ring/schemas/branch-event.schema.json` still models branch events as a coarse `event_type` plus a permissive `details` object, so publication classes, commitment classes, and validation obligations remain underspecified.
- `ring/lib/governance-policy.mjs` still derives constrained governance mainly from `adoption_status`, `workflow_tightness`, `oversight_strength`, and `branch_budget`, but does not yet compile those knobs into explicit guard, obligation, enable, or disable semantics.
- The next kernel gap is therefore sharper than “add more policy fields”: dp-ring needs a declarative governance shell that can say what counts as a valid publication, what actions are currently enabled or blocked, what obligations are now pending, and what milestones have been semantically achieved.

### Sources reviewed

1. W3C, “Constraints of the PROV Data Model”
   - Official source URL: https://www.w3.org/TR/prov-constraints/
   - Access note: direct official W3C page was reachable.
   - Key evidence: the abstract says the document defines “valid PROV instances,” and that validation ensures a PROV instance represents “a consistent history of objects and their interactions” that is safe for “logical reasoning and other kinds of analysis.” It also says validity and equivalence are defined for PROV bundles and documents.

2. Thomas T. Hildebrandt and Raghava Rao Mukkamala, “Declarative Event-Based Workflow as Distributed Dynamic Condition Response Graphs”
   - Primary source URL: https://arxiv.org/abs/1110.4161v1
   - Related publication DOI: https://doi.org/10.4204/EPTCS.69.5
   - Access note: the official author-hosted arXiv abstract page was directly reachable.
   - Key evidence: the abstract says a DCR graph is “a directed graph with nodes representing the events that can happen and arrows representing four relations between events: condition, response, include, and exclude.”

3. Richard Hull et al., “Introducing the Guard-Stage-Milestone Approach for Specifying Business Entity Lifecycles”
   - Official source URL: https://link.springer.com/chapter/10.1007/978-3-642-19589-1_1
   - DOI: https://doi.org/10.1007/978-3-642-19589-1_1
   - Access note: the official Springer abstract page was directly reachable.
   - Key evidence: the abstract says GSM lifecycles are “substantially more declarative” than finite-state variants, “support hierarchy and parallelism within a single entity instance,” and have operational semantics based on Event-Condition-Action rules that “provide a basis for formal verification and reasoning.”

### Findings

#### Finding 1: Branch publications need validity and equivalence rules, not just richer provenance blobs
PROV-CONSTRAINTS is valuable because it moves the provenance discussion from “capture more metadata” to “define which provenance packages are valid, comparable, and safe for reasoning.” dp-ring already has `evidence_refs`, journals, and branch events, but it still lacks a declarative standard for when a publication or synthesis package is well-formed enough to drive governance.

Implication for dp-ring:
- A branch publication should not become governance-relevant merely because a node emitted it.
- `adopt` and `synthesize` should eventually produce named provenance bundles with validity checks and equivalence/normalization semantics.
- A future publication spec should distinguish between:
  - locally useful node output
  - blackboard-visible publication
  - governance-committable bundle
- This helps keep local-rich nodes compatible with a globally simple governance substrate.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the governance kernel into a provenance-validating publication layer rather than a raw artifact sink.
- **Refines Phase 2** by implying that rich nodes must emit validatable publication bundles, not only opaque summaries or bare references.
- **Rejects** any plan where a generic `details` blob or unvalidated evidence list is treated as sufficient system truth.

Repo-specific consequence:
- `branch-event.schema.json` currently has nowhere to express publication validity, equivalence, or provenance-bundle shape beyond ad hoc `details`.
- The next docs-level artifact should define publication classes and bundle-level validity before schema expansion.

#### Finding 2: `workflow_tightness` should compile into explicit dynamic constraints, not remain a scalar policy label
The DCR result is strong because it gives a small, operational vocabulary for declarative governance: condition, response, include, and exclude. That is much closer to what dp-ring needs than treating tightness or oversight as informal settings.

Implication for dp-ring:
- Governance policy should be able to express at least four distinct effects:
  - **condition**: what must already hold before a branch move or publication is allowed
  - **response**: what follow-up obligation becomes pending after a move occurs
  - **include**: what actions or publication classes become enabled
  - **exclude**: what actions or branch paths become temporarily or durably disabled
- `tighten`, `loosen`, and `isolate` can then be modeled as changes to enabled/obligated/blocked moves, not as narrative labels.
- This makes the 聚散离合 control model more concrete:
  - 散 increases inclusion and relaxes conditions
  - 聚 increases response obligations and gating conditions
  - 离 adds exclusions or localizes obligations
  - 合 requires a guarded re-entry path, not informal merge approval

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the governance kernel an explicit declarative control vocabulary.
- **Refines Phase 1** by making branch metrics depend on pending obligations, unmet conditions, enabled moves, and exclusions rather than on output similarity alone.
- **Rejects** any design where `workflow_tightness` remains a vague strictness knob with no corresponding semantics for branch actions.

Repo-specific consequence:
- `ring/lib/governance-policy.mjs` currently interprets constrained state through a few scalar fields, but not through an explicit action-constraint shell.
- The next kernel-facing spec should map policy settings to allowed operations, required acknowledgements, pending obligations, and exclusion/isolation effects.

#### Finding 3: Checkpoints and branches should expose guarded lifecycle progression with milestones
GSM is useful because it frames a governed entity as having both an information model and a lifecycle model. That is a strong fit for dp-ring if checkpoints or branches are treated as semantic entities rather than just inert lineage records.

Implication for dp-ring:
- A checkpoint branch can be treated as an entity with:
  - an information surface (assumptions, evidence refs, provenance bundles, policy snapshot)
  - a lifecycle surface (guards, active stages, achieved milestones, pending obligations)
- `continue`, `fork`, `adopt`, `discard`, `synthesize`, and `escalate` should eventually be explainable as guarded stage transitions or milestone achievements.
- Milestones give a cleaner meaning to semantic progress than raw status strings alone.
- Hierarchy and parallelism fit the tree-first model well: the global tree stays simple while local stages inside a branch or node can remain richer.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by suggesting that checkpoint-tree progression should be guardable and milestone-based rather than only event-listed.
- **Refines Phase 3** by implying that future read models and operator surfaces should project milestone/state views out of stable kernel semantics.
- **Rejects** both a flat finite-state interpretation of branch progress and free-form status accumulation without explicit lifecycle meaning.

Repo-specific consequence:
- Existing `adoption_status`, replay state, and branch events are directionally useful, but they remain too coarse to express guard/stage/milestone semantics.
- A docs-level lifecycle sketch should precede broadening runtime status vocabulary.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. Its main effect is to make the missing Phase 1 semantics more operational.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by a clearer three-layer control shell:
  1. provenance-valid publications and bundles
  2. declarative action constraints (`condition / response / include / exclude`)
  3. guarded lifecycle progress (`guard / stage / milestone`)
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can remain locally heterogeneous if they publish validatable bundles and governance-relevant lifecycle signals instead of leaking internals.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a publication layer with validity/equivalence rules for provenance-bearing bundles
- compile `workflow_tightness` / `oversight_strength` into explicit declarative governance constraints
- define checkpoint and branch progression through guards, active stages, pending obligations, and milestones
- make `continue / fork / tighten / loosen / isolate / escalate / adopt / synthesize` explicit policy actions over that constraint shell
- tie branch metrics to valid publication quality, unmet conditions, pending responses, exclusions, and milestone progress

Phase 2 should now be read more precisely as:
- require rich nodes to export validatable bundles, governance-relevant obligations, and milestone/progress summaries when needed
- keep retrieval/planning/verification internals inside node boundaries
- use the rich-node proof to show local complexity can remain encapsulated while the global control shell stays simple and typed

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources tighten their meaning:
- `divergence`: mismatch between branch publication bundles, active conditions, pending responses, exclusions, or milestone trajectories relative to mainline
- `composability`: ability to combine branches without provenance invalidity, incompatible guards, contradictory obligations, or unresolved exclusions
- `effective_force`: net usefulness of a branch after weighting milestone progress against pending obligations, blocked transitions, and validation debt
- `governance_pressure`: pressure to intervene because conditions are unmet, responses are piling up, exclusions are increasing, or publication validity is too weak for safe commitment

### Recommended next research slice
The next pass should connect these declarative control findings back to the still-open assumption/support seam:

1. **assumption/support overlay on publication bundles**
   - define how assumptions, contraries, defended claims, and vulnerable assumptions attach to provenance-valid branch publications
   - decide what remains node-local versus what must be blackboard-visible
2. **typed branch-event payload table for declarative governance**
   - separate publication, obligation update, guard opening/closing, milestone achievement, exclusion/isolation, and commitment events
   - replace generic `details` blobs with a small set of stronger typed payload classes at the spec level
3. **DCR/GSM-inspired policy matrix for 聚散离合**
   - map `workflow_tightness × oversight_strength × branch metrics` to condition/response/include/exclude effects and guard/stage/milestone transitions
   - make explicit when the system should continue, fork, tighten, loosen, isolate, escalate, adopt, or synthesize

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `publication validity / declarative constraints / lifecycle` spec before further runtime branching heuristics or node variety work
- stop treating `workflow_tightness` and `oversight_strength` as sufficiently specified until they compile into explicit action constraints
- narrow future `branch-event` work toward typed publication/obligation/milestone payloads instead of expanding generic `details`
- keep the first rich-node proof downstream of this control shell so Phase 2 demonstrates local-rich/global-clean boundaries on top of a stronger kernel

## 2026-04-19 02:04 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `.ring/schemas/branch-event.schema.json` still models branch events as a coarse `event_type` plus a permissive `details` object, so publication class, validation outcome, and commitment semantics are still underspecified.
- `ring/lib/governance-policy.mjs` still derives constrained governance mostly from `adoption_status`, `workflow_tightness`, `oversight_strength`, and `branch_budget`, but does not yet expose a first-class permission / prohibition / duty / constraint algebra.
- Repo search across `ring/` and `.ring/schemas/` still finds no first-class `support_set`, `contrary`, `permission`, `prohibition`, `obligation`, or validation-report vocabulary; only incidental “operating assumptions” text appears in `ring/lib/loopback-runtime.mjs`.
- `.ring/schemas/node.schema.json` still has the right outer shell (`evidence_schema`, `governance_profile.escalation_policy`, `runtime.boundary_mode: contract_projection`), so the missing work remains semantic/kernel-level rather than a need to replace the node substrate.

### Sources reviewed

1. Phan Minh Dung, Robert A. Kowalski, Francesca Toni, “Assumption-Based Argumentation”
   - Official source URL: https://link.springer.com/chapter/10.1007/978-0-387-98197-0_10
   - DOI: https://doi.org/10.1007/978-0-387-98197-0_10
   - Access note: the official Springer page was directly reachable in browser automation.
   - Key evidence: the official preview says ABA was “developed, starting in the 90s, as a computational framework to reconcile and generalise most existing approaches to default reasoning,” and that it was inspired by the acceptability of negation-as-failure assumptions based on “no-evidence-to-the-contrary” together with abstract argumentation.

2. W3C, “ODRL Information Model 2.2”
   - Official source URL: https://www.w3.org/TR/odrl-model/
   - Access note: the official W3C Recommendation page was directly reachable.
   - Key evidence: the abstract says policies represent “permitted and prohibited actions” and “the obligations required to be meet by stakeholders,” and that policies may be limited by constraints while duties may be imposed on permissions.

3. W3C, “Shapes Constraint Language (SHACL)”
   - Official source URL: https://www.w3.org/TR/shacl/
   - Access note: the official W3C Recommendation page was directly reachable.
   - Key evidence: the abstract defines SHACL as “a language for validating RDF graphs against a set of conditions”; the official specification also includes explicit sections for “Declaring the Severity of a Shape” and “Validation Report,” and states that `sh:conforms` records whether validation produced any validation results.

### Findings

#### Finding 1: Branch governance should pivot from hidden prompt assumptions to explicit assumption acceptability and contrary handling
The ABA source is useful because it reframes branch reasoning around assumption acceptability rather than around output similarity. The important phrase is not just “default reasoning”; it is that the framework is grounded in assumptions and “no-evidence-to-the-contrary.” That pushes dp-ring toward a cleaner branch semantic: branches should expose what they assume, what would count against those assumptions, and why a branch remains acceptable under current evidence.

Implication for dp-ring:
- A branch should eventually publish an explicit assumption surface, not just artifacts and checkpoint lineage.
- `adopt`, `discard`, `isolate`, and `synthesize` should be explainable in terms of defended versus undermined assumptions, not merely stylistic supervisor preference.
- `divergence` should partly measure assumption/contrary conflict against mainline, not just surface mismatch of outputs.
- Rich nodes can stay locally heterogeneous as long as they project outward into this shared acceptability vocabulary.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the governance kernel a sharper semantic unit than lineage alone: acceptable versus challenged assumptions.
- **Refines Phase 1** by making branch metrics and branch-event payloads depend on explicit assumption/contrary state.
- **Rejects** any design where branches are compared mostly by artifact similarity while the assumption base remains implicit.

Repo-specific consequence:
- The next missing docs-level artifact looks less like “more provenance fields” and more like an explicit branch assumption ledger / contrary model.
- `branch-event` work should eventually be able to express assumption publication, challenge, defense, and defended acceptance rather than only coarse lineage moves.

#### Finding 2: `workflow_tightness` and `oversight_strength` need a policy algebra of permissions, prohibitions, duties, and constraints
ODRL is valuable because it gives a compact rule vocabulary that matches the kernel gap in the repo. dp-ring already stores policy labels, but ODRL shows that a serious governance shell needs to say what actions are permitted, what actions are prohibited, what obligations are now pending, and what constraints limit those rules.

Implication for dp-ring:
- `workflow_tightness` should eventually compile into an active permission/prohibition envelope over branch actions.
- `oversight_strength` should determine which duties or acknowledgements attach to allowed actions, such as supervisor review, explanation delivery, or evidence refresh before commitment.
- `continue / fork / tighten / loosen / isolate / escalate / adopt / synthesize` should become policy-evaluable actions rather than narrative labels.
- `governance_pressure` should partly reflect unmet duties, constraint pressure, and attempted moves that the current policy envelope would prohibit.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning governance into a typed rule system rather than a bag of scalar knobs.
- **Refines Phase 1** by suggesting a concrete control algebra for 聚散离合: permissions, prohibitions, duties, and constraints.
- **Rejects** any path where `workflow_tightness` remains a vague strictness label with no action-level semantics.

Repo-specific consequence:
- `ring/lib/governance-policy.mjs` is still directionally useful, but it now looks clearly like a pre-algebra placeholder.
- The next planning artifact should define a docs-level policy matrix that maps branch state and control settings to allowed moves, blocked moves, and newly created obligations.

#### Finding 3: Publication validity should be shape-checked and reported before branch commitments become authoritative
SHACL is helpful because it does not stop at “validate or not.” It defines conditions, severity classes, and explicit validation reports. That is exactly the missing middle layer between node-local output and governance-committable branch state.

Implication for dp-ring:
- Blackboard-visible publications should be validated against a shape/profile before they are allowed to drive `adopt`, `synthesize`, or strong escalation decisions.
- Validation should emit a structured report, not just a boolean flag: at minimum conformance, result severity, and result details/messages.
- `Info` / `Warning` / `Violation`-style distinctions give a better substrate for `governance_pressure` than generic “good/bad output” judgments.
- Rich nodes should publish contract projections that are shape-checkable without leaking local retrieval/planning internals.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making publication validity and commit-readiness auditable.
- **Refines Phase 2** by clarifying that rich nodes should export shape-valid contract projections rather than opaque blobs.
- **Rejects** any design where a generic `details` blob or a bare artifact ref is treated as sufficient evidence for durable branch commitment.

Repo-specific consequence:
- `branch-event.schema.json` should probably not absorb all validation semantics directly; it likely needs references to a separate publication/validation artifact or typed payload class.
- The next docs-level semantic layer should define publication profiles, validation outcomes, and how those outcomes gate branch operations.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. Its main effect is to tighten the missing Phase 1 kernel semantics around assumptions, policy rules, and validation.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by a clearer three-part semantic shell:
  1. explicit assumption acceptability / contrary handling
  2. permission-prohibition-duty-constraint policy algebra
  3. shape-based publication validation and reporting
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can remain locally rich if they publish assumption-aware, policy-aware, shape-valid contract projections instead of leaking internals.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a branch assumption ledger with contraries/challenges and defended acceptance semantics
- compile `workflow_tightness` and `oversight_strength` into explicit permissions, prohibitions, duties, and constraints over branch actions
- define publication profiles and validation reports that gate `adopt`, `synthesize`, and stronger escalation paths
- keep branch events focused on durable governance moves while linking them to separate publication/validation semantics
- tie branch metrics to assumption conflict, policy obligations, and validation severity rather than to output resemblance alone

Phase 2 should now be read more precisely as:
- prove that executor, verifier, and RAG-like advisor nodes can emit shape-valid contract projections under one node contract
- keep retrieval/planning/verification internals local while exporting only governance-relevant assumptions, evidence refs, validation outcomes, and health summaries
- use the rich-node proof to show local heterogeneity remains compatible with a simple global governance kernel

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources tighten their meaning:
- `divergence`: conflict between published assumptions/contraries, active policy envelopes, or validation outcomes relative to mainline
- `composability`: ability to combine branches without unresolved contrary attacks, incompatible policy constraints, or shape-validation failure in the synthesized publication bundle
- `effective_force`: net branch usefulness after discounting assumption fragility, pending duties, validation debt, and blocked/prohibited moves
- `governance_pressure`: pressure to intervene because assumptions are challenged, duties are unmet, prohibited actions are being approached, or validation severity is accumulating

### Recommended next research slice
The next pass should convert this into a more explicit kernel-facing spec:

1. **branch assumption ledger / contrary model**
   - define durable fields for assumptions, challenged assumptions, defended assumptions, contrary evidence, and defended-acceptance outcomes
   - decide what remains node-local versus what must be blackboard-visible
2. **policy algebra / governance matrix**
   - map `workflow_tightness × oversight_strength × branch metrics` to permissions, prohibitions, duties, and constraints over `continue / fork / tighten / loosen / isolate / escalate / adopt / synthesize`
   - make explicit which duties are advisory versus commit-blocking
3. **publication profile / validation report spec**
   - define publication classes, shape/profile checks, result severities, and conformance reporting
   - specify how validation outcomes gate commitment events and how they are referenced from branch history

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `assumption ledger / policy algebra / validation report` spec before adding more runtime heuristics or new node varieties
- keep the active mainline focus on **Phase 1** rather than drifting into product projection or Rust control-plane expansion
- narrow future `branch-event` work toward durable commitments that reference shaped publications and validation results instead of expanding generic `details`
- keep the first rich-node proof downstream of this kernel vocabulary so Phase 2 demonstrates local-rich/global-clean boundaries on top of a stronger governance shell

## 2026-04-19 03:20 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `ring/lib/orchestrator.mjs` now expose a scalar `governancePressureScore` / `governance_pressure_score`, but it is still derived only from `workflow_tightness`, `oversight_strength`, and `branch_budget` rather than from a richer policy decision algebra.
- `.ring/schemas/branch-event.schema.json` still models branch history as a coarse `event_type` plus permissive `details`, so durable policy-decision, obligation, and planning payloads remain underspecified.
- Repo search across `ring/lib/*.mjs` and `.ring/schemas/*.json` still finds no first-class `obligation`, `advice`, `hit_policy`, `discretionary`, `manual_activation`, or `required_rule` vocabulary.
- The repo therefore still lacks an explicit executable policy matrix and governed planning surface, even though the Phase 1 control knobs already exist.

### Sources reviewed

1. OASIS, “eXtensible Access Control Markup Language (XACML) Version 3.0”
   - Official source URL: https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html
   - Access note: the official HTML specification was directly reachable.
   - Key evidence: the standard lists combining algorithms including “Deny-overrides (Ordered and Unordered), Permit-overrides (Ordered and Unordered), First-applicable and Only-one-applicable”; it also states that resulting obligations “MUST be fulfilled by the PEP” while advice “may be safely ignored by the PEP.”

2. OMG, “Decision Model and Notation (DMN) Version 1.4”
   - Official source URL: https://www.omg.org/spec/DMN/1.4/PDF
   - Readable fallback used after direct page discovery: https://r.jina.ai/http://www.omg.org/spec/DMN/1.4/PDF
   - Access note: the official OMG PDF was directly reachable; `r.jina.ai` was used only to extract readable text from the official PDF.
   - Key evidence: the spec says the decision requirements level is a “Decision Requirements Graph (DRG)” drawn as a “Decision Requirements Diagram (DRD)”; it says “A decision service encapsulates the decision logic supporting a DRD”; it also says the “hit policy specifies what the result of the decision table is” for overlapping rules and defines `Unique`, `Priority`, `First`, `Collect`, `Output order`, and `Rule order` semantics.

3. OMG, “Case Management Model and Notation (CMMN) Version 1.1”
   - Official source URL: https://www.omg.org/spec/CMMN/1.1/PDF
   - Readable fallback used after direct page discovery: https://r.jina.ai/http://www.omg.org/spec/CMMN/1.1/PDF
   - Access note: the official OMG PDF was directly reachable; `r.jina.ai` was used only to extract readable text from the official PDF.
   - Key evidence: the spec says “Planning is a run-time effort”; “Users (Case workers) are said to ‘plan’ ... when they select DiscretionaryItems from a PlanningTable”; role authorizations and `ApplicabilityRules` dynamically control what is exposed for planning; `ManualActivationRule` can force a task or stage to “wait for manual activation”; and `RequiredRule` can make a task, stage, or milestone required before its containing stage can complete.

### Findings

#### Finding 1: The governance kernel needs combining semantics plus a hard-duty / soft-advice split
XACML sharpens the policy algebra gap in dp-ring beyond the already useful ODRL-style permission/prohibition vocabulary. It says a policy system needs not only action-level decisions, but also explicit combining semantics when multiple rules apply, plus a distinction between obligations that must be discharged and advice that may safely be ignored.

Implication for dp-ring:
- `workflow_tightness`, `oversight_strength`, assumption conflict, validation severity, and supervisor input should not collapse into one scalar score.
- The governance kernel needs a policy result object that can say:
  - which action wins when multiple candidates apply
  - which duties become commit-blocking obligations
  - which recommendations remain advisory
  - what happened when no rule cleanly applies or inputs remain indeterminate
- `governance_pressure` should partly reflect unresolved obligation load, decision ambiguity, and policy conflict rather than only inherited strictness and branch-budget pressure.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making policy algebra operational instead of merely descriptive.
- **Refines Phase 1** by adding combining semantics and an obligations/advice split to 聚散离合 control.
- **Rejects** any Phase 1 design where governance remains a single strictness score with no explicit rule-resolution semantics.

Repo-specific consequence:
- The current `governancePressureScore` looks more clearly like a placeholder heuristic than a stable kernel abstraction.
- The next docs-level semantic layer should define policy decisions, combining traces, obligations, advice, and indeterminate / no-applicable outcomes before more runtime heuristics are added.

#### Finding 2: Governance rules should compile into auditable decision tables and decision services, not implicit branch logic
DMN is valuable because it supplies two things dp-ring now needs at the same time: a decision-requirements graph for structuring governance dependencies and decision-table hit policies for making policy selection auditable. The most useful line is not just “decision tables exist”; it is that DMN treats decisions as a structured graph and makes overlap handling explicit.

Implication for dp-ring:
- `workflow_tightness × oversight_strength × branch metrics × validation/assumption state` should eventually compile into a small governance DRG rather than into scattered if/else logic.
- A governance “decision service” can cleanly encapsulate side-effect-free policy evaluation over blackboard-visible inputs before any checkpoint mutation occurs.
- Hit policies provide a practical vocabulary for branch governance:
  - `Unique` for cases where only one action should be legal
  - `Priority` for resolving multiple valid moves by an explicit precedence order
  - `Collect` for advisory accumulation without immediate commitment
  - `First` as an order-sensitive escape hatch that should be used sparingly because the DMN spec itself warns it is hard to validate and should be used with care
- `adopt`, `synthesize`, `tighten`, `loosen`, `isolate`, and `escalate` should become explicit outputs of such policy tables, not ambient operator intuition.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the governance kernel an executable-spec style for policy selection.
- **Refines Phase 1** by suggesting a DRG/decision-table form for the future policy matrix.
- **Rejects** any design where durable governance moves are chosen mainly by prompt ordering or hidden branch-specific heuristics.

Repo-specific consequence:
- The repo still has policy knobs, but not a durable decision-table or decision-service layer.
- The next planning artifact should probably define a docs-level governance decision record: inputs considered, hit/selection policy, chosen action, rejected alternatives, and resulting duties/advice.

#### Finding 3: Branches need a governed planning surface with discretionary work, applicability gating, and manual/required controls
CMMN is useful because it adds a missing operational middle layer between policy evaluation and checkpoint mutation: governed run-time planning. It does not merely say that cases have stages; it says planning is a run-time effort, that workers choose discretionary items from planning tables, that exposure can be gated by roles and applicability rules, and that manual-activation versus required-completion are separate controls.

Implication for dp-ring:
- A branch or node should eventually expose a governed planning surface, not just a binary “continue or stop” outcome.
- `loosen` can mean exposing more discretionary options for local exploration; `tighten` can mean reducing the planning surface or forcing more work through manual activation / required review.
- Supervisor intervention can be modeled as making certain discretionary items visible, authorized, or mandatory rather than as free-form chat state.
- Entry/exit criteria and sentry-style gating strengthen the idea that branch transitions should remain guarded and auditable.
- This also helps preserve global simplicity: the tree still records durable choices, while local branch/node planning remains a bounded internal planning surface.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making guarded branch progression and supervisor-plannable interventions more concrete.
- **Refines Phase 2** by suggesting how richer local node behavior can remain encapsulated behind a narrow external planning/commit surface.
- **Rejects** any design where supervisor insertions, follow-up work, or review requirements exist only as informal conversational state.

Repo-specific consequence:
- `branch-event` work likely needs typed payloads for policy decision, obligation issuance/satisfaction, planning exposure/selection, and commit-level checkpoint mutation instead of one generic `details` blob.
- The next docs-level spec should treat manual activation, required review, and applicability gating as kernel concepts before adding more branch heuristics.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. Its main effect is to make Phase 1 look more like a governed decision-and-planning shell than a bag of runtime flags.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by a clearer three-part control shell:
  1. XACML-like policy combination and obligation/advice handling
  2. DMN-like decision requirements and decision-table selection semantics
  3. CMMN-like governed planning surfaces with discretionary work, applicability gating, and manual/required controls
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can remain locally rich if their local planning and decision machinery is projected outward only through governance-relevant contract surfaces.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define policy decisions with explicit combining semantics, not just scalar pressure scores
- compile governance inputs into a decision-requirements / decision-table form with explicit hit or selection policy
- separate hard obligations from soft advice, and make both durable when they matter for replay/governance
- define a governed planning surface for branches/nodes with discretionary options, role/applicability gating, manual activation, and required-completion semantics
- keep checkpoint mutation downstream of side-effect-free policy evaluation and governed planning choices

Phase 2 should now be read more precisely as:
- allow executor, verifier, and RAG-like advisor nodes to host richer local planning/decision internals
- keep those internals encapsulated behind `contract_projection`
- export only governance-relevant projections such as selected discretionary action, required review state, obligations/advice summaries, evidence refs, validation outcomes, and health summaries
- use the rich-node proof to show local heterogeneity does not force global graph or policy chaos

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources sharpen their meaning:
- `divergence`: pressure created when branch state causes different policy tables or combining rules to prefer incompatible actions
- `composability`: ability to derive a stable combined policy outcome and satisfy the obligations/required items that synthesis or adoption would create
- `effective_force`: branch usefulness after discounting manual-activation latency, pending required work, unsatisfied obligations, and policy-decision ambiguity
- `governance_pressure`: pressure to intervene because combining rules are colliding, obligations are accumulating, no clean hit-policy outcome exists, or the governed planning surface is narrowing toward mandatory review

### Recommended next research slice
The next pass should turn this into a tighter kernel-facing specification:

1. **policy decision record / combining-trace spec**
   - define durable fields for selected action, candidate actions, decision inputs, hit/selection policy, combining trace, obligations, advice, and indeterminate / no-applicable outcomes
   - decide which policy results are advisory only versus commit-blocking
2. **governed planning-surface spec for branches/nodes**
   - define discretionary action catalogs, role authorization, applicability rules, manual-activation semantics, required-review semantics, and how these states project into checkpoint history
   - connect this planning surface back to 聚散离合 actions (`continue / fork / tighten / loosen / isolate / escalate / adopt / synthesize`)
3. **branch-event payload classes for policy and planning commitments**
   - separate policy decisions, obligation issuance/satisfaction, planning exposure/selection, and durable checkpoint mutations into typed payload classes
   - keep generic `details` from becoming the long-term semantic container

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `policy decision / governed planning / typed branch-event payload` spec before adding more runtime heuristics or new node varieties
- keep the active mainline focus on **Phase 1** rather than drifting into operator surfaces, UI work, or Rust control-plane expansion
- treat the existing `governance_pressure_score` as provisional until it is grounded in a richer combining/obligation/planning model
- keep the first rich-node proof downstream of this kernel vocabulary so Phase 2 demonstrates local-rich/global-clean boundaries on top of a stronger governance shell

## 2026-04-19 04:31 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` still reduces checkpoint governance to a scalar `governancePressureScore` derived from `workflow_tightness`, `oversight_strength`, and `branch_budget`, so the repo still lacks a first-class decision record for why a policy action won.
- `ring/lib/orchestrator.mjs` already has a transport/tracing substrate (`trace_id`, `active_span_ids`, span records, and message-envelope `protocol_version`), so there is a reusable correlation shell available before any new kernel rewrite.
- `.ring/schemas/branch-event.schema.json` still models branch history as a coarse `event_type` plus permissive `details`, with no durable `decision_id`, `candidate_actions`, `selected_action`, `hit_policy`, `combining_trace`, `obligation`, `advice`, or payload-version vocabulary.
- Repo search across `.ring/schemas/*.json` still finds no first-class `decision_id`, `trace_id`, `span_id`, `candidate_actions`, `selected_action`, `hit_policy`, `combining`, `advice`, `obligation`, `manual_activation`, `discretionary`, or `required_review` vocabulary on the governance artifact side.
- The kernel gap is therefore no longer “add more knobs.” It is to define how policy evaluation becomes a durable decision record, how much explanation is published, and how branch events carry typed commitments without collapsing back into one generic blob.

### Sources reviewed

1. Open Policy Agent, “Decision Logs”
   - Official source URL: https://www.openpolicyagent.org/docs/management-decision-logs
   - Readable fallback used for line-oriented extraction: https://r.jina.ai/http://www.openpolicyagent.org/docs/management-decision-logs
   - Access note: the official page was browser-reachable; direct terminal body fetch hit a TLS EOF, so browser-rendered text was used and the mirrored text was used only as a readable extraction fallback.
   - Key evidence: the page says decision logs “contain events that describe policy queries”; each event includes “the policy that was queried, the input to the query, bundle metadata, and other information that enables auditing and offline debugging of policy decisions”; it also documents `decision_id`, `trace_id`, `span_id`, `bundles`, `path`, `input`, `result`, `timestamp`, and `nd_builtin_cache` “intended for use in debugging and decision replay.”

2. Open Policy Agent, “REST API Reference”
   - Official source URL: https://www.openpolicyagent.org/docs/rest-api
   - Access note: the official page was directly reachable in browser automation and the rendered article text was extracted from the DOM.
   - Key evidence: the page says OPA supports query explanations and that the `explain` parameter may be `off`, `full`, `debug`, `notes`, or `fails`; it also says responses can contain Trace Event objects with fields including `op`, `query_id`, `parent_id`, `type`, `node`, and `locals`.

3. CloudEvents project, “CloudEvents - Version 1.0.2”
   - Official source URL: https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
   - Direct raw URL used: https://raw.githubusercontent.com/cloudevents/spec/v1.0.2/cloudevents/spec.md
   - Access note: the official raw spec was directly reachable in terminal.
   - Key evidence: the abstract says CloudEvents is a “vendor-neutral specification for defining the format of event data”; the spec says every conforming event “MUST include context attributes designated as REQUIRED,” may include optional and extension attributes, and that context attributes are designed so they can be serialized “independent of the event data”; it also requires `source + id` uniqueness for distinct events.

### Findings

#### Finding 1: Policy evaluation should emit a durable decision record, not only a scalar pressure score
The OPA decision-log material is useful because it shows what a serious governance evaluation surface looks like in practice: not a single severity number, but a durable record containing query inputs, bundle revision, selected result, trace correlation ids, and bounded replay/debug information.

Implication for dp-ring:
- A Phase 1 governance decision should eventually produce a durable policy-decision artifact separate from a later branch-commit event.
- That artifact should minimally carry:
  - `decision_id`
  - `trace_id` and optional `span_id` / parent ref
  - evaluated policy snapshot or revision id
  - normalized decision inputs (policy knobs, metrics, assumption/validation summaries, supervisor signals)
  - candidate actions considered
  - selected action
  - rejected alternatives or conflict notes
  - resulting obligations and advice
  - timestamp and replay/debug refs
- If non-deterministic or external observations materially affect policy choice, the decision record should journal normalized evidence or replay refs rather than trusting ambient process state.
- Large local debug artifacts should remain bounded and optional, like OPA’s handling of `nd_builtin_cache`, so branch history stays globally clean.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making governance evaluation an auditable kernel product instead of an implicit heuristic.
- **Refines Phase 1** by separating policy evaluation from checkpoint mutation and by making replay/debug inputs explicit.
- **Rejects** any design where `governance_pressure_score` or a similar scalar stands in for the full semantics of why a branch was tightened, loosened, isolated, escalated, adopted, or synthesized.

Repo-specific consequence:
- `checkpointGovernancePressureState()` now looks more clearly like a provisional ranking heuristic rather than the kernel’s long-term decision model.
- The next docs-level spec should define a policy-decision record before expanding branch heuristics further.

#### Finding 2: Combining traces should be selectively publishable, not either opaque or fully dumped
The OPA explanation API is valuable because it gives a practical middle ground between black-box decisions and indiscriminate full trace dumping. It distinguishes `notes`, `fails`, `full`, and `debug`, and it structures traces as linked events with `query_id`, `parent_id`, operation kind, AST node, and locals.

Implication for dp-ring:
- The governance kernel should distinguish the durable decision record from the explain trace attached to that decision.
- A future combining-trace spec should support levels such as:
  - summary / selected-action rationale
  - notes-only explanation
  - failures-only explanation
  - full local trace
  - debug/local-only trace
- Nested rule evaluation, guard checks, validation failures, and assumption conflicts can be linked through parent/child ids rather than flattened into one prose blob.
- This supports local heterogeneity: rich nodes can keep detailed planner/retriever/verifier internals local while publishing only the trace level that governance actually needs.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making replay/audit compatible with inspectable rule evaluation rather than post-hoc storytelling.
- **Refines Phase 1** by splitting “policy decision” from “policy explanation” and by implying explicit trace-level controls.
- **Strengthens Phase 2** because rich nodes can export governance-facing summaries or fail-traces without leaking full local internals.
- **Rejects** both extremes: no inspectable rationale at all, or mandatory publication of full internal reasoning into the global tree.

Repo-specific consequence:
- The repo’s existing trace/span substrate can be reused, but it is not yet connected to branch-level policy commitments.
- The next planning artifact should define how decision records reference optional trace summaries, fail clusters, and local-debug attachments.

#### Finding 3: Branch events should use a stable envelope plus typed payload classes
CloudEvents is valuable here not because dp-ring should copy an internet event bus wholesale, but because it offers a disciplined split between a stable event envelope and typed event data. That maps directly onto the current `branch-event` problem: the envelope is too thin and the payload is too generic.

Implication for dp-ring:
- `branch-event` should evolve toward an envelope/payload split.
- A stable envelope should carry fields such as:
  - event id
  - source
  - event type / payload class
  - spec or payload version
  - occurred-at timestamp
  - trace / correlation refs
  - branch/checkpoint subject refs
- Typed payload classes can then evolve independently for things like:
  - `policy_decision_recorded`
  - `obligation_issued`
  - `obligation_satisfied`
  - `advice_emitted`
  - `planning_option_exposed`
  - `planning_option_selected`
  - `commit_adopt`
  - `commit_synthesize`
  - `validation_report_attached`
- Optional/extension-style fields are a better place for local richness than a forever-growing untyped `details` blob.
- This remains tree-first: the checkpoint tree stays primary, while typed event payloads make governance-visible changes explicit and versionable.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening how branch history becomes auditable and evolvable.
- **Refines Phase 1** by suggesting a versioned payload-class model for branch events.
- **Strengthens Phase 2** because heterogeneous nodes can emit narrow governance-facing payloads without forcing a shared global internal model.
- **Rejects** any long-term design where the semantic burden of branch history remains packed into one generic `details` object.

Repo-specific consequence:
- `ring/lib/orchestrator.mjs` already has a trace-aware message envelope, so the repo has a partial precedent for this separation.
- `.ring/schemas/branch-event.schema.json` should eventually borrow that discipline rather than expanding `details` ad hoc.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass strengthens the current spine rather than changing it. Its main effect is to make Phase 1 look more like a three-step semantic shell:
1. side-effect-free policy evaluation
2. durable decision records plus selectable explain traces
3. typed commitment/planning events that mutate checkpoint history

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by a clearer separation between evaluation, explanation, and commitment. The kernel now looks less like a bag of policy flags and more like a decision service that emits auditable records before any checkpoint mutation occurs.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can remain locally rich if they only project governance-relevant decision/trace summaries and typed events outward.

#### Mainline refined
Phase 1 should now be read more precisely as:
- keep governance evaluation side-effect-free and make it emit a durable decision record
- separate selected action from the explanation trace that justifies it
- allow explanation depth to vary (`summary / notes / fails / full / debug`) without forcing all local reasoning into global state
- split branch events into a stable envelope plus typed payload classes
- connect `workflow_tightness`, `oversight_strength`, metrics, assumptions, validation state, and supervisor signals to chosen actions through explicit decision records rather than only scalar scoring
- treat checkpoint mutation as downstream of decision evaluation, explanation selection, and governed planning/commit events

Phase 2 should now be read more precisely as:
- allow executor, verifier, and RAG-like advisor nodes to maintain richer local decision and explanation machinery
- keep those internals encapsulated behind `contract_projection`
- export only governance-relevant outputs such as selected action summaries, fail-trace summaries, obligations/advice, validation refs, evidence refs, and typed branch events
- use the first rich-node proof to show local heterogeneity does not force global payload chaos

#### Refined metric hypotheses after this pass
These remain hypotheses, but the new sources sharpen their meaning:
- `divergence`: pressure created when sibling branches drive materially different policy decisions, fail-traces, or obligation sets under comparable checkpoint conditions
- `composability`: ability to combine branches while producing a coherent merged decision record, compatible obligations, and no unresolvable fail-trace conflicts
- `effective_force`: branch usefulness after discounting decision ambiguity, replay/debug debt, unresolved obligations, and fail-trace density
- `governance_pressure`: pressure to intervene because policy evaluation yields repeated fail traces, ambiguous candidate selection, rising obligation load, or heavy dependence on unjournaled/non-deterministic inputs

### Recommended next research slice
The next pass should turn this into a tighter kernel-facing specification:

1. **policy decision record / explain-trace schema**
   - define durable fields for `decision_id`, correlation refs, decision inputs, candidate actions, selected action, rejected alternatives, obligations, advice, trace level, and replay/debug refs
   - decide which trace levels are globally journaled versus node-local only
2. **branch-event envelope / payload-class spec**
   - define the stable envelope fields and typed payload classes for policy decisions, planning exposure/selection, obligations/advice, validation references, and checkpoint commitments
   - version payload classes explicitly so semantics can evolve without turning `details` into an unbounded catch-all
3. **decision-to-planning handoff model**
   - connect policy decisions to the governed planning-surface work from the previous pass: what the decision exposes, what remains discretionary, what becomes mandatory review, and what commit event closes the loop

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `policy decision record / explain-trace levels / branch-event envelope-payload` spec before adding more runtime heuristics or new node varieties
- keep the active mainline focus on **Phase 1** rather than drifting into operator surfaces, UI work, or Rust control-plane expansion
- reuse the repo’s existing trace/span substrate where possible, but stop treating it as sufficient until it is connected to policy-decision and branch-event semantics
- treat the current `governance_pressure_score` and generic `details` blob as provisional scaffolding rather than stable kernel abstractions

## 2026-04-19 05:42 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` now exposes `checkpointBranchMetricsState()` with `divergenceScore` and `composabilityScore`, plus `checkpointGovernancePressureState()` with `governancePressureScore`; `tests/ring/governance-policy.test.mjs` covers those metrics explicitly.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }` from Ajv; there is no first-class publication-level validation report vocabulary in `.ring/schemas/*.json`.
- `.ring/schemas/branch-event.schema.json` still records coarse lineage events plus a generic `details` object; it has no `decision_id`, `trace_id`, `span_id`/`parent_id`, `conforms`, `validation_report`, `result_severity`, or payload-class split.
- `ring/lib/orchestrator.mjs` already carries `message_protocol_version`, `trace_id`, and span tracking (`active_span_ids`, `parent_span_id`), so the repo has a correlation substrate that has not yet been lifted into governance artifacts.
- The current semantic gap has therefore shifted again: Phase 1 is no longer missing all metric work, but it still lacks a durable publication/validation/correlation layer that would make those metrics semantically accountable.

### Sources reviewed

1. W3C, “Shapes Constraint Language (SHACL)”
   - Official source URL: https://www.w3.org/TR/shacl/
   - Access note: direct official page was reachable.
   - Key evidence: the spec says “SHACL defines an RDF Validation Report Vocabulary”; “Only SHACL implementations that can produce all of the mandatory properties of the Validation Report Vocabulary are standards-compliant”; validation reports use `sh:conforms true/false`; and each validation result has exactly one `sh:resultSeverity` value.

2. W3C, “Trace Context”
   - Official source URL: https://www.w3.org/TR/trace-context/
   - Access note: direct official page was reachable.
   - Key evidence: the spec says trace context provides “an unique identifier for individual traces and requests”; `traceparent` “describes the position of the incoming request in its trace graph”; `tracestate` extends it with optional vendor-specific data; `parent-id` is effectively the caller-known request/span id; and `trace-id` “SHOULD be globally unique.”

3. JSON Schema, “JSON Schema Core — Draft 2020-12”
   - Official source URL: https://json-schema.org/draft/2020-12/json-schema-core.html
   - Access note: direct official page was reachable.
   - Key evidence: the spec defines `Basic`, `Detailed`, and `Verbose` output formats; says implementations “SHOULD provide at least one of the `flag`, `basic`, or `detailed` format”; and explains that `Detailed` makes error correlations more apparent while `Verbose` returns the full hierarchy and recommends a per-node `valid` property.

### Findings

#### Finding 1: SHACL turns publication validity into a first-class governance artifact, not a boolean side effect
SHACL is useful here because it does not stop at “valid/invalid.” It defines a report vocabulary with conformance, per-result severity, and source-specific validation detail. Combined with the earlier PROV-style provenance work in this memo, this suggests that a dp-ring publication should eventually look like a **publication profile**: a provenance-aware bundle plus a governed validation report.

Implication for dp-ring:
- A branch publication, adoption package, or synthesis package should carry more than raw `evidence_refs` or an ad hoc `details` blob.
- The Phase 1 kernel should define a publication profile that can point to:
  - what was published
  - under which profile/shape/check set it was evaluated
  - whether it conforms
  - what validation results were produced
  - which results are warnings versus blocking violations
- This should remain tree-first: validation reports should justify publication and checkpoint decisions, not replace the checkpoint tree.
- Rich nodes can remain locally heterogeneous if they export only projected validation results, conformance summaries, and source refs instead of leaking full internals.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making governed publication validity explicit rather than implicit.
- **Refines Phase 1** by suggesting that the next semantic layer is `publication profile + validation report`, not more free-floating metrics.
- **Strengthens Phase 2** because rich nodes can publish narrow validation/conformance projections under one outer contract.
- **Rejects** any design where Ajv error arrays or generic branch-event `details` are treated as the long-term publication semantics.

Repo-specific consequence:
- `ring/lib/validator.mjs` is currently too thin for this role: it returns `{ valid, errors }`, but not a durable report model.
- `.ring/schemas/branch-event.schema.json` and related artifacts have nowhere to encode conformance, shape/check profile, or per-result severity today.
- The next docs-level artifact should therefore define publication-profile and validation-report semantics before the repo adds more branch-metric sophistication.

#### Finding 2: JSON Schema output formats show that dp-ring needs report levels, not one raw error list
The JSON Schema core spec matters because the repo already uses Ajv and `.ring/schemas/*.schema.json`. This means dp-ring does not need to invent report granularity from scratch. The spec’s `flag / basic / detailed / verbose` distinction is a useful bridge between the repo’s current validator substrate and the richer SHACL-style validation-report goal.

Implication for dp-ring:
- Validation output should have levels.
- A plausible Phase 1 split is:
  - **flag**: fast conformance bit for gating and reuse decisions
  - **basic**: flat result list for lightweight journal/audit use
  - **detailed**: condensed hierarchy for checkpoint/branch-level conflict analysis
  - **verbose**: node-local or replay/debug-only full structure
- This also helps preserve global homogeneity / local heterogeneity:
  - global governance can depend on flag/basic/detailed projections
  - node-local validators can keep verbose internals out of the checkpoint tree unless explicitly requested for replay/debug
- `divergence`, `composability`, and future `effective_force` should eventually be explainable against these report levels rather than only against informal heuristics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding validation-report levels in the same schema ecosystem the repo already uses.
- **Refines Phase 1** by separating globally journaled conformance/report summaries from optional local debug output.
- **Rejects** both extremes: dumping full validator internals into durable global state, or staying forever at `{ valid, errors }`.

Repo-specific consequence:
- `ring/lib/validator.mjs` is directionally useful because it centralizes schema validation, but it still exposes only the thinnest output shape.
- The next docs-level spec should say which report level attaches to branch publications, checkpoint commits, and supervisor-facing decision records.
- This also suggests the next research slice should connect SHACL-style conformance semantics to the repo’s existing JSON Schema/Ajv substrate rather than inventing a second unrelated validation stack.

#### Finding 3: Trace Context sharpens branch-event envelopes into correlation-aware commitments
Trace Context is helpful because it formalizes a portable correlation shell: one field for the shared cross-system trace position, one extension surface for vendor/local specifics, and an explicit parent/request linkage. That maps well onto dp-ring’s current situation: the repo already has tracing inside the orchestrator, but branch-level governance artifacts still have no portable correlation vocabulary.

Implication for dp-ring:
- Branch-event and future policy-decision envelopes should carry at least:
  - `trace_id`
  - current operation / span id
  - optional parent ref
  - optional extension bag for node-local/vendor-specific correlation data
- This envelope should sit outside typed governance payloads, so the payload can remain about publication, obligation, adoption, synthesis, or validation while the envelope handles correlation and replay tracing.
- Rich nodes can keep richer local traces behind `contract_projection` while exporting portable correlation refs upward.
- This is especially relevant for replay: a decision record or validation report can point to a stable trace envelope without forcing full internal trace publication.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making decision/publication history traceable across evaluation, validation, and checkpoint mutation.
- **Refines Phase 1** by suggesting a stable correlation envelope separate from governance payload semantics.
- **Strengthens Phase 2** because heterogeneous nodes can keep proprietary/local tracing behind the portable shell.
- **Rejects** any design where correlation remains trapped inside orchestrator runtime objects or buried in untyped `details` blobs.

Repo-specific consequence:
- `ring/lib/orchestrator.mjs` already has the beginnings of the right substrate (`message_protocol_version`, `trace_id`, spans).
- `.ring/schemas/branch-event.schema.json` does not yet reuse that discipline.
- The next docs-level branch-event / decision-record spec should align governance artifacts with the existing trace substrate instead of inventing unrelated correlation ids later.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does not change the spine. It tightens the meaning and ordering of **Phase 1**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened by a clearer publication semantics stack:
  1. provenance-aware publication/profile semantics from earlier passes
  2. shape/check-based validation reports with conformance and severities
  3. portable correlation envelopes for decisions and branch events
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can publish conformance summaries, validation refs, and correlation ids without leaking full local validator/retriever/planner internals.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a publication profile vocabulary that combines provenance-bearing publication bundles with validation-report attachments
- define validation output levels (`flag / basic / detailed / verbose`-like) and decide which levels are globally journaled versus node-local only
- define a portable trace/correlation envelope for branch events and future policy-decision records
- bind branch metrics to explicit conformance, severity, and correlated-decision history rather than letting them float as opaque scores
- postpone any stronger `effective_force` semantics until publication validity and correlation semantics are explicit enough to support it

Phase 2 should now be read more precisely as:
- require rich nodes to export validation/conformance projections and correlation refs under one node contract
- keep verbose validator/retriever/planner traces local unless replay/debug requires a targeted export
- prove that local richness still projects into a globally simple publication/validation/correlation shell

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize a docs-level `publication profile / validation report / correlation envelope` spec before adding more metrics or node varieties
- treat current `divergenceScore`, `composabilityScore`, and `governancePressureScore` as provisional until they can be justified against explicit conformance and decision-history semantics
- do not jump to UI/operator projection, Rust control-plane expansion, or richer node internals before the publication/validation/correlation layer is defined

### Recommended next research slice
The next pass should convert this into a tighter repo-aligned spec:

1. **JSON Schema/Ajv report adaptation for dp-ring**
   - map the repo’s current `{ valid, errors }` validator output onto a `flag/basic/detailed/verbose` report model that can host SHACL-like conformance and severity semantics without abandoning JSON Schema
2. **publication-profile / validation-report schema sketch**
   - define the minimal fields for publication profile id, check/shape set, `conforms`, result severities, result refs, and blocking vs advisory outcomes for checkpoint publication/adoption/synthesis
3. **correlation-envelope mapping**
   - map existing orchestrator trace/span fields onto a portable governance-artifact envelope for branch events and future policy decision records

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `publication-profile / validation-report / correlation-envelope` spec before more branch-metric work
- stop treating `branch-event.details` as a safe long-term growth surface
- keep `effective_force` in the parking lot until conformance and correlation semantics exist to support it
- preserve the repo’s current tree-first / node-centered boundary discipline while strengthening the semantic layer above the existing runtime substrate

## 2026-04-19 06:51 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` now make the branch-metric layer real enough to name: `divergenceScore`, `composabilityScore`, and `governancePressureScore` already exist and are tested.
- `.ring/schemas/checkpoint.schema.json` still models `policy_snapshot` mainly as scalar knobs (`workflow_tightness`, `oversight_strength`, `branch_budget`, `notes`) and leaves `execution_cursor.phase` as a generic string, not a governed lifecycle model.
- `.ring/schemas/branch-event.schema.json` still records only coarse lineage events plus a generic `details` object; there is still no docs-level contract for guard evaluation, obligations, assumption ledgers, defended acceptance, or phase-transition justification.
- `ring/lib/orchestrator.mjs` already contains a trace/span substrate (`trace_id`, `parent_span_id`, `active_span_ids`), but that substrate still sits below the governance semantics rather than being paired with typed rule / lifecycle / assumption artifacts.
- Search across `ring/lib/*.mjs` and `.ring/schemas/*.json` this pass still found no first-class governance fields for `assumption`, `contrary`, `defended`, `obligation`, `conforms`, or `validation_report` on checkpoint/branch artifacts.
- The open Phase 1 gap has therefore narrowed again: the repo no longer lacks all governance machinery, but it still lacks a declarative rule vocabulary, a guarded checkpoint lifecycle, and an assumption/contrary acceptance model that would make scores and publication reports semantically meaningful.

### Sources reviewed

1. DCR Solutions documentation, “The Power of the FEEL Context in DCR”
   - Official source URL: https://documentation.dcr.design/documentation/feel-context/
   - Access note: the official page was readable in browser automation, while direct terminal access hit a bot/security challenge (`202` / CAPTCHA). I used the official browser-rendered DOM text as the primary evidence.
   - Key evidence: the page says DCR behavior is defined by “conditions,” “include” and “exclude” rules, “response” rules, and that “Rules can be controlled by Guards.” It also says “A guard is an expression that must evaluate to true for the rule to be applied.”

2. DCR Solutions documentation, “Phases”
   - Official source URL: https://documentation.dcr.design/documentation/phases/
   - Access note: the official page was readable in browser automation, while `r.jina.ai`/terminal retrieval hit the site’s security challenge. I extracted the rendered article text from the official browser page.
   - Key evidence: the page says “Workflow phases can be defined as part of the overall process description,” and that the “actual phase is calculated” from pending included activities, executed events, and enabled activities.

3. Phan Minh Dung, Robert A. Kowalski, Francesca Toni, “Assumption-Based Argumentation”
   - Primary source URL: https://link.springer.com/chapter/10.1007/978-0-387-98197-0_10
   - DOI: https://doi.org/10.1007/978-0-387-98197-0_10
   - Access note: the official Springer chapter page was reachable in browser automation; `r.jina.ai` also provided a readable fallback preview paragraph.
   - Key evidence: the chapter says ABA was developed “as a computational framework to reconcile and generalise most existing approaches to default reasoning,” and ties acceptability to “the notion of ‘no-evidence-to-the-contrary’.”

### Findings

#### Finding 1: Phase 1 needs a declarative rule vocabulary with guards, not just scalar governance knobs
The DCR FEEL documentation is unusually useful because it compresses the control vocabulary into a small, actionable set: `condition`, `include`, `exclude`, `response`, plus `guard`. That is much closer to what dp-ring still lacks than another round of score tweaking.

Implication for dp-ring:
- `workflow_tightness` and `oversight_strength` should stop being interpreted as self-sufficient policy semantics.
- The governance kernel should define a small typed rule vocabulary for checkpoint and branch control, for example:
  - **condition-like** constraints for enablement / prerequisite satisfaction
  - **response-like** constraints for obligations created by an event
  - **include/exclude-like** constraints for dynamically enabling or disabling branch actions, publication paths, or node capabilities
  - **guard** expressions that decide when those relations actually apply
- This vocabulary should sit above the existing metrics and below runtime implementation details.
- Branch metrics should eventually explain why a relation fired or why a guard failed, not replace those semantics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding declarative governance constraints in a compact, field-tested control vocabulary.
- **Refines Phase 1** by implying that the next semantic layer is `relation + guard + obligation`, not a larger bag of scalar scores.
- **Rejects** any near-term direction where branch control keeps growing through untyped notes, booleans, or heuristic-only scoring.

Repo-specific consequence:
- `.ring/schemas/checkpoint.schema.json` still exposes only scalar `policy_snapshot` fields.
- `.ring/schemas/branch-event.schema.json` still has no place to record rule kind, guard outcome, generated obligation, or availability effect.
- The next docs-level artifact should therefore define a governance relation table before additional runtime heuristics are added.

#### Finding 2: Guarded lifecycle progression should be derived from semantic state, not left as free-form phase labels
The DCR Phases documentation matters because it does not treat phase as a decorative label. It explicitly says the current phase is calculated from durable semantic state: pending included work, executed events, and enabled activities.

Implication for dp-ring:
- A checkpoint/branch lifecycle should not remain an arbitrary `phase` string or be inferred only from outer job orchestration status.
- The kernel should define guarded lifecycle progression in terms of durable state such as:
  - pending obligations / responses
  - included vs excluded next actions
  - enabled commitment paths
  - satisfied vs unsatisfied publish/adopt/synthesize guards
- That makes lifecycle progression replayable and auditable instead of merely descriptive.
- A future checkpoint stage model should answer questions like:
  - when is a branch exploratory?
  - when is it review-pending?
  - when is it eligible for adoption or synthesis?
  - when is it blocked by unsatisfied obligations or contrary evidence?

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening guarded lifecycle progression as a kernel concern.
- **Refines Phase 1** by moving “phase” from a loose label toward a derived semantic state.
- **Rejects** the tempting shortcut where product/job state machines are mistaken for the checkpoint-governance lifecycle itself.

Repo-specific consequence:
- `.ring/schemas/checkpoint.schema.json` currently requires `execution_cursor.phase`, but gives it no semantics beyond “string.”
- `ring/lib/orchestrator.mjs` already has job state machines, but those are not yet a checkpoint-level lifecycle model.
- The next docs-level work should define a checkpoint lifecycle table with guards, derived-state notes, and allowed transitions before any runtime code tries to automate more branch control.

#### Finding 3: Branch adoption and synthesis need assumption ledgers with contrary-handling and defended acceptance
The ABA chapter is high-value here because it ties acceptability to “no-evidence-to-the-contrary.” That is a much better fit for dp-ring’s branch-governance problem than simple score comparison or last-writer-wins adoption.

Implication for dp-ring:
- Checkpoints, publications, or branch decisions should be able to name the assumptions they rely on.
- Governance artifacts should be able to record:
  - an assumption claim
  - contrary evidence or contrary branch findings
  - whether the assumption is currently defended / undefeated / provisional
  - how defended-acceptance status affects adoption, synthesis, or escalation
- This would let dp-ring distinguish:
  - a branch that is merely productive
  - from a branch whose core assumptions remain defensible under current evidence
- It also gives a cleaner basis for supervisor intervention: supervisors can attack, defend, suspend, or accept assumptions explicitly rather than only changing global strictness.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by adding a concrete semantic basis for contrary-handling and defended branch acceptance.
- **Refines Phase 1** by suggesting that adoption/synthesis should depend on defended assumptions, not only on metric thresholds.
- **Strengthens Phase 2** because rich nodes can keep local reasoning internals while projecting only assumption summaries, contrary refs, and defended-status outputs.
- **Rejects** any plan where `composabilityScore` or future `effective_force` becomes the sole basis for accepting a branch into the mainline.

Repo-specific consequence:
- Current checkpoint and branch-event artifacts still have no assumption-ledger vocabulary.
- The repo can already carry evidence refs and traces, but it cannot yet say which assumptions those refs defend or attack.
- The next docs-level semantic addition should therefore include assumption / contrary / defended-status fields before richer synthesis or supervisor strategies are implemented.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It sharpens the still-active Phase 1 by adding three missing semantic layers that the repo still lacks:
1. declarative governance relations with guards
2. guarded checkpoint lifecycle progression
3. assumption-ledger / contrary / defended-acceptance semantics

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the repo’s current scores, traces, and checkpoint primitives now have a clearer semantic destination: they should support rule firing, lifecycle guards, and defended branch acceptance.
- **Phase 2 / Heterogeneous node ecology** is strengthened indirectly because rich nodes can continue to hide local internals if they export only rule-relevant outcomes, lifecycle-relevant signals, and assumption/provenance projections.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a declarative governance relation vocabulary (`condition / response / include / exclude`-like effects, adapted to dp-ring)
- define guard semantics and where guard evaluations are recorded
- define a guarded checkpoint lifecycle derived from durable semantic state rather than free-form phase names
- define assumption-ledger / contrary / defended-acceptance semantics for publication, adoption, and synthesis
- connect the existing publication-profile / validation-report / correlation work from the prior pass to these new semantics, so reports justify concrete rule, phase, and assumption outcomes rather than floating beside them
- treat branch metrics as explanatory or ranking inputs inside this semantic shell, not as the shell itself

Phase 2 should now be read more precisely as:
- require rich nodes to project assumption summaries, contrary refs, obligation outcomes, and phase-relevant signals under one outer node contract
- keep richer local reasoning, retrieval, and planning internals encapsulated behind `contract_projection`
- prove that local richness does not force global rule/lifecycle/assumption chaos

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level semantics for `governance relations / guards / checkpoint lifecycle / assumption ledger` before adding more runtime heuristics, more node varieties, or more product surfaces
- treat current `workflow_tightness`, `oversight_strength`, and score outputs as provisional control inputs rather than finished kernel semantics
- preserve the previous pass’s `publication-profile / validation-report / correlation-envelope` work, but now connect it to rule outcomes, lifecycle stages, and defended assumptions rather than treating it as a complete Phase 1 answer by itself
- do not confuse existing orchestrator job states or milestone planning phases with the future checkpoint-governance lifecycle

### Recommended next research slice
The next pass should reduce the remaining design risk by turning today’s research into repo-shaped semantic tables:

1. **governance relation / guard spec**
   - define the minimal dp-ring rule set and how each rule is attached to checkpoint events, publications, or supervisor decisions
   - specify what a recorded guard evaluation must contain
2. **checkpoint lifecycle table**
   - define derived stages, entry/exit guards, and how pending obligations / enabled actions / contrary evidence affect stage progression
   - map this onto current `execution_cursor.phase` and `branch-event` artifacts without changing runtime code yet
3. **assumption-ledger / defended-acceptance model**
   - define fields for assumptions, contrary refs, defended status, and adoption/synthesis consequences
   - decide how this plugs into publication validation and supervisor escalation without leaking node internals

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `governance-relation / guard / checkpoint-lifecycle / assumption-ledger` spec before more branch-metric tuning
- stop treating `execution_cursor.phase` as if it were already a lifecycle model; today it is still just a label slot
- stop treating `branch-event.details` as a safe place to smuggle future governance semantics
- keep `effective_force` parked until rule, lifecycle, and assumption semantics exist to support it
- preserve the repo’s tree-first / node-centered boundary discipline while giving Phase 1 a much sharper semantic kernel

## 2026-04-19 08:07 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` already make `divergenceScore`, `composabilityScore`, `governancePressureScore`, and `effectiveForceScore` real runtime concepts, so Phase 1 is no longer blocked on having zero metric substrate.
- `.ring/schemas/checkpoint.schema.json` still exposes only coarse checkpoint acceptance/lifecycle fields: `status`, `adoption_status`, and `execution_cursor.phase`, with no first-class semantics-profile or defended-status vocabulary.
- `.ring/schemas/branch-event.schema.json` still records only coarse lineage `event_type` values plus a generic `details` object; it has nowhere to carry typed support/attack updates, claim-status transitions, or acceptance-basis metadata.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and repo search this pass found no first-class governance/schema vocabulary for `support`, `attack`, `defended`, `grounded`, `preferred`, or `semantics_profile` in `.ring/schemas/*.json`.
- `ring/lib/orchestrator.mjs` still contains a useful trace substrate (`trace_id`, `parent_span_id`, `active_span_ids`), but that substrate is not yet paired with typed branch-acceptance semantics.
- The open Phase 1 gap has therefore narrowed again: dp-ring now has metrics, traces, and checkpoint primitives, but it still lacks an explicit argument-status layer that would say **why** a branch is acceptable, contestable, or ready for adoption/synthesis.

### Sources reviewed

1. Pietro Baroni, Martin Caminada, Massimiliano Giacomin, “An introduction to argumentation semantics”
   - Official source URL: https://doi.org/10.1017/S0269888911000166
   - Access note: the official Cambridge Core abstract page was directly reachable in browser automation.
   - Key evidence: the abstract says the paper reviews Dung’s “complete, grounded, preferred, and stable semantics,” later semantics such as semi-stable, ideal, stage, and CF2, considers both “extension-based and the labelling-based approaches,” and analyzes “argument justification and skepticism.”

2. Martin W. A. Caminada, Dov M. Gabbay, “A Logical Account of Formal Argumentation”
   - Official source URL: https://doi.org/10.1007/s11225-009-9218-x
   - Access note: the official Springer abstract page was directly reachable in browser automation.
   - Key evidence: the abstract says the paper re-examines abstract argumentation “in terms of labellings,” expresses “(complete) extensions ... as models,” and says “it becomes possible to define the grounded extension in terms of modal logic entailment.”

3. Claudette Cayrol, Marie-Christine Lagasquie-Schiex, “Bipolar abstract argumentation systems”
   - Official source URL: https://doi.org/10.1007/978-0-387-98197-0_4
   - Access note: the official Springer chapter page was directly reachable in browser automation.
   - Key evidence: the preview says that in most existing systems only the “attack relation” is considered, but an argument “can also support another one,” suggesting “a notion of bipolarity.”

### Findings

#### Finding 1: Phase 1 now needs an explicit acceptance semantics profile, not just an assumption ledger
The Baroni/Caminada/Giacomin tutorial is useful because it makes a crucial point explicit: abstract argumentation does not have one unnamed notion of acceptability. It has semantics families, justification questions, and skepticism choices. For dp-ring, that means the governance kernel should stop pretending that `adoption_status` alone explains acceptance.

Implication for dp-ring:
- A branch/publication decision should eventually declare **which acceptance criterion it is using**.
- The kernel likely needs a docs-level `semantics_profile` or equivalent decision-profile field for branch acceptance, even if runtime starts with only one conservative default.
- `adopt` should not mean merely “highest score wins.” It should mean acceptance under a declared semantics profile plus validation/provenance constraints.
- `synthesize` should not silently inherit the same standard as `adopt`; it may need a different candidate/justification profile before anything becomes `mainline`.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making branch acceptance criteria explicit and auditable.
- **Refines Phase 1** by suggesting that adoption needs a declared semantics profile and skepticism stance, not only metrics.
- **Rejects** any design where branch acceptance remains an implicit consequence of scores, prompts, or supervisor intuition.

Repo-specific consequence:
- The repo currently has `status`, `adoption_status`, and score outputs, but no place to say what notion of acceptability produced them.
- The next docs-level spec should therefore add an acceptance/semantics layer before more scoring or branch-automation work is attempted.

#### Finding 2: Mainline acceptance should be derived from recorded semantic state, not from free-floating heuristics
The Caminada/Gabbay paper sharpens the previous ABA line. If complete extensions can be represented as models and grounded acceptance can be derived by entailment, then branch acceptance is not just a score ranking problem — it is a derived semantic-state problem.

Implication for dp-ring:
- Branch acceptance should be explainable from durable support/contrary state, not only from scalar heuristics.
- A useful Phase 1 direction is to distinguish at least:
  - **accepted/defended enough for mainline consideration**
  - **rejected/defeated**
  - **still undecided/contested**
- This should remain docs-level first: the goal is not to implement a full argumentation solver this week, but to define what branch states and decision records must eventually justify.
- A conservative reading for dp-ring is that `mainline` adoption should depend on the most defensible, replay-explainable acceptance status, while exploratory/synthesis candidates may remain explicitly provisional.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tying branch acceptance to replayable semantic derivation rather than loose scoring.
- **Refines Phase 1** by turning acceptance into a status lattice problem (`accepted / rejected / contested`) rather than a single scalar threshold.
- **Rejects** any near-term plan where `governancePressureScore` or future `effectiveForceScore` becomes the de facto truth criterion for branch adoption.

Repo-specific consequence:
- `execution_cursor.phase` and `adoption_status` are currently too thin to express defended versus contested branch state.
- The next docs-level artifact should define branch/claim status meanings and how those statuses constrain `adopt`, `discard`, `synthesize`, and `escalate`.

#### Finding 3: Support must become a first-class relation beside attack/contrary
The bipolar chapter matters because it says support is not just the absence of attack. That is exactly the missing semantic lever in the current repo: the memo already pushed assumption/contrary handling, but the repo still lacks a clean way to say how one branch or publication positively supports another.

Implication for dp-ring:
- Branch semantics should not stop at contrary detection.
- The kernel should eventually model both:
  - **attack/contrary** relations that undermine assumptions or claims
  - **support** relations that strengthen claims, justify synthesis, or defend adoption
- `composability` should depend on explicit support/attack structure, not only lineage proximity or synthesis fan-in counts.
- `synthesize` in particular should require a positive support story, not merely “no obvious contradiction yet.”

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the assumption-ledger line a missing positive relation, not just a negative one.
- **Refines Phase 1** by making `composability` and defended acceptance depend on support/attack structure.
- **Strengthens Phase 2** because rich nodes can project compact support/attack summaries without leaking local internals.
- **Rejects** any architecture where branch governance tracks only conflicts while leaving justification/support implicit.

Repo-specific consequence:
- Search across `.ring/schemas/*.json` this pass found no first-class support/attack vocabulary for checkpoint or branch artifacts.
- The next docs-level branch-event / publication spec should therefore separate support updates from contrary/attack updates instead of burying both inside generic `details` or free-form notes.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by adding a sharper acceptance layer on top of the already-existing metric substrate.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing semantic shell is now clearer: support/attack relations, declared acceptance semantics, and defended/contested branch status.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can continue projecting outward only compact support, contrary, and acceptance-status summaries under one node contract.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a branch assumption/claim relation vocabulary with both support and contrary/attack edges
- define an acceptance-semantics profile for branch/publication decisions, even if the first implementation uses one conservative default
- define a small status lattice for branch or claim acceptance (for example: accepted/defended, rejected/defeated, contested/undecided)
- bind `adopt`, `discard`, `synthesize`, and `escalate` to those statuses plus the prior pass’s guard/validation/correlation work
- keep branch metrics as ranking/explanatory inputs inside this semantic shell rather than treating them as the shell itself

Phase 2 should now be read more precisely as:
- require rich nodes to export support/contrary summaries and acceptance-status projections under `contract_projection`
- keep richer local reasoning/search/planning internals encapsulated behind node boundaries
- prove that local richness still projects into a globally simple relation/status shell

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `support/attack relation + acceptance semantics profile + branch-status lattice` work before more branch-metric tuning
- treat current scores as provisional signals rather than as acceptance truth
- connect the previous pass’s guard/lifecycle/assumption work to this new status layer instead of opening a separate theory track
- do not jump to UI/operator projection, Rust control-plane expansion, or richer node internals before this acceptance layer exists

### Recommended next research slice
The next pass should reduce risk by converting this into explicit repo-shaped tables/specs:

1. **branch relation / acceptance-status spec**
   - define minimal durable fields for support, contrary/attack, defended status, contested status, and the semantics profile that interprets them
2. **decision consequence table for branch operations**
   - specify how `continue / adopt / discard / synthesize / escalate` depend on acceptance status, not just on scores or ad hoc supervisor judgment
3. **checkpoint/branch-event mapping**
   - map the above relation/status concepts onto current `checkpoint.status`, `adoption_status`, `execution_cursor.phase`, and `branch-event` envelopes without editing runtime code yet

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- prioritize a docs-level `relation / acceptance-profile / defended-status` spec before more metric sophistication
- stop treating support as something that can remain implicit while only attacks/contraries become explicit
- stop treating `adoption_status` as if it already explained branch acceptability; today it is only an outcome label
- keep `effective_force` and other scalar heuristics subordinate to explicit relation/status semantics
- preserve the repo’s tree-first / node-centered boundary discipline while making branch acceptance much more semantically legible

## 2026-04-19 09:47 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` already provide a real branch-metric substrate (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the next Phase 1 gap is no longer “invent metrics from nothing”.
- `.ring/schemas/checkpoint.schema.json` still exposes evidence refs and coarse lifecycle/adoption fields, but it has no first-class provenance bundle, validation report reference, semantics profile, or decision-consequence fields.
- `.ring/schemas/branch-event.schema.json` still records only coarse `event_type` plus permissive `details`, leaving nowhere for typed obligations, advice, validation outcomes, or decision-basis references.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and repo search this pass still found no first-class schema vocabulary for `validation_report`, `conforms`, `provenance`, `obligation`, `advice`, `permission`, `prohibition`, or `duty` under `.ring/schemas/*.json`.
- The open Phase 1 gap has therefore narrowed again: dp-ring now has metrics and acceptance-pressure signals, but it still lacks a durable artifact layer for **why** a publication/branch decision is valid, what provenance bundle supports it, and which governance consequences are mandatory versus advisory.

### Sources reviewed

1. W3C Recommendation, “Constraints of the PROV Data Model”
   - Official source URL: https://www.w3.org/TR/prov-constraints/
   - Access note: the official W3C page was reachable in browser automation; direct terminal `curl` to W3C hit a TLS EOF, so evidence was extracted from the official browser-rendered page.
   - Key evidence: the abstract says the spec defines “valid PROV instances,” requires “a consistent history of objects and their interactions,” and says “Validity and equivalence are also defined for PROV bundles (that is, named instances) and documents.”

2. W3C Recommendation, “Shapes Constraint Language (SHACL)”
   - Official source URL: https://www.w3.org/TR/shacl/
   - Access note: the official W3C page was reachable in browser automation.
   - Key evidence: section 3.6 says “The validation report is the result of the validation process that reports the conformance and the set of all validation results”; section 3.6.1 says the result is “an RDF graph with exactly one SHACL instance of sh:ValidationReport” and that the graph “may contain additional information such as provenance metadata”; section 3.6.1.1 defines `sh:conforms`; section 3.6.2.8 defines per-result severity via `sh:resultSeverity`.

3. OASIS Standard, “eXtensible Access Control Markup Language (XACML) Version 3.0”
   - Official source URL: https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html
   - Access note: the official OASIS HTML specification was directly reachable in browser automation.
   - Key evidence: the spec says combining algorithms define procedures for arriving at a decision from multiple rules/policies, that `<Obligations>` express actions that “MUST be performed,” and that `<Advice>` expresses supplemental information that “may be safely ignored by the PEP.”

### Findings

#### Finding 1: Phase 1 now needs provenance-valid publication bundles, not just evidence refs
The PROV constraints specification sharpens the previous acceptance-semantics work in an important way: semantic acceptance is not enough if the supporting provenance cannot itself be treated as a valid named bundle. The repo currently records `evidence_refs`, but not a named provenance package with validity rules.

Implication for dp-ring:
- A checkpoint/publication decision should eventually carry or reference a **provenance bundle** rather than relying on loose evidence lists plus notes.
- `adopt` and `synthesize` should depend on provenance that is valid enough to support replayable reasoning, not only on score outputs or supervisor preference.
- A synthesis result should not just inherit source evidence refs; it should preserve a named provenance package that explains which inputs, agents, validations, and transforms participated.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning publication validity into an explicit kernel concern.
- **Refines Phase 1** by adding provenance-bundle rules to the acceptance shell now forming around branch status and support/attack semantics.
- **Rejects** any design where branch acceptance is recorded only as an outcome label plus free-form rationale.

Repo-specific consequence:
- `checkpoint.schema.json` needs a docs-level future slot for provenance-bundle/provenance-report references even if runtime code stays untouched this week.
- `branch-event` should eventually point to provenance bundle updates rather than burying provenance consequences in generic `details`.

#### Finding 2: Validation should become a first-class artifact/report, not a boolean helper return
The SHACL specification is highly relevant because it is not just about “constraints exist.” It standardizes validation as a report artifact with a conformance bit, a set of results, and per-result severities, while also allowing provenance metadata to travel with the report.

Implication for dp-ring:
- Validation in Phase 1 should eventually produce a **validation report** artifact/profile, not just `{ valid, errors }`.
- A useful dp-ring report would likely include at least:
  - overall `conforms`
  - result list with severity
  - source rule/shape/constraint identifiers
  - target artifact/checkpoint refs
  - optional provenance metadata linking the report to the evidence/provenance bundle it checked
- Publication readiness should be defined partly by which validation profile was applied and what severities remain open, not only by whether a generic validator returned success.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving publication validity and branch acceptance a concrete report form.
- **Refines Phase 1** by suggesting that support/attack / defended-status work should culminate in explicit validation outcomes, not only internal reasoning state.
- **Strengthens Phase 2** because rich nodes can project compact validation reports outward without exposing local internals.
- **Rejects** any near-term design where schema validation remains an implementation detail with no durable, queryable report surface.

Repo-specific consequence:
- `ring/lib/validator.mjs` is currently too thin as the semantic endpoint; the next docs-level design should specify a report artifact/profile before runtime expansion.
- `checkpoint` and `branch-event` should eventually reference validation report IDs rather than copying ad hoc error arrays or note strings.

#### Finding 3: Branch decisions need a small combining algebra plus obligation/advice consequences
The XACML source is useful because it separates three things that dp-ring currently tends to blur together: how multiple rules combine into one decision, which consequences are mandatory, and which guidance is advisory only.

Implication for dp-ring:
- Phase 1 needs a small **decision-combining** layer for when checkpoint policy, branch status, support/attack state, and validation results disagree.
- Governance outcomes should distinguish at least:
  - **mandatory consequences** (`obligation` / guard / required review / required wait / required replay)
  - **advisory consequences** (`advice` / recommendation / soft nudge)
- `adopt`, `discard`, `synthesize`, and `escalate` should each produce both a decision and an explicit consequence set, instead of overloading score thresholds or prose notes.
- This is the cleanest way to make 聚散离合 actions replayable without turning the kernel into a giant if/else nest.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening declarative governance constraints and decision consequences.
- **Refines Phase 1** by making guard/lifecycle work more concrete: not every output is a permission; some are obligations, some are advice, and they should combine predictably.
- **Rejects** any design where branch-event history records only that a decision happened, without recording the binding consequences that followed from it.

Repo-specific consequence:
- `branch-event.schema.json` needs a docs-level future split between decision, decision basis, mandatory consequences, and advisory consequences.
- The next planning artifact should specify how consequence classes map onto existing operations without yet editing runtime code.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It further refines the still-active Phase 1 by adding a missing artifact layer around provenance validity, structured validation, and decision consequences.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing shell is now sharper: provenance-valid publication bundles, SHACL-like validation reports, and XACML-like consequence semantics over branch decisions.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can continue projecting outward only compact provenance summaries, validation reports, and decision-relevant support/attack status instead of leaking internals.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define support/attack and acceptance-status semantics as the branch meaning layer
- add a provenance-bundle rule for publication/checkpoint decisions
- add a validation-report profile with `conforms`, per-result severity, and provenance linkage
- add a small decision-combining / obligation-vs-advice consequence model for `adopt / discard / synthesize / escalate`
- keep scalar metrics (`divergence`, `composability`, `governancePressure`, `effectiveForce`) as ranking/explanatory inputs inside that shell rather than as the shell itself

Phase 2 should now be read more precisely as:
- require rich nodes to project provenance summaries, validation-report refs, and acceptance/consequence summaries under `contract_projection`
- keep richer local retrieval/planning/reasoning internals encapsulated behind node boundaries
- prove that local richness still projects into a globally simple provenance + validation + decision shell

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `provenance bundle + validation report + decision consequence` work before more metric tuning or node proliferation
- treat current scores as pressure signals, not as publication validity or binding governance consequences
- connect the previous pass’s support/attack / acceptance-profile work to these new artifacts instead of opening a separate governance theory line
- do not jump to UI/operator projection, Rust control-plane expansion, or richer node internals before this artifact layer exists

### Recommended next research slice
The next pass should reduce development risk by translating these findings into explicit repo-shaped tables/specs:

1. **checkpoint / publication provenance-bundle sketch**
   - define minimal durable fields for provenance bundle IDs, scope, equivalence/validity notes, and how synthesis/adoption reference them
2. **validation-report profile for dp-ring artifacts**
   - map `conforms`, result severities, source-rule IDs, target refs, and provenance metadata onto current checkpoint/branch-event usage without editing runtime code yet
3. **decision consequence table for branch operations**
   - define how `continue / adopt / discard / synthesize / escalate` emit decisions, obligations, and advice when support/attack status, validation results, and policy pressure disagree

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- stop treating `evidence_refs` as if they already amount to provenance-valid publication support
- stop treating validator output as if `{ valid, errors }` were a sufficient long-term semantic report format
- stop recording governance outcomes as if a bare event type captured the decision basis and consequence profile
- keep metric work subordinate to provenance / validation / consequence semantics
- preserve the repo’s tree-first / node-centered boundary discipline while making publication validity and governance consequences much more auditable

## 2026-04-19 11:06 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` already gives Phase 1 a live metric substrate (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the next gap is not “invent more scores” but “give publications and decisions a durable semantic container.”
- `.ring/schemas/checkpoint.schema.json` still exposes only `scope_ref`, `policy_snapshot`, `execution_cursor`, `evidence_refs`, `adoption_status`, `replay_state`, and `synthesis_inputs`; this pass’s schema search found no first-class `subject`, `predicateType`, `payloadType`, `signature`, `provenance`, `validation_report`, `ruleId`, `level`, or `baselineState` vocabulary on checkpoint or branch-event artifacts.
- `.ring/schemas/branch-event.schema.json` still records a coarse `event_type` plus permissive `details`, so it remains unable to carry typed publication statements, typed validation logs, or decision predicates without further docs-level structure.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, so the repo has no run/result report shell, no invocation metadata, no severity taxonomy, and no durable diff/baseline model for repeated validation across replay or branch evolution.
- The open Phase 1 gap has therefore narrowed again: dp-ring now has metrics, trace substrate, replay fields, and prior provenance/validation research, but it still lacks a compact **statement / envelope / validation-log** model for making publications and decisions portable, typed, and eventually attestable.

### Sources reviewed

1. in-toto, “Statement layer specification”
   - Official source URL: https://raw.githubusercontent.com/in-toto/attestation/main/spec/v1/statement.md
   - Access note: the canonical spec file in the official in-toto repository was directly reachable.
   - Key evidence: the spec says “The Statement is the middle layer of the attestation, binding it to a particular subject and unambiguously identifying the types of the Predicate.” Its schema contains `_type`, `subject`, `predicateType`, and `predicate`; it also says subjects are assumed to be immutable and that subject artifacts are matched purely by digest.

2. Secure Systems Lab, “DSSE Protocol”
   - Official source URL: https://raw.githubusercontent.com/secure-systems-lab/dsse/master/protocol.md
   - Access note: the canonical protocol document in the official DSSE repository was directly reachable.
   - Key evidence: the spec says the protocol is for creating and verifying signatures “independent of how they are transmitted or stored”; it requires `PAYLOAD_TYPE` to uniquely identify how to interpret the payload; and it says implementations “MUST ensure that the same SERIALIZED_BODY that is verified is the same sent to the application layer” and “MUST NOT re-parse the envelope after verification.”

3. OASIS Standard, “Static Analysis Results Interchange Format (SARIF) Version 2.1.0 Plus Errata 01”
   - Official source URL: https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/sarif-v2.1.0-errata01-os-complete.html
   - Readable extraction used after direct page fetch: https://r.jina.ai/http://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/sarif-v2.1.0-errata01-os-complete.html
   - Access note: the official OASIS HTML specification was directly reachable; `r.jina.ai` was used only to extract readable text from the official document.
   - Key evidence: the spec says “A run object describes a single run of an analysis tool and contains the output of that run”; a run may contain `invocations` and `results`; a result has `ruleId`, `level`, `message`, and `baselineState`; and `baselineState` is defined with `new`, `unchanged`, `updated`, and `absent` values.

### Findings

#### Finding 1: Phase 1 now needs a statement/predicate shell for publications and governance decisions
The in-toto statement spec is useful because it suggests a cleaner container boundary than the repo currently has. Instead of forcing provenance, validation, and governance consequence data directly into `checkpoint` or `branch-event`, it models a stable wrapper that binds a subject to a typed predicate.

Implication for dp-ring:
- A checkpoint-adjacent publication should eventually be representable as a small statement wrapper that says **what immutable subject is being discussed** and **what typed predicate is being asserted** about it.
- The immediate Phase 1 value is not supply-chain tooling; it is a cleaner docs-level split between:
  - **subject identity** (what artifact / checkpoint publication package / decision package is being referred to)
  - **predicate class** (provenance bundle, validation report, governance decision, synthesis justification, etc.)
  - **predicate payload** (the actual provenance/report/decision content)
- This would let dp-ring carry multiple typed views over the same semantic subject without bloating `checkpoint.schema.json` into one giant object.
- It also sharpens an important design constraint: a mutable branch or workflow container is a poor “subject”; the better subject is the immutable publication or decision package referenced by digest or equivalent stable identity.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making publication validity and governance reasoning more artifact-shaped and replayable.
- **Refines Phase 1** by suggesting that provenance, validation, and decision consequences should become typed predicates over stable subjects rather than ad hoc fields on existing artifacts.
- **Strengthens Phase 2** because rich nodes can export multiple compact predicate projections over the same subject without leaking local internals.
- **Rejects** any design where every new semantic layer gets shoved directly into generic checkpoint or branch-event blobs.

Repo-specific consequence:
- The next docs-level artifact should likely define a small statement wrapper / predicate registry rather than immediately widening `checkpoint` and `branch-event` with dozens of unrelated fields.
- Repo search this pass found no current schema vocabulary for `subject`, `predicateType`, or equivalent typed-publication shell on checkpoint/branch-event artifacts.

#### Finding 2: Envelope / integrity concerns should remain separate from semantic statement content
DSSE matters less as a signal to “add signatures now” and more as evidence for a clean boundary: envelope/integrity metadata is one layer, semantic content is another. The strongest line is the requirement that the verified serialized body must be the exact body handed to the application layer.

Implication for dp-ring:
- If dp-ring later wants signed publication bundles, the semantic statement should remain distinct from whatever envelope carries signatures or transport metadata.
- A docs-level publication model should therefore distinguish:
  - **statement/predicate semantics**
  - **optional envelope/integrity metadata**
  - **transport/storage concerns**
- Replay and governance should reason over the semantic body, not over incidental transport wrappers.
- The DSSE “same serialized body” rule also reinforces the earlier replay-first line: if normalized evidence or decision payloads matter, the exact canonicalized body must be what replay and verification operate on.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by preventing provenance-valid publication work from collapsing into transport-specific blobs.
- **Refines Phase 1** by introducing a clean “statement vs envelope” boundary around future publication bundles.
- **Slightly expands the useful boundary** toward optional attestation/integrity design, but only in service of keeping the kernel’s semantic core clean.
- **Rejects** any plan where signature or transport fields are mixed directly into semantic checkpoint content without a layer boundary.

Repo-specific consequence:
- The current repo should not prioritize signature plumbing or cryptographic distribution next.
- But the next docs-level bundle sketch should leave room for an optional envelope layer so provenance/validation/decision payloads do not have to be redesigned later.

#### Finding 3: Validation reports should look like run/result logs with severity and diff semantics, not boolean helper output
SARIF is high-value here because it provides a practical JSON-shaped report surface. It does not stop at “a report exists”; it organizes validation output into runs, invocations, results, rule identifiers, severities, messages, and baseline comparisons across runs.

Implication for dp-ring:
- A Phase 1 validation artifact should eventually look more like a **validation run log** than a boolean return value.
- A useful dp-ring validation report/profile now looks like it should include at least:
  - validator/tool profile
  - invocation metadata
  - result list
  - stable rule/shape/constraint identifiers
  - severity level
  - human/actionable message
  - optional baseline/diff state relative to an earlier checkpoint, replay attempt, or publication version
- `baselineState` is especially useful for dp-ring because replay and branch evolution already exist: the kernel could distinguish issues that are **new**, **unchanged**, **updated**, or **absent** across checkpoint lineage instead of flattening every validation result into a fresh error list.
- This gives a better future home for governance consequences too: new severe failures may trigger obligations, while unchanged low-severity warnings may remain advisory.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making validation a durable artifact with lifecycle and diff semantics.
- **Refines Phase 1** by showing that validation should have run-level context and result-level structure, not just `conforms` plus raw errors.
- **Strengthens Phase 2** because rich nodes can project bounded validation logs upward without exposing all local machinery.
- **Rejects** any design where repeated validation across replay or branch evolution loses the distinction between new, unchanged, and resolved problems.

Repo-specific consequence:
- `ring/lib/validator.mjs` is now even more clearly a provisional substrate rather than the long-term report model.
- The next docs-level validation profile should specify result identifiers, severity, message, invocation metadata, and baseline/diff handling before runtime changes are attempted.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It further refines the still-active Phase 1 by giving publication validity and validation artifacts a tighter container model.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing shell is now more concrete: a statement/predicate wrapper for publications, an optional integrity envelope boundary, and a SARIF-like validation run/result profile.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can project several narrow typed predicates (for example provenance, validation, or decision summaries) over the same subject while keeping local internals encapsulated.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a small statement wrapper for checkpoint/publication/decision artifacts
- define typed predicate classes for provenance bundle, validation report, and governance decision/consequence payloads
- keep any future integrity/signature envelope outside the semantic predicate body
- define a validation-run profile with invocation metadata, result IDs, severity, messages, and baseline/diff semantics
- keep scalar metrics (`divergence`, `composability`, `governancePressure`, `effectiveForce`) as inputs that a governance-decision predicate may cite, rather than treating them as the publication shell itself

Phase 2 should now be read more precisely as:
- require rich nodes to emit typed predicate projections over stable subjects
- allow local nodes to keep richer provenance traces, validation internals, and optional integrity details behind `contract_projection`
- prove that local richness still projects into a globally simple statement/predicate shell

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `statement wrapper + predicate registry + validation run/result profile` work before more metric tuning or node proliferation
- treat any future signature/envelope work as optional scaffolding around the semantic kernel, not as the next mainline
- use SARIF-style baseline/diff thinking to refine how replay or branch evolution should compare validation outcomes
- do not jump to UI/operator projection, Rust control-plane expansion, or richer node internals before this artifact shell exists

### Recommended next research slice
The next pass should reduce development risk by translating these findings into explicit repo-shaped tables/specs:

1. **statement wrapper / predicate registry sketch**
   - map `provenance bundle`, `validation report`, and `governance decision` into a small shared wrapper with stable subject identity and typed predicate classes
2. **validation run/result profile for dp-ring artifacts**
   - define result IDs, severity levels, messages, invocation metadata, and baseline/diff states (`new / unchanged / updated / absent`) without editing runtime code yet
3. **subject identity / digest strategy**
   - decide what the immutable subject should be for Phase 1 publications (for example checkpoint publication package, synthesized output bundle, or decision package) while keeping mutable branch containers out of that role

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- stop treating future provenance/validation work as if it must live directly inside `checkpoint` or `branch-event`
- stop assuming the first publication bundle needs signatures or crypto machinery to be useful; the semantic wrapper comes first
- stop treating repeated validation as a stateless boolean check; Phase 1 now needs result identity, severity, and diff semantics
- keep metric work subordinate to the new statement / validation shell rather than extending scalar heuristics first
- preserve the repo’s tree-first / node-centered boundary discipline while making publication bundles and validation outcomes much more portable and auditable

## 2026-04-19 13:43 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `.ring/schemas/checkpoint.schema.json` still exposes `evidence_refs` as `{ kind, ref, digest }` records but has no first-class subject descriptor, media type, canonicalization profile, or statement wrapper for publication/decision payloads.
- `ring/lib/session-runner.mjs` still emits checkpoint evidence refs with `digest: null` for `execution_packet`, `git_commit`, and output artifacts, so the publication side of the checkpoint tree still cannot name emitted artifacts as immutable subjects even though the schema allows a digest field.
- `ring/lib/orchestrator.mjs` already requires remote dispatch materials to carry `checksum`, verifies both digest and size for fetched buffers, and supports `oci-distribution@1.1`; the repo therefore already has ingress-side content-identity discipline, but not a matching publication-side subject-identity discipline.
- `.ring/schemas/branch-event.schema.json` still records only a coarse event envelope (`event_type`, `branch_id`, `checkpoint_id`, `actor`, `occurred_at`) plus permissive `details`, so governance decisions still lack a canonical subject/predicate payload boundary.
- The open Phase 1 gap is now narrower again: dp-ring needs a docs-level answer for **what immutable thing a checkpoint publication or governance decision actually names**, **how its semantic body is canonicalized for repeatable digesting**, and **what minimal descriptor shape travels with that subject across transport boundaries**.

### Sources reviewed

1. RFC 8785, “JSON Canonicalization Scheme (JCS)”
   - Official source URL: https://www.rfc-editor.org/rfc/rfc8785.txt
   - Access note: the official RFC Editor text was directly reachable.
   - Key evidence: the abstract says “Cryptographic operations like hashing and signing need the data to be expressed in an invariant format so that the operations are reliably repeatable,” and says JCS defines a canonical representation of JSON using deterministic property sorting.

2. RFC 6920, “Naming Things with Hashes”
   - Official source URL: https://www.rfc-editor.org/rfc/rfc6920.txt
   - Access note: the official RFC Editor text was directly reachable.
   - Key evidence: the abstract says the document defines ways to identify a digital object using hash output; later text says storage applications need resources identified “uniquely and in a location-independent way” and need “name-data integrity.”

3. Open Container Initiative image-spec, “OCI Content Descriptors”
   - Official source URL: https://github.com/opencontainers/image-spec/blob/main/descriptor.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/main/descriptor.md
   - Access note: the official raw specification file was directly reachable.
   - Key evidence: the spec says a content descriptor includes the content type (`mediaType`), a content identifier (`digest`), and the byte-size (`size`); it also says descriptors SHOULD be embedded in other formats to securely reference external content.

### Findings

#### Finding 1: Canonicalization must precede digest-based subject identity
RFC 8785 is high-value here because dp-ring has already decided that future publication and decision artifacts should be portable, replayable, and eventually attestable. That only works if the semantic body has one repeatable byte representation. Otherwise a digest becomes an accident of serializer choice rather than a stable identity for a checkpoint publication or governance decision.

Implication for dp-ring:
- A future statement/predicate shell should define **which semantic body is canonicalized** before any digest or immutable subject reference is computed.
- Canonicalization belongs to the semantic publication layer, not just to future signature work.
- Replay should reason over the canonicalized predicate body, not over arbitrary `JSON.stringify` output or transport-specific wrappers.
- Baseline/diff validation reports also benefit from this: result identity becomes more stable if the compared bodies are canonicalized first.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tightening the new statement/predicate shell into a replay-safe serialization rule, not just a schema sketch.
- **Refines Phase 1** by making canonical-body definition part of the governance kernel’s publication semantics.
- **Rejects** any design where future digests are computed over mutable, serializer-dependent checkpoint blobs.

Repo-specific consequence:
- The repo currently has no docs-level canonicalization rule for checkpoint-adjacent publication or decision payloads.
- The next docs artifact should define a canonical predicate-body profile before introducing subject digests into checkpoint/branch-event semantics.

#### Finding 2: The immutable subject should be location-independent and hash-addressed, not a mutable branch container or file path
RFC 6920 matters because it sharpens the “subject identity / digest strategy” question from the last pass. The important move is not merely “use hashes somewhere.” It is that a named object can be referred to in a location-independent way and later verified against the name itself.

Implication for dp-ring:
- `branch_id`, `checkpoint_id`, workflow-run IDs, local file paths, and OCI URLs should remain **context or locator fields**, not the immutable identity of a publication subject.
- The subject of a future statement should instead be an immutable publication package, decision package, or validation package named by content identity.
- This gives dp-ring a cleaner distinction between:
  - **semantic subject identity**
  - **transport locator / retrieval path**
  - **governance context** (branch/checkpoint/session)
- It also aligns with replay: the kernel can verify that the recovered package still matches the subject ID rather than trusting where it was fetched from.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making subject identity auditable and replay-safe.
- **Refines Phase 1** by insisting that immutable publication subjects be separate from mutable branch/workflow containers.
- **Rejects** any near-term design where a path ref, checkpoint ID, or branch ID doubles as the durable identity of a publication/decision payload.

Repo-specific consequence:
- The current `evidence_refs` structure is sufficient as a locator list, but not yet as the durable identity model for statement subjects.
- The next docs-level registry should define what kinds of immutable subject IDs dp-ring will name first (for example publication package, validation report package, governance decision package).

#### Finding 3: OCI-style descriptors give dp-ring a practical subject-reference shape it can adopt without overbuilding
The OCI descriptor spec is useful because it turns the digest-identity discussion into a concrete minimal object: `mediaType`, `digest`, and `size`. That is much closer to what dp-ring needs next than inventing a bespoke reference format from scratch.

Implication for dp-ring:
- A future statement/predicate wrapper can reference its immutable subject through a small descriptor-like object.
- The same descriptor shape can also improve evidence/provenance references by distinguishing semantic type from raw path string.
- `mediaType` clarifies how a predicate or publication package should be interpreted.
- `size` gives a cheap integrity/expectation check alongside digest verification.
- Because the repo already supports OCI transport and checksum verification, this descriptor model fits the current substrate rather than fighting it.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the statement/predicate shell a compact, portable subject-reference shape.
- **Refines Phase 1** by suggesting that dp-ring should standardize subject descriptors before widening checkpoint or branch-event payloads again.
- **Strengthens Phase 3 slightly** because a descriptor-shaped subject model will project cleanly into operator surfaces and transport layers later.
- **Rejects** any design where future publication references stay as path-only strings or free-form `details` blobs.

Repo-specific consequence:
- `ring/lib/orchestrator.mjs` already proves the repo can reason about digest and size at ingress.
- The next docs-level shell should reuse descriptor-like fields for publication subjects and external evidence packages rather than introducing another unrelated identity structure.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It further refines the still-active Phase 1 by making subject identity and canonical serialization concrete prerequisites for the statement/predicate shell.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing shell is now more precise: a canonical predicate body, a location-independent immutable subject, and a compact descriptor that names that subject.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can emit descriptor-backed typed predicates over immutable publication packages without leaking local internals.
- **Phase 3 / Projection** becomes clearer as downstream work: UI, transport, and control-plane layers should project these stable descriptors rather than inventing separate identities later.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a small statement wrapper over immutable subject descriptors rather than mutable branch/workflow containers
- define which predicate bodies are canonicalized before digesting or comparing them
- distinguish subject identity from retrieval locator and governance context
- reuse descriptor-like `{ mediaType, digest, size }` references for publication subjects and portable evidence bundles
- keep any future signature/envelope layer outside this semantic core

Phase 2 should now be read more precisely as:
- require rich nodes to emit typed predicates over immutable descriptor-backed subjects
- allow local nodes to keep richer retrieval/planning/provenance internals behind `contract_projection`
- export descriptor-backed publication packages, validation packages, and decision packages rather than raw path refs alone

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `subject descriptor + canonicalization profile + statement-wrapper mapping` work before more metric tuning or node proliferation
- leverage the repo’s existing checksum/OCI substrate rather than opening a separate identity framework
- keep branch/checkpoint IDs as governance context, not as the immutable publication subject
- do not jump to signatures, UI/operator projection, Rust control-plane expansion, or richer node internals before the subject/descriptor shell is specified

### Recommended next research slice
The next pass should reduce development risk by turning this into explicit repo-shaped tables/specs:

1. **subject descriptor registry sketch**
   - define the minimal descriptor fields for `publication package`, `validation report package`, and `governance decision package`, and show how they attach to checkpoints and branch events without changing runtime code yet
2. **canonical predicate-body profile**
   - specify which dp-ring payloads must be canonically serialized before digesting, diffing, or replay comparison, and which fields are outside that canonical body
3. **identifier vs locator policy table**
   - map `checkpoint_id`, `branch_id`, local file path, OCI URL, checksum, and future descriptor fields into separate roles so the kernel stops overloading one field for identity, context, and retrieval

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- stop treating path refs or checkpoint IDs as if they were enough to identify the subject of a future statement/predicate
- stop assuming an optional `digest` field solves subject identity without a canonical body rule
- stop adding more semantics to `branch-event.data.details` before a descriptor-backed statement shell exists
- keep metric work subordinate to the subject/descriptor/canonicalization shell rather than extending scalar heuristics first
- preserve the repo’s tree-first / node-centered boundary discipline while making publication subjects and decision packages portable, verifiable, and replay-safe

## 2026-04-19 15:02 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- Contrary to the immediately prior memo slice, the live repo now **does** contain a first-class governance statement shell:
  - `.ring/schemas/governance-statement.schema.json` requires `_type`, `subject`, `predicateType`, `predicate`, and `canonicalization`.
  - `ring/lib/governance-statement.mjs` exports `createGovernanceStatement`, `createCheckpointPublicationStatement`, and `createBranchCommitStatement`, and canonicalizes bodies via sorted JSON-like serialization before digesting them.
  - `.ring/schemas/checkpoint.schema.json` now requires `publication_statements`.
  - `.ring/schemas/branch-event.schema.json` now includes `message_class` and `statement`, and requires `statement` when `message_class` is `commit`.
  - `ring/lib/session-runner.mjs` publishes checkpoint publication statements and branch commit statements into the live checkpoint/branch-event flow.
- Targeted live verification this pass (`node --test tests/ring/governance-statement.test.mjs tests/ring/session-runner.test.mjs tests/ring/validator.test.mjs`) passed, confirming the statement shell is not only schema-declared but exercised in runtime/tests.
- Repo search this pass still finds **no** first-class package/root vocabulary for `manifest`, `artifactType`, `index.json`, `oci-layout`, or `referrers` in `.ring/schemas/*.json`.
- Repo search also still finds **no** first-class validation run/result artifact family (`validation_report`, `baselineState`, `invocation`, `ruleId`, `level`) beyond the existing boolean validator return and workflow-run report fields.
- The open Phase 1 gap has therefore shifted again: the compact statement shell has landed, but dp-ring still lacks a **package/root model** for bundling statements, validation artifacts, and later provenance/acceptance artifacts into replayable publication units.

### Sources reviewed

1. Open Container Initiative image-spec, “OCI Image Manifest Specification”
   - Official source URL: https://github.com/opencontainers/image-spec/blob/main/manifest.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/main/manifest.md
   - Access note: the canonical spec file in the official OCI repository was directly reachable.
   - Key evidence: the spec defines `artifactType`, and the `subject` property is described as an optional descriptor of another manifest that creates a weak association to a separate Merkle DAG structure.

2. Open Container Initiative image-spec, “OCI Image Index Specification”
   - Official source URL: https://github.com/opencontainers/image-spec/blob/main/image-index.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/main/image-index.md
   - Access note: the canonical spec file in the official OCI repository was directly reachable.
   - Key evidence: the index is described as a “higher-level manifest”; the required `manifests` property contains a list of manifests; and the index also carries optional `artifactType` and `subject` fields.

3. Open Container Initiative image-spec, “OCI Image Layout Specification”
   - Official source URL: https://github.com/opencontainers/image-spec/blob/main/image-layout.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/main/image-layout.md
   - Access note: the canonical spec file in the official OCI repository was directly reachable.
   - Key evidence: the layout defines a local directory structure with a `blobs` directory of content-addressable blobs, an `oci-layout` marker file, and an `index.json` file as the entry point for references and descriptors.

### Findings

#### Finding 1: dp-ring has crossed the “missing statement shell” boundary; the next gap is packaging, not wrapper invention
The live repo now materially contradicts the previous memo’s sharper gap statement. `governance-statement.schema.json` and `governance-statement.mjs` already give dp-ring the compact `subject` / `predicateType` / `predicate` / `canonicalization` shell that prior passes were asking for, and `session-runner.mjs` already uses it for checkpoint publication and branch-event commit projection.

Implication for dp-ring:
- The next docs-level work should stop talking as if the statement wrapper is absent.
- Phase 1 should now focus on how multiple governance artifacts are bundled and rooted together:
  - checkpoint publication statement
  - branch commit / decision statement
  - future validation report package
  - future provenance / acceptance package
- The remaining risk is not “how do we invent a wrapper?” but “how do we keep the wrapper from collapsing back into inline arrays and ad hoc nested blobs?”

Comparison against the canonical mainline:
- **Strengthens Phase 1** by confirming that the mainline research has already started landing in live schemas/runtime.
- **Refines Phase 1** by moving the active semantic gap from wrapper design to package/root semantics.
- **Rejects** continued recurring-pass claims that the repo still lacks any first-class statement shell.

Repo-specific consequence:
- `checkpoint.data.publication_statements` and `branch-event.data.statement` are currently inline embeddings.
- The next docs artifact should explain whether these are the long-term public shape or merely in-repo projections of a higher-level package model.

#### Finding 2: OCI manifests give the next missing unit — a typed package attached to a subject, not more fields inside `checkpoint` or `branch-event`
The OCI manifest spec is useful here because it introduces exactly the next layer above descriptors: a typed artifact package (`artifactType`) that may point at a `subject` descriptor without mutating the subject itself. That is a much cleaner fit for dp-ring’s emerging governance shell than pushing more statement, validation, and provenance detail directly into checkpoint or branch-event schemas.

Implication for dp-ring:
- A future **publication package**, **validation report package**, or **governance decision package** can be modeled as a typed package with its own descriptor-backed identity.
- `checkpoint` and `branch-event` can then carry lightweight projections or refs rather than becoming ever-expanding semantic containers.
- Subject identity stays immutable while attached packages accumulate around it.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the new statement shell a package boundary that preserves replay-safe identity.
- **Refines Phase 2** because rich nodes can emit package-backed governance artifacts without leaking internals.
- **Rejects** any design where the immediate answer to new semantics is “add another nested field under `checkpoint.data` or `branch-event.data.details`.”

Repo-specific consequence:
- The repo now has descriptor-backed statements but no schema-level `artifactType` / package class / manifest root model.
- The next docs-level spec should define package classes before the inline statement embeddings harden into the only artifact shape.

#### Finding 3: OCI index/layout semantics suggest a checkpoint should have a stable publication root, not just scattered inline attachments
The OCI index and layout specs matter because they provide two missing ideas at once:
- a **root object** (`index.json` / index manifest) that enumerates related manifests
- a **portable local storage layout** (`blobs`, `oci-layout`, `index.json`) for replayable content-addressed artifacts

Implication for dp-ring:
- A checkpoint or branch-state publication could eventually have a small **root index** that groups:
  - the checkpoint publication statement
  - the branch commit or adoption/synthesis decision package
  - the validation report package
  - later support/attack or acceptance-status packages
- This keeps “what belongs to this checkpoint publication cycle?” answerable without overloading the checkpoint artifact itself.
- It also aligns with local-first replay: content-addressed blobs can live locally without requiring a registry or Rust control plane to exist first.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by showing how the already-landed statement shell can become a replayable publication unit.
- **Strengthens Phase 3 slightly** because a root index will project cleanly to registries, APIs, and operator surfaces later.
- **Rejects** ad hoc file-tree conventions as the long-term publication/root model.

Repo-specific consequence:
- The repo already supports OCI-like ingress behavior in `ring/lib/orchestrator.mjs`, but the governance artifact side still lacks a local publication-root spec.
- The next docs-level artifact should define a root index / package membership model before transport work or UI projection.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by correcting the live repo diagnosis: the statement shell is present, so the sharper missing shell is now **package/root semantics around governance statements and future validation artifacts**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the repo now has a verifiable statement shell and the next gap is more concrete: package classes, root indexes, and inline-to-package projection rules.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can emit package-backed governance artifacts without forcing a free-form global graph.
- **Phase 3 / Projection** is clarified as downstream: OCI registry/referrers/API/UI projection should come only after local package/root semantics are nailed down.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell (`subject`, `predicateType`, `predicate`, `canonicalization`)
- define package classes for at least `checkpoint publication`, `branch decision`, and `validation report`
- define a root index shape that groups related packages for one checkpoint / branch publication cycle
- keep inline checkpoint/branch-event statement embeddings as projections or bootstrapping conveniences, not the final package model
- continue treating validation-report semantics and support/attack semantics as predicate families that fit inside this package/root shell

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- stop reporting the repo as if it still lacked a first-class statement shell; live inspection now disproves that
- prioritize docs-level `package class + root index + inline projection rule` work before more metric tuning or node variety work
- keep OCI registry/referrers/transport work explicitly downstream of the local semantic package model
- do not jump to Rust control-plane, UI surfaces, or richer node internals because the next kernel task is still semantic packaging, not product projection

### Recommended next research slice
The next pass should reduce development risk by turning the newly landed statement shell into repo-shaped package semantics:

1. **governance package profile sketch**
   - define minimal package classes for `checkpoint publication`, `branch decision`, and `validation report`, including which statement/predicate each package must contain

2. **checkpoint publication root index**
   - define how a checkpoint or branch cycle groups related packages under one root index without overloading `checkpoint` itself as the immutable subject

3. **inline-to-package projection table**
   - map current inline fields (`checkpoint.data.publication_statements`, `branch-event.data.statement`) to their future package/root positions so Phase 1 can evolve without breaking the current substrate

## 2026-04-19 16:23 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics already exist (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the live gap is still semantic shell, not metric absence.
- `.ring/schemas/governance-statement.schema.json`, `.ring/schemas/checkpoint.schema.json`, `.ring/schemas/branch-event.schema.json`, and `ring/lib/session-runner.mjs` still confirm that the compact governance-statement shell is landed and inline in the live runtime.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and `ring/lib/store.mjs` still writes directly off that shape.
- Targeted file search this pass still finds **no** first-class `*package*.json` or `*validation*.json` schemas under `.ring/schemas/`.
- The sharper open Phase 1 gap is therefore now: dp-ring still lacks a **self-describing publication root** for one checkpoint/branch publication cycle, and still lacks a **normalized validation output unit/profile** that can grow beyond raw Ajv error arrays without abandoning the current JSON Schema substrate.

### Sources reviewed

1. RO-Crate 1.1, “Root Data Entity” and “RO-Crate Structure”
   - Official source URLs:
     - https://www.researchobject.org/ro-crate/specification/1.1/root-data-entity.html
     - https://www.researchobject.org/ro-crate/specification/1.1/structure.html
   - Access note: both official pages were directly reachable.
   - Key evidence: the spec says the Root Data Entity is a `Dataset` representing the crate as a whole; the metadata descriptor MUST have an `about` property referencing the Root Data Entity; that descriptor SHOULD declare a versioned `conformsTo`; and the crate root is identifiable by the presence of `ro-crate-metadata.json`.

2. JSON Schema Core Draft 2020-12, section 12 “Output Formatting”
   - Official source URL: https://json-schema.org/draft/2020-12/json-schema-core.html#section-12
   - Access note: the official page was directly reachable.
   - Key evidence: the spec defines `flag`, `basic`, `detailed`, and `verbose` output formats; says each sub-result SHOULD contain minimum information; defines an `output unit`; and names `keywordLocation`, `absoluteKeywordLocation`, `instanceLocation`, `error` / `annotation`, and nested `errors` / `annotations` as the standard structural keys beyond the top-level boolean `valid`.

3. Repo inspection for live grounding
   - `ring/lib/validator.mjs`
   - `ring/lib/store.mjs`
   - `ring/lib/session-runner.mjs`
   - `.ring/schemas/governance-statement.schema.json`
   - `.ring/schemas/checkpoint.schema.json`
   - `.ring/schemas/branch-event.schema.json`
   - targeted schema file search under `.ring/schemas/`

### Findings

#### Finding 1: The package/root shell needs a self-describing root marker, not just descriptor-like members
The recent OCI-aligned memo slices already sharpened the need for a root index and package classes. The RO-Crate material adds one more concrete requirement: the root should not just enumerate members; it should explicitly declare **what profile it conforms to** and **what whole it is about**. That makes the root discoverable and versioned even before any transport or registry layer exists.

Implication for dp-ring:
- A Phase 1 publication root should probably declare at least:
  - a profile/version URI (`conformsTo`-like)
  - a root subject (`about`-like) for one checkpoint or branch publication cycle
  - a stable root marker file/artifact so local replay can find the package root deterministically
  - membership links to the publication/decision/validation packages that belong to that cycle
- This is a refinement of the existing package/root line, not a change in direction.
- The important lesson is **self-describing package identity**, not adoption of JSON-LD or the full RO-Crate ecosystem.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the package/root shell more concrete and replay-discoverable.
- **Refines Phase 1** by adding a profile/root-subject requirement on top of the already-identified OCI-like membership model.
- **Rejects** any design where package membership exists but the root itself is an unlabeled blob or directory convention with no explicit profile marker.

Repo-specific consequence:
- The current repo has inline statements but no root marker artifact, no package profile URI, and no root-membership model for one publication cycle.
- The next docs-level kernel artifact should define a small root profile before more package classes proliferate.

#### Finding 2: Validation artifacts should normalize around output units with schema/instance locations, not raw error blobs
Earlier memo slices already pushed validation toward run/result logs, SARIF-like diff semantics, and SHACL-style report/result separation. The JSON Schema output section sharpens this further in a repo-native way because dp-ring already uses Ajv and `.ring/schemas/*.schema.json`. The near-term validation shell should therefore inherit JSON Schema’s structural discipline instead of inventing a parallel opaque result format.

Implication for dp-ring:
- A Phase 1 validation package should likely separate:
  - a run/report root (`valid` / `conforms`, invocation metadata, summary counts)
  - normalized result units carrying at least `keywordLocation`, `instanceLocation`, `error`, and optionally `absoluteKeywordLocation` plus nested child results
- dp-ring-specific additions such as `result_id`, `severity`, `baseline_state`, `validator_run_id`, and `statement_ref` can layer on top of that output-unit core.
- This gives a cleaner bridge from current Ajv output to later governance-facing validation packages.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding validation artifact design in the live validator substrate instead of a purely aspirational report model.
- **Refines Phase 1** by saying exactly what the minimum normalized validation unit should carry before severity/baseline overlays are added.
- **Rejects** any design where the first validation package is just a copied `errors` array or a prose summary with no stable schema/instance locations.

Repo-specific consequence:
- `ring/lib/validator.mjs` and `ring/lib/store.mjs` are still positioned around `{ valid, errors }`, which is enough for writes but not enough for replayable validation packages.
- The next docs-level validation profile should explicitly map raw Ajv output into normalized result units rather than replacing Ajv or inventing an unrelated validation stack.

#### Finding 3: The active Phase 1 gap is now a two-part shell: publication root profile + validation unit profile
This pass narrows the open kernel work further than the previous memo slice. The problem is no longer just “package/root semantics” in the abstract. It is now two coupled docs-level profiles:
1. a **publication root profile** for one checkpoint/branch publication cycle
2. a **validation unit profile** for the validation member that may attach to that root

Implication for dp-ring:
- `checkpoint.data.publication_statements` and `branch-event.data.statement` should be treated as inline projections into a future root package, not as the long-term public package boundary.
- The validation family should plug into that same root through a normalized report/result structure rather than becoming another special-case blob.
- This keeps Phase 1 focused on the semantic shell immediately around the landed statement layer.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning a broad package/root gap into two explicit profile-design tasks.
- **Does not change the spine**; it only sharpens the current phase.
- **Rejects** jumping ahead to richer node internals, transport registries, or UI projection before these two profiles exist.

Repo-specific consequence:
- The next useful docs artifact is not more runtime metric work and not a Rust/service scaffold.
- It is a small, repo-shaped spec that says how one publication cycle is rooted and how one validation result is normalized inside that root.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by tightening the open semantic shell around the already-landed governance statements.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing shell is now more precise: a self-describing publication root profile and a normalized validation unit profile.
- **Phase 2 / Heterogeneous node ecology** is strengthened because rich nodes can later emit publication/validation packages into a stable root without leaking internals.
- **Phase 3 / Projection** remains downstream: APIs, registries, and operator surfaces should project these stable root/profile semantics rather than inventing their own package models.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- define a self-describing root profile for one checkpoint/branch publication cycle
- define membership rules from that root to `checkpoint publication`, `branch decision`, and `validation report` packages
- define a normalized validation unit profile adapted from JSON Schema output structure
- keep inline checkpoint/branch-event statement embeddings as projections or caches, not the final semantic package boundary

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `publication root profile + validation unit profile + inline projection table` work before more metric tuning or node variety work
- keep using the current Ajv/JSON Schema substrate as the starting point for validation packages
- keep transport/registry/signature concerns explicitly downstream of the local semantic package model
- do not jump to Rust control-plane, UI surfaces, or richer node internals because the next kernel task is still profile design around the landed statement shell

### Recommended next research slice
The next pass should reduce development risk by turning these two profiles into explicit repo-shaped tables/specs:

1. **publication root profile sketch**
   - define the root marker artifact for one checkpoint/branch publication cycle, including `profile_uri`, `about_subject`, root identity, and membership rules

2. **validation unit normalization table**
   - map current Ajv `{ valid, errors }` output into a durable result-unit structure with `keywordLocation`, `absoluteKeywordLocation?`, `instanceLocation`, `error`, nested results, and dp-ring overlays such as `result_id`, `severity`, and `baseline_state`

3. **inline-to-root projection rule**
   - map `checkpoint.data.publication_statements` and `branch-event.data.statement` to package members under the future root, and say clearly whether inline copies are authoritative, derived, or cache-like bootstrapping projections

### Recommended immediate effect on planning
For the near-term dp-ring mainline:
- stop treating package/root work as only a membership-list problem; the root must also be self-describing and profile-versioned
- stop treating validation-package work as merely “add severity to errors”; the result units need normalized schema/instance locations first
- stop inventing separate validation semantics detached from the current Ajv/JSON Schema substrate
- keep metric work subordinate to the publication-root / validation-unit shell rather than extending scalar heuristics first
- preserve the repo’s tree-first / node-centered boundary discipline while making one publication cycle and one validation cycle auditable as portable semantic units

## 2026-04-19 17:38 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics already exist (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the live gap is still semantic shell, not metric absence.
- `.ring/schemas/governance-statement.schema.json`, `.ring/schemas/checkpoint.schema.json`, `.ring/schemas/branch-event.schema.json`, and `ring/lib/session-runner.mjs` still confirm that the compact governance-statement shell is landed and still inline in the live runtime.
- `ring/lib/validator.mjs` and `ring/lib/store.mjs` still operate on `{ valid, errors }` only.
- Targeted search across `.ring/schemas/` and `ring/lib/` this pass still finds no first-class `publication_root`, `profile_uri`, `about_subject`, `result_id`, `validator_run_id`, `baseline_state`, `ValidationReport`, or `resultSeverity` symbols.
- Targeted search across `.ring/schemas/` and `ring/lib/` this pass also still finds no first-class `support_relation`, `attack_relation`, `defended`, `contested`, `skeptical`, `credulous`, `contrary_handling`, or `assumption_ledger` vocabulary.
- The sharper open Phase 1 gap is therefore now: dp-ring still lacks a **publication-root bundle profile** that is itself a governed subject, and still lacks a **validation report/result family** rich enough to carry conformance, severity, invocation, and baseline-diff semantics without abandoning the current JSON Schema / Ajv substrate.

### Sources reviewed

1. W3C PROV-DM, section on bundles
   - Official source URL: https://www.w3.org/TR/prov-dm/
   - Access note: the official page was directly reachable in browser and terminal.
   - Key evidence: the spec says “A bundle is a named set of provenance descriptions, and is itself an entity, so allowing provenance of provenance to be expressed.”

2. W3C SHACL, validation report / validation result sections
   - Official source URL: https://www.w3.org/TR/shacl/#validation-report
   - Access note: the official page was readable in browser, while direct terminal `curl` hit a TLS EOF; browser DOM extraction was used for the normative text.
   - Key evidence: SHACL says the result of validation has exactly one `sh:ValidationReport`, that report carries `sh:conforms`, and each `sh:result` is a `sh:ValidationResult`; it also says `sh:focusNode`, `sh:resultSeverity`, and `sh:sourceConstraintComponent` are mandatory for all validation results.

3. OASIS SARIF 2.1.0, run / invocations / level / baselineState sections
   - Official source URL: https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
   - Access note: the official page was directly reachable in browser and terminal.
   - Key evidence: SARIF says “A run object describes a single run of an analysis tool,” that a run may contain an `invocations` array describing that run, that each result may carry a severity `level`, and that `baselineState` may classify a result as `new`, `unchanged`, `updated`, or `absent` relative to a previous run.

### Findings

#### Finding 1: PROV bundles sharpen the missing publication root from a membership list into a governed subject with provenance of publication
The bundle concept adds a stronger semantic requirement than the previous memo’s root-index language. A publication root should not only enumerate members; it should itself be a named semantic unit that can carry provenance, issuance, and validation context.

Implication for dp-ring:
- A checkpoint/branch publication cycle should likely become a first-class **publication root / bundle artifact**, not merely a JSON object that lists statement members.
- That root can then be the stable “about” subject for publication provenance, validation provenance, and later decision/acceptance overlays.
- This keeps inline statement projections lightweight while giving the whole publication cycle a durable semantic identity.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the package/root shell more than a container; it becomes a governed semantic unit.
- **Refines Phase 1** by saying the next artifact is not just an OCI-like membership index, but a root that can itself be referenced, validated, and provenance-tracked.
- **Rejects** any design where publication grouping is only an unlabeled array or file-tree convention.

Repo-specific consequence:
- `checkpoint.data.publication_statements` and `branch-event.data.statement` should be treated as members or projections of a future publication-root bundle, not as the final public package boundary.
- The next docs-level kernel artifact should define the publication root as a subject with identity, membership rules, and provenance hooks.

#### Finding 2: SHACL sharpens validation into a two-tier semantic family: one report root plus typed result units
The SHACL validation model is valuable because it separates overall conformance from individual findings. That is exactly the missing shape between today’s `{ valid, errors }` return value and the future validation package family.

Implication for dp-ring:
- A Phase 1 validation package should likely contain one **validation report** root with overall `conforms` / summary state.
- That report should link to **validation result** units, each carrying at least a subject/focus target, severity, and source constraint identifier, with optional path/detail fields.
- dp-ring can adapt this structure to JSON artifacts without adopting RDF as a runtime substrate.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the validation artifact family concrete and layered.
- **Refines Phase 1** by clarifying that severity belongs on individual result units under a report root, not only on the report summary.
- **Rejects** any design where validation remains just a flat copied Ajv `errors` array or a prose summary with no report/result distinction.

Repo-specific consequence:
- `ring/lib/validator.mjs` and `ring/lib/store.mjs` remain the right substrate, but they still need a docs-level projection from raw Ajv output into report/result artifacts.
- The next validation profile should map current schema checks into one report root plus normalized result units instead of extending `{ valid, errors }` in place.

#### Finding 3: SARIF says validation also needs run/invocation and baseline-diff overlays, but only after the report/result core exists
SARIF adds the missing operational layer around validation results: who ran the validator, under what invocation sequence, and how current findings compare with a baseline. This is directly relevant to dp-ring’s replayable checkpoint/publication cycles.

Implication for dp-ring:
- A validation package should eventually carry **run metadata** such as validator identity, invocation details, and possibly conversion/tooling context.
- It should also support optional **baseline-state** overlays (`new`, `unchanged`, `updated`, `absent`) so checkpoint publication cycles can compare validation drift over time.
- These overlays should sit on top of a stable report/result shape, not replace it.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning validation artifacts into replayable operational records rather than static pass/fail blobs.
- **Refines Phase 1** by separating core validation result structure from optional run/baseline overlays.
- **Rejects** the tempting shortcut of adding `severity` and `baseline` fields directly to today’s raw error array without a report root or validator-run context.

Repo-specific consequence:
- There is still no first-class place in `.ring/schemas/` for invocation metadata, validator-run identity, or baseline comparison state.
- The next docs-level validation artifact should define these as overlays on a report/result family, not as ad hoc additions to `checkpoint` or `branch-event`.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by tightening the shell immediately around the already-landed governance statements.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication-root gap is now more precise: the root should behave like a named semantic bundle subject, not just a member list.
- **Phase 1 / Governance kernel** is also strengthened because the validation family is now more precise: one report root, many result units, then optional invocation/baseline overlays.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later publish statements, validation reports, and decision overlays into one stable root without leaking internals.
- **Phase 3 / Projection** remains downstream: APIs, registries, operator views, and Rust/control-plane work should project these stable root/report semantics rather than invent them.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- define a **publication-root bundle profile** whose root is itself a governed semantic subject
- define a **validation report profile** with one report root and many result units
- add **validator-run / invocation / baseline-diff overlays** only after the report/result core exists
- keep inline checkpoint/branch-event statements as projections or cached members under that future root bundle
- keep support/attack and acceptance-status semantics as the next attached predicate family, not as scattered runtime strings

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `publication-root bundle + validation report/result + invocation/baseline overlay` work before more metric heuristics or node variety work
- keep the current Ajv / JSON Schema substrate and adapt SHACL/SARIF-like structure around it rather than replacing it with a different validation stack
- do not add severity/baseline metadata directly to raw Ajv error blobs without first defining the report/result shell
- do not jump to Rust control-plane, UI surfaces, or richer node internals because the next kernel task is still semantic shell design around the landed statement layer

### Recommended next research slice
The next pass should reduce development risk by grounding the still-missing **acceptance semantics** that will attach to the publication root alongside validation:

1. **support/attack relation vocabulary**
   - use a primary-source argumentation line to define how branches, assumptions, or evidence units can support or attack one another without collapsing into free-form graph chaos

2. **acceptance-status lattice**
   - define whether dp-ring needs statuses such as `defended`, `accepted`, `defeated`, `rejected`, or `contested`, and how these relate to `adoption_status` and supervisor decisions

3. **bundle membership / projection table**
   - map `checkpoint.data.publication_statements`, `branch-event.data.statement`, and the future validation report family into one publication-root bundle so the semantics stay replayable and tree-first

## 2026-04-19 19:10 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics already exist (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the live gap is still semantic shell, not metric absence.
- `.ring/schemas/governance-statement.schema.json`, `.ring/schemas/checkpoint.schema.json`, `.ring/schemas/branch-event.schema.json`, and `ring/lib/session-runner.mjs` still confirm that the compact governance-statement shell is landed and inline in the live runtime.
- `.ring/schemas/checkpoint.schema.json` still exposes only lifecycle-oriented `adoption_status` values (`candidate`, `mainline`, `discarded`, `synthesized`) and does not define a separate acceptance-status family.
- Targeted search across `.ring/schemas/*.json` and `ring/lib/*.mjs` this pass still finds no first-class `support_relation`, `attack_relation`, `assumption_ledger`, `contrary`, `acceptance_status`, `acceptance_profile`, `credulous`, `skeptical`, `defended`, or `contested` vocabulary.
- The sharper open Phase 1 gap is therefore now: dp-ring still lacks the **acceptance-semantics layer** that should attach to the already-identified publication-root bundle + validation report shell — specifically explicit support/attack relations, assumption/contrary semantics, and profile-aware acceptance statuses beyond the current lifecycle `adoption_status`.

### Sources reviewed

1. C. Cayrol, M. C. Lagasquie-Schiex, “On the Acceptability of Arguments in Bipolar Argumentation Frameworks”
   - Official source URL: https://link.springer.com/chapter/10.1007/11518655_33
   - Access note: the official Springer page was directly reachable in browser automation.
   - Key evidence: the abstract says the framework takes into account “two independent kinds of interaction between arguments: a defeat relation and a support relation,” focuses on “acceptability,” and “generalize[s] the well-known stable and preferred semantics by enforcing the coherence requirement for an acceptable set of arguments.”

2. Phan Minh Dung, Robert A. Kowalski, Francesca Toni, “Assumption-Based Argumentation”
   - Official source URL: https://link.springer.com/chapter/10.1007/978-0-387-98197-0_10
   - Readable fallback used after direct page discovery: https://r.jina.ai/http://link.springer.com/chapter/10.1007/978-0-387-98197-0_10
   - Access note: the official Springer page was directly reachable; `r.jina.ai` was used only to extract the preview text cleanly.
   - Key evidence: the preview says ABA “was developed, starting in the 90s, as a computational framework,” and that it was inspired by the “acceptability of negation-as-failure assumptions based on the notion of ‘no-evidence-to-the-contrary’.”

3. Sylvie Doutre, Jérôme Mengin, “On Sceptical Versus Credulous Acceptance for Abstract Argument Systems”
   - Official source URL: https://link.springer.com/chapter/10.1007/978-3-540-30227-8_39
   - Access note: the official Springer page was directly reachable in browser automation.
   - Key evidence: the abstract says acceptable sets of arguments, “called extensions,” are sets that do not contradict one another and attack all their attackers; it asks whether an argument is “in all extensions”; and it adds that useful AI output is not a simple yes/no answer but “some kind of well-argued answer, called a proof.”

### Findings

#### Finding 1: dp-ring now needs explicit support/attack relation vocabulary under the publication root, not only conflict hints or scalar branch metrics
The bipolar-acceptability paper sharpens the next missing semantic family after publication roots and validation reports. Once governance statements are bundled, the next layer should not be more free-form prose under `branch-event.data.details`; it should be explicit relation members saying that one published claim/evidence/branch position supports or attacks another.

Implication for dp-ring:
- The next docs-level kernel artifact should define a small relation vocabulary under the future publication-root bundle, at least:
  - support / defeat (attack) relation types
  - source/target member refs or subject refs
  - optional coherence / rationale metadata
- This gives `divergence`, `composability`, and later acceptance states a semantic basis stronger than scalar heuristics alone.
- It keeps the system tree-first globally while allowing typed non-structural relations locally within one publication cycle.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the publication-root shell its next semantic member family.
- **Refines Phase 1** by moving beyond generic conflict vocabulary toward typed support/attack relations.
- **Rejects** the tempting shortcut of growing `branch-event.data.details` into an untyped relation dump or turning the whole kernel into a free-form graph.

Repo-specific consequence:
- The live repo still has `message_class`, inline statements, and branch metrics, but no first-class support/attack vocabulary.
- The next docs spec should add this vocabulary around the publication root before any new runtime metric proliferation.

#### Finding 2: acceptance should be grounded in assumptions and contraries, not only branch-level lifecycle fields
The ABA chapter is the strongest line for turning dp-ring’s future acceptance layer into something governable rather than mystical. The notion that assumption acceptability depends on “no-evidence-to-the-contrary” gives dp-ring a clean way to think about branch claims, evidence, and rebuttal without making the global structure graph-chaotic.

Implication for dp-ring:
- A publication root should eventually be able to carry or reference a lightweight **assumption ledger**:
  - what assumptions/claims this branch publication is relying on
  - what contrary or defeating evidence has been observed
  - what evidence currently defends those assumptions
- `adoption_status` should remain a lifecycle/governance field, but it is not enough to express epistemic standing.
- A future acceptance layer should therefore sit alongside `adoption_status`, not replace it.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tying acceptance semantics to evidence and contrary handling rather than opaque supervisor judgment.
- **Strengthens Phase 2** because rich nodes can keep local reasoning internals private while projecting assumptions, contraries, and evidence refs outward through one common shell.
- **Rejects** any plan where acceptance is only a manual label or a hidden model-confidence scalar.

Repo-specific consequence:
- The current repo still lacks `assumption_ledger` / `contrary` / defended-acceptance vocabulary at the schema and helper layer.
- The next docs-level artifact should define those semantics as publication-root members or attached predicates, not as new ad hoc top-level branch fields.

#### Finding 3: dp-ring needs explicit acceptance profiles and a small proof-bearing acceptance-status lattice
The sceptical-versus-credulous source sharpens a subtle but important gap: governance does not only need a yes/no status. It needs to say **under which acceptance profile** a claim or branch publication is being accepted, and ideally provide a proof/explanation path for that decision.

Implication for dp-ring:
- The future publication-root bundle should likely carry an `acceptance_profile` or equivalent stance marker, with at least an initial distinction such as:
  - `skeptical`: accepted only if it survives all relevant coherent extensions under the chosen profile
  - `credulous`: accepted if it survives at least one coherent extension under the chosen profile
- A minimal docs-level acceptance-status lattice is now justified as a research direction, for example:
  - `supported` or `defended` — currently backed by support/evidence under the chosen relation set
  - `accepted` — accepted under the active profile
  - `contested` — support and attack both remain live under the active profile
  - `rejected` / `defeated` — excluded under the active profile
- These should remain semantic hypotheses attached to the publication root, not immediate runtime code changes this week.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the next missing shell more precise: support/attack relations alone are not enough without an acceptance stance.
- **Refines Phase 1** by distinguishing lifecycle states (`candidate`, `mainline`, `discarded`, `synthesized`) from epistemic acceptance states.
- **Rejects** any design where branch acceptance is represented only by a single lifecycle field or a raw boolean with no profile/explanation semantics.

Repo-specific consequence:
- The current repo has no first-class `acceptance_profile` or `acceptance_status` vocabulary.
- The next docs-level kernel artifact should define a profile-aware projection that can later justify `adopt`, `discard`, `synthesize`, and supervisor escalation decisions.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by grounding the next post-bundle/post-validation semantic layer: **acceptance semantics attached to the publication root**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing shell is now more concrete: explicit support/attack relations, assumption/contrary handling, and profile-aware acceptance statuses.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later project claims/evidence/support/attack outward without leaking internal retrieval/planning state.
- **Phase 3 / Projection** remains downstream: operator surfaces, APIs, registries, and Rust/control-plane work should project these stable acceptance semantics rather than inventing their own decision language.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- preserve the emerging publication-root bundle + validation report direction
- add a relation family for **support / attack / contrary** semantics under one publication root
- add an **acceptance profile** and **acceptance-status** layer that sits beside, not inside, lifecycle `adoption_status`
- keep metrics as heuristics or explanatory inputs subordinate to this semantic shell rather than treating them as the acceptance model itself

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `support/attack vocabulary + assumption/contrary ledger + acceptance-profile/status table` work before more metric tuning or node variety work
- keep `adoption_status` as lifecycle state; do not overload it to also mean epistemic acceptance
- keep acceptance semantics attached to publication-root members and validation outputs, not scattered through `branch-event.data.details`
- do not jump to a full argumentation engine, free-graph global model, Rust control-plane work, or UI/operator surfaces yet

### Recommended next research slice
The next pass should reduce development risk by turning this acceptance-semantics line into explicit governance-guard rules that still fit the live repo:

1. **acceptance-to-lifecycle projection table**
   - map future acceptance statuses and profiles onto the existing lifecycle fields and branch actions (`adopt`, `discard`, `synthesize`, `continue`, `replay`, `escalate`) without pretending they are the same thing

2. **guarded governance transition profile**
   - define the minimal declarative guard vocabulary that connects validation report outcomes plus acceptance status to runtime moves, e.g. permission / prohibition / escalation / hold semantics

3. **publication-root member sketch for relation/proof artifacts**
   - specify how support/attack relations, assumption ledgers, and acceptance proofs/results attach to one publication-root bundle alongside checkpoint publication statements and validation reports

## 2026-04-19 20:19 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics already exist (`divergenceScore`, `composabilityScore`, `governancePressureScore`, `effectiveForceScore`), so the live gap is still semantic shell, not metric absence.
- `.ring/schemas/governance-statement.schema.json`, `.ring/schemas/checkpoint.schema.json`, `.ring/schemas/branch-event.schema.json`, and `ring/lib/session-runner.mjs` still confirm that the compact governance-statement shell is landed and inline in the live runtime.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`.
- `.ring/schemas/checkpoint.schema.json` still exposes only lifecycle-oriented `adoption_status` values and inline `publication_statements`; `.ring/schemas/branch-event.schema.json` still exposes `message_class`, optional inline `statement`, and generic `details` rather than a transition-guard artifact family.
- Targeted search across `.ring/schemas/*.json` and `ring/lib/*.mjs` this pass still finds no first-class `publication_root`, `validation_report`, `permission`, `prohibition`, `duty`, `guard`, `acceptance_profile`, `acceptance_status`, or `escalate` vocabulary.
- The official DCR product docs line at `documentation.dcr.design` was still security-blocked this pass (`HTTP/2 202`, `sg-captcha`, browser cookie challenge), so this pass used original DCR research sources plus W3C standards instead of guessing from third-party summaries.
- The sharper open Phase 1 gap is therefore now: dp-ring still lacks the **declarative guard/effect shell** that should connect publication-root members, validation outcomes, and acceptance semantics to concrete governance moves like `continue`, `adopt`, `discard`, `synthesize`, `replay`, and `escalate`.

### Sources reviewed

1. Thomas T. Hildebrandt, Raghava Rao Mukkamala, “Declarative Event-Based Workflow as Distributed Dynamic Condition Response Graphs”
   - Primary source URL: https://doi.org/10.4204/EPTCS.69.5
   - Official readable source used: https://arxiv.org/abs/1110.4161v1
   - Access note: the DOI redirected to the original authors’ arXiv/EPTCS version, which was directly reachable.
   - Key evidence: the abstract says DCR Graphs are a “declarative, event-based process model” and that a DCR graph has four relations between events: `condition`, `response`, `include`, and `exclude`.

2. Thomas Hildebrandt, Morten Marquard, Raghava Rao Mukkamala, Tijs Slaats, “Dynamic Condition Response Graphs for Trustworthy Adaptive Case Management”
   - Official source URL: https://link.springer.com/chapter/10.1007/978-3-642-41033-8_23
   - Access note: the official Springer page was directly reachable in browser and terminal.
   - Key evidence: the abstract says adaptive case management should allow runtime adaptation “while guaranteeing that no deadlocks and livelocks are introduced,” and that DCR operational semantics support “both run time changes and formal verification”; it also says future work would test changes for conformance wrt policies specified as LTL or DCR Graphs.

3. W3C ODRL Information Model 2.2
   - Official source URL: https://www.w3.org/TR/odrl-model/
   - Readable fallback used for line extraction: https://r.jina.ai/http://www.w3.org/TR/odrl-model/
   - Access note: the official page was directly reachable in browser; `r.jina.ai` was used only to extract the exact normative wording more cleanly.
   - Key evidence: ODRL says policies represent “permitted and prohibited actions” plus “obligations,” may be limited by `constraints`, and formally defines `Permission`, `Prohibition`, and `Duty` as distinct rule classes.

### Findings

#### Finding 1: DCR gives dp-ring a minimal declarative guard vocabulary for governance moves
The original DCR paper is the clearest primary-source justification for a compact guard layer. The four DCR relations — `condition`, `response`, `include`, and `exclude` — are a better fit for dp-ring’s next Phase 1 step than more free-form runtime branching.

Implication for dp-ring:
- After the publication-root bundle, validation-report family, and acceptance layer exist, the next docs-level kernel artifact should define a **guard relation profile** over governance moves.
- `condition` can model prerequisites that must already hold before a move is legal.
- `response` can model obligations created by a move or by a failed check (for example, replay or escalation becoming required).
- `include` / `exclude` can model which next moves become active or inactive under the current publication cycle without turning the global kernel into a free-form graph.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the next semantic shell more operational and declarative.
- **Refines Phase 1** by saying the missing step after acceptance semantics is not another metric family, but a compact transition-guard vocabulary.
- **Rejects** the tempting shortcut of burying move logic in scattered orchestrator branches or generic `branch-event.data.details` prose.

Repo-specific consequence:
- The live repo already has explicit checkpoint-tree operations (`continueFromCheckpoint`, `forkCheckpoint`, `adoptBranch`, `discardBranch`, `synthesizeCheckpoint`) but still has no first-class guard relation vocabulary around them.
- The next docs artifact should therefore specify guard semantics around existing actions, not invent a new structural kernel.

#### Finding 2: Trustworthy adaptive case management says runtime adaptation and formal verification can coexist if the control model stays declarative
The Springer paper sharpens the mainline because it directly combines runtime adaptation with deadlock/livelock guarantees, operational semantics, and policy conformance. That is exactly the design pressure dp-ring faces as it tries to connect adaptive governance to replay-safe control.

Implication for dp-ring:
- dp-ring should allow governance moves to adapt at runtime, but only through **replayable guard artifacts** whose premises are explicit publication members, validation results, and acceptance states.
- The control model should remain declarative enough that a later checker can verify whether a move was permitted, prohibited, or required under the active profile.
- This makes `escalate`, `replay`, and `hold` first-class governance consequences rather than ad hoc orchestration side effects.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by showing that adaptive governance does not require giving up formal control.
- **Refines Phase 1** by turning the publication-root → validation → acceptance chain into a precursor for guard evaluation, not an end in itself.
- **Rejects** any drift toward hidden imperative supervisor logic as the real source of truth.

Repo-specific consequence:
- `ring/lib/validator.mjs` and the inline governance-statement shell are still the right substrate, but they remain too thin to express guard evaluation as a durable artifact family.
- The next docs pass should define how acceptance-to-transition evaluation is recorded, not only how it is reasoned about informally.

#### Finding 3: ODRL adds the effect vocabulary DCR does not — permission, prohibition, duty, plus constraints
DCR helps define how event/move availability changes over time, but ODRL contributes the deontic effect classes that dp-ring still lacks. Together they suggest a cleaner guard/effect split than overloading `adoption_status` or inventing another scalar score.

Implication for dp-ring:
- dp-ring can use a **two-layer governance profile**:
  - a DCR-like relation layer for activation/obligation flow (`condition`, `response`, `include`, `exclude`)
  - an ODRL-like effect layer for decision meaning (`permission`, `prohibition`, `duty`, plus optional constraints)
- This creates a compact way to map validation + acceptance outcomes into concrete moves, for example:
  - `adopt` permitted only if validation conforms and acceptance is sufficiently strong
  - `continue` conditionally permitted under tighter constraints
  - `replay` or `escalate` becoming duties when contrary evidence or failed validation results arrive
- It keeps lifecycle state (`adoption_status`) separate from governance effect semantics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by clarifying that acceptance semantics still need an action-effect shell before runtime integration.
- **Refines Phase 1** by separating temporal guard relations from deontic outcome classes.
- **Rejects** representing all governance decisions as a single boolean or as a reused lifecycle enum.

Repo-specific consequence:
- There is still no first-class `permission`, `prohibition`, `duty`, or `constraint` vocabulary in `.ring/schemas/` or `ring/lib/`.
- The next docs-level kernel artifact should define a minimal effect profile attached to publication-root decisions before anyone starts wiring more policy branches into runtime code.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by narrowing the next missing shell after publication-root bundles, validation reports, and acceptance semantics: **a declarative guard/effect profile for governance transitions**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing step is now sharper: acceptance semantics alone are not enough without transition guards and action effects.
- **Phase 2 / Heterogeneous node ecology** remains aligned because nodes can keep local reasoning private while projecting only the artifacts that guard evaluation consumes.
- **Phase 3 / Projection** remains downstream: operator surfaces, APIs, registries, and Rust/control-plane work should project these guard/effect semantics rather than invent their own move logic.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- preserve the emerging publication-root bundle + validation report + acceptance-semantics direction
- add a **guard relation profile** over governance moves inspired by DCR (`condition`, `response`, `include`, `exclude`)
- add a **governance effect profile** inspired by ODRL (`permission`, `prohibition`, `duty`, optional constraints)
- map publication/validation/acceptance state into replayable guard evaluations that govern `continue`, `adopt`, `discard`, `synthesize`, `replay`, and `escalate`
- keep `adoption_status` as a lifecycle record, not as the action-guard language itself

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize a docs-level `acceptance-to-transition table + guard relation profile + effect profile` before more metric tuning or richer node variety work
- keep the current JSON Schema / Ajv substrate and existing statement shell; add the guard/effect semantics around them rather than swapping in an external workflow/policy engine
- do **not** stuff these semantics into `branch-event.data.details` or scattered orchestrator conditionals
- do **not** jump to a full DCR engine, full ODRL implementation, Rust control-plane work, UI/operator surfaces, or generalized argumentation automation yet

### Recommended next research slice
The next pass should reduce development risk by turning this guard/effect line into an explicit docs-level projection that still fits the live repo:

1. **acceptance-to-transition decision table**
   - map validation results + acceptance statuses/profiles onto concrete moves (`continue`, `adopt`, `discard`, `synthesize`, `replay`, `escalate`) and identify which moves are permitted, prohibited, or required

2. **publication-root member sketch for guard artifacts**
   - specify the minimal member family for guard rules, guard evaluations, and decision effects alongside checkpoint publication statements, relation members, and validation reports

3. **deterministic replay / verification profile for guard evaluation**
   - define how guard checks are journaled, replayed, and re-verified using the current JSON Schema / Ajv substrate so adaptive governance remains auditable rather than ambient-process-dependent

## 2026-04-19 21:45 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs`, `tests/ring/governance-policy.test.mjs`, `ring/lib/governance-statement.mjs`, `.ring/schemas/checkpoint.schema.json`, and `.ring/schemas/branch-event.schema.json` still confirm that runtime branch metrics and the compact inline governance-statement shell are already landed.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, so the live validator substrate is still too thin to express a replayable guard-evaluation artifact family.
- Targeted search across `ring/lib/*.mjs` and `.ring/schemas/*.json` this pass still finds no first-class `permission`, `prohibition`, `duty`, `advice`, `indeterminate`, `not_applicable`, `hitPolicy`, `decisionTable`, `guard_evaluation`, or `evaluation_result` vocabulary.
- The sharper open Phase 1 gap is therefore now: dp-ring still lacks a **decision/evaluation shell** that can map validation + acceptance inputs into replayable governance effects, record result statuses like `not_applicable` / `indeterminate`, and preserve provenance for the evaluation itself.

### Sources reviewed

1. OMG, **Decision Model and Notation (DMN) 1.4**
   - Official overview URL: https://www.omg.org/spec/DMN/1.4/About-DMN/
   - Official normative PDF URL: https://www.omg.org/spec/DMN/1.4/PDF
   - Access note: the official overview page was directly reachable in browser automation; the official PDF was directly downloadable and locally text-extracted for clause 8 details.
   - Key evidence:
     - the overview says DMN's “primary goal ... is to provide a common notation” and “creates a standardized bridge for the gap between the business decision design and decision implementation.”
     - clause 8 says a decision table is “a tabular representation of decision logic ... organized into rules that map discretized input values onto discrete output values.”
     - clause 8.2.10 says the hit-policy character is the initial letter of `Unique`, `Any`, `Priority`, `First`, `Collect`, `Output order`, or `Rule order`; `Unique` is the default; and rule ordering matters for `First` and `Rule order`.

2. OASIS, **eXtensible Access Control Markup Language (XACML) Version 3.0**
   - Official URL: https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html
   - Access note: the official HTML page was directly reachable in browser automation; terminal retrieval was partially flaky with intermittent TLS EOF, so exact wording was taken from a successful official fetch plus browser-rendered text from the official page.
   - Key evidence:
     - the glossary defines `Effect` as “The intended consequence of a satisfied rule (either ‘Permit’ or ‘Deny’).”
     - section 3.3.1.4 says “Obligation expressions may be added by the writer of the rule.”
     - section 3.3.1.5 says “Advice expressions may be added by the writer of the rule,” and “In contrast to obligations, advice may be safely ignored by the PEP.”
     - the worked example states that a policy can return “Permit”, “Deny”, “NotApplicable” or “Indeterminate”.

3. W3C, **PROV-DM: The PROV Data Model**
   - Official URL: https://www.w3.org/TR/prov-dm/
   - Access note: the official W3C recommendation page was directly reachable in browser automation and terminal.
   - Key evidence:
     - the abstract says provenance is information about “entities, activities, and people” that helps assess “quality, reliability or trustworthiness.”
     - PROV-DM includes “a notion of bundle, a mechanism to support provenance of provenance.”
     - component 4 defines a bundle as “a named set of provenance descriptions, and is itself an entity,” and says “A bundle's identifier id identifies a unique set of descriptions.”

### Findings

#### Finding 1: DMN gives dp-ring a compact decision-table shape for acceptance-to-transition mapping
DMN sharpens the next missing artifact more concretely than the prior DCR/ODRL pass. dp-ring does not just need abstract guard/effect vocabulary; it needs a replayable table that says which governance move is allowed for which combination of validation and acceptance inputs.

Implication for dp-ring:
- The next docs-level kernel artifact should likely be a **guard decision table profile** with explicit input columns such as validation outcome, acceptance profile/status, and possibly selected governance context fields.
- The output side should produce governance consequences such as `continue`, `adopt`, `discard`, `synthesize`, `replay`, `escalate`, `hold`, or `require_review`.
- DMN's hit-policy taxonomy is especially useful because it reveals a dp-ring-specific constraint: order-sensitive policies like `First` and `Rule order` are dangerous unless their ordering is explicitly journaled and replayed.
- The safest default for Phase 1 is therefore a small, order-insensitive profile centered on `Unique` and possibly carefully constrained `Priority`, not rule-order-dependent behavior hidden in orchestration code.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the abstract acceptance-to-transition idea into a concrete table-shaped artifact.
- **Refines Phase 1** by identifying replay-safe and replay-risky decision-table styles.
- **Rejects** implicit precedence encoded only by source-file branch order or `branch-event.data.details` prose.

Repo-specific consequence:
- The live repo still has explicit checkpoint-tree actions but no schema/profile for a decision table or hit policy.
- The next docs artifact should specify that profile before anyone wires more guarded branching logic into `ring/lib/orchestrator.mjs`.

#### Finding 2: XACML sharpens guard evaluation into separate effect, result-status, duty, and advice layers
The previous pass established the need for declarative guard/effect semantics, but XACML makes the missing evaluation shell more precise. A governed decision should not collapse into a single boolean or lifecycle field. It needs an effect, an evaluation result, and follow-on mandatory versus optional consequences.

Implication for dp-ring:
- dp-ring should distinguish at least:
  - **rule effect / action meaning**: permit or deny a governance move
  - **evaluation result status**: permitted, prohibited, `not_applicable`, or `indeterminate`
  - **mandatory follow-on duties**: e.g. `replay`, `escalate`, `hold`, `request_evidence`
  - **optional advice**: e.g. reviewer guidance, rationale hints, or suggested synthesis candidates
- This is a better fit than overloading `adoption_status`, because lifecycle state is not the same as an evaluated governance result.
- `Indeterminate` is particularly valuable for dp-ring because it offers a clean landing place for unresolved conflicts, incomplete validation, or missing acceptance evidence without pretending the system has a clear yes/no answer.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the guard-evaluation result family more operational.
- **Refines Phase 1** by separating deontic meaning, evaluation status, and follow-on consequences.
- **Rejects** representing all governance decisions as a boolean, a scalar score, or a reused checkpoint lifecycle enum.

Repo-specific consequence:
- The live repo still lacks any first-class `indeterminate`, `not_applicable`, `duty`, or `advice` vocabulary in `ring/lib/` and `.ring/schemas/`.
- The next docs-level kernel artifact should define this evaluation-result family before runtime code grows more ad hoc escalation branches.

#### Finding 3: PROV says guard evaluations themselves should become named, provenance-bearing members under the publication root
The current research line already argued for a publication-root bundle. PROV-DM sharpens why that bundle cannot stop at checkpoint statements and validation results: the decision/evaluation artifact must itself be a governed, identifiable subject whose provenance can be inspected later.

Implication for dp-ring:
- A guard evaluation should become a first-class publication-root member, not a process-local note or transient runtime return value.
- The evaluation artifact should explicitly identify:
  - the guard table or profile used
  - the validation report/result members consumed
  - the acceptance members consumed
  - the evaluator / activity / timestamp
  - the resulting effect, result status, duties, and advice
- The publication root or sub-bundle for one checkpoint/branch cycle should treat the evaluation package as a named entity so replay can ask not only “what was decided?” but also “what evidence and rules produced that decision?”

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the replay/verification profile a concrete identity/provenance requirement.
- **Refines Phase 1** by treating guard evaluation as provenance-bearing output rather than ambient control flow.
- **Rejects** keeping the real decision logic in hidden process state, terminal logs, or undocumented orchestration branches.

Repo-specific consequence:
- The repo still has no docs-level subject for a guard evaluation package, even though it now has inline governance statements and a growing publication-root direction.
- The next docs artifact should define where guard-table definitions and guard-evaluation records sit relative to checkpoint publication statements, validation reports, and acceptance members.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by narrowing the next missing shell after publication-root bundles, validation reports, acceptance semantics, and guard/effect vocabulary: **a replayable decision-table + evaluation-result + evaluation-provenance profile**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next design step is now sharper: the kernel needs a table-shaped decision artifact, not just more abstract policy words.
- **Phase 1 / Governance kernel** is also strengthened because evaluation results now have a clearer target vocabulary: permit/deny meaning, `not_applicable` / `indeterminate` result states, and duties versus advice.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later project validation/acceptance evidence into this shell without exposing internal reasoning machinery.
- **Phase 3 / Projection** remains downstream: APIs, control planes, and operator surfaces should project these evaluation artifacts rather than inventing their own opaque decision semantics.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- preserve the publication-root bundle + validation-report + acceptance-semantics line
- add a **guard decision-table profile** for acceptance-to-transition mapping
- add a **guard evaluation-result family** that distinguishes effect, result status, duties, and advice
- add an **evaluation provenance profile** so one publication cycle can replay and verify why a governance move was permitted, denied, or left indeterminate
- prefer replay-safe, order-insensitive decision semantics by default; require explicit journaling if any rule-order-dependent semantics are ever allowed

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `guard decision table + evaluation result vocabulary + evaluation provenance membership` work before more metric tuning or richer node variety work
- keep the existing JSON Schema / Ajv substrate and the landed governance-statement shell; add these decision/evaluation semantics around them rather than importing a full policy engine
- do **not** default to `First` or `Rule order`-style semantics in the kernel just because they are convenient; order-sensitive tables should be treated as exceptional and explicitly journaled
- do **not** jump to runtime implementation, UI/operator surfaces, Rust control-plane work, or product projection until the decision/evaluation shell is specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this decision/evaluation line into an explicit docs-level artifact family that still fits the live repo:

1. **guard decision-table profile**
   - define the minimal table schema, input columns, output columns, and permitted hit policies for mapping validation + acceptance inputs to governance moves

2. **guard evaluation-result profile**
   - define the result vocabulary (`permitted`, `prohibited`, `not_applicable`, `indeterminate`) plus attached `duties` and `advice`, and map those onto existing runtime moves like `continue`, `adopt`, `discard`, `synthesize`, `replay`, and `escalate`

3. **evaluation provenance / membership sketch**
   - specify how guard tables and guard evaluations attach to the publication-root bundle, what subject they are `about`, and how replay can verify the exact inputs and rule set that produced a decision

## 2026-04-20 00:23 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs`, `tests/ring/governance-policy.test.mjs`, `ring/lib/governance-statement.mjs`, `.ring/schemas/checkpoint.schema.json`, and `.ring/schemas/branch-event.schema.json` still confirm that first-class runtime branch metrics and the compact inline governance-statement shell are already landed.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`.
- `ring/lib/node-contract.mjs` already reads Ajv location data via `error.instancePath`, and a local Ajv probe in this repo still emits `instancePath`, `schemaPath`, `keyword`, `params`, and `message`; the live gap is therefore not raw validator capability but the absence of a normalized publication-level validation artifact family.
- `.ring/schemas/evaluation.schema.json` already exists, but it is explicitly scoped to “Quality scores for a completed session,” so it is not the missing governance decision / guard-evaluation shell.
- Targeted search across `ring/lib/*.mjs` and `.ring/schemas/*.json` this pass still finds no first-class `validation_report`, `validation_result`, `guard_evaluation`, `evaluation_result`, `duty`, `advice`, `not_applicable`, or `indeterminate` governance vocabulary.
- The sharper open Phase 1 gap is therefore now: dp-ring needs a **JSON-Schema-grounded validation-member profile plus a separate governance evaluation-result shell**, rather than reusing raw Ajv error blobs or overloading the existing post-session `evaluation` artifact.

### Sources reviewed

1. JSON Schema Draft 2020-12 core + output schema
   - Official URLs:
     - https://json-schema.org/draft/2020-12/json-schema-core#section-12
     - https://json-schema.org/draft/2020-12/output/schema
   - Access note: both official URLs were directly reachable.
   - Key evidence:
     - section 12 names `keywordLocation`, `absoluteKeywordLocation`, and `instanceLocation` as standardized output keys
     - the official output schema says it validates the “minimum requirements for validation output”
     - the output schema requires `valid`, `keywordLocation`, and `instanceLocation`, and allows nested `errors` / `annotations`
     - the output schema explicitly distinguishes `flag`, `basic`, `detailed`, and `verbose` output forms

2. OASIS, **eXtensible Access Control Markup Language (XACML) Version 3.0**
   - Official URL: https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html
   - Access note: the official HTML page was directly reachable in browser automation.
   - Key evidence:
     - the glossary defines `Effect` as “The intended consequence of a satisfied rule (either \"Permit\" or \"Deny\")”
     - the spec says “Obligation expressions may be added by the writer of the rule.”
     - the spec says “Advice expressions may be added by the writer of the rule.” and “In contrast to obligations, advice may be safely ignored by the PEP.”
     - the worked examples say a policy can return “Permit”, “Deny”, “NotApplicable” or “Indeterminate”

3. W3C, **PROV-DM: The PROV Data Model**
   - Official URL: https://www.w3.org/TR/prov-dm/
   - Access note: the official recommendation page was directly reachable in browser automation.
   - Key evidence:
     - the abstract includes “a notion of bundle, a mechanism to support provenance of provenance”
     - section 2.2.2 says “A bundle is a named set of provenance descriptions, and is itself an entity”
     - the bundle constructor text says “A bundle's identifier id identifies a unique set of descriptions.”

### Findings

#### Finding 1: JSON Schema 2020-12 gives dp-ring a concrete normalization target for validation members
This pass sharpens the live validator gap more precisely than earlier “validation report” language. JSON Schema does not just say validation can succeed or fail; it defines a structured output vocabulary with location-bearing units and multiple output forms. That fits dp-ring’s current substrate unusually well because the repo already uses Ajv and already consumes `instancePath` in `ring/lib/node-contract.mjs`.

Implication for dp-ring:
- The next docs-level validation artifact should not be a generic blob around `{ valid, errors }`.
- It should define a **validation-result member profile** whose core fields track JSON Schema’s standardized output keys:
  - `valid`
  - `keywordLocation`
  - `absoluteKeywordLocation` when dereferencing crosses a schema boundary
  - `instanceLocation`
  - plus normalized message / params payloads and nested child results where needed
- This lets dp-ring attach location-aware evidence to publication-root bundles without tying the kernel to one validator implementation’s raw error object shape.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the missing validation shell much more concrete and implementation-aligned.
- **Refines Phase 1** by saying the next artifact family should be a normalized projection over the existing Ajv / JSON Schema substrate, not a fresh validation theory.
- **Rejects** treating raw `errors` arrays as the durable governance artifact.

Repo-specific consequence:
- `ring/lib/validator.mjs` remains a thin transport for validator output.
- The next docs artifact should specify how raw Ajv errors project into publication-root validation members before policy decisions consume them.

#### Finding 2: XACML confirms dp-ring needs a separate evaluation-result family, not a single boolean or lifecycle field
The previous pass identified a decision/evaluation shell in the abstract. XACML sharpens the missing family more concretely: a governed evaluation has an effect, a result status, and follow-on mandatory versus optional consequences. That is a better fit for dp-ring’s next kernel step than stuffing everything into `adoption_status`, a scalar score, or an overloaded “evaluation” noun.

Implication for dp-ring:
- The next docs-level governance evaluation artifact should distinguish at least:
  - **effect**: permit vs deny meaning for a proposed move
  - **result status**: `permitted`, `prohibited`, `not_applicable`, `indeterminate`
  - **duties**: commit-blocking or required follow-on consequences such as `replay`, `escalate`, `hold`, or `request_evidence`
  - **advice**: optional reviewer guidance, rationale hints, or suggested follow-ups
- This gives dp-ring a principled place to represent unresolved or insufficiently grounded cases without pretending the system has a clean yes/no answer.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the evaluation-result shell more operational.
- **Refines Phase 1** by separating decision meaning, decision status, and follow-on consequences.
- **Rejects** reusing checkpoint `adoption_status` or a generic quality score as the epistemic / deontic evaluation layer.

Repo-specific consequence:
- The existing `.ring/schemas/evaluation.schema.json` is about retrospective session quality and is the wrong semantic home for governance move decisions.
- The next docs artifact should therefore define a distinct guard-evaluation result family rather than stretching the current `evaluation` artifact beyond its meaning.

#### Finding 3: PROV bundle semantics sharpen the artifact boundary between validation members, guard evaluations, and post-session quality evaluation
PROV helps clarify not just that provenance matters, but that the artifact carrying it should be a named entity. Combined with the live repo state, this makes one boundary much sharper: dp-ring should not reuse the existing `evaluation` artifact name for the missing governance shell. A guard evaluation should be a provenance-bearing publication-root member whose identity is tied to one publication cycle, not a retroactive session scorecard.

Implication for dp-ring:
- A publication cycle should be able to point to:
  - the checkpoint publication statement(s)
  - the normalized validation result member(s)
  - the acceptance/relation member(s)
  - the guard table/profile used
  - the guard evaluation member that records effect, result status, duties, advice, and consumed inputs
- The guard evaluation member should itself be a named governed subject so replay can ask both “what was decided?” and “what exact bundle members and rule profile produced that decision?”
- The existing `evaluation` artifact can remain available for retrospective quality scoring without being overloaded into governance semantics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by clarifying artifact boundaries inside the publication-root direction.
- **Refines Phase 1** by separating publication-cycle governance evidence from retrospective quality assessment.
- **Rejects** collapsing validation, guard decision, and post-hoc quality scoring into one overloaded artifact type.

Repo-specific consequence:
- The live repo already has an `evaluation` schema, so naming and boundary discipline now matter more than before.
- The next docs artifact should explicitly reserve separate package/member classes for validation results versus guard evaluations versus retrospective evaluations.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by narrowing the current decision/evaluation shell into a more specific artifact family: **JSON-Schema-shaped validation members + a distinct guard-evaluation result shell + provenance-bearing publication-root membership**, while keeping retrospective quality evaluation separate.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the missing validation shell now has a standards-grounded shape rather than a generic “report” label.
- **Phase 1 / Governance kernel** is also strengthened because the artifact boundary around governance evaluation is now clearer: do not overload the existing `evaluation` artifact.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later emit evidence and validation material into these profiles without leaking internals.
- **Phase 3 / Projection** remains downstream: operator surfaces and control-plane services should project these artifacts rather than inventing parallel semantics.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance statement shell
- preserve the publication-root bundle + validation-report + acceptance-semantics + decision-table direction already established
- add a **normalized validation-result member profile** grounded in JSON Schema output semantics
- add a **guard-evaluation result profile** that distinguishes effect, result status, duties, and advice
- keep the existing `.ring/schemas/evaluation.schema.json` focused on retrospective session-quality scoring rather than governance move evaluation
- attach validation members and guard evaluations to the publication-root bundle as named provenance-bearing members

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `validation-result profile + guard-evaluation result profile + artifact-boundary/naming rules` before more metric tuning or richer node variety work
- treat `ring/lib/node-contract.mjs`'s use of `instancePath` as evidence that location-aware validation is already a live substrate, then generalize it at the artifact level
- keep the current JSON Schema / Ajv substrate and governance-statement shell; add normalization and publication semantics around them rather than importing a full policy engine
- do **not** reuse `.ring/schemas/evaluation.schema.json` for governance decisions just because the name is convenient
- do **not** jump to runtime implementation, UI/operator surfaces, Rust control-plane work, or product projection until the validation/evaluation artifact family is specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into an explicit docs-level artifact family that still fits the live repo:

1. **validation-result member profile**
   - define the minimal normalized field set projected from current Ajv / JSON Schema output (`valid`, locations, normalized message/params, nested child results, and optional baseline-diff overlay)

2. **guard-evaluation result profile**
   - define the result vocabulary (`permitted`, `prohibited`, `not_applicable`, `indeterminate`) plus `effect`, `duties`, and `advice`, and map those onto existing runtime moves like `continue`, `adopt`, `discard`, `synthesize`, `replay`, and `escalate`

3. **artifact-boundary / naming sketch under the publication root**
   - specify how validation-result members, guard-evaluation members, and retrospective `evaluation` artifacts remain distinct, what each one is `about`, and how replay can verify the exact member set and rule profile that produced a governance decision

## 2026-04-20 01:37 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs`, `tests/ring/governance-policy.test.mjs`, `ring/lib/governance-statement.mjs`, `.ring/schemas/checkpoint.schema.json`, and `.ring/schemas/branch-event.schema.json` still confirm that first-class runtime metrics plus the compact inline governance-statement shell are already landed.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` already consumes Ajv `error.instancePath` when rendering validation failures.
- `ring/lib/governance-policy.mjs` already treats evidence references as `{ kind, ref, digest }`, but the repo still has no docs/schema-level rule that those `ref` values are RFC 6901 JSON Pointers, no first-class `ruleId` / `baselineState` / `masked` / `erased` vocabulary, and no distinct `validation_result` or `guard_evaluation` artifact family.
- The sharper live Phase 1 gap is therefore no longer just “normalized validation members in the abstract.” It is now: dp-ring needs a **pointer-normalized validation-result member profile plus a redactable guard-evaluation publication member**, so publication-root bundles can carry location-aware evidence and replayable decisions without leaking raw sensitive payloads.

### Sources reviewed
1. IETF RFC 6901, **JavaScript Object Notation (JSON) Pointer**
   - Official URL: https://www.rfc-editor.org/rfc/rfc6901.txt
   - Access note: the official RFC text was directly reachable in terminal.
   - Key evidence: the RFC says “JSON Pointer defines a string syntax for identifying a specific value within a JavaScript Object Notation (JSON) document”; “A JSON Pointer is a Unicode string”; evaluation decodes `~1` to `/` and `~0` to `~`.

2. OASIS Standard, **Static Analysis Results Interchange Format (SARIF) Version 2.1.0**
   - Official URL: https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
   - Access note: the official HTML specification was directly reachable in browser automation; browser-rendered text was used for the narrow result/location clauses.
   - Key evidence:
     - a result object may contain `ruleId`, whose leading components specify “the stable identifier of the rule that was evaluated to produce the result”; `ruleId` “SHOULD be opaque”
     - a result may contain `baselineState` with `new`, `unchanged`, `updated`, and `absent`
     - a location may contain `physicalLocation`; a `physicalLocation` may contain `artifactLocation`; and the `region` property “SHALL specify the region within the artifact where the result was detected”

3. Open Policy Agent, **Decision Logs**
   - Official URL: https://www.openpolicyagent.org/docs/management-decision-logs
   - Access note: the official page was directly reachable in browser automation; browser-rendered article text was used because the raw terminal body is noisy.
   - Key evidence:
     - decision logs “contain events that describe policy queries”
     - each event includes “the policy that was queried, the input to the query, bundle metadata, and other information that enables auditing and offline debugging of policy decisions”
     - documented fields include `decision_id`, `bundles`, `path`, `input`, `result`, `requested_by`, `timestamp`, `erased`, and `masked`
     - OPA says masking policies return “a set of JSON Pointers” to fields to “erase or modify,” and the erased paths are recorded on the event itself

### Findings

#### Finding 1: RFC 6901 plus OPA masking say dp-ring's next publication-level location language should be JSON Pointer, not ad hoc path strings
The current Phase 1 direction already wants location-aware validation members and artifact-boundary discipline. RFC 6901 makes the missing path discipline explicit: if dp-ring wants replayable references into JSON artifacts, it should use a standard pointer syntax, not dotted strings or validator-specific prose. OPA's masking rules reinforce this by showing that the same pointer language can also drive redactable publication overlays.

Implication for dp-ring:
- Validation-result members should normalize instance locations and optional schema/subject sublocations using RFC 6901 JSON Pointer syntax.
- Guard-evaluation members should record redactions as explicit pointer overlays such as `erased` and `masked`, not by silently mutating or truncating logged payloads.
- A publication bundle should be able to say both “this result is about `/data/predicate/checkpoint/id`” and “this field was redacted at `/input/credentials/token`” using the same pointer discipline.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the still-abstract validation-member normalization work into a concrete path policy.
- **Refines Phase 1** by connecting location normalization and redaction semantics into one artifact-level rule family.
- **Rejects** ad hoc dotted paths, free-form prose locations, or untracked payload trimming inside governance artifacts.

Repo-specific consequence:
- `ring/lib/node-contract.mjs` already surfaces `error.instancePath`, and `ring/lib/governance-policy.mjs` already carries generic evidence `ref` strings, so the substrate exists.
- The missing piece is a docs-level rule that specifies when refs are plain artifact ids versus RFC 6901 pointers into governed artifact bodies, plus how pointer-based redactions are published.

#### Finding 2: SARIF sharpens validation-result members into stable rule identity + subject location + baseline overlay
Earlier passes already concluded that dp-ring needs normalized validation members. SARIF sharpens the next step beyond “some report object”: a durable result unit should separate the stable identity of the violated rule from the location in the subject artifact and from the baseline/diff state across runs.

Implication for dp-ring:
- A validation-result member should minimally distinguish:
  - a stable `rule_id`/constraint identifier
  - the subject artifact or subject descriptor the result is about
  - a pointer-normalized location within that subject
  - message/severity data
  - baseline state such as `new`, `unchanged`, `updated`, or `absent`
- This makes repeated validation across replay, branch evolution, and checkpoint publication cycles comparable without collapsing everything back into raw Ajv error arrays.
- SARIF's separation of stable rule identity from result location is especially useful for dp-ring because the same validation rule can fire against different checkpoint publications or different members in one publication root.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the validation-member family a more precise internal shape.
- **Refines Phase 1** by saying the next artifact should separate rule identity, subject location, and baseline delta instead of stuffing them into one opaque error blob.
- **Rejects** publishing only `{ valid, errors }` or using checkpoint lifecycle fields as a surrogate diff model.

Repo-specific consequence:
- The live repo still has no first-class `ruleId`, `baselineState`, or location-rich validation member vocabulary in `.ring/schemas/*.json`.
- The next docs artifact should define how current Ajv/JSON Schema output projects into a result member with stable rule identity and lineage-aware baseline state.

#### Finding 3: OPA decision logs sharpen guard evaluation into a minimal, publishable, and redactable provenance member
Previous passes already pushed dp-ring toward a guard-evaluation result shell. The OPA material sharpens what that member should look like in practice: not a giant dump of runtime state, but a compact decision log with stable identity, policy provenance, input/result references, and explicit redaction records.

Implication for dp-ring:
- A guard-evaluation member should likely carry:
  - `decision_id`
  - policy profile/path or decision-table profile id
  - revision/provenance info for the policy bundle or decision table used
  - references to consumed validation/acceptance/input members rather than always embedding full raw payloads
  - `result_status`, `effect`, `duties`, and `advice`
  - evaluator identity and timestamp
  - optional `erased` / `masked` pointer arrays when publication redaction is applied
- This gives dp-ring a replayable and auditable evaluation record without requiring the publication root to expose every sensitive input field in the clear.
- It also helps keep the artifact boundary clean: validation-result members say what failed or passed; guard-evaluation members say what decision followed from those members under a named policy profile.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the missing guard-evaluation member more concrete and operational.
- **Refines Phase 1** by adding redaction-aware provenance instead of assuming all decision inputs can be published verbatim.
- **Rejects** keeping real governance decisions in process-local logs, dumping whole inputs/results without publication discipline, or overloading retrospective `evaluation` artifacts.

Repo-specific consequence:
- The live repo still has no first-class `decision_id`, `masked`, `erased`, or separate `guard_evaluation` artifact family under `.ring/schemas/`.
- The next docs artifact should define a compact decision-log-style publication member instead of letting this information leak into branch-event `details` or ad hoc runtime logging.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by narrowing the current artifact problem from generic “validation/evaluation shell” language to a more precise target: **pointer-normalized validation-result members plus a redactable, provenance-bearing guard-evaluation member under the publication root**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next missing docs layer now has a crisper boundary: path normalization, stable rule identity, baseline delta, and decision-log provenance.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later emit evidence and evaluation inputs into this shell without exposing their internal traces or local caches.
- **Phase 3 / Projection** stays downstream: operator surfaces and control-plane services should project these normalized members instead of inventing their own path, diff, and redaction conventions.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance-statement shell and publication-root direction
- define a **pointer policy** for artifact-internal references and redaction overlays
- define a **validation-result member profile** that separates rule identity, subject location, message/severity, and baseline state
- define a **guard-evaluation publication member** that carries decision provenance, result status/effect, and pointer-based `masked`/`erased` overlays when needed
- keep retrospective `evaluation` artifacts separate from publication-cycle validation and guard-decision members

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `pointer policy + validation-result member + guard-evaluation member/redaction overlay` work before more metric tuning or richer node variety work
- keep using the current JSON Schema / Ajv substrate and the existing governance-statement shell; add normalized member semantics around them rather than importing a new policy engine
- do **not** hide sensitive inputs by silent omission; if a publication root redacts fields, record those redactions as explicit pointer-based overlays
- do **not** reuse generic `details` blobs or retrospective `evaluation` artifacts for these semantics
- do **not** jump to runtime implementation, UI/operator surfaces, Rust control-plane work, or product projection until the pointer/redaction/member boundary is specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into explicit docs-level profiles that fit the live repo:

1. **artifact pointer policy**
   - define where dp-ring uses plain artifact ids vs RFC 6901 JSON Pointers, how pointer-bearing refs compose with subject descriptors, and which pointer domains are legal for redaction overlays

2. **validation-result member profile**
   - define the minimal field set for `rule_id`, subject descriptor/ref, instance/schema pointers, message/severity, and `baseline_state`, projected from the current Ajv / JSON Schema substrate

3. **guard-evaluation publication member + redaction overlay**
   - define the minimal decision-log-style fields (`decision_id`, policy profile/path, consumed member refs, result status/effect, duties, advice, evaluator/timestamp) plus explicit `masked` / `erased` pointer arrays under the publication root

## 2026-04-20 03:04 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs`, `tests/ring/governance-policy.test.mjs`, `ring/lib/governance-statement.mjs`, `.ring/schemas/checkpoint.schema.json`, and `.ring/schemas/branch-event.schema.json` still confirm that first-class runtime metrics plus the compact inline governance-statement shell are already landed.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` already consumes Ajv `error.instancePath` when rendering validation failures.
- Targeted search across `ring/lib/*.mjs` and `.ring/schemas/*.json` this pass still finds no first-class `validation_report`, `validation_result`, `guard_evaluation`, `jsonpath`, `json-patch`, `masked`, or `erased` vocabulary in the live repo.
- The sharper live Phase 1 gap is therefore now: dp-ring needs a **validation report/result member family plus a strict artifact-pointer policy**, and that policy should keep governed publication members on singular pointer-addressed locations rather than query selectors or ordered patch programs.

### Sources reviewed
1. W3C, **Shapes Constraint Language (SHACL)**
   - Official URL: https://www.w3.org/TR/shacl/
   - Access note: the official W3C page was directly reachable in browser automation.
   - Key evidence:
     - section 3.6.1 says “The result of a validation process is an RDF graph with exactly one SHACL instance of `sh:ValidationReport`”
     - that report has exactly one `sh:conforms`, and `sh:result` values point to `sh:ValidationResult` instances
     - section 3.6.2 says `sh:focusNode`, `sh:resultSeverity`, and `sh:sourceConstraintComponent` are mandatory for all validation results, while `sh:detail` and `sh:resultMessage` add nested detail and human-readable explanation

2. IETF RFC 9535, **JSONPath: Query Expressions for JSON**
   - Official URL: https://www.rfc-editor.org/rfc/rfc9535.txt
   - Access note: the official RFC text was directly reachable in browser automation.
   - Key evidence:
     - the abstract says JSONPath defines a syntax for “selecting and extracting JSON values”
     - the introduction says JSONPath “is not intended as a replacement” for JSON Pointer but as “a more powerful companion”
     - the terminology section defines a **Normalized Path** as a query form that identifies exactly one node, while the surrounding model still treats JSONPath generally as a query/nodelist language

3. IETF RFC 6902, **JavaScript Object Notation (JSON) Patch**
   - Official URL: https://www.rfc-editor.org/rfc/rfc6902.txt
   - Access note: the official RFC text was directly reachable in browser automation.
   - Key evidence:
     - the abstract says JSON Patch expresses “a sequence of operations” to apply to a JSON document
     - section 3 says a JSON Patch document is an array of operation objects, each representing a single operation
     - evaluation applies operations “sequentially in the order they appear in the array”

### Findings

#### Finding 1: SHACL sharpens dp-ring's next validation shell into a report/result split, not one generic validation blob
SHACL adds a detail that earlier JSON-Schema/Ajv-grounded passes did not fully sharpen: a durable validation artifact family benefits from an explicit aggregate report plus individual result units. That matters for dp-ring because the live repo already has only `{ valid, errors }`, while the publication-root direction needs something replayable and inspectable.

Implication for dp-ring:
- The next docs-level validation family should likely distinguish:
  - a **validation report member** for bundle-level `conforms` and membership
  - one or more **validation result members** for individual findings
- Each result member should minimally preserve:
  - the governed subject or subject ref it is about
  - a singular subject location
  - a stable source constraint / rule identifier
  - severity
  - optional nested `detail` children and human-readable messages
- This gives dp-ring a clean place to project Ajv/JSON Schema output without collapsing it back into one `{ valid, errors }` blob.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the validation-member family more concrete and replayable.
- **Refines Phase 1** by separating report-level conformance from per-result evidence.
- **Rejects** treating validation as only a boolean helper return or a single opaque error array.

Repo-specific consequence:
- The next docs artifact should define `validation_report` and `validation_result` as distinct publication-root member classes before runtime code grows another ad hoc wrapper around Ajv errors.

#### Finding 2: JSONPath is useful for operator queries, but it is the wrong durable location language for governed publication members
The latest memo already narrowed work toward an artifact-pointer policy. RFC 9535 sharpens the anti-drift rule: JSONPath is a query/extraction language, not the right canonical address form for governance artifacts. Even its “Normalized Path” concept is still framed inside a more general query model that can otherwise yield multi-node results.

Implication for dp-ring:
- Publication-root members, validation results, guard-evaluation inputs, and redaction overlays should keep **singular pointer-addressed locations** as their durable reference language.
- JSONPath may still be useful later for operator tooling, search, or exploratory diagnostics, but not as the canonical location field inside governed artifacts.
- This keeps replay and comparison stable: a published location should name one place, not encode a query whose result set may vary with context.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the pointer-policy slice into a concrete design boundary.
- **Refines Phase 1** by reserving query semantics for tooling rather than kernel artifacts.
- **Rejects** JSONPath selectors as the default publication/member location vocabulary.

Repo-specific consequence:
- Because `ring/lib/node-contract.mjs` already consumes singular Ajv `instancePath` values, the next docs shell should preserve that singular-address discipline instead of widening early into query selectors.

#### Finding 3: JSON Patch is too operational and order-sensitive to become dp-ring's publication-level baseline or redaction model
RFC 6902 is helpful precisely because it shows what dp-ring should *not* standardize too early. JSON Patch is a sequence of ordered mutation operations. That is powerful for local editing or repair, but it is a poor fit for the Phase 1 semantic shell, where the goal is to publish stable validation/evaluation facts and redaction intent rather than executable edit programs.

Implication for dp-ring:
- Baseline tracking in validation members should stay as compact status overlays such as `new`, `unchanged`, `updated`, or `absent`, not full patch programs.
- Publication redaction should remain pointer-addressed `masked` / `erased` style overlays or equivalent declarative markers, not general-purpose patch scripts.
- If patch-style repair or transformation is ever needed, keep it node-local, tool-local, or implementation-local instead of making it the kernel's publication artifact shape.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the “not yet” boundary around diff/edit semantics.
- **Refines Phase 1** by preferring declarative result-state and redaction overlays over mutation programs.
- **Rejects** making ordered patch arrays part of the first publication-root validation/evaluation shell.

Repo-specific consequence:
- The next docs artifact should avoid introducing `ops`, `patch`, or other sequential edit-program fields in `validation_result` or `guard_evaluation` profiles just because JSON tooling makes them easy to serialize.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by turning the current artifact-pointer problem into a stricter rule: **use report/result member families with singular pointer-addressed locations; keep JSONPath and JSON Patch as tooling-layer helpers, not kernel publication semantics.**

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next docs layer now has a clearer artifact split: validation report vs validation result, plus a clearer anti-drift boundary around location and diff semantics.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later emit validation and decision material into these profiles without publishing internal query logic or local repair scripts.
- **Phase 3 / Projection** remains downstream: operator surfaces can expose JSONPath-like search or patch-like tooling later without contaminating kernel publication semantics.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance-statement shell and publication-root direction
- define a **validation report member** that summarizes conformance and links member results
- define **validation result members** with singular locations, stable rule/source identifiers, severity, and optional nested details
- reserve **JSONPath** for operator/query tooling rather than governed member locations
- reserve **JSON Patch** for local editing/repair workflows rather than publication-root baseline or redaction semantics

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `validation_report + validation_result + singular pointer policy` work before more metric tuning or richer node variety work
- keep using the current JSON Schema / Ajv substrate and the existing governance-statement shell; add report/result member semantics around them rather than importing a larger query or patch language into the kernel
- do **not** introduce JSONPath selectors into publication-root members just because they are expressive
- do **not** turn redaction or baseline tracking into ordered patch programs at the kernel layer
- do **not** jump to runtime implementation, UI/operator surfaces, Rust control-plane work, or product projection until the report/result member family and pointer policy are specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into explicit docs-level profiles that fit the live repo:

1. **validation report/result member profile sketch**
   - define exact field tables for `validation_report` and `validation_result`, including conformance, member linkage, source rule identity, severity, singular location refs, nested detail, and baseline-state overlays

2. **publication-root member-class / descriptor sketch**
   - specify how validation reports, validation results, inline governance statements, and later guard-evaluation members attach to one publication-root bundle without collapsing into a single overloaded artifact family

3. **guard-evaluation member after pointer policy is fixed**
   - once singular location and report/result semantics are locked, define the minimal guard-evaluation profile (`decision_id`, policy profile/ref, consumed member refs, `result_status`, `effect`, `duties`, `advice`, and optional `masked` / `erased` pointer overlays)

## 2026-04-20 04:21 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; Phase 1 is not blocked on missing `divergenceScore` / `composabilityScore` / `governancePressureScore` / `effectiveForceScore`.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` already consumes Ajv `error.instancePath` and therefore already exposes a location-aware validation substrate.
- `ring/lib/governance-statement.mjs` already defines subject descriptors with `mediaType`, `digest`, `size`, and `locator`, which is a descriptor-like membership substrate even though the repo still lacks a first-class publication-root artifact.
- Targeted live searches this pass still find no `.ring/schemas/*publication*`, `.ring/schemas/*validation*`, or `.ring/schemas/*guard*` files, and no first-class `validation_report`, `validation_result`, or `guard_evaluation` vocabulary under `.ring/schemas/`.
- The sharper live Phase 1 gap is therefore now: dp-ring needs a **self-describing publication-root bundle plus a descriptor-indexed member catalog**, and its `validation_report` / `validation_result` members should project directly from JSON-Schema/Ajv output units rather than from ad hoc wrapper blobs.

### Sources reviewed
1. JSON Schema Draft 2020-12 Core, **Output Formatting / Output Structure**
   - Official URL: https://json-schema.org/draft/2020-12/json-schema-core.html#section-12
   - Access note: the official page was directly reachable; `https://r.jina.ai/http://json-schema.org/draft/2020-12/json-schema-core.html` was used only to extract readable text.
   - Key evidence:
     - “Each sub-result SHOULD contain the information contained within this section at a minimum.”
     - “A single object that contains all of these components is considered an output unit.”
     - `instanceLocation` “MUST be expressed as a JSON Pointer.”
     - the output “MUST be an object containing a boolean property named `valid`” and, when more detail is required, it “MUST also contain `errors` or `annotations`.”
     - the “Basic” structure is “a flat list of output units,” while the “Detailed” structure makes associations between related errors “more apparent.”

2. RO-Crate 1.1, **Root Data Entity**
   - Official URL: https://www.researchobject.org/ro-crate/specification/1.1/root-data-entity.html
   - Access note: the official page was directly reachable; `https://r.jina.ai/http://www.researchobject.org/ro-crate/specification/1.1/root-data-entity.html` was used only to extract readable text.
   - Key evidence:
     - the “Root Data Entity” is a `Dataset` that “represent[s] the RO-Crate as a whole”
     - the metadata descriptor “MUST” be self-describing and “MUST have an `about` property referencing the Root Data Entity”
     - the metadata descriptor `conformsTo` should be a versioned permalink URI of the specification it conforms to.

3. OCI Image Spec, **OCI Content Descriptors**
   - Official URL: https://raw.githubusercontent.com/opencontainers/image-spec/main/descriptor.md
   - Access note: the official raw spec was directly reachable.
   - Key evidence:
     - “References between components in the graph are expressed through Content Descriptors.”
     - a descriptor includes the content type, `digest`, and `size`
     - `mediaType`, `digest`, and `size` are required; `annotations` and `artifactType` are optional
     - the `digest` acts as a content identifier enabling content addressability.

### Findings

#### Finding 1: JSON Schema output units give dp-ring the exact normalization basis for `validation_result` members
The current repo already uses Ajv and already surfaces `instancePath`. The JSON Schema output section sharpens what should happen next: dp-ring does not need to invent a fresh error-object theory. It can define `validation_result` as a governed projection of JSON Schema output units.

Implication for dp-ring:
- A `validation_result` member should preserve the output-unit core:
  - `valid`
  - `instance_location`
  - `keyword_location`
  - optional `absolute_keyword_location`
  - local `error` / `annotation`
  - optional nested child result refs or nested detail members
- A `validation_report` member should summarize bundle-level conformance and link the result members produced in one validation run, instead of storing raw Ajv arrays as the durable artifact.
- Because JSON Schema distinguishes flat `Basic` output and hierarchical `Detailed` output, dp-ring can support both a compact result-member list and an optional parent/child relation without inventing a second incompatible artifact family.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding the validation shell directly in the repo’s existing JSON-Schema/Ajv substrate.
- **Refines Phase 1** by narrowing the next artifact step to `validation_report` + `validation_result` projected from output units, not generic “richer validation” language.
- **Rejects** continuing with only `{ valid, errors }` or designing an unrelated custom error envelope that loses schema/output structure.

Repo-specific consequence:
- `ring/lib/validator.mjs` should eventually remain a convenience API, but the docs-level kernel should treat JSON Schema output units as the semantic source for durable validation members.

#### Finding 2: RO-Crate sharpens the publication root into a governed root subject, not just a member list
The current memo already wanted a publication root, but RO-Crate clarifies an important missing detail: the root should itself be a self-describing subject with explicit `about` semantics and a declared profile/conformance marker. That matters because dp-ring currently has inline governance statements but still no root artifact saying what one publication cycle is actually about.

Implication for dp-ring:
- A `publication_root` should be a first-class governed subject for one checkpoint or branch publication cycle, not just an array wrapper around statements.
- The root should declare:
  - a stable root id
  - a profile / `conforms_to` URI
  - an explicit `about` subject descriptor for the checkpoint, branch decision, or publication cycle being governed
  - the governed member set for that cycle
- This lets replay ask “what exact publication bundle about subject X was evaluated?” instead of reverse-engineering meaning from scattered inline members.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the publication-root bundle a real governance artifact rather than a packaging convenience.
- **Refines Phase 1** by adding root identity/profile/about-subject semantics before guard-evaluation semantics expand further.
- **Rejects** anonymous member bags, implicit root meaning, or treating checkpoint `publication_statements` arrays as the final publication model.

Repo-specific consequence:
- The next docs artifact should define a self-describing `publication_root` class before more runtime code accumulates around inline `checkpoint.data.publication_statements` and `branch-event.data.statement` alone.

#### Finding 3: OCI descriptors show the member catalog should be descriptor-indexed, and the repo is already halfway there
OCI’s descriptor model matters because dp-ring already has almost the same primitives in `createSubjectDescriptor`: `mediaType`, `digest`, `size`, and `locator`. The missing step is not a new content-addressability theory; it is using those existing descriptor-like fields as the membership contract for publication-root bundles.

Implication for dp-ring:
- Publication-root members should be descriptor-like references with a small stable field set:
  - `mediaType`
  - `digest`
  - `size`
  - optional `locator`
  - optional `artifact_type` / `annotations`
- `validation_report`, `validation_result`, and inline governance-statement projections should all attach to the root through the same descriptor-indexed catalog instead of each family inventing its own reference syntax.
- This also gives replay a concrete integrity rule: member descriptors identify what bytes/content were evaluated, while root membership defines which descriptor set is authoritative for a publication cycle.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the publication-root/member shell a concrete membership substrate.
- **Refines Phase 1** by showing that root/member design should reuse the repo’s existing descriptor-like fields rather than inventing another membership grammar.
- **Rejects** anonymous inline blobs, ad hoc member ids without content identity, or family-specific reference schemes for validation vs governance members.

Repo-specific consequence:
- Because `ring/lib/governance-statement.mjs` already emits descriptor-like subject fields, the next docs step should specify how those descriptors become reusable publication-root member entries rather than remaining local to individual statements.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by sharpening the package/root problem one step further: the next kernel artifact is not merely “some publication root plus validation shell,” but a **self-describing publication-root subject with descriptor-indexed members, where validation report/result members project directly from JSON Schema output units**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication-root direction now has a clearer internal shape: root subject/profile/about semantics plus descriptor-indexed members and JSON-Schema-shaped validation units.
- **Phase 2 / Heterogeneous node ecology** stays aligned because rich nodes can later publish outputs, evidence, and validation material into a shared member catalog without leaking internal caches or traces.
- **Phase 3 / Projection** remains downstream: operator surfaces and control-plane services should project this root/member structure rather than inventing parallel bundle or manifest formats.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance-statement shell and runtime branch metrics
- define a **publication_root** artifact whose root is itself the governed semantic subject for one publication cycle
- define a **member descriptor** vocabulary that reuses the repo’s `mediaType` / `digest` / `size` / `locator` substrate
- define `validation_report` and `validation_result` as distinct member classes projected from JSON Schema output units with singular instance locations
- keep `guard_evaluation` and acceptance-to-decision semantics as the next layer after the publication-root/member shell is fixed

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `publication_root + member_descriptor + validation_report/result` field tables before more metric tuning or richer node variety work
- treat inline `checkpoint.data.publication_statements` and `branch-event.data.statement` as projection inputs to the publication root, not as the final bundle model
- reuse the existing descriptor-like subject fields instead of inventing a second membership grammar
- do **not** jump to guard-evaluation expansion, richer node internals, UI/operator surfaces, Rust control-plane work, or product projection until the root/member shell is specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into explicit docs-level profiles that fit the live repo:

1. **publication_root + member_descriptor field-table sketch**
   - define exact root fields (`id`, `profile_uri` / `conforms_to`, `about`, `status`, `member_descriptors`, optional bundle digest) and the minimal member-descriptor shape reused across statements and validation members

2. **inline-to-root projection rules**
   - specify how `checkpoint.data.publication_statements` and `branch-event.data.statement` project into descriptor-indexed publication-root members without losing digest identity or subject meaning

3. **validation report/result linkage sketch under the root**
   - define how one `validation_report` summarizes conformance and links one or more `validation_result` members carrying `instance_location`, `keyword_location`, optional `absolute_keyword_location`, severity/message, and optional nested detail relations

## 2026-04-20 05:44 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; Phase 1 is not blocked on missing `divergenceScore` / `composabilityScore` / `governancePressureScore` / `effectiveForceScore`.
- `ring/lib/governance-statement.mjs` still exposes descriptor-like subject fields (`mediaType`, `digest`, `size`, `locator`), while `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/branch-event.schema.json` still embed governance statements inline through `checkpoint.data.publication_statements` and `branch-event.data.statement`.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `validation_report`, or `validation_result` vocabulary under `.ring/schemas/` or `ring/lib/`.
- The sharper live Phase 1 gap is therefore now: dp-ring needs a **package/resource-style publication-root shell** where the root carries a required member catalog, each member has an explicit publication mode, and validation artifacts join that same catalog rather than living as ad hoc root metadata or raw inline blobs.

### Sources reviewed
1. Frictionless Data, **Data Package**
   - Official URL: https://specs.frictionlessdata.io/data-package/
   - Official schema URL: https://specs.frictionlessdata.io/schemas/data-package.json
   - Access note: the official HTML page was directly reachable in browser automation. Direct terminal fetches to the official site returned `403`, so browser-rendered text was used for the prose and `https://r.jina.ai/http://specs.frictionlessdata.io/schemas/data-package.json` was used only as a readable mirror of the official schema JSON.
   - Key evidence:
     - the spec says “A Data Package consists of” metadata plus “Resources such as data files that form the contents of the package”
     - it says the descriptor “MUST contain a `resources` property describing the data resources”
     - it says `profile` is “A string identifying the profile of this descriptor”
     - the official schema requires `resources`, and describes it as “An `array` of Data Resource objects”

2. Frictionless Data, **Data Resource**
   - Official URL: https://specs.frictionlessdata.io/data-resource/
   - Official schema URL: https://specs.frictionlessdata.io/schemas/data-resource.json
   - Access note: the official HTML page was directly reachable in browser automation. Direct terminal fetches to the official site returned `403`, so browser-rendered text was used for the prose and `https://r.jina.ai/http://specs.frictionlessdata.io/schemas/data-resource.json` was used only as a readable mirror of the official schema JSON.
   - Key evidence:
     - the spec says “The essence of a Data Resource is a locator for the data it describes”
     - it says a resource location “MUST be specified by the presence of one (and only one)” of `path` or `data`
     - the official schema requires either `name` + `data` or `name` + `path`
     - the official schema says resource `name` “SHOULD be invariant, meaning it SHOULD NOT change when its parent descriptor is updated”
     - the spec/schema define resource metadata such as `mediatype`, `bytes`, and `hash`

3. JSON Schema Draft 2020-12 Core, section 12 **Output Formatting**
   - Official URL: https://json-schema.org/draft/2020-12/json-schema-core.html#section-12
   - Access note: the official page was directly reachable in browser automation.
   - Key evidence:
     - “Each sub-result SHOULD contain the information contained within this section at a minimum.”
     - “A single object that contains all of these components is considered an output unit.”
     - `keywordLocation` and `instanceLocation` “MUST be expressed as a JSON Pointer”
     - nested result structure is carried in `errors` / `annotations`

### Findings

#### Finding 1: `publication_root` should behave like a package descriptor with a required member catalog, not just a self-describing root blob
The recent memo slices already established that dp-ring needs a self-describing `publication_root` with `about` / profile semantics. The Frictionless package model sharpens one missing detail: the root is not complete if it only identifies itself. It also needs a required catalog of member descriptors, analogous to a package descriptor’s required `resources` array.

Implication for dp-ring:
- A Phase 1 `publication_root` should likely require both:
  - root identity/profile/about-subject fields
  - a required `member_descriptors` (or equivalent) catalog for one publication cycle
- That member catalog should be the authoritative answer to “what governed artifacts belong to this checkpoint or branch publication cycle?”
- Root metadata should stay small; the member catalog should carry the growth in artifact variety.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the publication-root direction into a package/resource split rather than a vague manifest idea.
- **Refines Phase 1** by saying the next docs artifact needs a required member catalog, not only `profile_uri` / `conforms_to` / `about` fields.
- **Rejects** any design where `publication_root` is only a self-describing header and artifact membership remains implicit, optional, or scattered back into checkpoint fields.

Repo-specific consequence:
- The live repo already has inline governance statements and descriptor-like subject fields, but still no first-class root/member catalog.
- The next docs artifact should therefore define `publication_root` and its required member catalog before adding more artifact families.

#### Finding 2: `member_descriptor` should be a resource-like profile with stable identity and exactly one publication mode
The Data Resource material sharpens the next open problem more than the current memo did. The missing issue is not only “what fields should a member descriptor contain?” It is also “what kind of payload relationship does a member have to its content?” Frictionless answers that with a small but powerful rule: a resource has a stable identity and exactly one location mode (`path` or `data`).

Implication for dp-ring:
- A Phase 1 `member_descriptor` should likely have:
  - a stable member `name` / id that does not depend on catalog order
  - an explicit member `profile` / artifact class
  - reused descriptor fields such as `mediaType`, `digest`, `size`, and optional `locator`
  - exactly one publication mode, e.g. inline projection vs referenced artifact, rather than an ambiguous blob with both embedded payload and locator hints
- This materially sharpens the inline-to-root projection problem:
  - `checkpoint.data.publication_statements` and `branch-event.data.statement` can project as **inline-governance members**
  - future validation artifacts can project as **referenced members** without inventing a second membership grammar
- Stable member naming also helps replay and diffing: membership identity should not drift just because the root is reissued.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving `member_descriptor` a tighter shape than a generic descriptor map.
- **Refines Phase 1** by adding a publication-mode rule on top of the existing descriptor-like substrate.
- **Rejects** mixing inline payload, external refs, and ad hoc detail blobs in the same unconstrained member shape.

Repo-specific consequence:
- `createSubjectDescriptor()` already gives dp-ring most of the descriptor substrate, but not stable member naming or a docs-level one-of rule for inline vs referenced publication members.
- The next docs artifact should define those rules before runtime code accumulates more special cases around inline statements.

#### Finding 3: validation artifacts should become package members in the same catalog, not exceptional root metadata
The JSON Schema output-unit model remains the right basis for `validation_result`. Combined with the package/resource split above, it sharpens one more point that was still somewhat implicit in the memo: validation material should be cataloged as governed members alongside governance statements, not stored as a root-level `valid/errors` side channel.

Implication for dp-ring:
- A `validation_report` should summarize conformance for one publication cycle and link result members.
- Individual `validation_result` members should preserve output-unit structure (`keywordLocation`, `instanceLocation`, nested detail, message/annotation) and attach through the same member catalog as other publication members.
- This keeps the root small and predictable while preserving artifact-boundary discipline: the root describes the cycle; members carry the detailed evidence.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by aligning publication-root membership and validation normalization into one shell.
- **Refines Phase 1** by saying the next validation step is not just “report/result fields,” but “report/result fields as first-class members under the root catalog.”
- **Rejects** adding another root-level validation blob or reusing checkpoint/branch-event metadata as the durable validation container.

Repo-specific consequence:
- Because `ring/lib/validator.mjs` still returns only `{ valid, errors }`, the next docs artifact should define how those raw returns project into cataloged `validation_report` and `validation_result` members instead of expanding the raw return shape in place.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by sharpening the current package/root direction one step further: the next kernel shell should be a **package/resource split** — `publication_root` as package descriptor, `member_descriptor` as resource-like member profile, and `validation_report` / `validation_result` as member families inside the same catalog.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication-root direction now has a clearer internal division of labor: root identity/profile/about vs member catalog vs member payload mode.
- **Phase 2 / Heterogeneous node ecology** stays aligned because rich nodes can later publish diverse member types into one shared catalog without leaking node internals or inventing family-specific attachment grammars.
- **Phase 3 / Projection** remains downstream: operator surfaces and control-plane services should project this root/member shell rather than inventing independent bundle formats.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance-statement shell and runtime branch metrics
- define a `publication_root` artifact with both root identity/profile/about semantics **and a required member catalog**
- define a `member_descriptor` profile with stable member identity, artifact/profile class, descriptor fields, and an explicit one-of publication mode
- define `validation_report` and `validation_result` as member families that attach through that same catalog
- treat inline checkpoint/branch-event statements as projection inputs into the member catalog, not as the final publication model

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level `publication_root required catalog + member_descriptor mode rules + validation member attachment` work before more metric tuning, acceptance-semantics expansion, or richer node variety work
- reuse `createSubjectDescriptor()` and the existing inline governance-statement shell as the substrate for member descriptors rather than inventing a second descriptor grammar
- do **not** stuff validation summaries, membership lists, or inline/external mode flags back into `checkpoint.data` or `branch-event.data.details`
- do **not** jump to runtime implementation, UI/operator surfaces, Rust control-plane work, or product projection until the root/member package-resource split is specified in docs

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into explicit docs-level field tables that fit the live repo:

1. **`publication_root` package-descriptor field table**
   - define exact root fields for identity/profile/about/status plus the required member-catalog field and optional root digest / issuance metadata

2. **`member_descriptor` publication-mode table**
   - define stable member naming, artifact/profile class, reused descriptor fields, and the exact one-of rule for inline projection vs referenced artifact members

3. **inline-to-root projection + validation attachment rules**
   - specify how `checkpoint.data.publication_statements` and `branch-event.data.statement` become inline catalog members, and how `validation_report` / `validation_result` join that same catalog without becoming special root metadata

## 2026-04-20 07:04 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-statement.mjs` still exposes a descriptor-like subject core (`name`, `mediaType`, `digest`, `size`, `locator`), and `.ring/schemas/checkpoint.schema.json` / `.ring/schemas/branch-event.schema.json` still keep governance statements inline via `checkpoint.data.publication_statements` and `branch-event.data.statement`.
- Targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `payload_mode`, or `validation_report` / `validation_result` schema vocabulary under `.ring/schemas/`.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and `ring/lib/node-contract.mjs` still only consumes `error.instancePath`, so the live repo still lacks a publication-level projection that preserves rule identity, secondary property focus, and structured validation params.
- The sharper live Phase 1 gap is therefore now: dp-ring needs docs-level field tables that (a) separate descriptor identity from payload/publication mode, (b) make the root member catalog required even when empty, and (c) define an Ajv-grounded validation leaf profile before policy/evaluation layers expand further.

### Sources reviewed
1. Open Container Initiative image-spec, **Content Descriptor**
   - Official source URL: https://github.com/opencontainers/image-spec/blob/v1.1.0/descriptor.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/v1.1.0/descriptor.md
   - Access note: direct raw official URL was reachable.
   - Key evidence:
     - descriptors require `mediaType`, `digest`, and `size`
     - descriptors may carry `urls`, `annotations`, and embedded `data`
     - embedded `data` “SHOULD be verified against the `digest` and `size` fields”

2. Open Container Initiative image-spec, **Image Index Specification**
   - Official source URL: https://github.com/opencontainers/image-spec/blob/v1.1.0/image-index.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/v1.1.0/image-index.md
   - Access note: direct raw official URL was reachable.
   - Key evidence:
     - `manifests` is REQUIRED
     - the `manifests` array MAY be zero-length
     - each manifest entry reuses descriptor properties
     - the root may also carry `subject` and `annotations`

3. Ajv API Reference, **Error objects**
   - Official source URL: https://ajv.js.org/api.html#error-objects
   - Access note: direct official docs page was reachable.
   - Key evidence:
     - each `ErrorObject` carries `keyword`, `instancePath`, `schemaPath`, `params`, optional `propertyName`, and optional `message`
     - for `propertyNames` failures, `instancePath` still points to the object rather than the offending property name

### Findings

#### Finding 1: Descriptor identity should stay stable across inline vs referenced publication modes
The current memo already established that `member_descriptor` should reuse the repo's descriptor substrate and carry an explicit publication mode. The OCI descriptor spec sharpens the next step: required identity fields (`mediaType`, `digest`, `size`) survive regardless of whether payload is carried by retrieval URL or embedded `data`. That means publication mode is about conveyance, not identity.

Implication for dp-ring:
- `member_descriptor` should keep a stable descriptor core across both inline-projected and referenced members.
- Inline governance members should not be second-class raw blobs that bypass digest/size/mediaType discipline.
- If dp-ring later allows embedded publication payloads, they should still be verified against the same descriptor identity instead of inventing a parallel inline-only shape.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tightening the `member_descriptor` shell around a stable identity core rather than a family-specific blob.
- **Refines Phase 1** by separating “what this member is” from “how this member is conveyed.”
- **Rejects** any design where inline checkpoint/branch-event projections use one grammar and referenced validation/provenance members use another.

Repo-specific consequence:
- `createSubjectDescriptor()` already provides the right identity substrate.
- The next docs artifact should explicitly say that publication mode does not alter descriptor identity, only payload carriage/projection rules.

#### Finding 2: `publication_root` should require a member catalog even when the publication cycle currently carries zero members
The latest memo already sharpened the need for a required root catalog. The OCI image index spec adds an operationally useful detail: the catalog field is still required even when the array is empty. That is a better fit for dp-ring than making membership optional until the first artifact appears.

Implication for dp-ring:
- `publication_root.member_descriptors` should likely be REQUIRED and allowed to be `[]`.
- This gives replay and validation a stable root shape from the first issuance of a publication cycle.
- It also allows dp-ring to represent initialization, withheld-publication, or root-only status transitions without fabricating placeholder members or silently omitting the catalog.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the root/member shell structurally total from day one.
- **Refines Phase 1** by turning “required catalog” into “required catalog with explicit empty-state semantics.”
- **Rejects** optional-member-catalog designs that force special cases before or between publication attachments.

Repo-specific consequence:
- Because the live repo still has no `publication_root`, the next docs field table should define the empty-catalog case now instead of leaving it to runtime improvisation later.

#### Finding 3: Ajv leaf errors already expose the missing rule/source and secondary-focus data that dp-ring should preserve in `validation_result`
Earlier memo slices already fixed the direction toward JSON-Schema-grounded validation results. The Ajv `ErrorObject` docs sharpen the live projection step: the current repo is not missing validator detail, it is failing to preserve it at the publication layer. `schemaPath`, `keyword`, `params`, and optional `propertyName` are materially important, and they are not reducible to `instancePath` alone.

Implication for dp-ring:
- A `validation_result` should preserve at least:
  - subject location from `instancePath`
  - rule/source location from `schemaPath` (or its JSON-Schema-output equivalent)
  - rule kind from `keyword`
  - structured machine payload from `params`
  - optional display text from `message`
  - optional secondary property focus from `propertyName`
- This is especially important for `propertyNames`-style failures, where `instancePath` alone points only to the containing object.
- `validation_report` should then aggregate/link these results instead of flattening them back into one `{ valid, errors }` blob.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the validation member family into rule-aware, location-aware result units.
- **Refines Phase 1** by distinguishing stable machine fields (`schemaPath`, `keyword`, `params`) from optional display text (`message`).
- **Rejects** any design that treats `instancePath` or human-readable messages as the full durable validation semantics.

Repo-specific consequence:
- `ring/lib/node-contract.mjs` currently only uses `error.instancePath`.
- The next docs artifact should define the full projection from current Ajv errors into `validation_result` members before any attempt to expand guard-evaluation or acceptance semantics.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by tightening the publication-root/member shell one step further: the next docs cut should separate **descriptor identity vs payload mode**, define a **required-but-possibly-empty member catalog**, and specify an **Ajv-leaf-to-validation-result projection** before broader decision/evaluation layers are added.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication shell now has sharper boundary rules:
  - stable descriptor identity regardless of conveyance mode
  - explicit empty-state semantics for the root catalog
  - rule-aware validation leaves rather than flat copied error blobs
- **Phase 2 / Heterogeneous node ecology** stays aligned because rich nodes will later be able to publish both inline and referenced outputs through one descriptor grammar.
- **Phase 3 / Projection** remains downstream: operator surfaces and transport layers should project these kernel field tables, not invent them.

#### Mainline refined
Phase 1 should now be read more precisely as:
- define a `publication_root` whose `member_descriptors` field is REQUIRED even when empty
- define a `member_descriptor` core that reuses `name` / `mediaType` / `digest` / `size` / optional `locator`
- define publication mode as a conveyance rule layered on that descriptor core, not as a second identity grammar
- define `validation_report` / `validation_result` so current Ajv errors project into rule-aware result units with subject location, rule location, machine params, and optional secondary property focus
- keep acceptance, guard-evaluation, and decision-table semantics as the next layer after those field tables are stable

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for:
  - required-empty `publication_root.member_descriptors`
  - descriptor-core vs payload-mode rules
  - Ajv error → `validation_result` projection
- do **not** widen early into richer acceptance semantics, guard-evaluation artifacts, UI work, or Rust/control-plane work before these three field-table cuts exist
- do **not** let inline checkpoint/branch-event statements keep growing as a parallel publication system outside the forthcoming root/member shell

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs-level tables and projection rules:

1. **`publication_root` empty-state field table**
   - define the required catalog field, allowed empty-state semantics, and the minimal root status / issuance fields for a publication cycle with zero attached members

2. **`member_descriptor` identity-vs-conveyance table**
   - define the stable descriptor core separately from the one-of publication/payload mode rule, using the repo's existing `mediaType` / `digest` / `size` / `locator` substrate

3. **Ajv-leaf projection table for `validation_result`**
   - define how current Ajv `ErrorObject` fields (`instancePath`, `schemaPath`, `keyword`, `params`, `propertyName`, `message`) map into governed validation members linked by `validation_report`

## 2026-04-20 15:27 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-statement.mjs` still exposes the descriptor core the repo already knows how to produce (`name`, `mediaType`, `digest`, `size`, `locator`), while targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `payload_mode`, `validation_report`, or `validation_result` schema vocabulary under `.ring/schemas/`.
- `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/branch-event.schema.json` still keep governance statements inline through `checkpoint.data.publication_statements` and `branch-event.data.statement`, so dp-ring still lacks a first-class root/member publication shell rather than lacking statement machinery.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and `ring/lib/node-contract.mjs` still reduces Ajv failures to `instancePath` plus a required-property special case, so the live repo still lacks a durable validation leaf profile rich enough for governed publication members.
- The sharper live Phase 1 gap is therefore now: dp-ring needs an exact docs-level **field-table cut** that (a) separates artifact/profile class from transport media type, (b) makes the publication-root member catalog structurally total even when empty, and (c) preserves Ajv leaf detail without flattening secondary focus information back into prose.

### Sources reviewed
1. Open Container Initiative image-spec, **Content Descriptor**
   - Official source URL: https://github.com/opencontainers/image-spec/blob/v1.1.0/descriptor.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/v1.1.0/descriptor.md
   - Access note: direct raw official URL was reachable.
   - Key evidence:
     - descriptor `mediaType`, `digest`, and `size` are REQUIRED
     - `data` is OPTIONAL and, when present, “MUST” decode to the referenced content and “SHOULD” be verified against `digest` and `size`
     - `artifactType` is OPTIONAL and distinct from `mediaType`

2. Open Container Initiative image-spec, **Image Index Specification**
   - Official source URL: https://github.com/opencontainers/image-spec/blob/v1.1.0/image-index.md
   - Direct raw URL used: https://raw.githubusercontent.com/opencontainers/image-spec/v1.1.0/image-index.md
   - Access note: direct raw official URL was reachable.
   - Key evidence:
     - `manifests` is REQUIRED
     - the `manifests` array “MAY be zero” length
     - the root may also carry a separate `subject` descriptor

3. Ajv API Reference, **Error objects**
   - Official source URL: https://ajv.js.org/api.html#error-objects
   - Access note: the official page was browser-readable; rendered DOM text was extracted from the official page because terminal HTML was noisy.
   - Key evidence:
     - each `ErrorObject` carries `keyword`, `instancePath`, `schemaPath`, `params`, optional `propertyName`, and optional `message`
     - for `propertyNames` failures, `propertyName` is set while `instancePath` “still points to the object in this case”

### Findings

#### Finding 1: `member_descriptor` should separate artifact/profile class from descriptor identity, and keep payload mode as a third concern
The latest memo already established that dp-ring needs a stable descriptor core plus a publication/payload mode. Revisiting the OCI descriptor spec sharpens one more missing detail: OCI explicitly distinguishes required descriptor identity (`mediaType`, `digest`, `size`) from optional artifact typing (`artifactType`) and from optional embedded payload carriage (`data`). That is a cleaner split than letting one dp-ring field do all three jobs.

Implication for dp-ring:
- A Phase 1 `member_descriptor` should likely keep a stable identity core (`name`, `mediaType`, `digest`, `size`, optional `locator`).
- It should also carry a separate artifact/profile-class field (`artifact_type`, `profile`, or equivalent) rather than overloading `mediaType` to say both “how bytes are encoded” and “what governance member this is.”
- Publication/payload mode should stay a third axis layered on top of that identity/class split, e.g. inline-projected vs referenced member, rather than being baked into descriptor identity.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the emerging `member_descriptor` shell into a more exact three-way split: identity core vs artifact class vs payload mode.
- **Refines Phase 1** by giving the next docs cut a concrete reason not to overload `mediaType`.
- **Rejects** any design where inline governance statements, validation results, and future guard-evaluation members all encode their class implicitly through ad hoc media-type strings or member-name conventions alone.

Repo-specific consequence:
- `createSubjectDescriptor()` already gives dp-ring the identity core it needs.
- The next docs artifact should add the missing artifact/profile-class field and the one-of payload-mode rule rather than changing the descriptor core itself.

#### Finding 2: `publication_root.member_descriptors` should be required even when empty, and root subjecthood should stay separate from membership
The recent memo already established the need for a self-describing root plus a required member catalog. The OCI image index spec sharpens two practical details at once: a required catalog can still be zero-length, and root-level `subject` semantics are not the same thing as member entries.

Implication for dp-ring:
- `publication_root.member_descriptors` should likely be REQUIRED and allowed to be `[]`.
- `publication_root.about` (or equivalent root subject field) should remain separate from the member catalog, so the root can still say what publication cycle it governs even before any members are attached.
- This lets dp-ring represent initialization, withheld publication, or root-only status transitions without special-casing away the catalog or fabricating placeholder members.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the publication-root shell structurally total from first issuance.
- **Refines Phase 1** by distinguishing root subjecthood from catalog membership more explicitly.
- **Rejects** optional-catalog designs and any design that tries to make the root subject just another anonymous catalog member.

Repo-specific consequence:
- Because the live repo still stores statements inline on checkpoint/branch-event artifacts, the next docs artifact should define the required-empty catalog and root-subject field before runtime code accumulates more implicit membership rules.

#### Finding 3: `validation_result` needs a separate secondary-focus field instead of pretending `instancePath` tells the whole story
The current memo already narrowed validation work toward Ajv/JSON-Schema-shaped result units. The Ajv `ErrorObject` docs sharpen the next docs cut more precisely than the repo currently does: `propertyName` is not reducible to `instancePath`, and for `propertyNames` failures the instance path still points at the containing object.

Implication for dp-ring:
- A Phase 1 `validation_result` should preserve at least:
  - subject location from `instancePath`
  - rule location from `schemaPath`
  - rule kind from `keyword`
  - machine detail from `params`
  - optional display text from `message`
  - optional secondary focus from `propertyName`
- This means dp-ring should not try to normalize everything into one `path` string or one human-readable message.
- A `validation_report` should then summarize and link these richer result leaves instead of flattening them back into `{ valid, errors }`.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the validation leaf profile more exact at the point where the live repo is still lossy.
- **Refines Phase 1** by saying the next result-unit cut is not just “carry `instancePath`,” but “preserve both primary subject location and secondary property focus where Ajv distinguishes them.”
- **Rejects** any design that treats `message` text or a single flattened path field as the durable semantics of a validation result.

Repo-specific consequence:
- `ring/lib/node-contract.mjs` currently uses `instancePath` and `missingProperty`, but it drops the broader structured leaf shape.
- The next docs artifact should define the full projection now, before a publication-root shell or runtime helper bakes in an overly narrow validation result contract.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by tightening the next docs cut into a more exact field-table problem: **descriptor identity vs artifact class vs payload mode, required-empty root membership, and Ajv leaf projection that preserves secondary focus.**

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the current publication/validation shell is now closer to an implementable docs artifact rather than a loose direction.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes will later be able to publish different member classes through one descriptor grammar without leaking local internals.
- **Phase 3 / Projection** remains downstream: UI/query/control-plane layers should project these field tables rather than inventing them.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed governance-statement shell and runtime branch metrics
- define a `publication_root` with a required-but-possibly-empty `member_descriptors` catalog plus explicit root-subject semantics
- define a `member_descriptor` split across:
  - stable descriptor identity (`name`, `mediaType`, `digest`, `size`, optional `locator`)
  - artifact/profile class (`artifact_type` / `profile` / equivalent)
  - one-of payload/publication mode
- define `validation_report` and `validation_result` so current Ajv errors project into result leaves that preserve `instancePath`, `schemaPath`, `keyword`, `params`, optional `propertyName`, and optional `message`
- keep guard-evaluation, acceptance overlays, and broader decision shells as the next layer after these field tables are fixed

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for:
  - `publication_root.about` + required-empty `member_descriptors`
  - `member_descriptor` identity/class/mode separation
  - `validation_result` primary-location vs secondary-focus projection
- do **not** reopen metrics work, richer node internals, UI/operator surfaces, or Rust/control-plane work before these field tables are written down
- do **not** let runtime helpers or schema patches guess at `artifact_type` vs `mediaType` semantics implicitly; the docs cut should decide that first

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and examples:

1. **`member_descriptor` identity/class/mode table**
   - choose the exact field names and invariants for descriptor identity, artifact/profile class, and one-of payload mode

2. **`publication_root` root-subject + empty-catalog table**
   - define the exact root fields for `about`/subject semantics, required `member_descriptors`, and the allowed empty-state meanings

3. **`validation_result` leaf examples for tricky Ajv cases**
   - add example projections for ordinary keyword failures, `required` failures, and `propertyNames` failures so the docs do not collapse `propertyName` back into prose

## 2026-04-20 17:04 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` still collapses Ajv failures to `instancePath` plus a required-property special case, so the live repo still lacks first-class `validation_report` / `validation_result` publication members.
- `ring/lib/governance-statement.mjs` still exposes the descriptor core (`name`, `mediaType`, `digest`, `size`, `locator`), and `.ring/schemas/checkpoint.schema.json` / `.ring/schemas/branch-event.schema.json` still keep governance statements inline via `checkpoint.data.publication_statements` and `branch-event.data.statement`.
- Targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `payload_mode`, `validation_report`, `validation_result`, `guard_evaluation`, `jsonpath`, or `json-patch` schema vocabulary under `.ring/schemas/`; those terms still appear only in the rolling memo rather than the runtime/schema substrate.
- `.ring/schemas/evaluation.schema.json` still describes retrospective session-quality scoring (`"Quality scores for a completed session"`), so the repo still needs an explicit docs-level boundary preventing validation reports, guard evaluations, and retrospective evaluations from collapsing into one overloaded artifact family.
- The sharper live Phase 1 gap is therefore now: dp-ring needs an explicit **singular-pointer location policy** and **validation report/result split** for the publication-root shell, so governed member locations are stable and replayable before any broader acceptance or guard-evaluation layer is added.

### Sources reviewed
1. RFC 6901, **JSON Pointer**
   - Official source URL: https://www.rfc-editor.org/rfc/rfc6901.txt
   - Access note: direct official text was reachable.
   - Key evidence:
     - JSON Pointer defines “a string syntax for identifying a specific value” within a JSON document.
     - evaluation begins at the root and each reference token is evaluated sequentially until it references some value within the document.

2. RFC 6902, **JSON Patch**
   - Official source URL: https://www.rfc-editor.org/rfc/rfc6902.txt
   - Fallback used after direct fetch hit a TLS EOF in terminal: https://r.jina.ai/http://www.rfc-editor.org/rfc/rfc6902.txt
   - Access note: the official RFC URL was tried first; `r.jina.ai` was used only for readable extraction after the direct terminal fetch failed.
   - Key evidence:
     - operations are applied sequentially in array order, with each result becoming the next target document.
     - each operation object MUST have exactly one `path` member containing a JSON Pointer to the target location.

3. RFC 9535, **JSONPath: Query Expressions for JSON**
   - Official source URL: https://www.rfc-editor.org/rfc/rfc9535.txt
   - Access note: direct official text was reachable.
   - Key evidence:
     - a JSONPath expression “selects zero or more nodes” and outputs them as a nodelist.
     - query results may be represented as values, as “Normalized Paths”, or both, and duplicate nodes are not removed.

### Findings

#### Finding 1: Governed member locations should use singular pointer-addressed refs, not selector/query expressions
RFC 6901 is the cleanest primary-source justification for a canonical location language in the governance kernel: JSON Pointer identifies a specific value, starts from the document root, and resolves reference tokens sequentially. That fits the current repo better than any query language because the live validator and node-contract code already think in singular subject locations (`instancePath`), not multi-hit selection sets.

Implication for dp-ring:
- `validation_result.subject_location` (or equivalent) should be a singular pointer-addressed ref, not a JSONPath query.
- `validation_result.rule_location` should also stay singular and stable, whether represented as current Ajv `schemaPath` or the later JSON-Schema-output equivalent.
- Pointer-addressed refs are the right default for publication-root member subjects because they are deterministic, replayable, and match the repo's current thin validation substrate.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tightening the publication-root/member shell around deterministic governed locations.
- **Refines Phase 1** by saying the next docs cut is not only about field names, but also about the canonical location language those fields use.
- **Rejects** any design where durable governance members are addressed by multi-target selectors or free-form query strings.

Repo-specific consequence:
- The next docs artifact should define a singular-pointer policy now, before `validation_result`, `guard_evaluation`, or future acceptance members each invent their own location grammar.

#### Finding 2: JSONPath is appropriate for tooling/query surfaces, but not as the kernel's canonical member-address language
RFC 9535 sharpens an anti-drift boundary that the repo still lacks in docs: JSONPath queries return nodelists, may select zero or more nodes, may preserve duplicates, and may surface normalized paths only as one possible API representation. That is useful for read/query tooling, but it is the wrong shape for governed publication members that need one stable subject per result.

Implication for dp-ring:
- JSONPath is reasonable for operator search, diagnostics, or read-model tooling.
- JSONPath should not be the canonical location language for `publication_root` members, validation leaves, or future guard-evaluation outputs.
- If tooling wants multi-hit discovery, it should project query results onto canonical singular member refs rather than storing the query itself as the governed artifact address.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by preventing the publication shell from drifting toward query-surface semantics.
- **Refines Phase 1** by separating kernel identity/addressing from later read/query convenience.
- **Rejects** any attempt to treat “returns a list of nodes” semantics as the durable subject model for governance artifacts.

Repo-specific consequence:
- The next docs cut should explicitly say that JSONPath-like selectors are tooling-only and that governed member locations remain singular even when a UI or read model later exposes query helpers.

#### Finding 3: JSON Patch is too order-sensitive and operational to be Phase 1's publication diff/redaction model
RFC 6902 is useful here mostly as a boundary marker. A JSON Patch document is a sequence of ordered operations, each applied to the result of the previous one, with each operation carrying exactly one `path`. That is strong evidence against using JSON Patch as the governance kernel's baseline-state, publication-diff, or redaction artifact model.

Implication for dp-ring:
- Phase 1 publication semantics should prefer declarative overlays such as `new` / `unchanged` / `updated` / `absent` and later `masked` / `erased`, not ordered edit programs.
- `validation_report` and `validation_result` should describe conformance state and subject/rule locations, not embed procedural patch scripts.
- If JSON Patch is ever used, it should stay a tooling or transport convenience, not the canonical governed artifact for publication-root replay semantics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by keeping the governance kernel declarative and replay-safe.
- **Refines Phase 1** by tightening the still-missing validation report/result shell around durable state descriptions instead of procedural edits.
- **Rejects** any design where publication-root changes, baseline diffs, or redaction semantics are defined primarily as ordered patch programs.

Repo-specific consequence:
- Because the live repo still has no `validation_report` / `validation_result` schema family, the next docs artifact should define declarative state overlays before any runtime helper starts serializing patch-like change programs.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by adding a sharper location-language and artifact-boundary rule to the current publication-shell work: **use singular pointer-addressed refs for governed member locations, reserve JSONPath for tooling/query surfaces, and keep JSON Patch out of the kernel's canonical publication semantics.**

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication-root and validation-member shell now has a clearer addressing discipline.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can still expose local query/search helpers later without leaking those query languages into the kernel's durable subject model.
- **Phase 3 / Projection** remains downstream: operator search surfaces can expose JSONPath-like convenience only after the kernel's singular member refs are defined.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed runtime metrics and governance-statement shell
- define a `publication_root` with explicit root subjecthood and required `member_descriptors`
- define `validation_report` and `validation_result` as distinct governed member families
- require governed member locations to use singular pointer-addressed refs
- keep JSONPath as a tooling/query layer and JSON Patch as a non-canonical operational format
- defer broader guard-evaluation, acceptance-status, and decision-table expansion until the report/result split and pointer policy are fixed

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize a docs-level `validation_report` / `validation_result` split plus singular-pointer field rules before broader acceptance semantics, guard-evaluation artifacts, or decision-table work
- add a docs-level warning that `.ring/schemas/evaluation.schema.json` is retrospective session scoring, not the governance validation/guard-evaluation shell
- do **not** adopt JSONPath as the durable member-address language just because it is attractive for query surfaces
- do **not** adopt JSON Patch as the kernel's baseline-diff or redaction model just because it already uses JSON Pointer paths

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and anti-drift notes:

1. **`validation_report` vs `validation_result` split table**
   - define which fields belong on the report root vs the leaf result members, including singular `subject_location` / `rule_location` pointer fields and linkage rules

2. **pointer-policy + tooling-boundary note for publication members**
   - define the canonical singular location grammar, plus an explicit rule that JSONPath is acceptable for search/query tooling but not for governed member addresses

3. **declarative overlay table for diff/redaction semantics**
   - define the minimal state vocabulary (`new` / `unchanged` / `updated` / `absent`, later `masked` / `erased`) so Phase 1 avoids drifting into JSON Patch-style ordered edit programs

## 2026-04-20 18:34 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; the active gap is not missing branch metrics.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` still collapses Ajv failures to `instancePath` plus a required-property special case, so the live repo still lacks a first-class publication-level `validation_report` / `validation_result` shell.
- `ring/lib/governance-statement.mjs` still exposes the descriptor core (`name`, `mediaType`, `digest`, `size`, `locator`), and it already uses `canonicalization.profile`, so the repo now has both a descriptor substrate and an existing local meaning for bare `profile`.
- `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/branch-event.schema.json` still keep governance statements inline through `checkpoint.data.publication_statements` and `branch-event.data.statement`.
- Targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `payload_mode`, `validation_report`, `validation_result`, `baseline_state`, `masked`, or `erased` vocabulary under `ring/lib/` or `.ring/schemas/`.
- The sharper live Phase 1 gap is therefore now: dp-ring needs an exact docs-level field-table cut that (a) separates representation media type from semantic profile/class, (b) fixes `validation_report` vs `validation_result` ownership, and (c) keeps baseline/redaction overlays narrower than generic JSON patch dialects.

### Sources reviewed
1. RFC 6906, **The 'profile' Link Relation Type**
   - Official source URL: https://www.rfc-editor.org/rfc/rfc6906.txt
   - Access note: direct official text was reachable.
   - Key evidence:
     - the abstract says a profile adds “additional semantics (constraints, conventions, extensions)” to a representation “in addition to those defined by the media type”
     - section 3 says a profile “MUST NOT change the semantics of the resource representation”
     - section 3.1 says a media type defines both “the semantics and the serialization” of content, while a profile is the mechanism for extra processing semantics when the original media-type model still applies

2. W3C Recommendation, **Shapes Constraint Language (SHACL)**
   - Official source URL: https://www.w3.org/TR/shacl/
   - Access note: the official page was browser-readable; rendered DOM text was extracted from the official page because the spec is large and line-oriented terminal output is noisy.
   - Key evidence:
     - section 3.6 says “The validation report is the result of the validation process that reports the conformance and the set of all validation results”
     - section 3.6.1 says the result graph has “exactly one” `sh:ValidationReport` and that the graph “may contain additional information such as provenance metadata”
     - section 3.6.2 says `sh:focusNode`, `sh:resultSeverity`, and `sh:sourceConstraintComponent` are mandatory for all validation results, while `sh:resultPath`, `sh:value`, `sh:detail`, and `sh:resultMessage` are result-level details

3. RFC 7396, **JSON Merge Patch**
   - Official source URL: https://www.rfc-editor.org/rfc/rfc7396.txt
   - Access note: direct official text was reachable.
   - Key evidence:
     - the spec says merge patch documents are suitable for documents that “primarily use objects” and “do not make use of explicit null values”
     - it says merge patch documents describe, “by example, a set of changes” and recipients must compare the patch with current content to determine the change operations
     - if the patch is anything other than an object, it replaces the entire target, and it is “not possible to patch part of a target that is not an object”

### Findings

#### Finding 1: `member_descriptor` should separate media type from semantic profile/class instead of overloading one field
RFC 6906 sharpens a naming and meaning problem that the memo had only partially pinned down: `mediaType` should keep its representation/serialization meaning, while the member's semantic class should be carried separately as an additional profile/class signal. A profile adds semantics without changing the underlying media-type contract.

Implication for dp-ring:
- A Phase 1 `member_descriptor` should likely keep `mediaType` for representation encoding only.
- The member's semantic class should be carried by a separate field such as `artifact_profile`, `member_profile`, or similarly explicit profile/class vocabulary, rather than overloading `mediaType` to mean both encoding and governance role.
- Because `ring/lib/governance-statement.mjs` already uses `canonicalization.profile`, the next docs cut should avoid an ambiguous bare `profile` field whose meaning could drift between canonicalization-profile, member semantic profile, and root conformance marker.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the `member_descriptor` field table more exact at the point where the repo already has a descriptor substrate.
- **Refines Phase 1** by turning the open naming problem into a concrete semantic split: representation media type vs additional profile/class.
- **Rejects** any design where `mediaType` alone or a loosely named bare `profile` field silently carries multiple unrelated semantics.

Repo-specific consequence:
- The live repo is already capable of emitting descriptor identity fields.
- The next docs artifact should add the missing semantic-profile/class field without changing the descriptor core.

#### Finding 2: `validation_report` vs `validation_result` ownership can now be specified more sharply
SHACL is useful here not because dp-ring should copy RDF vocabulary literally, but because it draws a very clean ownership boundary: one validation report owns conformance and the set of results, while each result owns focus, severity, rule source, and optional detail/message material.

Implication for dp-ring:
- A Phase 1 `validation_report` should own bundle-level conformance plus publication-run metadata, provenance/invocation metadata, summary counts, and linkage to result members.
- A Phase 1 `validation_result` should own the leaf facts:
  - primary subject location
  - rule/constraint source location or rule identifier
  - severity / result status
  - optional secondary focus/path
  - optional offending value/message/detail payloads
- This is a cleaner split than letting each result carry repeated run metadata or letting the report become a generic dump of raw Ajv errors.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the report/result split operationally specific instead of just stylistic.
- **Refines Phase 1** by clarifying that report-level provenance belongs on the report root, while leaf focus/rule/severity belongs on result members.
- **Rejects** designs that collapse conformance, invocation metadata, and per-leaf detail back into one generic validation blob.

Repo-specific consequence:
- Because `ring/lib/validator.mjs` still returns only `{ valid, errors }`, the next docs cut should define exact report-root vs result-leaf ownership before runtime helpers or schemas invent an ad hoc wrapper.

#### Finding 3: JSON Merge Patch shows Phase 1 overlays should stay narrower than generic patch dialects
The prior pass already ruled out JSON Patch as the canonical publication-diff model. RFC 7396 sharpens the boundary further: even a more declarative-looking patch-by-example format still depends on comparing against current content, uses null-as-removal semantics, replaces whole targets in some cases, and is structurally weak on non-object substructures such as arrays.

Implication for dp-ring:
- Phase 1 should not model baseline comparison or redaction as a generic JSON patch document family, whether operational (`JSON Patch`) or example-shaped (`JSON Merge Patch`).
- Instead, the publication shell should keep a narrow overlay vocabulary attached to canonical singular member refs, e.g.:
  - baseline state (`new` / `unchanged` / `updated` / `absent`)
  - later redaction state (`masked` / `erased`)
- This keeps replay and comparison centered on governed artifacts and states rather than on implicit document-diff algorithms.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by tightening the anti-drift boundary around baseline/redaction semantics.
- **Refines Phase 1** by saying the overlay table should be a small governed status vocabulary, not a generic patch grammar.
- **Rejects** drifting from the current pointer-and-report shell into Merge-Patch-style document examples just because they look more declarative than JSON Patch.

Repo-specific consequence:
- The live repo still lacks `baseline_state`, `masked`, and `erased` vocabulary entirely.
- The next docs artifact should define these as explicit governed overlay fields rather than as implicit outcomes of a patch dialect.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by tightening the next docs cut into a more exact schema/kernel problem: **representation media type vs semantic profile/class, report-root vs result-leaf ownership, and explicit overlay-state vocabulary instead of generic patch documents.**

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the publication/validation shell is now closer to an implementable field table: one descriptor core, one semantic-profile/class slot, one report/result ownership split, and one narrow overlay vocabulary.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later emit different governed member classes through the same descriptor grammar without leaking local transport quirks or local diff formats into the kernel.
- **Phase 3 / Projection** remains downstream: operator tooling can later expose richer query, diff, or patch affordances without turning those affordances into kernel publication semantics.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed runtime metrics and governance-statement shell
- define a `publication_root` with explicit root subjecthood and required `member_descriptors`
- define a `member_descriptor` split across:
  - representation identity (`name`, `mediaType`, `digest`, `size`, optional `locator`)
  - semantic profile/class (`artifact_profile` / equivalent)
  - one-of conveyance or payload mode
- define `validation_report` and `validation_result` so report roots own conformance/provenance/result linkage while result leaves own subject/rule/severity/detail facts
- define baseline/redaction overlays as explicit governed state fields rather than as JSON Merge Patch or JSON Patch documents

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for:
  - `member_descriptor` media-type vs semantic-profile/class separation
  - `validation_report` vs `validation_result` ownership
  - baseline/redaction overlay vocabulary
- do **not** overload `mediaType` to stand in for member semantic class
- do **not** introduce a bare overloaded `profile` field without clarifying how it differs from the already-landed `canonicalization.profile`
- do **not** adopt JSON Merge Patch or any other generic patch-by-example format as the kernel's durable overlay semantics
- do **not** reopen metrics work, richer node internals, UI/operator surfaces, or Rust/control-plane work before this field-table cut exists

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and worked examples:

1. **`member_descriptor` media-type vs semantic-profile/class table**
   - choose the exact field names and invariants for descriptor identity, semantic profile/class, and conveyance mode, including whether `artifact_profile` / `member_profile` / `conforms_to` should be distinct at root vs member level

2. **`validation_report` vs `validation_result` ownership table**
   - define precisely which fields belong on the report root (for example conformance, provenance, invocation, result refs, counts) versus result leaves (for example subject location, rule location, severity, optional path/value/message/detail)

3. **overlay-state table with non-patch examples**
   - add exact examples showing how `new` / `unchanged` / `updated` / `absent` and later `masked` / `erased` attach to singular member refs without becoming JSON Merge Patch or JSON Patch documents

## 2026-04-20 21:44 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; the active gap is not missing branch metrics.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, while `ring/lib/node-contract.mjs` still collapses Ajv failures to `instancePath` plus a required-property special case, so the live repo still lacks a first-class publication-level `validation_report` / `validation_result` shell.
- `ring/lib/governance-statement.mjs` still exposes the descriptor core (`name`, `mediaType`, `digest`, `size`, `locator`), and it still uses `canonicalization.profile`, so the repo already has a descriptor substrate plus an existing local meaning for bare `profile`.
- `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/branch-event.schema.json` still keep governance statements inline through `checkpoint.data.publication_statements` and `branch-event.data.statement`.
- Targeted live search this pass still finds no first-class `publication_root`, `member_descriptor`, `validation_report`, or `validation_result` vocabulary under `ring/lib/` or `.ring/schemas/`.
- The sharper live Phase 1 gap is therefore now: dp-ring needs a docs-level naming cut that keeps root conformance markers on the publication root, keeps member semantic class separate from descriptor `mediaType`, and projects JSON Schema output units into a durable `validation_report` / `validation_result` family.

### Sources reviewed
1. RO-Crate 1.1, **Root Data Entity**
   - Official source URL: https://www.researchobject.org/ro-crate/specification/1.1/root-data-entity.html
   - Access note: the official page was directly reachable in terminal; a `r.jina.ai` mirror was also sampled only as a readability check.
   - Key evidence:
     - the metadata descriptor “MUST have an `about` property referencing the Root Data Entity”
     - the descriptor example carries `conformsTo` and `about`, with `about` pointing at `./`
     - consumers can find the root by following `conformsTo` and then `about`

2. OCI Image Spec, **Image Manifest** and **Content Descriptor**
   - Official source URLs:
     - https://raw.githubusercontent.com/opencontainers/image-spec/main/manifest.md
     - https://raw.githubusercontent.com/opencontainers/image-spec/main/descriptor.md
   - Access note: the official raw GitHub sources were directly reachable in terminal; a `r.jina.ai` mirror was used only to double-check extraction on the manifest page.
   - Key evidence:
     - the manifest spec defines `artifactType` separately from descriptor `mediaType`
     - the descriptor spec defines the descriptor core as `mediaType`, `digest`, and `size`, with optional `annotations`
     - the descriptor spec notes that `artifactType` is separate and, when referencing a manifest, is derived from config-descriptor semantics rather than replacing descriptor `mediaType`

3. JSON Schema Draft 2020-12 Core, **Section 12: Output Formatting**
   - Official source URL: https://json-schema.org/draft/2020-12/json-schema-core.html#section-12
   - Access note: direct terminal fetch to the official page hit a TLS EOF; the official page was then loaded successfully in browser automation and the rendered section text was extracted from the DOM.
   - Key evidence:
     - “A single object that contains all of these components is considered an output unit.”
     - each sub-result should minimally preserve `keywordLocation`, optional `absoluteKeywordLocation`, `instanceLocation`, and either a local `error` or `annotation`
     - hierarchical outputs carry nested `errors` / `annotations`, while the overall output must contain boolean `valid`

### Findings

#### Finding 1: `publication_root` should own root conformance and subjecthood via `conforms_to` + `about`, not push those semantics down into each member
RO-Crate is useful here because it gives a compact, official pattern for bundle root identity: the root-discoverable object is found through explicit `conformsTo` and `about` semantics, not by overloading every member descriptor with package-level meaning.

Implication for dp-ring:
- A Phase 1 `publication_root` should own the package/root conformance marker and root subject reference, likely via fields shaped like `conforms_to` and `about` (or an equally explicit equivalent).
- `member_descriptor` entries should be catalog members of that root, not parallel roots carrying their own package-discovery semantics.
- This gives dp-ring a cleaner answer to the current naming question than reusing a vague bare `profile` field at both root and member level.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the publication root a governed semantic subject rather than a thin wrapper around inline statements.
- **Refines Phase 1** by clarifying that root conformance/discovery semantics belong to the root artifact, not the member descriptor grammar.
- **Rejects** designs that scatter root-profile meaning across members or collapse root identity into implicit checkpoint/branch-event structure.

Repo-specific consequence:
- Because the live repo still has only inline `publication_statements`, the next docs artifact should define root-level `conforms_to` / `about` ownership before runtime code grows a second, implicit package model.

#### Finding 2: `member_descriptor` should keep the descriptor core intact and use a separate member semantic-class field, most plausibly `artifact_type`
The OCI specs sharpen the naming problem better than the repo currently does: descriptor identity is one concern (`mediaType`, `digest`, `size`, optional annotations), while artifact classification is a separate concern (`artifactType`). This is stronger guidance than using a loosely named bare `profile` field for everything.

Implication for dp-ring:
- Keep the landed descriptor identity core exactly where it already is: `name`, `mediaType`, `digest`, `size`, optional `locator`.
- Add one separate semantic-class field on `member_descriptor`, with `artifact_type` now looking like the sharper Phase 1 name than `profile`.
- Reserve root-level `conforms_to` for publication-root conformance/discovery semantics, and leave `canonicalization.profile` alone for statement canonicalization semantics.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by turning the member naming problem into a concrete descriptor-vs-class split grounded in a widely used descriptor model.
- **Refines Phase 1** by narrowing the current open choice: prefer a distinct semantic-class slot over overloading `mediaType` or reusing a bare `profile` label.
- **Rejects** any design where `mediaType` silently carries both representation encoding and the governed semantic role of the member.

Repo-specific consequence:
- `ring/lib/governance-statement.mjs` already emits the descriptor core, so the next docs cut should layer a separate `artifact_type` (or an explicitly equivalent name) on top of that substrate rather than inventing a second descriptor grammar.

#### Finding 3: `validation_result` should be defined as a governed projection of JSON Schema output units, while `validation_report` stays the run-level summary/root
JSON Schema Section 12 is the cleanest primary-source fit for the repo's current validator gap: it explicitly distinguishes overall `valid` from per-unit sub-results, and it defines the minimum leaf fields needed for each result unit. That gives dp-ring a more exact kernel shape than a raw `{ valid, errors }` wrapper.

Implication for dp-ring:
- A Phase 1 `validation_report` should own bundle/run summary facts such as overall `valid`, provenance/invocation metadata, counts, and result-member linkage.
- A Phase 1 `validation_result` should own the projected output-unit facts:
  - `subject_location` <- JSON Schema `instanceLocation`
  - `rule_location` <- JSON Schema `keywordLocation`
  - optional `absolute_rule_location` <- JSON Schema `absoluteKeywordLocation`
  - local `error` or `annotation`
  - optional nested detail/result refs when hierarchical output is preserved
- This is a better fit for the current repo than storing Ajv arrays wholesale or flattening all failures into prose.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by giving the publication-root shell an exact validation-member projection target.
- **Refines Phase 1** by tying report/result ownership to official output-unit semantics rather than to ad hoc runtime helper shapes.
- **Rejects** designs that keep validation as one generic blob or that force report-level and leaf-level facts back into the same artifact.

Repo-specific consequence:
- Because `ring/lib/validator.mjs` still returns only `{ valid, errors }`, the next docs artifact should define the output-unit projection now, before a runtime wrapper bakes in a lossy contract.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by turning the open naming problem into a more exact kernel/docs cut: **root `conforms_to` + `about` ownership on `publication_root`, descriptor-core plus separate `artifact_type` on `member_descriptor`, and JSON-Schema-output-unit projection for `validation_report` / `validation_result`.**

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the current publication/validation shell is now closer to an implementable field-table family rather than a loose naming discussion.
- **Phase 2 / Heterogeneous node ecology** remains aligned because different rich node implementations will later be able to publish different member artifact classes through the same descriptor grammar without leaking local internals into the global tree.
- **Phase 3 / Projection** remains downstream: operator UIs, query tooling, and control-plane services should project these root/member/report/result semantics rather than inventing them.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed runtime metrics and governance-statement shell
- define a `publication_root` whose own fields carry root identity, `conforms_to`, and `about`
- define a `member_descriptor` that keeps descriptor identity (`name`, `mediaType`, `digest`, `size`, optional `locator`) separate from member semantic class (`artifact_type` or an explicitly equivalent name)
- define `validation_report` and `validation_result` so report roots own run-level conformance/provenance/result linkage while result leaves own JSON-Schema-output-unit facts
- keep overlay-state, guard-evaluation, and acceptance-semantics work downstream of this naming/ownership cut

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for:
  - `publication_root` root fields (`id`, `conforms_to`, `about`, required member catalog)
  - `member_descriptor` descriptor-core vs `artifact_type`
  - `validation_report` / `validation_result` output-unit projection
- do **not** reopen metrics work, richer node internals, UI/operator surfaces, or Rust/control-plane work before this field-table cut exists
- do **not** overload `mediaType` or bare `profile` to carry member semantic class when the repo already uses `canonicalization.profile` and the sources support a cleaner split

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and worked examples:

1. **`publication_root` root-field table**
   - choose the exact Phase 1 field names and invariants for root identity, `conforms_to`, `about`, publication status, and a required-but-possibly-empty member catalog

2. **`member_descriptor` descriptor-core vs `artifact_type` table**
   - define the exact field set and naming rule that keeps descriptor identity, semantic class, and conveyance mode separate without colliding with `canonicalization.profile`

3. **`validation_report` / `validation_result` JSON-Schema-output projection examples**
   - add exact examples showing how `valid`, `instanceLocation`, `keywordLocation`, optional `absoluteKeywordLocation`, and local `error`/`annotation` map into governed report/result members

## 2026-04-21 00:03 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; the active gap is not missing branch metrics.
- `.ring/schemas/publication-root.schema.json`, `.ring/schemas/validation-report.schema.json`, `.ring/schemas/validation-result.schema.json`, `ring/lib/publication-root.mjs`, and `ring/lib/validation-artifacts.mjs` now provide a first-class publication-root + validation artifact shell; `tests/ring/publication-root.test.mjs`, `tests/ring/validation-artifact-helpers.test.mjs`, `tests/ring/store-publication-artifacts.test.mjs`, and `tests/ring/validator.test.mjs` show it validates and persists.
- `.ring/schemas/checkpoint.schema.json` and `.ring/schemas/branch-event.schema.json` now expose optional `publication_root_id` linkage on checkpoints and branch events, so the repo no longer lacks the basic bundle/root family that several late memo entries still assumed was missing.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, and `ring/lib/node-contract.mjs` still mainly compresses failures through `instancePath`-style formatting, but the live repo no longer lacks the core publication-root / validation-report / validation-result shell itself.
- Targeted live search this pass still finds no first-class governance vocabulary for `support`, `attack`, `contrary`, `assumption`, `acceptance_profile`, `acceptance_status`, `guard_evaluation`, or `evaluation_result` under `.ring/schemas/`; the sharper live gap has moved past root/report existence toward the epistemic acceptance layer that should sit on top of it.
- The sharper live Phase 1 gap is therefore now: dp-ring needs an explicit **acceptance-semantics shell attached to `publication_root`**, with typed support/attack relations, assumption/contrary handling, and a profile-dependent acceptance-status lattice that stays distinct from checkpoint lifecycle `adoption_status`.

### Sources reviewed
1. Andrea Cohen, Sebastian Gottifredi, Alejandro J. García, Guillermo R. Simari, **“A survey of different approaches to support in argumentation systems”**
   - Official source URL: https://www.cambridge.org/core/journals/knowledge-engineering-review/article/abs/survey-of-different-approaches-to-support-in-argumentation-systems/FB2BCF2F29B88594F1B8570075D17D38
   - DOI: https://doi.org/10.1017/S0269888913000325
   - Access note: the official Cambridge abstract page was directly readable in browser automation.
   - Key evidence: the abstract says most work focused on a defeat relation, that “the study of a support relation between arguments regained attention,” and that the survey distinguishes “deductive support, necessary support, evidential support, subargument, and backing, among others.”

2. Melisa G. Escañuela Gonzalez, Maximiliano C. D. Budán, Gerardo I. Simari, Guillermo R. Simari, **“Labeled Bipolar Argumentation Frameworks”**
   - Official source URL: https://jair.org/index.php/jair/article/view/12394
   - DOI: https://doi.org/10.1613/jair.1.12394
   - Access note: the official JAIR article page was directly readable in browser automation.
   - Key evidence: the abstract says the framework treats “two independent forms of argument interaction—support and conflict,” includes “the user’s posture,” enriches “argument acceptability,” and introduces a labeling process.

3. Jesse Heyninck, Ofer Arieli, **“On the Semantics of Simple Contrapositive Assumption-Based Argumentation Frameworks”**
   - Official source URL: https://ebooks.iospress.nl/publication/50174
   - DOI: https://doi.org/10.3233/978-1-61499-906-5-9
   - Access note: the official IOS Press page was directly readable in browser automation.
   - Key evidence: the abstract explicitly discusses “defeasible assumptions,” the “contrariness operator,” “attacks relations,” and the behavior of “grounded,” “preferred,” and “stable” semantics.

### Findings

#### Finding 1: support is not one relation, so dp-ring should not settle for one vague `supports` edge
The Cambridge survey is useful because it does not merely say “support exists.” It says support has several interpretations — “deductive support, necessary support, evidential support, subargument, and backing, among others.” That is exactly the kind of warning the current repo needs now that it already has `publication_root`, `member_descriptors`, and validation artifacts.

Implication for dp-ring:
- The acceptance layer should not add one untyped `support` field and call the problem solved.
- Phase 1 should instead define a small typed or profiled support vocabulary attached to governed publication members.
- This keeps support semantics explicit without reopening free-graph modeling or leaking node-local reasoning internals into the kernel.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the next missing semantic layer above the now-landed publication shell.
- **Refines Phase 1** by turning “support semantics” into a typed relation-vocabulary problem rather than a generic edge problem.
- **Rejects** any plan that collapses all supportive relations into one semantically vague predicate.

Repo-specific consequence:
- Because the repo already has a governed root/member catalog, the next docs artifact should define how support relations attach to publication members rather than re-proposing publication-root existence or more scalar metrics.

#### Finding 2: support and attack/conflict should be modeled as independent relations, with explicit posture/profile and labels
The JAIR abstract sharpens two separate design choices at once. First, it treats “support and conflict” as independent forms of argument interaction. Second, it says richer information can represent “the user’s posture” and enhance “argument acceptability,” and that the framework uses a labeling process.

Implication for dp-ring:
- The acceptance layer should keep support and attack/conflict as separate relation families, not as one overloaded polarity score.
- dp-ring should add an explicit `acceptance_profile` or equivalent posture/stance field, instead of pretending one fixed acceptance semantics fits every governance situation.
- dp-ring should define an explicit acceptance-status family (for example `supported` / `defended` / `accepted` / `contested` / `rejected`, or an equally precise equivalent) attached to publication-root evaluation, not bury acceptability inside process-local policy flags.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the next publication-root layer more operationally explicit.
- **Refines Phase 1** by reframing the active gap as relation + profile + status semantics, not more shell scaffolding.
- **Rejects** designs that try to reuse lifecycle fields like checkpoint `adoption_status` as if they were already epistemic acceptance labels.

Repo-specific consequence:
- The repo already has `publication_root`, `validation_report`, and `validation_result`; what it still lacks is the acceptance-status layer that says whether a publication bundle is merely conformant, positively supported, actively contested, or ready for governance adoption.

#### Finding 3: assumption/contrary handling must be explicit, and semantics choice should be a profile rather than an implicit default
The IOS Press source is useful because it makes the hidden dependency visible: once you move into assumption-based argumentation, acceptance depends on explicit defeasible assumptions, on how contraries and attacks are defined, and on which semantics family you pick (`grounded`, `preferred`, `stable`). In other words, semantics choice materially changes outcomes.

Implication for dp-ring:
- Phase 1 needs an assumption ledger / claim-dependency shell for branch claims and evidence.
- It also needs contrary-handling vocabulary that can say which assumption, claim, or evidence item is being opposed and by what.
- The choice of acceptance semantics should become an explicit publication-level profile, not an invisible hard-coded default inside lifecycle transitions.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding the next kernel step in explicit defeasible-governance semantics.
- **Refines Phase 1** by showing that acceptance semantics must sit between the current validation shell and any future decision-table / guard-evaluation layer.
- **Rejects** the tempting shortcut of moving straight from validation outcomes to governance moves without modeling assumptions, contraries, and semantics choice first.

Repo-specific consequence:
- The repo currently has checkpoint `adoption_status`, but no first-class `assumption`, `contrary`, `acceptance_profile`, or `acceptance_status` vocabulary. The next docs cut should define those before decision tables or guard-evaluation members are allowed to harden.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 by correcting the live gap: because `publication_root`, `validation_report`, and `validation_result` are now already landed, the next kernel slice is no longer more bundle-shell work but an **acceptance-semantics layer attached to the publication-root bundle**.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the landed publication shell now has a clearer next layer: typed support/attack/assumption relations plus profile-dependent acceptance statuses.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later emit evidence, claims, and relation members through the same publication-root shell without forcing the global system back into free-graph chaos.
- **Phase 3 / Projection** remains downstream: operator views, read models, and control-plane surfaces should project these acceptance semantics rather than invent them.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed runtime metrics and publication-root / validation-report / validation-result shell
- add typed relation vocabulary for support, attack/conflict, and contrary handling under `publication_root`
- define an assumption ledger / claim-dependency shell for branch claims and evidence
- define `acceptance_profile` (or an exactly equivalent stance field) separately from lifecycle/governance state
- define an acceptance-status family separately from checkpoint `adoption_status`
- map acceptance outcomes into governance moves such as `adopt`, `discard`, `synthesize`, `continue`, `replay`, and `escalate` only after the relation/profile/status layer exists

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for support/attack relation members, assumption/contrary handling, and acceptance profile/status semantics before guard-evaluation or decision-table expansion
- do **not** reopen publication-root / validation-report / validation-result existence work as if those artifact families were still missing
- do **not** collapse epistemic acceptance into checkpoint `adoption_status`, generic notes, or policy booleans
- do **not** add one vague `support` edge and call the acceptance layer done
- do **not** jump to guard-evaluation, duty/advice, UI/operator surfaces, or Rust/control-plane work before the acceptance shell is explicit

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and worked examples:

1. **support / attack relation field table attached to `publication_root`**
   - choose the minimal governed relation vocabulary, including whether support needs typed profiles (for example evidential vs necessary) and how attack/conflict is linked to governed member refs

2. **assumption ledger + contrary-handling examples**
   - define how a branch claim, its defeasible assumptions, and its contrary relations are published and linked to evidence/validation members under one publication root

3. **`acceptance_profile` + `acceptance_status` to governance-move mapping**
   - define the stance/profile vocabulary, the acceptance-status lattice, and the projection from acceptance outcomes into `adopt` / `discard` / `synthesize` / `continue` / `replay` / `escalate`

## 2026-04-21 01:21 +08:00

### Current mainline context
Canonical spine remains:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

Current active implementation phase remains:
- Phase 1: governance kernel

Current repo alignment observed this pass:
- `ring/lib/governance-policy.mjs` and `tests/ring/governance-policy.test.mjs` still confirm that first-class runtime metrics are already landed; this pass does **not** reopen metric work.
- `.ring/schemas/publication-root.schema.json`, `.ring/schemas/validation-report.schema.json`, `.ring/schemas/validation-result.schema.json`, `ring/lib/publication-root.mjs`, and `ring/lib/validation-artifacts.mjs` still confirm that the publication-root / validation shell is already landed and linked from checkpoints / branch events via optional `publication_root_id` and `validation_report_id`.
- `ring/lib/validator.mjs` still returns only `{ valid, errors }`, but the sharper live gap is no longer the existence of root/report/result artifact families.
- Targeted live search this pass still finds no first-class governance vocabulary under `.ring/schemas/` for `support`, `attack`, `contrary`, `assumption`, `acceptance_profile`, `acceptance_status`, `guard_evaluation`, or `evaluation_result`.
- The narrower live Phase 1 question is now: **what baseline acceptance profiles, proof-bearing acceptance members, and reinstatement-policy semantics should sit on top of the landed publication-root bundle before guard-evaluation or decision-table work hardens?**

### Sources reviewed
1. Gerard A. W. Vreeswijk, Henry Prakken, **“Credulous and Sceptical Argument Games for Preferred Semantics”**
   - Official source URL: https://link.springer.com/chapter/10.1007/3-540-40006-0_17
   - DOI: https://doi.org/10.1007/3-540-40006-0_17
   - Access note: the official Springer page was directly readable in browser automation.
   - Key evidence: the abstract says the paper gives argument games for testing membership of “some (credulous reasoning) or all preferred extensions (sceptical reasoning),” and that these games are motivated by “automated negotiation, mediation of collective discussion and decision making, and intelligent tutoring.”

2. Sylvie Doutre, Jérôme Mengin, **“On Sceptical Versus Credulous Acceptance for Abstract Argument Systems”**
   - Official source URL: https://link.springer.com/chapter/10.1007/978-3-540-30227-8_39
   - DOI: https://doi.org/10.1007/978-3-540-30227-8_39
   - Access note: the official Springer page was directly readable in browser automation.
   - Key evidence: the abstract says the useful AI answer is “not a simple yes/no answer, but some kind of well-argued answer, called a proof,” and studies when an argument is in “all extensions of an argumentation system.”

3. Martin Caminada, **“On the Issue of Reinstatement in Argumentation”**
   - Official source URL: https://link.springer.com/chapter/10.1007/11853886_11
   - DOI: https://doi.org/10.1007/11853886_11
   - Access note: the official Springer page was directly readable in browser automation.
   - Key evidence: the abstract says argumentation semantics are “particular forms of dealing with the issue of reinstatement,” asks which “(minimal) requirements have to be fulfilled by any principle for handling reinstatement,” and re-examines “which semantics is most appropriate.”

### Findings

#### Finding 1: `acceptance_profile` should not stay vague; the kernel now needs an explicit skeptical/credulous baseline
The Vreeswijk–Prakken abstract is especially useful because it ties profile choice to a precise distinction: membership in **some** preferred extension versus membership in **all** preferred extensions. That is stronger guidance than a generic “stance” placeholder.

Implication for dp-ring:
- The next docs cut should make `acceptance_profile` explicit, with at least a baseline conservative-vs-exploratory distinction equivalent to skeptical/credulous reasoning.
- `adopt` / `mainline`-class governance moves should not be allowed to silently assume the same acceptance posture as `continue` / exploratory branch work.
- This baseline can later be refined, but Phase 1 now has enough evidence to stop treating profile choice as a vague future note.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by sharpening the acceptance-profile question into a concrete kernel field-family choice.
- **Refines Phase 1** by suggesting that governance moves should be profile-sensitive rather than globally hard-coded.
- **Rejects** the tempting shortcut of having one hidden acceptance posture for every branch/governance decision.

Repo-specific consequence:
- Because the repo already has `publication_root`, `validation_report`, and `validation_result`, the next missing docs artifact is not another bundle shell; it is a small, explicit `acceptance_profile` vocabulary attached to publication-root evaluation.

#### Finding 2: acceptance should be proof-bearing, not just a lifecycle label or boolean summary
The Doutre–Mengin abstract sharpens the output shape: for AI systems, the useful answer is “not a simple yes/no answer, but some kind of well-argued answer, called a proof.” That matters because dp-ring already has validation-report/result artifacts, but those do not yet explain why a publication bundle is accepted under a given profile.

Implication for dp-ring:
- The acceptance layer should publish proof-bearing acceptance artifacts or members under `publication_root`, not only a final status string.
- `acceptance_status` should be linked to supporting relation members / assumptions / contrary handling, rather than being treated as a free-floating label or as a synonym for checkpoint `adoption_status`.
- `validation_report` should remain conformance-oriented; it should not be overloaded to serve as the whole acceptance proof object.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by making the acceptance shell more artifact-centered and auditable.
- **Refines Phase 1** by indicating that acceptance outcomes need justification structure before they can safely drive `adopt`, `synthesize`, or `escalate`.
- **Rejects** designs that jump straight from validation booleans to governance moves without a proof-carrying acceptance layer.

Repo-specific consequence:
- Since `.ring/schemas/` still lacks first-class acceptance vocabulary, the next docs cut should specify an `acceptance_evaluation`-style member profile (or an exactly equivalent name) under `publication_root` before decision tables or guard-evaluation members are introduced.

#### Finding 3: reinstatement policy is not a runtime detail; it is part of the semantics profile that must be made explicit
Caminada’s abstract is useful because it makes the design risk explicit: semantics differ because they encode different ways of handling reinstatement, and those differences should be understood in terms of postulates and minimal requirements. For dp-ring, that means reinstatement cannot stay an invisible implementation quirk.

Implication for dp-ring:
- The acceptance layer should record a `reinstatement_policy` / postulate profile (or fold it explicitly into `acceptance_profile`) so that later governance decisions know which defeated-then-defended claims can be restored.
- `replay` / `escalate` should remain available when reinstatement-sensitive conflicts are unresolved under the active profile.
- Guard-evaluation and decision-table work should come **after** this semantics choice is documented, not before.

Comparison against the canonical mainline:
- **Strengthens Phase 1** by grounding the active acceptance work in explicit semantic postulates instead of ad hoc status names.
- **Refines Phase 1** by showing that reinstatement handling belongs between the new relation/assumption layer and any future decision-table layer.
- **Rejects** the tempting shortcut of hard-coding one implicit semantics and only documenting it after governance moves have already been baked in.

Repo-specific consequence:
- The repo currently lacks `acceptance_profile`, `acceptance_status`, and related semantics vocabulary. The next docs cut should therefore define reinstatement-sensitive profile semantics before adding `guard_evaluation` or `evaluation_result` shells.

### Implications for the mainline

#### Mainline status
The canonical 3-phase spine still looks right:
1. Governance kernel
2. Heterogeneous node ecology / rich-node proof
3. Projection / productization

This pass does **not** change the spine. It refines the still-active Phase 1 again: after the publication-root bundle landed and the acceptance layer was identified, the sharper next cut is now **proof-bearing acceptance profiles with explicit skeptical/credulous posture and reinstatement-policy semantics**, not generic new artifact families.

#### Mainline strengthened
- **Phase 1 / Governance kernel** is strengthened because the next acceptance-semantics work now has a more exact minimum shape: explicit profile choice, proof-bearing acceptance members, and reinstatement-policy semantics.
- **Phase 2 / Heterogeneous node ecology** remains aligned because rich nodes can later publish claims/evidence/support members into the same acceptance shell without changing the tree-first kernel.
- **Phase 3 / Projection** remains downstream: read models and operator surfaces should project these acceptance semantics, not invent them first.

#### Mainline refined
Phase 1 should now be read more precisely as:
- preserve the landed runtime metrics and publication-root / validation shell
- add support / attack / assumption / contrary members under `publication_root`
- define `acceptance_profile` with an explicit skeptical/credulous-style baseline
- define a proof-bearing acceptance artifact/member shape distinct from checkpoint lifecycle state
- make reinstatement policy/postulates explicit before guard-evaluation or decision-table artifacts harden
- map profile-sensitive acceptance outcomes into `adopt` / `discard` / `synthesize` / `continue` / `replay` / `escalate` only after those fields exist

#### Immediate planning bias after this pass
For future dp-ring planning and implementation selection:
- stay on **Phase 1**
- prioritize docs-level field tables for `acceptance_profile`, proof-bearing acceptance members, and reinstatement-policy semantics after the support/attack/assumption layer
- do **not** reopen publication-root shell work as if the root/report/result families were still missing
- do **not** treat checkpoint `adoption_status` or validation `conforms` as a substitute for epistemic acceptance
- do **not** jump to guard-evaluation, decision tables, UI/operator surfaces, or Rust/control-plane work before acceptance profile + proof + reinstatement semantics are explicit

### Recommended next research slice
The next pass should reduce development risk by turning this refinement into exact docs tables and worked examples:

1. **`acceptance_profile` baseline field table**
   - define the minimum skeptical/credulous-style profile vocabulary, including which governance moves each profile may authorize without escalation

2. **proof-bearing `acceptance_evaluation` member sketch under `publication_root`**
   - define how acceptance status links to support/attack members, contrary handling, assumptions, and justification/proof refs without overloading `validation_report`

3. **reinstatement-policy / postulate note feeding governance moves**
   - define how reinstatement-sensitive conflicts map to `continue`, `replay`, `escalate`, `synthesize`, and `adopt` under the active acceptance profile


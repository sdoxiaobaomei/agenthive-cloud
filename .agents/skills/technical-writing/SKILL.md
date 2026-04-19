---
name: technical-writing
description: Use when writing, reviewing, or restructuring technical documentation such as README, architecture guides, design docs, API references, or governance documents. Triggers on requests to "write docs", "create README", "document architecture", "review documentation", or "explain how this works".
---

# Technical Writing for Engineers

## Core Principle

**Documentation is architecture — not decoration.**

Good technical documents shape decisions. Bad documents record history. Write documents that a new engineer can use to make correct choices without asking anyone.

## When to Use

**Use this skill when:**
- Creating README, ARCHITECTURE, or DESIGN documents
- Documenting infrastructure, deployment, or operational procedures
- Writing API references or integration guides
- Restructuring existing docs that have become unmaintainable
- Explaining complex systems to stakeholders or new team members

**Do NOT use when:**
- Writing inline code comments (use code style skill instead)
- Creating marketing or product copy (different audience, different tone)
- Writing AI-facing protocols like SKILL.md (use writing-skills instead)

## Audience-First Writing

Before writing a single heading, answer three questions:

1. **Who reads this?** New engineer? Platform team? Executive? Customer?
2. **What decision do they need to make?** Deploy? Modify? Debug? Approve budget?
3. **What do they already know?** Do not explain Git to senior engineers. Do not assume Kubernetes knowledge in onboarding guides.

**Rule of thumb:** Every section should help a specific reader make a specific decision. If a section does not, delete it.

## The Pyramid Structure

Organize every document as an inverted pyramid:

**Top (must read):** One-paragraph summary answering "what is this and why does it matter?"
**Middle (should read):** Architecture overview, key decisions, and how components interact
**Bottom (can reference):** Detailed configuration, troubleshooting, edge cases, and deep dives

**Why this works:** Busy readers stop after the summary. That is fine — they got what they needed. Deeper readers continue. No one is forced to wade through details to find the big picture.

## Documentation Types and Their Rules

### README
- **Job:** Get someone productive in 15 minutes
- **Structure:** What → Quickstart → Architecture pointer → Contributing
- **Anti-pattern:** Dumping entire architecture into README. Link to ARCHITECTURE.md instead.

### Architecture Document
- **Job:** Explain "why we built it this way" and "what changes are safe"
- **Structure:** Context → Constraints → Decisions → Trade-offs → Future evolution
- **Anti-pattern:** Listing technologies without explaining choices. "We use Kafka" is not architecture. "We chose Kafka over RabbitMQ because..." is.

### Operational / Runbook Document
- **Job:** Enable on-call engineer to fix problems at 3 AM without thinking
- **Structure:** Symptom → Diagnostic steps (copy-paste commands) → Fix → Rollback → Escalation path
- **Anti-pattern:** Describing theory. On-call needs commands, not computer science lectures.

### Governance Document
- **Job:** Establish rules that scale across teams without requiring personal relationships
- **Structure:** Principle → Rule → Rationale → Exception process → Enforcement mechanism
- **Anti-pattern:** Rules without rationale. Teams follow rules they understand. They workaround rules they do not.

## No Code in Architecture Documents

**Documents that explain *how the system works* should not contain executable code.**

Code belongs in repositories. Documents that contain code suffer three problems:
- They rot. Code changes; documents do not. Stale code examples destroy trust.
- They mislead. Readers copy-paste outdated examples into production.
- They confuse. Documents should explain intent. Code explains implementation. Mixing them forces readers to constantly context-switch.

**What to use instead of code:**
- Architecture diagrams (described in text for accessibility)
- Decision matrices comparing alternatives
- Data flow descriptions
- Interface contracts (inputs, outputs, guarantees — not implementation)
- References to specific files in the repository

## Progressive Disclosure in Documents

Apply the same progressive disclosure principle from skill-writing to human-facing documents:

**Layer 1 — Scan (10 seconds):** Headings, tables, diagrams, bold terms. Reader decides if this document is relevant.
**Layer 2 — Skim (2 minutes):** Summary sections, bullet points, key decisions. Reader grasps the big picture.
**Layer 3 — Read (15 minutes):** Full prose, detailed explanations, trade-off analysis. Reader understands the reasoning.
**Layer 4 — Reference (as needed):** Deep links, troubleshooting tables, configuration references. Reader finds specific facts.

**Design each layer independently.** A reader at Layer 2 should not be distracted by Layer 4 details.

## Writing Mechanics

### Consistent Terminology
Choose one term and use it everywhere. Do not mix "service", "microservice", and "component" to mean the same thing. Do not mix "deploy", "release", and "ship". Inconsistent terminology makes readers doubt their understanding.

### Active Voice, Present Tense
- ✅ "The orchestrator routes requests to workers."
- ❌ "Requests will be routed by the orchestrator to the workers."

Active voice is shorter, clearer, and harder to misinterpret.

### Concrete Over Abstract
- ❌ "The system handles various failure modes gracefully."
- ✅ "If the database connection times out, the API returns 503 and retries with exponential backoff up to 30 seconds."

Specific examples answer questions abstract statements create.

### Numbers Over Adjectives
- ❌ "High throughput", "low latency", "large scale"
- ✅ "10,000 RPS", "p99 < 50ms", "500+ nodes across 3 regions"

Quantified claims can be validated. Adjectives cannot.

## Cross-References and Discoverability

**Every document should point to its upstream and downstream documents.**

A Kubernetes deployment guide should link to:
- Upstream: Architecture decision that chose Kubernetes
- Downstream: Troubleshooting guide, monitoring setup, security hardening guide
- Peer: Related deployment guides for other environments

This creates a documentation graph, not a documentation pile. Readers navigate naturally from one document to the next without searching.

## Review Checklist

Before marking any document as complete:

- [ ] Summary paragraph answers "what is this and why does it matter?" in under 100 words
- [ ] Target audience is explicitly stated or obvious from content
- [ ] No executable code (references to files are OK)
- [ ] Every section helps a specific reader make a specific decision
- [ ] Terminology is consistent throughout
- [ ] Specific examples replace abstract descriptions
- [ ] Quantified claims replace adjectives
- [ ] Cross-references to related documents are present
- [ ] Outdated information is removed (not just updated)

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| **The Autobiography** | "First we tried X, then Y failed, then we found Z..." | History belongs in ADRs, not operational docs. State current design, link to ADR for history. |
| **The Dump** | Pasting meeting notes, Slack threads, or brain dumps into a document | Raw material requires curation. Extract decisions and actions, discard context. |
| **The Novel** | 50-page document no one finishes | Split into linked documents. No single document should exceed 15 minutes of reading time. |
| **The Speculative** | Describing planned features as if they exist | Label clearly: "Implemented", "In Progress", "Planned (Q3)", or "Deprecated". |
| **The Orphan** | Document with no links to or from other documents | Every document needs at least one parent and one child link. |

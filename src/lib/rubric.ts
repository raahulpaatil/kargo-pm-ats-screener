export type Role = 'PM' | 'SPM'

const METRIC_4_BAR: Record<Role, string> = {
  PM: `For PM applicants: look for discovery work with real users, shipped features
with adoption evidence, and — critically — features KILLED based on data, not just
shipped. Comfort working without a PM handbook, sprint template, or design system
already in place. A 4 requires: shipped, killed, AND a specific higher-stakes call
made in an unstructured environment (0-to-1 process creation) that others now rely on.`,
  SPM: `For Senior PM applicants: look for ownership of integration/architecture-level
decisions (what to build vs. configure vs. avoid), reliability/data-quality
accountability, and evidence of shaping how a product function works (frameworks,
standards, practices for others) — not just running one. A 4 requires: shipped,
killed, AND a specific integration/architecture trade-off with multi-year
consequences that others now rely on.`,
}

const METRIC_5_BAND: Record<Role, string> = {
  PM: 'PM target: 2-4 years of PM experience; ideally at a company building a product/function for the first time.',
  SPM: 'Senior PM target: 5-8 years of PM experience; ideally including platform products, integration layers, or complex technical environments, and some early-stage-company exposure.',
}

export function buildPrompt(resumeText: string, role: Role): string {
  return `You are scoring a resume against Kargo's PM/Senior PM shortlisting rubric.
The candidate applied for the ${role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} role.
Score each metric 1-4 using ONLY evidence stated in the resume text below — do not
infer beyond what is written. A candidate with zero evidence on a metric scores 1,
never a blank or a 0.

METRIC 1 — Ground-Level Domain Grounding (logistics/freight/ops reality):
1 = no logistics/ops/supply-chain exposure anywhere in career.
2 = sold or built software for logistics clients, but no hands-on operational role.
3 = held an operational role in an adjacent domain (general supply chain, e-commerce
fulfilment) but not freight/customs/port.
4 = held a hands-on operational role directly in freight forwarding, customs, port
operations, or carrier logistics.

METRIC 2 — Self-Initiated Ownership (built/fixed the unasked-for thing):
1 = no specific instance found; only generic self-description ("proactive," "self-starter").
2 = one instance of solving an assigned problem well, but it was requested/expected.
3 = one self-initiated fix/build, but adoption/impact unclear or limited to the
candidate's own work.
4 = one or more dated, specific instances of building/fixing something unprompted,
under real constraint, that was adopted by a team or became standard practice.

METRIC 3 — Decision Autonomy Track Record (no senior layer catching errors):
1 = always operated inside a structured team with a senior owner making final calls.
2 = contributed to decisions but shared final accountability with a manager or peer group.
3 = owned a defined area independently, with informal/occasional escalation to a manager.
4 = explicitly the final decision-maker in their area for an extended period, with
stated evidence of no escalation layer (sole owner, no account manager, no committee).

METRIC 4 — Role-Calibrated Product Craft:
${METRIC_4_BAR[role]}
1 = no evidence of discovery, shipping, or prioritization judgment; purely execution
of specs handed to them.
2 = shipped features with defined process support (existing templates, structured
discovery, PM team backing) — competent but not built for ambiguity.
3 = shipped AND killed at least one feature/initiative based on data or user
evidence, in a reasonably structured environment.
4 = shipped, killed, and can point to a specific higher-stakes call made in an
unstructured environment that others now rely on (see role-specific bar above).

METRIC 5 — Scale-Appropriate Experience & Complexity Handled:
${METRIC_5_BAND[role]}
1 = experience level clearly mismatched to the role applied for, or complexity of
systems/orgs managed is materially below what the role needs.
2 = close to the experience band but complexity handled is lower than the role demands.
3 = squarely within the experience band with complexity roughly matched to the role.
4 = within (or slightly beyond, without being a flight risk for over-levelling) the
experience band, with complexity handled that meets or exceeds what the role demands.

RESUME TEXT:
"""
${resumeText}
"""

Also extract the candidate's full name and email address from the resume text if
present. Return empty strings for candidateName/candidateEmail if not found —
never invent one.

For each metric, return an integer score 1-4 and a short rationale (1-2 sentences)
quoting or paraphrasing the specific resume evidence that justifies the score.`
}

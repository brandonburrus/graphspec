# Requirements
* [Concept Filtering](concept-filtering.requirement.md) - Concepts can be filtered by type, tag, and status for querying.
* [Live Visualization](live-visualization.requirement.md) - Serving the visualization reflects bundle edits without discarding the reader's place in the graph.
* [OKF Conformance](okf-conformance.requirement.md) - Every non-reserved markdown file must have parseable frontmatter with a non-empty type.
* [Profile Checks](profile-checks.requirement.md) - Filename tokens, required fields, and relations are checked against the profile.
* [Self-Contained Visualization](self-contained-visualization.requirement.md) - The generated visualization is a single HTML file that works with no network access.
* [Strict Mode](strict-mode.requirement.md) - The --strict flag promotes profile warnings to errors, except unresolved targets.

# Constraints
* [Permissive OKF](permissive-okf.constraint.md) - Broken links and unknown types must never hard-fail validation.
* [Zero Format Awareness](zero-format-awareness.constraint.md) - graphspec knows only OKF and the graphspec profile — no other spec format.

# Decisions
* [Adopt OKF](adopt-okf.decision.md) - Base graphspec bundles on the Open Knowledge Format v0.1.
* [Profile as Data](profile-as-data.decision.md) - Express the graphspec vocabulary as a typed data module, not scattered logic.

# Test Scenarios
* [Profile Violation Warns](profile-warning.test-scenario.md) - A filename token disagreeing with the frontmatter type is reported as a warning, not an error.
* [Query Filter By Type](query-filter.test-scenario.md) - Filtering by type returns only concepts of that type.
* [Strict Promotes Warnings](strict-promotion.test-scenario.md) - Under --strict, profile warnings become errors while unresolved targets stay warnings.
* [Validate Golden Bundle](validate-golden.test-scenario.md) - A clean bundle validates with zero errors and warnings.
* [Serve Reloads Without Losing Place](visualize-hot-reload.test-scenario.md) - Editing a concept while serving updates the graph and keeps the current selection.
* [Visualization Loads Offline](visualize-self-contained.test-scenario.md) - A generated visualization opened from the filesystem renders and makes no network requests.

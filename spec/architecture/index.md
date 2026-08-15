# Systems
* [graphspec CLI](graphspec-cli.system.md) - The command-line tool and library that validates, queries, and indexes bundles.

# Components
* [Graph Model](graph-model.component.md) - An in-memory directed graph of concepts with typed and hierarchy edges.
* [OKF Parser](parser.component.md) - Walks a directory, parses frontmatter and body, and computes concept IDs.
* [Profile Model](profile-model.component.md) - The graphspec vocabulary as data — node types and typed relations.
* [Validator](validator.component.md) - Runs OKF conformance and graphspec profile checks over the graph.
* [Visualizer](visualizer.component.md) - Folds a bundle, its diagnostics, and its coverage report into one self-contained HTML page.

# Integrations
* [OKF Bundle Source](okf-source.integration.md) - The filesystem directory tree a bundle is read from.

# Contracts
* [CLI Contract](cli-contract.contract.md) - The command-line interface surface: validate, query, index, graph, coverage, order, and visualize subcommands.

# Data Models
* [Concept Record](concept.data-model.md) - The parsed representation of one concept document.

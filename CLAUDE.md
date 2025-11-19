- In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision.
- Its important for each implementation to begin with writing and reviewing tests before moving on to implementation (TDD test-driven development).
  Write minimalist tests. Don't overdo it - about three general end-to-end tests per implementation is enough.
- Commit often, with small and focused commits.
- Update the version number and the changelog with every commit.
- For every commit, go over `CLAUDE.md`, `ARCHITECTURE_ANALYSIS.md`, and `LESSONS_LEARNED.md` to see if everything is up-to-date.
- For simple queries, use under five tool calls, but for more complex queries you can use up to 15 tool calls.

## Architecture

See `ARCHITECTURE_ANALYSIS.md` for complete architecture details (v2.17.210).

## Plans

- At the end of each plan, give me a list of unresolved questions to answer, if any.
  Make the questions extremely concise.
  Sacrifice grammar for the sake of concision.

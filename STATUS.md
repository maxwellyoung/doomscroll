# Status

Last updated: 2026-09-30
Version: 1.1.0 source candidate — unreleased

Doomscroll imports selected GitHub code into source-linked cards for self-assessed review. Imports resolve one commit and read immutable file blobs from its tree. Missing or mismatched source stops the import.

The queue prioritizes unseen and least recently reviewed cards. It does not schedule spaced review intervals or test understanding. Review progress and recent decks stay on the device; native GitHub tokens use the device credential vault.

Nineteen focused tests and TypeScript checks pass. Native verification remains pending for credential migration, locked-vault recovery, restart, source links, accessibility and local-data removal. Build and App Store verification remain pending for this version.

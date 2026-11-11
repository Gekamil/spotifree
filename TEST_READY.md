# E2E Test Suite Ready

## Test Runner
- Command: `node tests/e2e_spotifree_r1_r5.test.mjs` (or `npm.cmd test` for full regression)
- Expected: 61 tests executed across 14 suites and 4 tiers.
- Baseline Pass: 41 tests passing (structural contracts, query intent parsing, duplicate detection, multi-user isolation, offline preservation).
- Acceptance Criteria for Implementation Milestones: 20 pending assertion tests will turn green as Milestones M1, M2, M4, and M5 complete.
- Target for Milestone M5: 61/61 tests pass with exit code 0.

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 25 | 5 tests per requirement across R1, R2, R3, R4, R5 |
| 2. Boundary & Corner | 25 | 5 boundary/error/stress tests per requirement |
| 3. Cross-Feature | 6 | Pairwise interactions between features |
| 4. Real-World Application | 5 | End-to-end simulated user workflows |
| **Total** | **61** | Comprehensive Opaque-Box Acceptance Suite |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| R1: Official Remixes Prioritization | 5 | 5 | ✓ (T3-01, T3-04) | ✓ (S1, S4) |
| R2: Playlist Creation with Tracks | 5 | 5 | ✓ (T3-01, T3-03, T3-05) | ✓ (S2, S4) |
| R3: Prevent Auto-Save on Playlist View | 5 | 5 | ✓ (T3-02, T3-05) | ✓ (S2, S3) |
| R4: Albums Filter & Deezer Resolver | 5 | 5 | ✓ (T3-02, T3-03, T3-04) | ✓ (S2, S3, S4) |
| R5: Version 0.2.2 & Offline Preservation | 5 | 5 | ✓ (T3-06) | ✓ (S5) |

## Test Suite Location
- Specification: `TEST_INFRA.md`
- Implementation: `tests/e2e_spotifree_r1_r5.test.mjs`
- Preserved Offline Suite: `tests/offline_downloads.test.js` (7/7 passing)

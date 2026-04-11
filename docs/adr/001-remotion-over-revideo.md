# ADR-001: Remotion as Primary Rendering Engine

## Status
Accepted

## Context
CutSense needs a programmatic video rendering engine. Two options: Remotion (React-based, v4, actively maintained) and Revideo (Motion Canvas fork, v0.10, team pivoted to Midrender).

## Decision
Use Remotion as the master timeline engine. Revideo available as optional scene enhancement engine for premium animated moments (hybrid rendering).

## Rationale
- Remotion has active development, strong community, captions package, player preview
- Revideo's maintainers pivoted to a commercial product (Midrender) - OSS version lags
- Remotion's `calculateMetadata` + `inputProps` pattern is a perfect fit for JSON-driven timelines
- React component model is more accessible to the open-source community

## Consequences
- All final output assembled from Remotion compositions
- Enhanced scenes rendered by Revideo (or FFmpeg v1) and inserted as assets
- Enhancement failure is non-fatal - falls back to standard Remotion segment

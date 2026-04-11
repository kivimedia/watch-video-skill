# ADR-003: VUD as Central Intermediate Representation

## Status
Accepted

## Context
CutSense needs a way for LLMs to reason about video content before making edit decisions. Raw video can't be loaded into an LLM context.

## Decision
The Video Understanding Document (VUD) is the central data contract. It's a JSON timeline that fully describes a video's content in a form an LLM can reason over.

## Rationale
- Decouples video understanding from editing decisions
- Auditable: humans can inspect the VUD to see what the system understood
- Rerunnable: edit the VUD, re-run the edit layer, get different output without re-analyzing the video
- Provider-agnostic: any LLM can generate or consume a VUD
- Versionable: VUDs can be stored, compared, and replayed

## Consequences
- VUD schema must be stable and well-documented
- All downstream operations depend on VUD quality
- VUD validation gates prevent bad data from reaching the edit layer

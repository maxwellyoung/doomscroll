#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
from pathlib import Path
from typing import Any


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "audiobook"


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
      return json.load(handle)


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def sentence_list(items: list[str], max_items: int = 5) -> str:
    cleaned = [normalize_whitespace(item) for item in items if item and item.strip()]
    unique: list[str] = []
    for item in cleaned:
        if item not in unique:
            unique.append(item)
    if not unique:
        return "nothing especially notable"
    if len(unique) <= max_items:
        return ", ".join(unique)
    return f"{', '.join(unique[:max_items])}, and {len(unique) - max_items} more"


def code_lines(card: dict[str, Any]) -> list[str]:
    code = card.get("code", "")
    return [line.strip() for line in str(code).splitlines() if line.strip()]


def choose_cards(
    cards: list[dict[str, Any]],
    *,
    include_types: set[str],
    exclude_prefixes: tuple[str, ...] = (),
    limit: int = 6,
) -> list[dict[str, Any]]:
    chosen: list[dict[str, Any]] = []
    seen_files: set[str] = set()
    for card in cards:
        title = str(card.get("title", ""))
        if exclude_prefixes and title.startswith(exclude_prefixes):
            continue
        if str(card.get("type")) not in include_types:
            continue
        file_path = str(card.get("filePath", ""))
        if file_path in seen_files:
            continue
        chosen.append(card)
        seen_files.add(file_path)
        if len(chosen) >= limit:
            break
    return chosen


def chapter(title: str, paragraphs: list[str]) -> dict[str, str]:
    body = "\n\n".join(paragraph.strip() for paragraph in paragraphs if paragraph.strip())
    return {"title": title, "text": body}


def qa(question: str, answer: str) -> str:
    return f"Question. {question} Answer. {answer}"


def find_card(cards: list[dict[str, Any]], title: str) -> dict[str, Any] | None:
    for card in cards:
        if card.get("title") == title:
            return card
    return None


def relationship_summaries(deck: dict[str, Any]) -> dict[str, Any]:
    meta = deck.get("meta", {}) or {}
    relationships = meta.get("relationships", {}) or {}
    return relationships.get("summaries", {}) or {}


def find_trace(
    summaries: dict[str, Any], path: str, groups: tuple[str, ...] = ("keyTraces",)
) -> dict[str, Any] | None:
    for group in groups:
        for trace in summaries.get(group, []) or []:
            if str(trace.get("path", "")) == path:
                return trace
    return None


def trace_paths(
    trace: dict[str, Any] | None, field: str = "directDependencies"
) -> list[str]:
    if not trace:
        return []

    items = trace.get(field, []) or []
    paths: list[str] = []
    for item in items:
        if isinstance(item, dict):
            value = str(item.get("path", "")).strip()
        else:
            value = str(item).strip()
        if value:
            paths.append(value)
    return paths


def trace_sentence(
    trace: dict[str, Any] | None, field: str = "directDependencies", max_items: int = 6
) -> str:
    return sentence_list(trace_paths(trace, field), max_items)


def prioritized_hubs(summaries: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[tuple[int, int, int, dict[str, Any]]] = []
    for hub in list(summaries.get("dependencyHubs", []) or []):
        path = str(hub.get("path", "")).strip()
        category = str(hub.get("category", "")).strip()
        dependent_count = int(hub.get("dependentCount", 0) or 0)
        dependency_count = int(hub.get("dependencyCount", 0) or 0)
        if not path or dependent_count <= 0:
            continue

        priority = 0
        if category in {"layout", "route", "provider", "store"}:
            priority += 6
        elif category in {"lib", "context", "config"}:
            priority += 3

        lowered = path.lower()
        if any(
            token in lowered
            for token in ("auth", "query", "api", "store", "provider", "navigation")
        ):
            priority += 4
        if dependency_count > 0:
            priority += 1

        candidates.append((priority, dependent_count, dependency_count, hub))

    candidates.sort(key=lambda item: (-item[0], -item[1], -item[2], str(item[3].get("path", ""))))
    return [item[3] for item in candidates]


def build_relationship_qas(deck: dict[str, Any]) -> list[str]:
    summaries = relationship_summaries(deck)
    qas: list[str] = []

    root_trace = find_trace(
        summaries, "app/_layout.tsx", ("keyTraces", "routeTraces")
    )
    providers_trace = find_trace(
        summaries, "src/providers/AppProviders.tsx", ("keyTraces", "providerTraces")
    )
    hubs = prioritized_hubs(summaries)
    route_traces = list(summaries.get("routeTraces", []) or [])
    provider_traces = list(summaries.get("providerTraces", []) or [])

    if root_trace and trace_paths(root_trace):
        qas.append(
            "Bobby likely asks: what actually composes the app shell? "
            f"Answer: {root_trace['path']} directly imports {trace_sentence(root_trace)}. "
            "That means shell-level concerns live there before feature screens take over."
        )

    if providers_trace and trace_paths(providers_trace):
        qas.append(
            "Bobby likely asks: what global systems come online before feature code matters? "
            f"Answer: {providers_trace['path']} directly depends on {trace_sentence(providers_trace)}. "
            "That is the actual runtime chain behind providers, managers, shared state, and startup services."
        )

    for hub in hubs:
        hub_path = str(hub.get("path", ""))
        if not hub_path or hub_path in {"app/_layout.tsx", "src/providers/AppProviders.tsx"}:
            continue
        dependent_count = int(hub.get("dependentCount", 0) or 0)
        if dependent_count <= 0:
            continue
        qas.append(
            "Bobby likely asks: which files are load-bearing here? "
            f"Answer: {hub_path} has fan-in from {dependent_count} local files, including "
            f"{trace_sentence(hub, 'directDependents', 5)}. "
            "That is the kind of node where small changes can have wide blast radius."
        )
        if len(qas) >= 4:
            break

    for route_trace in route_traces:
        route_path = str(route_trace.get("path", ""))
        if not route_path or route_path == "app/_layout.tsx":
            continue
        if not trace_paths(route_trace):
            continue
        qas.append(
            "Bobby likely asks: if this route behaves oddly, where do you trace next? "
            f"Answer: start at {route_path}, then walk its direct dependencies: {trace_sentence(route_trace)}."
        )
        break

    for provider_trace in provider_traces:
        provider_path = str(provider_trace.get("path", ""))
        if not provider_path or provider_path == "src/providers/AppProviders.tsx":
            continue
        if not trace_paths(provider_trace):
            continue
        qas.append(
            "Bobby likely asks: how do you know this belongs in provider-level code instead of a screen? "
            f"Answer: {provider_path} directly coordinates {trace_sentence(provider_trace)}. "
            "That is a signal that the responsibility is shared or bootstrapped above individual screens."
        )
        break

    return qas


def build_rehearsal_script(
    deck: dict[str, Any], repo_context: str, variant: str = "default"
) -> list[dict[str, str]]:
    cards = list(deck.get("cards", []))
    meta = deck.get("meta", {})
    repo_name = str(meta.get("repoName") or "the mobile repo")
    relationship_meta = relationship_summaries(deck)

    routes = find_card(cards, "Routes Overview")
    providers = find_card(cards, "Provider Stack Overview")
    stores = find_card(cards, "State Store Overview")
    features = [card for card in cards if str(card.get("title", "")).startswith("Feature Surface: ")]

    root_trace = find_trace(
        relationship_meta, "app/_layout.tsx", ("keyTraces", "routeTraces")
    )
    providers_trace = find_trace(
        relationship_meta, "src/providers/AppProviders.tsx", ("keyTraces", "providerTraces")
    )
    dependency_hubs = prioritized_hubs(relationship_meta)
    route_traces = list(relationship_meta.get("routeTraces", []) or [])
    provider_traces = list(relationship_meta.get("providerTraces", []) or [])

    route_examples = sentence_list(code_lines(routes) if routes else [], 5)
    provider_examples = sentence_list(code_lines(providers) if providers else [], 5)
    store_examples = sentence_list(code_lines(stores) if stores else [], 5)
    feature_summary = sentence_list(
        [str(card.get("title", "")).replace("Feature Surface: ", "") for card in features[:8]],
        8,
    )

    route_example = next(
        (
            trace
            for trace in route_traces
            if str(trace.get("path", "")) != "app/_layout.tsx" and trace_paths(trace)
        ),
        None,
    )
    provider_example = next(
        (
            trace
            for trace in provider_traces
            if str(trace.get("path", "")) != "src/providers/AppProviders.tsx" and trace_paths(trace)
        ),
        None,
    )
    auth_hub = next(
        (
            hub
            for hub in dependency_hubs
            if "auth" in str(hub.get("path", "")).lower()
        ),
        None,
    )
    api_hub = next(
        (
            hub
            for hub in dependency_hubs
            if "api" in str(hub.get("path", "")).lower()
        ),
        None,
    )
    used_hub_paths = {
        str(hub.get("path", ""))
        for hub in (auth_hub, api_hub)
        if hub
    }
    backup_hubs = [
        hub
        for hub in dependency_hubs
        if str(hub.get("path", "")) not in used_hub_paths
    ]
    map_answer = (
        f"The app is organized by routes, feature surfaces, provider wrappers, and coordination stores. "
        f"Routes include {route_examples}. Features include {feature_summary}. Providers include {provider_examples}. "
        f"Stores include {store_examples}."
    )
    root_answer = (
        f"{root_trace['path']} directly imports {trace_sentence(root_trace)}. "
        "That is where shell-level concerns meet before feature screens take over."
        if root_trace and trace_paths(root_trace)
        else "Trace app/_layout.tsx first, then name the first shell modules it composes."
    )
    providers_answer = (
        f"{providers_trace['path']} directly depends on {trace_sentence(providers_trace)}. "
        "That is the real startup chain for shared runtime systems."
        if providers_trace and trace_paths(providers_trace)
        else "Trace AppProviders and the first shared runtime modules it boots."
    )
    provider_ownership_answer = (
        f"{provider_example['path']} coordinates {trace_sentence(provider_example)}. "
        "That is a sign the responsibility is shared above individual screens."
        if provider_example and trace_paths(provider_example)
        else "If the code is shared across screens or booted before screen render, argue for provider-level ownership."
    )
    auth_answer = (
        f"{auth_hub['path']} has fan-in from {auth_hub.get('dependentCount', 0)} local files, including "
        f"{trace_sentence(auth_hub, 'directDependents', 5)}. Changes there can ripple widely."
        if auth_hub
        else "Look for the auth store or provider seam with the highest fan-in and treat it as load-bearing."
    )
    api_answer = (
        f"{api_hub['path']} has fan-in from {api_hub.get('dependentCount', 0)} local files, including "
        f"{trace_sentence(api_hub, 'directDependents', 5)}. That is a cross-feature integration seam."
        if api_hub
        else "Look for the shared API seam with the widest fan-in and treat it as a cross-feature risk."
    )
    backup_hub_answer = (
        f"{backup_hubs[0]['path']} is depended on by {backup_hubs[0].get('dependentCount', 0)} local files. "
        "That makes it a good candidate for regression-focused review."
        if backup_hubs
        else "Pick the next highest fan-in traced node and use it as a second blast-radius example."
    )
    route_answer = (
        f"Start at {route_example['path']}, then walk its direct dependencies: {trace_sentence(route_example)}."
        if route_example and trace_paths(route_example)
        else "Start at the route file, then name the first internal modules it fans out to."
    )

    route_proof_answer = "I can name the route file and the next modules it fans out to."
    for extra_route in route_traces:
        route_path = str(extra_route.get("path", ""))
        if not route_path or extra_route == route_example or route_path == "app/_layout.tsx":
            continue
        if not trace_paths(extra_route):
            continue
        route_proof_answer = (
            f"I can name the route file, {route_path}, and the next modules it fans out to: "
            f"{trace_sentence(extra_route)}."
        )
        break

    risk_answer = (
        "Talk about blast radius at the seam: navigation flow, auth restoration, query invalidation, "
        "overlay coordination, or state ownership leaks."
    )
    boundary_answer = (
        "Put it in the narrowest stable boundary first: local screen logic, feature module, "
        "store-coordinated state, or provider-level setup."
    )
    recovery_answer = (
        "I know the route and feature boundary, and I would verify whether the behavior is anchored "
        "in the provider layer, a store, or the screen implementation before I claim more."
    )
    pushback_answer = (
        "The code suggests this is owned by the auth stack, query layer, or local screen state, "
        "but I would confirm the exact path before changing it."
    )
    strength_answer = (
        "It is bounded, falsifiable, and tied to a real code path instead of hand waving."
    )

    if variant == "standup-30sec":
        return [
            chapter(
                "Thirty Second Setup",
                [
                    qa("What is the goal?", f"Sound grounded, specific, and calm about {repo_name}."),
                    qa("What framing wins?", "Layer, code path, and risk."),
                    qa("What context am I carrying?", repo_context),
                ],
            ),
            chapter(
                "Thirty Second Answer",
                [
                    qa("Give the one-breath map.", map_answer),
                    qa(
                        "If someone asks what you actually traced, what do you say?",
                        f"I traced the shell through {root_trace['path']} and the startup chain through "
                        f"{providers_trace['path']}."
                        if root_trace and providers_trace
                        else "I traced the root layout first, then the provider chain that boots shared systems.",
                    ),
                    qa("If someone asks risk, what do you say?", risk_answer),
                ],
            ),
            chapter(
                "Proof Points",
                [
                    qa("What actually composes the app shell?", root_answer),
                    qa("What global systems boot before screens matter?", providers_answer),
                    qa("What file is obviously load-bearing?", auth_answer),
                    qa("What shared seam probably affects many features?", api_answer),
                ],
            ),
            chapter(
                "Recovery Lines",
                [
                    qa("What if I am not sure?", recovery_answer),
                    qa("What if I need one stronger sentence?", "This lives here because that layer owns this responsibility, and the main risk is this."),
                    qa("What makes that sound strong?", strength_answer),
                ],
            ),
        ]

    if variant == "bobby-aggressive":
        return [
            chapter(
                "Pressure Setup",
                [
                    qa("What style wins with Bobby?", "Boundaries, ownership, data flow, regression risk, and user impact. Not abstract clean-code slogans."),
                    qa("What does he care about first?", "Where it lives, what it affects, and how you know it is safe."),
                ],
            ),
            chapter(
                "Aggressive Pushback One",
                [
                    qa("No, really, what boots first?", root_answer),
                    qa("What global systems come online before screens matter?", providers_answer),
                    qa("Why is this not just screen logic?", provider_ownership_answer),
                ],
            ),
            chapter(
                "Aggressive Pushback Two",
                [
                    qa("What breaks if auth changes?", auth_answer),
                    qa("What shared seam would make me nervous in review?", api_answer),
                    qa("Give me another load-bearing example.", backup_hub_answer),
                ],
            ),
            chapter(
                "Aggressive Pushback Three",
                [
                    qa("A route is acting weird. Where exactly do you trace next?", route_answer),
                    qa("How do you prove you traced the screen instead of guessing?", route_proof_answer),
                    qa("Where should this responsibility live?", boundary_answer),
                ],
            ),
            chapter(
                "Pressure Recovery",
                [
                    qa("What do you say if you are not sure?", recovery_answer),
                    qa("What do you say if Bobby keeps pushing?", pushback_answer),
                    qa("What sentence shape sounds senior?", "This lives here because that layer owns this responsibility, and the main risk is this."),
                ],
            ),
        ]

    if variant == "review-defense":
        return [
            chapter(
                "Review Defense Setup",
                [
                    qa("What am I optimizing for?", "A change explanation that is scoped, reviewable, and tied to code paths with clear blast radius."),
                    qa("What tone works?", "Calm, bounded, and evidence-based."),
                ],
            ),
            chapter(
                "Scope Defense",
                [
                    qa("Where does the change belong?", boundary_answer),
                    qa("What shell path did you inspect?", root_answer),
                    qa("What startup path did you inspect?", providers_answer),
                ],
            ),
            chapter(
                "Risk Defense",
                [
                    qa("What is the auth blast radius?", auth_answer),
                    qa("What is the shared integration seam?", api_answer),
                    qa("What is another node you would watch closely?", backup_hub_answer),
                ],
            ),
            chapter(
                "Testing Defense",
                [
                    qa(
                        "What would you test before merging?",
                        f"I would test the shell path from {root_trace['path']} into shared startup code, "
                        f"the provider chain through {providers_trace['path']}, and the route behavior starting at "
                        f"{route_example['path']}."
                        if root_trace and providers_trace and route_example
                        else "I would test the shell path, the provider boot path, and the specific route or feature path I changed.",
                    ),
                    qa("What kind of regressions are you watching for?", risk_answer),
                    qa("How would you justify provider-level ownership in review?", provider_ownership_answer),
                ],
            ),
            chapter(
                "Reviewer Pushback",
                [
                    qa("How do you prove you traced the behavior?", route_proof_answer),
                    qa("What if you are still uncertain?", recovery_answer),
                    qa("What makes that answer acceptable?", strength_answer),
                ],
            ),
        ]

    return [
        chapter(
            "Standup Rehearsal Setup",
            [
                qa("What am I trying to sound like?", f"Grounded, specific, and calm about {repo_name}."),
                qa("What is the frame?", repo_context),
                qa("What style wins with Bobby?", "Boundaries, ownership, data flow, regression risk, and user impact. Not abstract clean-code slogans."),
            ],
        ),
        chapter(
            "Map Drill",
            [
                qa("Give me the thirty second map.", map_answer),
                qa("How do I avoid sounding vague?", "Name the layer first, then the code path, then the risk."),
                qa("What sentence shape should I use?", "This lives here because that layer owns this responsibility, and the main risk is this."),
            ],
        ),
        chapter(
            "Shell And Startup Drill",
            [
                qa("What actually composes the app shell?", root_answer),
                qa("What global systems boot before screens matter?", providers_answer),
                qa("How do I justify provider-level ownership?", provider_ownership_answer),
            ],
        ),
        chapter(
            "Ownership And Risk Drill",
            [
                qa("What file is obviously load-bearing?", auth_answer),
                qa("What shared seam probably affects many features?", api_answer),
                qa("Give me another ownership example.", backup_hub_answer),
                qa("What do I say about risk?", risk_answer),
            ],
        ),
        chapter(
            "Route And Boundary Drill",
            [
                qa("A route is behaving oddly. Where do I trace next?", route_answer),
                qa("How do I prove I traced the screen instead of guessing?", route_proof_answer),
                qa("How do I answer where something belongs?", boundary_answer),
            ],
        ),
        chapter(
            "Recovery Lines",
            [
                qa("What if I am not sure?", recovery_answer),
                qa("What if Bobby keeps pushing?", pushback_answer),
                qa("What makes that sound strong?", strength_answer),
            ],
        ),
    ]


def build_script(deck: dict[str, Any], repo_context: str) -> list[dict[str, str]]:
    cards = list(deck.get("cards", []))
    meta = deck.get("meta", {})
    relationship_meta = relationship_summaries(deck)
    repo_name = str(meta.get("repoName") or "the mobile repo")

    routes = find_card(cards, "Routes Overview")
    providers = find_card(cards, "Provider Stack Overview")
    stores = find_card(cards, "State Store Overview")
    features = [card for card in cards if str(card.get("title", "")).startswith("Feature Surface: ")]
    barrel_cards = [card for card in cards if str(card.get("title", "")).startswith("Barrel Surface: ")]

    implementation_cards = choose_cards(
        cards,
        include_types={"function", "pattern", "concept", "type"},
        exclude_prefixes=("Feature Surface: ", "Routes Overview", "Provider Stack Overview", "State Store Overview"),
        limit=5,
    )

    root_trace = find_trace(
        relationship_meta, "app/_layout.tsx", ("keyTraces", "routeTraces")
    )
    providers_trace = find_trace(
        relationship_meta, "src/providers/AppProviders.tsx", ("keyTraces", "providerTraces")
    )
    dependency_hubs = prioritized_hubs(relationship_meta)
    route_traces = list(relationship_meta.get("routeTraces", []) or [])
    provider_traces = list(relationship_meta.get("providerTraces", []) or [])

    feature_lines = [
        f"{card['title'].replace('Feature Surface: ', '')} covers {sentence_list(code_lines(card), 4)}."
        for card in features[:8]
    ]

    route_examples = sentence_list(code_lines(routes) if routes else [], 6)
    provider_examples = sentence_list(code_lines(providers) if providers else [], 6)
    store_examples = sentence_list(code_lines(stores) if stores else [], 6)
    barrel_examples = sentence_list([card.get("filePath", "") for card in barrel_cards[:6]], 6)

    intro = chapter(
        "Why This Exists",
        [
            f"This audiobook is a preparation pass for owning {repo_name}. Not code recital. Not architecture cosplay. The goal is that when someone like Bobby pushes on details in standup or a meeting, you can answer in a way that sounds grounded.",
            "I am not going to imitate any specific living teacher. I am going to use a clear, practical teaching voice: examples, metaphors, and direct language. Think less textbook, more senior engineer talking you through the map while you walk it.",
            f"The frame for this repo is simple. {repo_context} Your job is to know the map, know the load-bearing parts, know where state lives, and know how to talk about tradeoffs without sounding vague.",
        ],
    )

    big_picture = chapter(
        "The Big Picture",
        [
            f"Start with the mental model. {repo_name} is not one giant blob. Think of it like a small city. Routes are the train lines. Features are neighborhoods. Providers are the utilities under the street. Stores are the clipboards people carry around while the city keeps moving.",
            f"For navigation, the route surface includes {route_examples}. If someone asks how users move through the app, start there. The route files tell you which screens exist and which flows are first-class.",
            f"The provider stack is the app's life-support rack. Representative provider files are {provider_examples}. These are the modules that wrap the whole app and keep global concerns alive: auth, query state, analytics, runtime setup, and other cross-cutting behavior.",
            f"The state stores are where fast-moving UI coordination tends to live. Representative store files are {store_examples}. If a sheet opens, a badge updates, or a preference persists, odds are high a store is involved.",
        ],
    )

    feature_paragraph = chapter(
        "Feature Neighborhoods",
        [
            "Now the neighborhood map. Do not think of features as folders you memorize. Think of them as ownership zones. Each zone answers a product question and bundles the screens, components, and helpers needed to answer it.",
            " ".join(feature_lines) if feature_lines else "The deck did not expose feature summaries, so the first thing to inspect manually would be the src slash features tree.",
            "A good ownership answer in a meeting sounds like this: Search is its own feature surface. Auth is its own feature surface. Upload is its own feature surface. That tells the room you know where to start when a bug or decision lands.",
        ],
    )

    seams = chapter(
        "Module Seams And Public Surfaces",
        [
            f"Barrel files matter more than they look. They are the front doors of modules. Representative barrel surfaces include {barrel_examples}. When a codebase is healthy, these files tell you what a module wants the rest of the app to touch.",
            "Here is the metaphor. If a feature folder is a workshop, the barrel file is the counter at the front. You should know what the workshop sells without wandering into the back room every time.",
            "That is useful in meetings because you can say, the public surface for this area is small or large, stable or messy, and that immediately sounds like someone who has looked at boundaries rather than only implementation details.",
        ],
    )

    implementation_paragraphs = [
        "Now the implementation layer, but this time from actual code relationships rather than deck order. The point is to trace which files really pull which systems into the runtime."
    ]

    if root_trace and trace_paths(root_trace):
        implementation_paragraphs.append(
            f"Start with {root_trace['path']}. Its direct internal dependency trace includes {trace_sentence(root_trace)}. "
            "That is the concrete app-shell composition point. When somebody asks how navigation, overlays, initialization, and top-level UI wiring meet, this is the file to anchor on."
        )

    if providers_trace and trace_paths(providers_trace):
        implementation_paragraphs.append(
            f"Then look at {providers_trace['path']}. It directly depends on {trace_sentence(providers_trace)}. "
            "That is not a heuristic guess. That is the actual provider and manager chain the app boots before most screens even matter."
        )

    if dependency_hubs:
        top_hubs = [
            hub
            for hub in dependency_hubs
            if str(hub.get("path", "")) not in {"app/_layout.tsx", "src/providers/AppProviders.tsx"}
            and int(hub.get("dependentCount", 0) or 0) > 0
        ][:3]
        if top_hubs:
            hub_lines = [
                f"{hub['path']} has fan-in from {hub.get('dependentCount', 0)} local files, including {trace_sentence(hub, 'directDependents', 4)}."
                for hub in top_hubs
            ]
            implementation_paragraphs.append(
                "The load-bearing nodes are the ones with lots of fan-in. "
                + " ".join(hub_lines)
            )

    if route_traces:
        route_examples = [
            trace
            for trace in route_traces
            if str(trace.get("path", "")) != "app/_layout.tsx" and trace_paths(trace)
        ][:2]
        if route_examples:
            route_lines = [
                f"{trace['path']} fans out to {trace_sentence(trace)}."
                for trace in route_examples
            ]
            implementation_paragraphs.append(
                "Route tracing is how you stop hand-waving about screens. "
                + " ".join(route_lines)
            )

    if provider_traces:
        provider_examples = [
            trace
            for trace in provider_traces
            if str(trace.get("path", "")) != "src/providers/AppProviders.tsx" and trace_paths(trace)
        ][:2]
        if provider_examples:
            provider_lines = [
                f"{trace['path']} coordinates {trace_sentence(trace)}."
                for trace in provider_examples
            ]
            implementation_paragraphs.append(
                "Provider tracing tells you which responsibilities are centralized above feature code. "
                + " ".join(provider_lines)
            )

    for card in implementation_cards:
        title = str(card.get("title", "This module"))
        file_path = str(card.get("filePath", "the repo"))
        explanation = normalize_whitespace(str(card.get("explanation", "")))
        prompt = normalize_whitespace(str(card.get("prompt", "")))
        implementation_paragraphs.append(
            f"{title} in {file_path}. The question to keep in your head is: {prompt.replace('Before you reveal the answer: ', '')} The practical answer is: {explanation} If someone asks why this matters, say it is one of the concrete implementation hooks that makes the broader architecture real."
        )

    implementation = chapter("Representative Implementation Details", implementation_paragraphs)

    likely_questions = build_relationship_qas(deck)
    likely_questions_chapter = chapter(
        "Likely Pushback And Answers",
        likely_questions
        or [
            "The deck did not include enough relationship data to build sharper pushback answers, so the next debugging step would be tracing root layout, provider, and store imports directly."
        ],
    )

    meeting_language = chapter(
        "How To Sound Ready In Standup",
        [
            "Here is the meeting language that tends to land well with hardasses. Start high-level, then drop one layer. For example: The mobile app is organized by route files, feature surfaces, provider wrappers, and Zustand-style coordination stores. The part I touched or traced lives in one of those zones.",
            "If Bobby asks where something belongs, answer with a boundary. Say: that feels like a feature concern, or that smells like provider-level setup, or that looks like local screen logic, or that is shared state coordinated through a store.",
            "If Bobby asks what could break, talk about seams. Say: the risky parts are navigation transitions, auth restoration, query invalidation, overlay coordination, and any place where one feature boundary leaks into another.",
            "If you are unsure, do not bluff. Use this line: I know the route and feature boundary, and I would verify whether the behavior is anchored in the provider layer, a store, or the screen implementation. That sounds much stronger than random guessing.",
        ],
    )

    ownership = chapter(
        "What Ownership Actually Means",
        [
            "Ownership is not memorizing the repo. Ownership is being able to answer five questions without panicking. What is this area for? Where does it live? What global systems does it depend on? What state does it own? And what are the likely failure modes if we change it?",
            f"For {repo_name}, your first-pass ownership checklist is: know the route map, know the feature neighborhoods, know the provider stack, know the state stores, and know a few representative implementation anchors.",
            "That is enough to survive standup, ask sharper questions in meetings, and stop feeling like you are just vibecoding through a haunted mansion.",
        ],
    )

    outro = chapter(
        "Next Listening Loop",
        [
            "Use this audiobook like interval training. Listen once for the map. Listen again while looking at the repo. Then answer the prompts out loud before revealing the explanations.",
            "When the map starts to feel boring, that is good. Boring is what competence feels like before it turns into speed.",
        ],
    )

    return [
        intro,
        big_picture,
        feature_paragraph,
        seams,
        implementation,
        likely_questions_chapter,
        meeting_language,
        ownership,
        outro,
    ]


def build_bobby_prep_script(deck: dict[str, Any], repo_context: str) -> list[dict[str, str]]:
    cards = list(deck.get("cards", []))
    meta = deck.get("meta", {})
    relationship_meta = relationship_summaries(deck)
    repo_name = str(meta.get("repoName") or "the mobile repo")

    routes = find_card(cards, "Routes Overview")
    providers = find_card(cards, "Provider Stack Overview")
    stores = find_card(cards, "State Store Overview")
    features = [card for card in cards if str(card.get("title", "")).startswith("Feature Surface: ")]

    implementation_cards = choose_cards(
        cards,
        include_types={"function", "pattern", "concept", "type"},
        exclude_prefixes=(
            "Feature Surface: ",
            "Routes Overview",
            "Provider Stack Overview",
            "State Store Overview",
            "Barrel Surface: ",
        ),
        limit=5,
    )

    root_trace = find_trace(
        relationship_meta, "app/_layout.tsx", ("keyTraces", "routeTraces")
    )
    providers_trace = find_trace(
        relationship_meta, "src/providers/AppProviders.tsx", ("keyTraces", "providerTraces")
    )
    dependency_hubs = prioritized_hubs(relationship_meta)

    route_examples = sentence_list(code_lines(routes) if routes else [], 5)
    provider_examples = sentence_list(code_lines(providers) if providers else [], 5)
    store_examples = sentence_list(code_lines(stores) if stores else [], 5)

    feature_summary = sentence_list(
        [str(card.get("title", "")).replace("Feature Surface: ", "") for card in features[:8]],
        8,
    )

    intro = chapter(
        "Bobby Prep",
        [
            f"This is the short Bobby prep cut for {repo_name}. The goal is not to sound clever. The goal is to sound grounded, specific, and calm when somebody pushes on details.",
            f"The working frame is this. {repo_context} You are trying to show ownership through boundaries, failure modes, and tradeoffs, not by reciting random symbol names.",
        ],
    )

    style = chapter(
        "How Bobby Likely Thinks",
        [
            "This is an inference from the repo and workflow, not a verified psychological profile. Bobby does not read like functional-programming purity first. He reads more like pragmatic architecture and operational correctness first.",
            "The signals are clear. The repo emphasizes feature boundaries, provider and store responsibilities, small PRs, reviewability, and auto-deploy caution. That is less 'show me a beautiful monad' and more 'show me where this belongs, what it affects, and how you know it is safe.'",
            "So do not lean on abstract purity. Lean on boundaries, ownership zones, concrete data flow, user-visible behavior, and what could regress.",
        ],
    )

    map_chapter = chapter(
        "The Thirty Second Map",
        [
            f"If Bobby asks for the map, say this. The mobile app is organized by routes, feature surfaces, provider wrappers, and coordination stores. Routes include {route_examples}. Feature surfaces include {feature_summary}. Providers include {provider_examples}. Stores include {store_examples}.",
            "That answer works because it gives structure first. It tells the room you know the shape of the system before talking implementation.",
        ],
    )

    ownership_answers = [
        "If he asks where something belongs, answer with the nearest stable boundary. Feature concern. Provider-level concern. Store-coordinated state. Or local screen logic.",
        "If he asks what could break, answer with a seam. Navigation flow, auth restoration, query invalidation, overlay coordination, cache assumptions, or a boundary leak between features.",
        "If he asks how confident you are, answer with verification language. I traced the route. I checked the provider layer. I verified which store owns the sheet state. I know where I would test the regression.",
    ]

    if root_trace and trace_paths(root_trace):
        ownership_answers.append(
            f"Actual trace example. {root_trace['path']} directly composes {trace_sentence(root_trace)}. "
            "That is the app-shell answer when somebody asks what comes online first."
        )

    if providers_trace and trace_paths(providers_trace):
        ownership_answers.append(
            f"Actual trace example. {providers_trace['path']} directly depends on {trace_sentence(providers_trace)}. "
            "That is the evidence for talking about shared runtime systems rather than vague provider talk."
        )

    if dependency_hubs:
        for hub in dependency_hubs:
            hub_path = str(hub.get("path", ""))
            if not hub_path or hub_path in {"app/_layout.tsx", "src/providers/AppProviders.tsx"}:
                continue
            dependent_count = int(hub.get("dependentCount", 0) or 0)
            if dependent_count <= 0:
                continue
            ownership_answers.append(
                f"Load-bearing example. {hub_path} has fan-in from {dependent_count} local files, including {trace_sentence(hub, 'directDependents', 4)}. "
                "That is how you justify why a change there needs extra care."
            )
            if len(ownership_answers) >= 6:
                break

    for card in implementation_cards:
        title = str(card.get("title", "This module"))
        file_path = str(card.get("filePath", "the repo"))
        explanation = normalize_whitespace(str(card.get("explanation", "")))
        ownership_answers.append(
            f"For a concrete example, {title} in {file_path}. The short ownership answer is: {explanation}"
        )

    ownership = chapter("Answers That Sound Owned", ownership_answers)

    likely_questions = chapter(
        "Bobby Likely Asks",
        build_relationship_qas(deck)
        or [
            "The dependency graph did not produce enough trace data, so the next move would be to inspect root layout, AppProviders, and the top fan-in files directly."
        ],
    )

    lean_on = chapter(
        "What To Lean On",
        [
            "Lean on these five things. One, boundaries. Two, state ownership. Three, data flow. Four, regression risk. Five, user impact.",
            "Do not lean on these unless asked. Generic clean-code slogans. Functional-programming aesthetics. Broad claims like 'it is more scalable' without naming the boundary or failure mode you improved.",
            "The strongest sentence pattern is: This lives here, because that layer owns this responsibility, and the main risk is this. That is what sounds senior.",
        ],
    )

    escape_hatch = chapter(
        "If You Get Cornered",
        [
            "Use this exact move. I know the route and feature boundary, and I would verify whether the behavior is anchored in the provider layer, a store, or the screen implementation before I claim more. That buys time without sounding lost.",
            "A second safe move is: The code suggests this is owned by the auth stack, query layer, or local screen state, but I would confirm the exact path before changing it. Again, calm, bounded, and real.",
        ],
    )

    return [
        intro,
        style,
        map_chapter,
        ownership,
        likely_questions,
        lean_on,
        escape_hatch,
    ]


def build_runtime_design_script(deck: dict[str, Any], repo_context: str) -> list[dict[str, str]]:
    meta = deck.get("meta", {})
    repo_name = str(meta.get("repoName") or "the mobile repo")

    intro = chapter(
        "Why Premium UI Is Runtime Architecture",
        [
            f"This cut is about owning {repo_name} as a design engineer, not just as someone who can move pixels around. The point is to connect feel to runtime. When a sheet follows your finger, when a feed scrolls without hitching, or when a search field does not fight typing, that is design taste plus thread discipline.",
            "A useful rule: if a value changes continuously while the user is touching the screen, it probably should not depend on React rendering every frame. React is excellent for product state and screen composition. It is not where finger-following math should live.",
            "Use this as a companion to the ownership audiobook. That one teaches the map. This one teaches why some interactions feel expensive, cheap, immediate, or sticky in the mobile app surface.",
        ],
    )

    threads = chapter(
        "JS Thread, UI Thread, Native Modules",
        [
            "React Native work happens in a few places. The JS thread runs React, app state, network callbacks, query updates, and most business logic. The UI thread handles native layout, gestures, scroll, and view updates. Native modules, C plus plus, and JSI give libraries a more direct path between JavaScript and native runtime.",
            "Hermes matters because it is the JavaScript engine the app runs on. New Architecture matters because it changes how React Native talks to native views and modules. Reanimated and Worklets matter because they let small pieces of interaction logic run where the UI can use them immediately.",
            "The design engineering move is to ask where a piece of state belongs. Server data belongs in the query layer. Global coordination may belong in a store. Button labels and modal open state can be React. Scroll position, drag offset, pinch scale, and gesture velocity usually want shared values or native state.",
        ],
    )

    worklets = chapter(
        "Shared Values, Worklets, And Gesture Feel",
        [
            "A Reanimated shared value is a small mutable value that animated styles and worklets can read without waiting for React to re-render. A worklet is a function that can run on the UI side. Together they are how you make motion feel attached to the hand.",
            "The clean pattern is: store continuous values in shared values, update them inside worklets, derive animated styles from those values, and notify JavaScript only when a meaningful event happens. Dismissed. Selected. Completed. Snapped closed. Not every pixel of a drag.",
            "If somebody asks why a bottom sheet feels better this way, the answer is simple: the finger movement, sheet translation, and backdrop opacity can update together without asking React to do a full state update loop for every frame.",
        ],
    )

    silk_good = chapter(
        "Where Silk Already Does This Well",
        [
            "Silk already has the foundations. In the mobile app, Hermes is enabled, New Architecture is enabled, Reanimated and Worklets are installed, FlashList is used for heavy media grids, and Skia is available behind a fail-closed runtime switch.",
            "The files to study first are apps/mobile/src/ui/ScrollContext.tsx, apps/mobile/src/components/MediaGridFixed.tsx, apps/mobile/src/animation/components/BottomSheetLite.tsx, and apps/mobile/src/hooks/useZoomDismiss.ts. These are good training grounds because they show scroll, grid, sheet, and detail-transition behavior where runtime choices show up as feel.",
            "When you read those files, do not start by memorizing every line. Ask: what value changes every frame? Where is it stored? Which visual output depends on it? Where does JavaScript get notified, and is that notification rare or continuous?",
        ],
    )

    bridges = chapter(
        "Where Silk Still Crosses Back To JS",
        [
            "runOnJS is not bad. It is the correct bridge when UI-thread work needs to tell React that something semantic happened. The problem is using it like a per-frame data pipe.",
            "Risky cases are scroll handlers, drag updates, pinch updates, sliders, color pickers, and typing. If those call back into JS for every movement, you have turned a native-thread interaction back into a JS-thread dependency.",
            "A concrete audit exercise: search the mobile app for runOnJS. Mark each call OK if it happens on animation end, gesture end, dismiss, select, or complete. Mark it risky if it happens during continuous scroll, drag, pinch, slider movement, or keystrokes. Then ask whether the visual part can stay in shared values and the JS callback can move to a threshold or final event.",
        ],
    )

    inputs = chapter(
        "Inputs, Search, And SDK 56 Later",
        [
            "Text input is a special case because every keystroke is both data and UI. Controlled React input means native text changes, JS hears about it, React state updates, the component re-renders, and native receives the new prop. That is a lot of ceremony for typing.",
            "Without SDK 56, the improvement path is still useful: keep draft text local, debounce search, avoid parent rerenders per keypress, do not push every character into a global store, and commit only when the user pauses or submits.",
            "SDK 56 useNativeState is interesting later because it gives Expo UI native components observable native state. In plain language, SwiftUI or Compose can read and write state closer to where the control actually lives. For Silk, that could matter for search fields, masked inputs, sliders, and other form controls that should feel native under pressure.",
        ],
    )

    memory = chapter(
        "Images, Skia, And Memory Pressure",
        [
            "Design engineering also means knowing when visual ambition costs memory. Media-heavy apps do not usually fail because one animation is ugly. They fail because image decode, cache policy, prefetching, and offscreen rendering overwhelm the device.",
            "FlashList, expo-image, thumbnail sizing, draw distance, and removeClippedSubviews are not boring details. They are part of the visual system. The interface can only feel polished if the app keeps enough memory free to scroll and transition smoothly.",
            "Skia is powerful, but in Silk it is intentionally fail-closed. That is a mature posture. Turn it on locally for a controlled experiment, prove it on real devices, and only then consider making a heavier visual path default.",
        ],
    )

    review = chapter(
        "How To Review This Like A Design Engineer",
        [
            "For every interaction, review it in two layers. First, the experience layer: does it feel immediate, follow the finger, preserve spatial continuity, avoid harsh jumps, and still behave on lower-end Android devices?",
            "Second, the runtime layer: is the continuous value in React state, a ref, a shared value, or native state? Does it cross from UI thread to JS every frame? Is runOnJS only used for meaningful events? Is the image or blur effect worth its memory cost?",
            "This is the bridge between taste and engineering. A strong design engineer can say: this sheet feels premium because the drag offset and backdrop opacity are UI-thread shared values, while React only hears about the dismiss decision. That is much sharper than saying the animation is smooth.",
        ],
    )

    drills = chapter(
        "Listening Drills",
        [
            "Drill one. Open BottomSheetLite. Name the shared values. Name the gesture callbacks. Name the exact places JavaScript is called. Then explain what would stutter if the same behavior lived in React state.",
            "Drill two. Open ScrollContext and MediaGridFixed. Trace where scroll position and velocity are stored. Find which parts are updated on the UI thread. Then look for any remaining JS callback paths.",
            "Drill three. Search for runOnJS. Build two columns: safe semantic callbacks and risky continuous callbacks. Pick one risky callback and say how you would keep the visual response native while sending only the final decision to React.",
        ],
    )

    return [
        intro,
        threads,
        worklets,
        silk_good,
        bridges,
        inputs,
        memory,
        review,
        drills,
    ]


def markdown_from_chapters(chapters: list[dict[str, str]]) -> str:
    parts = []
    for index, item in enumerate(chapters, start=1):
        parts.append(f"## {index}. {item['title']}\n\n{item['text']}")
    return "\n\n".join(parts).strip() + "\n"


def plain_text_from_chapters(chapters: list[dict[str, str]]) -> str:
    parts = []
    for index, item in enumerate(chapters, start=1):
        parts.append(f"{index}. {item['title']}\n\n{item['text']}")
    return "\n\n".join(parts).strip() + "\n"


async def synthesize_chapter(text: str, voice: str, rate: str, output_path: Path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(output_path))


def concat_mp3s(chapter_paths: list[Path], final_output: Path) -> None:
    concat_file = final_output.with_suffix(".concat.txt")
    concat_text = "\n".join(f"file '{path.resolve()}'" for path in chapter_paths) + "\n"
    concat_file.write_text(concat_text, encoding="utf-8")
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-c",
                "copy",
                str(final_output),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        concat_file.unlink(missing_ok=True)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deck", required=True, help="Path to portable deck JSON")
    parser.add_argument(
        "--output-dir",
        default="output/audiobooks",
        help="Directory for markdown, chapter audio, and merged audiobook output",
    )
    parser.add_argument(
        "--voice",
        default="en-NZ-MitchellNeural",
        help="edge-tts voice name",
    )
    parser.add_argument(
        "--rate",
        default="+0%",
        help="edge-tts rate, for example +0%% or -10%%",
    )
    parser.add_argument(
        "--context",
        default="This is the mobile application surface you need to talk about with confidence.",
        help="High-level context sentence used in the introduction",
    )
    parser.add_argument(
        "--cut",
        choices=("ownership", "bobby", "rehearsal", "runtime"),
        default="ownership",
        help="Choose the full ownership walkthrough, the shorter Bobby-prep cut, the standup rehearsal cut, or the runtime design-engineering cut",
    )
    parser.add_argument(
        "--variant",
        choices=("default", "bobby-aggressive", "standup-30sec", "review-defense"),
        default="default",
        help="Variant for rehearsal mode",
    )
    args = parser.parse_args()

    deck_path = Path(args.deck).resolve()
    deck = read_json(deck_path)
    repo_name = str(deck.get("meta", {}).get("repoName") or deck_path.stem)
    if args.cut == "bobby":
        chapters = build_bobby_prep_script(deck, args.context)
    elif args.cut == "rehearsal":
        chapters = build_rehearsal_script(deck, args.context, args.variant)
    elif args.cut == "runtime":
        chapters = build_runtime_design_script(deck, args.context)
    else:
        chapters = build_script(deck, args.context)

    suffix_by_cut = {
        "ownership": "ownership",
        "bobby": "bobby-prep",
        "rehearsal": "standup-rehearsal",
        "runtime": "runtime-design-engineering",
    }
    suffix = suffix_by_cut[args.cut]
    if args.cut == "rehearsal" and args.variant != "default":
        suffix = f"{suffix}-{args.variant}"
    output_dir = Path(args.output_dir).resolve() / f"{slugify(repo_name)}-{suffix}"
    output_dir.mkdir(parents=True, exist_ok=True)
    chapters_dir = output_dir / "chapters"
    chapters_dir.mkdir(parents=True, exist_ok=True)

    markdown_path = output_dir / "script.md"
    text_path = output_dir / "script.txt"
    manifest_path = output_dir / "manifest.json"
    audiobook_path = output_dir / f"{slugify(repo_name)}-{suffix}.mp3"

    markdown_path.write_text(markdown_from_chapters(chapters), encoding="utf-8")
    text_path.write_text(plain_text_from_chapters(chapters), encoding="utf-8")

    chapter_audio_paths: list[Path] = []
    manifest: dict[str, Any] = {
        "repoName": repo_name,
        "cut": args.cut,
        "variant": args.variant if args.cut == "rehearsal" else "default",
        "voice": args.voice,
        "rate": args.rate,
        "deck": str(deck_path),
        "chapters": [],
    }

    for index, item in enumerate(chapters, start=1):
        chapter_file = chapters_dir / f"{index:02d}-{slugify(item['title'])}.mp3"
        chapter_audio_paths.append(chapter_file)
        chapter_text = f"{item['title']}. {item['text']}"
        await synthesize_chapter(chapter_text, args.voice, args.rate, chapter_file)
        manifest["chapters"].append(
            {
                "index": index,
                "title": item["title"],
                "audio": str(chapter_file),
            }
        )

    concat_mp3s(chapter_audio_paths, audiobook_path)
    manifest["audiobook"] = str(audiobook_path)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Script: {markdown_path}")
    print(f"Audiobook: {audiobook_path}")


if __name__ == "__main__":
    asyncio.run(main())

# DAW UI — Engineering & Development Guidelines

## Goal

Build a high-performance, reusable React + TypeScript UI framework for DAW-style editors inspired by Bitwig Studio.

Initial major features:

* arranger/project view
* tracks
* MIDI clips
* audio clips
* clip moving
* clip resizing/trimming
* clip looping
* track automation lanes
* automation points and curves
* piano roll
* MIDI note editing
* timeline ruler
* playhead
* selection
* snapping
* zooming and scrolling

The architecture must prioritize:

1. maintainability
2. predictable editor behavior
3. performance
4. code reuse
5. type safety
6. minimal dependencies
7. testability
8. reproducible builds
9. incremental development

Do not optimize for producing a visually impressive prototype quickly at the expense of architecture.

---

# Technology Baseline

Use:

```text
React
TypeScript
Vite
pnpm
Biome
Vitest
```

Use the **latest stable release available at project creation time**.

Do not copy version numbers from this specification.

Bootstrap packages using `@latest`, then commit the resulting exact versions and `pnpm-lock.yaml`.

For example:

```bash
pnpm create vite@latest
```

Choose:

```text
React
TypeScript
```

After project creation, verify that every direct dependency is using the newest stable version compatible with the project.

Do not use:

```text
alpha
beta
rc
canary
nightly
next
experimental
```

versions unless a feature explicitly requires them and the decision is documented.

---

# Package Manager

Use **pnpm exclusively**.

Do not mix:

```text
npm
yarn
bun
pnpm
```

within the repository.

Commit:

```text
pnpm-lock.yaml
```

Pin the pnpm version used by the repository using the `packageManager` field in `package.json`.

Example shape:

```json
{
  "packageManager": "pnpm@<resolved-version>"
}
```

CI must use the pinned package manager version.

CI installations must use:

```bash
pnpm install --frozen-lockfile
```

A build must never silently modify the lockfile.

---

# Dependency Policy

Dependencies must be treated as architectural decisions.

Before adding a dependency, determine whether the functionality can reasonably be implemented with:

```text
React
TypeScript
browser APIs
CSS
Canvas
SVG
Web APIs
existing project utilities
```

Prefer those before introducing another package.

Every new runtime dependency must provide substantial value that would otherwise require significant custom implementation.

Avoid installing packages for trivial functionality.

Examples of things that do **not** justify dependencies:

```text
clamp()
debounce()
throttle()
UUID generation when crypto.randomUUID() is sufficient
simple event emitters
simple math helpers
classnames joining
basic date formatting
simple DOM measurements
basic pointer handling
basic keyboard handling
```

Do not introduce utility mega-libraries.

Avoid:

```text
lodash
moment
jQuery
generic drag-and-drop frameworks
generic canvas scene graphs
large UI component frameworks
```

unless a concrete requirement demonstrates that they are necessary.

---

# Runtime Dependency Budget

Keep runtime dependencies extremely small.

The preferred initial runtime dependency set is approximately:

```text
react
react-dom
```

An external state library such as Zustand may be introduced only if the editor-state architecture demonstrates a clear benefit over a small external store using React's standard subscription mechanisms.

Do not add Redux, MobX, XState, RxJS, Immer, or similar architectural dependencies by default.

A dependency must solve a real problem before being introduced.

---

# Dev Dependency Policy

Development dependencies are acceptable when they substantially improve correctness or workflow.

Prefer tools that replace several overlapping tools.

Use **Biome** for:

```text
formatting
linting
import organization
React correctness rules
basic code-quality enforcement
```

Do not install both Biome and Prettier.

Do not install an ESLint ecosystem alongside Biome unless there is a specific rule that the project genuinely requires and Biome cannot provide.

Use **Vitest** for unit testing because it integrates naturally with the Vite toolchain.

Initially test pure editor/domain logic without a DOM environment whenever possible.

Do not install jsdom merely because React exists.

Add browser-level testing such as Playwright later when interaction-level integration testing requires a real browser.

Do not add Storybook initially.

Use an internal development/demo route or playground instead.

---

# Strict TypeScript

TypeScript must run in strict mode.

Use strict compiler options appropriate to the current stable TypeScript version.

At minimum preserve the intent of:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedSideEffectImports": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

Adapt options to the latest stable TypeScript recommendations rather than preserving obsolete settings.

Avoid:

```ts
any
```

Prefer:

```ts
unknown
```

when the type genuinely is not known.

Do not use:

```ts
as any
```

to bypass architectural or typing problems.

Avoid non-null assertions:

```ts
value!
```

unless correctness is externally guaranteed and documented.

Prefer discriminated unions for domain models.

Example:

```ts
type Clip = MidiClip | AudioClip;

interface MidiClip {
  type: "midi";
}

interface AudioClip {
  type: "audio";
}
```

Use exhaustive switching where appropriate.

---

# Repository Structure

Start with a **single repository and single application**.

Do not create a monorepo purely for architectural aesthetics.

Do not introduce:

```text
Turborepo
Nx
Lerna
```

at the beginning.

Organize reusable code internally:

```text
src/
  app/

  core/
    model/
    time/
    commands/
    history/
    selection/
    snapping/
    geometry/

  editor/
    interactions/
    viewport/
    state/

  components/
    arranger/
    clips/
    automation/
    piano-roll/
    timeline/
    controls/

  rendering/
    grid/
    midi/
    waveform/
    automation/

  styles/

  test/
```

When a second real consumer appears, reusable modules may be extracted into pnpm workspace packages.

Premature package boundaries should be avoided.

---

# Architecture Rules

The application must maintain a clear separation between:

```text
domain state
editor state
interaction state
rendering
React components
```

The dependency direction should approximately be:

```text
domain model
    ↓
editor operations
    ↓
commands
    ↓
interaction system
    ↓
rendering/components
```

Core domain code must not depend on React.

For example:

```text
src/core/
```

must contain framework-independent TypeScript wherever practical.

This allows timeline mathematics, snapping, clip operations, commands, and selection logic to be tested without mounting React components.

---

# Core Architecture Invariants

These rules are mandatory.

## Musical positions are not pixels

Project state stores musical time.

Never store UI pixel positions as project state.

Use something such as:

```ts
type Tick = number;
```

and a fixed PPQ resolution.

Conversions happen through shared geometry functions:

```ts
tickToX()
xToTick()

pitchToY()
yToPitch()
```

---

## One coordinate system

Arranger, piano roll, automation, playhead, selections, markers, and grid must use the same underlying time-coordinate abstraction.

Do not reimplement timeline conversion inside individual components.

---

## Commands own mutations

Project mutations must happen through editor/domain commands.

Example:

```ts
moveClips(...)
resizeClip(...)
setClipLoop(...)
createNotes(...)
moveNotes(...)
deleteSelection(...)
moveAutomationPoints(...)
```

Components should not mutate domain entities directly.

Bad:

```ts
clip.startTick += delta;
```

Good:

```ts
commands.moveClips({
  ids: selection,
  deltaTicks,
});
```

---

## Undo/redo is foundational

Commands must be compatible with undo/redo from the beginning.

Pointer dragging must create one logical history entry.

For example:

```text
pointerdown
100 pointermove events
pointerup
```

must result in:

```text
1 undo operation
```

not 100.

---

# Project State vs Editor State

Do not mix persistent project state with transient UI state.

Example project state:

```text
tracks
clips
notes
automation
tempo
time signatures
clip loop configuration
audio references
```

Example editor state:

```text
selection
hover target
viewport
zoom
scroll
active tool
snap configuration
focused editor
expanded automation lanes
```

Example transient interaction state:

```text
active drag
drag start position
preview clip position
resize mode
pointer ID
temporary selection box
```

Transient interaction state should normally not be persisted into project data until the interaction commits.

---

# React Responsibilities

React is responsible for:

```text
component composition
UI state subscriptions
controls
semantic DOM
menus
labels
track headers
clip containers
interaction handles
editor structure
```

React should **not** be treated as the high-frequency graphics engine.

Avoid causing the entire arranger to rerender on every pointer movement.

High-frequency operations should use:

```text
pointer events
pointer capture
requestAnimationFrame
transient editor state
fine-grained subscriptions
imperative rendering where appropriate
```

---

# Rendering Strategy

Use the appropriate renderer for each problem.

Prefer DOM/CSS for:

```text
track headers
controls
clip containers
clip labels
resize handles
selection outlines
menus
tooltips
buttons
inputs
```

Prefer Canvas for dense graphical information:

```text
waveforms
dense MIDI previews
large grids
high-density note visualization where necessary
```

Use SVG or Canvas for automation curves depending on measured performance and interaction requirements.

Do not introduce a canvas framework unless native Canvas becomes a demonstrated maintenance problem.

---

# Reuse Before Duplication

Before implementing functionality for an editor, determine whether it belongs in a shared primitive.

Examples:

```text
timeline coordinate conversion
snapping
selection
drag sessions
viewport handling
auto-scroll
keyboard modifiers
pointer capture
range calculations
hit testing
undo transactions
grid calculations
```

These should not be independently implemented by:

```text
Arranger
PianoRoll
AutomationLane
```

Instead, all editors should reuse shared systems.

Example:

```text
TimelineGeometry
SnapEngine
SelectionModel
InteractionSession
Viewport
CommandHistory
```

Favor small composable primitives over large inheritance hierarchies.

Prefer composition.

---

# Avoid Premature Abstraction

Code reuse does **not** mean abstracting everything immediately.

Apply the Rule of Three where sensible:

When similar logic appears once:

```text
keep it local
```

When it appears twice:

```text
observe the similarities
```

When it appears three times and the abstraction is clear:

```text
extract a reusable primitive
```

Exceptions are fundamental architecture primitives whose reuse is known in advance, such as timeline coordinates and snapping.

---

# Component Design

Components should be small and composable.

Avoid components such as:

```text
DAWEditor.tsx
ProjectView.tsx
TimelineEverything.tsx
```

containing thousands of lines.

Prefer structures such as:

```tsx
<Arranger>
  <TimelineRuler />

  <TrackList>
    <Track>
      <TrackHeader />

      <TrackLane>
        <MidiClip />
        <AudioClip />
      </TrackLane>

      <AutomationLane />
    </Track>
  </TrackList>

  <Playhead />
  <SelectionOverlay />
</Arranger>
```

Components must consume shared models and geometry rather than duplicate calculations.

---

# Styling

Use modern CSS.

Prefer:

```text
CSS custom properties
CSS modules or locally scoped CSS
logical properties
flex
grid
container queries where useful
```

Do not introduce Tailwind initially.

The DAW UI contains highly dynamic geometry where explicit CSS and calculated style values are often clearer than utility-class composition.

Use semantic design tokens.

Example:

```css
:root {
  --daw-bg-base: ...;
  --daw-bg-raised: ...;
  --daw-border-subtle: ...;

  --daw-text-primary: ...;
  --daw-text-secondary: ...;

  --daw-grid-major: ...;
  --daw-grid-minor: ...;

  --daw-selection: ...;
}
```

Components must not scatter hardcoded theme colors throughout their implementation.

---

# Bitwig Inspiration

Reproduce useful interaction patterns and overall visual character.

Do not directly copy:

```text
Bitwig branding
logos
proprietary artwork
icon assets
trademarked visual material
```

Create an original DAW design system with Bitwig-inspired density and interaction behavior.

Interaction fidelity is more important than pixel-perfect visual cloning.

---

# Performance Rules

Do not prematurely micro-optimize.

Do establish architecture that allows optimization.

Avoid:

```text
whole-project rerenders during drag
one React component per waveform sample
one DOM element per grid line at extreme zoom levels
storing derived pixel coordinates in domain state
expensive calculations directly inside render loops
```

Prefer:

```text
viewport culling
memoized derived geometry where useful
requestAnimationFrame
Canvas for dense graphics
cached waveform data
level-of-detail rendering
fine-grained state subscriptions
```

Measure before introducing complex optimization systems.

Use the browser Performance tools before making performance claims.

---

# Event Handling

Use Pointer Events rather than separate mouse and touch implementations.

Prefer:

```text
pointerdown
pointermove
pointerup
pointercancel
setPointerCapture()
releasePointerCapture()
```

All drag-style interactions should follow a shared interaction-session abstraction where practical.

Keyboard modifiers should also be normalized centrally:

```text
Shift
Alt
Ctrl
Meta
```

Do not duplicate OS-specific modifier logic across components.

---

# Testing Strategy

Testing should heavily target deterministic editor logic.

Highest priority tests:

```text
tick ↔ pixel conversions
snap calculations
clip movement
clip trimming
clip looping
selection
multi-selection
note movement
note resizing
automation interpolation
undo/redo
command transactions
viewport calculations
```

These tests should normally run without a browser.

Example:

```ts
describe("moveClips", () => {
  it("moves selected clips by the supplied tick delta", () => {
    // ...
  });
});
```

UI tests should target behavior rather than implementation details.

Avoid tests that merely confirm that React rendered a particular internal component hierarchy.

Browser-level interaction tests can be added when features become sufficiently complex.

---

# Accessibility

Even though this is a desktop-oriented creative application, accessibility should not be ignored.

Controls should:

```text
use semantic elements
have accessible names
support keyboard focus
expose appropriate ARIA state where required
```

Custom canvas-rendered interfaces should maintain DOM-level accessible controls where practical.

Do not sacrifice keyboard operability unnecessarily.

---

# Git Workflow

Use a lightweight trunk-based workflow.

Primary branch:

```text
main
```

Development happens through short-lived branches.

Example:

```text
feat/arranger-clips
feat/piano-roll-selection
fix/clip-resize-snap
refactor/timeline-geometry
```

Do not maintain permanent:

```text
develop
staging
release
```

branches unless the deployment architecture later creates a real need.

Keep branches short-lived and merge frequently.

---

# Commit Discipline

Commits should be:

```text
small
focused
buildable
understandable
```

Prefer Conventional Commit-style messages:

```text
feat: add timeline coordinate system
feat: implement clip resize handles
fix: preserve loop offset when trimming clip
refactor: share snapping logic with piano roll
test: cover multi-note resizing
chore: update dependencies
```

Do not install commitlint or Husky initially just to enforce this convention.

Developer discipline is preferable to additional tooling until automation provides meaningful value.

---

# Pull Requests

Changes to `main` should normally arrive through pull requests.

Each PR should:

```text
have a focused purpose
pass CI
avoid unrelated refactoring
include tests for domain behavior
update documentation when architecture changes
```

Large features should be split into independently reviewable changes.

---

# Continuous Integration

Create GitHub Actions CI immediately.

Every pull request and push to `main` should run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Where:

```text
check     = formatting + lint validation
typecheck = TypeScript without emitting
test      = Vitest
build     = Vite production build
```

A PR should not be mergeable when one of these fails.

Do not duplicate commands between developer workflow and CI.

CI must call the same package scripts developers use locally.

---

# Required package scripts

Keep scripts predictable.

Example:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "biome check .",
    "check:fix": "biome check --write ."
  }
}
```

Adjust commands where required by the latest stable tooling.

There should be one canonical command for each operation.

---

# Dependency Updates

Configure GitHub Dependabot.

Dependency updates should be proposed automatically rather than performed manually and forgotten.

Configure automated checks for:

```text
pnpm dependencies
GitHub Actions
```

Prefer grouped minor/patch upgrades where sensible.

Major upgrades should receive individual review when they can introduce meaningful migration work.

Every dependency-update PR must run the complete CI suite.

Do not automatically merge major dependency upgrades.

---

# Latest Dependency Policy

When adding a new dependency:

```bash
pnpm add <package>@latest
```

or:

```bash
pnpm add -D <package>@latest
```

unless there is a documented compatibility reason not to.

Before adding it:

1. verify the package is maintained
2. verify the latest stable version
3. inspect its dependency footprint
4. verify browser/runtime compatibility
5. determine whether existing code can solve the requirement
6. avoid redundant libraries

The lockfile is the source of reproducibility.

Do not intentionally start a new project using old dependencies merely because older tutorials use them.

---

# Dependency Removal

Regularly remove unused dependencies.

A dependency that no longer provides value should be deleted rather than retained indefinitely.

When replacing a package, remove:

```text
dependency
configuration
unused types
obsolete utilities
obsolete scripts
obsolete documentation
```

in the same change whenever practical.

---

# Security and Supply Chain

Keep dependencies minimal partly to reduce supply-chain exposure.

Commit the lockfile.

Use frozen lockfile installs in CI.

Do not execute arbitrary installation scripts or add packages merely to save a handful of lines of code.

GitHub dependency/security alerts should remain enabled.

Do not commit:

```text
API keys
tokens
passwords
private certificates
.env files containing secrets
```

Provide:

```text
.env.example
```

when configuration becomes necessary.

---

# GitOps Principles

Treat Git as the source of truth.

Anything required to:

```text
build
test
deploy
configure
reproduce
```

the application should live in version control unless it is a secret.

Do not rely on undocumented manual setup.

When deployment is introduced:

```text
deployment configuration is stored in Git
environment configuration is declarative
production changes originate from reviewed Git changes
CI/CD performs deployment
manual server changes are avoided
```

Do not introduce Kubernetes, Helm, Terraform, or other infrastructure tools before actual infrastructure requirements exist.

GitOps is a workflow principle, not justification for unnecessary infrastructure.

---

# Documentation

Maintain a concise:

```text
README.md
```

containing:

```text
purpose
requirements
setup
development commands
testing
build instructions
architecture overview
```

Also maintain:

```text
docs/architecture.md
```

when architecture becomes too detailed for README.

Architectural decisions that constrain future work should be documented.

Examples:

```text
why musical time uses ticks
why clip geometry is derived
why project and editor state are separate
why commands mediate mutations
why Canvas is used for waveforms
```

Avoid documentation that simply repeats obvious code.

---

# Coding Agent Rules

When using an AI coding agent, the agent must:

1. inspect the existing architecture before modifying code
2. reuse existing primitives before creating new ones
3. avoid adding dependencies unless clearly justified
4. use the latest stable dependency versions when additions are necessary
5. never silently downgrade dependencies
6. preserve strict TypeScript
7. avoid `any`
8. add or update tests for domain behavior
9. run formatting/linting
10. run type checking
11. run tests
12. run the production build
13. report failures instead of hiding them
14. avoid unrelated refactors
15. keep changes focused
16. preserve existing public APIs unless intentionally changing them
17. update architecture documentation when introducing important abstractions

Before installing a dependency, the agent should explicitly answer internally:

```text
Can this be implemented cleanly using the platform or existing project code?
```

If yes, do not add the dependency.

---

# Definition of Done

A feature is complete only when:

```text
implementation works
types pass
lint/check passes
tests pass
production build passes
relevant behavior is tested
existing reusable architecture is respected
new reusable logic is extracted where appropriate
no unnecessary dependency was introduced
no debug code remains
documentation is updated where necessary
```

Visual appearance alone does not make a feature complete.

---

# Development Philosophy

Prefer:

```text
boring infrastructure
interesting product code
```

We are building a complex editor.

Complexity should come from the DAW interaction model, not from unnecessary framework layers, libraries, build systems, or architectural abstractions.

The ideal dependency graph is small.

The ideal core editor logic is mostly framework-independent TypeScript.

The ideal React layer is compositional and thin.

The ideal interaction primitives are reusable between:

```text
arranger
piano roll
automation
future timeline editors
```

Build foundations carefully, then build features incrementally.


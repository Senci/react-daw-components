# React DAW Components

High-performance, reusable React + TypeScript UI framework for DAW-style editors inspired by Bitwig Studio.

## Features (Planned)

- Arranger/Project view
- Tracks with MIDI and audio clips
- Clip moving, resizing, trimming, looping
- Track automation lanes
- Piano roll with MIDI note editing
- Timeline ruler with playhead
- Selection and snapping
- Zooming and scrolling

## Architecture

- **Core domain logic** (`src/core/`) - Framework-independent TypeScript
- **Editor systems** (`src/editor/`) - Interaction, viewport, state
- **Components** (`src/components/`) - Composable React components
- **Rendering** (`src/rendering/`) - Canvas/SVG/DOM rendering primitives

## Tech Stack

- React 18 + TypeScript (strict mode)
- Vite for building
- pnpm for package management
- Biome for linting/formatting
- Vitest for unit testing
- Storybook for component documentation

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Run linter
pnpm check

# Build for production
pnpm build

# Start Storybook
pnpm storybook
```

## Project Structure

```
src/
  app/                    # Application entry points
  core/
    model/               # Domain models (tracks, clips, notes)
    time/                # Musical time (ticks, PPQ, conversions)
    commands/            # Editor commands (move, resize, create)
    history/             # Undo/redo system
    selection/           # Selection model
    snapping/            # Snap engine
    geometry/            # Coordinate conversions
  editor/
    interactions/        # Pointer/keyboard interaction sessions
    viewport/            # Viewport management
    state/               # Transient editor state
  components/
    arranger/            # Arranger view components
    clips/               # Clip components (MIDI, audio)
    automation/          # Automation lane components
    piano-roll/          # Piano roll components
    timeline/            # Timeline ruler, playhead
    controls/            # Shared UI controls
  rendering/
    grid/                # Grid rendering
    midi/                # MIDI note rendering
    waveform/            # Audio waveform rendering
    automation/          # Automation curve rendering
  styles/                # Global styles, design tokens
  test/                  # Test utilities
```

## License

MIT

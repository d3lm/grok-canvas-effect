# Grok Canvas Effect

A reverse-engineered recreation of the interactive WebGL text effect found on [x.ai](https://x.ai/). Move your cursor around to see particles trail and react to your movement.

This project also includes a **texture generator** so you can swap in your own text and tweak a bunch of parameters to produce a custom version of the effect.

**[Live Demo](https://d3lm.github.io/grok-canvas-effect/)**

## How it works

The original effect renders text into a special multi-channel texture where each RGBA channel encodes different data:

| Channel   | Purpose                         |
| --------- | ------------------------------- |
| **Red**   | Horizontal direction (normal X) |
| **Green** | Vertical direction (normal Y)   |
| **Blue**  | Blur / glow intensity           |
| **Alpha** | Text shape mask                 |

Two WebGL shader passes run every frame:

1. The **trail pass** simulates particles that flow along the direction field encoded in the texture, with mouse interaction pushing them around. A ping-pong framebuffer accumulates trails over time.

2. The **main pass**: composites the trail buffer with noise and the logo texture to produce the final output.

Quality is automatically adapted based on framerate so it stays smooth on lower-end hardware.

## Generator

Click the "Generator" button in the top-right corner of the demo to open the texture generator. It lets you:

- Type any text and see it rendered in real time
- Pick any Google Font, weight, and size
- Adjust letter spacing, edge sharpness, and softness
- Control the direction field strength
- Edit alpha gradients with visual drag handles
- Tune the blue channel blur radii
- Preview the live WebGL effect side-by-side
- Download the packed texture at multiple resolutions

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
pnpm build
```

## License

MIT

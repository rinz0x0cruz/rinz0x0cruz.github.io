# 3D model assets

The four achievement models are derived from Poly Haven assets released under
[CC0 1.0](https://polyhaven.com/license). Attribution is not required, but the
source records are retained here for provenance.

| Local asset | Poly Haven source | Author |
| --- | --- | --- |
| `industrial_microscope/industrial_microscope.glb` | [Industrial Microscope](https://polyhaven.com/a/industrial_microscope) | Lukas Walzer |
| `retro_multimeter/retro_multimeter.glb` | [Retro Multimeter](https://polyhaven.com/a/retro_multimeter) | elli moeller |
| `signal_flashlight/signal_flashlight.glb` | [Signal Flashlight](https://polyhaven.com/a/signal_flashlight) | Jiri Ptacek |
| `vintage_spacecraft_instrument/vintage_spacecraft_instrument.glb` | [Vintage Spacecraft Instrument](https://polyhaven.com/a/vintage_spacecraft_instrument) | Michal Wisniewski |

The source glTF geometry was stripped of textures and materials, pruned, and
compressed with Meshopt using glTF Transform 4.2.1. The site applies its shared
black-chrome material at runtime.

## Portfolio artifact assets

These models are adapted from Sketchfab downloads licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

| Local asset | Sketchfab source | Author |
| --- | --- | --- |
| `artifacts/helios.glb` | [Helios statue](https://sketchfab.com/3d-models/helios-statue-48a564cc64554bb9961eaad5216d2f2e) | [kolen](https://sketchfab.com/kolen) |

The Helios asset restores the source model's fractured classical face around
its skull reverse. The skull retains its downloaded coordinates, scale, and
depth. The cracked frame is enlarged 12% around its own centre so the stone
fragments clearly surround and physically occlude the skull without a mask or
flattened overlay. At runtime the skull receives a gold
metallic PBR material while the frame remains rough pale stone, and the complete
assembly rests at an inward-facing 29-degree yaw. The asset is pruned, quantized,
and compressed with Meshopt using obj2gltf 3.2.0 and glTF Transform 4.4.2;
Helios mesh joining stays disabled so the skull and frame remain independently
shaded. Matching WebP renders provide static fallbacks.

## Runtime contract

- Every model is decorative enhancement. Required information must remain in
	HTML and static artwork.
- Achievement models load only when the outcomes section enters the viewport.
- Helios is scheduled after the initial document completes, using browser idle
	time when available and a bounded timer fallback otherwise. Sun and Moon load
	near their owning sections.
- Reduced-data mode skips all model, texture, and Three.js payloads.
	Forced-colors mode hides the decorative renderers. Reduced motion keeps a
	static render.
- A failed model or WebGL initialization must leave its static fallback visible.
- Helios uses `artifacts/helios.webp`; the Sun and Moon use the responsive
	`/tarot-sun*.webp` and `/tarot-moon*.webp` fallbacks in `public/`.

Runtime tarot relief files live in `tarot/`. Repository history records their
implementation but no external source or licence metadata, so this document
does not assert an origin. Do not replace or redistribute those files without
recording verifiable provenance and licence terms here.

## Replacing a model

1. Confirm the source licence permits redistribution and adaptation.
2. Add the source URL, author, licence, processing tools, and material changes
   to this README before adding the binary.
3. Keep geometry and texture transfer bounded; retain Meshopt compression when
   the loader depends on it.
4. Add or update a correctly framed static fallback that works without WebGL.
5. Preserve model and fallback paths in the owning content/component record.
6. Run `npm run build`, the relevant browser test, and then `npm test`.

Do not commit source downloads, tool caches, or undocumented intermediate
exports. `public/models/` contains only the optimized runtime artifact and the
provenance needed to maintain it.

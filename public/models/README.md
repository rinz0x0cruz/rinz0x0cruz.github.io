# Achievement instrument assets

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
| `artifacts/fragmentary-head.glb` | [Fragmentary colossal marble head of youth](https://sketchfab.com/3d-models/fragmentary-colossal-marble-head-of-youth-acc071ea2c3b4938b9460510037a50eb) | [enauman](https://sketchfab.com/enauman) |

The Helios asset restores the source model's fractured classical face around
its skull reverse. The skull retains its downloaded coordinates, scale, and
depth. The cracked frame is enlarged 12% around its own centre so the stone
fragments clearly surround and physically occlude the skull without a mask or
flattened overlay. At runtime the skull receives a gold
metallic PBR material while the frame remains rough pale stone, and the complete
assembly rests at an inward-facing 29-degree yaw. The fragmentary head retains
the downloaded unsimplified geometry with 2048px diffuse and normal maps. It is
oriented to its lower-face view and placed with a beveled bronze frame and dark
backing inside the same interactive 3D pivot. Both assets are pruned, quantized,
and compressed with Meshopt using obj2gltf 3.2.0 and glTF Transform 4.4.2;
Helios mesh joining stays disabled so the skull and frame remain independently
shaded. Matching WebP renders provide static fallbacks.

# /public/models/

Place your GLB car models here so the app can load them at runtime.

## Required file

| File | Used by |
|---|---|
| `bmw_m3.glb` | MapView — primary user car marker |

## How to get the model

1. Download a free BMW M3 GLB from [Sketchfab](https://sketchfab.com/search?q=bmw+m3&type=models&features=downloadable) or any other source.
2. Export / convert to **GLB** format (binary glTF).
3. Drop the file here as `bmw_m3.glb`.

## Scale

The loader applies `group.scale.setScalar(0.3)` after loading.  
If the car is too big or too small, adjust the constant `CAR_SCALE` near the top of `src/components/streetgrid/MapView.tsx`.

## Fallback

If `bmw_m3.glb` is not found, the app automatically renders a procedural
Box + Cylinder car so the map is never empty.

## Forward axis convention

The transform assumes **−Z is forward** (standard glTF).  
If the car faces sideways or backwards, negate the heading in `makeCarLayer`:
```ts
// In makeCarLayer render():
const Ry = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), headingRad); // remove the −
```

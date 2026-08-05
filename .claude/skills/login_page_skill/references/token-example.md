# Starting tokens — Spend App Login Page

Treat these as a first draft to critique and adapt per the frontend-design process, not a final answer. Revise anything that reads as a generic template default for the user's actual brief.

## Color (example — verify against the rest of the app if it exists)
- `--bg-deep`: #0B0F14 (near-black base behind the 3D scene)
- `--bg-card`: rgba(255,255,255,0.06) (glass card fill, use with backdrop-blur)
- `--accent-gold`: #D4AF37 (coin/currency accent — use sparingly, on the signature element and CTA)
- `--text-primary`: #F5F3EE
- `--text-muted`: #9A9C9F
- `--border-hair`: rgba(255,255,255,0.12)

## Type
- Display (locked username label, headline): a confident serif or slab (e.g. "Fraunces" or "Söhne" class) — finance-premium, not techy
- Body/UI (password label, buttons, helper text): a clean grotesk (e.g. "Inter" or "Söhne")
- Numeric/utility (if any amounts ever show near the login, e.g. "last synced"): tabular-figure mono

## Layout (ASCII)
```
┌──────────────────────────────────────────┐
│   [ animated 3D coin field, full bleed ]  │
│                                            │
│         ┌────────────────────┐            │
│         │  🔒 Tarun Yadav     │            │
│         │  ──────────────    │            │
│         │  Password  [ 👁 ]   │            │
│         │  [   Sign in   ]   │            │
│         └────────────────────┘            │
│                                            │
└──────────────────────────────────────────┘
```

## Minimal three.js particle field (r128, adapt don't paste verbatim)

```jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";

function CoinField() {
  const mountRef = useRef(null);

  useEffect(() => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Coins as thin gold cylinders instead of a real coin model
    const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.06, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 });

    const coins = Array.from({ length: 40 }, () => {
      const coin = new THREE.Mesh(geometry, material);
      coin.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8
      );
      coin.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      scene.add(coin);
      return coin;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const point = new THREE.PointLight(0xffffff, 1);
    point.position.set(5, 5, 10);
    scene.add(point);

    let frameId;
    const animate = () => {
      coins.forEach((coin, i) => {
        coin.rotation.x += 0.002 + i * 0.00002;
        coin.rotation.y += 0.003;
        coin.position.y += Math.sin(Date.now() * 0.0005 + i) * 0.001;
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
```

Respect `prefers-reduced-motion`: check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and either skip the `animate` loop (render one static frame) or drastically slow the rotation increments.

## Demo auth pattern (client-side only — say this explicitly to the user)

```jsx
// DEMO ONLY: not real authentication. Any real gate needs a backend.
const handleSubmit = (password) => {
  if (password.trim().length > 0) {
    onLoginSuccess(); // placeholder — wire up to real auth if/when a backend exists
  } else {
    setError("Enter your password");
  }
};
```
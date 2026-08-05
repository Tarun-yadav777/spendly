// login.js — vault coin-field background + password show/hide toggle for /login

(function () {
    const canvas = document.getElementById("vault-canvas");
    if (!canvas || typeof THREE === "undefined") return;

    const container = canvas.parentElement;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 11;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    scene.add(new THREE.AmbientLight(0xfff4e0, 0.7));
    const keyLight = new THREE.PointLight(0xffe3b0, 1.1);
    keyLight.position.set(6, 8, 10);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x2f6b46, 0.5);
    rimLight.position.set(-8, -4, -6);
    scene.add(rimLight);

    const field = new THREE.Group();
    scene.add(field);

    const coinGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 32);
    const coinMaterial = new THREE.MeshStandardMaterial({
        color: 0xc17f24,
        metalness: 0.65,
        roughness: 0.32,
    });

    function makeGlyphTexture() {
        const size = 128;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        ctx.font = '700 84px "DM Serif Display", Georgia, serif';
        ctx.fillStyle = "rgba(253, 243, 227, 0.92)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("€", size / 2, size / 2 + 6);
        return new THREE.CanvasTexture(c);
    }

    const glyphMaterial = new THREE.SpriteMaterial({
        map: makeGlyphTexture(),
        transparent: true,
        opacity: 0.85,
    });

    const particles = [];

    function placeRandom(obj) {
        obj.position.set(
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 9,
            (Math.random() - 0.5) * 7 - 1
        );
        obj.userData.baseY = obj.position.y;
    }

    const COIN_COUNT = 18;
    const GLYPH_COUNT = 10;

    for (let i = 0; i < COIN_COUNT; i++) {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        placeRandom(coin);
        coin.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        field.add(coin);
        particles.push({
            mesh: coin,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.4,
            spin: (Math.random() - 0.5) * 0.006,
        });
    }

    for (let i = 0; i < GLYPH_COUNT; i++) {
        const sprite = new THREE.Sprite(glyphMaterial);
        sprite.scale.set(0.9, 0.9, 0.9);
        placeRandom(sprite);
        field.add(sprite);
        particles.push({
            mesh: sprite,
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.3,
            spin: 0,
        });
    }

    let targetRotX = 0;
    let targetRotY = 0;

    if (!prefersReducedMotion) {
        window.addEventListener("mousemove", (e) => {
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            targetRotY = nx * 0.18;
            targetRotX = ny * 0.1;
        });
    }

    window.addEventListener("resize", () => {
        width = container.clientWidth;
        height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    function renderFrame(time) {
        if (!prefersReducedMotion) {
            const t = time * 0.001;
            particles.forEach((p) => {
                p.mesh.position.y = p.mesh.userData.baseY + Math.sin(t * p.speed + p.phase) * 0.35;
                if (p.spin) {
                    p.mesh.rotation.x += p.spin;
                    p.mesh.rotation.y += p.spin * 1.4;
                }
            });
            field.rotation.y += (targetRotY - field.rotation.y) * 0.04;
            field.rotation.x += (targetRotX - field.rotation.x) * 0.04;
        }
        renderer.render(scene, camera);
        if (!prefersReducedMotion) requestAnimationFrame(renderFrame);
    }

    if (prefersReducedMotion) {
        renderFrame(0);
    } else {
        requestAnimationFrame(renderFrame);
    }

    const toggle = document.getElementById("password-toggle");
    const passwordInput = document.getElementById("password");
    if (toggle && passwordInput) {
        const eyeIcon = toggle.querySelector(".icon-eye");
        const eyeOffIcon = toggle.querySelector(".icon-eye-off");
        toggle.addEventListener("click", () => {
            const showing = passwordInput.type === "password";
            passwordInput.type = showing ? "text" : "password";
            eyeIcon.hidden = showing;
            eyeOffIcon.hidden = !showing;
            toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
        });
    }
})();

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import TrackballControls from 'app/lib/three/oldTrackballControls';
import { HeightmapData } from '../definitions';

interface Props {
    data: HeightmapData;
    className?: string;
}

/** Min / max of the probed (non-null) offsets. */
function zRange(data: HeightmapData): [number, number] {
    let min = Infinity, max = -Infinity;
    for (const v of data.z) {
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    if (!Number.isFinite(min)) { min = 0; max = 0; }
    return [min, max];
}

/**
 * Standalone three.js surface view of a probed heightmap. Builds a grid mesh,
 * displaces each vertex by its probed Z offset (exaggerated for visibility) and
 * colors it blue→red by height. Orbit with the mouse (TrackballControls).
 */
const HeightmapView: React.FC<Props> = ({ data, className }) => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const width = mount.clientWidth || 480;
        const height = mount.clientHeight || 320;

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        mount.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.up.set(0, 0, 1); // CNC Z-up

        // Grid geometry -------------------------------------------------------
        const { cols, rows, originX, originY, stepX, stepY } = data;
        const spanX = stepX * (cols - 1) || 1;
        const spanY = stepY * (rows - 1) || 1;
        const diag = Math.hypot(spanX, spanY);
        const [zMin, zMax] = zRange(data);
        const zSpan = zMax - zMin;
        // Exaggerate relief so a sub-mm warp is visible: map the z-span to ~15% of the diagonal.
        const zScale = zSpan > 1e-6 ? (diag * 0.15) / zSpan : 0;

        const positions: number[] = [];
        const colors: number[] = [];
        const color = new THREE.Color();
        const zAt = (c: number, r: number) => data.z[r * cols + c];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = zAt(c, r);
                const z = v == null ? 0 : (v - zMin) * zScale;
                positions.push(originX + c * stepX, originY + r * stepY, z);
                const t = zSpan > 1e-6 && v != null ? (v - zMin) / zSpan : 0.5;
                color.setHSL((1 - t) * 0.66, 0.95, 0.5); // blue(low) → red(high)
                colors.push(color.r, color.g, color.b);
            }
        }

        const indices: number[] = [];
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols - 1; c++) {
                // Skip cells touching a non-probed (null) corner.
                if (zAt(c, r) == null || zAt(c + 1, r) == null || zAt(c, r + 1) == null || zAt(c + 1, r + 1) == null) continue;
                const a = r * cols + c;
                const b = r * cols + (c + 1);
                const d = (r + 1) * cols + c;
                const e = (r + 1) * cols + (c + 1);
                indices.push(a, b, d, b, e, d);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true, side: THREE.DoubleSide, metalness: 0, roughness: 0.85, flatShading: false,
        });
        const surface = new THREE.Mesh(geometry, material);
        scene.add(surface);

        const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }),
        );
        scene.add(wire);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(spanX, -spanY, diag);
        scene.add(dir);

        // Camera framing ------------------------------------------------------
        const cx = originX + spanX / 2;
        const cy = originY + spanY / 2;
        const target = new THREE.Vector3(cx, cy, 0);
        camera.position.set(cx + diag * 0.4, cy - diag * 0.9, diag * 0.8);
        camera.lookAt(target);

        const controls = new TrackballControls(camera, renderer.domElement);
        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.5;
        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;
        controls.target = target;

        let raf = 0;
        const animate = () => {
            raf = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
            const w = mount.clientWidth || width;
            const h = mount.clientHeight || height;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            controls.handleResize?.();
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(mount);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            controls.dispose?.();
            geometry.dispose();
            material.dispose();
            (wire.geometry as THREE.BufferGeometry).dispose();
            (wire.material as THREE.Material).dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
    }, [data]);

    const [zMin, zMax] = zRange(data);
    return (
        <div className={className}>
            <div ref={mountRef} className="w-full h-72 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800" />
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(240,95%,50%)' }} /> low {zMin.toFixed(3)} mm</span>
                <span>drag to orbit · scroll to zoom</span>
                <span className="flex items-center gap-1">high {zMax.toFixed(3)} mm <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(0,95%,50%)' }} /></span>
            </div>
        </div>
    );
};

export default HeightmapView;

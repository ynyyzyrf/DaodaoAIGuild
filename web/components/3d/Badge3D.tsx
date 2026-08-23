"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

interface Badge3DProps {
  /** GLB 资源路径（已用 EXT_meshopt_compression 压缩，loader 内已注册解码器） */
  modelUrl: string;
  /** 锁定态：关闭旋转/缩放交互（只做展示） */
  interactive?: boolean;
  /** 锁定态置灰（CSS filter grayscale） */
  dim?: boolean;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Badge3D —— 徽章墙用的轻量 3D 查看器。
 *
 * 与 LobsterKnight3D 的差异（页面要同时放 10 个，必须省）：
 * - 完全懒初始化：IntersectionObserver 首次进入视口才建 WebGL + 加载 GLB
 * - **离开视口即释放 WebGL context 与 GPU 资源**（不是只暂停渲染）：
 *   否则 10 个 badge context 常驻 + 骑士的大 context，GPU 记忆体被挤爆时
 *   浏览器会先回收骑士的 context/贴图 → 骑士渲染成黑色。
 *   回到视口再重建（GLB 走浏览器 HTTP 缓存，重建很快）。
 * - 无阴影、low-power renderer、pixelRatio 上限 1（徽章体积小，视觉无损，GPU 省 ~2.25×）
 * - 透明背景，底色由父卡片提供
 * - 已注册 meshopt decoder（压缩后的 GLB 是 EXT_meshopt_compression）
 */
export default function Badge3D({
  modelUrl,
  interactive = true,
  dim = false,
  className = "",
  fallback,
}: Badge3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // mountRef.current 在 effect 运行时必非 null（JSX 已挂载），用 ! 断言让闭包内类型保持非空
    const container = mountRef.current!;
    if (!container) return;

    // 每个 generation 对应一次完整的 init/dispose 周期。
    // release() 递增 generation，使上一代正在进行的 GLB 加载回调作废。
    let generation = 0;

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObs: ResizeObserver | null = null;
    let scene!: THREE.Scene;
    let camera!: THREE.PerspectiveCamera;
    let characterRoot!: THREE.Group;
    let visible = false;
    let disposed = false;
    let boundingRadius = 0.5;
    let userInteracting = false;
    let resumeAutoAt = 0;
    let animationId = 0;
    // context 遺失後自動重建的計數/計時（上限 3 次，避免 GPU 壓力下無限抖動）
    let retryCount = 0;
    let retryTimer = 0;
    const disposeFns: (() => void)[] = [];

    // 释放当前 generation 的全部 GPU 资源（context、贴图、几何、监听器）。
    // 幂等；供「滚出视口」和「组件卸载」共用。
    function release() {
      generation++;
      clearTimeout(retryTimer);
      disposeFns.splice(0).forEach((fn) => {
        try {
          fn();
        } catch {
          // 清理期间 WebGL context 已丢失时 dispose 可能抛错，忽略即可
        }
      });
      renderer = null;
      controls = null;
      resizeObs = null;
      boundingRadius = 0.5;
      animationId = 0;
    }

    // 渲染循环：renderer 已被 release 置空时停止（不再自调度）。
    function render() {
      if (disposed || !renderer) return;
      animationId = requestAnimationFrame(render);
      if (!visible) return;
      if (!userInteracting && resumeAutoAt > 0 && performance.now() > resumeAutoAt && controls) {
        controls.autoRotate = true;
        resumeAutoAt = 0;
      }
      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    // 懒初始化：首次进入视口才执行；每次 re-enter 都会重建
    function start() {
      if (disposed || renderer) return;
      const gen = generation;

      // WebGL 探测（提前失败就降级到 emoji fallback）
      try {
        const probe = document.createElement("canvas");
        const gl =
          probe.getContext("webgl2") ||
          probe.getContext("webgl") ||
          probe.getContext("experimental-webgl");
        if (!gl) {
          setFailed(true);
          return;
        }
      } catch {
        setFailed(true);
        return;
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // context 丢失（通常是 GPU 记忆体被挤爆时浏览器回收）→ 释放本 badge 的 GPU 资源
      // 并降级 emoji（而不是黑方块）；滚出/滚回视口时 start() 会自动重建。
      const onContextLost = (event: Event) => {
        event.preventDefault();
        release();
        setFailed(true);
        // 自動重建：GPU 壓力高峰通常是瞬時的，1.5s 後重試一次（上限 3 次），
        // 免去「滾出再滾回」的手動恢復；超過上限就維持 emoji，等下次進入視口重新給滿。
        retryCount += 1;
        if (retryCount <= 3) {
          clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            if (disposed || gen !== generation) return;
            setFailed(false);
            start();
          }, 1500);
        }
      };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);

      // IBL（RoomEnvironment 与骑士页一致，金属/粗糙度表现稳定）
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.8);
      key.position.set(2, 2.5, 3);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xfff0e6, 0.6);
      fill.position.set(-2, 1, 1.5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.7);
      rim.position.set(0, 1.5, -3);
      scene.add(rim);

      // 模型挂载点（始终在原点，相机负责 framing）
      characterRoot = new THREE.Group();
      scene.add(characterRoot);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.enableZoom = interactive;
      controls.autoRotate = interactive;
      controls.autoRotateSpeed = 1.2;
      controls.minPolarAngle = Math.PI * 0.25;
      controls.maxPolarAngle = Math.PI * 0.75;
      controls.target.set(0, 0, 0);
      if (interactive) {
        controls.addEventListener("start", () => {
          userInteracting = true;
          controls!.autoRotate = false;
        });
        controls.addEventListener("end", () => {
          userInteracting = false;
          resumeAutoAt = performance.now() + 1200;
        });
      }

      // 加载 GLB
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        modelUrl,
        (gltf) => {
          // 已被 release / 卸载作废的加载结果直接丢弃
          if (disposed || gen !== generation) return;
          const model = gltf.scene;
          characterRoot.add(model);
          model.updateMatrixWorld(true);

          // 归一化到原点（Tripo 模型往往带世界偏移）
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.x -= center.x;
          model.position.y -= center.y;
          model.position.z -= center.z;
          model.updateMatrixWorld(true);

          const sphere = new THREE.Sphere();
          new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);
          boundingRadius = sphere.radius || 0.5;

          // Tripo 常见问题：法线方向错误 / 背面剔除。重算法线 + 强制双面。
          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            if (mesh.geometry) mesh.geometry.computeVertexNormals();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (!m) return;
              m.side = THREE.DoubleSide;
              m.needsUpdate = true;
            });
          });

          retryCount = 0; // 成功載入一次模型：重試額度歸零
          setFailed(false);
          fitCamera();
        },
        undefined,
        () => {
          if (!disposed && gen === generation) setFailed(true);
        },
      );

      resizeObs = new ResizeObserver(() => fitCamera());
      resizeObs.observe(container);

      // 本 generation 的释放清单：render 循环、context、canvas、场景资源
      disposeFns.push(() => {
        cancelAnimationFrame(animationId);
        renderer?.domElement.removeEventListener("webglcontextlost", onContextLost);
        renderer?.dispose();
        if (renderer?.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        scene?.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        });
        const env = scene?.environment as THREE.Texture | undefined;
        env?.dispose();
        resizeObs?.disconnect();
      });

      fitCamera();
      render();
    }

    // BoundingSphere fit（徽章形状各异，球体包围对旋转最稳）
    function fitCamera() {
      if (!renderer || !controls) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      if (boundingRadius <= 0) {
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
      }

      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const distance = boundingRadius / Math.sin(Math.min(vFov, hFov) / 2);
      const safeDistance = distance * 0.9;
      camera.position.set(0, 0, safeDistance);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.minDistance = safeDistance * 0.7;
      controls.maxDistance = safeDistance * 1.6;
      controls.update();
    }

    // 懒加载 + 离开视口释放 context
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible = true;
            start();
          } else {
            visible = false;
            retryCount = 0; // 滾出視口重置重試額度，下次進入重新給滿 3 次
            release();
          }
        }
      },
      { rootMargin: "150px 0px" },
    );
    obs.observe(container);

    return () => {
      disposed = true;
      obs.disconnect();
      release();
    };
  }, [modelUrl, interactive]);

  return (
    <div
      ref={mountRef}
      className={`relative h-full w-full overflow-hidden ${dim ? "grayscale" : ""} ${className}`}
      aria-label="徽章 3D 展示"
      role="img"
    >
      {failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {fallback ?? <span className="text-2xl">🏅</span>}
        </div>
      )}
    </div>
  );
}

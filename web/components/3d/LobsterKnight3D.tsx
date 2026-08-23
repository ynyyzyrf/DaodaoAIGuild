"use client";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useEffect, useRef, useState } from "react";

/**
 * LobsterKnight3D —— 自动 framing Three.js GLB loader
 *
 * 设计原则:
 * 1. 归一化模型本身(移到原点),不靠相机偏移去"拉回"角色
 * 2. scene.characterRoot 永远 position (0,0,0),后续动画/装备都操作它
 * 3. fit 用 BoundingSphere(适合旋转物体,任意角度都不会裁)
 * 4. ResizeObserver 监听容器,不用 window.resize
 * 5. canvas CSS 由父容器控制,组件内不写死尺寸
 */

interface LobsterKnight3DProps {
  className?: string;
  fallback?: React.ReactNode;
  modelUrl?: string;
}

export default function LobsterKnight3D({
  className = "",
  fallback,
  modelUrl = "/models/lobster-knight.glb",
}: LobsterKnight3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [glFailed, setGlFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // context 丢失时 bump，触发 effect 重跑 → 整个 renderer/scene 重建
  const [contextEpoch, setContextEpoch] = useState(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || glFailed) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationId = 0;
    let resizeObs: ResizeObserver | null = null;
    let controls: OrbitControls | null = null;
    let characterRoot: THREE.Group | null = null;
    let boundingRadius = 0.5;
    let userInteracting = false;
    let resumeAutoAt = 0;
    const disposeFns: (() => void)[] = [];

    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      if (!gl) {
        setGlFailed(true);
        return;
      }
    } catch {
      setGlFailed(true);
      return;
    }

    let disposed = false;

    // ---- 初始化 scene/camera/controls ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F7F5F1");

    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 显式关闭局部裁剪，确保模型不会被任何意外 clippingPlanes 切掉
    renderer.localClippingEnabled = false;
    renderer.clippingPlanes = [];
    container.appendChild(renderer.domElement);

    // context 丢失防护：GPU 记忆体不足 / GPU 进程重启时浏览器会回收 WebGL context。
    // 不处理的话 canvas 会一直黑（这就是「模型突然变黑」的直接原因）。
    // preventDefault 保留浏览器恢复可能；bump epoch 让本 effect 重跑、整体重建。
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setContextEpoch((e) => e + 1);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);

    // IBL
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(2, 3, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -1;
    keyLight.shadow.camera.right = 1;
    keyLight.shadow.camera.top = 1;
    keyLight.shadow.camera.bottom = -1;
    keyLight.shadow.bias = -0.0008;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xfff0e6, 0.6);
    fillLight.position.set(-2, 1, 1);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // Pedestal(只渲染一次,放在原点附近)
    // y 必须用 -boundingRadius - margin 定位到模型脚底下方,
    // 否则圆盘会横穿模型腰部,渲出来就是一条贯穿画面的水平亮带。
    // 这里 boundingRadius 还是默认值 0.5;模型加载完后会再用真实值校准。
    const groundGeo = new THREE.CircleGeometry(0.6, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xefeee8,
      roughness: 0.7,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -boundingRadius - 0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    // characterRoot — 永远在 (0,0,0),所有变换都做在它身上
    characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // ---- OrbitControls ----
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.minPolarAngle = Math.PI * 0.30;
    controls.maxPolarAngle = Math.PI * 0.70;
    controls.target.set(0, 0, 0);

    // 用户开始拖动时关掉 autoRotate,松手 1.2s 后再恢复
    controls.addEventListener("start", () => {
      userInteracting = true;
      controls!.autoRotate = false;
    });
    controls.addEventListener("end", () => {
      userInteracting = false;
      resumeAutoAt = performance.now() + 1200;
    });

    // ---- 加载 GLB ----
    const loader = new GLTFLoader();
    // 骑士 GLB 已用 EXT_meshopt_compression 压缩（57MB → ~5MB，消除 context
    // 重建/页面加载的 GPU 高峰）。必须注册 meshopt decoder，否则压缩缓冲无法解码。
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        // step 1: 加进 characterRoot,刷新 world matrix,算原始 bbox
        characterRoot!.add(model);
        characterRoot!.updateMatrixWorld(true);
        model.updateMatrixWorld(true);

        const originalBox = new THREE.Box3().setFromObject(model);
        const originalCenter = originalBox.getCenter(new THREE.Vector3());

        // step 2: 把 model 自身归一化(移到 characterRoot 局部原点)
        // 长矛在左、身体在右 → 平移后模型中心 ≈ (0,0,0)
        model.position.x -= originalCenter.x;
        model.position.y -= originalCenter.y;
        model.position.z -= originalCenter.z;
        model.updateMatrixWorld(true);

        // step 3: 验证归一化
        const normalizedBox = new THREE.Box3().setFromObject(model);
        const normalizedCenter = normalizedBox.getCenter(new THREE.Vector3());
        const normalizedSize = normalizedBox.getSize(new THREE.Vector3());

        // step 4: 微调 Y 视觉(只在 ±0.05 × radius 范围)
        const sphere = new THREE.Sphere();
        normalizedBox.getBoundingSphere(sphere);
        boundingRadius = sphere.radius;
        characterRoot!.position.y = -boundingRadius * 0.03;
        characterRoot!.updateMatrixWorld(true);
        // 地面用真实的 boundingRadius 校准到模型脚底正下方
        ground.position.y = -boundingRadius - 0.02;

        // step 5: 阴影 + 修复 Tripo GLB 常见的法线 / 背面剔除问题
        // 症状：自动旋转时腿 / 尾 / 腹部某些角度消失（被 Backface Culling 剔了反面）
        // 做法：每个 mesh 重新计算法线（不改拓扑）+ 材质强制 DoubleSide
        // 注意：不调 mergeVertices / 不改相机距离 / 不动态改 mesh.visible
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;

          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // 重新计算顶点法线（处理 Tripo 导出时法线方向错误 / 缺失）
          // 只算 normals，不动 topology，不调用 mergeVertices
          if (mesh.geometry) {
            mesh.geometry.computeVertexNormals();
          }

          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach((material) => {
            if (!material) return;
            // 强制双面渲染：无论正反面都画，避免某些角度下半身被剔除
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
            const std = material as THREE.MeshStandardMaterial;
            if (std.envMapIntensity !== undefined) {
              std.envMapIntensity = 1.2;
            }
          });

          // 调试：列出所有 mesh，确认 visible 始终为 true、side 已被设成 DoubleSide
          // 若旋转中某些部件消失，请回到这里看 visible 是否被外部改成 false
          const sideVal = Array.isArray(mesh.material)
            ? mesh.material[0]?.side
            : (mesh.material as THREE.Material | undefined)?.side;
          console.log("[LobsterKnight3D] mesh", mesh.name, "visible=" + mesh.visible, "side=" + sideVal);
        });

        // step 6: 跑一次 fit
        fitCameraToCharacter();

        // 调试输出
        const w = container.clientWidth;
        const h = container.clientHeight;
        const debug = {
          containerWidth: w,
          containerHeight: h,
          cameraAspect: Number(camera.aspect.toFixed(4)),
          originalCenter: {
            x: Number(originalCenter.x.toFixed(4)),
            y: Number(originalCenter.y.toFixed(4)),
            z: Number(originalCenter.z.toFixed(4)),
          },
          normalizedCenter: {
            x: Number(normalizedCenter.x.toFixed(4)),
            y: Number(normalizedCenter.y.toFixed(4)),
            z: Number(normalizedCenter.z.toFixed(4)),
          },
          normalizedSize: {
            x: Number(normalizedSize.x.toFixed(4)),
            y: Number(normalizedSize.y.toFixed(4)),
            z: Number(normalizedSize.z.toFixed(4)),
          },
          boundingSphereRadius: Number(boundingRadius.toFixed(4)),
          cameraDistance: Number(safeDistance.toFixed(4)),
          modelPosition: {
            x: Number(model.position.x.toFixed(4)),
            y: Number(model.position.y.toFixed(4)),
            z: Number(model.position.z.toFixed(4)),
          },
          rootPosition: {
            x: Number(characterRoot!.position.x.toFixed(4)),
            y: Number(characterRoot!.position.y.toFixed(4)),
            z: Number(characterRoot!.position.z.toFixed(4)),
          },
        };
        console.log("[LobsterKnight3D] GLB loaded " + JSON.stringify(debug, null, 2));

        setLoadFailed(false);
      },
      undefined,
      (err) => {
        console.error("GLB load error", err);
        if (!disposed) setLoadFailed(true);
      }
    );

    // ---- fitCameraToCharacter(用 BoundingSphere) ----
    let safeDistance = 1.0;
    function fitCameraToCharacter() {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      // 必须让 Three.js 设置 canvas 的 CSS 尺寸(updateStyle=true)：
      // 容器是 440×541；setPixelRatio(2) 已把 canvas.width/height 属性翻倍到 880×1082。
      // 如果不显式把 CSS 设为 w×h，canvas 会按属性值显示为 880×1082 CSS px，
      // 被容器的 overflow-hidden 裁掉 3/4 —— 表现为"模型只显示一部分"。
      renderer!.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      if (!characterRoot || boundingRadius <= 0) {
        // 模型还没加载,先定个占位
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        controls!.target.set(0, 0, 0);
        controls!.update();
        return;
      }

      // 用 BoundingSphere 算 fit(对旋转物体更稳)
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const limitingFov = Math.min(vFov, hFov);
      const distance = boundingRadius / Math.sin(limitingFov / 2);
      // 距离缩到 0.85,模型视觉上放大约 17.6%(1/0.85)。
      // BoundingSphere 最外侧会有一小圈被裁(模型主体仍在视口内);
      // minDistance/maxDistance 会按比例跟着缩,用户可滚轮拉远拉近。
      safeDistance = distance * 0.85;
      // 确保 far 至少是 safeDistance * 10，防止远处被投影截掉
      camera.far = Math.max(100, safeDistance * 10);
      camera.updateProjectionMatrix();

      // 相机放在 z+ 方向(3/4 角度由 polar + 后续旋转控制)
      camera.position.set(0, 0, safeDistance);
      camera.lookAt(0, 0, 0);
      controls!.target.set(0, 0, 0);
      controls!.minDistance = safeDistance * 0.7;
      controls!.maxDistance = safeDistance * 1.6;
      controls!.update();
    }

    // ---- ResizeObserver ----
    resizeObs = new ResizeObserver(() => {
      fitCameraToCharacter();
    });
    resizeObs.observe(container);
    // 初次 fit(占位)
    fitCameraToCharacter();

    // ---- Animate ----
    function animate() {
      if (disposed) return;
      if (!userInteracting && resumeAutoAt > 0 && performance.now() > resumeAutoAt && controls) {
        controls.autoRotate = true;
        resumeAutoAt = 0;
      }
      if (controls) controls.update();
      renderer?.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }
    animate();

    disposeFns.push(() => {
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      resizeObs?.disconnect();
      cancelAnimationFrame(animationId);
      renderer?.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    });

    return () => {
      disposed = true;
      disposeFns.forEach((fn) => {
        try {
          fn();
        } catch {
          // context 已丢失时 dispose 可能抛错，忽略
        }
      });
    };
  }, [glFailed, modelUrl, contextEpoch]);

  if (glFailed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-brand-50 ${className}`}>
        {fallback ?? <span className="text-4xl">🦞</span>}
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ display: "block" }}
      aria-label="龍蝦騎士 3D 形象"
      role="img"
    >
      {loadFailed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-slate-500">
          加载失败
        </div>
      )}
    </div>
  );
}

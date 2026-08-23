// 校驗 10 個徽章 GLB：meshopt 解碼 + 統計，定位渲染失敗的文件
const N = "C:/Users/ynyyzyrf/AppData/Local/npm-cache/_npx/6e1a7b84fabb98f4/node_modules";
const { NodeIO } = require(`${N}/@gltf-transform/core`);
const { EXTMeshoptCompression, KHRONOS_EXTENSIONS } = require(`${N}/@gltf-transform/extensions`);
const meshopt = require(`${N}/meshoptimizer`);

Promise.resolve(meshopt).then(async ({ MeshoptDecoder }) => {
  const io = new NodeIO()
    .registerExtensions(KHRONOS_EXTENSIONS)
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

  const dir = "D:/aicoding/daostore-fde/daostore-fde/web/public/badges/";
  let bad = 0;
  for (let i = 1; i <= 10; i++) {
    try {
      const doc = await io.read(`${dir}${i}.glb`);
      const root = doc.getRoot();
      const meshes = root.listMeshes();
      let verts = 0;
      meshes.forEach((m) =>
        m.listPrimitives().forEach((p) => {
          const pos = p.getAttribute("POSITION");
          if (pos) verts += pos.getCount();
        }),
      );
      const textures = root.listTextures();
      const sizes = textures.map((t) => {
        try {
          return t.getSize();
        } catch {
          return "?";
        }
      });
      const mats = root.listMaterials().length;
      console.log(`${i}.glb OK meshes=${meshes.length} verts=${verts} mats=${mats} textures=${textures.length} sizes=${JSON.stringify(sizes)}`);
    } catch (e) {
      bad++;
      console.log(`${i}.glb FAIL ${String(e.message || e).slice(0, 160)}`);
    }
  }
  console.log(bad === 0 ? "ALL 10 VALID" : `${bad} BROKEN`);
});

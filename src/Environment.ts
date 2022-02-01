import {
    Scene, Mesh, Vector3, Color3,
    TransformNode, SceneLoader, ParticleSystem, Color4,
    Texture, PBRMetallicRoughnessMaterial, VertexBuffer,
    AnimationGroup, Sound, ExecuteCodeAction, ActionManager,
    Tags
} from "@babylonjs/core";

export class Environment {
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public async load() {
        // var ground = Mesh.CreateBox("ground", 24, this._scene);
        // ground.scaling = new Vector3(1, .02, 1);

        const assets = await this._loadAsset();
        // 循环浏览导入的所有环境网格
        assets.allMeshes.forEach((m) => {
            m.receiveShadows = true;
            m.checkCollisions = true;
        });
    }

    public async _loadAsset() {
        const result = await SceneLoader.ImportMeshAsync(null, "./models/", "envSetting.glb", this._scene);

        let env = result.meshes[0];
        let allMeshes = env.getChildMeshes();
        console.log(env)
        return {
            env: env, // 参考我们整个导入的glb（网格和变换节点）
            allMeshes: allMeshes, // 环境中的所有网格
        };
    }
}
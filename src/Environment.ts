import {
    Scene, Mesh, Vector3, Color3,
    TransformNode, SceneLoader, ParticleSystem, Color4,
    Texture, PBRMetallicRoughnessMaterial, VertexBuffer,
    AnimationGroup, Sound, ExecuteCodeAction, ActionManager,
    Tags
} from "@babylonjs/core";
import { Lantern } from "./lantern";
import { Player } from "./characterController";


export class Environment {
    private _scene: Scene;

    // 网格
    private _lanternObjs: Array<Lantern>; // 需要点亮的一排灯笼
    private _lightmtl: PBRMetallicRoughnessMaterial; // 灯笼点亮时的发射纹理

    constructor(scene: Scene) {
        this._scene = scene;

        this._lanternObjs = [];
        // 为灯笼点亮时创建发射材质
        const lightmtl = new PBRMetallicRoughnessMaterial("lantern mesh light", this._scene);
        lightmtl.emissiveTexture = new Texture("/textures/litLantern.png", this._scene, true, false);
        lightmtl.emissiveColor = new Color3(0.8784313725490196, 0.7568627450980392, 0.6235294117647059);
        this._lightmtl = lightmtl;
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

        assets.lantern.isVisible = false; // 原始网格不可见
        // 转换节点以容纳所有灯笼
        const lanternHolder = new TransformNode("lanternHolder", this._scene);

        for (let i = 0; i < 22; i++) {
            // 网格克隆
            let lanternInstance = assets.lantern.clone("lantern" + i); // 引入进口的灯笼网并制作克隆  
            lanternInstance.setParent(lanternHolder);

            // 创建新的灯笼对象
            let newLantern = new Lantern(
                this._lightmtl,
                lanternInstance,
                this._scene,
                assets.env
                    .getChildTransformNodes(false)
                    .find((m) => m.name === "lantern " + i)
                    .getAbsolutePosition(),
            );
            this._lanternObjs.push(newLantern);
        }
        // 处置克隆的原始网格和动画组
        assets.lantern.dispose();
    }

    public async _loadAsset() {
        const result = await SceneLoader.ImportMeshAsync(null, "./models/", "envSetting.glb", this._scene);

        // 装载灯笼网
        const res = await SceneLoader.ImportMeshAsync("", "./models/", "lantern.glb", this._scene);

        // 从导入的网格的根中提取实际的灯笼网格，处理根
        let lantern = res.meshes[0].getChildren()[0];
        lantern.parent = null;
        res.meshes[0].dispose();

        let env = result.meshes[0];
        let allMeshes = env.getChildMeshes();
        console.log(env)

        return {
            env: env, // 参考我们整个导入的glb（网格和变换节点）
            allMeshes: allMeshes, // 环境中的所有网格
            // 环境保护网
            lantern: lantern as Mesh,
        };
    }

    public checkLanterns(player: Player) {
        // 点亮第一盏灯
        if (!this._lanternObjs[0].isLit) {
            this._lanternObjs[0].setEmissiveTexture();
        }

        // 设置交叉点触发器
        this._lanternObjs.forEach(lantern => {
            player.mesh.actionManager.registerAction(
                new ExecuteCodeAction(
                    {
                        trigger: ActionManager.OnIntersectionEnterTrigger,
                        parameter: lantern.mesh
                    },
                    () => {
                        // 如果灯笼没有点亮，请点亮并重置火花计时器
                        if (!lantern.isLit && player.sparkLit) {
                            player.lanternsLit += 1; // 增加灯笼数
                            lantern.setEmissiveTexture(); // “点亮”灯笼
                            // 重新设置火花
                            player.sparkReset = true;
                            player.sparkLit = true;
                        }
                        // 如果灯已经亮了, 重新设置火花
                        else if (lantern.isLit) {
                            player.sparkReset = true;
                            player.sparkLit = true;
                        }
                    }
                )
            );
        });
    }
}
import { Scene, Mesh, Vector3, Color3, TransformNode, SceneLoader, ParticleSystem, Color4, Texture, PBRMetallicRoughnessMaterial, VertexBuffer, AnimationGroup, Sound, ExecuteCodeAction, ActionManager, Tags } from "@babylonjs/core";
import { Lantern } from "./lantern";
import { Player } from "./characterController";


export class Environment {
    private _scene: Scene;

    // 网格
    private _lanternObjs: Array<Lantern>; // 需要点亮的一排灯笼
    private _lightmtl: PBRMetallicRoughnessMaterial; // 灯笼点亮时的发射纹理

    // 烟火
    private _fireworkObjs = [];
    private _startFireworks: boolean = false;

    constructor(scene: Scene) {
        this._scene = scene;

        this._lanternObjs = [];

        // 为灯笼点亮时创建发射材质
        const lightmtl = new PBRMetallicRoughnessMaterial("lantern mesh light", this._scene);
        lightmtl.emissiveTexture = new Texture("/textures/litLantern.png", this._scene, true, false);
        lightmtl.emissiveColor = new Color3(0.8784313725490196, 0.7568627450980392, 0.6235294117647059);
        this._lightmtl = lightmtl;
    }

    // 一旦环境资产被导入，我们会做什么
    // 处理为碰撞和触发网格设置必要的标志，
    // 设置灯笼对象
    // 为游戏结束创建烟花粒子系统
    public async load() {

        const assets = await this._loadAsset();

        // 循环浏览导入的所有环境网格
        assets.allMeshes.forEach((m) => {
            m.receiveShadows = true;
            m.checkCollisions = true;

            if (m.name == "ground") { // 不要检查碰撞，不要让光线投射来检测（不能降落）
                m.checkCollisions = false;
                m.isPickable = false;
            }
            // 将使用长方体碰撞的区域
            if (m.name.includes("stairs") || m.name == "cityentranceground" || m.name == "fishingground.001" || m.name.includes("lilyflwr")) {
                m.checkCollisions = false;
                m.isPickable = false;
            }
            // 碰撞网格
            if (m.name.includes("collision")) {
                m.isVisible = false;
                m.isPickable = true;
            }
            // 触发网格
            if (m.name.includes("Trigger")) {
                m.isVisible = false;
                m.isPickable = false;
                m.checkCollisions = false;
            }
        });

        //--灯笼--
        assets.lantern.isVisible = false; // 原始网格不可见
        // 转换节点以容纳所有灯笼
        const lanternHolder = new TransformNode("lanternHolder", this._scene);
        for (let i = 0; i < 22; i++) {
            // 网格克隆
            let lanternInstance = assets.lantern.clone("lantern" + i); // 引入进口的灯笼网并制作克隆  
            lanternInstance.isVisible = true;
            lanternInstance.setParent(lanternHolder);

            // 动画克隆
            let animGroupClone = new AnimationGroup("lanternAnimGroup " + i);
            animGroupClone.addTargetedAnimation(assets.animationGroups.targetedAnimations[0].animation, lanternInstance);

            // 创建新的灯笼对象
            let newLantern = new Lantern(
                this._lightmtl,
                lanternInstance,
                this._scene,
                assets.env
                    .getChildTransformNodes(false)
                    .find((m) => m.name === "lantern " + i)
                    .getAbsolutePosition(),
                animGroupClone
            );
            this._lanternObjs.push(newLantern);
        }
        // 处置克隆的原始网格和动画组
        assets.lantern.dispose();
        assets.animationGroups.dispose();

        // --烟火--
        for (let i = 0; i < 20; i++) {
            this._fireworkObjs.push(new Firework(this._scene, i));
        }
        // 在场景渲染之前，检查烟花是否已经开始
        // 如果有，触发烟花序列
        this._scene.onBeforeRenderObservable.add(() => {
            this._fireworkObjs.forEach(f => {
                if (this._startFireworks) {
                    f._startFirework();
                }
            })
        })
    }

    // 加载环境所需的所有网格
    public async _loadAsset() {
        const result = await SceneLoader.ImportMeshAsync(null, "./models/", "envSetting.glb", this._scene);

        let env = result.meshes[0];
        let allMeshes = env.getChildMeshes();

        // 装载灯笼网
        const res = await SceneLoader.ImportMeshAsync("", "./models/", "lantern.glb", this._scene);

        // 从导入的网格的根中提取实际的灯笼网格，处理根
        let lantern = res.meshes[0].getChildren()[0];
        lantern.parent = null;
        res.meshes[0].dispose();

        // --动画--
        // 从灯笼中提取动画（以下是解除动画组神秘感的视频）
        const importedAnims = res.animationGroups;
        let animation = [];
        animation.push(importedAnims[0].targetedAnimations[0].animation);
        importedAnims[0].dispose();
        // 创建一个新的动画组，并将网格作为其动画的目标
        let animGroup = new AnimationGroup("lanternAnimGroup");
        animGroup.addTargetedAnimation(animation[0], res.meshes[1]);

        return {
            env: env, // 参考我们整个导入的glb（网格和变换节点）
            allMeshes: allMeshes, // 环境中的所有网格
            // 环境保护网
            lantern: lantern as Mesh,
            animationGroups: animGroup
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

                            //SFX
                            player.lightSfx.play();
                        }
                        // 如果灯已经亮了, 重新设置火花
                        else if (lantern.isLit) {
                            player.sparkReset = true;
                            player.sparkLit = true;

                            //SFX
                            player.sparkResetSfx.play();
                        }
                    }
                )
            );
        });
    }
}

class Firework {
    private _scene: Scene;

    // 环境使用的变量
    private _emitter: Mesh;
    private _rocket: ParticleSystem;
    private _exploded: boolean = false;
    private _height: number;
    private _delay: number;
    private _started: boolean;

    //sounds
    private _explosionSfx: Sound;
    private _rocketSfx: Sound;


    constructor(scene: Scene, i: number) {
        this._scene = scene;
        // 烟花火箭发射器
        const sphere = Mesh.CreateSphere("rocket", 4, 1, scene);
        sphere.isVisible = false;
        // 所有焰火的起源繁殖点由名为“焰火”的TransformNode确定，该节点位于blender中
        let randPos = Math.random() * 10;
        sphere.position = (new Vector3(scene.getTransformNodeByName("fireworks").getAbsolutePosition().x + randPos * -1, scene.getTransformNodeByName("fireworks").getAbsolutePosition().y, scene.getTransformNodeByName("fireworks").getAbsolutePosition().z));
        this._emitter = sphere;

        // 火箭粒子系统
        let rocket = new ParticleSystem("rocket", 350, scene);
        rocket.particleTexture = new Texture("./textures/flare.png", scene);
        rocket.emitter = sphere;
        rocket.emitRate = 20;
        rocket.minEmitBox = new Vector3(0, 0, 0);
        rocket.maxEmitBox = new Vector3(0, 0, 0);
        rocket.color1 = new Color4(0.49, 0.57, 0.76);
        rocket.color2 = new Color4(0.29, 0.29, 0.66);
        rocket.colorDead = new Color4(0, 0, 0.2, 0.5);
        rocket.minSize = 1;
        rocket.maxSize = 1;
        rocket.addSizeGradient(0, 1);
        rocket.addSizeGradient(1, 0.01);
        this._rocket = rocket;

        // 设定火箭爆炸前的飞行高度，以及发射火箭所需的时间
        this._height = sphere.position.y + Math.random() * (15 + 4) + 4;
        this._delay = (Math.random() * i + 1) * 60; // 基于帧的

    }

    private _explosions(position: Vector3): void {
        // 分割为顶点的网格
        const explosion = Mesh.CreateSphere("explosion", 4, 1, this._scene);
        explosion.isVisible = false;
        explosion.position = position;

        let emitter = explosion;
        // 抓取顶点数据
        emitter.useVertexColors = true;
        let vertPos = emitter.getVerticesData(VertexBuffer.PositionKind);
        let vertNorms = emitter.getVerticesData(VertexBuffer.NormalKind);
        let vertColors = [];

        // 为每个顶点创建一个粒子系统
        for (let i = 0; i < vertPos.length; i += 3) {
            let vertPosition = new Vector3(
                vertPos[i], vertPos[i + 1], vertPos[i + 2]
            )
            let vertNormal = new Vector3(
                vertNorms[i], vertNorms[i + 1], vertNorms[i + 2]
            )
            let r = Math.random();
            let g = Math.random();
            let b = Math.random();
            let alpha = 1.0;
            let color = new Color4(r, g, b, alpha);
            vertColors.push(r);
            vertColors.push(g);
            vertColors.push(b);
            vertColors.push(alpha);

            // 粒子系统的发射器
            let gizmo = Mesh.CreateBox("gizmo", 0.001, this._scene);
            gizmo.position = vertPosition;
            gizmo.parent = emitter;
            let direction = vertNormal.normalize().scale(1); // 向正常方向移动

            // 每个爆炸碎片的实际粒子系统
            const particleSys = new ParticleSystem("particles", 500, this._scene);
            particleSys.particleTexture = new Texture("textures/flare.png", this._scene);
            particleSys.emitter = gizmo;
            particleSys.minEmitBox = new Vector3(1, 0, 0);
            particleSys.maxEmitBox = new Vector3(1, 0, 0);
            particleSys.minSize = .1;
            particleSys.maxSize = .1;
            particleSys.color1 = color;
            particleSys.color2 = color;
            particleSys.colorDead = new Color4(0, 0, 0, 0.0);
            particleSys.minLifeTime = 1;
            particleSys.maxLifeTime = 2;
            particleSys.emitRate = 500;
            particleSys.gravity = new Vector3(0, -9.8, 0);
            particleSys.direction1 = direction;
            particleSys.direction2 = direction;
            particleSys.minEmitPower = 10;
            particleSys.maxEmitPower = 13;
            particleSys.updateSpeed = 0.01;
            particleSys.targetStopDuration = 0.2;
            particleSys.disposeOnStop = true;
            particleSys.start();// 创建后自动启动
        }

        emitter.setVerticesData(VertexBuffer.ColorKind, vertColors);
    }

    private _startFirework(): void {

        if (this._started) { // 一旦启动，火箭就会飞到高空，然后爆炸
            if (this._emitter.position.y >= this._height && !this._exploded) {
                // 向爆炸粒子系统的过渡
                this._exploded = !this._exploded; // 不要让它再次爆炸
                this._explosions(this._emitter.position);
                this._emitter.dispose();
                this._rocket.stop();
            } else {
                // 把火箭往上推
                this._emitter.position.y += .2;
            }
        } else {
            // 利用它的延迟来知道何时发射烟花
            if (this._delay <= 0) {
                this._started = true;
                // 启动粒子系统
                this._rocket.start();
            } else {
                this._delay--;
            }
        }
    }

    private _loadSounds(): void {
        this._rocketSfx = new Sound("selection", "./sounds/fw_05.wav", this._scene, function () {
        }, {
            volume: 0.5,
        });

        this._explosionSfx = new Sound("selection", "./sounds/fw_03.wav", this._scene, function () {
        }, {
            volume: 0.5,
        });
    }
}
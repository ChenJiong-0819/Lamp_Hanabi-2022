import { Scene, Color3, Mesh, Vector3, PointLight, Texture, Color4, ParticleSystem, AnimationGroup, PBRMetallicRoughnessMaterial } from "@babylonjs/core";

export class Lantern {

    public _scene: Scene;

    public mesh: Mesh;
    public isLit: boolean = false;
    private _lightmtl: PBRMetallicRoughnessMaterial;
    private _light: PointLight;

    // 灯笼动画
    private _spinAnim: AnimationGroup;

    // 粒子系统
    private _stars: ParticleSystem;

    constructor(lightmtl: PBRMetallicRoughnessMaterial, mesh: Mesh, scene: Scene, position: Vector3, animationGroups: AnimationGroup) {
        this._scene = scene;
        this._lightmtl = lightmtl;

        // 装上灯笼网
        this._loadLantern(mesh, position);

        // 负载粒子系统
        this._loadStars();

        // 设置动画
        this._spinAnim = animationGroups;

        // 为灯笼创造光源
        const light = new PointLight("lantern light", this.mesh.getAbsolutePosition(), this._scene);
        light.intensity = 0;
        light.radius = 2;
        light.diffuse = new Color3(0.45, 0.56, 0.80);
        this._light = light;
        // 仅允许灯光影响其附近的网格
        this._findNearestMeshes(light);
    }

    private _loadLantern(mesh: Mesh, position: Vector3): void {
        this.mesh = mesh;
        this.mesh.scaling = new Vector3(.8, .8, .8);
        this.mesh.setAbsolutePosition(position);
        this.mesh.isPickable = false;
    }

    public setEmissiveTexture(): void {
        this.isLit = true;

        // 播放动画和粒子系统
        this._spinAnim.play();
        this._stars.start();
        // 交换纹理
        this.mesh.material = this._lightmtl;
        this._light.intensity = 30;
    }

    // 创建灯光时，仅包括指定的网格
    private _findNearestMeshes(light: PointLight): void {
        if (this.mesh.name.includes("14") || this.mesh.name.includes("15")) {
            light.includedOnlyMeshes.push(this._scene.getMeshByName("festivalPlatform1"));
        } else if (this.mesh.name.includes("16") || this.mesh.name.includes("17")) {
            light.includedOnlyMeshes.push(this._scene.getMeshByName("festivalPlatform2"));
        } else if (this.mesh.name.includes("18") || this.mesh.name.includes("19")) {
            light.includedOnlyMeshes.push(this._scene.getMeshByName("festivalPlatform3"));
        } else if (this.mesh.name.includes("20") || this.mesh.name.includes("21")) {
            light.includedOnlyMeshes.push(this._scene.getMeshByName("festivalPlatform4"));
        }
        // 抓取对应的变换节点，该节点包含受此灯笼灯光影响的所有网格
        this._scene.getTransformNodeByName(this.mesh.name + "lights").getChildMeshes().forEach(m => {
            light.includedOnlyMeshes.push(m);
        })
    }

    private _loadStars(): void {
        const particleSystem = new ParticleSystem("stars", 1000, this._scene);

        particleSystem.particleTexture = new Texture("textures/solidStar.png", this._scene);
        particleSystem.emitter = new Vector3(this.mesh.position.x, this.mesh.position.y + 1.5, this.mesh.position.z);
        particleSystem.createPointEmitter(new Vector3(0.6, 1, 0), new Vector3(0, 1, 0));
        particleSystem.color1 = new Color4(1, 1, 1);
        particleSystem.color2 = new Color4(1, 1, 1);
        particleSystem.colorDead = new Color4(1, 1, 1, 1);
        particleSystem.emitRate = 12;
        particleSystem.minEmitPower = 14;
        particleSystem.maxEmitPower = 14;
        particleSystem.addStartSizeGradient(0, 2);
        particleSystem.addStartSizeGradient(1, 0.8);
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = 2;
        particleSystem.addDragGradient(0, 0.7, 0.7);
        particleSystem.targetStopDuration = .25;

        this._stars = particleSystem;
    }
}

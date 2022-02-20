import { Scene, Color3, Mesh, Vector3, PointLight, Texture, Color4, ParticleSystem, AnimationGroup, PBRMetallicRoughnessMaterial } from "@babylonjs/core";

export class Lantern {

    public _scene: Scene;

    public mesh: Mesh;
    public isLit: boolean = false;
    private _lightSphere: Mesh;
    private _lightmtl: PBRMetallicRoughnessMaterial;

    // 灯笼动画
    private _spinAnim: AnimationGroup;

    // 粒子系统
    private _stars: ParticleSystem;

    constructor(lightmtl: PBRMetallicRoughnessMaterial, mesh: Mesh, scene: Scene, position: Vector3, animationGroups?: AnimationGroup) {
        this._scene = scene;
        this._lightmtl = lightmtl;

        // 创建灯笼的照明球体
        const lightSphere = Mesh.CreateSphere("illum", 4, 20, this._scene);
        lightSphere.scaling.y = 2;
        lightSphere.setAbsolutePosition(position);
        lightSphere.parent = this.mesh;
        lightSphere.isVisible = false;
        lightSphere.isPickable = false;
        this._lightSphere = lightSphere;

        // 装上灯笼网
        this._loadLantern(mesh, position);
    }

    private _loadLantern(mesh: Mesh, position: Vector3): void {
        this.mesh = mesh;
        this.mesh.scaling = new Vector3(.8, .8, .8);
        this.mesh.setAbsolutePosition(position);
        this.mesh.isPickable = false;
    }

    public setEmissiveTexture(): void {
        this.isLit = true;

        // 交换纹理
        this.mesh.material = this._lightmtl;

        // 播放动画
        this._spinAnim.play();

        // 为灯笼创造光源
        const light = new PointLight("lantern light", this.mesh.getAbsolutePosition(), this._scene);
        light.intensity = 30;
        light.radius = 2;
        light.diffuse = new Color3(0.45, 0.56, 0.80);
        this._findNearestMeshes(light);
    }

    // 创建灯光时，仅包括照明球体内的网格
    private _findNearestMeshes(light: PointLight): void {
        this._scene.getMeshByName("__root__").getChildMeshes().forEach(m => {
            if (this._lightSphere.intersectsMesh(m)) {
                light.includedOnlyMeshes.push(m);
            }
        });

        // 除掉球体
        this._lightSphere.dispose();
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

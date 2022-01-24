import { Scene, Mesh, Vector3, Color3,
         TransformNode, SceneLoader, ParticleSystem, Color4,
         Texture, PBRMetallicRoughnessMaterial, VertexBuffer,
         AnimationGroup, Sound, ExecuteCodeAction, ActionManager,
         Tags } from "@babylonjs/core";

export class Environment {
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public async load() {
        var ground = Mesh.CreateBox("ground", 24, this._scene);
        ground.scaling = new Vector3(1,.02,1);
    }
}
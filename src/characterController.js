import { TransformNode, ArcRotateCamera, Vector3 } from "@babylonjs/core";
export class Player extends TransformNode {
    constructor(assets, scene, shadowGenerator, input) {
        super("player", scene);
        this.scene = scene;
        this._setupPlayerCamera();
        this.mesh = assets.mesh;
        this.mesh.parent = this;
        shadowGenerator.addShadowCaster(assets.mesh); //the player mesh will cast shadows
        this._input = input; //inputs we will get from inputController.ts
    }
    _setupPlayerCamera() {
        var camera4 = new ArcRotateCamera("arc", -Math.PI / 2, Math.PI / 2, 40, new Vector3(0, 3, 0), this.scene);
    }
}
//# sourceMappingURL=characterController.js.map
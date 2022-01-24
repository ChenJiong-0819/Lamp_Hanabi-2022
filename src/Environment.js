var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Mesh, Vector3 } from "@babylonjs/core";
export class Environment {
    constructor(scene) {
        this._scene = scene;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            var ground = Mesh.CreateBox("ground", 24, this._scene);
            ground.scaling = new Vector3(1, .02, 1);
        });
    }
}
//# sourceMappingURL=Environment.js.map
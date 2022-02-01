import { Scene, ActionManager, ExecuteCodeAction, Scalar } from "@babylonjs/core";

export class PlayerInput {

    public inputMap: any;
    // private _scene: Scene;

    // 简单动作
    public horizontal: number = 0;
    public vertical: number = 0;

    // 跟踪该轴是否有移动
    public horizontalAxis: number = 0;
    public verticalAxis: number = 0;

    // 短跑和跳跃
    public dashing: boolean = false;
    public jumpKeyDown: boolean = false;

    constructor(scene: Scene) {
        scene.actionManager = new ActionManager(scene);

        this.inputMap = {};
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        scene.onBeforeRenderObservable.add(() => {
            this._updateFromKeyboard();
        });
    }

    private _updateFromKeyboard(): void {
        if (this.inputMap["ArrowUp"]) {
            this.vertical = Scalar.Lerp(this.vertical, 1, 0.2);
            this.verticalAxis = 1;

        } else if (this.inputMap["ArrowDown"]) {
            this.vertical = Scalar.Lerp(this.vertical, -1, 0.2);
            this.verticalAxis = -1;
        } else {
            this.vertical = 0;
            this.verticalAxis = 0;
        }

        if (this.inputMap["ArrowLeft"]) {
            this.horizontal = Scalar.Lerp(this.horizontal, -1, 0.2);
            this.horizontalAxis = -1;

        } else if (this.inputMap["ArrowRight"]) {
            this.horizontal = Scalar.Lerp(this.horizontal, 1, 0.2);
            this.horizontalAxis = 1;
        }
        else {
            this.horizontal = 0;
            this.horizontalAxis = 0;
        }
        // 短跑
        if (this.inputMap["Shift"]) {
            this.dashing = true;
        } else {
            this.dashing = false;
        }

        // 跳跃检查（空格）
        if (this.inputMap[" "]) {
            this.jumpKeyDown = true;
        } else {
            this.jumpKeyDown = false;
        }
    }

}
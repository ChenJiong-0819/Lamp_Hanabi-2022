import { Scene, ActionManager, ExecuteCodeAction, Observer, Scalar } from '@babylonjs/core';
import { Hud } from './ui';

export class PlayerInput {

    public inputMap: any;
    private _scene: Scene;

    // 简单动作
    public horizontal: number = 0;
    public vertical: number = 0;

    // 跟踪该轴是否有移动
    public horizontalAxis: number = 0;
    public verticalAxis: number = 0;

    // 短跑和跳跃
    public dashing: boolean = false;
    public jumpKeyDown: boolean = false;

    // 移动输入跟踪器
    private _ui: Hud;
    public mobileLeft: boolean;
    public mobileRight: boolean;
    public mobileUp: boolean;
    public mobileDown: boolean;
    private _mobileJump: boolean;
    private _mobileDash: boolean;

    constructor(scene: Scene, ui: Hud) {

        this._scene = scene;
        this._ui = ui;

        // 用于检测输入的场景动作管理器
        this._scene.actionManager = new ActionManager(this._scene);

        this.inputMap = {};
        this._scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));
        this._scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        // 向场景中添加一个在渲染前调用updateFromKeyboard的observable
        scene.onBeforeRenderObservable.add(() => {
            this._updateFromKeyboard();
        });

        // 在移动设备上设置移动控件
        if (this._ui.isMobile) {
            this._setUpMobile();
        }
    }

    // 键盘控制和移动控制
    // 处理按键或手机按键时的操作
    private _updateFromKeyboard(): void {

        // 前后运动
        if ((this.inputMap["ArrowUp"] || this.mobileUp) && !this._ui.gamePaused) {
            this.verticalAxis = 1;
            this.vertical = Scalar.Lerp(this.vertical, 1, 0.2);

        } else if ((this.inputMap["ArrowDown"] || this.mobileDown) && !this._ui.gamePaused) {
            this.vertical = Scalar.Lerp(this.vertical, -1, 0.2);
            this.verticalAxis = -1;
        } else {
            this.vertical = 0;
            this.verticalAxis = 0;
        }

        // 左右运动
        if ((this.inputMap["ArrowLeft"] || this.mobileLeft) && !this._ui.gamePaused) {
            // lerp将在起点和终点标量之间创建一个标量线性插值amt
            // 以当前水平线和你保持的时间，将上升到-1（一直向左）
            this.horizontal = Scalar.Lerp(this.horizontal, -1, 0.2);
            this.horizontalAxis = -1;

        } else if ((this.inputMap["ArrowRight"] || this.mobileRight) && !this._ui.gamePaused) {
            this.horizontal = Scalar.Lerp(this.horizontal, 1, 0.2);
            this.horizontalAxis = 1;
        }
        else {
            this.horizontal = 0;
            this.horizontalAxis = 0;
        }

        // 猛冲
        if ((this.inputMap["Shift"] || this._mobileDash) && !this._ui.gamePaused) {
            this.dashing = true;
        } else {
            this.dashing = false;
        }

        // 跳转检查（空格）
        if ((this.inputMap[" "] || this._mobileJump) && !this._ui.gamePaused) {
            this.jumpKeyDown = true;
        } else {
            this.jumpKeyDown = false;
        }
    }


    // 移动控制
    private _setUpMobile(): void {
        // 跳转按钮
        this._ui.jumpBtn.onPointerDownObservable.add(() => {
            this._mobileJump = true;
        });
        this._ui.jumpBtn.onPointerUpObservable.add(() => {
            this._mobileJump = false;
        });

        // 短跑按钮
        this._ui.dashBtn.onPointerDownObservable.add(() => {
            this._mobileDash = true;
        });
        this._ui.dashBtn.onPointerUpObservable.add(() => {
            this._mobileDash = false;
        });

        // 箭头键
        this._ui.leftBtn.onPointerDownObservable.add(() => {
            this.mobileLeft = true;
        });
        this._ui.leftBtn.onPointerUpObservable.add(() => {
            this.mobileLeft = false;
        });

        this._ui.rightBtn.onPointerDownObservable.add(() => {
            this.mobileRight = true;
        });
        this._ui.rightBtn.onPointerUpObservable.add(() => {
            this.mobileRight = false;
        });

        this._ui.upBtn.onPointerDownObservable.add(() => {
            this.mobileUp = true;
        });
        this._ui.upBtn.onPointerUpObservable.add(() => {
            this.mobileUp = false;
        });

        this._ui.downBtn.onPointerDownObservable.add(() => {
            this.mobileDown = true;
        });
        this._ui.downBtn.onPointerUpObservable.add(() => {
            this.mobileDown = false;
        });


    }
}
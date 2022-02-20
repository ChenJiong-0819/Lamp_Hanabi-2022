import { Scene, Vector3, Ray, TransformNode, Mesh, Color3, Color4, UniversalCamera, Quaternion, AnimationGroup, ExecuteCodeAction, ActionManager, ParticleSystem, Texture, SphereParticleEmitter, Sound, Observable, ShadowGenerator } from "@babylonjs/core";
import { PlayerInput } from "./inputController";

export class Player extends TransformNode {

    public camera;
    public scene: Scene;
    private _input;

    // 角色
    public mesh: Mesh; // 玩家外碰撞盒

    // 相机
    private _camRoot: TransformNode;
    private _yTilt: TransformNode;

    //animations
    private _run: AnimationGroup;
    private _idle: AnimationGroup;
    private _jump: AnimationGroup;
    private _land: AnimationGroup;
    private _dash: AnimationGroup;

    // animation trackers
    private _currentAnim: AnimationGroup = null;
    private _prevAnim: AnimationGroup;
    private _isFalling: boolean = false;
    private _jumped: boolean = false;

    //const values
    private static readonly PLAYER_SPEED: number = 0.45;
    private static readonly JUMP_FORCE: number = 0.80;
    private static readonly GRAVITY: number = -2.8;
    private static readonly DASH_FACTOR: number = 2.5;
    private static readonly DASH_TIME: number = 10; //how many frames the dash lasts
    private static readonly DOWN_TILT: Vector3 = new Vector3(0.8290313946973066, 0, 0);
    private static readonly ORIGINAL_TILT: Vector3 = new Vector3(0.5934119456780721, 0, 0);
    public dashTime: number = 0;

    // 玩家移动变量
    private _deltaTime: number = 0;
    private _h: number;
    private _v: number;

    private _moveDirection: Vector3 = new Vector3();
    private _inputAmt: number;

    // 短跑
    private _dashPressed: boolean;
    private _canDash: boolean = true;

    // 重力，地面探测，跳跃
    private _gravity: Vector3 = new Vector3();
    private _lastGroundPos: Vector3 = Vector3.Zero(); // keep track of the last grounded position
    private _grounded: boolean;
    private _jumpCount: number = 1;

    //player variables
    public lanternsLit: number = 1; //num lanterns lit
    public totalLanterns: number;
    public win: boolean = false; //whether the game is won

    //sparkler
    public sparkler: ParticleSystem; // sparkler particle system
    public sparkLit: boolean = true;
    public sparkReset: boolean = false;


    constructor(assets, scene: Scene, shadowGenerator: ShadowGenerator, input?) {
        super("player", scene);
        this.scene = scene;
        this._setupPlayerCamera();

        this.mesh = assets.mesh;
        this.mesh.parent = this;

        // --碰撞--
        this.mesh.actionManager = new ActionManager(this.scene);

        // this.scene.getLightByName("sparklight").parent = this.scene.getTransformNodeByName("Empty");

        this._idle = assets.animationGroups[1];
        this._jump = assets.animationGroups[2];
        this._land = assets.animationGroups[3];
        this._run = assets.animationGroups[4];
        this._dash = assets.animationGroups[0];


        // 站台目的地
        this.mesh.actionManager.registerAction(
            new ExecuteCodeAction(
                {
                    trigger: ActionManager.OnIntersectionEnterTrigger,
                    parameter: this.scene.getMeshByName("destination"),
                },
                () => {
                    if (this.lanternsLit == 22) {
                        this.win = true;
                        // 倾斜摄像机以查看烟花将在何处燃放
                        this._yTilt.rotation = new Vector3(5.689773361501514, 0.23736477827122882, 0);
                        this._yTilt.position = new Vector3(0, 6, 0);
                        this.camera.position.y = 17;
                    }
                },
            ),
        );

        // 世界地面探测
        // 如果玩家跌入“世界”，将位置重置为最后一个安全接地位置
        this.mesh.actionManager.registerAction(
            new ExecuteCodeAction(
                {
                    trigger: ActionManager.OnIntersectionEnterTrigger,
                    parameter: this.scene.getMeshByName("ground"),
                },
                () => {
                    this.mesh.position.copyFrom(this._lastGroundPos); // 需要使用copy，否则它们将同时指向同一个对象和更新
                },
            ),
        );


        this._setUpAnimations();
        shadowGenerator.addShadowCaster(assets.mesh); // 玩家网格将投射阴影

        this._input = input; // 我们将从inputController.ts获取输入
    }


    private _updateFromControls(): void {
        this._deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;

        this._moveDirection = Vector3.Zero(); // 保存运动信息的向量
        this._h = this._input.horizontal; // x轴
        this._v = this._input.vertical; // z轴

        if (this._input.dashing && !this._dashPressed && this._canDash && !this._grounded) {
            this._canDash = false; // 我们已经开始冲刺了，不要再冲刺了
            this._dashPressed = true; // 开始破折号序列

            this._currentAnim = this._dash;
        }

        let dashFactor = 1;
        // 如果你是冲刺，缩放运动
        if (this._dashPressed) {
            if (this.dashTime > Player.DASH_TIME) {
                this.dashTime = 0;
                this._dashPressed = false;
            } else {
                dashFactor = Player.DASH_FACTOR;
            }
            this.dashTime++;
        }

        // --基于相机的运动（当它旋转时）--
        let fwd = this._camRoot.forward;
        let right = this._camRoot.right;
        let correctedVertical = fwd.scaleInPlace(this._v);
        let correctedHorizontal = right.scaleInPlace(this._h);

        // 基于相机视图的运动
        let move = correctedHorizontal.addInPlace(correctedVertical);

        // 清除y，这样角色就不会飞起来，为下一步正常化，考虑到我们是否已经冲刺
        this._moveDirection = new Vector3((move).normalize().x * dashFactor, 0, (move).normalize().z * dashFactor);

        // 钳制输入值，使对角线移动速度不到原来的两倍
        let inputMag = Math.abs(this._h) + Math.abs(this._v);
        if (inputMag < 0) {
            this._inputAmt = 0;
        } else if (inputMag > 1) {
            this._inputAmt = 1;
        } else {
            this._inputAmt = inputMag;
        }

        // 考虑输入的最终运动
        this._moveDirection = this._moveDirection.scaleInPlace(this._inputAmt * Player.PLAYER_SPEED);

        // 检查是否有运动以确定是否需要旋转
        let input = new Vector3(this._input.horizontalAxis, 0, this._input.verticalAxis); // 方向沿着哪个轴   
        if (input.length() == 0) {// 如果没有检测到输入，防止旋转并保持玩家在同一个旋转
            return;
        }

        // 基于输入和相机角度的旋转
        let angle = Math.atan2(this._input.horizontalAxis, this._input.verticalAxis);
        angle += this._camRoot.rotation.y;
        let targ = Quaternion.FromEulerAngles(0, angle, 0);
        this.mesh.rotationQuaternion = Quaternion.Slerp(this.mesh.rotationQuaternion, targ, 10 * this._deltaTime);
    }

    private _setUpAnimations(): void {

        this.scene.stopAllAnimations();
        this._run.loopAnimation = true;
        this._idle.loopAnimation = true;

        // 初始化当前和上一个
        this._currentAnim = this._idle;
        this._prevAnim = this._land;
    }

    private _animatePlayer(): void {
        if (!this._dashPressed && !this._isFalling && !this._jumped
            && (this._input.inputMap["ArrowUp"] || this._input.mobileUp
                || this._input.inputMap["ArrowDown"] || this._input.mobileDown
                || this._input.inputMap["ArrowLeft"] || this._input.mobileLeft
                || this._input.inputMap["ArrowRight"] || this._input.mobileRight)) {

            this._currentAnim = this._run;
        } else if (this._jumped && !this._isFalling && !this._dashPressed) {
            this._currentAnim = this._jump;
        } else if (!this._isFalling && this._grounded) {
            this._currentAnim = this._idle;
        } else if (this._isFalling) {
            this._currentAnim = this._land;
        }
    }

    private _floorRaycast(offsetx: number, offsetz: number, raycastlen: number): Vector3 {
        let raycastFloorPos = new Vector3(this.mesh.position.x + offsetx, this.mesh.position.y + 0.5, this.mesh.position.z + offsetz);
        let ray = new Ray(raycastFloorPos, Vector3.Up().scale(-1), raycastlen);

        let predicate = function (mesh) {
            return mesh.isPickable && mesh.isEnabled();
        }
        let pick = this.scene.pickWithRay(ray, predicate);

        if (pick.hit) {
            return pick.pickedPoint;
        } else {
            return Vector3.Zero();
        }
    }

    private _isGrounded(): boolean {
        if (this._floorRaycast(0, 0, 0.6).equals(Vector3.Zero())) {
            return false;
        } else {
            return true;
        }
    }

    private _checkSlope(): boolean {

        // 仅检查可拾取并启用的网格（特定于不可见的碰撞网格）
        let predicate = function (mesh) {
            return mesh.isPickable && mesh.isEnabled();
        }

        // 从中心向外的4个光线投射
        let raycast = new Vector3(this.mesh.position.x, this.mesh.position.y + 0.5, this.mesh.position.z + .25);
        let ray = new Ray(raycast, Vector3.Up().scale(-1), 1.5);
        let pick = this.scene.pickWithRay(ray, predicate);

        let raycast2 = new Vector3(this.mesh.position.x, this.mesh.position.y + 0.5, this.mesh.position.z - .25);
        let ray2 = new Ray(raycast2, Vector3.Up().scale(-1), 1.5);
        let pick2 = this.scene.pickWithRay(ray2, predicate);

        let raycast3 = new Vector3(this.mesh.position.x + .25, this.mesh.position.y + 0.5, this.mesh.position.z);
        let ray3 = new Ray(raycast3, Vector3.Up().scale(-1), 1.5);
        let pick3 = this.scene.pickWithRay(ray3, predicate);

        let raycast4 = new Vector3(this.mesh.position.x - .25, this.mesh.position.y + 0.5, this.mesh.position.z);
        let ray4 = new Ray(raycast4, Vector3.Up().scale(-1), 1.5);
        let pick4 = this.scene.pickWithRay(ray4, predicate);

        if (pick.hit && !pick.getNormal().equals(Vector3.Up())) {
            if (pick.pickedMesh.name.includes("stair")) {
                return true;
            }
        } else if (pick2.hit && !pick2.getNormal().equals(Vector3.Up())) {
            if (pick2.pickedMesh.name.includes("stair")) {
                return true;
            }
        }
        else if (pick3.hit && !pick3.getNormal().equals(Vector3.Up())) {
            if (pick3.pickedMesh.name.includes("stair")) {
                return true;
            }
        }
        else if (pick4.hit && !pick4.getNormal().equals(Vector3.Up())) {
            if (pick4.pickedMesh.name.includes("stair")) {
                return true;
            }
        }
        return false;
    }

    private _updateGroundDetection(): void {
        if (!this._isGrounded()) {
            // 如果角色没有被接地，检查它是否在斜坡上，是否坠落或走到上面
            if (this._checkSlope() && this._gravity.y <= 0) {
                // 如果你被认为是在斜坡上，你可以跳跃，重力不会影响你
                this._gravity.y = 0;
                this._jumpCount = 1;
                this._grounded = true;
            } else {
                //keep applying gravity
                this._gravity = this._gravity.addInPlace(Vector3.Up().scale(this._deltaTime * Player.GRAVITY));
                this._grounded = false;
            }
        }
        // 将重力速度限制为跳跃力的负数
        if (this._gravity.y < -Player.JUMP_FORCE) {
            this._gravity.y = -Player.JUMP_FORCE;
        }

        // 一旦重力开始向下推动，提示下落动画
        if (this._gravity.y < 0 && this._jumped) { // 待办事项：如果不是在斜坡上，而是在地面上，那就玩一个坠落的动画
            this._isFalling = true;
        }

        this.mesh.moveWithCollisions(this._moveDirection.addInPlace(this._gravity));

        if (this._isGrounded()) {
            this._gravity.y = 0;
            this._grounded = true;
            this._lastGroundPos.copyFrom(this.mesh.position);

            this._jumpCount = 1; //允许跳跃 

            // 快速复位
            this._canDash = true; // 冲刺的能力
            // 重置顺序（如果我们在实际完成短跑持续时间之前与地面相撞，则需要重置）
            this.dashTime = 0;
            this._dashPressed = false;

            // 跳跃和下落动画标志
            this._jumped = false;
            this._isFalling = false;
        }

        // 跳跃检测
        if (this._input.jumpKeyDown && this._jumpCount > 0) {
            this._gravity.y = Player.JUMP_FORCE;
            this._jumpCount--;

            // 跳跃和下落动画旗帜
            this._jumped = true;
            this._isFalling = false;
        }
    }

    private _beforeRenderUpdate(): void {
        this._updateFromControls();
        this._updateGroundDetection();
        this._animatePlayer();
    }

    public activatePlayerCamera(): UniversalCamera {
        this.scene.registerBeforeRender(() => {

            this._beforeRenderUpdate();
            this._updateCamera();

        })
        return this.camera;
    }



    private _updateCamera(): void {

        // 用于旋转相机视图的触发区域
        if (this.mesh.intersectsMesh(this.scene.getMeshByName("cornerTrigger"))) {
            if (this._input.horizontalAxis > 0) { // 向右旋转              
                this._camRoot.rotation = Vector3.Lerp(this._camRoot.rotation, new Vector3(this._camRoot.rotation.x, Math.PI / 2, this._camRoot.rotation.z), 0.4);
            } else if (this._input.horizontalAxis < 0) { // 向左旋转
                this._camRoot.rotation = Vector3.Lerp(this._camRoot.rotation, new Vector3(this._camRoot.rotation.x, Math.PI, this._camRoot.rotation.z), 0.4);
            }
        }

        // 当玩家进入该区域时，旋转相机使其指向下方，当玩家退出时，相机将恢复正常
        if (this.mesh.intersectsMesh(this.scene.getMeshByName("festivalTrigger"))) {
            if (this._input.verticalAxis > 0) {
                this._yTilt.rotation = Vector3.Lerp(this._yTilt.rotation, Player.DOWN_TILT, 0.4);
            } else if (this._input.verticalAxis < 0) {
                this._yTilt.rotation = Vector3.Lerp(this._yTilt.rotation, Player.ORIGINAL_TILT, 0.4);
            }
        }
        // 到达目的地后，如果他们离开，请返回原始方向，并将其旋转到上一个方向
        if (this.mesh.intersectsMesh(this.scene.getMeshByName("destinationTrigger"))) {
            if (this._input.verticalAxis > 0) {
                this._yTilt.rotation = Vector3.Lerp(this._yTilt.rotation, Player.ORIGINAL_TILT, 0.4);
            } else if (this._input.verticalAxis < 0) {
                this._yTilt.rotation = Vector3.Lerp(this._yTilt.rotation, Player.DOWN_TILT, 0.4);
            }
        }

        let centerPlayer = this.mesh.position.y + 2;
        this._camRoot.position = Vector3.Lerp(this._camRoot.position, new Vector3(this.mesh.position.x, centerPlayer, this.mesh.position.z), 0.4);
    }



    private _setupPlayerCamera() {
        // 根摄影机父级，处理摄影机的定位以跟随播放机
        this._camRoot = new TransformNode("root");
        this._camRoot.position = new Vector3(0, 0, 0); // 初始化为（0,0,0）
        // 从后面面对玩家（180度）
        this._camRoot.rotation = new Vector3(0, Math.PI, 0);

        // 沿x轴旋转（上/下倾斜）
        let yTilt = new TransformNode("ytilt");
        // 调整相机视角，使其指向我们的播放器
        yTilt.rotation = Player.ORIGINAL_TILT;
        this._yTilt = yTilt;
        yTilt.parent = this._camRoot;

        // 我们的实际摄像头指向根部的位置
        this.camera = new UniversalCamera("cam", new Vector3(0, 0, -30), this.scene);
        this.camera.lockedTarget = this._camRoot.position;
        this.camera.fov = 0.47350045992678597;
        this.camera.parent = yTilt;

        this.scene.activeCamera = this.camera;
        return this.camera;
    }

    private _createSparkles(): void {

        const sphere = Mesh.CreateSphere("sparkles", 4, 1, this.scene);
        sphere.position = new Vector3(0, 0, 0);
        sphere.parent = this.scene.getTransformNodeByName("Empty"); // 将“粒子系统”放置在玩家网格上火花的尖端
        sphere.isVisible = false;

        let particleSystem = new ParticleSystem("sparkles", 1000, this.scene);
        particleSystem.particleTexture = new Texture("textures/flwr.png", this.scene);
        particleSystem.emitter = sphere;
        particleSystem.particleEmitterType = new SphereParticleEmitter(0);

        particleSystem.updateSpeed = 0.014;
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = 360;
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;

        particleSystem.minSize = 0.5;
        particleSystem.maxSize = 2;
        particleSystem.minScaleX = 0.5;
        particleSystem.minScaleY = 0.5;
        particleSystem.color1 = new Color4(0.8, 0.8549019607843137, 1, 1);
        particleSystem.color2 = new Color4(0.8509803921568627, 0.7647058823529411, 1, 1);

        particleSystem.addRampGradient(0, Color3.White());
        particleSystem.addRampGradient(1, Color3.Black());
        particleSystem.getRampGradients()[0].color = Color3.FromHexString("#BBC1FF");
        particleSystem.getRampGradients()[1].color = Color3.FromHexString("#FFFFFF");
        particleSystem.maxAngularSpeed = 0;
        particleSystem.maxInitialRotation = 360;
        particleSystem.minAngularSpeed = -10;
        particleSystem.maxAngularSpeed = 10;

        particleSystem.start();

        this.sparkler = particleSystem;
    }


}
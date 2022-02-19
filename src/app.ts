import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, FreeCamera, Color4, StandardMaterial, Color3, PointLight, ShadowGenerator, Quaternion, Matrix, SceneLoader } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";
import { Environment } from "./environment";
import { Player } from "./characterController";
import { PlayerInput } from "./inputController";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3 }

class App {
    // 通用完整应用程序
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

    // 游戏状态相关
    public assets;
    private _input: PlayerInput;
    private _player: Player;
    private _environment: Environment;


    // 场景相关
    private _state: number = 0;
    private _gamescene: Scene;
    private _cutScene: Scene;


    constructor() {
        this._canvas = this._createCanvas();

        // 初始化巴比伦场景和引擎
        this._engine = new Engine(this._canvas, true);
        this._scene = new Scene(this._engine);

        // 隐藏/显示检查员
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        // 运行主渲染循环
        this._main();
    }

    private _createCanvas(): HTMLCanvasElement {

        //Commented out for development
        // document.documentElement.style["overflow"] = "hidden";
        // document.documentElement.style.overflow = "hidden";
        // document.documentElement.style.width = "100%";
        // document.documentElement.style.height = "100%";
        // document.documentElement.style.margin = "0";
        // document.documentElement.style.padding = "0";
        // document.body.style.overflow = "hidden";
        // document.body.style.width = "100%";
        // document.body.style.height = "100%";
        // document.body.style.margin = "0";
        // document.body.style.padding = "0";

        // 创建画布html元素并将其附加到网页
        this._canvas = document.createElement("canvas");
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.id = "gameCanvas";
        document.body.appendChild(this._canvas);

        return this._canvas;
    }

    private async _main(): Promise<void> {
        await this._goToStart();

        // 注册渲染循环以重复渲染场景
        this._engine.runRenderLoop(() => {
            switch (this._state) {
                case State.START:
                    this._scene.render();
                    break;
                case State.CUTSCENE:
                    this._scene.render();
                    break;
                case State.GAME:
                    this._scene.render();
                    break;
                case State.LOSE:
                    this._scene.render();
                    break;
                default: break;
            }
        });

        // 如果屏幕已调整大小/旋转，请调整大小
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }

    private async _goToStart() {
        this._engine.displayLoadingUI();

        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        // 为所有GUI元素创建全屏ui
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720; // 将我们的全屏用户界面调整到这个高度

        // 创建一个简单的按钮
        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.width = 0.2
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-14px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        guiMenu.addControl(startBtn);

        // 这将处理与附加到场景的“开始”按钮的交互
        startBtn.onPointerDownObservable.add(() => {
            this._goToCutScene();
            scene.detachControl(); // 禁用的可观测值
        });

        // --场景加载完毕--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI();
        // 最后，将当前状态设置为“开始”状态，并将场景设置为“开始”场景
        this._scene.dispose();
        this._scene = scene;
        this._state = State.START;
    }

    private async _goToCutScene(): Promise<void> {
        this._engine.displayLoadingUI();
        // --设置场景--
        // 加载游戏时，不要检测到此ui的任何输入
        this._scene.detachControl();
        this._cutScene = new Scene(this._engine);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), this._cutScene);
        camera.setTarget(Vector3.Zero());
        this._cutScene.clearColor = new Color4(0, 0, 0, 1);

        //--GUI--
        const cutScene = AdvancedDynamicTexture.CreateFullscreenUI("cutscene");

        // --进展对话--
        const next = Button.CreateSimpleButton("next", "NEXT");
        next.color = "white";
        next.thickness = 0;
        next.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        next.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        next.width = "64px";
        next.height = "64px";
        next.top = "-3%";
        next.left = "-12%";
        cutScene.addControl(next);

        next.onPointerUpObservable.add(() => {
            this._goToGame();
        })

        // --场景加载完成后--
        await this._cutScene.whenReadyAsync();
        this._engine.hideLoadingUI();
        this._scene.dispose();
        this._state = State.CUTSCENE;
        this._scene = this._cutScene;

        // --在此场景中开始加载和设置游戏--
        var finishedLoading = false;
        await this._setUpGame().then(res => {
            finishedLoading = true;
            this._goToGame();
        });
    }

    private async _setUpGame() {
        let scene = new Scene(this._engine);
        this._gamescene = scene;


        // ...装载资产
        // --创造环境---
        const environment = new Environment(scene);
        this._environment = environment; // 应用程序的类变量

        // 加载环境和角色资源
        // 在尝试导入角色网格之前等待环境完全加载并设置好
        await this._environment.load(); // 环境
        await this._loadCharacterAssets(scene); // 角色
    }

    private async _loadCharacterAssets(scene) {

        async function loadCharacter() {
            // 碰撞网格
            const outer = MeshBuilder.CreateBox("outer", { width: 2, depth: 1, height: 3 }, scene);
            outer.isVisible = false;
            outer.isPickable = false;
            outer.checkCollisions = true;

            // 将盒子碰撞器的原点移动到网格的底部（以匹配导入的玩家网格）
            outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0))

            // 对于碰撞
            outer.ellipsoid = new Vector3(1, 1.5, 1);
            outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

            outer.rotationQuaternion = new Quaternion(0, 1, 0, 0); // 将播放器网格旋转 180，因为我们想看到播放器的背面 


            return SceneLoader.ImportMeshAsync(null, "./models/", "player.glb", scene).then((result) => {
                const root = result.meshes[0];
                // body 是我们实际的玩家网格
                const body = root;
                body.parent = outer;
                body.isPickable = false; // 所以我们的光线投射不会击中我们自己  
                body.getChildMeshes().forEach(m => {
                    m.isPickable = false;
                })
                return {
                    mesh: outer as Mesh,
                }
            });
        }
        return loadCharacter().then(assets => {
            this.assets = assets;
        })

    }

    private async _initializeGameAsync(scene): Promise<void> {
        // 临时灯光照亮整个场景
        var light0 = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);

        const light = new PointLight("sparklight", new Vector3(0, 0, 0), scene);
        light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
        light.intensity = 35;
        light.radius = 1;

        const shadowGenerator = new ShadowGenerator(1024, light);
        shadowGenerator.darkness = 0.4;

        // 创建玩家
        this._player = new Player(this.assets, scene, shadowGenerator, this._input); // 还没有输入，所以我们不需要传递
        const camera = this._player.activatePlayerCamera();

        //--COLLISIONS--
        // this.mesh.actionManager = new ActionManager(this.scene);
    }

    private async _goToGame() {
        // --设置场景--
        this._scene.detachControl();
        let scene = this._gamescene;
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098); // a color that fit the overall color scheme better

        //--GUI--
        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        // 加载游戏时，不要检测到此ui的任何输入
        scene.detachControl();

        // 创建一个简单的按钮
        const loseBtn = Button.CreateSimpleButton("lose", "LOSE");
        loseBtn.width = 0.2
        loseBtn.height = "40px";
        loseBtn.color = "white";
        loseBtn.top = "-14px";
        loseBtn.thickness = 0;
        loseBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        playerUI.addControl(loseBtn);

        // 这将处理与附加到场景的“开始”按钮的交互
        loseBtn.onPointerDownObservable.add(() => {
            this._goToLose();
            scene.detachControl(); // 禁用的可观测值
        });

        // - 输入 - 
        this._input = new PlayerInput(scene); // 检测键盘/移动输入 

        // 原始文字与背景
        await this._initializeGameAsync(scene);

        // --当场景完成加载时--
        await scene.whenReadyAsync();
        scene.getMeshByName("outer").position = scene.getTransformNodeByName("startPosition").getAbsolutePosition(); // 将球员移动到起始位置
        // 摆脱开始场景，切换到游戏场景并更改状态
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        // 游戏准备好了，请重新连接控制按钮
        this._scene.attachControl();
    }

    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();

        // --场景设置--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        guiMenu.addControl(mainBtn);
        // 这将处理与附加到场景的“开始”按钮的交互
        mainBtn.onPointerUpObservable.add(() => {
            this._goToStart();
        });

        // --场景加载完毕--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); // 场景准备就绪后，隐藏加载
        // 最后，将当前状态设置为“丢失”状态，并将场景设置为“丢失”场景
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }
}
new App();
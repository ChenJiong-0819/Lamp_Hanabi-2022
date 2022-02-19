import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, FreeCamera, Color4, StandardMaterial, Color3, PointLight, ShadowGenerator, Quaternion, Matrix, SceneLoader } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, Image } from "@babylonjs/gui";
import { Environment } from "./environment";
import { Player } from "./characterController";
import { PlayerInput } from "./inputController";
import { Hud } from "./ui";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3 }

class App {
    // 通用完整应用程序
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

    // 游戏状态相关
    public assets;
    private _input: PlayerInput;
    private _environment: Environment;
    private _player: Player;
    private _ui: Hud;


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
        this._canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        document.body.appendChild(this._canvas);

        // this._canvas = document.createElement("canvas");
        // this._canvas.style.width = "100%";
        // this._canvas.style.height = "100%";
        // this._canvas.id = "gameCanvas";
        // document.body.appendChild(this._canvas);

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
                    // 一旦定时器 240 秒，带我们进入失败状态
                    if (this._ui.time >= 240 && !this._player.win) {
                        this._goToLose();
                        this._ui.stopTimer();
                    }

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
        let transition = 0; // 基于对话的增量
        let canplay = false;
        let finished_anim = false;
        let anims_loaded = 0;

        // 动画
        const beginning_anim = new Image("sparkLife", "./sprites/beginning_anim.png");
        beginning_anim.stretch = Image.STRETCH_UNIFORM;
        beginning_anim.cellId = 0;
        beginning_anim.cellHeight = 480;
        beginning_anim.cellWidth = 480;
        beginning_anim.sourceWidth = 480;
        beginning_anim.sourceHeight = 480;
        cutScene.addControl(beginning_anim);
        beginning_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })
        const working_anim = new Image("sparkLife", "./sprites/working_anim.png");
        working_anim.stretch = Image.STRETCH_UNIFORM;
        working_anim.cellId = 0;
        working_anim.cellHeight = 480;
        working_anim.cellWidth = 480;
        working_anim.sourceWidth = 480;
        working_anim.sourceHeight = 480;
        working_anim.isVisible = false;
        cutScene.addControl(working_anim);
        working_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })
        const dropoff_anim = new Image("sparkLife", "./sprites/dropoff_anim.png");
        dropoff_anim.stretch = Image.STRETCH_UNIFORM;
        dropoff_anim.cellId = 0;
        dropoff_anim.cellHeight = 480;
        dropoff_anim.cellWidth = 480;
        dropoff_anim.sourceWidth = 480;
        dropoff_anim.sourceHeight = 480;
        dropoff_anim.isVisible = false;
        cutScene.addControl(dropoff_anim);
        dropoff_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })
        const leaving_anim = new Image("sparkLife", "./sprites/leaving_anim.png");
        leaving_anim.stretch = Image.STRETCH_UNIFORM;
        leaving_anim.cellId = 0;
        leaving_anim.cellHeight = 480;
        leaving_anim.cellWidth = 480;
        leaving_anim.sourceWidth = 480;
        leaving_anim.sourceHeight = 480;
        leaving_anim.isVisible = false;
        cutScene.addControl(leaving_anim);
        leaving_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })
        const watermelon_anim = new Image("sparkLife", "./sprites/watermelon_anim.png");
        watermelon_anim.stretch = Image.STRETCH_UNIFORM;
        watermelon_anim.cellId = 0;
        watermelon_anim.cellHeight = 480;
        watermelon_anim.cellWidth = 480;
        watermelon_anim.sourceWidth = 480;
        watermelon_anim.sourceHeight = 480;
        watermelon_anim.isVisible = false;
        cutScene.addControl(watermelon_anim);
        watermelon_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })
        const reading_anim = new Image("sparkLife", "./sprites/reading_anim.png");
        reading_anim.stretch = Image.STRETCH_UNIFORM;
        reading_anim.cellId = 0;
        reading_anim.cellHeight = 480;
        reading_anim.cellWidth = 480;
        reading_anim.sourceWidth = 480;
        reading_anim.sourceHeight = 480;
        reading_anim.isVisible = false;
        cutScene.addControl(reading_anim);
        reading_anim.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })

        // 对话动画
        const dialogueBg = new Image("sparkLife", "./sprites/bg_anim_text_dialogue.png");
        dialogueBg.stretch = Image.STRETCH_UNIFORM;
        dialogueBg.cellId = 0;
        dialogueBg.cellHeight = 480;
        dialogueBg.cellWidth = 480;
        dialogueBg.sourceWidth = 480;
        dialogueBg.sourceHeight = 480;
        dialogueBg.horizontalAlignment = 0;
        dialogueBg.verticalAlignment = 0;
        dialogueBg.isVisible = false;
        cutScene.addControl(dialogueBg);
        dialogueBg.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })

        const dialogue = new Image("sparkLife", "./sprites/text_dialogue.png");
        dialogue.stretch = Image.STRETCH_UNIFORM;
        dialogue.cellId = 0;
        dialogue.cellHeight = 480;
        dialogue.cellWidth = 480;
        dialogue.sourceWidth = 480;
        dialogue.sourceHeight = 480;
        dialogue.horizontalAlignment = 0;
        dialogue.verticalAlignment = 0;
        dialogue.isVisible = false;
        cutScene.addControl(dialogue);
        dialogue.onImageLoadedObservable.add(() => {
            anims_loaded++;
        })

        // 为对话背景循环动画
        let dialogueTimer = setInterval(() => {
            if (finished_anim && dialogueBg.cellId < 3) {
                dialogueBg.cellId++;
            } else {
                dialogueBg.cellId = 0;
            }
        }, 250);

        // 跳过剪贴画
        const skipBtn = Button.CreateSimpleButton("skip", "SKIP");
        skipBtn.fontFamily = "Viga";
        skipBtn.width = "45px";
        skipBtn.left = "-14px";
        skipBtn.height = "40px";
        skipBtn.color = "white";
        skipBtn.top = "14px";
        skipBtn.thickness = 0;
        skipBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        skipBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        cutScene.addControl(skipBtn);

        skipBtn.onPointerDownObservable.add(() => {
            this._cutScene.detachControl();
            clearInterval(animTimer);
            clearInterval(anim2Timer);
            clearInterval(dialogueTimer);
            this._engine.displayLoadingUI();
            canplay = true;
        });

        // --播放动画--
        let animTimer;
        let anim2Timer;
        let anim = 1; // 跟踪我们正在播放的动画
        // 设置动画的状态机
        this._cutScene.onBeforeRenderObservable.add(() => {
            if (anims_loaded == 8) {
                this._engine.hideLoadingUI();
                anims_loaded = 0;

                // 动画序列
                animTimer = setInterval(() => {
                    switch (anim) {
                        case 1:
                            if (beginning_anim.cellId == 9) { // 每个动画可以有不同的帧数
                                anim++;
                                beginning_anim.isVisible = false; // 当前动画隐藏
                                working_anim.isVisible = true; // 显示下一个动画
                            } else {
                                beginning_anim.cellId++;
                            }
                            break;
                        case 2:
                            if (working_anim.cellId == 11) {
                                anim++;
                                working_anim.isVisible = false;
                                dropoff_anim.isVisible = true;
                            } else {
                                working_anim.cellId++;
                            }
                            break;
                        case 3:
                            if (dropoff_anim.cellId == 11) {
                                anim++;
                                dropoff_anim.isVisible = false;
                                leaving_anim.isVisible = true;
                            } else {
                                dropoff_anim.cellId++;
                            }
                            break;
                        case 4:
                            if (leaving_anim.cellId == 9) {
                                anim++;
                                leaving_anim.isVisible = false;
                                watermelon_anim.isVisible = true;
                            } else {
                                leaving_anim.cellId++;
                            }
                            break;
                        default:
                            break;
                    }
                }, 250);

                // 使用不同时间间隔的动画序列2
                anim2Timer = setInterval(() => {
                    switch (anim) {
                        case 5:
                            if (watermelon_anim.cellId == 8) {
                                anim++;
                                watermelon_anim.isVisible = false;
                                reading_anim.isVisible = true;
                            } else {
                                watermelon_anim.cellId++;
                            }
                            break;
                        case 6:
                            if (reading_anim.cellId == 11) {
                                reading_anim.isVisible = false;
                                finished_anim = true;
                                dialogueBg.isVisible = true;
                                dialogue.isVisible = true;
                                next.isVisible = true;
                            } else {
                                reading_anim.cellId++;
                            }
                            break;
                    }
                }, 750);
            }
            // 只有当所有游戏资源都完成加载，并且你完成了动画序列+对话后，你才能进入游戏状态
            if (finishedLoading && canplay) {
                canplay = false;
                this._goToGame();
            }
        })


        // --进展对话--
        const next = Button.CreateSimpleButton("next", "NEXT");
        next.rotation = Math.PI / 2;
        next.thickness = 0;
        next.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        next.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        next.width = "64px";
        next.height = "64px";
        next.top = "-3%";
        next.left = "-12%";
        next.isVisible = false;
        cutScene.addControl(next);


        next.onPointerUpObservable.add(() => {
            if (transition == 8) { // 一旦我们到达最后一个对话框架，goToGame
                this._cutScene.detachControl();
                this._engine.displayLoadingUI(); // 如果游戏尚未加载，我们将看到加载屏幕
                transition = 0;
                canplay = true;
            } else if (transition < 8) { // 8个对话框架
                transition++;
                dialogue.cellId++;
            }
        })

        // --场景加载完成后--
        await this._cutScene.whenReadyAsync();
        this._scene.dispose();
        this._state = State.CUTSCENE;
        this._scene = this._cutScene;

        // --在此场景中开始加载和设置游戏--
        var finishedLoading = false;
        await this._setUpGame().then(res => {
            finishedLoading = true;
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
            console.log("加载字符资产");
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

        // 设置灯笼碰撞检查
        this._environment.checkLanterns(this._player);

        // --过渡后处理--
        scene.onBeforeRenderObservable.add(() => {
            //reset the sparkler timer
            if (this._player.sparkReset) {
                this._ui.startSparklerTimer();
                this._player.sparkReset = false;
            }
            //stop the sparkler timer after 20 seconds
            else if (this._ui.stopSpark && this._player.sparkLit) {
                this._ui.stopSparklerTimer();
                this._player.sparkLit = false;
            }
            // when the game isn't paused, update the timer
            if (!this._ui.gamePaused) {
                this._ui.updateHud();
            }
        });
    }

    private async _goToGame() {
        // --设置场景--
        this._scene.detachControl();
        let scene = this._gamescene;
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098); // a color that fit the overall color scheme better

        //--GUI--
        const ui = new Hud(scene);
        this._ui = ui;
        // 加载游戏时，不要检测到此ui的任何输入
        scene.detachControl();

        // - 输入 - 
        this._input = new PlayerInput(scene, this._ui); // 检测键盘/移动输入 

        // 原始文字与背景
        await this._initializeGameAsync(scene);

        // --当场景完成加载时--
        await scene.whenReadyAsync();
        scene.getMeshByName("outer").position = scene.getTransformNodeByName("startPosition").getAbsolutePosition(); // 将球员移动到起始位置

        // 设置游戏计时器和火花计时器——链接到用户界面
        this._ui.startTimer();
        // this._ui.startSparklerTimer(this._player.sparkler);

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
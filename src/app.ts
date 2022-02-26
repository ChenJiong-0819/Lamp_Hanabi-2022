import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";

import { Engine, Scene, Vector3, Mesh, Color3, Color4, ShadowGenerator, GlowLayer, PointLight, FreeCamera, CubeTexture, Sound, PostProcess, Effect, SceneLoader, Matrix, MeshBuilder, Quaternion, AssetsManager, EngineFactory } from "@babylonjs/core";
import { PlayerInput } from "./inputController";
import { Player } from "./characterController";
import { Hud } from "./ui";
import { AdvancedDynamicTexture, StackPanel, Button, TextBlock, Rectangle, Control, Image } from "@babylonjs/gui";
import { Environment } from "./environment";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3 }

class App {
    // 通用完整应用程序
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

    // 游戏状态相关
    public assets;
    private _input: PlayerInput;
    private _environment;
    private _player: Player;
    private _ui: Hud;

    // 声音
    public game: Sound;
    public end: Sound;

    // 场景相关
    private _state: number = 0;
    private _gamescene: Scene;
    private _cutScene: Scene;

    // 后处理
    private _transition: boolean = false;

    constructor() {
        this._canvas = this._createCanvas();

        // 初始化巴比伦场景和引擎
        this._init();
    }

    private async _init(): Promise<void> {
        this._engine = (await EngineFactory.CreateAsync(this._canvas, undefined)) as Engine;
        this._scene = new Scene(this._engine);

        //**用于开发：使检查员可见/不可见
        window.addEventListener("keydown", (ev) => {
            //Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        // 主渲染循环和状态机
        await this._main();
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
                    if (this._ui.quit) {
                        this._goToStart();
                        this._ui.quit = false;
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


    private async _goToStart() {
        this._engine.displayLoadingUI();// 确保等待开始加载

        // --场景设置--
        // 加载游戏时，不要检测到此ui的任何输入
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        // --声音--
        const start = new Sound("startSong", "./sounds/copycat(revised).mp3", scene, function () {
        }, {
            volume: 0.25,
            loop: true,
            autoplay: true
        });
        const sfx = new Sound("selection", "./sounds/vgmenuselect.wav", scene, function () {
        });

        // 为所有GUI元素创建全屏ui
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720; // 将我们的全屏用户界面调整到这个高度

        // 背景图
        const imageRect = new Rectangle("titleContainer");
        imageRect.width = 0.8;
        imageRect.thickness = 0;
        guiMenu.addControl(imageRect);

        const startbg = new Image("startbg", "sprites/start.jpeg");
        imageRect.addControl(startbg);

        const title = new TextBlock("title", "LANTERN'S FESTIVAL");
        title.resizeToFit = true;
        title.fontFamily = "Ceviche One";
        title.fontSize = "64px";
        title.color = "white";
        title.resizeToFit = true;
        title.top = "14px";
        title.width = 0.8;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        imageRect.addControl(title);

        // 创建一个简单的按钮
        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.fontFamily = "Viga";
        startBtn.width = 0.2
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-14px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        imageRect.addControl(startBtn);

        // 设置过渡效果：的修改版本https://www.babylonjs-playground.com/#2FGYE8#0
        Effect.RegisterShader("fade",
            "precision highp float;" +
            "varying vec2 vUV;" +
            "uniform sampler2D textureSampler; " +
            "uniform float fadeLevel; " +
            "void main(void){" +
            "vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;" +
            "baseColor.a = 1.0;" +
            "gl_FragColor = baseColor;" +
            "}");

        let fadeLevel = 1.0;
        this._transition = false;
        scene.registerBeforeRender(() => {
            if (this._transition) {
                fadeLevel -= .05;
                if (fadeLevel <= 0) {
                    this._goToCutScene();
                    this._transition = false;
                }
            }
        })


        // 这将处理与附加到场景的“开始”按钮的交互
        startBtn.onPointerDownObservable.add(() => {
            // 褪色屏幕
            const postProcess = new PostProcess("Fade", "fade", ["fadeLevel"], null, 1.0, camera);
            postProcess.onApply = (effect) => {
                effect.setFloat("fadeLevel", fadeLevel);
            };
            this._transition = true;

            // 声音
            sfx.play();

            scene.detachControl(); // 禁用的可观测值
        });

        let isMobile = false;
        // --流动的--
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            isMobile = true;
            // 用于移动设备旋转屏幕的弹出窗口
            const rect1 = new Rectangle();
            rect1.height = 0.2;
            rect1.width = 0.3;
            rect1.verticalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect1.horizontalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            rect1.background = "white";
            rect1.alpha = 0.8;
            guiMenu.addControl(rect1);

            const rect = new Rectangle();
            rect.height = 0.2;
            rect.width = 0.3;
            rect.verticalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect.horizontalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            rect.color = "whites";
            guiMenu.addControl(rect);

            const stackPanel = new StackPanel();
            stackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
            rect.addControl(stackPanel);

            // 图片
            const image = new Image("rotate", "./sprites/rotate.png")
            image.width = 0.4;
            image.height = 0.6;
            image.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            rect.addControl(image);

            // 警报信息
            const alert = new TextBlock("alert", "For the best experience, please rotate your device");
            alert.fontSize = "16px";
            alert.fontFamily = "Viga";
            alert.color = "black";
            alert.resizeToFit = true;
            alert.textWrapping = true;
            stackPanel.addControl(alert);

            const closealert = Button.CreateSimpleButton("close", "X");
            closealert.height = "24px";
            closealert.width = "24px";
            closealert.color = "black";
            stackPanel.addControl(closealert);

            // 取消对播放按钮的控制，直到用户关闭通知（允许全屏模式）
            startBtn.isHitTestVisible = false;

            closealert.onPointerUpObservable.add(() => {
                guiMenu.removeControl(rect);
                guiMenu.removeControl(rect1);

                startBtn.isHitTestVisible = true;
                this._engine.enterFullscreen(true);
            })
        }


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

        //--SOUNDS--
        this._loadSounds(scene);

        // ...装载资产
        // --创造环境---
        const environment = new Environment(scene);
        this._environment = environment; // 应用程序的类变量

        // 加载环境和角色资源
        // 在尝试导入角色网格之前等待环境完全加载并设置好
        await this._environment.load(); // 环境
        await this._loadCharacterAssets(scene); // 角色
    }

    // 为游戏场景加载声音
    private _loadSounds(scene: Scene): void {

        this.game = new Sound("gameSong", "./sounds/Christmassynths.wav", scene, function () {
        }, {
            loop: true,
            volume: 0.1
        });

        this.end = new Sound("endSong", "./sounds/copycat(revised).mp3", scene, function () {
        }, {
            volume: 0.25
        });
    }

    private async _goToGame() {
        // --设置场景--
        this._scene.detachControl();
        let scene = this._gamescene;

        //--GUI--
        const ui = new Hud(scene);
        this._ui = ui;
        // 加载游戏时，不要检测到此ui的任何输入
        scene.detachControl();

        // IBL（基于图像的照明）-为场景提供环境光
        const envHdri = CubeTexture.CreateFromPrefilteredData("textures/envtext.env", scene);
        envHdri.name = "env";
        envHdri.gammaSpace = false;
        scene.environmentTexture = envHdri;
        scene.environmentIntensity = 0.04;

        // - 输入 - 
        this._input = new PlayerInput(scene, this._ui); // 检测键盘/移动输入 

        // 原始文字与背景
        await this._initializeGameAsync(scene);

        // --当场景完成加载时--
        await scene.whenReadyAsync();

        // 设置游戏循环后要完成的操作
        scene.getMeshByName("outer").position = scene.getTransformNodeByName("startPosition").getAbsolutePosition(); // 将球员移动到起始位置

        // 设置游戏计时器和火花计时器——链接到用户界面
        this._ui.startTimer();
        this._ui.startSparklerTimer(this._player.sparkler);

        // 摆脱开始场景，切换到游戏场景并更改状态
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        // 游戏准备好了，请重新连接控制按钮
        this._scene.attachControl();
    }

    private _showWin(): void {

        // 停止游戏声音，播放结束曲
        this.game.dispose();
        this.end.play();
        this._player.onRun.clear();

        const winUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        winUI.idealHeight = 720;

        const rect = new Rectangle();
        rect.thickness = 0;
        rect.background = "black";
        rect.alpha = 0.4;
        rect.width = 0.4;
        winUI.addControl(rect);

        const stackPanel = new StackPanel("credits");
        stackPanel.width = 0.4;
        stackPanel.fontFamily = "Viga";
        stackPanel.fontSize = "16px";
        stackPanel.color = "white";
        winUI.addControl(stackPanel);

        const wincreds = new TextBlock("special");
        wincreds.resizeToFit = true;
        wincreds.color = "white";
        wincreds.text = "感谢您观看我的毕业设计!";
        wincreds.textWrapping = true;
        wincreds.height = "24px";
        wincreds.width = "100%";
        wincreds.fontFamily = "Viga";
        stackPanel.addControl(wincreds);

        // 最后简介
        const title = new TextBlock("title", "题目：基于开源引擎的网页3D游戏的设计与实现");
        title.fontSize = 22;
        title.resizeToFit = true;
        title.textWrapping = true;

        const school = new TextBlock("school", "学校：广东科技学院")
        school.textWrapping = true;
        school.resizeToFit = true;

        const classes = new TextBlock("classes", "班级：18软件工程18班");
        classes.textWrapping = true;
        classes.resizeToFit = true;

        const name = new TextBlock("name", "姓名：陈炯");
        name.textWrapping = true;
        name.resizeToFit = true;

        const studentNumber = new TextBlock("studentNumber", "学号：CB18130916");
        studentNumber.textWrapping = true;
        studentNumber.resizeToFit = true;

        const tearcher = new TextBlock("tearcher", "指导老师：聂鹏");
        tearcher.textWrapping = true;
        tearcher.resizeToFit = true;

        const gamename = new TextBlock("gamename", "游戏名：LANTERN'S FESTIVAL");
        gamename.textWrapping = true;
        gamename.resizeToFit = true;

        // const loseCred = new TextBlock("loseSong", "Eye of the Storm by Joth - opengameart.org");
        // loseCred.textWrapping = true;
        // loseCred.resizeToFit = true;

        // const fireworksSfx = new TextBlock("fireworks", "rubberduck - opengameart.org")
        // fireworksSfx.textWrapping = true;
        // fireworksSfx.resizeToFit = true;

        // const dashCred = new TextBlock("dashCred", "Woosh Noise 1 by potentjello - freesound.org");
        // dashCred.textWrapping = true;
        // dashCred.resizeToFit = true;

        // // 退出，sparkwarning，重置
        // const sfxCred = new TextBlock("sfxCred", "200 Free SFX - https://kronbits.itch.io/freesfx");
        // sfxCred.textWrapping = true;
        // sfxCred.resizeToFit = true;

        // // 电灯
        // const sfxCred2 = new TextBlock("sfxCred2", "sound pack by wobbleboxx.com - opengameart.org");
        // sfxCred2.textWrapping = true;
        // sfxCred2.resizeToFit = true;

        // const selectionSfxCred = new TextBlock("select", "8bit menu select by Fupi - opengameart.org");
        // selectionSfxCred.textWrapping = true;
        // selectionSfxCred.resizeToFit = true;

        stackPanel.addControl(title);
        stackPanel.addControl(school);
        stackPanel.addControl(classes);
        stackPanel.addControl(name);
        stackPanel.addControl(studentNumber);
        stackPanel.addControl(tearcher);
        stackPanel.addControl(gamename);
        // stackPanel.addControl(loseCred);
        // stackPanel.addControl(fireworksSfx);
        // stackPanel.addControl(dashCred);
        // stackPanel.addControl(sfxCred);
        // stackPanel.addControl(sfxCred2);
        // stackPanel.addControl(selectionSfxCred);

        const mainMenu = Button.CreateSimpleButton("mainmenu", "RETURN");
        mainMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        mainMenu.fontFamily = "Viga";
        mainMenu.width = 0.2
        mainMenu.height = "40px";
        mainMenu.color = "white";
        winUI.addControl(mainMenu);

        mainMenu.onPointerDownObservable.add(() => {
            this._ui.transition = true;
            this._ui.quitSfx.play();
        })

    }

    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();

        // --场景设置--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        // --声音--
        const start = new Sound("loseSong", "./sounds/Eye of the Storm.mp3", scene, function () {
        }, {
            volume: 0.25,
            loop: true,
            autoplay: true
        });
        const sfx = new Sound("selection", "./sounds/vgmenuselect.wav", scene, function () {
        });

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720;

        // 背景图
        const image = new Image("lose", "sprites/lose.jpeg");
        image.autoScale = true;
        guiMenu.addControl(image);

        const panel = new StackPanel();
        guiMenu.addControl(panel);

        const text = new TextBlock();
        text.fontSize = 24;
        text.color = "white";
        text.height = "100px";
        text.width = "100%";
        panel.addControl(text);

        text.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        text.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        text.text = "There's no fireworks this year";
        const dots = new TextBlock();
        dots.color = "white";
        dots.fontSize = 24;
        dots.height = "100px";
        dots.width = "100%";
        dots.text = "...."

        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        panel.addControl(mainBtn);

        // 设置过渡效果：的修改版本https://www.babylonjs-playground.com/#2FGYE8#0
        Effect.RegisterShader("fade",
            "precision highp float;" +
            "varying vec2 vUV;" +
            "uniform sampler2D textureSampler; " +
            "uniform float fadeLevel; " +
            "void main(void){" +
            "vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;" +
            "baseColor.a = 1.0;" +
            "gl_FragColor = baseColor;" +
            "}");

        let fadeLevel = 1.0;
        this._transition = false;
        scene.registerBeforeRender(() => {
            if (this._transition) {
                fadeLevel -= .05;
                if (fadeLevel <= 0) {

                    this._goToStart();
                    this._transition = false;
                }
            }
        })

        // 这将处理与附加到场景的“开始”按钮的交互
        mainBtn.onPointerUpObservable.add(() => {
            // todo:添加淡入过渡和选择sfx
            scene.detachControl();
            guiMenu.dispose();

            this._transition = true;
            sfx.play();
        });

        // --场景加载完毕--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); // 场景准备就绪后，隐藏加载
        // 最后，将当前状态设置为“丢失”状态，并将场景设置为“丢失”场景
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }

    // 加载角色模型
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
                // 返回网格和动画
                return {
                    mesh: outer as Mesh,
                    animationGroups: result.animationGroups
                }
            });
        }
        return loadCharacter().then(assets => {
            this.assets = assets;
        })

    }

    private async _initializeGameAsync(scene): Promise<void> {
        scene.ambientColor = new Color3(0.34509803921568627, 0.5568627450980392, 0.8352941176470589);
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098);

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
        scene.registerBeforeRender(() => {
            if (this._ui.transition) {
                this._ui.fadeLevel -= .05;

                //once the fade transition has complete, switch scenes
                if (this._ui.fadeLevel <= 0) {
                    this._ui.quit = true;
                    this._ui.transition = false;
                }
            }
        })

        // --过渡后处理--
        scene.onBeforeRenderObservable.add(() => {
            // 重置火花计时器
            if (this._player.sparkReset) {
                this._ui.startSparklerTimer(this._player.sparkler);
                this._player.sparkReset = false;

                this._ui.updateLanternCount(this._player.lanternsLit);
            }
            // 20秒后停止闪烁计时器
            else if (this._ui.stopSpark && this._player.sparkLit) {
                this._ui.stopSparklerTimer(this._player.sparkler);
                this._player.sparkLit = false;
            }

            // 如果你已经到达目的地并点亮了所有的灯笼
            if (this._player.win && this._player.lanternsLit == 22) {
                this._ui.gamePaused = true; // 停止计时，这样烟花可以燃放，玩家就不能走动了
                // 不允许暂停菜单交互
                this._ui.pauseBtn.isHitTestVisible = false;

                let i = 10; // 10秒
                window.setInterval(() => {
                    i--;
                    if (i == 0) {
                        this._showWin();
                    }
                }, 1000);

                this._environment._startFireworks = true;
                this._player.win = false;
            }

            if (!this._ui.gamePaused) {
                this._ui.updateHud();
            }
            // 如果玩家尝试了所有教程中的移动，如果他们还没有点亮下一个灯笼，请继续提示
            if (this._player.tutorial_move && this._player.tutorial_jump && this._player.tutorial_dash && (this._ui.tutorial.isVisible || this._ui.hint.isVisible)) {
                this._ui.tutorial.isVisible = false;
                if (!this._environment._lanternObjs[1].isLit) { // 如果第一盏灯笼还没有点亮，那么就给它一个方向的提示
                    this._ui.hint.isVisible = true;
                } else {
                    this._ui.hint.isVisible = false;
                }
            }
        });
        // 发光层
        const gl = new GlowLayer("glow", scene);
        gl.intensity = 0.4;
        this._environment._lanternObjs.forEach(lantern => {
            gl.addIncludedOnlyMesh(lantern.mesh);
        });
    }
}
new App();